// Small, shared helpers for embedding external videos safely/consistently.

/**
 * Check if the input looks like raw HTML (iframe snippet).
 * Returns the sanitized iframe HTML or null if not an iframe.
 */
export const parseIframeHtml = (input: string): string | null => {
  const raw = (input || "").trim();
  if (!raw) return null;

  // Check if it starts with an iframe tag
  if (!/^<iframe\s/i.test(raw)) return null;

  // Extract src from the iframe
  const srcMatch = raw.match(/src\s*=\s*["']([^"']+)["']/i);
  if (!srcMatch) return null;

  const src = srcMatch[1];

  // Validate src is a known video provider (security check)
  const allowedDomains = [
    "youtube.com",
    "youtube-nocookie.com",
    "youtu.be",
    "facebook.com",
    "fb.watch",
    "vimeo.com",
    "dailymotion.com",
    "player.vimeo.com",
  ];

  try {
    const url = new URL(src.startsWith("//") ? `https:${src}` : src);
    const isAllowed = allowedDomains.some((d) => url.hostname.includes(d));
    if (!isAllowed) return null;
  } catch {
    return null;
  }

  // Return a cleaned iframe with essential attributes
  return `<iframe src="${src}" style="width:100%;height:500px;border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
};

export const normalizeExternalUrl = (input: string): string => {
  const raw = (input || "").trim();
  if (!raw) return "";

  // Already absolute
  if (/^https?:\/\//i.test(raw)) return raw;

  // Protocol-relative
  if (raw.startsWith("//")) return `https:${raw}`;

  // Common case: "www.facebook.com/..."
  if (raw.startsWith("www.")) return `https://${raw}`;

  // Fallback: treat as https host/path
  return `https://${raw}`;
};

export const getEmbedUrl = (input: string): string => {
  const url = normalizeExternalUrl(input);
  if (!url) return "";

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;

  // Facebook: reels/videos/pages
  if (url.includes("facebook.com") || url.includes("fb.watch")) {
    // If it's already a plugin URL, keep it.
    if (url.includes("facebook.com/plugins/video.php")) return url;

    // Reels sometimes fail to embed directly. Convert to a watch URL when we can.
    // Example: https://www.facebook.com/reel/1525868642033344 -> https://www.facebook.com/watch/?v=1525868642033344
    const reelMatch = url.match(/facebook\.com\/(?:reel|reels)\/(\d+)/i);
    const videoMatch = url.match(/facebook\.com\/(?:watch\/\?v=|videos\/)(\d+)/i);

    const canonicalHref = reelMatch
      ? `https://www.facebook.com/watch/?v=${reelMatch[1]}`
      : videoMatch
        ? `https://www.facebook.com/watch/?v=${videoMatch[1]}`
        : url;

    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonicalHref)}&show_text=false&lazy=true`;
  }

  return url;
};
