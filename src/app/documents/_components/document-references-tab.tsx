"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/lib/ui/button-styles";
import {
  AiReferenceLinkerDialog,
  type LinkerDocumentType,
  type LinkerItem,
} from "./ai-reference-linker-dialog";

type AssociatedDocument = {
  id:                  string;
  code:                string;
  typeName:            string | null;
  title:               string | null;
  associatedAt:        string;
  relationshipRoleId:  string | null;
  relationshipRoleName: string | null;
  /**
   * Does the role read FROM the document being viewed TO this row?
   *                                                            (Slice #36.03)
   *
   * ⚠️ **ALREADY RESOLVED BY `listDocumentReferences`, AND THIS COMPONENT MUST
   * NOT TRY TO WORK IT OUT.** The stored `role_reads_a_to_b` is about
   * `document_id_a` and `document_id_b`, which are ordered BY UUID and mean
   * nothing at all. The query layer turns that into this, in terms of the two
   * documents a person is actually looking at; a uuid comparison in a component
   * is the defect the flag exists to close, arriving through a different door.
   */
  roleReadsFromViewed: boolean;
};

type Props = { documentId: string };

async function fetchDocumentReferences(documentId: string): Promise<AssociatedDocument[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/references`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as AssociatedDocument[];
}

type InstrumentReferencesPayload = {
  read: boolean;
  items: LinkerItem[];
  documentTypes: LinkerDocumentType[];
};

async function fetchInstrumentReferences(documentId: string): Promise<InstrumentReferencesPayload> {
  const res = await fetch(
    `/api/documents/${encodeURIComponent(documentId)}/instrument-references`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as InstrumentReferencesPayload;
}

export function DocumentReferencesTab({ documentId }: Props) {
  const t           = useTranslations("document.references");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [dissociating,  setDissociating]  = useState(false);
  const [dissociateErr, setDissociateErr] = useState<string | null>(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["document-references", documentId],
    queryFn:  () => fetchDocumentReferences(documentId),
  });

  /**
   * The instruments this document's PAGES cite — Slice #36.03.
   *
   * ⚠️ **A SECOND QUERY, NOT A SECOND TABLE.** These are not associations; they
   * are a reading of the scan that nobody has answered yet. The table above
   * shows what the archive HOLDS, and this shows what is still outstanding, so
   * mixing the two would put unconfirmed model output in a list of facts.
   */
  const { data: instruments } = useQuery({
    queryKey: ["document-instrument-references", documentId],
    queryFn:  () => fetchInstrumentReferences(documentId),
  });

  const [linkerOpen, setLinkerOpen] = useState(false);
  const [rereading, setRereading] = useState(false);
  const [rereadErr, setRereadErr] = useState<string | null>(null);

  const pendingCount =
    instruments?.items.filter((i) => i.instrument.status === "PENDING").length ?? 0;

  /**
   * Re-read THIS document's pages and store what they cite.
   *
   * ⚠️ **ONE DOCUMENT, ON DEMAND, NEVER A SWEEP — AND THE COST IS ON THE
   * BUTTON.** Every press is a billed vision call over EVERY page of this
   * document. `src/lib/rate-limit/ocr.ts` caps six Anthropic-backed routes at
   * five calls a minute for an ordinary user and twenty for a superuser, from
   * one shared bucket, so a handful of these in a row will start refusing — and
   * the refusal is reported rather than swallowed. A migration that re-read
   * three hundred documents would be a bill and an outage, which is why this is
   * a button and not a backfill.
   *
   * ⚠️ **IT ALSO RE-ASKS EVERY REFERENCE, INCLUDING SETTLED ONES**, because a
   * second read produces a fresh array and there is no identity for a citation
   * that survives between two readings of one scan — the model's wording is
   * exactly what changes. The links already written are `document_document`
   * rows and are NOT touched; what is lost is the record of which citation
   * produced them. The confirm sentence says so before anything is spent.
   */
  const handleReread = async () => {
    if (instruments?.read && !window.confirm(t("rereadConfirm"))) return;
    setRereading(true);
    setRereadErr(null);
    try {
      const read = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/ai-interpret`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      // ⚠️ Nothing from that route is shown verbatim: it serves an API and some
      // of its failures are Anthropic's own English. Every branch lands on copy
      // from this namespace, as `document-form.tsx`'s Discover handler does.
      if (!read.ok) {
        const body = (await read.json().catch(() => ({}))) as { code?: string };
        setRereadErr(
          read.status === 429 || body.code === "rate_limited_local" ? t("rereadBusy")
          : body.code === "no_pages"     ? t("rereadNoPages")
          : body.code === "no_api_key"   ? t("rereadNotConfigured")
          : t("rereadError"),
        );
        return;
      }
      const payload = (await read.json()) as { referencedInstruments?: unknown[] };
      const store = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/instrument-references`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // `?? []` on purpose: a read that found nothing must still STORE the
          // empty array, because `null` and `[]` mean different things on that
          // column — never read, against read and cited nothing — and only the
          // second one stops this button being offered again for no reason.
          body: JSON.stringify({ action: "replace", instruments: payload.referencedInstruments ?? [] }),
        },
      );
      if (!store.ok) { setRereadErr(t("rereadError")); return; }
      await queryClient.invalidateQueries({ queryKey: ["document-instrument-references", documentId] });
    } catch {
      setRereadErr(t("rereadError"));
    } finally {
      setRereading(false);
    }
  };

  const handleAssociate = () => {
    router.push(`/documents/${encodeURIComponent(documentId)}/associate-reference`);
  };

  const handleDissociate = async () => {
    if (!selectedId) return;
    setDissociating(true);
    setDissociateErr(null);
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(documentId)}/references/${encodeURIComponent(selectedId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["document-references", documentId] });
    } catch (err) {
      setDissociateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setDissociating(false);
    }
  };

  if (isLoading) return <p className="py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>;
  if (isError)   return <p className="py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {items && items.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="w-8 px-3 py-2" aria-label="select" />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colType")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colTitle")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400">{t("colRole")}</th>
                <th className="w-16 px-3 py-2" aria-label="view" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                  onDoubleClick={() => router.push(`/documents/${encodeURIComponent(item.id)}?readonly=true`)}
                  className={[
                    "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                    item.id === selectedId
                      ? "bg-cta-pale dark:bg-cta/10"
                      : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      checked={item.id === selectedId}
                      onChange={() => setSelectedId(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-cta"
                      aria-label={item.title ?? item.code}
                    />
                  </td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">{item.typeName ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-ink dark:text-zinc-100">{item.title ?? "—"}</td>
                  <td className="px-3 py-2">
                    {item.relationshipRoleName ? (
                      /*
                       * ⚠️ **THE ROLE IS RENDERED IN THE DIRECTION THE FLAG
                       * SAYS, AND THE SAME WORDS MEAN DIFFERENT THINGS EITHER
                       * WAY ROUND.**                            (Slice #36.03)
                       *
                       * „Titlu anterior al" between this document and that one
                       * says one thing read forwards and the opposite read
                       * backwards, and before this slice nothing could tell:
                       * the pair order in `document_document` is by UUID. So
                       * the chip no longer shows the role alone — it shows
                       * „acest document «rol» DOC01511" or
                       * „DOC01511 «rol» acest document", which is a sentence
                       * rather than a label and cannot be read the wrong way.
                       */
                      <span className="inline-flex items-center rounded-full bg-cta-pale px-2 py-0.5 text-xs font-medium text-cta dark:bg-cta/15 dark:text-cta-light">
                        {item.roleReadsFromViewed
                          ? t("roleForward", { role: item.relationshipRoleName, other: item.code })
                          : t("roleBackward", { role: item.relationshipRoleName, other: item.code })}
                      </span>
                    ) : (
                      <span className="text-fade dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/documents/${encodeURIComponent(item.id)}?readonly=true`);
                      }}
                      className={buttonClass({ variant: "secondary", size: "xs" })}
                    >
                      {t("view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("empty")}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAssociate}
            disabled={selectedId !== null}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("associate")}
          </button>
          <button
            type="button"
            onClick={handleDissociate}
            disabled={selectedId === null || dissociating}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {dissociating ? t("dissociating") : t("dissociate")}
          </button>
        </div>
        {dissociateErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{dissociateErr}</p>
        )}
      </div>

      {/* ── Instruments this document's pages cite (Slice #36.03) ─────────── */}
      <div className="flex flex-col gap-2 rounded-md border border-card-rim bg-card px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-ink dark:text-zinc-100">{t("instrumentsTitle")}</p>
        <p className="text-xs text-fade dark:text-zinc-400">
          {/*
            Three states and three sentences, because they are three different
            facts and one of them is not a problem:
              never read   — the column is NULL; every document imported before
                             this slice, and the only one that offers a read
                             with nothing else to say;
              read, none   — the column is []; a carte de identitate cites
                             nothing and that is the correct answer, not a
                             failure, so nothing here suggests reading again;
              read, N left — the work this screen exists for.
          */}
          {!instruments?.read
            ? t("instrumentsNeverRead")
            : pendingCount === 0
              ? t("instrumentsAllAnswered", { total: instruments.items.length })
              : t("instrumentsPending", { count: pendingCount })}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLinkerOpen(true)}
            disabled={pendingCount === 0 || rereading}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("openLinker")}
          </button>
          <button
            type="button"
            onClick={handleReread}
            disabled={rereading}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {rereading ? t("rereading") : t("reread")}
          </button>
        </div>
        {/*
          The cost, where the button is, rather than in a hint nobody opens.
          Every press is a billed vision call over every page, and the shared
          per-minute allowance is what makes a run of them start refusing.
        */}
        <p className="text-xs text-fade dark:text-zinc-400">{t("rereadCost")}</p>
        {rereadErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{rereadErr}</p>
        )}
      </div>

      {linkerOpen && instruments && (
        <AiReferenceLinkerDialog
          documentId={documentId}
          items={instruments.items}
          documentTypes={instruments.documentTypes}
          onClose={async () => {
            setLinkerOpen(false);
            // Both lists change: the linker writes document_document rows AND
            // moves stored references off PENDING.
            await queryClient.invalidateQueries({ queryKey: ["document-references", documentId] });
            await queryClient.invalidateQueries({ queryKey: ["document-instrument-references", documentId] });
          }}
        />
      )}
    </div>
  );
}
