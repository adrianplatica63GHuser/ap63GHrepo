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
 *
 * Slice #39.19: „Street View" and „Adrese căutate" — Google's two other
 * charges — have tiles of their own. Google has billed neither yet, so each
 * shows the month's use against its free allowance: the tests' count (counted)
 * and people's (an estimate, said as one), and what the part past it would cost.
 */
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { IconButton, TrailingIcon } from "@/lib/ui/icon-button";
import { screenBox, screenPanel } from "@/lib/ui/field-widths";
import { groupSurface } from "@/lib/ui/tile-surface";
import { CAD_PER, PROVIDER_FACTS, type CostProvider } from "@/lib/costs/catalogue";
import { ENTERED_CURRENCIES, formatCad, parseTypedAmount, type DayCost, type EnteredCurrency } from "@/lib/costs/compute";
import type { CostSummary, EnteredAmount, ProviderSummary } from "@/lib/costs/summary";
import { PANEL_TITLE_TYPE } from "@/lib/ui/title-type";

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

const INPUT = "rounded-md border border-wire bg-white px-2 py-1 text-sm text-ink dark:bg-zinc-800";

/**
 * The amounts entered on this tile, and the form that adds one (migration_107):
 * a bill's figure, a plan's price, a domain's year — in the currency billed,
 * with its CA$ rate, for a period. An amount spread over a longer period is
 * spread over its days (`spreadOverDays`).
 */
function EnteredAmounts({ p }: { p: ProviderSummary }) {
  const t = useTranslations("settings.costs.entered");
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<EnteredCurrency>(PROVIDER_FACTS[p.key].currency);
  const [rate, setRate] = useState(String(CAD_PER[PROVIDER_FACTS[p.key].currency]));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = (f: string) => `cost-${p.key}-${f}`;

  async function add() {
    const a = parseTypedAmount(amount);
    const r = parseTypedAmount(rate);
    if (a === null || r === null || r <= 0 || !from || !to || to < from) {
      setError(t("invalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p.key, periodStart: from, periodEnd: to, amount: a, currency, cadRate: r, note: note.trim() || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAmount("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["settings-costs"] });
    } catch {
      setError(t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(e: EnteredAmount) {
    setError(null);
    const res = await fetch(`/api/admin/costs?id=${encodeURIComponent(e.id)}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) {
      setError(t("deleteError"));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["settings-costs"] });
  }

  const label = "text-xs text-fade";
  return (
    <div className="flex flex-col gap-2" data-cost-entered="">
      <h3 className={PANEL_TITLE_TYPE}>{t("heading")}</h3>
      {p.entered.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          {p.entered.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2" data-cost-entered-row={e.id}>
              <span className="flex flex-col">
                <span className="text-ink tabular-nums">
                  {t("item", { from: shortDay(e.periodStart), to: shortDay(e.periodEnd), amount: e.amount.toFixed(2), currency: e.currency })}
                  {e.currency !== "CAD" && <span className="text-fade"> {t("approx", { cad: formatCad(e.amount * e.cadRate) })}</span>}
                </span>
                {e.note && <span className="text-fade">{e.note}</span>}
                <span className="text-fade">{t("enteredOn", { date: shortDay(e.enteredAt.slice(0, 10)) })}</span>
              </span>
              <IconButton icon={Trash2} label={t("delete")} variant="secondary" size="xs" onClick={() => void remove(e)} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <span className="flex flex-col gap-0.5">
          <label htmlFor={id("from")} className={label}>{t("from")}</label>
          <input id={id("from")} type="date" {...screenBox("costDate")} value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT} />
        </span>
        <span className="flex flex-col gap-0.5">
          <label htmlFor={id("to")} className={label}>{t("to")}</label>
          <input id={id("to")} type="date" {...screenBox("costDate")} value={to} onChange={(e) => setTo(e.target.value)} className={INPUT} />
        </span>
        <span className="flex flex-col gap-0.5">
          <label htmlFor={id("amount")} className={label}>{t("amount")}</label>
          <input id={id("amount")} inputMode="decimal" {...screenBox("costAmount")} value={amount} onChange={(e) => setAmount(e.target.value)} className={`${INPUT} text-right tabular-nums`} />
        </span>
        <span className="flex flex-col gap-0.5">
          <label htmlFor={id("currency")} className={label}>{t("currency")}</label>
          <select
            id={id("currency")}
            {...screenBox("costCurrency")}
            value={currency}
            onChange={(e) => {
              const c = e.target.value as EnteredCurrency;
              setCurrency(c);
              setRate(String(CAD_PER[c]));
            }}
            className={INPUT}
          >
            {ENTERED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </span>
        <span className="flex flex-col gap-0.5">
          <label htmlFor={id("rate")} className={label}>{t("rate")}</label>
          <input id={id("rate")} inputMode="decimal" {...screenBox("costRate")} value={rate} onChange={(e) => setRate(e.target.value)} className={`${INPUT} text-right tabular-nums`} />
        </span>
        <span className="flex flex-col gap-0.5">
          <label htmlFor={id("note")} className={label}>{t("note")}</label>
          <input id={id("note")} maxLength={200} {...screenBox("costNote")} value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} />
        </span>
        <IconButton icon={Plus} label={t("add")} busy={busy} busyLabel={t("saving")} variant="primary" size="md" data-cost-add="" onClick={() => void add()} disabled={busy || amount.trim() === ""} />
      </div>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/** A count the way the tiles write it: 1.500. */
const n = (v: unknown): string => Number(v).toLocaleString("ro-RO");

/**
 * Street View's or the address look-up's month (Slice #39.19): the tests' count, people's estimate, the free part,
 * and what lies past it. Each line says which figure is counted and which is estimated.
 */
function AllowanceUse({ p }: { p: ProviderSummary }) {
  const t = useTranslations("settings.costs.estimate");
  const f = p.facts;
  const kind = p.key === "streetView" ? "streetView" : "addressLookups";
  return (
    <div className="flex flex-col gap-1 text-xs" data-cost-estimate={p.key}>
      <p className="text-ink" data-cost-tests-so-far={f.testsSoFar ?? ""}>
        {f.testsSoFar === null || f.testsSoFar === undefined
          ? t("testsUnknown", { ceiling: n(f.testsCeiling) })
          : t("tests", { soFar: n(f.testsSoFar), month: n(f.testsMonth), ceiling: n(f.testsCeiling) })}
      </p>
      <p className="text-ink" data-cost-people={f.peoplePerDay ?? ""}>
        {t(`people.${kind}`, { perDay: n(f.peoplePerDay), month: n(f.peopleMonth) })}
      </p>
      <p className="font-medium text-ink" data-cost-month-use={f.monthUse ?? ""}>
        {Number(f.paid) > 0
          ? t("monthPaid", { total: n(f.monthUse), free: n(f.free), paid: n(f.paid), cad: formatCad(Number(f.estimateCad)) })
          : t("month", { total: n(f.monthUse), free: n(f.free) })}
      </p>
    </div>
  );
}

/** The „Testare" tile's counts: the tests' maps, Street View panoramas and address look-ups, each against its ceiling. */
function TestsUse({ p }: { p: ProviderSummary }) {
  const t = useTranslations("settings.costs.testing");
  const f = p.facts;
  if (f.testsMaps === null || f.testsMaps === undefined) {
    return (
      <p className="text-xs text-ink" data-cost-tests-maps="">
        {t("mapsUnknown")}
      </p>
    );
  }
  const kinds = [
    ["streetView", f.testsStreetView, f.streetViewCeiling],
    ["addressLookups", f.testsAddressLookups, f.addressLookupsCeiling],
  ] as const;
  return (
    <ul className="flex flex-col gap-0.5 text-xs text-ink" data-cost-tests="">
      <li data-cost-tests-maps={f.testsMaps}>{t("maps", { maps: n(f.testsMaps), ceiling: n(f.mapsCeiling) })}</li>
      {kinds.map(([kind, count, ceiling]) => (
        <li key={kind} data-cost-tests-kind={kind} data-cost-tests-count={count ?? ""}>
          {count === null || count === undefined
            ? t(`${kind}NotCounted`, { ceiling: n(ceiling) })
            : t(kind, { count: n(count), ceiling: n(ceiling) })}
        </li>
      ))}
    </ul>
  );
}

function Details({ p }: { p: ProviderSummary }) {
  const t = useTranslations("settings.costs");
  const facts = PROVIDER_FACTS[p.key];
  const basis =
    p.key === "ai"
      ? "linear"
      : p.key === "googleMaps"
        ? "perDay"
        : p.key === "streetView" || p.key === "addressLookups"
          ? "allowance"
          : "entered";
  const total = p.chart.reduce((n, d) => n + d.cad, 0);
  const h3 = PANEL_TITLE_TYPE;
  return (
    <div className="flex flex-col gap-3 text-sm" data-cost-details="">
      <Figures p={p} />
      <p className="text-xs text-fade">{t(`basis.${basis}`)}</p>
      {p.key === "ai" && typeof p.facts.perReadUsd === "number" && (
        <p className="text-xs text-fade" data-cost-ai-read="">
          {t("ai.perRead", { usd: p.facts.perReadUsd.toFixed(2), model: String(p.facts.model) })}
        </p>
      )}
      {(p.key === "streetView" || p.key === "addressLookups") && <AllowanceUse p={p} />}
      {p.key === "testing" && <TestsUse p={p} />}
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
      {p.key !== "testing" && <EnteredAmounts p={p} />}
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
