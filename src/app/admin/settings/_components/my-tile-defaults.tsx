"use client";

/**
 * „Implicitele mele" — the parts „Implicit" shows, per kind of record.   (Slice #38.41)
 *
 * One row per kind: the parts that kind's screen has, ticked as „Implicit"
 * shows them today — the user's own set when one is saved, the built-in one
 * otherwise. „Salvează" stores the ticks; „Revino la implicit" forgets them and
 * the built-in set stands again. A browser's own ticks on a record screen are
 * untouched: „Implicit" is what they return to.
 *
 * The document row offers the parts every type has; „Detalii act" stands for
 * the type's own parts, whatever they are on a given type
 * (`src/lib/ui/tile-defaults.ts`).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, Save } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { PROP_TILE_REGISTRY } from "@/app/properties/_components/property-tiles";
import { inRegistryOrder } from "@/lib/ui/tiles";
import {
  DOCUMENT_BUILT_IN_DEFAULTS,
  DOCUMENT_COMMON_TILES,
  TILE_DEFAULT_KINDS,
  type TileDefaultKind,
} from "@/lib/ui/tile-defaults";
import { forgetSavedTileDefaults, type SavedTileDefaults } from "@/components/tiles/saved-tile-defaults";

/** Each kind's parts, its built-in set, and the namespace its part names live in. */
const KINDS: Record<TileDefaultKind, { all: readonly string[]; builtIn: readonly string[]; names: string }> = {
  "natural-person": { all: NP_TILE_REGISTRY.all, builtIn: NP_TILE_REGISTRY.defaults, names: "naturalPerson.tiles" },
  "judicial-person": { all: JP_TILE_REGISTRY.all, builtIn: JP_TILE_REGISTRY.defaults, names: "judicialPerson.tiles" },
  property: { all: PROP_TILE_REGISTRY.all, builtIn: PROP_TILE_REGISTRY.defaults, names: "property.tiles" },
  document: { all: DOCUMENT_COMMON_TILES, builtIn: DOCUMENT_BUILT_IN_DEFAULTS, names: "document.tiles" },
};

const QUERY_KEY = ["account-tile-defaults"] as const;

async function fetchSaved(): Promise<SavedTileDefaults> {
  const r = await fetch("/api/account/tile-defaults");
  if (!r.ok) throw new Error(`GET /api/account/tile-defaults → ${r.status}`);
  const j = (await r.json()) as { items?: SavedTileDefaults };
  return j.items ?? {};
}

function KindRow({ kind, saved }: { kind: TileDefaultKind; saved: readonly string[] | undefined }) {
  const t = useTranslations("settings.account.tileDefaults");
  const tNames = useTranslations();
  const queryClient = useQueryClient();
  const spec = KINDS[kind];
  const own = saved ? inRegistryOrder(saved, spec.all) : [];
  const current = own.length > 0 ? own : [...spec.builtIn];
  const [draft, setDraft] = useState<string[]>(current);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "cleared" | "error">("idle");
  const changed = draft.length !== current.length || draft.some((k) => !current.includes(k));

  async function send(method: "PUT" | "DELETE") {
    setState("busy");
    try {
      const r =
        method === "PUT"
          ? await fetch("/api/account/tile-defaults", {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, tiles: draft }),
            })
          : await fetch(`/api/account/tile-defaults?kind=${encodeURIComponent(kind)}`, { method });
      if (!r.ok) throw new Error(`${method} → ${r.status}`);
      forgetSavedTileDefaults();
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      if (method === "DELETE") setDraft([...spec.builtIn]);
      setState(method === "PUT" ? "saved" : "cleared");
    } catch {
      setState("error");
    }
  }

  return (
    <fieldset className="flex flex-col gap-1.5 rounded border border-wire p-3" data-tile-defaults-kind={kind}>
      <legend className="px-1 text-sm font-medium text-ink">
        {t(`kinds.${kind}`)}
        {own.length > 0 && <span className="ml-2 text-xs font-normal text-fade" data-tile-defaults-own="">{t("own")}</span>}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {spec.all.map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cta"
              value={k}
              checked={draft.includes(k)}
              onChange={(e) => {
                setState("idle");
                setDraft((d) => inRegistryOrder(e.target.checked ? [...d, k] : d.filter((x) => x !== k), spec.all));
              }}
            />
            {tNames(`${spec.names}.${k}`)}
          </label>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <IconButton
          icon={Save}
          label={t("save")}
          busy={state === "busy"}
          busyLabel={t("saving")}
          variant="primary"
          onClick={() => void send("PUT")}
          disabled={state === "busy" || draft.length === 0 || !changed}
        />
        {own.length > 0 && (
          <IconButton
            icon={RotateCcw}
            label={t("reset")}
            variant="secondary"
            onClick={() => void send("DELETE")}
            disabled={state === "busy"}
          />
        )}
        {draft.length === 0 && <span className="text-xs text-fade">{t("atLeastOne")}</span>}
        {state === "saved" && <span role="status" className="text-xs text-emerald-700 dark:text-emerald-400">{t("saved")}</span>}
        {state === "cleared" && <span role="status" className="text-xs text-emerald-700 dark:text-emerald-400">{t("cleared")}</span>}
        {state === "error" && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{t("error")}</span>}
      </div>
    </fieldset>
  );
}

export function MyTileDefaults() {
  const t = useTranslations("settings.account.tileDefaults");
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchSaved });
  return (
    <div className="flex flex-col gap-2" data-account-tile-defaults="">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-ink">{t("title")}</h3>
      <p className="text-xs text-fade">{t("intro")}</p>
      {isLoading ? (
        <p className="text-sm text-fade">{t("loading")}</p>
      ) : isError || !data ? (
        <p role="alert" className="text-sm text-red-500">{t("loadError")}</p>
      ) : (
        TILE_DEFAULT_KINDS.map((kind) => (
          // Keyed on the kind alone: a save must not remount the row, or „Salvat." goes with it (#38.39).
          <KindRow key={kind} kind={kind} saved={data[kind]} />
        ))
      )}
    </div>
  );
}
