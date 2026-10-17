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
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
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
import type { TarlaDocumentItem, TarlaFull, TarlaPropertyItem } from "@/lib/tarla/types";
import { TARLA_LIST_QUERY_KEY } from "./tarla-list";

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
const LINK = "text-blue-700 underline-offset-2 hover:underline dark:text-blue-400";

export function TarlaDetail({ id }: { id: string }) {
  const t = useTranslations("tarla.detail");
  const tc = useTranslations("tarla");
  const qc = useQueryClient();
  const { registerPage } = useNavigationHistory();

  const tarla = useQuery({
    queryKey: ["tarla", id],
    queryFn: () => getJson<{ tarla: TarlaFull }>(`/api/tarlale/${id}`).then((b) => b.tarla),
  });
  const properties = useQuery({
    queryKey: ["tarla", id, "properties"],
    queryFn: () => getJson<{ items: TarlaPropertyItem[] }>(`/api/tarlale/${id}/properties`).then((b) => b.items),
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
      <h1 className="text-2xl font-semibold text-ink dark:text-zinc-100" data-tarla-title="">
        {t("title", { label: tarlaLabel(tarla.data) })}
      </h1>
      <TarlaBoundariesInfo />

      <section className={CARD} aria-labelledby="tarla-identity-title" data-tarla-identity="">
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

      <section className={CARD} aria-labelledby="tarla-outline-title" data-tarla-outline="">
        <h2 id="tarla-outline-title" className="text-base font-semibold text-ink dark:text-zinc-100">
          {t("outline")}
        </h2>
        <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("outlineHint")}</p>
        <div className="mt-3">
          <CornersManager corners={current.corners} onChange={(next) => set("corners", next)} />
        </div>
      </section>

      <div className="flex items-center gap-3" data-tarla-save="">
        <IconButton
          icon={Save}
          label={t("save")}
          variant="primary"
          size="sm"
          showLabel
          onClick={() => save.mutate(current)}
          disabled={!dirty || save.isPending || current.indicativ.trim() === ""}
          busy={save.isPending}
        />
        {savedOnce && !dirty && <span className="text-sm text-fade" role="status">{t("saved")}</span>}
        {saveError && (
          <span role="alert" className="text-sm text-red-700 dark:text-red-400">
            {saveError.takenBy !== null ? t("codeTaken", { takenBy: saveError.takenBy }) : t("saveError")}
          </span>
        )}
      </div>

      <section className={CARD} aria-labelledby="tarla-properties-title" data-tarla-properties="">
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
          <table className="mt-2 text-sm">
            <thead>
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
        )}
      </section>

      <section className={CARD} aria-labelledby="tarla-documents-title" data-tarla-documents="">
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
          <table className="mt-2 text-sm">
            <thead>
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
        )}
      </section>
    </>
  );
}
