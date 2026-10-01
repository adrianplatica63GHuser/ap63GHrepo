"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  GROUP_TARGET_TYPES,
  type GroupTargetType,
} from "@/lib/groups/validation";
import { buttonClass } from "@/lib/ui/button-styles";
import { FixedColumns, TABLE_FRAME, WRAPS, columnHead, fixedTable } from "@/components/table/fixed-columns";
import { screenBox, screenPanel, tableUnits, type ColumnName } from "@/lib/ui/field-widths";
import { UnitRow } from "@/components/screen/unit-row";

/** The groups, at #37.16's column widths (Slice #37.22). */
const COLUMNS: readonly ColumnName[] = ["groupCode", "description", "rowActions"];

/**
 * Slice #37.35: the screen's tiles — what this list is (6 units, #37.22's two
 * panels), the add form (3) while it is open, and the list (the fewest units
 * that hold its columns, the description taking what the others leave).
 */
const ABOUT_UNITS = 6;
const FORM_UNITS = 3;
const LIST_UNITS = tableUnits(COLUMNS);
const LIST_FILL = { units: LIST_UNITS, column: "description" } as const;

// ── Types ───────────────────────────────────────────────────────────────────

type GroupListItem = {
  id:          string;
  code:        string;
  targetType:  GroupTargetType;
  description: string;
  memberCount: number;
  createdAt:   string;
};

// ── API helpers ─────────────────────────────────────────────────────────────

async function fetchGroups(): Promise<GroupListItem[]> {
  const res = await fetch("/api/groups");
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  const data = await res.json();
  return data.items as GroupListItem[];
}

async function createGroup(body: {
  targetType: GroupTargetType;
  description: string;
}): Promise<GroupListItem> {
  const res = await fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
  return res.json();
}

async function deleteGroup(id: string): Promise<void> {
  const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed (${res.status})`);
  }
}

const DESCRIPTION_MAX = 500;

// ── Add form ─────────────────────────────────────────────────────────────────

function AddForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("group");
  const qc = useQueryClient();

  const [targetType, setTargetType] = useState<GroupTargetType>("PROPERTY");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLSelectElement>(null);
  // FU-219 (Slice #37.07): each <label> names its control, so a screen reader
  // announces „Țintă" and „Descriere" rather than an unnamed list and text area.
  const targetId = useId();
  const descriptionId = useId();

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      createGroup({ targetType, description: description.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const canSave = description.trim().length > 0 && !mutation.isPending;

  return (
    <div {...screenPanel("add-group", FORM_UNITS)} className="rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-3 text-sm font-semibold text-ink dark:text-zinc-100">
        {t("addTitle")}
      </h3>

      <div className="flex flex-col gap-3">
        {/* Target type */}
        <div className="flex flex-col gap-1">
          <label htmlFor={targetId} className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("fields.target")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <select
            {...screenBox("groupTarget")}
            id={targetId}
            ref={firstRef}
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as GroupTargetType)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          >
            {GROUP_TARGET_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {t(`targets.${tt}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label htmlFor={descriptionId} className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("fields.description")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <textarea
            {...screenBox("groupDescription")}
            id={descriptionId}
            rows={3}
            maxLength={DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 resize-y"
          />
          <span className="text-xs text-fade dark:text-zinc-500">
            {t("descriptionCount", {
              count: description.trim().length,
              max: DESCRIPTION_MAX,
            })}
          </span>
        </div>

        {/* Code (system-assigned) */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("fields.code")}
          </label>
          <div {...screenBox("groupCodePending")} className="rounded-md border border-wire bg-canvas px-3 py-1.5 text-sm italic text-fade dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
            {t("codeAssignedOnSave")}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <IconButton
          icon={Save}
          label={t("save")}
          busy={mutation.isPending}
          busyLabel={t("saving")}
          variant="primary"
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!canSave}
        />
        <IconButton
          icon={X}
          label={t("cancel")}
          variant="secondary"
          size="sm"
          onClick={onClose}
        />
      </div>
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

export function GroupsListView({ about }: { about?: ReactNode } = {}) {
  const t = useTranslations("group");
  const qc = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const query = useQuery<GroupListItem[]>({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      setConfirmDeleteId(null);
    },
  });

  return (
    <UnitRow units={[ABOUT_UNITS, LIST_UNITS]}>
      {about}
      {adding && <AddForm onClose={() => setAdding(false)} />}

      <section {...screenPanel("groups", LIST_UNITS)} className="flex flex-col gap-3 rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* #37.44 (A040/A041): the icon in place of „+"; the words keep their „+" so the name
            stays the one every locator knows. */}
        <IconButton
          icon={Plus}
          label={`+ ${t("add")}`}
          variant="primary"
          size="sm"
          onClick={() => setAdding(true)}
          disabled={adding}
        />
        {query.data && (
          <span className="text-xs text-fade dark:text-zinc-400">
            {t("count", { count: query.data.length })}
          </span>
        )}
      </div>

      {/* Table */}
      <div className={`${TABLE_FRAME} rounded-md border border-card-rim bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}>
        <table {...fixedTable(COLUMNS, undefined, LIST_FILL)}>
          <FixedColumns columns={COLUMNS} fill={LIST_FILL} />
          <thead className="bg-cap text-left text-xs font-medium uppercase tracking-wide text-ink dark:bg-zinc-800 dark:text-zinc-300">
            <tr>
              <th className="px-4 py-2" {...columnHead("groupCode")}>{t("table.code")}</th>
              <th className="px-4 py-2" {...columnHead("description")}>{t("table.description")}</th>
              <th className="px-4 py-2" {...columnHead("rowActions")} />
            </tr>
          </thead>
          <tbody className="divide-y divide-crease dark:divide-zinc-800">
            {query.isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-fade">
                  {t("table.loading")}
                </td>
              </tr>
            )}
            {query.isError && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-red-600">
                  {t("table.error")}
                </td>
              </tr>
            )}
            {query.data?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-fade">
                  {t("table.empty")}
                </td>
              </tr>
            )}
            {query.data?.map((g) => (
              <tr key={g.id} className="hover:bg-cta-pale dark:hover:bg-zinc-800/50">
                <td className="px-4 py-2">
                  <span className="font-mono font-semibold text-ink dark:text-zinc-100">
                    {g.code}
                  </span>{" "}
                  <span className="text-fade dark:text-zinc-400">
                    ({g.memberCount})
                  </span>
                  <div className="text-xs text-fade dark:text-zinc-500">
                    {t(`targets.${g.targetType}`)}
                  </div>
                </td>
                <td className={`px-4 py-2 text-ink dark:text-zinc-300 ${WRAPS}`}>
                  {g.description}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    <IconButton
                      href={`/admin/groups/${g.id}`}
                      icon={Pencil}
                      label={t("table.edit")}
                      variant="secondary"
                      size="xs"
                    />
                    <IconButton
                      icon={Trash2}
                      label={t("table.delete")}
                      variant="danger"
                      size="xs"
                      onClick={() => setConfirmDeleteId(g.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </section>

      {/* Delete confirm */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden />
          <div
            role="alertdialog"
            className="fixed inset-x-4 top-1/3 z-50 mx-auto max-w-sm rounded-xl border border-card-rim bg-card p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="mb-4 text-sm text-ink dark:text-zinc-300">
              {t("confirm.deleteBody")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                disabled={deleteMutation.isPending}
                className={buttonClass({ variant: "danger", size: "sm" })}
              >
                {deleteMutation.isPending ? t("confirm.deleting") : t("confirm.delete")}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                {t("confirm.cancel")}
              </button>
            </div>
          </div>
        </>
      )}
    </UnitRow>
  );
}
