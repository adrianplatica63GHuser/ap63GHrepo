"use client";

import { useTranslations } from "next-intl";

const BTN =
  "inline-flex items-center rounded-md border border-wire bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800";

interface Props {
  page:     number;
  total:    number;
  pageSize: number;
  onPrev:   () => void;
  onNext:   () => void;
}

export function PaginationControls({ page, total, pageSize, onPrev, onNext }: Props) {
  const tPag      = useTranslations("shared.pagination");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginate   = total > pageSize;

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={!paginate || page === 0}
        className={BTN}
      >
        {tPag("previous")}
      </button>
      <span className="text-xs text-fade dark:text-zinc-400">
        {tPag("pageOf", { page: page + 1, total: totalPages })}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!paginate || page >= totalPages - 1}
        className={BTN}
      >
        {tPag("next")}
      </button>
    </div>
  );
}
