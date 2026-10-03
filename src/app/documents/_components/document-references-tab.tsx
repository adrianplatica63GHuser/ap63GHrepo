"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { ArrowLeftRight, ArrowRight, Link as LinkIcon, ListChecks, ScanText, ScrollText, Unlink } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { PressBubble } from "@/lib/ui/press-bubble";
import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { OneLineRow, OneLineRows } from "@/components/tiles/one-line-rows";
import type { RowSlot } from "@/lib/ui/field-widths";
import {
  AiReferenceLinkerDialog,
  type LinkerDocumentType,
  type LinkerItem,
} from "./ai-reference-linker-dialog";
import { newTabIfAsked, openThroughGuard } from "@/lib/ui/row-link";
import { useUnsavedChanges } from "@/components/providers/unsaved-changes-provider";
import { PreviewButton } from "@/components/tiles/preview-tiles";

/**
 * Slice #37.64: one line a row — the radio, „Etichetă scurtă (Tip)", and three
 * slots: the relationship (only on a link with a role), „Vizualizează",
 * „Previzualizare". Adrian: „The relationship should not be listed. It should be
 * a button before the view button."
 */
const SLOTS: readonly RowSlot[] = ["relation", "view", "preview"];

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

type Props = {
  documentId: string;
  /** The tile's title — the list's accessible name. */
  label: string;
};

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

export function DocumentReferencesTab({ documentId, label }: Props) {
  const t           = useTranslations("document.references");
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
  const router      = useRouter();
  // FU-271 (Slice #37.33): „Vizualizare" and a double-click leave this screen, so they ask about unsaved work first.
  const { guardedNavigate } = useUnsavedChanges();
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
  /**
   * „Înscrisuri citate" folded behind one button (#37.64), folded at first.
   * The button carries the number still waiting for an answer, so the fold
   * never hides a pending answer.
   */
  const [instrumentsOpen, setInstrumentsOpen] = useState(false);
  const instrumentsPanelId = useId();
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
      {items && items.length > 0 ? (
        <OneLineRows slots={SLOTS} label={label}>
          {items.map((item) => {
            // „Etichetă scurtă (Tip)"; with no title, the type alone — never the system ID (#37.57).
            const text = item.title
              ? (item.typeName ? `${item.title} (${item.typeName})` : item.title)
              : (item.typeName ?? nameOr(item.title, "document"));
            return (
              <OneLineRow
                key={item.id}
                selected={item.id === selectedId}
                onSelect={() => setSelectedId(item.id)}
                radioLabel={nameOr(item.title, "document")}
                title={text}
                content={
                  item.title ? (
                    <>
                      <span className="font-medium text-ink dark:text-zinc-100">{item.title}</span>
                      {item.typeName && <span className="text-fade dark:text-zinc-400"> ({item.typeName})</span>}
                    </>
                  ) : (
                    <span className="font-medium text-ink dark:text-zinc-100">{text}</span>
                  )
                }
                // Slice #37.21: Ctrl/⌘+click or a middle-click opens the record in a new tab.
                onClick={(e) => {
                  if (newTabIfAsked(e, `/documents/${encodeURIComponent(item.id)}?readonly=true`)) return;
                  setSelectedId(item.id === selectedId ? null : item.id);
                }}
                onAuxClick={(e) => newTabIfAsked(e, `/documents/${encodeURIComponent(item.id)}?readonly=true`)}
                onDoubleClick={() => guardedNavigate(`/documents/${encodeURIComponent(item.id)}?readonly=true`)}
                buttons={{
                  /*
                   * ⚠️ **THE ROLE IS SHOWN IN THE DIRECTION THE FLAG SAYS, AND THE
                   * SAME WORDS MEAN DIFFERENT THINGS EITHER WAY ROUND.** (Slice #36.03)
                   *
                   * „Titlu anterior al" between this document and that one says one
                   * thing read forwards and the opposite read backwards, and the pair
                   * order in `document_document` is by UUID. So the relationship is
                   * never the role alone — it is „acest document «rol» X" or
                   * „X «rol» acest document", a sentence that cannot be read the wrong
                   * way. Since #37.64 it is behind a button before „Vizualizează",
                   * shown on a press and gone on a click outside or Esc.
                   */
                  relation: item.relationshipRoleName ? (
                    <PressBubble
                      icon={ArrowLeftRight}
                      label={t("relationship")}
                      text={
                        item.roleReadsFromViewed
                          ? t("roleForward", { role: item.relationshipRoleName, other: nameOr(item.title, "document") })
                          : t("roleBackward", { role: item.relationshipRoleName, other: nameOr(item.title, "document") })
                      }
                    />
                  ) : undefined,
                  view: (
                    <IconButton
                      href={`/documents/${encodeURIComponent(item.id)}?readonly=true`}
                      onClick={(e) => openThroughGuard(e, `/documents/${encodeURIComponent(item.id)}?readonly=true`, guardedNavigate)}
                      icon={ArrowRight}
                      label={t("view")}
                      variant="secondary"
                      size="xs"
                    />
                  ),
                  preview: <PreviewButton target={{ kind: "document", id: item.id }} />,
                }}
              />
            );
          })}
        </OneLineRows>
      ) : (
        <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("empty")}</p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <IconButton
            icon={LinkIcon}
            label={t("associate")}
            showLabel
            variant="primary"
            size="lg"
            onClick={handleAssociate}
            disabled={selectedId !== null}
          />
          <IconButton
            icon={Unlink}
            label={t("dissociate")}
            busy={dissociating}
            busyLabel={t("dissociating")}
            showLabel
            variant="secondary"
            size="lg"
            onClick={handleDissociate}
            disabled={selectedId === null || dissociating}
          />
          {/* „Înscrisuri citate" (#37.64): the panel below, folded behind one button
              that says how many instruments wait for an answer. */}
          <IconButton
            icon={ScrollText}
            label={t("instrumentsButton")}
            showLabel
            count={pendingCount}
            note={pendingCount > 0 ? t("instrumentsPending", { count: pendingCount }) : undefined}
            variant="secondary"
            size="lg"
            aria-expanded={instrumentsOpen}
            aria-controls={instrumentsOpen ? instrumentsPanelId : undefined}
            onClick={() => setInstrumentsOpen((v) => !v)}
          />
        </div>
        {dissociateErr && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">{dissociateErr}</p>
        )}
      </div>

      {/* ── Instruments this document's pages cite (Slice #36.03) ─────────── */}
      {/* Unfolded by „Înscrisuri citate" (#37.64), and otherwise unchanged. */}
      {instrumentsOpen && (
      <div
        id={instrumentsPanelId}
        data-instruments-panel=""
        className="flex flex-col gap-2 rounded-md border border-card-rim bg-card px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
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
          {/* #37.45 (A048, A047): icon + the words; re-reading shows
              „Se citește…" with the spinner in the icon's place. */}
          <IconButton
            icon={ListChecks}
            label={t("openLinker")}
            showLabel
            variant="primary"
            size="lg"
            onClick={() => setLinkerOpen(true)}
            disabled={pendingCount === 0 || rereading}
          />
          <IconButton
            icon={ScanText}
            label={rereading ? t("rereading") : t("reread")}
            busy={rereading}
            showLabel
            variant="secondary"
            size="lg"
            onClick={handleReread}
            disabled={rereading}
          />
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
      )}

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
