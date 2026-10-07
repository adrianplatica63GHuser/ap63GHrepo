"use client";

/**
 * The holder's ticked parents, one after the other, through the same
 * confirm-or-create the holder went through  (Slice #38.29)
 *
 * Mounted once the holder exists — created or confirmed — by the import's
 * ID-card dialog and by Persoane fizice → „Adaugă nou". For each parent:
 *   1. POST /api/admin/import/resolve-natural-person with the name only — a
 *      parent read off a card has no CNP, so there is never an exact match, only
 *      unconfirmed suggestions by name, and the dialog says so;
 *   2. PersonResolutionDialog: link one of the suggestions, create the parent
 *      (POST /api/people, provenance RELATIVE_ID_CARD, the „Note" line naming
 *      the card), or skip;
 *   3. POST /api/people/[holder]/parents — the parent holds „Tată" / „Mamă".
 * A parent that fails is recorded and the next one goes on: the holder is
 * already in the archive and nothing here undoes it. `onDone` gets one outcome
 * per parent, for the caller's row or message.
 *
 * The holder never appears among a parent's suggestions, nor does a parent
 * already linked in this run: the fallback search by surname alone finds both.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PersonResolutionDialog,
  type ResolutionCandidate,
  type ResolutionMatch,
  type ResolutionT,
} from "@/components/persons/person-resolution-dialog";
import { ActivityCue } from "@/components/activity-cue";
import {
  parentLink,
  parentNote,
  parentPersonBody,
  personName,
  type ParentDraft,
  type ParentOutcome,
} from "@/lib/import/id-card-parents";

type Holder = { id: string; name: string; code: string | null; documentCode: string | null };

/** The holder's name and code, and the card's DOC code, read once for the „Note" line. */
async function readHolder(holderId: string, documentId: string | null): Promise<Holder> {
  let name = "";
  let code: string | null = null;
  let documentCode: string | null = null;
  const res = await fetch(`/api/people/${encodeURIComponent(holderId)}`);
  if (res.ok) {
    const body = (await res.json()) as {
      person?: { code?: string | null; displayName?: string | null };
      natural?: { firstName?: string | null; lastName?: string | null } | null;
    };
    code = body.person?.code ?? null;
    name = personName(body.natural?.lastName, body.natural?.firstName) || (body.person?.displayName ?? "");
  }
  if (documentId) {
    const doc = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
    if (doc.ok) {
      // The card's own DOC code, for the note — never a name's stand-in (system-id-one-place).
      const body = (await doc.json()) as { code?: string | null };
      documentCode = typeof body.code === "string" && body.code !== "" ? body.code : null;
    }
  }
  return { id: holderId, name, code, documentCode };
}

async function failure(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return new Error(body.error ?? `HTTP ${res.status}`);
}

export function ParentsResolution({
  holderId,
  documentId = null,
  parents,
  onDone,
}: {
  holderId: string;
  /** The card's Document, when there is one (the import) — its code goes in the „Note". */
  documentId?: string | null;
  /** The ticked parents with both names — `parentsToCreate(drafts)`. */
  parents: readonly ParentDraft[];
  onDone: (outcomes: ParentOutcome[]) => void;
}) {
  const t = useTranslations("parentsFromIdCard");
  const tr = useTranslations("parentsFromIdCard.resolution") as unknown as ResolutionT;

  const [index, setIndex] = useState(0);
  const [holder, setHolder] = useState<Holder | null>(null);
  const [matches, setMatches] = useState<ResolutionMatch[] | null>(null);
  const [searchedName, setSearchedName] = useState<string | null>(null);
  const [forceCreate, setForceCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outcomes = useRef<ParentOutcome[]>([]);
  const linkedIds = useRef<Set<string>>(new Set());
  const finished = useRef(false);

  const current = parents[index] as ParentDraft | undefined;

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone(outcomes.current);
  }, [onDone]);

  const advance = useCallback(
    (outcome: ParentOutcome) => {
      outcomes.current = [...outcomes.current, outcome];
      if (outcome.personId) linkedIds.current.add(outcome.personId);
      setMatches(null);
      setSearchedName(null);
      setForceCreate(false);
      setError(null);
      setBusy(false);
      if (index + 1 >= parents.length) finish();
      else setIndex(index + 1);
    },
    [finish, index, parents.length],
  );

  // Nothing to do — answered at once, never an empty dialog.
  useEffect(() => {
    if (parents.length === 0) finish();
  }, [parents.length, finish]);

  // The holder, once; then each parent's suggestions, by name.
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    async function run() {
      try {
        const h = holder ?? (await readHolder(holderId, documentId));
        if (cancelled) return;
        if (!holder) setHolder(h);
        const res = await fetch("/api/admin/import/resolve-natural-person", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnp: null, firstName: current!.firstName.trim(), lastName: current!.lastName.trim() }),
        });
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { possibleMatches?: ResolutionMatch[]; searchedName?: string | null };
          setMatches(
            (body.possibleMatches ?? []).filter((m) => m.id !== holderId && !linkedIds.current.has(m.id)),
          );
          setSearchedName(body.searchedName ?? null);
        } else {
          // A failed search must not block: it degrades to „create", and says so.
          setMatches([]);
          setError(t("searchFailed"));
        }
      } catch {
        if (cancelled) return;
        setMatches([]);
        setError(t("searchFailed"));
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // `current` changes with `index`; holder is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const link = useCallback(
    async (parentId: string) => {
      const { url, body } = parentLink(holderId, parentId, current!.kind);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await failure(res);
    },
    [holderId, current],
  );

  const linkExisting = useCallback(
    async (personId: string) => {
      setBusy(true);
      try {
        await link(personId);
        advance({ kind: current!.kind, result: "linked", personId });
      } catch (err) {
        advance({ kind: current!.kind, result: "failed", error: err instanceof Error ? err.message : String(err) });
      }
    },
    [advance, current, link],
  );

  const createNew = useCallback(async () => {
    if (!holder) return;
    setBusy(true);
    let created: string | undefined;
    try {
      const note = parentNote({ name: holder.name, code: holder.code, documentCode: holder.documentCode });
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parentPersonBody(current!, note)),
      });
      if (!res.ok) throw await failure(res);
      const body = (await res.json()) as { person?: { id?: string } };
      created = body.person?.id;
      if (!created) throw new Error(t("createFailed"));
      await link(created);
      advance({ kind: current!.kind, result: "created", personId: created });
    } catch (err) {
      // Created and not linked is still created: the outcome names the person.
      advance({
        kind: current!.kind,
        result: "failed",
        personId: created,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [advance, current, holder, link, t]);

  const skipRest = useCallback(() => {
    for (let i = index; i < parents.length; i++) {
      outcomes.current = [...outcomes.current, { kind: parents[i].kind, result: "skipped" }];
    }
    finish();
  }, [finish, index, parents]);

  if (!current) return null;

  const title = t(current.kind === "FATHER" ? "titleFather" : "titleMother");
  if (matches === null || !holder) {
    return (
      <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-lg bg-card p-6 text-center shadow-xl dark:bg-zinc-900">
          <ActivityCue progress className="text-center">{t("searching")}</ActivityCue>
        </div>
      </div>
    );
  }

  const displayName = personName(current.lastName, current.firstName);
  const noCandidate: ResolutionCandidate | null = null;
  return (
    <PersonResolutionDialog
      t={tr}
      title={title}
      subject={{
        heading: title,
        personType: "NATURAL",
        displayName,
        cnp: null,
        cuiNumber: null,
        idDocumentNumber: null,
        idIssuingAuthority: null,
        domiciliu: null,
      }}
      matchCandidate={noCandidate}
      possibleMatches={matches}
      current={index + 1}
      total={parents.length}
      busy={busy}
      forceCreate={forceCreate}
      onForceCreate={() => setForceCreate(true)}
      onConfirmMatch={(id) => void linkExisting(id)}
      onPickMatch={(id) => void linkExisting(id)}
      onCreateNew={() => void createNew()}
      onSkip={() => advance({ kind: current.kind, result: "skipped" })}
      onClose={skipRest}
    >
      <p className="mt-3 text-xs text-fade dark:text-zinc-400" data-parents-by-name>
        {t("byNameOnly")}
      </p>
      {searchedName && matches.length > 0 && (
        <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("searchedFor", { name: searchedName })}</p>
      )}
      <p className="mt-1 text-xs text-fade dark:text-zinc-400">
        {t("willLink", { holder: holder.name || t("theHolder") })}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs text-amber-700 dark:text-amber-400">{error}</p>
      )}
    </PersonResolutionDialog>
  );
}
