"use client";

/**
 * A record's system ID — DOC01590, PPERS07056 — in the one place it is shown:
 * the page bar, immediately left of the versions pill.          (Slice 41.22)
 *
 * Adrian, 2026-10-31: „For all the principal objects remove the system ID that shows on the top right corner of the
 * first grey tile and place it on the top bar at the left of the versions navigation button". So each of the four
 * forms (natural person, juridical person, property, document) portals it into the slot it already portals the
 * versions pill into (`versionNavSlot`, drawn by its `*-detail-tiles.tsx` inside `PageBarControls`), before the pill —
 * only on a saved record, and on an older version or a read-only view the same ID, since it is the same record. When
 * no pill is drawn yet, the ID stands where the pill would be, left of „Panouri". With no shell (a jest render) the
 * controls, and the ID with them, stay in the record's header.
 *
 * Until 41.22 it stood at the right end of the first tile's heading (#37.57, `ml-auto`). The look is unchanged: small,
 * monospaced and muted, never wrapping. On a narrow window the bar's crumbs give way first (41.08); only then is the ID
 * cut, to its „…" (`min-w-0 truncate` in the slot's minmax(0,auto) column), its whole code in the tooltip — measured
 * by TC-LAYOUT-01 at 700 px, where it had made the screen scroll sideways by 70 px. The code itself is `select-all`, so
 * one click selects all of it for copying, cut or not — the search boxes still match on it. Read aloud as „ID sistem
 * DOC01590".
 *
 * ⚠️ **Nowhere else.** Lists, list tiles, association screens, previews, the recently-viewed panel, global search,
 * the admin screens and every tile's heading name a record by its name, or by words when it has none
 * (`shared.unnamed`) — never by its code. `system-id-one-place.test.ts` holds that.
 */
import { useTranslations } from "next-intl";

export function SystemIdCorner({ code }: { code: string }) {
  const t = useTranslations("shared.systemId");
  return (
    <span
      className="min-w-0 truncate font-mono text-xs font-normal normal-case tracking-normal text-fade"
      title={code}
      data-system-id
    >
      <span className="sr-only">{t("label")} </span>
      <span className="select-all">{code}</span>
    </span>
  );
}
