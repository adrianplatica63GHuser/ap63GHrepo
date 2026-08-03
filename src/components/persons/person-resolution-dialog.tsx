"use client";

/**
 * PersonResolutionDialog — the shared confirm-or-create surface (Slice #23.01.Import)
 *
 * Lifted out of documents/_components/ai-party-linker-dialog.tsx, which shipped
 * in Slice #21.04.Import and was the only implementation of the rule CLAUDE.md
 * states for every AI-extraction path:
 *
 *   exact identifier match first, fuzzy names only as UNCONFIRMED suggestions,
 *   and nothing is ever created or linked without an explicit human decision.
 *
 * Slice #23.01.Import needed the same guarantee for ID cards read by the import
 * wizard. Copying the branches would have meant two implementations of the one
 * safety net that stops two different real people being silently merged — the
 * "fourth call site is the one that gets missed" failure CLAUDE.md already
 * records for the UAT_NO_AUTH bypass. So it lives here once.
 *
 * WHAT THIS COMPONENT OWNS: choosing the branch, rendering it, and reporting the
 * user's decision. It renders ONE subject.
 *
 * WHAT IT DELIBERATELY DOES NOT OWN:
 *   - the network. Every action is a callback; the caller creates and links,
 *     because "link to a document" and "link to a property AND a document" are
 *     genuinely different operations.
 *   - the stepper. AiPartyLinkerDialog walks several parties and keeps its own
 *     index/counts; the ID-card caller has exactly one subject and passes
 *     current=1 total=1. Owning it here would force the single-subject caller
 *     to fake a loop.
 *   - its translations. `t` is passed in, scoped to whichever namespace the
 *     caller uses, so each surface words the same branch for its own context
 *     ("from the document" vs "from the ID card"). RESOLUTION_KEYS below is the
 *     contract, enforced across both namespaces and both locales by
 *     src/__tests__/person-resolution-keys.test.ts — a missing key fails the
 *     build rather than rendering a raw key name at the user (the exact defect
 *     the bulkDelete dialog shipped with).
 */

import type { ReactNode } from "react";
import { buttonClass } from "@/lib/ui/button-styles";

// ---------------------------------------------------------------------------
// The i18n contract
// ---------------------------------------------------------------------------

/**
 * Every key this component reads. Both consuming namespaces must define all of
 * them, in both locales — asserted by the key-parity test.
 */
export const RESOLUTION_KEYS = [
  "close",
  "subtitle",
  "typeNatural",
  "typeJudicial",
  "fieldName",
  "fieldCnp",
  "fieldCui",
  "fieldIdNumber",
  "fieldIdAuthority",
  "fieldDomiciliu",
  "roleMissingTitle",
  "roleMissingBody",
  "exactMatchTitle",
  "exactMatchBody",
  "fromDocumentTitle",
  "existingPersonTitle",
  "sameQuestion",
  "possibleMatchesTitle",
  "possibleMatchesBody",
  "linkThis",
  "noneOfThese",
  "noMatchTitle",
  "noMatchBody",
  "createAndLink",
  "creating",
  "confirmLink",
  "linking",
  "createInsteadOfMatch",
  "skip",
] as const;

export type ResolutionKey = (typeof RESOLUTION_KEYS)[number];

/**
 * A next-intl `t` narrowed to what this component needs. Callers pass their own
 * scoped translator; the loose value type keeps both call sites assignable
 * without each having to re-declare next-intl's generic message shape.
 */
export type ResolutionT = (
  key: ResolutionKey,
  values?: Record<string, string | number>,
) => string;

// ---------------------------------------------------------------------------
// Data shapes — structural, so neither caller has to import server types
// ---------------------------------------------------------------------------

export type ResolutionCandidate = {
  id: string;
  code: string;
  type: "NATURAL" | "JUDICIAL";
  displayName: string;
  cnp?: string | null;
  idDocumentNumber?: string | null;
  idIssuingAuthority?: string | null;
  cuiNumber?: string | null;
  tradeRegisterNumber?: string | null;
};

export type ResolutionMatch = {
  id: string;
  code: string;
  type: "NATURAL" | "JUDICIAL";
  displayName: string;
};

/** The identity as READ from the source, before any decision is taken. */
export type ResolutionSubject = {
  /** Heading for the summary card — a party role, or the card holder's name. */
  heading: string;
  personType: "NATURAL" | "JUDICIAL";
  displayName: string | null;
  cnp: string | null;
  cuiNumber: string | null;
  idDocumentNumber: string | null;
  idIssuingAuthority: string | null;
  domiciliu: string | null;
};

// ---------------------------------------------------------------------------
// Branch selection
// ---------------------------------------------------------------------------

/**
 * Is the create-new branch the one that will render?
 *
 * Exported because the ID-card caller has to render its review form only while
 * this branch is active, and the two decisions must never disagree — a form
 * shown under the exact-match branch would let the user edit fields that are
 * about to be discarded, and one hidden under the create branch would leave the
 * create button with nothing to submit. One predicate, used by both.
 */
export function isCreateBranch(state: {
  matchCandidate: ResolutionCandidate | null;
  possibleMatches: ResolutionMatch[];
  forceCreate: boolean;
  roleMissing?: boolean;
}): boolean {
  if (state.roleMissing) return false;
  if (state.forceCreate) return true;
  if (state.matchCandidate) return false;
  return state.possibleMatches.length === 0;
}

export type PersonResolutionDialogProps = {
  t: ResolutionT;
  /** Dialog heading. Passed whole so each caller keeps its own title key. */
  title: ReactNode;
  subject: ResolutionSubject;
  matchCandidate: ResolutionCandidate | null;
  possibleMatches: ResolutionMatch[];
  /**
   * The party's role is not configured for this document type, so there is
   * nothing to link it as. Only ever true on the document-party path.
   */
  roleMissing?: boolean;
  /** Position in the caller's sequence — pass 1/1 for a single subject. */
  current: number;
  total: number;
  busy: boolean;
  /**
   * Forces the create-new branch even when a match exists — the user answered
   * "no, that is someone else". Owned by the caller so it resets correctly when
   * a stepper advances.
   */
  forceCreate: boolean;
  onForceCreate: () => void;
  onConfirmMatch: (personId: string) => void;
  onPickMatch: (personId: string) => void;
  onCreateNew: () => void;
  onSkip: () => void;
  onClose: () => void;
  /** Rendered under the branch — e.g. the ID-card review form, or an error. */
  children?: ReactNode;
};

// ---------------------------------------------------------------------------

export function PersonResolutionDialog({
  t,
  title,
  subject,
  matchCandidate,
  possibleMatches,
  roleMissing = false,
  current,
  total,
  busy,
  forceCreate,
  onForceCreate,
  onConfirmMatch,
  onPickMatch,
  onCreateNew,
  onSkip,
  onClose,
  children,
}: PersonResolutionDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="person-resolution-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <h3
            id="person-resolution-title"
            className="flex items-center gap-1 text-base font-semibold text-ink dark:text-zinc-100"
          >
            {title}
          </h3>
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-sm text-fade dark:text-zinc-400">
              {t("subtitle", { current, total })}
            </span>
            <button
              type="button"
              aria-label={t("close")}
              onClick={onClose}
              className="text-lg leading-none text-fade hover:text-ink dark:text-zinc-500 dark:hover:text-zinc-200"
            >
              ×
            </button>
          </div>
        </div>

        <ExtractedSummary subject={subject} t={t} />

        <div className="mt-4">
          {roleMissing ? (
            <RoleMissingBranch heading={subject.heading} t={t} busy={busy} onSkip={onSkip} />
          ) : matchCandidate && !forceCreate ? (
            <ExactMatchBranch
              subject={subject}
              candidate={matchCandidate}
              t={t}
              busy={busy}
              onConfirm={() => onConfirmMatch(matchCandidate.id)}
              onCreateInstead={onForceCreate}
              onSkip={onSkip}
            />
          ) : !matchCandidate && possibleMatches.length > 0 && !forceCreate ? (
            <PossibleMatchesBranch
              matches={possibleMatches}
              t={t}
              busy={busy}
              onLink={onPickMatch}
              onCreateNew={onForceCreate}
              onSkip={onSkip}
            />
          ) : (
            // Reached exactly when isCreateBranch(...) is true — see the
            // predicate above; the ID-card caller keys its review form on it.
            <NoMatchBranch t={t} busy={busy} onCreate={onCreateNew} onSkip={onSkip} />
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary of what was read from the source — shown above every branch.
// ---------------------------------------------------------------------------

function ExtractedSummary({ subject, t }: { subject: ResolutionSubject; t: ResolutionT }) {
  const rows = (
    [
      [t("fieldName"), subject.displayName],
      [t("fieldCnp"), subject.cnp],
      [t("fieldCui"), subject.cuiNumber],
      [t("fieldIdNumber"), subject.idDocumentNumber],
      [t("fieldIdAuthority"), subject.idIssuingAuthority],
      [t("fieldDomiciliu"), subject.domiciliu],
    ] as [string, string | null][]
  ).filter((row): row is [string, string] => !!row[1]);

  return (
    <div className="mt-4 rounded-md border border-wire bg-canvas px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950">
      <div className="font-medium text-ink dark:text-zinc-100">
        {subject.heading} —{" "}
        {subject.personType === "NATURAL" ? t("typeNatural") : t("typeJudicial")}
      </div>
      {rows.length > 0 && (
        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-fade dark:text-zinc-400">{label}</dt>
              <dd className="text-ink dark:text-zinc-200">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch: role not configured for this document type — Skip only.
// ---------------------------------------------------------------------------

function RoleMissingBranch({
  heading, t, busy, onSkip,
}: {
  heading: string;
  t: ResolutionT;
  busy: boolean;
  onSkip: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
        {t("roleMissingTitle")}
      </p>
      <p className="mt-1 text-sm text-fade dark:text-zinc-400">
        {t("roleMissingBody", { roleName: heading })}
      </p>
      <div className="mt-4 flex justify-end">
        <SecondaryButton onClick={onSkip} disabled={busy}>{t("skip")}</SecondaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch: exact CNP/CUI match — side-by-side comparison before linking.
//
// The comparison is the point. An exact CNP hit is strong, but confirming it
// blind is how two different real people get merged, so the user always sees
// both sides before saying yes.
// ---------------------------------------------------------------------------

function ExactMatchBranch({
  subject, candidate, t, busy, onConfirm, onCreateInstead, onSkip,
}: {
  subject: ResolutionSubject;
  candidate: ResolutionCandidate;
  t: ResolutionT;
  busy: boolean;
  onConfirm: () => void;
  onCreateInstead: () => void;
  onSkip: () => void;
}) {
  const isNatural = candidate.type === "NATURAL";
  return (
    <div>
      <p className="text-sm font-medium text-ink dark:text-zinc-100">{t("exactMatchTitle")}</p>
      <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("exactMatchBody")}</p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-wire px-3 py-2 text-sm dark:border-zinc-700">
          <div className="mb-1 font-medium text-fade dark:text-zinc-400">{t("fromDocumentTitle")}</div>
          <div className="text-ink dark:text-zinc-200">{subject.displayName ?? "—"}</div>
          {isNatural && subject.cnp && <div className="text-ink dark:text-zinc-200">CNP: {subject.cnp}</div>}
          {!isNatural && subject.cuiNumber && <div className="text-ink dark:text-zinc-200">CUI: {subject.cuiNumber}</div>}
          {subject.idDocumentNumber && (
            <div className="text-ink dark:text-zinc-200">{t("fieldIdNumber")}: {subject.idDocumentNumber}</div>
          )}
          {subject.idIssuingAuthority && (
            <div className="text-ink dark:text-zinc-200">{t("fieldIdAuthority")}: {subject.idIssuingAuthority}</div>
          )}
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="mb-1 font-medium text-fade dark:text-zinc-400">{t("existingPersonTitle")}</div>
          <div className="text-ink dark:text-zinc-200">{candidate.displayName} ({candidate.code})</div>
          {isNatural && candidate.cnp && <div className="text-ink dark:text-zinc-200">CNP: {candidate.cnp}</div>}
          {!isNatural && candidate.cuiNumber && <div className="text-ink dark:text-zinc-200">CUI: {candidate.cuiNumber}</div>}
          {isNatural && candidate.idDocumentNumber && (
            <div className="text-ink dark:text-zinc-200">{t("fieldIdNumber")}: {candidate.idDocumentNumber}</div>
          )}
          {isNatural && candidate.idIssuingAuthority && (
            <div className="text-ink dark:text-zinc-200">{t("fieldIdAuthority")}: {candidate.idIssuingAuthority}</div>
          )}
          {!isNatural && candidate.tradeRegisterNumber && (
            <div className="text-ink dark:text-zinc-200">{candidate.tradeRegisterNumber}</div>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm font-medium text-ink dark:text-zinc-100">{t("sameQuestion")}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <SecondaryButton onClick={onSkip} disabled={busy}>{t("skip")}</SecondaryButton>
        <SecondaryButton onClick={onCreateInstead} disabled={busy}>{t("createInsteadOfMatch")}</SecondaryButton>
        <PrimaryButton onClick={onConfirm} disabled={busy}>
          {busy ? t("linking") : t("confirmLink")}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch: fuzzy name matches only — never auto-linked, always unconfirmed.
// ---------------------------------------------------------------------------

function PossibleMatchesBranch({
  matches, t, busy, onLink, onCreateNew, onSkip,
}: {
  matches: ResolutionMatch[];
  t: ResolutionT;
  busy: boolean;
  onLink: (personId: string) => void;
  onCreateNew: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink dark:text-zinc-100">{t("possibleMatchesTitle")}</p>
      <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("possibleMatchesBody")}</p>

      <ul className="mt-3 space-y-2">
        {matches.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-md border border-wire px-3 py-2 text-sm dark:border-zinc-700"
          >
            <span className="text-ink dark:text-zinc-200">
              {m.displayName} ({m.code}) —{" "}
              {m.type === "NATURAL" ? t("typeNatural") : t("typeJudicial")}
            </span>
            <SecondaryButton onClick={() => onLink(m.id)} disabled={busy}>
              {t("linkThis")}
            </SecondaryButton>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <SecondaryButton onClick={onSkip} disabled={busy}>{t("skip")}</SecondaryButton>
        <PrimaryButton onClick={onCreateNew} disabled={busy}>{t("noneOfThese")}</PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch: nothing found at all — create a brand-new Person.
// ---------------------------------------------------------------------------

function NoMatchBranch({
  t, busy, onCreate, onSkip,
}: {
  t: ResolutionT;
  busy: boolean;
  onCreate: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink dark:text-zinc-100">{t("noMatchTitle")}</p>
      <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("noMatchBody")}</p>
      <div className="mt-4 flex justify-end gap-2">
        <SecondaryButton onClick={onSkip} disabled={busy}>{t("skip")}</SecondaryButton>
        <PrimaryButton onClick={onCreate} disabled={busy}>
          {busy ? t("creating") : t("createAndLink")}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared button styles (match ConfirmDialog elsewhere in this feature).
// ---------------------------------------------------------------------------

export function SecondaryButton({
  onClick, disabled, children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClass({ variant: "secondary", size: "lg" })}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  onClick, disabled, children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClass({ variant: "primary", size: "lg" })}
    >
      {children}
    </button>
  );
}
