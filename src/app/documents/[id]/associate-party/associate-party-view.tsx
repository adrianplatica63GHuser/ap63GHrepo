"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";
import { NoRolesForTypeNote } from "@/components/forms/no-roles-for-type-note";
import { associationFailureMessage } from "@/lib/ui/association-failure";
import { lookupListState, useRoleOptionsWithCarried } from "@/hooks/use-lookup-options";
import { FixedColumns, TABLE_FRAME, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { AssociateRow, AssociateTile, useRecordCrumb } from "@/components/associate/associate-tiles";
import { STACKED_FIELD_CLASS, STACKED_LABEL_CLASS, STACKED_ROW_CLASS } from "@/lib/ui/stacked";
import { boxesUnits, screenBox, screenFieldStyle, tableUnits, type ColumnName } from "@/lib/ui/field-widths";

/** The results table, at #37.16's column widths (Slice #37.22). */
const COLUMNS: readonly ColumnName[] = ["select", "personName", "personType"];

/** Slice #37.34: Căutare, Rezultate and Asociere, each the fewest whole units that hold it. */
const SEARCH_UNITS = boxesUnits(["searchName", "searchCode"]);
const RESULTS_UNITS = tableUnits(COLUMNS);
const ASSOCIATION_UNITS = boxesUnits(["role"]);
/** The results table fills its tile; personName takes what the other columns leave. */
const RESULTS_FILL = { units: RESULTS_UNITS, column: "personName" } as const;

const PAGE_SIZE = 15;

type PersonSearchItem = {
  id:          string;
  code:        string;
  type:        "NATURAL" | "JUDICIAL";
  displayName: string;
};

type SearchResponse = { items: PersonSearchItem[]; total: number };
type RoleItem = { id: string; name: string };

type Props = {
  documentId:   string;
  documentName: string;
  /** May THIS reader configure roles — passed to `NoRolesForTypeNote`, as on „Asociază persoană". */
  canConfigureRoles: boolean;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function searchPersons(name: string, code: string, page: number): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim());
  if (code.trim()) params.set("code", code.trim());
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));
  const res = await fetch(`/api/people/search?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { items: data.items as PersonSearchItem[], total: data.total as number };
}

/** The roles this certificate's type offers — the endpoint „Asociază persoană" reads. */
async function fetchValidRoles(documentId: string): Promise<RoleItem[]> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/valid-person-roles`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items as RoleItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssociatePartyView({ documentId, documentName, canConfigureRoles }: Props) {
  const t           = useTranslations("document.associateParty");
  // One sentence shared by every screen that hands out a role (Slice #34.15).
  const tShared     = useTranslations("shared");
  // Borrowed from the Persons tab — one sentence, one place.
  const tCota       = useTranslations("document.persons");
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [nameInput,   setNameInput]   = useState("");
  const [codeInput,   setCodeInput]   = useState("");
  const [page,        setPage]        = useState(0);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  /*
   * Slice #38.38: the party's ROLE. It was a quality — two buttons, „Defunct"
   * and „Moștenitor" — written to a column of its own; both are roles on the
   * certificate now, so this is the type's role list, as on „Asociază
   * persoană", and one must be chosen: a certificate party is the deceased, an
   * heir, or one of the other roles the type offers, never nobody.
   */
  const [roleId,      setRoleId]      = useState<string>("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["person-search-party", nameInput, codeInput, page],
    queryFn:  () => searchPersons(nameInput, codeInput, page),
  });

  const {
    data: roles,
    isPending: rolesPending,
    isLoadingError: rolesLoadingError,
    fetchStatus: rolesFetchStatus,
  } = useQuery({
    queryKey: ["document-valid-roles", documentId],
    queryFn:  () => fetchValidRoles(documentId),
  });
  const roleListState = lookupListState(rolesPending, rolesLoadingError, rolesFetchStatus);
  // Plus any role this certificate's rows already carry that the type no longer
  // offers, struck out (Slice #34.05) — the same picker every role screen uses.
  const pickerOptions = useRoleOptionsWithCarried(
    (roles ?? []).map((r) => ({ value: r.id, label: r.name })),
    "document-person",
    documentId,
    roles !== undefined,
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const canConfirm = selectedId !== null && roleId !== "" && !submitting;

  const handleConfirm = async () => {
    if (!selectedId || !roleId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/persons`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ personIds: [selectedId], personRoleId: roleId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // A role withdrawn after this screen loaded, or a certificate deleted
        // meanwhile — the two refusals „Asociază persoană" answers in Romanian.
        throw new Error(
          associationFailureMessage(body, res.status, tShared("roleNotOffered"), tShared("documentNotFound")),
        );
      }
      /*
       * „Nothing was added" reaches this screen too (#36.02): the person is
       * already on this certificate IN THIS ROLE. Since Slice #38.38 the role
       * is part of the key, so the same person as „Defunct" and then as
       * „Moștenitor" would be two rows — the screen does not stop that, any
       * more than „Asociază persoană" stops a seller who is also a mandatar.
       */
      const result = (await res.json().catch(() => null)) as { inserted?: number } | null;
      if (result && result.inserted === 0) {
        setSubmitError(tCota("alreadyAttached"));
        setSubmitting(false);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["document-persons", documentId] });
      router.push(`/documents/${encodeURIComponent(documentId)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const handleCancel = () =>
    router.push(`/documents/${encodeURIComponent(documentId)}`);

  useRecordCrumb(`/documents/${encodeURIComponent(documentId)}`, documentName);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-fade dark:text-zinc-400">{documentName}</p>
      </header>

      <AssociateRow units={[SEARCH_UNITS, RESULTS_UNITS, ASSOCIATION_UNITS]}>
      <AssociateTile tile="search" units={SEARCH_UNITS}>

      {/* ── Search filters ──────────────────────────────────────────────── */}
      <div className={STACKED_ROW_CLASS}>
        <label className={STACKED_FIELD_CLASS} style={screenFieldStyle("searchName")}>
          <span className={STACKED_LABEL_CLASS}>{t("labelName")}</span>
          <input {...screenBox("searchName")}
            type="text"
            value={nameInput}
            onChange={(e) => { setNameInput(e.target.value); setPage(0); setSelectedId(null); }}
            placeholder={t("namePlaceholder")}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className={STACKED_FIELD_CLASS} style={screenFieldStyle("searchCode")}>
          <span className={STACKED_LABEL_CLASS}>{t("labelCode")}</span>
          <input {...screenBox("searchCode")}
            type="text"
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value); setPage(0); setSelectedId(null); }}
            placeholder={t("codePlaceholder")}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      {/* ── Person list — single-select ─────────────────────────────────── */}
      </AssociateTile>

      <AssociateTile tile="results" units={RESULTS_UNITS}>
      <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}>
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("loading")}</p>
        ) : isError ? (
          <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">{t("error")}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-fade dark:text-zinc-400">{t("resultsEmpty")}</p>
        ) : (
          <table {...fixedTable(COLUMNS, undefined, RESULTS_FILL)}>
            <FixedColumns columns={COLUMNS} fill={RESULTS_FILL} />
            <thead>
              <tr className="border-b border-card-rim dark:border-zinc-800">
                <th className="px-3 py-2" aria-label="select" {...columnHead("select")} />
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("personName")}>{t("colName")}</th>
                <th className="px-3 py-2 text-left font-semibold text-fade dark:text-zinc-400" {...columnHead("personType")}>{t("colType")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
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
                      name="selected-party"
                      checked={item.id === selectedId}
                      onChange={() => setSelectedId(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-cta"
                      aria-label={item.displayName}
                    />
                  </td>
                  <td className="px-3 py-2 break-words font-medium text-ink dark:text-zinc-100">{item.displayName}</td>
                  <td className="px-3 py-2 text-fade dark:text-zinc-400">
                    {item.type === "NATURAL" ? t("typeNatural") : t("typeJudicial")}
                  </td>
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

      {/* ── Role: the certificate type's roles (Slice #38.38) ───────────────── */}
      {pickerOptions.length > 0 && (
        <label className={STACKED_FIELD_CLASS} style={screenFieldStyle("role")}>
          <span className={STACKED_LABEL_CLASS}>{t("labelRole")}</span>
          <select {...screenBox("role")}
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="rounded-md border border-wire bg-white px-2 py-1 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="" data-blank="">{t("rolePlaceholder")}</option>
            {pickerOptions.map((r) => (
              <option key={r.value} value={r.value} disabled={r.unavailable}>{r.label}</option>
            ))}
          </select>
        </label>
      )}
      {roleListState === "failed" && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {tShared("roleListUnavailable")}
        </p>
      )}
      <NoRolesForTypeNote
        show={roleListState === "loaded" && roles?.length === 0}
        canConfigureRoles={canConfigureRoles}
      />

      {/* ── Validation hint + error ──────────────────────────────────────── */}
      {selectedId === null && !isLoading && items.length > 0 && (
        <p className="text-xs text-fade dark:text-zinc-500">{t("noSelection")}</p>
      )}
      {selectedId !== null && roleId === "" && pickerOptions.length > 0 && (
        <p className="text-xs text-fade dark:text-zinc-500">{t("noRole")}</p>
      )}
      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{submitError}</p>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 border-t border-crease pt-4 dark:border-zinc-800">
        <IconButton
          icon={UserPlus}
          label={t("confirm")}
          busy={submitting}
          busyLabel={t("confirming")}
          variant="primary"
          size="lg"
          onClick={handleConfirm}
          disabled={!canConfirm}
        />
        <IconButton
          icon={X}
          label={t("cancel")}
          variant="secondary"
          size="lg"
          onClick={handleCancel}
          disabled={submitting}
        />
      </div>
      </AssociateTile>
      </AssociateRow>
    </div>
  );
}
