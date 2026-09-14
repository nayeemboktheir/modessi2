import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS } from '@/hooks/usePagination';
import { cn } from '@/lib/utils';

interface DataPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  pageStart: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Plural noun for the count line, e.g. "orders", "products". */
  itemLabel?: string;
  className?: string;
}

/** 1 … 4 5 [6] 7 8 … 42 — first, last, and a window around the current page. */
function buildPageList(currentPage: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>([1, totalPages, currentPage]);
  for (const offset of [-2, -1, 1, 2]) {
    const page = currentPage + offset;
    if (page > 1 && page < totalPages) pages.add(page);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((page, idx) => {
    if (idx > 0 && page - sorted[idx - 1] > 1) out.push('gap');
    out.push(page);
  });
  return out;
}

export function DataPagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  pageStart,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  className,
}: DataPaginationProps) {
  const pageNumbers = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  // A list that fits on one page needs no control — showing "1-6 of 6" plus a rows
  // selector on every short admin list is pure clutter.
  if (totalItems === 0 || totalPages <= 1) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between',
        className
      )}
    >
      <div className="text-sm text-muted-foreground">
        Showing {(pageStart + 1).toLocaleString()}-
        {Math.min(pageStart + pageSize, totalItems).toLocaleString()} of{' '}
        {totalItems.toLocaleString()} {itemLabel}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="w-[80px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {pageNumbers.map((entry, idx) =>
            entry === 'gap' ? (
              <span key={`gap-${idx}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={entry}
                variant={entry === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className="w-9 px-0"
              >
                {entry}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="gap-1"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
