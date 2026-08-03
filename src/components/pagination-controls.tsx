"use client";

import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";

// Slice #23.05.UX: this constant was the codebase's only pre-existing attempt
// at a shared button class string. It is now just a call to the real helper.
const BTN = buttonClass({ variant: "secondary", size: "sm" });

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
