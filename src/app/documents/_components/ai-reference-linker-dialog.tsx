"use client";

/**
 * AiReferenceLinkerDialog — Slice #36.03
 *
 * A one-at-a-time stepper over the instruments a deed CITES, and the deliberate
 * sibling of `AiPartyLinkerDialog`. That component walks `parties[]` and asks
 * „match or create"; this one walks `referencedInstruments[]` and asks „leagă,
 * creează schiță, or lasă". Three actions rather than two, because a cited
 * instrument has a third honest answer that a party does not: **most of them
 * are not in the archive and never will be**, and „lasă" is the right answer
 * for those.
 *
 * ⚠️ **„LASĂ" IS NOT AN ERROR AND IS NOT A NAG.** A reference nobody could
 * place stays in „Note extinse" exactly as it does today, which is the correct
 * home for something nobody could place. Nothing here shows it in red, the
 * running count treats it as answered, and the tab does not re-offer it.
 *
 * ⚠️ **IT REOPENS, AND THAT IS WHY THE REFERENCES ARE STORED.** A deed imported
 * today and linked next month must work. The array lives on
 * `document.referenced_instruments`, so opening this dialog costs a GET and not
 * a billed vision call over every page — which is what re-reading the scans
 * would cost, every time.
 *
 * ⚠️ **AND NOTHING IS AUTO-LINKED AT ANY SCORE.** The candidate list is
 * ordered, and the top entry is styled no differently from the third. There is
 * no „accept all", no threshold and no default selection: every
 * `document_document` row this slice produces was clicked on by a person. The
 * ranking can afford to be generous precisely because of that — a suggestion
 * that is wrong costs a glance, where an auto-link that is wrong corrupts a
 * chain of title and nobody notices for a year.
 *
 * ⚠️ **THE MATCH REASON IS A SENTENCE, NEVER A PERCENTAGE.** „nr. 3264 și data
 * 23.11.2007 se potrivesc; notarul nu e completat pe documentul din arhivă" is
 * something Ciprian can act on. „87% încredere" is not — it invites „what would
 * 88% have meant?", which has no answer, and it invites a threshold, which this
 * slice refuses to have. `rankInstrumentCandidates` returns the SIGNALS
 * (`matched` / `missing`) and this component turns them into the sentence, so
 * the Romanian lives in `messages/ro-RO.json` and the rule lives in the module.
 *
 * ⚠️ **„NOT COMPARABLE" IS NOT „DISAGREES", AND THE TWO CLAUSES SAY SO.**
 * `matched` is what agrees; `missing` is what could not be compared because one
 * side is blank — overwhelmingly the archive's own null `institution_id`. A
 * signal that genuinely disagrees appears in neither list, because the ranker
 * treats a disagreement on the number or the date as fatal and does not offer
 * the candidate at all.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";
import type { InstrumentPurpose, MatchSignal } from "@/lib/documents/referenced-instruments";

// ---------------------------------------------------------------------------
// Types — mirror the route's response rather than importing it, for the reason
// `ai-party-linker-dialog.tsx` gives: nothing server-only may be pulled into
// the client bundle, even accidentally, via a stray non-type import later.
// `referenced-instruments.ts` itself IS safe to import (it is pure and has no
// db), which is why the enums above come from it rather than being retyped.
// ---------------------------------------------------------------------------

export type LinkerInstrument = {
  typeKey:      string | null;
  typeLabel:    string | null;
  nrDocument:   string | null;
  dateDocument: string | null;
  issuer:       string | null;
  purpose:      InstrumentPurpose | null;
  rawText:      string;
  status:       "PENDING" | "LINKED" | "STUBBED" | "LEFT";
  linkedDocumentId: string | null;
};

export type LinkerCandidate = {
  document: {
    id:              string;
    code:            string;
    title:           string | null;
    typeName:        string | null;
    nrDocument:      string | null;
    dateDocument:    string | null;
    institutionName: string | null;
    isStub:          boolean;
  };
  tier:    "strong" | "fair" | "weak";
  matched: MatchSignal[];
  missing: MatchSignal[];
};

export type LinkerItem = {
  index:      number;
  instrument: LinkerInstrument;
  candidates: LinkerCandidate[];
  suggestedTypeId: string | null;
};

export type LinkerDocumentType = { id: string; key: string; name: string };

export type ReferenceLinkerSummary = { linked: number; stubbed: number; left: number; skipped: number };

type Props = {
  documentId:    string;
  items:         LinkerItem[];
  documentTypes: LinkerDocumentType[];
  onClose:       (summary: ReferenceLinkerSummary) => void;
};

export function AiReferenceLinkerDialog({ documentId, items, documentTypes, onClose }: Props) {
  const t = useTranslations("document.aiReferenceLinker");

  /**
   * ⚠️ **ONLY THE UNANSWERED ONES ARE WALKED.** The stored array keeps every
   * reference for ever, including the ones somebody settled last month; a
   * stepper that re-asked them would make reopening the dialog a chore
   * proportional to how much work had already been done. The tab's button
   * already says how many are left, and this is the same number.
   */
  const pending = items.filter((i) => i.instrument.status === "PENDING");

  const [index, setIndex] = useState(0);
  const [counts, setCounts] = useState<ReferenceLinkerSummary>({ linked: 0, stubbed: 0, left: 0, skipped: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The stub form is opened deliberately, per reference — never a fallback. */
  const [stubbing, setStubbing] = useState(false);
  const [stubTypeId, setStubTypeId] = useState<string>("");

  const item = pending[index];
  const total = pending.length;

  const advance = (outcome: keyof ReferenceLinkerSummary) => {
    const next: ReferenceLinkerSummary = {
      linked:  counts.linked  + (outcome === "linked"  ? 1 : 0),
      stubbed: counts.stubbed + (outcome === "stubbed" ? 1 : 0),
      left:    counts.left    + (outcome === "left"    ? 1 : 0),
      skipped: counts.skipped + (outcome === "skipped" ? 1 : 0),
    };
    setError(null);
    setBusy(false);
    setStubbing(false);
    setStubTypeId("");
    if (index + 1 >= total) onClose(next);
    else { setCounts(next); setIndex((i) => i + 1); }
  };

  /**
   * One POST, one outcome, one place that reads the route's refusals.
   *
   * ⚠️ **NOTHING FROM THE SERVER IS SHOWN VERBATIM.** This route serves an API
   * and its `error` strings are English on purpose — they are for a hand-made
   * request. Every branch below lands on copy from this namespace, the way
   * `document-form.tsx`'s AI Discover handler does and for the same reason:
   * this is Ciprian's screen.
   */
  const send = async (
    body: Record<string, unknown>,
    outcome: keyof ReferenceLinkerSummary,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/instrument-references`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      const payload = (await res.json().catch(() => null)) as
        | { code?: string; roleName?: string; existingRoleName?: string | null; createdStub?: { code: string } | null }
        | null;

      if (!res.ok) {
        setBusy(false);
        if (payload?.code === "role_missing") {
          setError(t("roleMissing", { roleName: payload.roleName ?? "" }));
        } else if (payload?.code === "no_purpose") {
          setError(t("noPurpose"));
        } else if (payload?.code === "reference_gone") {
          setError(t("referenceGone"));
        } else if (payload?.code === "self_reference") {
          setError(t("selfReference"));
        } else {
          setError(t("saveError"));
        }
        return;
      }

      /*
       * ⚠️ **„SUNT DEJA ASOCIATE" STOPS HERE RATHER THAN ADVANCING UNDER
       * ITSELF.** `associateDocumentToDocument` ends in `.onConflictDoNothing()`
       * over a unique index on the PAIR, so linking two documents that are
       * already linked writes nothing — which is exactly what happens when the
       * user is trying to give the pair a different role. The route reports it
       * instead of swallowing it, and the sentence names the role the pair
       * ALREADY carries, because „change it" and „it is already that" are
       * different situations and only the role tells them apart.
       *
       * It does not advance, for the reason the party stepper gives: a message
       * shown while moving to the next item is a message nobody reads. „Lasă"
       * is one click away and is the right answer when the link is already
       * there.
       */
      if (payload?.code === "already_associated") {
        setBusy(false);
        setError(
          payload.existingRoleName
            ? t("alreadyAssociatedAs", { roleName: payload.existingRoleName })
            : t("alreadyAssociated"),
        );
        return;
      }

      advance(outcome);
    } catch {
      setBusy(false);
      setError(t("saveError"));
    }
  };

  if (!item) return null;

  const ref = item.instrument;

  /**
   * ⚠️ **LITERAL KEYS IN AN EXHAUSTIVE SWITCH, NOT `t(`signal.${s}`)`** — the
   * same reason `ai-party-linker-dialog.tsx` spells its four `cotaMod` labels
   * out. Several copy suites in this repo find a component's keys by reading
   * its SOURCE, and a template literal is invisible to them, so a dynamic key
   * ships a missing translation that nothing catches until it renders as a raw
   * key path in `DEFAULT_LOCALE`. The switch also makes a fifth `MatchSignal` a
   * TypeScript error here rather than a runtime blank.
   */
  const signalLabel = (s: MatchSignal): string => {
    switch (s) {
      case "number": return t("signal.number");
      case "date":   return t("signal.date");
      case "type":   return t("signal.type");
      case "issuer": return t("signal.issuer");
    }
  };

  /** Same rule, one enum over. */
  const purposeLabel = (p: InstrumentPurpose): string => {
    switch (p) {
      case "TITLE_CHAIN": return t("purpose.TITLE_CHAIN");
      case "SUPPORTING":  return t("purpose.SUPPORTING");
      case "PARENT":      return t("purpose.PARENT");
      case "PROMISE":     return t("purpose.PROMISE");
    }
  };

  /** „nr. X și data Y se potrivesc; Z nu e completat pe documentul din arhivă". */
  const reasonFor = (c: LinkerCandidate): string => {
    const agreed = c.matched.map(signalLabel).join(", ");
    const blank = c.missing.map(signalLabel).join(", ");
    const first = t("reasonMatched", { signals: agreed });
    return blank ? `${first} ${t("reasonMissing", { signals: blank })}` : first;
  };

  const printed = [
    ref.typeLabel ?? ref.typeKey,
    ref.nrDocument ? t("printedNumber", { nr: ref.nrDocument }) : null,
    ref.dateDocument,
    ref.issuer,
  ].filter((v): v is string => Boolean(v));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-reference-linker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <h3 id="ai-reference-linker-title" className="text-base font-semibold text-ink dark:text-zinc-100">
            {t("title")}
          </h3>
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-sm text-fade dark:text-zinc-400">
              {t("subtitle", { current: index + 1, total })}
            </span>
            <button
              type="button"
              aria-label={t("close")}
              onClick={() => onClose({ ...counts, skipped: counts.skipped + (total - index) })}
              className="text-lg leading-none text-fade hover:text-ink dark:text-zinc-500 dark:hover:text-zinc-200"
            >
              ×
            </button>
          </div>
        </div>

        {/* What the model read, in its own structured terms … */}
        <div className="mt-4 rounded-md border border-wire bg-canvas px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
          <p className="text-sm font-medium text-ink dark:text-zinc-100">
            {printed.length > 0 ? printed.join(" · ") : t("unnamedInstrument")}
          </p>
          <p className="mt-1 text-xs text-fade dark:text-zinc-400">
            {ref.purpose ? purposeLabel(ref.purpose) : t("purposeUnknown")}
          </p>
        </div>

        {/*
          … and THE PAGE'S OWN WORDING, verbatim. The one thing on this dialog
          that is not the model's interpretation, and therefore the one thing a
          user can check the scan against. It is never truncated.
        */}
        <div className="mt-2">
          <p className="text-xs font-medium text-fade dark:text-zinc-400">{t("rawTextLabel")}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm italic text-ink dark:text-zinc-200">
            {ref.rawText}
          </p>
        </div>

        {/* ── Candidates ────────────────────────────────────────────────── */}
        <div className="mt-4">
          <p className="text-sm font-medium text-ink dark:text-zinc-100">
            {item.candidates.length > 0 ? t("candidatesTitle") : t("noCandidates")}
          </p>
          {item.candidates.length === 0 && (
            <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("noCandidatesBody")}</p>
          )}
          <ul className="mt-2 flex flex-col gap-2">
            {item.candidates.map((c) => (
              <li
                key={c.document.id}
                className="rounded-md border border-wire px-3 py-2 dark:border-zinc-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink dark:text-zinc-100">
                      {c.document.title ?? c.document.code}
                      {c.document.isStub && (
                        <span className="ml-2 rounded-full bg-cta-pale px-2 py-0.5 text-xs font-medium text-cta dark:bg-cta/15 dark:text-cta-light">
                          {t("isStub")}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-fade dark:text-zinc-400">
                      {[c.document.code, c.document.typeName, c.document.nrDocument, c.document.dateDocument]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-ink dark:text-zinc-300">{reasonFor(c)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => send({ action: "link", index: item.index, documentId: c.document.id }, "linked")}
                    className={buttonClass({ variant: "primary", size: "xs" })}
                  >
                    {t("link")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── The stub form: a separate, separately-labelled act ─────────── */}
        {stubbing ? (
          <div className="mt-4 rounded-md border border-wire px-3 py-3 dark:border-zinc-700">
            <p className="text-sm font-medium text-ink dark:text-zinc-100">{t("stubTitle")}</p>
            <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("stubWarning")}</p>
            <label className="mt-3 flex flex-col gap-0.5 text-sm">
              <span className="text-xs text-fade dark:text-zinc-400">{t("stubType")}</span>
              <select
                value={stubTypeId || item.suggestedTypeId || ""}
                disabled={busy}
                onChange={(e) => setStubTypeId(e.target.value)}
                className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="">{t("stubTypePlaceholder")}</option>
                {documentTypes.map((dt) => (
                  <option key={dt.id} value={dt.id}>{dt.name}</option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy || !(stubTypeId || item.suggestedTypeId)}
                onClick={() =>
                  send(
                    { action: "stub", index: item.index, documentTypeId: stubTypeId || item.suggestedTypeId },
                    "stubbed",
                  )
                }
                className={buttonClass({ variant: "primary", size: "sm" })}
              >
                {t("stubConfirm")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStubbing(false)}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                {t("stubCancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setStubbing(true)}
              className={buttonClass({ variant: "secondary", size: "lg" })}
            >
              {t("stub")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => send({ action: "leave", index: item.index }, "left")}
              className={buttonClass({ variant: "secondary", size: "lg" })}
            >
              {t("leave")}
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
