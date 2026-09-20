"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/lib/ui/button-styles";
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
  cotaParte:       number | null;
  cotaSuprafataMp: number | null;
  cotaMod:         CotaMod | null;
  associatedAt:    string;
};

type Props = { documentId: string };

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

export function DocumentPersonsTab({ documentId }: Props) {
  const t           = useTranslations("document.persons");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dissociating,  setDissociating]  = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  const [drafts,     setDrafts]     = useState<Record<string, Draft>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, CellErrors>>({});
  const [savingId,   setSavingId]   = useState<string | null>(null);
  const [saveErr,    setSaveErr]    = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["document-persons", documentId],
    queryFn:  () => fetchDocumentPersons(documentId),
  });

  /**
   * The per-role totals, recomputed from whatever is currently SAVED — not from
   * the drafts. A total that moved while the user was still typing „63," would
   * be reporting a number nobody has committed.
   */
  const totals = useMemo(
    () => cotaTotalsByRole(
      (items ?? []).map((i) => ({
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

  const handleAssociate = () => {
    router.push(`/documents/${encodeURIComponent(documentId)}/associate-person`);
  };

  const handleDissociate = async () => {
    if (!selectedId) return;
    const target = items?.find((i) => i.linkId === selectedId);
    if (!target) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
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
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["document-persons", documentId] });
    } catch (err) {
      setDissociateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setDissociating(false);
    }
  };

  if (isLoading) return <p className="py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  if (isError)   return <p className="py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>;

  const inputClass = (invalid: boolean) =>
    [
      "w-24 rounded-md border bg-white px-2 py-1 text-sm shadow-sm focus:outline-none",
      "dark:bg-zinc-950 dark:text-zinc-100",
      invalid
        ? "border-red-500 focus:border-red-600"
        : "border-wire focus:border-focus dark:border-zinc-700",
    ].join(" ");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {items && items.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="w-8 px-3 py-2" aria-label="select" />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colName")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colRole")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colCota")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colCotaMp")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colCotaMod")}</th>
                <th className="w-16 px-3 py-2" aria-label="view" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const errors   = cellErrors[item.linkId] ?? {};
                const selected = item.linkId === selectedId;
                const roleLabel = item.roleName ?? "—";
                return (
                  <tr
                    key={item.linkId}
                    onClick={() => setSelectedId(selected ? null : item.linkId)}
                    onDoubleClick={() => {
                      const base = item.type === "NATURAL" ? "/natural-persons" : "/judicial-persons";
                      router.push(`${base}/${encodeURIComponent(item.id)}?readonly=true`);
                    }}
                    className={[
                      "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                      selected
                        ? "bg-cta-pale dark:bg-cta/10"
                        : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                    ].join(" ")}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="radio"
                        checked={selected}
                        onChange={() => setSelectedId(item.linkId)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-cta"
                        aria-label={`${item.displayName} — ${roleLabel}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-ink dark:text-zinc-100">{item.displayName}</td>
                    <td className="px-3 py-2 text-fade dark:text-zinc-400">{roleLabel}</td>

                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draftOf(item, "parte")}
                          placeholder={t("cotaPlaceholder")}
                          disabled={savingId === item.linkId}
                          aria-label={`${t("colCota")} — ${item.displayName} — ${roleLabel}`}
                          aria-invalid={errors.parte ? true : undefined}
                          onChange={(e) => setDraft(item.linkId, "parte", e.target.value)}
                          onBlur={() => void commitNumeric(item, "parte")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); void commitNumeric(item, "parte"); }
                            if (e.key === "Escape") {
                              clearDraft(item.linkId, "parte");
                              setCellError(item.linkId, "parte", undefined);
                            }
                          }}
                          className={inputClass(Boolean(errors.parte))}
                        />
                        {errors.parte && (
                          <span className="text-xs text-red-600 dark:text-red-400" role="alert">
                            {cotaErrorLabel(t, errors.parte)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draftOf(item, "mp")}
                          placeholder={t("cotaMpPlaceholder")}
                          disabled={savingId === item.linkId}
                          aria-label={`${t("colCotaMp")} — ${item.displayName} — ${roleLabel}`}
                          aria-invalid={errors.mp ? true : undefined}
                          onChange={(e) => setDraft(item.linkId, "mp", e.target.value)}
                          onBlur={() => void commitNumeric(item, "mp")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); void commitNumeric(item, "mp"); }
                            if (e.key === "Escape") {
                              clearDraft(item.linkId, "mp");
                              setCellError(item.linkId, "mp", undefined);
                            }
                          }}
                          className={inputClass(Boolean(errors.mp))}
                        />
                        {errors.mp && (
                          <span className="text-xs text-red-600 dark:text-red-400" role="alert">
                            {cotaErrorLabel(t, errors.mp)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={item.cotaMod ?? ""}
                        disabled={savingId === item.linkId}
                        aria-label={`${t("colCotaMod")} — ${item.displayName} — ${roleLabel}`}
                        onChange={(e) => void commitMod(item, e.target.value)}
                        className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      >
                        <option value="">{t("cotaModPlaceholder")}</option>
                        {COTA_MOD_VALUES.map((v) => (
                          <option key={v} value={v}>{modLabel(t, v)}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const base = item.type === "NATURAL" ? "/natural-persons" : "/judicial-persons";
                          router.push(`${base}/${encodeURIComponent(item.id)}?readonly=true`);
                        }}
                        className={buttonClass({ variant: "secondary", size: "xs" })}
                      >
                        {t("view")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("empty")}</p>
        )}
      </div>

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

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAssociate}
            disabled={selectedId !== null}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("associate")}
          </button>
          <button
            type="button"
            onClick={handleDissociate}
            disabled={selectedId === null || dissociating}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {dissociating ? t("dissociating") : t("dissociate")}
          </button>
        </div>
        {savingId !== null && (
          <p className="text-sm text-fade dark:text-zinc-400">{t("cotaSaving")}</p>
        )}
        {saveErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{saveErr}</p>
        )}
        {dissociateErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{dissociateErr}</p>
        )}
      </div>
    </div>
  );
}
