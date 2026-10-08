/**
 * What deleting a calculation run says before it happens.        (Slice #38.43)
 *
 * The run goes; what it created stays (Ask first 1). So the confirmation names
 * the run and counts what stays: „Calculul CALC00008 se șterge; cele 4
 * proprietăți și grupul create rămân." The count is the run's
 * `outputCount` — its parcels still in the archive, since deleting a property
 * removes its output row (src/lib/entities/delete.ts) — so a run whose parcels
 * are gone says so instead of promising four.
 *
 * Pure, so jest reads it without a database; the words are
 * `calculationHistory.delete.*` in both message files.
 */

/** A UUID as Postgres stores it — anything else is no run, refused before a query. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRunId(id: string): boolean {
  return UUID.test(id);
}

export type DeleteRunSubject = { code: string; outputCount: number; resultGroupCode: string | null };

/** The message key under `calculationHistory.delete` and its values. */
export function deleteRunBody(run: DeleteRunSubject): { key: "bodyWithGroup" | "bodyNoGroup"; values: { code: string; count: number } } {
  return {
    key: run.resultGroupCode ? "bodyWithGroup" : "bodyNoGroup",
    values: { code: run.code, count: Math.max(0, Math.trunc(run.outputCount)) },
  };
}
