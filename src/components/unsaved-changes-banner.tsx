"use client";

import { useTranslations } from "next-intl";

interface Props {
  show: boolean;
}

/**
 * Slice #20.13 — sticky "Modificări nesalvate" banner shown at the top of a
 * form whenever the form has unsaved edits (editDirty === true).
 *
 * Uses sticky top-0 so it remains visible as the user scrolls down a long
 * form. Renders nothing when show is false (no DOM node, no layout shift).
 */
export function UnsavedChangesBanner({ show }: Props) {
  const t = useTranslations("shared.unsavedChanges");
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 shadow-sm dark:border-amber-700/60 dark:bg-amber-900/25 dark:text-amber-300"
    >
      {/* Pencil / edit icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
      </svg>
      <span>{t("title")}</span>
    </div>
  );
}
