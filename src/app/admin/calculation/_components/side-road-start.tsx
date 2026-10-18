"use client";

import { useCallback, useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { RotateCcw, Scissors, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { buttonClass } from "@/lib/ui/button-styles";
import { usePressAway } from "@/lib/ui/press-bubble";
import { screenBox, type ScreenField } from "@/lib/ui/field-widths";
import { ownerColor } from "@/lib/calculation/owner-colors";
import type { InputCorner, InputProblem } from "@/lib/calculation/side-road-input";
import { OwnerSwatch } from "./preview-map";

/**
 * „Calcul drum lateral", step 1 — the property, its owners, the road            (Slice #39.79)
 *
 * Replaces #38.23's data file. The property is found by search among the archive's (by code, nickname, cadastral
 * number or CF — Ask first 9; one with no corners is listed greyed out, saying so), and its corners are read at once,
 * so „exactly four" is checked before anything else is typed. The owners are persons already in the archive, natural
 * or juridical, each found by search and added with a share; each gets a badge in the colour its slice will have on
 * the map (owner-colors.ts, in entry order — Ask first 7). Then the road's width. Every check is
 * `checkSideRoadInput`'s, the one the server applies: what it refuses is listed here, and „Împarte proprietatea" stays
 * off until nothing is.
 *
 * 2026-10-18 (Adrian): the owner search finds a person by any of the words typed, in any order, with or without
 * diacritics — name, code, CNP, CUI or nickname (/api/calculation/persons) — and so does the property search; and
 * „Resetează", right of „Împarte proprietatea", empties the screen, which otherwise keeps what was typed while the
 * person looks up a code on another screen (calculation-view.tsx).
 */

export type StartOwner = { personId: string; name: string; code: string; type: "NATURAL" | "JUDICIAL"; share: string };
export type StartProperty = { id: string; code: string; nickname: string | null; corners: InputCorner[] | null };
export type StartState = { property: StartProperty | null; owners: StartOwner[]; width: string };

export const EMPTY_START: StartState = { property: null, owners: [], width: "" };

type PropertyHit = { id: string; code: string; nickname: string | null; cadastralNumber: string | null; carteFunciara: string | null; cornerCount: number };
type PersonHit = { id: string; code: string; type: "NATURAL" | "JUDICIAL"; displayName: string; isDeceased: boolean };

/** A search box over one of the archive's searches, and the list of what it finds; choosing a hit hands it back. */
function SearchBox<H extends { id: string }>({
  label,
  placeholder,
  width,
  queryKey,
  search,
  exclude = [],
  render,
  disabledReason,
  onPick,
  searching,
  noHits,
}: {
  label: string;
  placeholder: string;
  width: ScreenField;
  queryKey: string;
  search: (term: string) => Promise<H[]>;
  exclude?: readonly string[];
  render: (hit: H) => ReactNode;
  /** A hit that cannot be chosen says why, and is drawn greyed out. */
  disabledReason?: (hit: H) => string | null;
  onPick: (hit: H) => void;
  searching: string;
  noHits: string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const close = useCallback(() => setOpen(false), []);
  const ref = usePressAway<HTMLDivElement>(open, close);
  const term = text.trim();
  const hits = useQuery<H[]>({ queryKey: ["calculation-search", queryKey, term], enabled: open && term.length > 0, queryFn: () => search(term) });
  const shown = (hits.data ?? []).filter((h) => !exclude.includes(h.id));
  return (
    <div ref={ref} className="relative inline-flex" data-calc-search={queryKey}>
      <input
        type="search"
        role="combobox"
        aria-label={label}
        aria-expanded={open && term.length > 0}
        aria-controls={listId}
        placeholder={placeholder}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-ink placeholder:text-fade dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        {...screenBox(width)}
      />
      {open && term.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          {...screenBox(width)}
        >
          {hits.isPending && <li className="px-3 py-1.5 text-fade dark:text-zinc-400">{searching}</li>}
          {hits.data && shown.length === 0 && <li className="px-3 py-1.5 text-fade dark:text-zinc-400">{noHits}</li>}
          {shown.map((h) => {
            const reason = disabledReason?.(h) ?? null;
            return (
              <li key={h.id} role="option" aria-selected={false} aria-disabled={reason ? true : undefined}>
                <button
                  type="button"
                  disabled={reason !== null}
                  data-calc-hit={h.id}
                  onClick={() => {
                    onPick(h);
                    setText("");
                    setOpen(false);
                  }}
                  className={buttonClass({ variant: "bare", size: "sm", className: "w-full hover:bg-slate-50 dark:hover:bg-zinc-800" })}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{render(h)}</span>
                  {reason && <span className="shrink-0 text-xs text-fade dark:text-zinc-400">{reason}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

async function searchProperties(term: string): Promise<PropertyHit[]> {
  const res = await fetch(`/api/calculation/properties?${new URLSearchParams({ q: term, limit: "8" }).toString()}`);
  if (!res.ok || res.redirected) throw new Error(`properties ${res.status}`);
  return ((await res.json()) as { items: PropertyHit[] }).items;
}

async function searchPersons(term: string): Promise<PersonHit[]> {
  const res = await fetch(`/api/calculation/persons?${new URLSearchParams({ q: term, limit: "10" }).toString()}`);
  if (!res.ok || res.redirected) throw new Error(`people ${res.status}`);
  return ((await res.json()) as { items: PersonHit[] }).items;
}

async function loadProperty(id: string): Promise<StartProperty> {
  const res = await fetch(`/api/calculation/properties/${encodeURIComponent(id)}`);
  if (!res.ok || res.redirected) throw new Error(`property ${res.status}`);
  return ((await res.json()) as { property: StartProperty }).property;
}

export function SideRoadStart({
  state,
  onChange,
  problems,
  canDivide,
  dividing,
  onDivide,
  onReset,
  onPropertyChosen,
}: {
  state: StartState;
  onChange: (next: StartState) => void;
  /** `checkSideRoadInput`'s, already narrowed to what has been typed. */
  problems: InputProblem[];
  canDivide: boolean;
  dividing: boolean;
  onDivide: () => void;
  /** „Resetează": everything typed goes, here and in the copy the screen keeps between visits. */
  onReset: () => void;
  onPropertyChosen: (p: StartProperty) => void;
}) {
  const t = useTranslations("calculation.start");
  const tp = useTranslations("calculation.problems");
  const format = useFormatter();
  const [loadError, setLoadError] = useState<string | null>(null);

  const pickProperty = async (hit: PropertyHit) => {
    setLoadError(null);
    try {
      const p = await loadProperty(hit.id);
      onChange({ ...state, property: p });
      onPropertyChosen(p);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  const problemText = (p: InputProblem): string => {
    const pct = (n: number) => format.number(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    switch (p.code) {
      case "noCorners":
      case "cornersCross":
        return tp(p.code);
      case "cornerCount":
      case "ownerCount":
        return tp(p.code, { count: p.values.count });
      case "repeatedOwner":
        return tp("repeatedOwner", { name: p.values.name });
      case "shareFormat":
        return tp("shareFormat", { name: p.values.name, share: p.values.share });
      case "percentTotal":
        return tp("percentTotal", { total: pct(p.values.total) });
      case "widthFormat":
        return tp("widthFormat", { width: p.values.width });
      case "roadWidth":
        return tp("roadWidth", { width: format.number(p.values.width, { maximumFractionDigits: 2 }) });
    }
  };

  const setOwner = (i: number, patch: Partial<StartOwner>) =>
    onChange({ ...state, owners: state.owners.map((o, k) => (k === i ? { ...o, ...patch } : o)) });

  return (
    <div className="flex flex-col gap-4" data-calc-start="">
      <p className="text-sm text-fade dark:text-zinc-400">{t("lead")}</p>

      {/* The property */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">{t("propertyTitle")}</h3>
        <SearchBox<PropertyHit>
          label={t("propertySearch")}
          placeholder={t("propertyPlaceholder")}
          width="calcPropertySearch"
          queryKey="properties"
          search={searchProperties}
          searching={t("searching")}
          noHits={t("noHits")}
          disabledReason={(h) => (h.cornerCount === 0 ? t("noCornersHit") : null)}
          render={(h) => [h.code, h.nickname, h.cadastralNumber && t("cadastral", { n: h.cadastralNumber }), h.carteFunciara && t("cf", { n: h.carteFunciara })].filter(Boolean).join(" · ")}
          onPick={(h) => void pickProperty(h)}
        />
        {loadError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{loadError}</p>}
        {state.property && (
          <p className="text-sm text-ink dark:text-zinc-200" data-calc-property={state.property.code}>
            {t("propertyChosen", { code: state.property.code, name: state.property.nickname ?? "", corners: state.property.corners?.length ?? 0 })}
          </p>
        )}
      </div>

      {/* The owners */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">{t("ownersTitle")}</h3>
        <SearchBox<PersonHit>
          label={t("ownerSearch")}
          placeholder={t("ownerPlaceholder")}
          width="calcOwnerSearch"
          queryKey="persons"
          search={searchPersons}
          searching={t("searching")}
          noHits={t("noHits")}
          exclude={state.owners.map((o) => o.personId)}
          render={(h) => `${h.displayName}${h.isDeceased ? " †" : ""} · ${h.code} · ${t(h.type === "NATURAL" ? "natural" : "juridical")}`}
          onPick={(h) => onChange({ ...state, owners: [...state.owners, { personId: h.id, name: h.displayName, code: h.code, type: h.type, share: "" }] })}
        />
        {state.owners.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-calc-owners="">
            {state.owners.map((o, i) => (
              <li key={o.personId} className="flex flex-wrap items-center gap-2 text-sm" data-calc-owner={o.code}>
                <span
                  data-owner-badge={ownerColor(i)}
                  className="inline-flex items-center rounded-full border border-black/10 bg-white px-2 py-0.5 text-ink dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <OwnerSwatch color={ownerColor(i)} />
                  <span>{o.name}</span>
                </span>
                <span className="text-xs text-fade dark:text-zinc-400">{o.code}</span>
                <label className="flex items-center gap-1 text-xs text-fade dark:text-zinc-400">
                  {t("share")}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={o.share}
                    onChange={(e) => setOwner(i, { share: e.target.value })}
                    aria-label={t("shareOf", { name: o.name })}
                    className="rounded-md border border-wire bg-white px-2 py-1 text-right text-sm tabular-nums text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    {...screenBox("calcShare")}
                  />
                  %
                </label>
                <IconButton
                  icon={X}
                  label={t("removeOwner", { name: o.name })}
                  variant="bare"
                  size="xs"
                  onClick={() => onChange({ ...state, owners: state.owners.filter((_, k) => k !== i) })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The road */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">{t("roadTitle")}</h3>
        <label className="flex items-center gap-2 text-sm text-ink dark:text-zinc-200">
          {t("width")}
          <input
            type="text"
            inputMode="decimal"
            value={state.width}
            onChange={(e) => onChange({ ...state, width: e.target.value })}
            aria-label={t("width")}
            className="rounded-md border border-wire bg-white px-2 py-1 text-right text-sm tabular-nums text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            {...screenBox("calcRoadWidth")}
          />
          m
        </label>
      </div>

      {problems.length > 0 && (
        <div role="alert" data-panel="input-problems" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <p className="font-medium">{tp("title")}</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p, i) => (
              <li key={i}>{problemText(p)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          icon={Scissors}
          label={dividing ? t("dividing") : t("divide")}
          busy={dividing}
          showLabel
          variant="primary"
          size="md"
          disabled={!canDivide || dividing}
          onClick={onDivide}
          data-calc-divide=""
        />
        <IconButton
          icon={RotateCcw}
          label={t("reset")}
          showLabel
          variant="secondary"
          size="md"
          disabled={dividing}
          onClick={onReset}
          data-calc-reset=""
        />
      </div>
    </div>
  );
}
