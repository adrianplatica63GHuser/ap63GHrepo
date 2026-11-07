"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Stamp, Trash2, X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/lib/ui/button-styles";
import { WRAPS, columnHead } from "@/components/table/fixed-columns";
import { ADMIN_LIST_FRAME, ADMIN_LIST_HEAD, ADMIN_LIST_PANEL, AdminListTable, AdminListToolbar } from "@/components/list/admin-list";
import { filterByWords } from "@/lib/search/fold-words";
import { SCREEN, screenBox, screenPanel, tableUnits, type ColumnName } from "@/lib/ui/field-widths";
import { GrowingText } from "@/components/forms/growing-text";
import { TileUnitRow } from "@/components/screen/tile-unit-row";
import { WorkflowsTile } from "@/components/screen/workflows-tile";
import { AdminTilesBar, useAdminTiles } from "@/components/screen/admin-tiles";
import { ADMIN_STAMPS_LIST_UNITS, ADMIN_STAMPS_REGISTRY, ADMIN_STAMPS_SCREEN, ADMIN_STAMPS_WIZARD_UNITS } from "@/lib/ui/screen-tiles";
import { useOncePerSignIn } from "@/components/tiles/once-per-sign-in";
import { QUIET_ROW, QUIET_ROW_BUTTONS, QUIET_ROW_MARK } from "@/lib/ui/quiet-row";
import { StampAboutTile } from "./stamp-about-tile";
import { TextTooltip } from "@/lib/ui/text-tooltip";

/** The stamps, at #37.16's column widths (Slice #37.22). */
const COLUMNS: readonly ColumnName[] = ["description", "count", "rowActions"];

/**
 * Slice #37.35: the screen's tiles — what this list is (6 units, 7 of 119 px since 40.98; #37.22's two
 * panels), the create form (3) while it is open, and the list (the fewest units
 * that hold its columns, the description taking what the others leave).
 */
const FORM_UNITS = 4; // 40.98: re-pinned (3 of 148 px)
/**
 * Slice 41.99 (Ask first 4): as Grupuri's (41.98) — 75 % of the units that hold its columns (`tableUnits`, 6), rounded
 * down, 4; the description is the fill, so it is the column that narrows. „Ce este o Ștampilă?" is a line of its own.
 */
export const LIST_UNITS = ADMIN_STAMPS_LIST_UNITS;
export const LIST_UNITS_BEFORE_41_99 = tableUnits(COLUMNS);
// Slice #39.89: the list fills its tile at Reference Data's standard gap, the description taking what the others leave.
const LIST_FILL: ColumnName = "description";

// ── Types ────────────────────────────────────────────────────────────────────

type StampListItem = {
  id:               string;
  code:             string;
  shortDescription: string;
  notes:            string | null;
  memberCount:      number;
  createdAt:        string;
};

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchStamps(): Promise<StampListItem[]> {
  const res = await fetch("/api/stamps");
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  const data = await res.json();
  return data.items as StampListItem[];
}

async function createStamp(body: {
  shortDescription: string;
  notes?: string;
}): Promise<StampListItem> {
  const res = await fetch("/api/stamps", {
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

async function deleteStamp(id: string): Promise<void> {
  const res = await fetch(`/api/stamps/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed (${res.status})`);
  }
}

const SHORT_DESC_MAX = 200;
const NOTES_MAX = 2000;

// ── Create form ───────────────────────────────────────────────────────────────

function CreateForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("stamp");
  const qc = useQueryClient();

  const [shortDescription, setShortDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      createStamp({
        shortDescription: shortDescription.trim(),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stamps"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const canSave = shortDescription.trim().length > 0 && !mutation.isPending;

  return (
    <div {...screenPanel("add-stamp", FORM_UNITS)} className="rounded-md border border-card-rim bg-card p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-1 text-base font-semibold text-admin-title">
        {t("createTitle")}
      </h3>

      {/* Explanation */}
      <p className="mb-3 text-xs italic text-fade dark:text-zinc-400">
        {t("createExplanation")}
      </p>

      <div className="flex flex-col gap-3">
        {/* Short description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("fields.shortDescription")}
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <input
            {...screenBox("stampShortDescription")}
            ref={firstRef}
            type="text"
            maxLength={SHORT_DESC_MAX}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="text-xs text-fade dark:text-zinc-500">
            {t("shortDescCount", {
              count: shortDescription.trim().length,
              max: SHORT_DESC_MAX,
            })}
          </span>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink dark:text-zinc-400">
            {t("fields.notes")}
          </label>
          {/* Slice #37.40: a GrowingText, folding at five lines like every
              „Note…" box. Its label above is not tied to it, so it names
              itself. The box grows downward instead of a resize handle. */}
          <GrowingText
            value={notes}
            onValueChange={setNotes}
            width={String(screenBox("stampNotes").style.width)}
            lines
            minRows={SCREEN.stampNotes.rows}
            fold={SCREEN.stampNotes.fold}
            maxLength={NOTES_MAX}
            aria-label={t("fields.notes")}
            data-width-field="stampNotes"
            data-width-kind={SCREEN.stampNotes.kind}
            className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
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

// ── List ──────────────────────────────────────────────────────────────────────

export function StampsListView({ about }: { about?: ReactNode } = {}) {
  const t = useTranslations("stamp");
  // Slice 41.41: the screen's tiles chosen with „Panouri" (in the page bar), packed and dragged like a record's.
  const tiles = useAdminTiles(ADMIN_STAMPS_REGISTRY);
  // Slice 41.99: „Ce este o Ștampilă?" open the first time Ștampile is opened after each sign-in (as Grupuri, 41.98).
  useOncePerSignIn(ADMIN_STAMPS_REGISTRY.entity, "about", tiles.choice.reveal);
  const tileLabels = { about: t("infoPanel.title"), workflows: t("workflows.title"), list: t("pageTitle") };
  const qc = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Slice #39.89: the search — by code, or by every word typed in the short description.
  const [search, setSearch] = useState("");

  const query = useQuery<StampListItem[]>({
    queryKey: ["stamps"],
    queryFn: fetchStamps,
  });
  const shown = query.data ? filterByWords(query.data, search, (s) => s.code, (s) => s.shortDescription) : undefined;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStamp(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stamps"] });
      setConfirmDeleteId(null);
    },
  });

  return (
    <>
    <AdminTilesBar registry={ADMIN_STAMPS_REGISTRY} labels={tileLabels} tiles={tiles} allUp />
    <TileUnitRow screen={ADMIN_STAMPS_SCREEN}>
      {/* 41.99: „Ce este o Ștampilă?", across the row, closed by „Am înțeles" for this sign-in. */}
      {tiles.choice.isShown("about") && (about ?? <StampAboutTile onUnderstood={() => tiles.choice.toggle("about")} />)}
      {/* 41.44: how you work with them — a second information tile. 41.99: the wizard, 3 units, the list beside it. */}
      <WorkflowsTile kind="stamp" units={ADMIN_STAMPS_WIZARD_UNITS} hidden={!tiles.choice.isShown("workflows")} />
      {creating && <CreateForm onClose={() => setCreating(false)} />}

      <section {...screenPanel("stamps", LIST_UNITS)} className={ADMIN_LIST_PANEL} data-tile="list" hidden={!tiles.choice.isShown("list")}>

      {/* Toolbar — Slice #39.89: the search beside „+ Creare ștampilă"; the count „n din m" while something is typed. */}
      <AdminListToolbar
        add={
          // #37.46 (A082): Plus, icon-only. The name keeps its „+": e2e
          // finds the button by „+ Creare ștampilă", as #37.44 kept „+ Adaugă".
          <IconButton
            icon={Plus}
            label={`+ ${t("create")}`}
            variant="primary"
            size="sm"
            onClick={() => setCreating(true)}
            disabled={creating}
          />
        }
        search={search}
        onSearch={setSearch}
        explanation={t("listSearchPlaceholder")}
        count={
          query.data && shown
            ? search.trim()
              ? t("countFiltered", { shown: shown.length, total: query.data.length })
              : t("count", { count: query.data.length })
            : null
        }
      />

      {/* Table — Slice #39.89: two thirds of the window at most, scrolling inside, its header on top. */}
      <div className={ADMIN_LIST_FRAME} data-admin-list-frame="">
        <AdminListTable id="stamps" columns={COLUMNS} fill={LIST_FILL}>
          <thead className={ADMIN_LIST_HEAD}>
            <tr>
              <th className="px-4 py-2" {...columnHead("description")}>{t("table.stamp")}</th>
              <th className="px-4 py-2" {...columnHead("count")}>{t("table.members")}</th>
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
            {query.data && query.data.length > 0 && shown?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-fade" data-admin-list-none="">
                  {t("table.noMatch")}
                </td>
              </tr>
            )}
            {shown?.map((s) => (
              // Slice 41.99 (Ask first 4): calm, as Grupuri's (quiet-row.ts).
              <tr key={s.id} className={`${QUIET_ROW} hover:bg-cta-pale dark:hover:bg-zinc-800/50`}>
                <td className={`px-4 py-2 ${WRAPS}`}>
                  <span className="font-mono font-semibold text-ink dark:text-zinc-100">
                    {s.code}
                  </span>
                  <span className="ml-2 text-ink dark:text-zinc-300">
                    — {s.shortDescription}
                  </span>
                  {s.notes && (
                    // 41.46: the notes whole in the icon buttons' bubble when cut — their first hover.
                    <TextTooltip as="div" text={s.notes} className="mt-0.5 text-xs text-fade dark:text-zinc-500 line-clamp-1" data-stamp-notes="">
                      {s.notes}
                    </TextTooltip>
                  )}
                </td>
                <td className="px-4 py-2 text-fade dark:text-zinc-400">
                  {s.memberCount}
                </td>
                <td className="px-4 py-2">
                  <div className={`flex flex-wrap gap-2 ${QUIET_ROW_BUTTONS}`} data-row-buttons={QUIET_ROW_MARK}>
                    {/* #37.46 (A080): Stamp + „Aplică", a link. */}
                    <IconButton
                      href={`/admin/stamps/${s.id}`}
                      icon={Stamp}
                      label={t("table.apply")}
                      showLabel
                      variant="secondary"
                      size="xs"
                    />
                    <IconButton
                      icon={Trash2}
                      label={t("table.delete")}
                      variant="danger"
                      size="xs"
                      onClick={() => setConfirmDeleteId(s.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminListTable>
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
                {deleteMutation.isPending
                  ? t("confirm.deleting")
                  : t("confirm.delete")}
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
    </TileUnitRow>
    </>
  );
}
