"use client";

/**
 * „Setări → Costuri": one tile per provider that can cost money.   (Slice #39.17)
 *
 * Each tile opens COLLAPSED to one line — this month so far and the month's
 * forecast — and „Detalii" shows the rest: what is paid for, the free part, how
 * it is priced (with the day it was checked and the provider's own page), this
 * month, today, the forecast and its basis, and a graph of the cost over time.
 * The AI tile is the old „AI" one, collapsed to its estimated cost; expanded it
 * shows what it showed before (`children`).
 *
 * The figures come from `/api/admin/costs` (`src/lib/costs/`); nothing here
 * talks to a provider, and no credential reaches the browser.
 */
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { IconButton, TrailingIcon } from "@/lib/ui/icon-button";
import { screenPanel } from "@/lib/ui/field-widths";
import { groupSurface } from "@/lib/ui/tile-surface";
import { PROVIDER_FACTS, type CostProvider } from "@/lib/costs/catalogue";
import { formatCad, type DayCost } from "@/lib/costs/compute";
import type { CostSummary, ProviderSummary } from "@/lib/costs/summary";

/** The cost tiles are as wide as Setări's own tiles. */
const COST_TILE_UNITS = 3;

async function fetchCosts(): Promise<CostSummary> {
  const res = await fetch("/api/admin/costs");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as CostSummary;
}

export function useCosts() {
  return useQuery({ queryKey: ["settings-costs"], queryFn: fetchCosts, staleTime: 60_000 });
}

/** A day the way the tiles write it: 12.10.2026. */
function shortDay(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
}

/** The cost over time: one bar a day, from the first day that cost something (or the month's first). */
function CostChart({ days, label }: { days: readonly DayCost[]; label: string }) {
  const max = Math.max(...days.map((d) => d.cad), 0);
  const w = 300;
  const h = 64;
  const bw = w / Math.max(days.length, 1);
  return (
    <figure className="flex flex-col gap-1" data-cost-chart="">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full" role="img" aria-label={label}>
        <line x1="0" y1={h - 0.5} x2={w} y2={h - 0.5} className="stroke-wire" strokeWidth="1" />
        {max > 0 &&
          days.map((d, i) =>
            d.cad > 0 ? (
              <rect key={d.day} x={i * bw + bw * 0.15} y={h - (d.cad / max) * (h - 4)} width={bw * 0.7} height={(d.cad / max) * (h - 4)} className="fill-cta">
                <title>{`${shortDay(d.day)}: ${formatCad(d.cad)}`}</title>
              </rect>
            ) : null,
          )}
      </svg>
      <figcaption className="flex justify-between text-[11px] text-fade">
        <span>{days[0] ? shortDay(days[0].day) : ""}</span>
        <span>{days.length ? shortDay(days[days.length - 1].day) : ""}</span>
      </figcaption>
    </figure>
  );
}

function Figures({ p }: { p: ProviderSummary }) {
  const t = useTranslations("settings.costs");
  return (
    <dl className="grid grid-cols-[1fr_max-content] gap-x-4 gap-y-1 text-sm" data-cost-figures="">
      <dt className="text-fade">{t("soFar")}</dt>
      <dd className="text-right tabular-nums text-ink" data-cost-so-far={p.figures.soFar}>{formatCad(p.figures.soFar)}</dd>
      <dt className="text-fade">{t("today")}</dt>
      <dd className="text-right tabular-nums text-ink">{formatCad(p.figures.today)}</dd>
      <dt className="text-fade">{t("forecast")}</dt>
      <dd className="text-right tabular-nums font-medium text-ink" data-cost-forecast={p.figures.forecast}>{formatCad(p.figures.forecast)}</dd>
    </dl>
  );
}

function Details({ p }: { p: ProviderSummary }) {
  const t = useTranslations("settings.costs");
  const facts = PROVIDER_FACTS[p.key];
  const basis = p.key === "ai" ? "linear" : p.key === "googleMaps" ? "perDay" : "entered";
  const total = p.chart.reduce((n, d) => n + d.cad, 0);
  const h3 = "text-xs font-semibold uppercase tracking-widest text-ink";
  return (
    <div className="flex flex-col gap-3 text-sm" data-cost-details="">
      <Figures p={p} />
      <p className="text-xs text-fade">{t(`basis.${basis}`)}</p>
      {p.key === "ai" && typeof p.facts.perReadUsd === "number" && (
        <p className="text-xs text-fade" data-cost-ai-read="">
          {t("ai.perRead", { usd: p.facts.perReadUsd.toFixed(2), model: String(p.facts.model) })}
        </p>
      )}
      {p.key === "testing" && (
        <p className="text-xs text-ink" data-cost-tests-maps={p.facts.testsMaps ?? ""}>
          {p.facts.testsMaps === null || p.facts.testsMaps === undefined
            ? t("testing.mapsUnknown")
            : t("testing.maps", { maps: Number(p.facts.testsMaps).toLocaleString("ro-RO") })}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <h3 className={h3}>{t("history")}</h3>
        {total > 0 ? (
          <CostChart
            days={p.chart}
            label={t("chartLabel", { from: shortDay(p.chart[0].day), to: shortDay(p.chart[p.chart.length - 1].day), total: formatCad(total) })}
          />
        ) : (
          <p className="text-xs text-fade">{t("noHistory")}</p>
        )}
        {p.monthly.length > 0 && (
          <ul className="flex flex-col text-xs" aria-label={t("months")} data-cost-months="">
            {p.monthly.map((m) => (
              <li key={m.month} className="flex justify-between tabular-nums">
                <span className="text-fade">{m.month}</span>
                <span className="text-ink">{formatCad(m.cad)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-fade">{t(`source.${facts.source}`)}</p>
        {facts.source !== "counted" && p.entered.length === 0 && p.key !== "googleMaps" && (
          <p className="text-xs text-fade" data-cost-no-entered="">{t("noEntered")}</p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={h3}>{t("conditions")}</h3>
        <p className="text-ink">{t(`providers.${p.key}.conditions`)}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={h3}>{t("freeTier")}</h3>
        <p className="text-ink">{t(`providers.${p.key}.freeTier`)}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className={h3}>{t("pricing")}</h3>
        <p className="text-ink">{t(`providers.${p.key}.pricing`)}</p>
        <p className="text-xs text-fade" data-cost-checked={facts.checked}>
          {t("checked", { date: shortDay(facts.checked) })}{" "}
          {/* A new tab carries its ExternalLink (#37.46). */}
          <a href={facts.pricingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline hover:text-ink">
            {t("pricingLink")}
            <TrailingIcon icon={ExternalLink} />
          </a>
        </p>
      </div>
      {facts.liveKey && (
        <p className="text-xs text-fade" data-cost-live-key={facts.liveKey.name}>
          {t("notConnected", { key: facts.liveKey.name, where: facts.liveKey.where })}
        </p>
      )}
    </div>
  );
}

/** One provider's tile: collapsed to one line, „Detalii" for the rest. */
export function CostTile({
  provider,
  summary,
  status,
  children,
}: {
  provider: CostProvider;
  summary: ProviderSummary | undefined;
  /** Loading or an error, in place of the figures. */
  status: ReactNode;
  /** Extra content shown when expanded, above the details (the AI tile's models). */
  children?: ReactNode;
}) {
  const t = useTranslations("settings.costs");
  const [open, setOpen] = useState(false);
  const title = t(`providers.${provider}.title`);
  const line = summary
    ? t(provider === "ai" ? "aiCollapsed" : "collapsed", { soFar: formatCad(summary.figures.soFar), forecast: formatCad(summary.figures.forecast) })
    : null;
  return (
    <section
      {...screenPanel(`settings-cost-${provider}`, COST_TILE_UNITS)}
      aria-label={title}
      className={`${groupSurface("meta")} flex flex-col gap-3`}
      data-cost-tile={provider}
      data-cost-state={open ? "expanded" : "collapsed"}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <IconButton
          icon={open ? ChevronUp : ChevronDown}
          label={open ? t("collapse") : t("expand")}
          variant="secondary"
          size="xs"
          aria-expanded={open}
          data-cost-toggle=""
          onClick={() => setOpen((o) => !o)}
        />
      </div>
      {status ?? (line && <p className="text-sm text-ink" data-cost-line="">{line}</p>)}
      {open && (
        <>
          {children}
          {summary && <Details p={summary} />}
        </>
      )}
    </section>
  );
}
