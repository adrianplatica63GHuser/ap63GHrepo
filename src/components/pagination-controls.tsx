"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";

// Slice #37.42 (A018/A019): „Anterior" / „Următor" are ChevronLeft /
// ChevronRight icon buttons, their words the name and the tooltip. (The `BTN`
// constant #23.05.UX left here is gone: IconButton builds its own class.)

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
      <IconButton
        icon={ChevronLeft}
        label={tPag("previous")}
        variant="secondary"
        size="sm"
        onClick={onPrev}
        disabled={!paginate || page === 0}
      />
      <span className="text-xs text-fade dark:text-zinc-400">
        {tPag("pageOf", { page: page + 1, total: totalPages })}
      </span>
      <IconButton
        icon={ChevronRight}
        label={tPag("next")}
        variant="secondary"
        size="sm"
        onClick={onNext}
        disabled={!paginate || page >= totalPages - 1}
      />
    </div>
  );
}
