"use client";

/**
 * AiPartyLinkerDialog — Slice #21.04.Import (Slice 2 of 3: confirm-or-create UI)
 *
 * One-at-a-time stepper over the `parties` array returned by
 * POST /api/documents/[id]/ai-interpret (Slice 1). For each extracted party
 * the admin explicitly confirms what happens — nothing is linked or created
 * automatically:
 *
 *   - roleMissing            → explain the role isn't configured yet (Reference
 *                               Data → Document Persons) and only offer Skip.
 *   - matchCandidate present → exact CNP/CUI match. Show a side-by-side
 *                               comparison (name, CNP/CUI, ID card number +
 *                               issuing authority) so the admin can safely
 *                               confirm it's really the same person before
 *                               linking — this is the explicit safety
 *                               requirement Adrian asked for. "No" falls
 *                               through to the create-new branch.
 *   - possibleMatches only   → fuzzy name matches only, never auto-linked;
 *                               labelled unconfirmed. Per-item Link, or
 *                               "None of these — create new".
 *   - no match at all        → offer to create a new Person (Natural or
 *                               Judicial, per party.personType) from the
 *                               extracted fields and link it.
 *
 * Every Link/Create action calls the existing, already-shipped APIs:
 *   POST /api/documents/[id]/persons  — associate (personIds, personRoleId)
 *   POST /api/people                  — create a Natural Person
 *   POST /api/judicial-persons        — create a Judicial Person
 * This component never talks to the DB directly.
 *
 * `domiciliu` (free text from the document) is not decomposed into
 * street/city/county — Slice 1 deliberately left addresses unstructured for
 * AI extraction. It's stored as a single address row's streetLine, with
 * country defaulted to "România" (the schema requires a non-empty country).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { HelpHint } from "@/components/help/help-hint";

// ---------------------------------------------------------------------------
// Types — mirror (but deliberately don't import from) the API route's
// response shape. Keeping this file's types local avoids ever pulling a
// server-only module (route.ts, or anything importing node "fs"/db) into the
// client bundle, even accidentally via a stray non-type import down the line.
// ---------------------------------------------------------------------------

export type AiPartyMatchCandidate = {
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

export type AiPartyPossibleMatch = {
  id: string;
  code: string;
  type: "NATURAL" | "JUDICIAL";
  displayName: string;
};

export type AiExtractedParty = {
  roleName: string;
  personRoleId: string | null;
  roleMissing: boolean;
  personType: "NATURAL" | "JUDICIAL";
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  cnp: string | null;
  cuiNumber: string | null;
  idDocumentNumber: string | null;
  idIssuingAuthority: string | null;
  domiciliu: string | null;
  rawText: string;
  matchCandidate: AiPartyMatchCandidate | null;
  possibleMatches: AiPartyPossibleMatch[];
};

export type AiPartyLinkerSummary = {
  linked: number;
  created: number;
  skipped: number;
};

type TFunc = ReturnType<typeof useTranslations<"document">>;

type Props = {
  documentId: string;
  parties: AiExtractedParty[];
  onClose: (summary: AiPartyLinkerSummary) => void;
};

type Outcome = "linked" | "created" | "skipped";

const orUndef = (v: string | null | undefined): string | undefined =>
  v && v.trim() ? v.trim() : undefined;

// party.name is usually populated by the model, but on some runs it only
// gives firstName/lastName separately (observed live: a Mandatar party with
// a full CNP/ID match but a null `name`). Fall back so the safety-comparison
// UI never shows a blank "—" where a name is actually available.
const partyDisplayName = (party: AiExtractedParty): string | null => {
  if (party.name?.trim()) return party.name.trim();
  const combined = `${party.firstName ?? ""} ${party.lastName ?? ""}`.trim();
  return combined || null;
};

export function AiPartyLinkerDialog({ documentId, parties, onClose }: Props) {
  const t = useTranslations("document");
  const [index, setIndex] = useState(0);
  const [counts, setCounts] = useState<AiPartyLinkerSummary>({ linked: 0, created: 0, skipped: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Overrides the exact-match / possible-match branches for the CURRENT
  // party only — reset every time we advance to the next one.
  const [forceCreate, setForceCreate] = useState(false);

  const party = parties[index];
  const total = parties.length;

  const finishNow = (finalCounts: AiPartyLinkerSummary) => onClose(finalCounts);

  const advance = (outcome: Outcome) => {
    const next = { ...counts, [outcome]: counts[outcome] + 1 };
    setError(null);
    setForceCreate(false);
    setBusy(false);
    if (index + 1 >= total) {
      finishNow(next);
    } else {
      setCounts(next);
      setIndex((i) => i + 1);
    }
  };

  const linkPerson = async (personId: string, outcome: Outcome) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personIds: [personId],
          personRoleId: party.personRoleId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      advance(outcome);
    } catch {
      setBusy(false);
      setError(outcome === "created" ? t("aiPartyLinker.createError") : t("aiPartyLinker.linkError"));
    }
  };

  const createAndLink = async () => {
    setBusy(true);
    setError(null);
    try {
      const addressKind = party.personType === "NATURAL" ? "HOME" : "HEADQUARTERS";
      const addresses = party.domiciliu?.trim()
        ? [{ kind: addressKind, streetLine: party.domiciliu.trim(), country: "România" }]
        : [];

      let personId: string;

      // Slice #21.07.Import — Adrian's rule: "for the persons created from the
      // AI interpretation of a document the provenience will be AI
      // interpretation". Every field in `party` came out of the model's reading
      // of this document, so it applies to both subtypes below and the user is
      // never asked.
      const provenance = inferProvenance("AI_EXTRACTION");

      if (party.personType === "NATURAL") {
        const hasSplitName = Boolean(party.firstName || party.lastName);
        const payload: Record<string, unknown> = {
          firstName: hasSplitName ? orUndef(party.firstName) : undefined,
          // Fallback: if the model only gave a combined `name`, keep it whole
          // rather than guessing where the split is — better than a wrong split.
          lastName: hasSplitName ? orUndef(party.lastName) : orUndef(party.name),
          cnp: orUndef(party.cnp),
          idDocumentType: orUndef(party.idDocumentNumber) ? "ID_CARD" : undefined,
          idDocumentNumber: orUndef(party.idDocumentNumber),
          idIssuingAuthority: orUndef(party.idIssuingAuthority),
          addresses,
          provenance,
        };
        const res = await fetch("/api/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // createNaturalPerson returns { person, natural, ... } — the id is
        // nested under `person`, not top-level. (Caught live: sending the
        // top-level `undefined` here silently became `null` in the JSON
        // body, which the link call's zod schema rejected with a 400.)
        const body = (await res.json()) as { person: { id: string } };
        personId = body.person.id;
      } else {
        const payload: Record<string, unknown> = {
          name: orUndef(party.name) ?? `${party.firstName ?? ""} ${party.lastName ?? ""}`.trim(),
          cuiNumber: orUndef(party.cuiNumber),
          addresses,
          provenance,
        };
        const res = await fetch("/api/judicial-persons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // createJudicialPerson mirrors createNaturalPerson's shape — id is
        // under `person`, not top-level. See the comment above.
        const body = (await res.json()) as { person: { id: string } };
        personId = body.person.id;
      }

      const linkRes = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds: [personId], personRoleId: party.personRoleId }),
      });
      if (!linkRes.ok) throw new Error(`HTTP ${linkRes.status}`);

      advance("created");
    } catch {
      setBusy(false);
      setError(t("aiPartyLinker.createError"));
    }
  };

  const skip = () => advance("skipped");

  const closeAndSkipRest = () => {
    finishNow({ ...counts, skipped: counts.skipped + (total - index) });
  };

  if (!party) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-party-linker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <h3 id="ai-party-linker-title" className="flex items-center gap-1 text-base font-semibold text-ink dark:text-zinc-100">
            {t("aiPartyLinker.title")}
            <HelpHint hintKey="ai-party-confirm" />
          </h3>
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-sm text-fade dark:text-zinc-400">
              {t("aiPartyLinker.subtitle", { current: index + 1, total })}
            </span>
            <button
              type="button"
              aria-label={t("aiPartyLinker.close")}
              onClick={closeAndSkipRest}
              className="text-lg leading-none text-fade hover:text-ink dark:text-zinc-500 dark:hover:text-zinc-200"
            >
              ×
            </button>
          </div>
        </div>

        <ExtractedSummary party={party} t={t} />

        <div className="mt-4">
          {party.roleMissing ? (
            <RoleMissingBranch party={party} t={t} busy={busy} onSkip={skip} />
          ) : party.matchCandidate && !forceCreate ? (
            <ExactMatchBranch
              party={party}
              candidate={party.matchCandidate}
              t={t}
              busy={busy}
              onConfirm={() => linkPerson(party.matchCandidate!.id, "linked")}
              onCreateInstead={() => setForceCreate(true)}
              onSkip={skip}
            />
          ) : !party.matchCandidate && party.possibleMatches.length > 0 && !forceCreate ? (
            <PossibleMatchesBranch
              matches={party.possibleMatches}
              t={t}
              busy={busy}
              onLink={(id) => linkPerson(id, "linked")}
              onCreateNew={() => setForceCreate(true)}
              onSkip={skip}
            />
          ) : (
            <NoMatchBranch t={t} busy={busy} onCreate={createAndLink} onSkip={skip} />
          )}
        </div>

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

// ---------------------------------------------------------------------------
// Extracted-from-document summary card — shown above every branch.
// ---------------------------------------------------------------------------

function ExtractedSummary({ party, t }: { party: AiExtractedParty; t: TFunc }) {
  const rows: [string, string | null][] = [
    [t("aiPartyLinker.fieldName"), partyDisplayName(party)],
    [t("aiPartyLinker.fieldCnp"), party.cnp],
    [t("aiPartyLinker.fieldCui"), party.cuiNumber],
    [t("aiPartyLinker.fieldIdNumber"), party.idDocumentNumber],
    [t("aiPartyLinker.fieldIdAuthority"), party.idIssuingAuthority],
    [t("aiPartyLinker.fieldDomiciliu"), party.domiciliu],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <div className="mt-4 rounded-md border border-wire bg-canvas px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950">
      <div className="font-medium text-ink dark:text-zinc-100">
        {party.roleName} —{" "}
        {party.personType === "NATURAL" ? t("aiPartyLinker.typeNatural") : t("aiPartyLinker.typeJudicial")}
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
  party, t, busy, onSkip,
}: {
  party: AiExtractedParty;
  t: TFunc;
  busy: boolean;
  onSkip: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
        {t("aiPartyLinker.roleMissingTitle")}
      </p>
      <p className="mt-1 text-sm text-fade dark:text-zinc-400">
        {t("aiPartyLinker.roleMissingBody", { roleName: party.roleName })}
      </p>
      <div className="mt-4 flex justify-end">
        <SecondaryButton onClick={onSkip} disabled={busy}>{t("aiPartyLinker.skip")}</SecondaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch: exact CNP/CUI match — side-by-side comparison before linking.
// ---------------------------------------------------------------------------

function ExactMatchBranch({
  party, candidate, t, busy, onConfirm, onCreateInstead, onSkip,
}: {
  party: AiExtractedParty;
  candidate: AiPartyMatchCandidate;
  t: TFunc;
  busy: boolean;
  onConfirm: () => void;
  onCreateInstead: () => void;
  onSkip: () => void;
}) {
  const isNatural = candidate.type === "NATURAL";
  return (
    <div>
      <p className="text-sm font-medium text-ink dark:text-zinc-100">{t("aiPartyLinker.exactMatchTitle")}</p>
      <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("aiPartyLinker.exactMatchBody")}</p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-wire px-3 py-2 text-sm dark:border-zinc-700">
          <div className="mb-1 font-medium text-fade dark:text-zinc-400">{t("aiPartyLinker.fromDocumentTitle")}</div>
          <div className="text-ink dark:text-zinc-200">{partyDisplayName(party) ?? "—"}</div>
          {isNatural && party.cnp && <div className="text-ink dark:text-zinc-200">CNP: {party.cnp}</div>}
          {!isNatural && party.cuiNumber && <div className="text-ink dark:text-zinc-200">CUI: {party.cuiNumber}</div>}
          {party.idDocumentNumber && <div className="text-ink dark:text-zinc-200">{t("aiPartyLinker.fieldIdNumber")}: {party.idDocumentNumber}</div>}
          {party.idIssuingAuthority && <div className="text-ink dark:text-zinc-200">{t("aiPartyLinker.fieldIdAuthority")}: {party.idIssuingAuthority}</div>}
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="mb-1 font-medium text-fade dark:text-zinc-400">{t("aiPartyLinker.existingPersonTitle")}</div>
          <div className="text-ink dark:text-zinc-200">{candidate.displayName} ({candidate.code})</div>
          {isNatural && candidate.cnp && <div className="text-ink dark:text-zinc-200">CNP: {candidate.cnp}</div>}
          {!isNatural && candidate.cuiNumber && <div className="text-ink dark:text-zinc-200">CUI: {candidate.cuiNumber}</div>}
          {isNatural && candidate.idDocumentNumber && (
            <div className="text-ink dark:text-zinc-200">{t("aiPartyLinker.fieldIdNumber")}: {candidate.idDocumentNumber}</div>
          )}
          {isNatural && candidate.idIssuingAuthority && (
            <div className="text-ink dark:text-zinc-200">{t("aiPartyLinker.fieldIdAuthority")}: {candidate.idIssuingAuthority}</div>
          )}
          {!isNatural && candidate.tradeRegisterNumber && (
            <div className="text-ink dark:text-zinc-200">{candidate.tradeRegisterNumber}</div>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm font-medium text-ink dark:text-zinc-100">{t("aiPartyLinker.sameQuestion")}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <SecondaryButton onClick={onSkip} disabled={busy}>{t("aiPartyLinker.skip")}</SecondaryButton>
        <SecondaryButton onClick={onCreateInstead} disabled={busy}>{t("aiPartyLinker.createInsteadOfMatch")}</SecondaryButton>
        <PrimaryButton onClick={onConfirm} disabled={busy}>
          {busy ? t("aiPartyLinker.linking") : t("aiPartyLinker.confirmLink")}
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
  matches: AiPartyPossibleMatch[];
  t: TFunc;
  busy: boolean;
  onLink: (personId: string) => void;
  onCreateNew: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink dark:text-zinc-100">{t("aiPartyLinker.possibleMatchesTitle")}</p>
      <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("aiPartyLinker.possibleMatchesBody")}</p>

      <ul className="mt-3 space-y-2">
        {matches.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-md border border-wire px-3 py-2 text-sm dark:border-zinc-700"
          >
            <span className="text-ink dark:text-zinc-200">
              {m.displayName} ({m.code}) — {m.type === "NATURAL" ? t("aiPartyLinker.typeNatural") : t("aiPartyLinker.typeJudicial")}
            </span>
            <SecondaryButton onClick={() => onLink(m.id)} disabled={busy}>
              {t("aiPartyLinker.linkThis")}
            </SecondaryButton>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <SecondaryButton onClick={onSkip} disabled={busy}>{t("aiPartyLinker.skip")}</SecondaryButton>
        <PrimaryButton onClick={onCreateNew} disabled={busy}>{t("aiPartyLinker.noneOfThese")}</PrimaryButton>
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
  t: TFunc;
  busy: boolean;
  onCreate: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink dark:text-zinc-100">{t("aiPartyLinker.noMatchTitle")}</p>
      <p className="mt-1 text-sm text-fade dark:text-zinc-400">{t("aiPartyLinker.noMatchBody")}</p>
      <div className="mt-4 flex justify-end gap-2">
        <SecondaryButton onClick={onSkip} disabled={busy}>{t("aiPartyLinker.skip")}</SecondaryButton>
        <PrimaryButton onClick={onCreate} disabled={busy}>
          {busy ? t("aiPartyLinker.creating") : t("aiPartyLinker.createAndLink")}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared button styles (match ConfirmDialog elsewhere in this feature).
// ---------------------------------------------------------------------------

function SecondaryButton({
  onClick, disabled, children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  onClick, disabled, children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
