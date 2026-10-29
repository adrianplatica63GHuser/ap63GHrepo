"use client";

/**
 * The document's issuer: the list, the search and the AI's proposal.                     (Slice #39.72)
 *
 * The field itself is the form's own select (`document-form.tsx`, „Emitent” / „Notariat” / „Instanță / Autoritate” …
 * by type). This module gives it three things:
 *   - `useIssuerOptions` — the juridical persons of a public-body type, and the label of a value the list does not
 *     hold (an issuer picked by search, or one an older version names), so a value is never blank on screen;
 *   - `IssuerSearchDialog` — every juridical person, by name, nickname, code or CUI (Ask first 2);
 *   - `IssuerProposal` — what the AI read off the pages, offered and never applied (D-12): „Folosește «…»” when an
 *     existing person matches, „Adaugă «…»” to make a new juridical person — typed by its name, with provenance
 *     „Interpretat AI” — and, once made, a link to it, where „Completează din ANAF” fills it from its CIF.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Plus, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import {
  issuerSelectOptions,
  matchIssuer,
  publicBodyTypeIdFor,
  type IssuerOption,
  type PublicBodyType,
} from "@/lib/documents/issuer";
import { IconButton } from "@/lib/ui/icon-button";

type IssuersResponse = { items: IssuerOption[]; publicBodyTypes: PublicBodyType[] };

async function fetchIssuers(q: string): Promise<IssuersResponse> {
  const res = await fetch(`/api/documents/issuers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  if (res.redirected || !res.ok) throw new Error(`Failed to load issuers (HTTP ${res.status})`);
  return (await res.json()) as IssuersResponse;
}

async function fetchPersonName(id: string): Promise<string | null> {
  const res = await fetch(`/api/judicial-persons/${id}`);
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { person?: { displayName?: string } } | null;
  return body?.person?.displayName ?? null;
}

export const ISSUERS_QUERY_KEY = ["document-issuers"] as const;

/**
 * The select's options and what the proposal needs. `value` is the form's current issuer (the document's, or the
 * one an older version names); `known` are names already in hand — the document's issuer, persons picked by search.
 */
export function useIssuerOptions(value: string, known: readonly { id: string; displayName: string }[]) {
  const { data, isError } = useQuery({
    // A literal, not ISSUERS_QUERY_KEY: value-list-dependents.test.ts finds the consumer of the bare key the
    // Reference Data modal invalidates (a judicial-person type's „Autoritate publică” tick) by this shape.
    queryKey: ["document-issuers"],
    queryFn: () => fetchIssuers(""),
    staleTime: 5 * 60 * 1000,
  });
  const listed = useMemo(() => data?.items ?? [], [data]);
  const unlisted = value !== "" && !listed.some((o) => o.id === value) && !known.some((k) => k.id === value);
  const { data: valueName } = useQuery({
    queryKey: ["document-issuer-name", value],
    queryFn: () => fetchPersonName(value),
    enabled: unlisted && data !== undefined,
    staleTime: 5 * 60 * 1000,
  });
  const extra = useMemo(
    () => [...known, ...(unlisted && valueName ? [{ id: value, displayName: valueName }] : [])],
    [known, unlisted, value, valueName],
  );
  const options = useMemo(() => [{ value: "", label: "—" }, ...issuerSelectOptions(listed, extra)], [listed, extra]);
  return { options, listed, publicBodyTypes: data?.publicBodyTypes ?? [], failed: isError };
}

// ── The search ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function IssuerSearchDialog({
  onPick,
  onClose,
}: {
  onPick: (person: { id: string; displayName: string }) => void;
  onClose: () => void;
}) {
  const t = useTranslations("document.issuer");
  const titleId = useId();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["document-issuer-search", q],
    queryFn: () => fetchIssuers(q),
    enabled: q.length > 0,
    staleTime: 30_000,
  });
  const items = data?.items ?? [];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      data-issuer-search=""
    >
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-lg bg-card p-5 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-base font-semibold text-ink dark:text-zinc-100">
            {t("searchTitle")}
          </h3>
          <IconButton icon={X} label={t("close")} variant="ghost" size="sm" onClick={onClose} />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink dark:text-zinc-300">{t("searchLabel")}</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            autoFocus
          />
        </label>
        <div className="max-h-80 overflow-y-auto rounded-md border border-card-rim bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {q.length === 0 ? (
            <p className="px-4 py-5 text-sm text-fade dark:text-zinc-400">{t("searchPrompt")}</p>
          ) : isLoading ? (
            <p className="px-4 py-5 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
          ) : isError ? (
            <p className="px-4 py-5 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-fade dark:text-zinc-400">{t("searchEmpty")}</p>
          ) : (
            <ul>
              {items.map((o) => (
                <li key={o.id} className="border-b border-card-rim last:border-0 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => onPick({ id: o.id, displayName: o.displayName })}
                    className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-canvas dark:hover:bg-zinc-800/50"
                    data-issuer-result={o.code}
                  >
                    {o.displayName}
                    <span className="text-xs text-fade dark:text-zinc-400">
                      {o.code}
                      {o.typeName ? ` · ${o.typeName}` : ""}
                      {o.cuiNumber ? ` · CUI ${o.cuiNumber}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── The AI's proposal ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What the AI read as the issuer, offered while the document has none (D-12). Nothing here writes the document: a
 * choice goes into the form, and the person saves it like any field. Only „Adaugă” writes, and only a juridical
 * person — through the ordinary create route, so the import's new body is made exactly as the form makes one.
 */
export function IssuerProposal({
  read,
  listed,
  publicBodyTypes,
  disabled,
  onPick,
}: {
  read: string;
  listed: readonly IssuerOption[];
  publicBodyTypes: readonly PublicBodyType[];
  disabled?: boolean;
  onPick: (person: { id: string; displayName: string }) => void;
}) {
  const t = useTranslations("document.issuer");
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ id: string; displayName: string } | null>(null);
  const matchedId = matchIssuer(read, listed);
  const matched = matchedId ? listed.find((o) => o.id === matchedId) ?? null : null;

  const add = async () => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/judicial-persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: read.trim(),
          judicialPersonTypeId: publicBodyTypeIdFor(read, publicBodyTypes),
          provenance: "AI_INTERPRETED",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { person: { id: string; displayName: string } };
      const person = { id: body.person.id, displayName: body.person.displayName };
      await queryClient.invalidateQueries({ queryKey: ISSUERS_QUERY_KEY });
      setMade(person);
      onPick(person);
    } catch {
      setError(t("addError"));
    } finally {
      setAdding(false);
    }
  };

  if (made) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fade dark:text-zinc-400" data-issuer-made="">
        {t("made", { name: made.displayName })}
        <IconButton
          icon={ExternalLink}
          label={t("openToFill")}
          variant="ghost"
          size="xs"
          href={`/judicial-persons/${made.id}`}
          target="_blank"
        />
      </p>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-1 text-xs text-fade dark:text-zinc-400" data-issuer-proposal="">
      <span>{t("read", { text: read })}</span>
      <span className="flex flex-wrap items-center gap-2">
        {matched ? (
          <IconButton
            icon={Check}
            label={t("use", { name: matched.displayName })}
            variant="secondary"
            size="xs"
            disabled={disabled}
            onClick={() => onPick({ id: matched.id, displayName: matched.displayName })}
          />
        ) : (
          <IconButton
            icon={Plus}
            label={t("add", { name: read.trim() })}
            variant="secondary"
            size="xs"
            disabled={disabled || adding}
            busy={adding}
            busyLabel={t("adding")}
            onClick={() => void add()}
          />
        )}
      </span>
      {error ? <span className="text-red-600 dark:text-red-400">{error}</span> : null}
    </div>
  );
}

/** The search button beside the select. */
export function IssuerSearchButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useTranslations("document.issuer");
  return <IconButton icon={Search} label={t("search")} variant="ghost" size="sm" onClick={onClick} disabled={disabled} />;
}
