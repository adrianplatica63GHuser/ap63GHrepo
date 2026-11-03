"use client";

/**
 * An act adițional's „Actul modificat" — the deed it amends.  (Slice #38.34)
 *
 * The link is the Document → Document relation „Act adițional la", read from
 * the act adițional to its deed (`@/lib/documents/parent-deed`). With a link the
 * deed is shown — its title, type, number and date — with „Deschide" and
 * „Dezleagă". Without one, „Leagă actul modificat" searches the archive,
 * contracts de vânzare first, and the form shows the template group „Actul
 * modificat" under a line saying the deed is not in the archive. Linking never
 * clears those four fields; the form only hides them while a link stands.
 *
 * It reads the same query as „Legături"'s documents
 * (`["document-references", id]`), so a link made or removed in either place
 * shows in both. A second link is refused by the route (Ask first 3); the
 * sentence here names the deed the act already has.
 *
 * Inside the document's <form>: every button is `type="button"`, and Enter in
 * the search box does not submit the form.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ExternalLink, Link as LinkIcon, Search, Unlink } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { screenBox } from "@/lib/ui/field-widths";
import { useNameOr } from "@/components/record/use-name-or";
import {
  PARENT_SEVERAL_CODE,
  PARENT_TAKEN_CODE,
  orderDeedCandidates,
  parentDeedOf,
} from "@/lib/documents/parent-deed";
import { PURPOSE_ROLE_NAME } from "@/lib/documents/referenced-instruments";
import { foldLookupName } from "@/lib/import/lookup-name-match";

/** A link as `/api/documents/[id]/references` lists it — the shape „Legături" caches too. */
export type ReferenceItem = {
  id: string;
  code: string;
  typeName: string | null;
  title: string | null;
  nrDocument?: string | null;
  dateDocument?: string | null;
  relationshipRoleId: string | null;
  relationshipRoleName: string | null;
  roleReadsFromViewed: boolean;
};

type Candidate = { id: string; code: string; typeName: string | null; typeKey: string | null; title: string | null };

async function fetchReferences(documentId: string): Promise<ReferenceItem[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/references`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { items: ReferenceItem[] }).items;
}

/** The deed an act adițional amends, from the cache „Legături" shares — `undefined` while loading. */
export function useParentDeed(documentId: string | undefined): ReferenceItem | null | undefined {
  const { data } = useQuery({
    queryKey: ["document-references", documentId],
    queryFn: () => fetchReferences(documentId as string),
    enabled: !!documentId,
  });
  if (!documentId) return null;
  return data === undefined ? undefined : parentDeedOf(data);
}

async function searchCandidates(q: string): Promise<Candidate[]> {
  const params = new URLSearchParams({ q, limit: "20", offset: "0" });
  const res = await fetch(`/api/documents/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { items: Candidate[] }).items;
}

async function parentRoleId(): Promise<string | null> {
  const res = await fetch("/api/admin/document-document-roles");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = ((await res.json()) as { items: { id: string; name: string }[] }).items;
  const wanted = foldLookupName(PURPOSE_ROLE_NAME.PARENT);
  return items.find((r) => foldLookupName(r.name) === wanted)?.id ?? null;
}

/**
 * Slice 41.54: „Fă curentă" on a version that amended another deed than the act does now — unlink the one it has,
 * link the one the version had. „gone" when that deed no longer exists, „taken" when it cannot be linked (the route's
 * 409), „ok" otherwise. Each step makes the act a version of its own (queries.ts → recordParentDeedChange).
 */
export async function relinkParentDeed(
  documentId: string,
  from: string | null,
  to: string | null,
): Promise<"ok" | "gone" | "taken" | "error"> {
  if (from === to) return "ok";
  if (from) {
    const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/references/${encodeURIComponent(from)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) return "error";
  }
  if (!to) return "ok";
  const exists = await fetch(`/api/documents/${encodeURIComponent(to)}`);
  if (exists.status === 404) return "gone";
  const roleId = await parentRoleId();
  if (roleId === null) return "error";
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/references`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentIds: [to], relationshipRoleId: roleId }),
  });
  if (res.status === 409) return "taken";
  return res.ok ? "ok" : "error";
}

/** Slice 41.54: a document's title by its id, for an older version's deed. */
async function fetchTitle(id: string): Promise<string | null> {
  const res = await fetch(`/api/documents/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { title?: string | null }).title ?? null;
}

/**
 * Slice 41.54: an older version's „Actul modificat" — that version's deed, read-only, by name (or „—"). `deedId` is
 * `deedOfVersion`'s answer (parent-deed-versions.ts).
 */
function VersionDeed({ deedId }: { deedId: string | null }) {
  const nameOr = useNameOr();
  const title = useQuery({ queryKey: ["document-title", deedId], queryFn: () => fetchTitle(deedId as string), enabled: !!deedId });
  return (
    <div className="flex flex-col gap-2 text-sm" data-amended-deed="version" data-version-deed={deedId ?? ""}>
      <p className="font-medium text-ink dark:text-zinc-100">{deedId ? (title.isPending ? "…" : nameOr(title.data, "document")) : "—"}</p>
    </div>
  );
}

export function AmendedDeedLink({
  documentId,
  readOnly,
  versionDeedId,
}: {
  documentId: string | undefined;
  readOnly: boolean;
  /** Slice 41.54: on an older version, the deed that version amended (null: none); undefined on the latest. */
  versionDeedId?: string | null;
}) {
  if (versionDeedId !== undefined) return <VersionDeed deedId={versionDeedId} />;
  return <AmendedDeedLinkLatest documentId={documentId} readOnly={readOnly} />;
}

function AmendedDeedLinkLatest({ documentId, readOnly }: { documentId: string | undefined; readOnly: boolean }) {
  const t = useTranslations("document.amended");
  const nameOr = useNameOr();
  const queryClient = useQueryClient();
  const parent = useParentDeed(documentId);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const term = q.trim();
  const results = useQuery({
    queryKey: ["amended-deed-search", documentId, term],
    queryFn: () => searchCandidates(term),
    enabled: searching && term.length >= 2,
  });

  // Slice 41.54: a link made or removed is a new version of the act — the page bar's counter reads it at once.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["document-references", documentId] }),
      queryClient.invalidateQueries({ queryKey: ["document-versions", documentId] }),
    ]);

  const link = async (candidate: Candidate) => {
    if (!documentId) return;
    setBusy(true);
    setError(null);
    try {
      const roleId = await parentRoleId();
      if (roleId === null) {
        setError(t("noRole"));
        return;
      }
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: [candidate.id], relationshipRoleId: roleId }),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; existing?: { title: string | null } };
        if (body.code === PARENT_TAKEN_CODE) setError(t("taken", { document: nameOr(body.existing?.title, "document") }));
        else if (body.code === PARENT_SEVERAL_CODE) setError(t("several"));
        else setError(t("error"));
        return;
      }
      if (!res.ok) {
        setError(t("error"));
        return;
      }
      setSearching(false);
      setQ("");
      await refresh();
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!documentId || !parent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/references/${encodeURIComponent(parent.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 404) setError(t("error"));
      await refresh();
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  };

  const candidates = orderDeedCandidates(results.data ?? [], documentId ?? "");

  return (
    <div data-amended-deed={parent ? "linked" : "none"} className="flex flex-col gap-2 text-sm">
      {parent ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-wire px-3 py-2 dark:border-zinc-600" data-parent-deed>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink dark:text-zinc-100" title={nameOr(parent.title, "document")}>
              {nameOr(parent.title, "document")}
            </p>
            <p className="text-xs text-fade dark:text-zinc-400">
              {[parent.typeName, parent.nrDocument ? t("number", { nr: parent.nrDocument }) : null, parent.dateDocument ? t("date", { date: parent.dateDocument }) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <IconButton icon={ExternalLink} label={t("open")} variant="secondary" size="sm" href={`/documents/${encodeURIComponent(parent.id)}`} />
          {!readOnly && (
            <IconButton type="button" icon={Unlink} label={t("unlink")} variant="secondary" size="sm" busy={busy} onClick={unlink} />
          )}
        </div>
      ) : !documentId ? (
        <p className="text-fade dark:text-zinc-400">{t("saveFirst")}</p>
      ) : readOnly ? null : (
        <div className="flex flex-col gap-2">
          {!searching ? (
            <div>
              <IconButton type="button" icon={LinkIcon} label={t("link")} variant="primary" size="sm" onClick={() => setSearching(true)} />
            </div>
          ) : (
            <div className="flex flex-col gap-2" data-parent-search>
              <label className="flex items-center gap-2">
                <Search aria-hidden="true" className="size-4 text-fade" />
                <input
                  {...screenBox("searchText")}
                  type="search"
                  aria-label={t("searchLabel")}
                  placeholder={t("searchPlaceholder")}
                  value={q}
                  autoFocus
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                    if (e.key === "Escape") setSearching(false);
                  }}
                  className="rounded-md border border-wire bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              {term.length >= 2 && (
                <ul className="flex flex-col divide-y divide-wire rounded-md border border-wire dark:divide-zinc-700 dark:border-zinc-600" aria-label={t("results")}>
                  {results.isLoading ? (
                    <li className="px-3 py-2 text-fade">{t("searching")}</li>
                  ) : candidates.length === 0 ? (
                    <li className="px-3 py-2 text-fade">{t("noResults")}</li>
                  ) : (
                    candidates.slice(0, 8).map((c) => (
                      <li key={c.id} className="flex items-center gap-2 px-3 py-1.5" data-parent-candidate={c.typeKey ?? ""}>
                        <span className="min-w-0 flex-1 truncate" title={nameOr(c.title, "document")}>
                          {nameOr(c.title, "document")}
                          {c.typeName && <span className="text-fade dark:text-zinc-400"> ({c.typeName})</span>}
                        </span>
                        <IconButton type="button" icon={LinkIcon} label={t("linkThis", { document: nameOr(c.title, "document") })} variant="secondary" size="sm" disabled={busy} onClick={() => void link(c)} />
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {parent === null && <p className="text-fade dark:text-zinc-400" data-not-in-archive>{t("notInArchive")}</p>}
    </div>
  );
}
