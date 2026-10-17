/**
 * The import's tarla step, client side: the read, the write, and what the row says afterwards.   (Slice #39.69)
 *
 * Client-safe (fetch only). The import calls `readTarlaPlan` for a document whose type is „Plan parcelar" after its
 * general read; a reading with a tarla code queues the step (`TarlaPlanDialog`), and the user's „Creează" / „Leagă"
 * calls `applyTarlaPlanRequest`. The row then carries a `TarlaPlanRowState`, which `tarlaPlanRowNote` turns into the
 * one sentence the row and the saved report both print.
 */
import type { TarlaPlanParcel, TarlaPlanReading } from "./plan-read";

export type TarlaPlanReadResult =
  | { ok: true; reading: TarlaPlanReading }
  | { ok: false; reason: string };

export async function readTarlaPlan(documentId: string, fetchImpl: typeof fetch = fetch): Promise<TarlaPlanReadResult> {
  try {
    const res = await fetchImpl(`/api/documents/${documentId}/tarla-plan`, { method: "POST" });
    const body = (await res.json().catch(() => null)) as { reading?: TarlaPlanReading; error?: string; code?: string } | null;
    if (res.redirected) return { ok: false, reason: "session-expired" };
    if (!res.ok || !body?.reading) return { ok: false, reason: body?.code ?? `HTTP ${res.status}` };
    return { ok: true, reading: body.reading };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "network" };
  }
}

export type TarlaPlanApplyBody = {
  documentId: string;
  indicativ: string;
  locality: string | null;
  county: string | null;
  parcels: TarlaPlanParcel[];
};

export type TarlaPlanApplyResult =
  | { ok: true; tarlaId: string; created: boolean; parcelsAdded: number; parcelsKept: number }
  | { ok: false; reason: string };

export async function applyTarlaPlanRequest(body: TarlaPlanApplyBody, fetchImpl: typeof fetch = fetch): Promise<TarlaPlanApplyResult> {
  try {
    const res = await fetchImpl("/api/tarlale/from-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | { tarlaId?: string; created?: boolean; parcelsAdded?: number; parcelsKept?: number; code?: string }
      | null;
    if (!res.ok || !json?.tarlaId) return { ok: false, reason: json?.code ?? `HTTP ${res.status}` };
    return {
      ok: true,
      tarlaId: json.tarlaId,
      created: json.created === true,
      parcelsAdded: json.parcelsAdded ?? 0,
      parcelsKept: json.parcelsKept ?? 0,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "network" };
  }
}

/** What happened to a plan's tarla, on its import row. */
export type TarlaPlanRowState =
  | { status: "pending"; code: string }
  | { status: "created" | "linked"; code: string; tarlaId: string; parcelsAdded: number }
  | { status: "skipped"; code: string }
  | { status: "no-code" }
  | { status: "failed"; reason: string };

/** The message key under `adminImport.wizard.importDialog` and its values, for the row and the report. */
export function tarlaPlanRowNote(state: TarlaPlanRowState | undefined): { key: string; values: Record<string, string | number> } | null {
  if (state === undefined) return null;
  switch (state.status) {
    case "pending":
      return { key: "tarlaPlanPending", values: { code: state.code } };
    case "created":
      return { key: "tarlaPlanCreated", values: { code: state.code, count: state.parcelsAdded } };
    case "linked":
      return { key: "tarlaPlanLinked", values: { code: state.code, count: state.parcelsAdded } };
    case "skipped":
      return { key: "tarlaPlanSkipped", values: { code: state.code } };
    case "no-code":
      return { key: "tarlaPlanNoCode", values: {} };
    case "failed":
      return { key: "tarlaPlanFailed", values: {} };
  }
}
