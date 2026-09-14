#!/usr/bin/env python3
"""Copy every object in the storage bucket from the old Supabase project to the
self-hosted stack, then verify each one.

Reads from the source over plain public HTTPS - the bucket is public, so no
source credentials are needed and the source is never written to. Writes to the
target with the service_role key.

Safe to re-run: objects already on the target at the right size are skipped, so
an interrupted run resumes where it stopped.

Config comes from the environment; use the 03-migrate-storage.sh wrapper.
Standard library only - nothing to install.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SOURCE_URL = os.environ["SOURCE_URL"].rstrip("/")
SOURCE_ANON_KEY = os.environ["SOURCE_ANON_KEY"]
TARGET_URL = os.environ["TARGET_URL"].rstrip("/")
TARGET_SERVICE_KEY = os.environ["TARGET_SERVICE_KEY"]
BUCKET = os.environ.get("BUCKET", "shop-assets")
DRY_RUN = os.environ.get("DRY_RUN", "") not in ("", "0", "false")

TIMEOUT = 120
PAGE = 100


def req(url, method="GET", data=None, headers=None, timeout=TIMEOUT):
    r = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    return urllib.request.urlopen(r, timeout=timeout)


def list_prefix(prefix):
    """Page through one level of the bucket. Returns (files, subfolders)."""
    files, folders, offset = [], [], 0
    while True:
        body = json.dumps({
            "prefix": prefix,
            "limit": PAGE,
            "offset": offset,
            "sortBy": {"column": "name", "order": "asc"},
        }).encode()
        with req(
            SOURCE_URL + "/storage/v1/object/list/" + BUCKET,
            method="POST",
            data=body,
            headers={
                "apikey": SOURCE_ANON_KEY,
                "Authorization": "Bearer " + SOURCE_ANON_KEY,
                "Content-Type": "application/json",
            },
        ) as resp:
            page = json.load(resp)
        if not page:
            break
        for entry in page:
            name = entry["name"]
            full = prefix + "/" + name if prefix else name
            meta = entry.get("metadata")
            # Folder placeholders come back with no id and no metadata.
            if entry.get("id") is None and meta is None:
                folders.append(full)
            else:
                meta = meta or {}
                files.append({
                    "path": full,
                    "size": meta.get("size"),
                    "mime": meta.get("mimetype") or "application/octet-stream",
                    "cache": meta.get("cacheControl") or "max-age=3600",
                })
        if len(page) < PAGE:
            break
        offset += PAGE
    return files, folders


def enumerate_bucket():
    """Breadth-first walk of the whole bucket."""
    all_files, queue, seen = [], [""], set()
    while queue:
        prefix = queue.pop(0)
        if prefix in seen:
            continue
        seen.add(prefix)
        files, folders = list_prefix(prefix)
        all_files.extend(files)
        queue.extend(folders)
    return all_files


def ensure_bucket():
    hdrs = {
        "Authorization": "Bearer " + TARGET_SERVICE_KEY,
        "apikey": TARGET_SERVICE_KEY,
    }
    try:
        with req(TARGET_URL + "/storage/v1/bucket/" + BUCKET, headers=hdrs) as r:
            info = json.load(r)
        print("  target bucket exists (public=%s)" % info.get("public"))
        if not info.get("public"):
            print("  WARNING: target bucket is NOT public - product images will")
            print("           fail for shoppers. Fix in Studio before cutover.")
        return
    except urllib.error.HTTPError as e:
        # storage-api answers a missing bucket with HTTP 400 whose *body* says
        # {"statusCode":"404","error":"Bucket not found"}, so the status code
        # alone cannot be trusted - read the body before deciding.
        body = ""
        try:
            body = e.read().decode("utf-8", "replace")
        except Exception:
            pass
        absent = e.code == 404 or "not found" in body.lower() or '"404"' in body
        if not absent:
            raise RuntimeError("unexpected %s from bucket lookup: %s"
                               % (e.code, body[:200])) from e
    print("  creating target bucket (public)")
    if DRY_RUN:
        return
    body = json.dumps({"id": BUCKET, "name": BUCKET, "public": True}).encode()
    with req(
        TARGET_URL + "/storage/v1/bucket",
        method="POST",
        data=body,
        headers=dict(hdrs, **{"Content-Type": "application/json"}),
    ) as r:
        r.read()


def target_size(path):
    """Content-Length on the target, or None if the object is not there."""
    url = (TARGET_URL + "/storage/v1/object/public/" + BUCKET + "/"
           + urllib.parse.quote(path))
    try:
        with req(url, method="HEAD", timeout=30) as r:
            return int(r.headers.get("Content-Length") or -1)
    except Exception:
        return None


def copy_one(obj):
    path = obj["path"]
    src = (SOURCE_URL + "/storage/v1/object/public/" + BUCKET + "/"
           + urllib.parse.quote(path))
    with req(src) as r:
        blob = r.read()
    if obj["size"] and len(blob) != obj["size"]:
        raise RuntimeError("short read: got %d, expected %d" % (len(blob), obj["size"]))
    dst = (TARGET_URL + "/storage/v1/object/" + BUCKET + "/"
           + urllib.parse.quote(path))
    with req(
        dst,
        method="POST",
        data=blob,
        headers={
            "Authorization": "Bearer " + TARGET_SERVICE_KEY,
            "apikey": TARGET_SERVICE_KEY,
            "Content-Type": obj["mime"],
            "Cache-Control": obj["cache"],
            "x-upsert": "true",
        },
    ) as r:
        r.read()
    return len(blob)


def main():
    print("Source : %s  (read-only, public)" % SOURCE_URL)
    print("Target : %s" % TARGET_URL)
    print("Bucket : %s%s\n" % (BUCKET, "   [DRY RUN]" if DRY_RUN else ""))

    print("==> enumerating source bucket")
    objects = enumerate_bucket()
    if not objects:
        sys.exit("no objects found - check SOURCE_ANON_KEY and bucket name")
    total = sum(o["size"] or 0 for o in objects)
    print("  %d objects, %.1f MB\n" % (len(objects), total / 1048576))

    print("==> checking target bucket")
    ensure_bucket()
    print()

    copied = skipped = failed = 0
    moved = 0
    failures = []
    t0 = time.time()

    for i, obj in enumerate(objects, 1):
        path, size = obj["path"], obj["size"]
        tag = "[%3d/%d] %s" % (i, len(objects), path)
        have = target_size(path)
        if have is not None and size is not None and have == size:
            print("%s  skip (already there, %d B)" % (tag, size))
            skipped += 1
            continue
        if DRY_RUN:
            print("%s  would copy (%s B)" % (tag, size))
            copied += 1
            continue
        try:
            n = copy_one(obj)
            after = target_size(path)
            if after != n:
                raise RuntimeError("verify failed: target reports %s, sent %d" % (after, n))
            print("%s  copied + verified (%d B)" % (tag, n))
            copied += 1
            moved += n
        except Exception as e:
            print("%s  FAILED: %s" % (tag, e))
            failed += 1
            failures.append((path, str(e)))

    print("\n" + "=" * 60)
    print("copied %d   skipped %d   failed %d" % (copied, skipped, failed))
    print("%.1f MB in %.0fs" % (moved / 1048576, time.time() - t0))
    if failures:
        print("\nfailed objects:")
        for p, e in failures:
            print("  %s: %s" % (p, e))
        sys.exit(1)
    print("\nAll objects present and verified on the target.")


if __name__ == "__main__":
    main()
