"use client";

import { ArrowRight, PieChart } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { RelatedRow } from "@/components/tiles/related-tile";
import { SHARE_PANEL_STYLE, boxStyle } from "@/lib/ui/field-widths";
import { HintBubble } from "@/lib/ui/hint-bubble";
import { usePressAway } from "@/lib/ui/press-bubble";
import {
  COTA_MOD_VALUES,
  formatCotaParte,
  formatCotaSuprafataMp,
  parseCotaParte,
  parseCotaSuprafataMp,
  type CotaMod,
  type CotaParseError,
} from "@/lib/documents/cota-parte";
import { cotaTotalsByRole } from "@/lib/documents/cota-parte-total";
import { shareCells, storesShare } from "@/lib/documents/share-cells";
import { roleOrQualityLabel } from "@/lib/documents/role-or-quality";
import { openThroughGuard, personPath } from "@/lib/ui/row-link";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PreviewButton } from "@/components/tiles/preview-tiles";
import { personPreview } from "@/lib/ui/previews";
import { isPartyLink } from "@/lib/documents/sale-parties";

/**
 * Which of a document's person links a list draws.             (Slice #38.33)
 * `all` — every link (the default, as before); `parties` — the links whose role
 * holds a share, for a contract de vânzare's „Părți"; `notParties` — the rest,
 * for that contract's „Legături", so each link has one home.
 */
export type PersonLinkScope = "all" | "parties" | "notParties";

/**
 * A Document's persons, as „Corelate"'s rows (Slice #37.65; one line a row
 * since #37.64): „Nume (Rol)", the orange „Cotă" where the role holds a share,
 * „Vizualizare", „Previzualizare". No heading row: #37.59 emptied a
 * Proiectant's share cells but the three names still stood over the empty
 * column. Natural and judicial persons go into their own groups by the
 * person's type.
 */
/** The three cotă boxes at L, so „fără suprafață" shows whole. */
const COTA_BOX_STYLE = boxStyle({ step: "L", kind: "fixed" });

/**
 * ⚠️ **`linkId` IS THE ROW AND `id` IS THE PERSON.**            (Slice #36.02)
 *
 * One person can now hold several roles on one document — seller in his own
 * name and mandatar for three others, which is what `5-CVC 2-2-5000 CRH 2016`
 * says. Everything that identifies a ROW here uses `linkId`: the React key, the
 * selection, the radio, the DELETE and the PATCH. `id` is still the person and
 * is used for exactly one thing, navigating to them.
 *
 * Getting that wrong is not a cosmetic bug: keyed on `id`, the two rows collide
 * as React keys, the radio ticks both, and the DELETE removes the role the user
 * did not ask about.
 */
type AssociatedPerson = {
  linkId:          string;
  id:              string;
  code:            string;
  type:            "NATURAL" | "JUDICIAL";
  displayName:     string;
  personRoleId:    string | null;
  roleName:        string | null;
  /** FU-224: a certificate party's quality, shown where the role would be. */
  quality?:        "DEFUNCT" | "MOSTENITOR" | null;
  cotaParte:       number | null;
  cotaSuprafataMp: number | null;
  cotaMod:         CotaMod | null;
  /** Slice #37.59: the role, on this document's type, holds a share — see `shareCells`. */
  holdsShare:      boolean;
  associatedAt:    string;
};

/** What „Corelate" draws from this list. */
export interface DocumentPersonRows {
  isLoading: boolean;
  rows: RelatedRow[];
  /** Under the rows: the per-role totals, the save status, a load error. */
  below: ReactNode;
  /** „Asociază persoană" — either kind of person. */
  associate: () => void;
}

/** What the user has typed but not yet committed, per row. */
type Draft = { parte?: string; mp?: string };
type CellErrors = { parte?: CotaParseError; mp?: CotaParseError };

async function fetchDocumentPersons(documentId: string): Promise<AssociatedPerson[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedPerson[];
}

/**
 * ⚠️ **EVERY MESSAGE KEY IS A LITERAL, AND THE SWITCH IS WHY.** `t(`cotaMod.${v}`)`
 * would be shorter and would hide all four keys from a grep — and several copy
 * suites in this repo find the keys a component asks for by reading its SOURCE
 * (`.claude/rules/sandbox-and-toolchain.md` records a slice that shipped a red
 * `npx jest` over exactly that). An exhaustive switch also makes TypeScript,
 * rather than a missing translation at runtime, the thing that notices when a
 * fifth `cota_mod` value is added to migration_084's CHECK.
 */
function modLabel(t: (key: string) => string, value: CotaMod): string {
  switch (value) {
    case "NUME_PROPRIU":  return t("cotaMod.NUME_PROPRIU");
    case "DEVALMASIE":    return t("cotaMod.DEVALMASIE");
    case "INDIVIZIUNE":   return t("cotaMod.INDIVIZIUNE");
    case "PRIN_MANDATAR": return t("cotaMod.PRIN_MANDATAR");
  }
}

function cotaErrorLabel(t: (key: string) => string, error: CotaParseError): string {
  switch (error) {
    case "unreadable":      return t("cotaError.unreadable");
    case "zeroDenominator": return t("cotaError.zeroDenominator");
    case "notStorable":     return t("cotaError.notStorable");
    case "negative":        return t("cotaError.negative");
  }
}

export function useDocumentPersonRows(documentId: string, scope: PersonLinkScope = "all"): DocumentPersonRows {
  const t           = useTranslations("document.persons");
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
  const queryClient = useQueryClient();

  const [drafts,     setDrafts]     = useState<Record<string, Draft>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, CellErrors>>({});
  const [savingId,   setSavingId]   = useState<string | null>(null);
  const [saveErr,    setSaveErr]    = useState<string | null>(null);

  /**
   * The row whose share panel is open (#37.64) — one at a time.
   *
   * ⚠️ **CLOSING IT NEVER LOSES A TYPED VALUE.** A press outside or Esc first
   * takes the focus out of the box being typed into, which commits it exactly
   * as leaving the box always did (`onBlur` → `commitNumeric`), and only then
   * closes the panel. Unmounting a focused box would not fire its blur, and
   * the value would be gone with the panel.
   */
  const [shareOpenId, setShareOpenId] = useState<string | null>(null);
  const panelIdBase = useId();
  const closeShare = useCallback((how: "outside" | "escape" | "button") => {
    const panel = document.querySelector<HTMLElement>("[data-share-panel]");
    const active = document.activeElement;
    if (panel && active instanceof HTMLElement && panel.contains(active)) active.blur();
    if (how === "escape") {
      document.querySelector<HTMLElement>("[data-share-open] button[data-share-button]")?.focus();
    }
    setShareOpenId(null);
  }, []);
  const shareRef = usePressAway<HTMLDivElement>(shareOpenId !== null, closeShare);

  // The panel opens on its first box that can be typed into; a read-only one has none.
  useEffect(() => {
    if (shareOpenId === null) return;
    document
      .querySelector<HTMLElement>("[data-share-panel] input:not(:disabled), [data-share-panel] select:not(:disabled)")
      ?.focus();
  }, [shareOpenId]);

  const { data: allItems, isLoading, isError } = useQuery({
    queryKey: ["document-persons", documentId],
    queryFn:  () => fetchDocumentPersons(documentId),
  });
  // Slice #38.33: one query, filtered here — „Părți" and „Legături" read the same rows.
  const items = useMemo(
    () => (allItems ?? []).filter((i) => scope === "all" || (scope === "parties") === isPartyLink(i)),
    [allItems, scope],
  );

  /**
   * The per-role totals, recomputed from whatever is currently SAVED — not from
   * the drafts. A total that moved while the user was still typing „63," would
   * be reporting a number nobody has committed.
   */
  const totals = useMemo(
    () => cotaTotalsByRole(
      // Slice #37.59: only the roles that hold a share (or none is set) are summed — a
      // value kept read-only on a Proiectant is not a share the deed must close to 100%.
      (items ?? []).filter((i) => shareCells(i) === "edit").map((i) => ({
        roleId:    i.personRoleId,
        roleName:  i.roleName,
        cotaParte: i.cotaParte,
        cotaMod:   i.cotaMod,
      })),
    ),
    [items],
  );

  const draftOf = (item: AssociatedPerson, field: "parte" | "mp"): string => {
    const d = drafts[item.linkId]?.[field];
    if (d !== undefined) return d;
    return field === "parte"
      ? formatCotaParte(item.cotaParte)
      : formatCotaSuprafataMp(item.cotaSuprafataMp);
  };

  const setDraft = (linkId: string, field: "parte" | "mp", value: string) => {
    setDrafts((prev) => ({ ...prev, [linkId]: { ...prev[linkId], [field]: value } }));
  };

  const clearDraft = (linkId: string, field: "parte" | "mp") => {
    setDrafts((prev) => {
      const next = { ...prev, [linkId]: { ...prev[linkId] } };
      delete next[linkId][field];
      return next;
    });
  };

  const setCellError = (linkId: string, field: "parte" | "mp", error?: CotaParseError) => {
    setCellErrors((prev) => {
      const row = { ...prev[linkId] };
      if (error) row[field] = error; else delete row[field];
      return { ...prev, [linkId]: row };
    });
  };

  /**
   * ⚠️ **ALL THREE FIELDS GO IN EVERY PATCH, BECAUSE THE ROUTE REPLACES ALL
   * THREE.** They are one fact about one association — the share, the area the
   * deed stated for it, and how it is held — so sending only the edited one
   * would blank the other two. The route's header carries the argument.
   */
  const patchCota = async (
    item: AssociatedPerson,
    next: { cotaParte: number | null; cotaSuprafataMp: number | null; cotaMod: CotaMod | null },
  ) => {
    setSavingId(item.linkId);
    setSaveErr(null);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/persons/${encodeURIComponent(item.id)}`
          + `?linkId=${encodeURIComponent(item.linkId)}`,
        {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(next),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["document-persons", documentId] });
    } catch {
      // The message is ours rather than the server's: this fires beside a cell
      // the user is still looking at, and „HTTP 500" beside «Cotă-parte» is not
      // a sentence anybody can act on.
      setSaveErr(t("cotaSaveError"));
    } finally {
      setSavingId(null);
    }
  };

  /**
   * Commit one numeric cell. On a parse failure it KEEPS WHAT THE USER TYPED
   * and shows the reason in that cell's own error slot — it never writes a zero
   * and never silently reverts, because either would put a number in the
   * archive that nobody typed.
   */
  const commitNumeric = async (item: AssociatedPerson, field: "parte" | "mp") => {
    // Nothing typed, nothing to write (#37.64): the share panel focuses its first box
    // when it opens, so leaving a box untouched is now the ordinary case, and a PATCH
    // of the same three values on every pass through the panel would be a write
    // nobody made.
    if (drafts[item.linkId]?.[field] === undefined) return;
    const raw = draftOf(item, field);
    const parsed = field === "parte" ? parseCotaParte(raw) : parseCotaSuprafataMp(raw);
    if (!parsed.ok) {
      setCellError(item.linkId, field, parsed.error);
      return;
    }
    setCellError(item.linkId, field, undefined);

    const other = field === "parte"
      ? parseCotaSuprafataMp(draftOf(item, "mp"))
      : parseCotaParte(draftOf(item, "parte"));
    // If the sibling cell is currently unreadable, leave what is stored for it
    // alone rather than blanking it on the way past.
    const siblingValue = other.ok
      ? other.value
      : (field === "parte" ? item.cotaSuprafataMp : item.cotaParte);

    const next = field === "parte"
      ? { cotaParte: parsed.value, cotaSuprafataMp: siblingValue, cotaMod: item.cotaMod }
      : { cotaParte: siblingValue, cotaSuprafataMp: parsed.value, cotaMod: item.cotaMod };

    clearDraft(item.linkId, field);
    await patchCota(item, next);
  };

  const commitMod = async (item: AssociatedPerson, value: string) => {
    const cotaMod = (COTA_MOD_VALUES as readonly string[]).includes(value)
      ? (value as CotaMod)
      : null;
    const parte = parseCotaParte(draftOf(item, "parte"));
    const mp    = parseCotaSuprafataMp(draftOf(item, "mp"));
    await patchCota(item, {
      cotaParte:       parte.ok ? parte.value : item.cotaParte,
      cotaSuprafataMp: mp.ok    ? mp.value    : item.cotaSuprafataMp,
      cotaMod,
    });
  };

  /** Remove one row's link; „Corelate"'s „Dezasociază" shows what it throws. */
  const dissociate = async (target: AssociatedPerson) => {
    // ⚠️ `linkId` is REQUIRED by the route, and that is the fix: this used to
    // address the DELETE at the person, which removed every role they held on
    // this document rather than the one selected.
    const res = await fetch(
      `/api/documents/${encodeURIComponent(documentId)}/persons/${encodeURIComponent(target.id)}`
        + `?linkId=${encodeURIComponent(target.linkId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    await queryClient.invalidateQueries({ queryKey: ["document-persons", documentId] });
  };

  const inputClass = (invalid: boolean) =>
    [
      "rounded-md border bg-white px-2 py-1 text-sm shadow-sm focus:outline-none disabled:cursor-not-allowed disabled:bg-canvas disabled:text-fade",
      "dark:bg-zinc-950 dark:text-zinc-100",
      invalid
        ? "border-red-500 focus:border-red-600"
        : "border-wire focus:border-focus dark:border-zinc-700",
    ].join(" ");

  /** „1/2" — or the box's own „fără cotă" when there is nothing: the bubble reads like the boxes. */
  const shareSummary = (item: AssociatedPerson): string =>
    t("shareSummary", {
      parte: item.cotaParte === null ? t("cotaPlaceholder") : formatCotaParte(item.cotaParte),
      mp:    item.cotaSuprafataMp === null ? t("cotaMpPlaceholder") : formatCotaSuprafataMp(item.cotaSuprafataMp),
      mod:   item.cotaMod === null ? t("cotaModPlaceholder") : modLabel(t, item.cotaMod),
    });

  const rows: RelatedRow[] = (items ?? []).map((item) => {
    const errors   = cellErrors[item.linkId] ?? {};
    // Slice #37.59: the three share values only for a role that holds a share
    // (or no role); a stored value on a role that holds none shows read-only.
    // Slice #37.64: they live behind the row's orange „Cotă", never on the row.
    const cells  = shareCells(item);
    const locked = cells === "readonly";
    const open   = shareOpenId === item.linkId;
    // FU-224 (Slice #37.07): the role, else a certificate party's quality.
    const roleLabel = roleOrQualityLabel(item.roleName, item.quality, {
      DEFUNCT:    t("qualityDefunct"),
      MOSTENITOR: t("qualityMostenitor"),
    });
    // „Nume (Rol)" — a link with no role (and no quality) is the name alone.
    const hasRole = roleLabel !== "—";
    const text    = hasRole ? `${item.displayName} (${roleLabel})` : item.displayName;
    const panelId = `${panelIdBase}-${item.linkId}`;
    const parteCell = (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-fade dark:text-zinc-400" aria-hidden="true">{t("colCota")}</span>
          <input
            type="text"
            inputMode="decimal"
            value={draftOf(item, "parte")}
            placeholder={t("cotaPlaceholder")}
            data-blank=""
            disabled={locked || savingId === item.linkId}
            aria-label={`${t("colCota")} — ${item.displayName} — ${roleLabel}`}
            aria-invalid={errors.parte ? true : undefined}
            onChange={(e) => setDraft(item.linkId, "parte", e.target.value)}
            onBlur={() => void commitNumeric(item, "parte")}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void commitNumeric(item, "parte"); }
            }}
            className={inputClass(Boolean(errors.parte))}
            style={COTA_BOX_STYLE}
          />
          {errors.parte && (
            <span className="text-xs text-red-600 dark:text-red-400" role="alert">
              {cotaErrorLabel(t, errors.parte)}
            </span>
          )}
        </div>
    );
    const mpCell = (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-fade dark:text-zinc-400" aria-hidden="true">{t("colCotaMp")}</span>
          <input
            type="text"
            inputMode="decimal"
            value={draftOf(item, "mp")}
            placeholder={t("cotaMpPlaceholder")}
            data-blank=""
            disabled={locked || savingId === item.linkId}
            aria-label={`${t("colCotaMp")} — ${item.displayName} — ${roleLabel}`}
            aria-invalid={errors.mp ? true : undefined}
            onChange={(e) => setDraft(item.linkId, "mp", e.target.value)}
            onBlur={() => void commitNumeric(item, "mp")}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void commitNumeric(item, "mp"); }
            }}
            className={inputClass(Boolean(errors.mp))}
            style={COTA_BOX_STYLE}
          />
          {errors.mp && (
            <span className="text-xs text-red-600 dark:text-red-400" role="alert">
              {cotaErrorLabel(t, errors.mp)}
            </span>
          )}
        </div>
    );
    const modCell = (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-fade dark:text-zinc-400" aria-hidden="true">{t("colCotaMod")}</span>
          <select
            value={item.cotaMod ?? ""}
            disabled={locked || savingId === item.linkId}
            aria-label={`${t("colCotaMod")} — ${item.displayName} — ${roleLabel}`}
            onChange={(e) => void commitMod(item, e.target.value)}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            style={COTA_BOX_STYLE}
          >
            <option value="" data-blank="">{t("cotaModPlaceholder")}</option>
            {COTA_MOD_VALUES.map((v) => (
              <option key={v} value={v}>{modLabel(t, v)}</option>
            ))}
          </select>
        </div>
    );
    const lockedHint = locked ? (
      <span className="text-xs text-fade dark:text-zinc-400" data-share-hint>{t("shareNotHeld")}</span>
    ) : null;
    /*
     * The orange „Cotă" (#37.64): solid while the three values are all empty —
     * something left to fill — and an outline once one is. Resting on it shows
     * the three values; pressing it opens them, beside the row, to edit.
     */
    const shareButton = cells !== "none" && (
      <div
        ref={open ? shareRef : undefined}
        data-share-open={open ? "" : undefined}
        className="relative"
      >
        <HintBubble id={`${panelId}-summary`} text={shareSummary(item)} disabled={open} align="end">
          <IconButton
            icon={PieChart}
            label={t("share")}
            showLabel
            variant={storesShare(item) ? "attention-outline" : "attention"}
            size="xs"
            data-share-button=""
            aria-describedby={`${panelId}-summary`}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => (open ? closeShare("button") : setShareOpenId(item.linkId))}
          />
        </HintBubble>
        {open && (
          <div
            id={panelId}
            role="group"
            aria-label={`${t("shareTitle")} — ${item.displayName} — ${roleLabel}`}
            data-share-panel=""
            className="absolute right-0 top-full z-30 mt-1 flex flex-col gap-2 whitespace-normal rounded-md border border-card-rim bg-white p-3 text-left shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
            style={SHARE_PANEL_STYLE}
          >
            {parteCell}
            {mpCell}
            {modCell}
            {lockedHint}
          </div>
        )}
      </div>
    );
    return {
      // ⚠️ The LINK, never the person: one person may hold two roles here (#36.02).
      key: `person:${item.linkId}`,
      kind: item.type === "JUDICIAL" ? "judicial" : "natural",
      // Slice #38.33: „Părți" groups its rows by role.
      group: item.roleName,
      data: { "data-share": cells },
      radioLabel: `${item.displayName} — ${roleLabel}`,
      title: text,
      content: (
        <>
          <span className="font-medium text-ink dark:text-zinc-100">{item.displayName}</span>
          {hasRole && <span className="text-fade dark:text-zinc-400"> ({roleLabel})</span>}
        </>
      ),
      href: `${personPath(item.type, item.id)}?readonly=true`,
      dissociate: () => dissociate(item),
      buttons: {
        share: shareButton || undefined,
        view: (
          <IconButton
            href={`${personPath(item.type, item.id)}?readonly=true`}
            onClick={(e) => openThroughGuard(e, `${personPath(item.type, item.id)}?readonly=true`, guardedNavigate)}
            icon={ArrowRight}
            label={t("view")}
            variant="secondary"
            size="xs"
          />
        ),
        preview: <PreviewButton target={personPreview(item.type, item.id)} />,
      },
    };
  });

  const below = (
    <>
      {/*
        ⚠️ **THE TOTAL WARNS AND DOES NOT BLOCK, AND NOTHING HERE MAY MAKE IT
        BLOCK.** A 2006 deed that states no shares, and a deed that really does
        come to 99,99% because the notary rounded, must both stay savable — the
        archive's job is to show what the paper says. A role in which no row
        carries a cotă is `silent` and renders nothing at all, because an empty
        box is the ordinary case rather than an omission to nag about.

        Always mounted with an `aria-live` region, the way
        `role-stranded-note.tsx` and `no-roles-for-type-note.tsx` are: a region
        that appears at the same moment as its content is not announced.
      */}
      <div aria-live="polite" className="flex flex-col gap-1">
        {totals.filter((r) => r.state !== "silent").map((r) => {
          const total = formatCotaParte(r.total);
          return (
            <p
              key={r.roleId ?? "__no_role__"}
              className={
                r.state === "off"
                  ? "text-sm text-amber-700 dark:text-amber-400"
                  : "text-sm text-fade dark:text-zinc-400"
              }
            >
              {r.state === "off"
                ? (r.roleName
                    ? t("cotaTotalOff", { roleName: r.roleName, total })
                    : t("cotaTotalOffNoRole", { total }))
                : (r.roleName
                    ? t("cotaTotal", { roleName: r.roleName, total })
                    : t("cotaTotalNoRole", { total }))}
            </p>
          );
        })}
      </div>

      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{t("error")}</p>
      )}
      {savingId !== null && (
        <p className="text-sm text-fade dark:text-zinc-400">{t("cotaSaving")}</p>
      )}
      {saveErr && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{saveErr}</p>
      )}
    </>
  );

  return {
    isLoading,
    rows,
    below,
    associate: () => router.push(`/documents/${encodeURIComponent(documentId)}/associate-person`),
  };
}
