"use client";

import { useNameOr } from "@/components/record/use-name-or";
import { useMemo, useState } from "react";
import { Link as LinkIcon, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { FixedColumns, TABLE_FRAME, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { AssociateRow, AssociateTile, useRecordCrumb } from "@/components/associate/associate-tiles";
import { STACKED_FIELD_CLASS, STACKED_LABEL_CLASS, STACKED_ROW_CLASS } from "@/lib/ui/stacked";
import { boxesUnits, screenBox, screenFieldStyle, tableUnits, type ColumnName } from "@/lib/ui/field-widths";

/** The results table, at #37.16's column widths (Slice #37.22). */
const COLUMNS: readonly ColumnName[] = ["select", "documentType", "documentTitle"];

/** Slice #37.34: Căutare, Rezultate and Asociere, each the fewest whole units that hold it. */
const SEARCH_UNITS = boxesUnits(["searchText"]);
const RESULTS_UNITS = tableUnits(COLUMNS);
const ASSOCIATION_UNITS = boxesUnits(["role"]);
/** The results table fills its tile; documentTitle takes what the other columns leave. */
const RESULTS_FILL = { units: RESULTS_UNITS, column: "documentTitle" } as const;

const PAGE_SIZE = 15;

type DocumentSearchItem = { id: string; code: string; typeName: string | null; title: string | null };
type SearchResponse = { items: DocumentSearchItem[]; total: number };
type RoleItem = { id: string; name: string };

type Props = { documentId: string; documentName: string };

async function searchDocuments(q: string, page: number): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(`/api/documents/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { items: data.items as DocumentSearchItem[], total: data.total as number };
}

async function fetchRelationshipRoles(): Promise<RoleItem[]> {
  const res = await fetch("/api/admin/document-document-roles");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as RoleItem[];
}

export function AssociateReferenceView({ documentId, documentName }: Props) {
  const t           = useTranslations("document.associateReference");
  const nameOr      = useNameOr(); // #37.57: a name, or words — never the system ID
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [searchInput,    setSearchInput]    = useState("");
  const [page,           setPage]           = useState(0);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [submitting,     setSubmitting]     = useState(false);
  const [submitError,    setSubmitError]    = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["document-search-ref", searchInput, page],
    queryFn:  () => searchDocuments(searchInput, page),
  });

  const { data: roles } = useQuery({
    queryKey: ["document-document-roles"],
    queryFn:  fetchRelationshipRoles,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;

  // Exclude the current document from the current page's results
  const displayList = useMemo(
    () => items.filter((item) => item.id !== documentId),
    [items, documentId],
  );

  const toggle = (id: string) => {
    if (id === documentId) return; // can't link to itself
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAssociate = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/references`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          documentIds:        Array.from(selectedIds),
          relationshipRoleId: selectedRoleId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      /*
       * ⚠️ **„SUNT DEJA ASOCIATE" IS AN ANSWER NOW, AND IT DOES NOT
       * NAVIGATE.**                                             (Slice #36.03)
       *
       * The POST used to reply 204 whether it wrote a row or hit
       * `.onConflictDoNothing()`, so a user who ticked a document that was
       * already associated — to give it a role, which is the whole reason to do
       * it twice — was returned to the tab showing the OLD role, with nothing
       * written and nothing said. The route now answers
       * `{ inserted, skipped, alreadyLinked }`.
       *
       * It stops on the sentence rather than navigating under it, for the
       * reason `ai-party-linker-dialog.tsx` gives one table over: a message
       * shown while the screen is moving is a message nobody reads. „Anulează"
       * is one click away. The sentence names the role each already-associated
       * document carries, because „change it to X" and „it is already X" are
       * different situations and only the role tells them apart.
       */
      const result = (await res.json().catch(() => null)) as {
        inserted?: number;
        alreadyLinked?: { documentId: string; roleName: string | null }[];
      } | null;
      if (result && result.inserted === 0) {
        const named = (result.alreadyLinked ?? [])
          .map((a) => {
            const doc = items.find((i) => i.id === a.documentId);
            const label = doc ? nameOr(doc.title, "document") : a.documentId;
            return a.roleName ? `${label} — „${a.roleName}"` : label;
          })
          .join("; ");
        setSubmitError(t("alreadyAssociated", { documents: named }));
        setSubmitting(false);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["document-references", documentId] });
      router.push(`/documents/${encodeURIComponent(documentId)}?tab=related`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleCancel = () =>
    router.push(`/documents/${encodeURIComponent(documentId)}?tab=related`);

  useRecordCrumb(`/documents/${encodeURIComponent(documentId)}`, documentName);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-fade dark:text-zinc-400">{documentName}</p>
      </header>

      <AssociateRow units={[SEARCH_UNITS, RESULTS_UNITS, ASSOCIATION_UNITS]}>
      <AssociateTile tile="search" units={SEARCH_UNITS}>

      <div className={STACKED_ROW_CLASS}>
        <label className={STACKED_FIELD_CLASS} style={screenFieldStyle("searchText")}>
          <span className={STACKED_LABEL_CLASS}>{t("labelSearch")}</span>
          <input {...screenBox("searchText")}
            type="text"
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(0); setSelectedIds(new Set()); }}
            placeholder={t("searchPlaceholder")}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      </AssociateTile>

      <AssociateTile tile="results" units={RESULTS_UNITS}>
      <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}>
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
        ) : isError ? (
          <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
        ) : displayList.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("resultsEmpty")}</p>
        ) : (
          <table {...fixedTable(COLUMNS, undefined, RESULTS_FILL)}>
            <FixedColumns columns={COLUMNS} fill={RESULTS_FILL} />
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="px-3 py-2" aria-label="select" {...columnHead("select")} />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("documentType")}>{t("colType")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("documentTitle")}>{t("colTitle")}</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={[
                    "cursor-pointer border-b border-card-rim last:border-0 dark:border-zinc-800",
                    selectedIds.has(item.id) ? "bg-cta-pale dark:bg-cta/10" : "hover:bg-canvas dark:hover:bg-zinc-800/50",
                  ].join(" ")}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)}
                      onClick={(e) => e.stopPropagation()} className="accent-cta" aria-label={nameOr(item.title, "document")} />
                  </td>
                  <td className="px-3 py-2 break-words text-fade dark:text-zinc-400">{item.typeName ?? "—"}</td>
                  <td className="px-3 py-2 break-words font-medium text-ink dark:text-zinc-100">{item.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaginationControls
        page={page} total={total} pageSize={PAGE_SIZE}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
      </AssociateTile>

      <AssociateTile tile="association" units={ASSOCIATION_UNITS}>

      {/* Role selector — only shown when roles are configured in Reference Data */}
      {roles && roles.length > 0 && (
        <div className={STACKED_FIELD_CLASS} style={screenFieldStyle("role")}>
          <label htmlFor="relationship-role-select" className={STACKED_LABEL_CLASS}>
            {t("labelRole")}
          </label>
          <select {...screenBox("role")}
            id="relationship-role-select"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="" data-blank="">{t("roleNone")}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {submitError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{submitError}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-crease pt-4 dark:border-zinc-800">
        <IconButton
          icon={LinkIcon}
          label={t("associate")}
          busy={submitting}
          busyLabel={t("associating")}
          showLabel
          variant="primary"
          size="lg"
          onClick={handleAssociate}
          disabled={submitting || selectedIds.size === 0}
        />
        <IconButton
          icon={X}
          label={t("cancel")}
          variant="secondary"
          size="lg"
          onClick={handleCancel}
          disabled={submitting}
        />
        {selectedIds.size === 0 && !isLoading && displayList.length > 0 && (
          <span className="text-xs text-fade dark:text-zinc-500">{t("noSelection")}</span>
        )}
      </div>
      </AssociateTile>
      </AssociateRow>
    </div>
  );
}
