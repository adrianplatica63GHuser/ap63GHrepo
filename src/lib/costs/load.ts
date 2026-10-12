/**
 * src/lib/costs/load.ts                                            (Slice #39.17)
 *
 * The reading behind „Setări → Costuri", server-side only: the paid AI reads
 * per day (`ai_paid_read`) and the tests' Google maps this month — the test
 * runner's ledger on this machine, `.test-runner/google-maps-month.json`
 * (Slice #39.16), absent anywhere else. No provider is called and no
 * credential is read: nothing here leaves the machine.
 */
import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, min, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiPaidRead, costRecord } from "@/db/schema";
import { COST_PROVIDERS, PROVIDER_ID, type CostProvider } from "./catalogue";
import type { EnteredAmount } from "./summary";

/** Successful paid reads per Toronto day, oldest first, and the first read ever — or empty on any fault. */
export async function aiReadsByDay(): Promise<{ days: { day: string; reads: number }[]; since: string | null }> {
  try {
    const day = sql<string>`to_char(${aiPaidRead.at} AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD')`;
    const rows = await db
      .select({ day, reads: sql<number>`count(*)::int` })
      .from(aiPaidRead)
      .where(eq(aiPaidRead.success, true))
      .groupBy(day)
      .orderBy(day);
    const [first] = await db.select({ at: min(aiPaidRead.at) }).from(aiPaidRead);
    return {
      days: rows.map((r) => ({ day: String(r.day), reads: Number(r.reads) })),
      since: first?.at ? new Date(first.at as unknown as string).toISOString() : null,
    };
  } catch (err) {
    console.error("[costs] could not count the paid reads:", err);
    return { days: [], since: null };
  }
}

/** The runner's month of tests' maps, or null where there is no runner (any machine but Adrian's laptop). */
export function testsMapsThisMonth(root: string = process.cwd()): { month: string; maps: number } | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, ".test-runner", "google-maps-month.json"), "utf8")) as {
      month?: unknown;
      maps?: unknown;
    };
    return typeof raw.month === "string" && typeof raw.maps === "number" ? { month: raw.month, maps: raw.maps } : null;
  } catch {
    return null;
  }
}

// ---- the amounts Adrian entered (migration_107) ---------------------------------------------


const KEY_OF_ID: Readonly<Record<string, CostProvider>> = Object.fromEntries(COST_PROVIDERS.map((k) => [PROVIDER_ID[k], k]));

/** Every entered amount, by tile, newest period first — or none on any fault. */
export async function enteredAmounts(): Promise<Partial<Record<CostProvider, EnteredAmount[]>>> {
  try {
    const rows = await db
      .select()
      .from(costRecord)
      .where(eq(costRecord.source, "entered"))
      .orderBy(desc(costRecord.periodStart), desc(costRecord.enteredAt));
    const out: Partial<Record<CostProvider, EnteredAmount[]>> = {};
    for (const r of rows) {
      const key = KEY_OF_ID[r.provider];
      if (!key) continue;
      (out[key] ??= []).push({
        id: r.id,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        amount: Number(r.amount),
        currency: r.currency,
        cadRate: Number(r.cadRate),
        note: r.note,
        enteredAt: new Date(r.enteredAt as unknown as string).toISOString(),
      });
    }
    return out;
  } catch (err) {
    console.error("[costs] could not read the entered amounts:", err);
    return {};
  }
}

/** An entered amount, written. */
export async function insertEnteredAmount(a: {
  provider: CostProvider;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  cadRate: number;
  note: string | null;
}): Promise<string> {
  const [row] = await db
    .insert(costRecord)
    .values({
      provider: PROVIDER_ID[a.provider],
      periodStart: a.periodStart,
      periodEnd: a.periodEnd,
      amount: a.amount.toFixed(2),
      currency: a.currency,
      cadRate: String(a.cadRate),
      source: "entered",
      note: a.note,
    })
    .returning({ id: costRecord.id });
  return row.id;
}

/** Removes one ENTERED amount; a live or counted one is never removed from here. True when one went. */
export async function deleteEnteredAmount(id: string): Promise<boolean> {
  const gone = await db
    .delete(costRecord)
    .where(and(eq(costRecord.id, id), eq(costRecord.source, "entered")))
    .returning({ id: costRecord.id });
  return gone.length > 0;
}
