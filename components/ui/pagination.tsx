"use client";

import { useDashboardT } from "@/lib/i18n-client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, totalRecords, onPageChange }: PaginationProps) {
  const _t = useDashboardT();

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <span className="text-xs font-mono text-[var(--secondary)]">
        {_t('page')} {currentPage} / {totalPages} &middot; {totalRecords} {_t('records')}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="btn btn-secondary text-xs px-2.5 py-1"
        >
          {_t('prev')}
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="btn btn-secondary text-xs px-2.5 py-1"
        >
          {_t('next')}
        </button>
      </div>
    </div>
  );
}
