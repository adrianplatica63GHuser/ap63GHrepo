"use client";

/**
 * One tarla's page — its code and locality, its notes, its optional outline, its properties and their documents.
 *                                                                               (Slice #39.67, migration_112)
 *
 * A tarla is reference data with a page of its own, lighter than a principal object: no groups, tags, versions or
 * interactions (Adrian: „its own page, but no groups or interactions until you need them"). The six facts about
 * tarla boundaries stand at the top, as on the list. The outline is edited with the property's own corner editor
 * (`CornersManager`); drawing it on the map is 39.68.
 *
 * Saving goes through PUT /api/tarlale/[id], which uses Reference Data's own write door: a code already held IN THIS
 * LOCALITY is refused by name (`tarla_code_taken`) and said here.
 *
 * Slice #39.87 — the facts are the first tile, a third wide; „Parcele" scrolls like the two big lists; and „Salvează",
 * „Șterge" and „Anulează" stand at the bottom of the page under a divider, as on the record forms. „Anulează" puts back
 * what was last saved and stays on the page; „Șterge" is Reference Data's own delete — the same dialog, the same route,
 * the same in-use answer — and goes back to the tarla list.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Save, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ActivityCue } from "@/components/activity-cue";
import { TarlaBoundariesInfo } from "@/components/tarla/tarla-boundaries-info";
import { useNavigationHistory } from "@/components/providers/navigation-history-provider";
import { CornersManager } from "@/app/properties/_components/corners-manager";
import type { Corner } from "@/app/properties/_components/form-schema";
import { IconButton } from "@/lib/ui/icon-button";
import { TARLA, boxStyle } from "@/lib/ui/field-widths";
import { tarlaLabel } from "@/lib/tarla/label";
import type { TarlaDocumentItem, TarlaFull, TarlaParcelItem, TarlaPlanItem, TarlaPropertyItem } from "@/lib/tarla/types";
import { TARLA_LIST_QUERY_KEY } from "./tarla-list";
import { TarlaMap } from "./tarla-map";
import { MAP_BOX_HEIGHT_REM, unitStyle } from "@/lib/ui/field-widths";
import { TileUnitRow } from "@/components/screen/tile-unit-row";
import { TilePositionsReset } from "@/components/screen/tile-positions-reset";
import { TARLA_HALF_UNITS, TARLA_SCREEN, TARLA_THIRD_UNITS } from "@/lib/ui/screen-tiles";
import { DeleteDialog, fetchRows } from "@/app/admin/value-lists/_components/value-list-modal";

type Draft = {
  indicativ: string;
  locality: string;
  county: string;
  descriere: string;
  notes: string;
  corners: Corner[];
};

class TarlaSaveError extends Error {
  constructor(
    message: string,
    readonly takenBy: string | null,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.redirected || !res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function draftOf(t: TarlaFull): Draft {
  return {
    indicativ: t.indicativ,
    locality: t.locality ?? "",
    county: t.county ?? "",
    descriere: t.descriere ?? "",
    notes: t.notes ?? "",
    corners: t.corners.map((c) => ({ lat: c.lat, lon: c.lon, originalIndex: c.originalIndex })),
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const BOX = "rounded-md border border-wire bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800";
const CARD = "rounded-xl border border-card-rim bg-card px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

/**
 * Slice #39.77 — the two big lists (properties, documents): never taller than two thirds of the window, scrolling inside
 * their tile, their header row staying at the top (Ask first 2). Neither has a pagination of its own.
 */
const BIG_LIST_FRAME = "mt-2 max-h-[66vh] overflow-auto";
const STICKY_HEAD = "sticky top-0 z-10 bg-card dark:bg-zinc-900";
/** A list inside a third: it scrolls sideways rather than leaving its tile. */
const SMALL_LIST_FRAME = "overflow-x-auto";
// Slice #39.87: „Parcele" moved into BIG_LIST_FRAME (Adrian: „the same scroll bar like the properties tile and the
// documents tile"); SMALL_LIST_FRAME is the corners' table's alone now.
const LINK = "text-blue-700 underline-offset-2 hover:underline dark:text-blue-400";

export function TarlaDetail({ id }: { id: string }) {
  const t = useTranslations("tarla.detail");
  const tc = useTranslations("tarla");
  const qc = useQueryClient();
  const router = useRouter();
  const { registerPage } = useNavigationHistory();
  // Slice #39.87: „Șterge" opens Reference Data's own delete dialog; „Anulează" remounts the corner editor so a corner
  // left open for editing closes with the rest.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cancelled, setCancelled] = useState(0);
  // The rows the dialog may move dependents onto — every tarla, under Reference Data's own key and fetcher.
  const tarlaRows = useQuery({ queryKey: ["value-list", "tarla"], queryFn: () => fetchRows("tarla"), enabled: confirmDelete });

  const tarla = useQuery({
    queryKey: ["tarla", id],
    queryFn: () => getJson<{ tarla: TarlaFull }>(`/api/tarlale/${id}`).then((b) => b.tarla),
  });
  const properties = useQuery({
    queryKey: ["tarla", id, "properties"],
    queryFn: () => getJson<{ items: TarlaPropertyItem[] }>(`/api/tarlale/${id}/properties`).then((b) => b.items),
  });
  // Slice #39.68: the properties' corners — drawn on the page's map, and the outline's hull when none is drawn.
  const propertyCorners = useQuery({
    queryKey: ["tarla", id, "corners"],
    queryFn: () =>
      getJson<{ items: { id: string; corners: { lat: number; lon: number }[] }[] }>(`/api/tarlale/${id}/corners`).then(
        (b) => b.items,
      ),
  });
  // Slice #39.69: the parcels its plans drew, and the plans linked to it.
  const parcels = useQuery({
    queryKey: ["tarla", id, "parcels"],
    queryFn: () => getJson<{ items: TarlaParcelItem[] }>(`/api/tarlale/${id}/parcels`).then((b) => b.items),
  });
  const plans = useQuery({
    queryKey: ["tarla", id, "plans"],
    queryFn: () => getJson<{ items: TarlaPlanItem[] }>(`/api/tarlale/${id}/plans`).then((b) => b.items),
  });
  const documents = useQuery({
    queryKey: ["tarla", id, "documents"],
    queryFn: () => getJson<{ items: TarlaDocumentItem[] }>(`/api/tarlale/${id}/documents`).then((b) => b.items),
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const loaded = tarla.data ? draftOf(tarla.data) : null;
  const current = draft ?? loaded;
  const dirty = current !== null && loaded !== null && !sameDraft(current, loaded);

  useEffect(() => {
    if (tarla.data) registerPage(`/tarlale/${id}`, tarlaLabel(tarla.data));
  }, [tarla.data, id, registerPage]);

  const save = useMutation({
    mutationFn: async (d: Draft): Promise<TarlaFull> => {
      const res = await fetch(`/api/tarlale/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indicativ: d.indicativ,
          locality: d.locality,
          county: d.county,
          descriere: d.descriere,
          notes: d.notes,
          corners: d.corners,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { tarla?: TarlaFull; code?: string; takenBy?: string };
      if (!res.ok || !body.tarla) {
        throw new TarlaSaveError(`HTTP ${res.status}`, body.code === "tarla_code_taken" ? body.takenBy ?? d.indicativ : null);
      }
      return body.tarla;
    },
    onSuccess: async (saved) => {
      qc.setQueryData(["tarla", id], saved);
      setDraft(null);
      setSavedOnce(true);
      await qc.invalidateQueries({ queryKey: TARLA_LIST_QUERY_KEY });
      await qc.invalidateQueries({ queryKey: ["value-list", "tarla"] });
    },
  });

  if (tarla.isPending) return <ActivityCue>{tc("loading")}</ActivityCue>;
  if (tarla.isError || !current) {
    return (
      <p role="alert" className="text-sm text-red-700 dark:text-red-400">
        {t("notFound")}
      </p>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSavedOnce(false);
    setDraft({ ...current, [key]: value });
  };
  const saveError = save.error instanceof TarlaSaveError ? save.error : save.error ? new TarlaSaveError("", null) : null;

  return (
    <>
      {/* Slice #39.77: „Implicit" at the top right puts the dragged tiles back in their places. */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-ink dark:text-zinc-100" data-tarla-title="">
          {t("title", { label: tarlaLabel(tarla.data) })}
        </h1>
        <TilePositionsReset entity={TARLA_SCREEN.entity} />
      </header>

      {/* Slice #39.77 — the panels as tiles, as on the record forms (`TileUnitRow`): dragged, lifted by a double-click,
          kept per browser under „tarla". Thirds, and halves for the two big lists (`TARLA_SCREEN`). */}
      <TileUnitRow screen={TARLA_SCREEN}>
      {/* Slice #39.87: the six facts, a third wide and first in the row (Ask first 2); on the tarla list they stay across. */}
      <div data-tarla-facts="" data-tile="facts" style={unitStyle(TARLA_THIRD_UNITS)}>
        <TarlaBoundariesInfo />
      </div>

      <section className={CARD} aria-labelledby="tarla-identity-title" data-tarla-identity="" data-tile="identity" style={unitStyle(TARLA_THIRD_UNITS)}>
        <h2 id="tarla-identity-title" className="text-base font-semibold text-ink dark:text-zinc-100">
          {t("identity")}
        </h2>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="block text-sm">
            <span className="block text-xs font-medium text-fade">{t("fields.indicativ")}</span>
            <input
              type="text"
              className={BOX}
              style={boxStyle(TARLA.indicativ)}
              value={current.indicativ}
              onChange={(e) => set("indicativ", e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-fade">{t("fields.locality")}</span>
            <input
              type="text"
              className={BOX}
              style={boxStyle(TARLA.locality)}
              value={current.locality}
              onChange={(e) => set("locality", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-fade">{t("fields.county")}</span>
            <input
              type="text"
              className={BOX}
              style={boxStyle(TARLA.county)}
              value={current.county}
              onChange={(e) => set("county", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="block text-xs font-medium text-fade">{t("fields.descriere")}</span>
            <input
              type="text"
              className={BOX}
              style={boxStyle(TARLA.descriere)}
              value={current.descriere}
              onChange={(e) => set("descriere", e.target.value)}
            />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="block text-xs font-medium text-fade">{t("fields.notes")}</span>
          <textarea
            className={BOX}
            style={{ ...boxStyle(TARLA.notes), width: "100%" }}
            rows={TARLA.notes.rows}
            value={current.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
      </section>

      <section className={CARD} aria-labelledby="tarla-outline-title" data-tarla-outline="" data-tile="outline" style={unitStyle(TARLA_THIRD_UNITS)}>
        <h2 id="tarla-outline-title" className="text-base font-semibold text-ink dark:text-zinc-100">
          {t("outline")}
        </h2>
        <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("outlineHint")}</p>
        {/* Slice #39.68: the outline on a map — the corners below when drawn, else the shape around the properties. */}
        <div className="mt-3 overflow-hidden rounded-md border border-wire" style={{ height: `${MAP_BOX_HEIGHT_REM}rem` }}>
          {propertyCorners.data ? (
            <TarlaMap
              id={id}
              indicativ={current.indicativ || tarla.data.indicativ}
              locality={current.locality || null}
              own={current.corners}
              properties={propertyCorners.data}
            />
          ) : (
            <ActivityCue>{tc("loading")}</ActivityCue>
          )}
        </div>
        {/* Slice #39.77: in a third, the corners' table scrolls sideways rather than leaving the tile.
            #39.87: `tight` — narrower gaps between its columns, so a corner's four buttons share one line and nothing
            scrolls (Ask first 1). */}
        <div className={`mt-3 ${SMALL_LIST_FRAME}`}>
          <CornersManager key={cancelled} tight corners={current.corners} onChange={(next) => set("corners", next)} />
        </div>
      </section>

      <section className={CARD} aria-labelledby="tarla-properties-title" data-tarla-properties="" data-tile="properties" style={unitStyle(TARLA_HALF_UNITS)}>
        <h2 id="tarla-properties-title" className="text-base font-semibold text-ink dark:text-zinc-100">
          {t("properties", { count: properties.data?.length ?? tarla.data.propertyCount })}
        </h2>
        {properties.isPending ? (
          <ActivityCue>{tc("loading")}</ActivityCue>
        ) : properties.isError ? (
          <p role="alert" className="text-sm text-red-700">{tc("loadError")}</p>
        ) : properties.data.length === 0 ? (
          <p className="mt-2 text-sm text-fade">{t("propertiesNone")}</p>
        ) : (
          <div className={BIG_LIST_FRAME} data-tarla-big-list="">
          <table className="text-sm">
            <thead className={STICKY_HEAD}>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-fade">
                <th className="py-2 pr-4">{t("columns.code")}</th>
                <th className="py-2 pr-4">{t("columns.nickname")}</th>
                <th className="py-2 pr-4">{t("columns.parcela")}</th>
                <th className="py-2 pr-4">{t("columns.type")}</th>
                <th className="py-2 pr-4">{t("columns.locality")}</th>
              </tr>
            </thead>
            <tbody>
              {properties.data.map((p) => (
                <tr key={p.id} className="border-t border-wire dark:border-zinc-700" data-tarla-property={p.code}>
                  <td className="py-1.5 pr-4">
                    <Link href={`/properties/${p.id}`} className={LINK}>
                      {p.code}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-4">{p.nickname ?? "–"}</td>
                  <td className="py-1.5 pr-4">{p.parcela ?? "–"}</td>
                  <td className="py-1.5 pr-4">{p.typeName ?? "–"}</td>
                  <td className="py-1.5 pr-4">{p.locality ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className={CARD} aria-labelledby="tarla-plans-title" data-tarla-plans="" data-tile="plans" style={unitStyle(TARLA_THIRD_UNITS)}>
        <h2 id="tarla-plans-title" className="text-base font-semibold text-ink dark:text-zinc-100">
          {t("plans", { count: plans.data?.length ?? 0 })}
        </h2>
        <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("plansHint")}</p>
        {plans.isPending ? (
          <ActivityCue>{tc("loading")}</ActivityCue>
        ) : plans.isError ? (
          <p role="alert" className="text-sm text-red-700">{tc("loadError")}</p>
        ) : plans.data.length === 0 ? (
          <p className="mt-2 text-sm text-fade">{t("plansNone")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {plans.data.map((d) => (
              <li key={d.id} data-tarla-plan={d.code}>
                <Link href={`/documents/${d.id}`} className={LINK}>
                  {d.code}
                </Link>
                {` — ${d.title ?? d.typeName ?? "–"}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={CARD} aria-labelledby="tarla-parcels-title" data-tarla-parcels="" data-tile="parcels" style={unitStyle(TARLA_THIRD_UNITS)}>
        <h2 id="tarla-parcels-title" className="text-base font-semibold text-ink dark:text-zinc-100">
          {t("parcels", { count: parcels.data?.length ?? 0 })}
        </h2>
        <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("parcelsHint")}</p>
        {parcels.isPending ? (
          <ActivityCue>{tc("loading")}</ActivityCue>
        ) : parcels.isError ? (
          <p role="alert" className="text-sm text-red-700">{tc("loadError")}</p>
        ) : parcels.data.length === 0 ? (
          <p className="mt-2 text-sm text-fade">{t("parcelsNone")}</p>
        ) : (
          <div className={BIG_LIST_FRAME} data-tarla-big-list="">
          <table className="text-sm">
            <thead className={STICKY_HEAD}>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-fade">
                <th className="py-2 pr-4">{t("columns.parcela")}</th>
                <th className="py-2 pr-4 text-right">{t("columns.area")}</th>
                <th className="py-2 pr-4">{t("columns.use")}</th>
                <th className="py-2 pr-4">{t("columns.fromPlan")}</th>
              </tr>
            </thead>
            <tbody>
              {parcels.data.map((p) => (
                <tr key={p.id} className="border-t border-wire dark:border-zinc-700" data-tarla-parcel={p.parcela}>
                  <td className="py-1.5 pr-4">{p.parcela}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">
                    {p.areaSqm === null ? "–" : p.areaSqm.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-1.5 pr-4">{p.use ?? "–"}</td>
                  <td className="py-1.5 pr-4">
                    {p.sourceDocumentId && p.sourceDocumentCode ? (
                      <Link href={`/documents/${p.sourceDocumentId}`} className={LINK}>
                        {p.sourceDocumentCode}
                      </Link>
                    ) : (
                      "–"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className={CARD} aria-labelledby="tarla-documents-title" data-tarla-documents="" data-tile="documents" style={unitStyle(TARLA_HALF_UNITS)}>
        <h2 id="tarla-documents-title" className="text-base font-semibold text-ink dark:text-zinc-100">
          {t("documents", { count: documents.data?.length ?? 0 })}
        </h2>
        <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("documentsHint")}</p>
        {documents.isPending ? (
          <ActivityCue>{tc("loading")}</ActivityCue>
        ) : documents.isError ? (
          <p role="alert" className="text-sm text-red-700">{tc("loadError")}</p>
        ) : documents.data.length === 0 ? (
          <p className="mt-2 text-sm text-fade">{t("documentsNone")}</p>
        ) : (
          <div className={BIG_LIST_FRAME} data-tarla-big-list="">
          <table className="text-sm">
            <thead className={STICKY_HEAD}>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-fade">
                <th className="py-2 pr-4">{t("columns.docCode")}</th>
                <th className="py-2 pr-4">{t("columns.docTitle")}</th>
                <th className="py-2 pr-4">{t("columns.docType")}</th>
                <th className="py-2 pr-4">{t("columns.viaProperties")}</th>
              </tr>
            </thead>
            <tbody>
              {documents.data.map((d) => (
                <tr key={d.id} className="border-t border-wire dark:border-zinc-700" data-tarla-document={d.code}>
                  <td className="py-1.5 pr-4">
                    <Link href={`/documents/${d.id}`} className={LINK}>
                      {d.code}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-4">{d.title ?? "–"}</td>
                  <td className="py-1.5 pr-4">{d.typeName ?? "–"}</td>
                  <td className="py-1.5 pr-4">{d.propertyCodes.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
      </TileUnitRow>

      {/* Slice #39.87 — the page's buttons, under the last tile and across the page, a divider above them: the record
          forms' footer (property-form.tsx), its icons and its order (Ask first 3). The save writes two tiles — the
          identity and the outline — so it is the page's, not a tile's. */}
      <div
        className="flex flex-wrap items-center justify-center gap-3 border-t border-crease pt-6 dark:border-zinc-800"
        data-tarla-save=""
      >
        <IconButton
          icon={Save}
          label={t("save")}
          variant="primary"
          size="lg"
          onClick={() => save.mutate(current)}
          disabled={!dirty || save.isPending || current.indicativ.trim() === ""}
          busy={save.isPending}
        />
        <IconButton
          icon={Trash2}
          label={t("delete")}
          variant="danger"
          size="lg"
          onClick={() => setConfirmDelete(true)}
          disabled={save.isPending}
          data-tarla-delete=""
        />
        {/* Ask first 4: back to what was last saved, on this page; nothing to put back, nothing to press. */}
        <IconButton
          icon={X}
          label={t("cancel")}
          variant="secondary"
          size="lg"
          onClick={() => {
            setDraft(null);
            setSavedOnce(false);
            save.reset();
            setCancelled((n) => n + 1);
          }}
          disabled={!dirty || save.isPending}
          data-tarla-cancel=""
        />
        {savedOnce && !dirty && <span className="text-sm text-fade" role="status">{t("saved")}</span>}
        {saveError && (
          <span role="alert" className="text-sm text-red-700 dark:text-red-400">
            {saveError.takenBy !== null ? t("codeTaken", { takenBy: saveError.takenBy }) : t("saveError")}
          </span>
        )}
      </div>

      {/* Ask first 5: Reference Data's own delete — DELETE /api/admin/value-lists/tarla/[id], its in-use answer naming
          what still hangs on the tarla, and its offer to move that onto another tarla. Once deleted, the tarla list. */}
      {confirmDelete && tarlaRows.data && (
        <DeleteDialog
          listKey="tarla"
          row={tarlaRows.data.find((r) => r.id === id) ?? { id, indicativ: current.indicativ }}
          rows={tarlaRows.data}
          labelField="indicativ"
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => {
            setConfirmDelete(false);
            router.push("/tarlale");
          }}
        />
      )}
    </>
  );
}
