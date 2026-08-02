"use client";

/**
 * AiPartyLinkerDialog — Slice #21.04.Import (Slice 2 of 3: confirm-or-create UI)
 *
 * One-at-a-time stepper over the `parties` array returned by
 * POST /api/documents/[id]/ai-interpret (Slice 1). For each extracted party the
 * admin explicitly confirms what happens — nothing is linked or created
 * automatically.
 *
 * Slice #23.01.Import moved the branch UI (role-missing / exact match /
 * possible matches / no match) into the shared PersonResolutionDialog, so the
 * ID-card path in the import wizard reuses this exact safety net instead of
 * growing a second copy of it. What stayed here is what is genuinely specific
 * to walking a document's parties:
 *
 *   - the stepper (index, per-outcome counts, advance/close-and-skip-rest)
 *   - the network calls, which are document-scoped
 *   - the NATURAL/JUDICIAL split on create — a party can be either; an ID card
 *     is always a natural person
 *
 * Every Link/Create action calls the existing, already-shipped APIs:
 *   POST /api/documents/[id]/persons  — associate (personIds, personRoleId)
 *   POST /api/people                  — create a Natural Person
 *   POST /api/judicial-persons        — create a Judicial Person
 * This component never talks to the DB directly.
 *
 * `domiciliu` (free text from the document) is not decomposed into
 * street/city/county — Slice 1 deliberately left addresses unstructured for AI
 * extraction. It is stored as a single address row's streetLine, with country
 * defaulted to "România" (the schema requires a non-empty country).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { HelpHint } from "@/components/help/help-hint";
import {
  PersonResolutionDialog,
  type ResolutionSubject,
} from "@/components/persons/person-resolution-dialog";

// ---------------------------------------------------------------------------
// Types — mirror (but deliberately don't import from) the API route's response
// shape. Keeping this file's types local avoids ever pulling a server-only
// module (route.ts, or anything importing node "fs"/db) into the client bundle,
// even accidentally via a stray non-type import down the line.
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

type Props = {
  documentId: string;
  parties: AiExtractedParty[];
  onClose: (summary: AiPartyLinkerSummary) => void;
};

type Outcome = "linked" | "created" | "skipped";

const orUndef = (v: string | null | undefined): string | undefined =>
  v && v.trim() ? v.trim() : undefined;

// party.name is usually populated by the model, but on some runs it only gives
// firstName/lastName separately (observed live: a Mandatar party with a full
// CNP/ID match but a null `name`). Fall back so the safety-comparison UI never
// shows a blank "—" where a name is actually available.
const partyDisplayName = (party: AiExtractedParty): string | null => {
  if (party.name?.trim()) return party.name.trim();
  const combined = `${party.firstName ?? ""} ${party.lastName ?? ""}`.trim();
  return combined || null;
};

const subjectFromParty = (party: AiExtractedParty): ResolutionSubject => ({
  heading: party.roleName,
  personType: party.personType,
  displayName: partyDisplayName(party),
  cnp: party.cnp,
  cuiNumber: party.cuiNumber,
  idDocumentNumber: party.idDocumentNumber,
  idIssuingAuthority: party.idIssuingAuthority,
  domiciliu: party.domiciliu,
});

export function AiPartyLinkerDialog({ documentId, parties, onClose }: Props) {
  const t = useTranslations("document.aiPartyLinker");
  const [index, setIndex] = useState(0);
  const [counts, setCounts] = useState<AiPartyLinkerSummary>({ linked: 0, created: 0, skipped: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Overrides the exact-match / possible-match branches for the CURRENT party
  // only — reset every time we advance to the next one.
  const [forceCreate, setForceCreate] = useState(false);

  const party = parties[index];
  const total = parties.length;

  const advance = (outcome: Outcome) => {
    const next = { ...counts, [outcome]: counts[outcome] + 1 };
    setError(null);
    setForceCreate(false);
    setBusy(false);
    if (index + 1 >= total) {
      onClose(next);
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
      setError(outcome === "created" ? t("createError") : t("linkError"));
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
        // top-level `undefined` here silently became `null` in the JSON body,
        // which the link call's zod schema rejected with a 400.)
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
      setError(t("createError"));
    }
  };

  if (!party) return null;

  return (
    <PersonResolutionDialog
      t={t}
      title={
        <>
          {t("title")}
          <HelpHint hintKey="ai-party-confirm" />
        </>
      }
      subject={subjectFromParty(party)}
      matchCandidate={party.matchCandidate}
      possibleMatches={party.possibleMatches}
      roleMissing={party.roleMissing}
      current={index + 1}
      total={total}
      busy={busy}
      forceCreate={forceCreate}
      onForceCreate={() => setForceCreate(true)}
      onConfirmMatch={(personId) => linkPerson(personId, "linked")}
      onPickMatch={(personId) => linkPerson(personId, "linked")}
      onCreateNew={createAndLink}
      onSkip={() => advance("skipped")}
      onClose={() => onClose({ ...counts, skipped: counts.skipped + (total - index) })}
    >
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      )}
    </PersonResolutionDialog>
  );
}
