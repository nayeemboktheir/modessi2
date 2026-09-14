import { useCallback, useEffect, useMemo, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 30;
export const PAGE_SIZE_OPTIONS = [30, 50, 100, 200];

interface UsePaginationOptions {
  /** Rows per page to start on. Defaults to DEFAULT_PAGE_SIZE. */
  pageSize?: number;
  /**
   * Serialised filter/search state. Whenever it changes the list jumps back to
   * page 1 — landing on page 7 of a freshly filtered list is never what you want.
   */
  resetKey?: unknown;
}

/**
 * Client-side pagination over an already-loaded array. Admin lists fetch their
 * rows up front and filter in memory, so slicing here matches how the pages
 * already work; nothing about this hook talks to the server.
 */
export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { pageSize: initialPageSize = DEFAULT_PAGE_SIZE, resetKey } = options;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = items?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const resetToken = typeof resetKey === 'string' ? resetKey : JSON.stringify(resetKey ?? null);
  useEffect(() => {
    setPage(1);
  }, [resetToken, pageSize]);

  // The list can shrink under the page you are on — a row gets deleted, or a
  // status change drops the last match on page 7 — so follow it back down.
  useEffect(() => {
    setPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;

  const pageItems = useMemo(
    () => (items || []).slice(pageStart, pageStart + pageSize),
    [items, pageStart, pageSize]
  );

  const goToPage = useCallback(
    (next: number) => setPage(Math.min(Math.max(1, next), totalPages)),
    [totalPages]
  );

  return {
    page: safePage,
    pageSize,
    totalPages,
    totalItems,
    pageStart,
    pageItems,
    goToPage,
    setPageSize,
  };
}
