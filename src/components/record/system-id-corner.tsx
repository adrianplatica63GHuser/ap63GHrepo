"use client";

/**
 * A record's system ID — DOC01590, PPERS07056 — in the one place it is shown:
 * the top-right corner of the first panel of its screen.        (Slice #37.57)
 *
 * „Identitate" on a Natural and a Judicial Person, „Date cadastrale" on a
 * Property, „Date generale" on a Document; only on a saved record. Small,
 * monospaced and muted, at the right end of the heading line (`ml-auto` in the
 * heading's flex row), and it never makes the heading wrap (`shrink-0`,
 * `whitespace-nowrap`). The code itself is `select-all`, so one click selects
 * it for copying — the search boxes still match on it. Read aloud as
 * „ID sistem DOC01590".
 *
 * ⚠️ **Nowhere else.** Lists, list tiles, association screens, previews, the
 * recently-viewed panel, global search and the admin screens name a record by
 * its name, or by words when it has none (`shared.unnamed`) — never by its code.
 * `system-id-one-place.test.ts` holds that.
 */
import { useTranslations } from "next-intl";

export function SystemIdCorner({ code }: { code: string }) {
  const t = useTranslations("shared.systemId");
  return (
    <span
      className="ml-auto shrink-0 whitespace-nowrap font-mono text-xs font-normal normal-case tracking-normal text-fade dark:text-zinc-500"
      data-system-id
    >
      <span className="sr-only">{t("label")} </span>
      <span className="select-all">{code}</span>
    </span>
  );
}
