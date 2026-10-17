"use client";

/**
 * „Completează din ANAF" — the lookup, and the list of what it would change.                          (Slice #39.64)
 *
 * Two screens use it: the juridical person's form (`AnafFillDialog`) and the import's parties step, for a company it
 * is about to create (`AnafChanges` inside its own dialog). Both show the same rows — field, what the record holds,
 * what ANAF says, and a tick — under the same rule (`src/lib/anaf/fill.ts`): empty fields are filled, a value that
 * differs is taken only when ticked. Nothing here saves.
 */
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import type { AnafCompany } from "@/lib/anaf/company";
import {
  anafRows,
  anafTarget,
  appendNoteLine,
  applyAnafRows,
  defaultTaken,
  inactiveNoteLine,
  type AnafField,
  type AnafRow,
  type AnafTarget,
} from "@/lib/anaf/fill";

export type AnafLookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; company: AnafCompany; proposedType: { id: string; name: string } | null }
  | { status: "notFound" }
  | { status: "down" }
  | { status: "badCui" };

/** GET /api/judicial-persons/anaf for one CUI, read into a lookup state. Never throws. */
export async function fetchAnaf(cui: string): Promise<AnafLookup> {
  try {
    const res = await fetch(`/api/judicial-persons/anaf?cui=${encodeURIComponent(cui.trim())}`, { cache: "no-store" });
    if (res.redirected) return { status: "down" };
    const body = (await res.json().catch(() => null)) as
      | { kind?: string; code?: string; company?: AnafCompany; proposedType?: { id: string; name: string } | null }
      | null;
    if (res.status === 400 && body?.code === "badCui") return { status: "badCui" };
    if (!res.ok || !body) return { status: "down" };
    if (body.kind === "notFound") return { status: "notFound" };
    if (body.kind === "found" && body.company) return { status: "found", company: body.company, proposedType: body.proposedType ?? null };
    return { status: "down" };
  } catch {
    return { status: "down" };
  }
}

/** Today in the user's day, yyyy-MM-dd. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The sentence for a lookup that found nothing to show, or null. */
export function AnafStatus({ lookup, cui }: { lookup: AnafLookup; cui: string }) {
  const t = useTranslations("judicialPerson.anaf");
  if (lookup.status === "loading") return <p className="text-sm text-fade" role="status">{t("loading")}</p>;
  const text =
    lookup.status === "notFound" ? t("notFound", { cui })
    : lookup.status === "down" ? t("down")
    : lookup.status === "badCui" ? t("badCui")
    : null;
  if (!text) return null;
  return (
    <p role="alert" data-anaf-status={lookup.status} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
      {text}
    </p>
  );
}

/** The warnings for an inactive or struck-off company, and what goes into „Note". */
export function AnafWarnings({ company, noteLine, noteFits }: { company: AnafCompany; noteLine: string | null; noteFits: boolean }) {
  const t = useTranslations("judicialPerson.anaf");
  const dmy = (iso: string) => iso.split("-").reverse().join(".");
  if (company.inactiveSince === null && company.deregisteredOn === null) return null;
  return (
    <div role="alert" data-anaf-inactive="" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
      {company.deregisteredOn !== null && <p>{t("deregistered", { date: dmy(company.deregisteredOn) })}</p>}
      {company.inactiveSince !== null && (
        <p>
          {company.inactiveSince ? t("inactiveSince", { date: dmy(company.inactiveSince) }) : t("inactive")}{" "}
          {noteLine && (noteFits ? t("inactiveNote", { line: noteLine }) : t("inactiveNoRoom"))}
        </p>
      )}
    </div>
  );
}

/** The rows: field, now, ANAF, a tick. `typeName` turns the „Tip" id into its name. */
export function AnafChanges({
  rows,
  taken,
  onToggle,
  typeName,
  disabled,
}: {
  rows: readonly AnafRow[];
  taken: ReadonlySet<AnafField>;
  onToggle: (field: AnafField) => void;
  typeName: (id: string) => string;
  disabled?: boolean;
}) {
  const t = useTranslations("judicialPerson.anaf");
  const tf = useTranslations("judicialPerson.fields");
  const ta = useTranslations("address");
  const label = (f: AnafField): string =>
    f === "name" ? tf("name")
    : f === "tradeRegisterNumber" ? tf("tradeRegisterNumber")
    : f === "phone" ? tf("phone")
    : f === "judicialPersonTypeId" ? tf("judicialType")
    : t("addressField", { field: ta(f) });
  const shown = (f: AnafField, v: string) => (v ? (f === "judicialPersonTypeId" ? typeName(v) : v) : t("empty"));
  if (rows.length === 0) return <p className="text-sm text-fade" data-anaf-nothing="">{t("nothing")}</p>;
  return (
    <table className="w-full text-left text-sm" data-anaf-changes="">
      <thead>
        <tr className="text-xs text-fade">
          <th className="py-1 pr-2 font-medium">{t("colField")}</th>
          <th className="py-1 pr-2 font-medium">{t("colNow")}</th>
          <th className="py-1 pr-2 font-medium">{t("colAnaf")}</th>
          <th className="py-1 font-medium">{t("colTake")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.field} data-anaf-row={r.field} data-anaf-kind={r.kind} className="border-t border-wire align-top dark:border-zinc-700">
            <td className="py-1.5 pr-2 text-fade">{label(r.field)}</td>
            {/* Struck through only when ticked: what is crossed out is what will go. */}
            <td className={`py-1.5 pr-2 ${!r.current ? "italic text-fade" : taken.has(r.field) ? "text-ink line-through decoration-red-400/70 dark:text-zinc-200" : "text-ink dark:text-zinc-200"}`}>
              {shown(r.field, r.current)}
            </td>
            <td className="py-1.5 pr-2 font-medium text-ink dark:text-zinc-100">{shown(r.field, r.proposed)}</td>
            <td className="py-1.5">
              <input
                type="checkbox"
                checked={taken.has(r.field)}
                disabled={disabled}
                onChange={() => onToggle(r.field)}
                aria-label={t("takeOne", { field: label(r.field) })}
                className="h-4 w-4"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The rows, the ticks and the note line for one found company — the state both screens keep. */
export function useAnafChoice(current: AnafTarget, notes: string, found: Extract<AnafLookup, { status: "found" }> | null) {
  const rows = found ? anafRows(current, anafTarget(found.company, found.proposedType?.id ?? null)) : [];
  const [taken, setTaken] = useState<Set<AnafField>>(() => defaultTaken(rows));
  const noteLine = found ? inactiveNoteLine(found.company, todayIso()) : null;
  const nextNotes = noteLine ? appendNoteLine(notes, noteLine) : null;
  return {
    rows,
    taken,
    toggle: (f: AnafField) =>
      setTaken((s) => {
        const n = new Set(s);
        if (n.has(f)) n.delete(f);
        else n.add(f);
        return n;
      }),
    noteLine,
    noteFits: nextNotes !== null,
    /** The values with the ticked rows taken, and the notes with the line added (unchanged when it does not fit). */
    result: (): { values: AnafTarget; notes: string } => ({ values: applyAnafRows(current, rows, taken), notes: nextNotes ?? notes }),
  };
}

/**
 * The form's dialog: shows the lookup's state, then the rows, and on „Preia bifele" hands back the values to put on
 * the form. `current` and `notes` are the form's when the dialog opened.
 */
export function AnafFillDialog({
  cui,
  lookup,
  current,
  notes,
  typeName,
  onApply,
  onClose,
}: {
  cui: string;
  lookup: AnafLookup;
  current: AnafTarget;
  notes: string;
  typeName: (id: string) => string;
  onApply: (values: AnafTarget, notes: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("judicialPerson.anaf");
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="anaf-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-anaf-dialog="">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <h3 id="anaf-title" className="text-base font-semibold text-ink dark:text-zinc-100">{t("title", { cui })}</h3>
        {lookup.status === "found" ? (
          // Mounted once the answer is in, so the ticks start from it (every empty field ticked).
          <AnafFound found={lookup} current={current} notes={notes} typeName={typeName} onApply={onApply} onClose={onClose} />
        ) : (
          <>
            <AnafStatus lookup={lookup} cui={cui} />
            <div className="mt-2 flex justify-end gap-2">
              <IconButton icon={X} label={t("cancel")} variant="secondary" size="lg" onClick={onClose} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AnafFound({
  found,
  current,
  notes,
  typeName,
  onApply,
  onClose,
}: {
  found: Extract<AnafLookup, { status: "found" }>;
  current: AnafTarget;
  notes: string;
  typeName: (id: string) => string;
  onApply: (values: AnafTarget, notes: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("judicialPerson.anaf");
  const choice = useAnafChoice(current, notes, found);
  const canApply = choice.taken.size > 0 || (choice.noteLine !== null && choice.noteFits);
  return (
    <>
      <AnafWarnings company={found.company} noteLine={choice.noteLine} noteFits={choice.noteFits} />
      <p className="text-sm text-fade">{t("rule")}</p>
      <AnafChanges rows={choice.rows} taken={choice.taken} onToggle={choice.toggle} typeName={typeName} />
      <p className="text-xs text-fade">{t("source", { date: todayIso().split("-").reverse().join(".") })}</p>
      <div className="mt-2 flex justify-end gap-2">
        <IconButton icon={X} label={t("cancel")} variant="secondary" size="lg" onClick={onClose} />
        <IconButton
          icon={Check}
          label={t("apply")}
          showLabel
          variant="primary"
          size="lg"
          disabled={!canApply}
          onClick={() => {
            const r = choice.result();
            onApply(r.values, r.notes);
          }}
        />
      </div>
    </>
  );
}
