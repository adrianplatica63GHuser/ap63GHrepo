"use client";

import { useCallback, useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { buttonClass } from "@/lib/ui/button-styles";
import { usePressAway } from "@/lib/ui/press-bubble";
import { screenBox } from "@/lib/ui/field-widths";
import {
  DIRECTION_CHOICES,
  DOCUMENTS_CHOICES,
  RANGE_PRESETS,
  toggled,
  type InteractionFilters,
} from "@/lib/interactions/filters";
import { INTERACTION_CHANNELS, INTERACTION_STATUSES, SUBJECT_MAX } from "@/lib/interactions/model";
import { CHANNEL_INK, CHANNEL_PILL } from "@/lib/interactions/palette";
import { CHANNEL_ICON, StatusPill } from "./interaction-pills";

/**
 * The history's filter controls.   (Slice #38.84)
 *
 * Each takes the ONE filter state and hands back a new one (`src/lib/interactions/filters.ts`); the toolbar and the
 * column headers draw the same controls over the same state, so they cannot disagree (§3). None of them is a filter
 * on the description or the internal note — there is no such control (§8.2).
 */
export type FiltersChange = (next: InteractionFilters) => void;

/** A panel that opens under its trigger and closes on a press outside or Esc. */
export function Pop({
  trigger,
  children,
  align = "left",
  label,
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = usePressAway<HTMLDivElement>(open, close);
  return (
    <div ref={ref} className="relative inline-flex">
      {trigger(open, () => setOpen((v) => !v))}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-30 mt-1 w-max rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal text-ink shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${align === "right" ? "right-0" : "left-0"}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** A choice in a radio group, drawn as a line. */
function RadioLine({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-[#3b5bdb]" />
      {children}
    </label>
  );
}

/** The date range (§3): the presets, and „Personalizat" with its two days. */
export function RangeChoices({ filters, onChange }: { filters: InteractionFilters; onChange: FiltersChange }) {
  const t = useTranslations("interactions.toolbar");
  const name = useId();
  return (
    <div className="flex flex-col" data-range-choices="">
      <span className="mb-1 text-xs font-medium text-fade dark:text-zinc-400">{t("range")}</span>
      {RANGE_PRESETS.map((p) => (
        <RadioLine key={p} name={name} checked={filters.preset === p} onChange={() => onChange({ ...filters, preset: p })}>
          {t(`preset.${p}`)}
        </RadioLine>
      ))}
      {filters.preset === "custom" && (
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-fade dark:text-zinc-400">
            {t("from")}
            <input
              type="date"
              value={filters.customFrom}
              onChange={(e) => onChange({ ...filters, customFrom: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm text-ink dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              {...screenBox("interactionDay")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fade dark:text-zinc-400">
            {t("to")}
            <input
              type="date"
              value={filters.customTo}
              onChange={(e) => onChange({ ...filters, customTo: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm text-ink dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              {...screenBox("interactionDay")}
            />
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * The channel chips (§3): multi-select, each with its icon and its colour; ticked is filled, not ticked an outline;
 * pressed again it clears. A chip is a checkbox under its label, so a keyboard ticks it with Space.
 */
export function ChannelChips({ filters, onChange }: { filters: InteractionFilters; onChange: FiltersChange }) {
  const t = useTranslations("interactions");
  return (
    <div role="group" aria-label={t("toolbar.channels")} className="flex flex-wrap gap-1.5" data-channel-chips="">
      {INTERACTION_CHANNELS.map((c) => {
        const Icon = CHANNEL_ICON[c];
        const on = filters.channels.includes(c);
        return (
          <label
            key={c}
            data-channel-chip={c}
            data-on={on ? "" : undefined}
            className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
              on
                ? CHANNEL_PILL[c]
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={on}
              onChange={() => onChange({ ...filters, channels: toggled(filters.channels, c) })}
            />
            <Icon aria-hidden="true" size={16} className={on ? undefined : CHANNEL_INK[c]} />
            {t(`channel.${c}`)}
          </label>
        );
      })}
    </div>
  );
}

/** Direction (§3): Toate, Primite, Trimise — a segmented control; „Toate" is the default. */
export function DirectionSegments({ filters, onChange }: { filters: InteractionFilters; onChange: FiltersChange }) {
  const t = useTranslations("interactions.toolbar");
  const name = useId();
  const word = { ALL: t("directionAll"), INBOUND: t("directionIn"), OUTBOUND: t("directionOut") } as const;
  return (
    <div
      role="radiogroup"
      aria-label={t("direction")}
      data-direction-segments=""
      className="inline-flex overflow-hidden rounded-md border border-slate-300 dark:border-zinc-600"
    >
      {DIRECTION_CHOICES.map((d, i) => {
        const on = filters.direction === d;
        return (
          <label
            key={d}
            className={`cursor-pointer select-none px-3 py-1 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus ${
              i > 0 ? "border-l border-slate-300 dark:border-zinc-600" : ""
            } ${on ? "bg-slate-100 font-medium text-ink dark:bg-zinc-700 dark:text-zinc-100" : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
          >
            <input type="radio" name={name} className="sr-only" checked={on} onChange={() => onChange({ ...filters, direction: d })} />
            {word[d]}
          </label>
        );
      })}
    </div>
  );
}

/** Status (§3): multi-select, the pills themselves beside their ticks. */
export function StatusChoices({ filters, onChange }: { filters: InteractionFilters; onChange: FiltersChange }) {
  return (
    <div className="flex flex-col" data-status-choices="">
      {INTERACTION_STATUSES.map((s) => (
        <label key={s} className="flex cursor-pointer items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={filters.statuses.includes(s)}
            onChange={() => onChange({ ...filters, statuses: toggled(filters.statuses, s) })}
            className="accent-[#3b5bdb]"
          />
          <StatusPill status={s} />
        </label>
      ))}
    </div>
  );
}

/** Channel as a column filter: the same choice as the chips, as a list. */
export function ChannelChoices({ filters, onChange }: { filters: InteractionFilters; onChange: FiltersChange }) {
  const t = useTranslations("interactions.channel");
  return (
    <div className="flex flex-col">
      {INTERACTION_CHANNELS.map((c) => {
        const Icon = CHANNEL_ICON[c];
        return (
          <label key={c} className="flex cursor-pointer items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={filters.channels.includes(c)}
              onChange={() => onChange({ ...filters, channels: toggled(filters.channels, c) })}
              className="accent-[#3b5bdb]"
            />
            <Icon aria-hidden="true" size={14} className={CHANNEL_INK[c]} />
            {t(c)}
          </label>
        );
      })}
    </div>
  );
}

/** Direction as a column filter. */
export function DirectionChoices({ filters, onChange }: { filters: InteractionFilters; onChange: FiltersChange }) {
  const t = useTranslations("interactions.toolbar");
  const name = useId();
  const word = { ALL: t("directionAll"), INBOUND: t("directionIn"), OUTBOUND: t("directionOut") } as const;
  return (
    <div className="flex flex-col">
      {DIRECTION_CHOICES.map((d) => (
        <RadioLine key={d} name={name} checked={filters.direction === d} onChange={() => onChange({ ...filters, direction: d })}>
          {word[d]}
        </RadioLine>
      ))}
    </div>
  );
}

/** „Acte" as a column filter (§3): has documents / has none. */
export function DocumentsChoices({ filters, onChange }: { filters: InteractionFilters; onChange: FiltersChange }) {
  const t = useTranslations("interactions.documents");
  const name = useId();
  const word = { ALL: t("all"), WITH: t("with"), WITHOUT: t("without") } as const;
  return (
    <div className="flex flex-col">
      {DOCUMENTS_CHOICES.map((d) => (
        <RadioLine key={d} name={name} checked={filters.documents === d} onChange={() => onChange({ ...filters, documents: d })}>
          {word[d]}
        </RadioLine>
      ))}
    </div>
  );
}

/** „Subiect" as a column filter (§3): contains, on this short field only. */
export function SubjectContains({ filters, onChange }: { filters: InteractionFilters; onChange: FiltersChange }) {
  const t = useTranslations("interactions");
  return (
    <label className="flex flex-col gap-1 text-xs text-fade dark:text-zinc-400">
      {t("subjectContains")}
      <input
        type="search"
        value={filters.subject}
        maxLength={SUBJECT_MAX}
        onChange={(e) => onChange({ ...filters, subject: e.target.value })}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm text-ink dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        {...screenBox("interactionSubject")}
      />
    </label>
  );
}

type PersonHit = { id: string; displayName: string | null; type: "NATURAL" | "JUDICIAL" };

/**
 * The person (§3): a typeahead over the client directory, matching on the name; choosing one is the scope, clearing
 * it shows every client. It never makes a person — it only finds one. The log form (38.85) draws the same box with
 * its own words, its id and its error.
 */
export function PersonPicker({
  personId,
  personName,
  onPick,
  inputId,
  label,
  placeholder,
  clearLabel,
  invalid = false,
  describedBy,
}: {
  personId: string | null;
  personName: string | null;
  onPick: (id: string | null, name: string | null) => void;
  inputId?: string;
  label?: string;
  placeholder?: string;
  clearLabel?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("interactions.toolbar");
  const tu = useTranslations("shared.unnamed");
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const listId = useId();
  const close = useCallback(() => setEditing(false), []);
  const ref = usePressAway<HTMLDivElement>(editing, close);
  const term = text.trim();
  const hits = useQuery<PersonHit[]>({
    queryKey: ["interactions-person-search", term],
    enabled: editing && term.length > 0,
    queryFn: async () => {
      const res = await fetch(`/api/people/search?${new URLSearchParams({ name: term, limit: "8" }).toString()}`);
      if (!res.ok || res.redirected) throw new Error(`people search ${res.status}`);
      return ((await res.json()) as { items: PersonHit[] }).items;
    },
  });
  const shown = editing ? text : (personName ?? "");
  return (
    <div ref={ref} className="relative inline-flex items-center gap-1" data-person-picker="">
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={editing && term.length > 0}
        aria-controls={listId}
        aria-label={label ?? t("person")}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder ?? t("personSearch")}
        value={shown}
        onFocus={() => {
          setText("");
          setEditing(true);
        }}
        onChange={(e) => {
          setText(e.target.value);
          setEditing(true);
        }}
        className={`rounded-md border bg-white px-3 py-1.5 text-sm text-ink placeholder:text-fade dark:bg-zinc-900 dark:text-zinc-100 ${
          invalid ? "border-red-700 outline outline-1 outline-red-700 dark:border-red-400 dark:outline-red-400" : "border-slate-300 dark:border-zinc-600"
        }`}
        {...screenBox("interactionPerson")}
      />
      {personId && !editing && (
        <IconButton icon={X} label={clearLabel ?? t("personClear")} variant="ghost" size="xs" onClick={() => onPick(null, null)} />
      )}
      {editing && term.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          {...screenBox("interactionPerson")}
        >
          {hits.isPending && <li className="px-3 py-1.5 text-fade dark:text-zinc-400">{t("personSearching")}</li>}
          {hits.data?.length === 0 && <li className="px-3 py-1.5 text-fade dark:text-zinc-400">{t("personNone")}</li>}
          {hits.data?.map((p) => (
            <li key={p.id} role="option" aria-selected={p.id === personId}>
              <button
                type="button"
                onClick={() => {
                  onPick(p.id, p.displayName && p.displayName.trim() ? p.displayName : tu("person"));
                  setEditing(false);
                }}
                className={buttonClass({ variant: "bare", size: "sm", className: "w-full hover:bg-slate-50 dark:hover:bg-zinc-800" })}
              >
                <span className="min-w-0 flex-1 truncate text-left">{p.displayName && p.displayName.trim() ? p.displayName : tu("person")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
