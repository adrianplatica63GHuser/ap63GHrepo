"use client";

/**
 * A document type's own page: General, Formular, Roluri.          (Slice #38.39)
 *
 * Document types are the richest reference data — a name, an immutable code, a
 * short label, a form, and the roles a party may hold — and they outgrew a row
 * in a list. „Date de referință → Acte → Tipuri de Document" lists them and
 * „Deschide" opens this page, `/admin/value-lists/document-types/<code>`.
 *
 * GENERAL — the name and the short name, saved through the list's own PUT
 * (`saveRow`), and the code, read-only (Ask first 1): forms-export, the AI
 * prompt, RENAMED_TABS and the tests all key on it, which is why the list's add
 * form asks for it once and never again. The status word is the list's.
 *
 * FORMULAR — the form's fields as they are, and „Editează formularul", which
 * opens today's editor (`DocumentTypeFormEditor`) with the same lock the list
 * computes: an identity-card or catch-all type may only have its form cleared.
 *
 * ROLURI — `TypeRoles`: the type's side of the pairs the role panel edits.
 *
 * ⚠️ **The rows come from `["value-list", "document-types"]`, the list's own
 * cache, as full rows** — so a save here is on the list when the user goes
 * back, and a rename on the list is here, without a second endpoint.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ClipboardList, Save } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { screenBox } from "@/lib/ui/field-widths";
import { RequestFailedError, type FailureCode } from "@/lib/admin/value-lists/failures";
import { parseTemplateFields } from "@/lib/documents/template-fields";
import { documentTypeIsIdCard } from "@/lib/import/id-card";
import { documentTypeIsCatchAll } from "@/lib/documents/document-type-match";
import { documentTypeStatus } from "@/lib/documents/status";
import {
  DOCUMENT_TYPE_TABS,
  documentTypeTabOf,
  type DocumentTypeTab,
} from "@/lib/admin/value-lists/document-type-page";
import { DocumentTypeFormEditor, type FormLock } from "./document-type-form-editor";
import { TypeRoles } from "./type-roles";
import { fetchValueListRows, type ValueListRow } from "./role-doc-types";
import { invalidateListCaches, saveRow } from "./value-list-modal";

const INPUT_CLASS =
  "rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function formLockOf(row: ValueListRow): FormLock {
  const cols = { key: String(row.key ?? ""), name: String(row.name ?? "") };
  if (documentTypeIsIdCard(cols)) return "idCard";
  if (documentTypeIsCatchAll(cols)) return "catchAll";
  return null;
}

export function DocumentTypePage({ code, initialTab }: { code: string; initialTab?: string }) {
  const t = useTranslations("valueList.typePage");
  const router = useRouter();
  const [tab, setTab] = useState<DocumentTypeTab>(documentTypeTabOf(initialTab));
  const rows = useQuery({
    queryKey: ["value-list", "document-types"],
    queryFn: () => fetchValueListRows("document-types"),
  });
  const row = rows.data?.find((r) => r.key === code);

  function choose(next: DocumentTypeTab) {
    setTab(next);
    router.replace(`/admin/value-lists/document-types/${encodeURIComponent(code)}?tab=${next}`, { scroll: false });
  }

  if (rows.isLoading) return <p className="text-sm text-fade">{t("loading")}</p>;
  if (rows.isError) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t("loadError")}</p>;
  if (!row) return <p role="alert" className="text-sm text-ink dark:text-zinc-300">{t("notFound", { code })}</p>;

  const name = String(row.name ?? "");
  return (
    <div className="flex flex-col gap-4" data-document-type-page={code}>
      <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-zinc-100">{name}</h1>
      <div role="tablist" aria-label={t("tabsLabel")} className="flex gap-1 border-b border-card-rim dark:border-zinc-800">
        {DOCUMENT_TYPE_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`type-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`type-panel-${key}`}
            onClick={() => choose(key)}
            className={[
              "-mb-px rounded-t-md border px-4 py-1.5 text-sm transition-colors",
              tab === key
                ? "border-card-rim border-b-card bg-card font-medium text-ink dark:border-zinc-700 dark:border-b-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                : "border-transparent text-fade hover:text-ink dark:text-zinc-400",
            ].join(" ")}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`type-panel-${tab}`}
        aria-labelledby={`type-tab-${tab}`}
        className="rounded-lg border border-card-rim bg-card p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Keyed on the id, not on `updatedAt`: the refetch after a save must not remount the
            tab, or „Salvat." would vanish the moment it appeared. */}
        {tab === "general" && <GeneralTab key={row.id} row={row} />}
        {tab === "form" && <FormTab row={row} />}
        {tab === "roles" && <TypeRoles typeId={row.id} typeName={name} />}
      </section>
    </div>
  );
}

function GeneralTab({ row }: { row: ValueListRow }) {
  const t = useTranslations("valueList.typePage.general");
  const tStatus = useTranslations("valueList.documentTypeStatus");
  const tErr = useTranslations("valueList.confirm.errors");
  const qc = useQueryClient();
  const [name, setName] = useState(String(row.name ?? ""));
  const [shortName, setShortName] = useState(String(row.shortName ?? ""));
  const [error, setError] = useState<{ code: FailureCode; detail?: string; collisions?: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = name !== String(row.name ?? "") || shortName !== String(row.shortName ?? "");

  const save = useMutation({
    // The same two fields the list's edit form sent, through the same PUT — the
    // code is not on the wire (`documentTypeUpdateSchema` strips it anyway).
    mutationFn: () => saveRow("document-types", row.id, { name, shortName }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      invalidateListCaches(qc, "document-types");
    },
    onError: (err: Error) => {
      setSaved(false);
      setError(err instanceof RequestFailedError ? { code: err.code, detail: err.detail, collisions: err.collisions } : { code: "generic" });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-400">
          {t("name")}
          <input {...screenBox("valueName")} type="text" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-ink dark:text-zinc-400">
          {t("shortName")}
          <input {...screenBox("valueText")} type="text" value={shortName} onChange={(e) => { setShortName(e.target.value); setSaved(false); }} className={INPUT_CLASS} />
        </label>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-fade dark:text-zinc-400">{t("code")}</dt>
        <dd className="flex flex-col gap-0.5">
          <span className="font-mono text-ink dark:text-zinc-100" data-type-code="">{String(row.key ?? "")}</span>
          <span className="text-xs text-fade dark:text-zinc-500">{t("codeNote")}</span>
        </dd>
        <dt className="text-fade dark:text-zinc-400">{t("status")}</dt>
        <dd className="text-ink dark:text-zinc-100">
          {tStatus(documentTypeStatus({ origin: row.origin as string | undefined, templateFields: row.templateFields }))}
        </dd>
      </dl>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {tErr(error.code, { code: error.detail ?? "", collisions: error.collisions ?? 0 })}
        </p>
      )}
      <div className="flex items-center gap-3">
        <IconButton icon={Save} label={t("save")} busy={save.isPending} busyLabel={t("saving")} showLabel variant="primary" size="sm" disabled={!dirty || name.trim() === "" || save.isPending} onClick={() => save.mutate()} />
        <span role="status" className="text-xs text-fade dark:text-zinc-400">{saved && !dirty ? t("saved") : ""}</span>
      </div>
    </div>
  );
}

function FormTab({ row }: { row: ValueListRow }) {
  const t = useTranslations("valueList.typePage.form");
  const tf = useTranslations("valueList.templateFields");
  const [editing, setEditing] = useState(false);
  const fields = parseTemplateFields(row.templateFields).sort((a, b) => a.order - b.order);
  const lock = formLockOf(row);
  // The list's rule (#32.19): a catch-all type with no form gets no button —
  // the only outcome would be a refusal. One that has a form keeps it, so the
  // form can be cleared.
  const canOpen = lock !== "catchAll" || fields.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fade dark:text-zinc-400">{tf("intro")}</p>
      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-wire px-4 py-6 text-center text-sm text-fade dark:border-zinc-700 dark:text-zinc-400">{t("none")}</p>
      ) : (
        <table className="w-full text-sm" aria-label={tf("tableCaption", { type: String(row.name ?? "") })}>
          <thead>
            <tr className="border-b border-card-rim text-left text-fade dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-2 py-1.5 font-semibold">{tf("colLabelRo")}</th>
              <th className="px-2 py-1.5 font-semibold">{tf("colType")}</th>
              <th className="px-2 py-1.5 font-semibold">{tf("colGroup")}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.key} className="border-b border-card-rim last:border-0 dark:border-zinc-800">
                <td className="px-2 py-1.5 text-ink dark:text-zinc-100">{f.labelRo || f.labelEn}</td>
                <td className="px-2 py-1.5 text-ink dark:text-zinc-300">{tf(`types.${f.type}`)}</td>
                <td className="px-2 py-1.5 text-fade dark:text-zinc-400">{f.groupRo || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canOpen && (
        <div>
          <IconButton icon={ClipboardList} label={t("edit", { count: fields.length })} showLabel variant="secondary" size="sm" onClick={() => setEditing(true)} />
        </div>
      )}
      {editing && (
        <DocumentTypeFormEditor
          typeId={row.id}
          typeName={String(row.name ?? "")}
          templateFields={row.templateFields}
          formLock={lock}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
