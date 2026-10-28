"use client";

/**
 * „Schimbă tipul…" — a saved document's type, changed only as a deliberate correction.               (Slice 40.92)
 *
 * Adrian, 2026-10-28: „why am I able to change the document type; It doesn't make any sense". The type stays
 * changeable — it is how a misclassified document (filed as „Contract" when it is a sale deed, from the import, the
 * AI read or a hurried entry) is fixed without deleting it and losing its versions, its links and its pages — but
 * no longer through a live dropdown. In edit mode „Tip document" reads as text with this icon beside it; the dialog
 * it opens names, once a type is picked and before anything changes, what the new type drops:
 *
 *   - each form field of the old type that holds a value, by its label (`customFieldsDroppedByType` — the save's
 *     own filter);
 *   - each identity field that would be removed — or, when the change is to an ordinary type while identity values
 *     are held, why it is refused, and then there is no „Confirmă" (Ask first 3);
 *   - each linked party whose role the new type does not allow. A save does not re-check those links, so they are
 *     named and stay linked as they are (Ask first 4).
 *
 * „Confirmă" changes the type in the open form, exactly as picking it in the dropdown did: the form redraws for the
 * new type and nothing is written until the tile's own „Salvează" (Ask first 5). A new document keeps the plain
 * dropdown; the read view shows the type as text, as before.
 *
 * Portalled to <body>: the overlay is then outside the tile, so a press on it never starts a tile drag
 * (`isDragSurface` tests `box.contains`), and its Escape is caught in the capture phase before the tile's own.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeftRight } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { buttonClass } from "@/lib/ui/button-styles";
import { tabTrapMove } from "@/lib/ui/dialog-focus";
import { FIELD_BOX, fieldBorder } from "@/lib/ui/field-box";
import type { StrandedParty } from "@/lib/documents/type-change";

/** What a change to one type drops, resolved to the words the dialog shows. */
export type TypeChangeDrops = {
  /** The old type's form fields that hold a value, by label. */
  fields: string[];
  /** The identity notice: refused while values are held, or the identity fields removed, by label. */
  identity: { kind: "held" } | { kind: "removes"; fields: string[] } | null;
};

type TypeOption = { value: string; label: string; title?: string };

async function fetchStrandedParties(documentId: string, to: string): Promise<StrandedParty[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/type-change?to=${encodeURIComponent(to)}`);
  // A redirect is an expired session (#34.04): its HTML is not an empty answer.
  if (res.redirected || !res.ok) throw new Error(`Failed to read the parties (HTTP ${res.status})`);
  const body = (await res.json()) as { parties?: StrandedParty[] };
  return body.parties ?? [];
}

/** The icon beside the type's text, and the dialog it opens. */
export function DocumentTypeChange({
  documentId,
  options,
  currentTypeId,
  dropsFor,
  onConfirm,
}: {
  documentId: string;
  /** The type dropdown's own options, „(F)" and its hover words included. */
  options: TypeOption[];
  currentTypeId: string;
  dropsFor: (typeId: string) => TypeChangeDrops;
  onConfirm: (typeId: string) => void;
}) {
  const t = useTranslations("document.typeChange");
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        icon={ArrowLeftRight}
        label={t("action")}
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        data-type-change-open=""
      />
      {open && (
        <DocumentTypeChangeDialog
          documentId={documentId}
          options={options.filter((o) => o.value !== currentTypeId)}
          dropsFor={dropsFor}
          onConfirm={(typeId) => {
            onConfirm(typeId);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DocumentTypeChangeDialog({
  documentId,
  options,
  dropsFor,
  onConfirm,
  onCancel,
}: {
  documentId: string;
  options: TypeOption[];
  dropsFor: (typeId: string) => TypeChangeDrops;
  onConfirm: (typeId: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("document.typeChange");
  const [picked, setPicked] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const selectId = useId();

  const parties = useQuery({
    queryKey: ["document-type-change", documentId, picked],
    queryFn: () => fetchStrandedParties(documentId, picked),
    enabled: picked !== "",
    staleTime: 0,
    retry: false,
  });

  // Focus the picker on open; hand focus back to the icon on close (the opener may be gone after a confirm).
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    selectRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const cancel = useCallback(() => onCancel(), [onCancel]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Consumed here, so the open tile's own Escape (which discards its edits) never sees it.
        e.stopPropagation();
        e.preventDefault();
        cancel();
        return;
      }
      if (e.key !== "Tab") return;
      const move = tabTrapMove(panelRef.current, document.activeElement, e.shiftKey);
      if (move.preventDefault) e.preventDefault();
      move.focus?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [cancel]);

  const drops = picked !== "" ? dropsFor(picked) : null;
  const held = drops?.identity?.kind === "held";
  const identityFields = drops?.identity?.kind === "removes" ? drops.identity.fields : [];
  const stranded = parties.data ?? [];
  const nothing = drops !== null && !held && drops.fields.length === 0 && identityFields.length === 0
    && parties.isSuccess && stranded.length === 0;

  const dialog = (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-type-change-dialog=""
      className="fixed inset-0 z-60 flex items-center justify-center bg-scrim/40 p-4 outline-none"
    >
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
        <h3 id={titleId} className="text-base font-semibold text-ink">
          {t("title")}
        </h3>
        <p className="mt-2 text-sm text-fade">{t("intro")}</p>

        <label htmlFor={selectId} className="mt-4 block text-xs font-medium text-fade">
          {t("newType")}
        </label>
        <select
          ref={selectRef}
          id={selectId}
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className={`mt-1 w-full ${FIELD_BOX} ${fieldBorder(false)}`}
          data-type-change-select=""
        >
          <option value="" disabled>
            {t("choose")}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value} title={o.title} aria-label={o.title}>
              {o.label}
            </option>
          ))}
        </select>

        {drops !== null && (
          <div className="mt-4 space-y-3 text-sm" aria-live="polite" data-type-change-drops="">
            {held ? (
              <p className="text-alert" data-type-change-held="">
                {t("held")}
              </p>
            ) : (
              <>
                {drops.fields.length > 0 && (
                  <DropList title={t("dropsFields")} items={drops.fields} kind="fields" />
                )}
                {identityFields.length > 0 && (
                  <DropList title={t("dropsIdentity")} items={identityFields} kind="identity" />
                )}
              </>
            )}
            {parties.isPending && <p className="text-fade">{t("partiesLoading")}</p>}
            {parties.isError && <p className="text-warning">{t("partiesError")}</p>}
            {stranded.length > 0 && (
              <DropList
                title={t("partiesKept")}
                items={stranded.map((p) => t("party", { name: p.displayName, code: p.code, role: p.roleName }))}
                kind="parties"
              />
            )}
            {nothing && (
              <p className="text-fade" data-type-change-nothing="">
                {t("dropsNothing")}
              </p>
            )}
            {!held && <p className="text-xs text-fade">{t("savedOnSave")}</p>}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={cancel} className={buttonClass({ variant: "secondary", size: "lg" })}>
            {t("cancel")}
          </button>
          {!held && (
            <button
              type="button"
              onClick={() => onConfirm(picked)}
              disabled={picked === ""}
              className={buttonClass({ variant: "primary", size: "lg" })}
            >
              {t("confirm")}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(dialog, document.body);
}

function DropList({ title, items, kind }: { title: string; items: string[]; kind: "fields" | "identity" | "parties" }) {
  return (
    <div data-type-change-list={kind}>
      <p className="font-medium text-ink">{title}</p>
      <ul className="mt-1 list-disc pl-5 text-ink">
        {items.map((item, i) => (
          <li key={`${i}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
