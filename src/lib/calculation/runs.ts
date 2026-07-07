/**
 * DB query helpers for calculation_run + calculation_run_output  (Slice #20.09)
 *
 * Exposes four public functions:
 *   createCalculationRun       — insert a run row + output rows
 *   listCalculationRuns        — all runs, newest first (for the history list)
 *   getCalculationRun          — full detail for one run (for the history detail page)
 *   getPropertyCalculationSource — find the run that created a given property (if any)
 */

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { calculationRun, calculationRunOutput, groups, property } from "@/db/schema";
import type { DivisionComputation } from "./compute";

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export type CalcRunCreate = {
  inputText:       string;
  inputOptions:    { groupDescription: string; includeRoad: boolean; roadNickname: string };
  computation:     DivisionComputation;
  resultGroupId:   string;
  /** Array of { principalObjectId, outputRole } for every created entity */
  outputs:         { principalObjectId: string; outputRole: string }[];
  createdBy?:      string | null;
};

export type CalcRunListItem = {
  id:              string;
  code:            string;
  algorithmType:   string;
  status:          string;
  resultGroupId:   string | null;
  resultGroupCode: string | null;
  outputCount:     number;
  createdBy:       string | null;
  createdAt:       string;
};

export type CalcRunOutput = {
  principalObjectId: string;
  outputRole:        string;
  propertyId:        string | null;
  propertyCode:      string | null;
  propertyNickname:  string | null;
};

export type CalcRunDetail = {
  id:            string;
  code:          string;
  algorithmType: string;
  status:        string;
  inputParams:   { text: string; options: { groupDescription: string; includeRoad: boolean; roadNickname: string } };
  stepsLog:      DivisionComputation;
  resultGroupId: string | null;
  resultGroupCode: string | null;
  outputs:       CalcRunOutput[];
  createdBy:     string | null;
  createdAt:     string;
  notes:         string | null;
};

export type CalcSourceResult = {
  runId:   string;
  runCode: string;
  status:  string;
} | null;

// ---------------------------------------------------------------------------
// createCalculationRun
// ---------------------------------------------------------------------------

export async function createCalculationRun(input: CalcRunCreate): Promise<{ id: string; code: string }> {
  // Allocate a CALC code from the dedicated sequence.
  const codeResult = await db.execute<{ code: string }>(
    sql`SELECT 'CALC' || lpad(nextval('calculation_run_code_seq')::text, 5, '0') AS code`
  );
  const code = (codeResult.rows[0] as { code: string }).code;

  const inputParams = {
    text:    input.inputText,
    options: input.inputOptions,
  };

  const [runRow] = await db
    .insert(calculationRun)
    .values({
      code,
      algorithmType: "PARCEL_DIVISION",
      inputParams:   inputParams as unknown as Record<string, unknown>,
      stepsLog:      input.computation as unknown as Record<string, unknown>,
      resultGroupId: input.resultGroupId,
      status:        "active",
      createdBy:     input.createdBy ?? null,
    })
    .returning({ id: calculationRun.id, code: calculationRun.code });

  if (input.outputs.length > 0) {
    await db.insert(calculationRunOutput).values(
      input.outputs.map((o) => ({
        calculationRunId:  runRow.id,
        principalObjectId: o.principalObjectId,
        outputRole:        o.outputRole,
      })),
    );
  }

  return { id: runRow.id, code: runRow.code };
}

// ---------------------------------------------------------------------------
// listCalculationRuns
// ---------------------------------------------------------------------------

export async function listCalculationRuns(): Promise<CalcRunListItem[]> {
  const rows = await db
    .select({
      id:              calculationRun.id,
      code:            calculationRun.code,
      algorithmType:   calculationRun.algorithmType,
      status:          calculationRun.status,
      resultGroupId:   calculationRun.resultGroupId,
      resultGroupCode: groups.code,
      createdBy:       calculationRun.createdBy,
      createdAt:       calculationRun.createdAt,
      outputCount:     sql<number>`(
        SELECT COUNT(*) FROM calculation_run_output cro
        WHERE cro.calculation_run_id = calculation_run.id
      )::int`,
    })
    .from(calculationRun)
    .leftJoin(groups, eq(calculationRun.resultGroupId, groups.id))
    .orderBy(desc(calculationRun.createdAt));

  return rows.map((r) => ({
    id:              r.id,
    code:            r.code,
    algorithmType:   r.algorithmType,
    status:          r.status,
    resultGroupId:   r.resultGroupId ?? null,
    resultGroupCode: r.resultGroupCode ?? null,
    outputCount:     r.outputCount,
    createdBy:       r.createdBy ?? null,
    createdAt:       r.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// getCalculationRun
// ---------------------------------------------------------------------------

export async function getCalculationRun(id: string): Promise<CalcRunDetail | null> {
  const [run] = await db
    .select({
      id:              calculationRun.id,
      code:            calculationRun.code,
      algorithmType:   calculationRun.algorithmType,
      status:          calculationRun.status,
      inputParams:     calculationRun.inputParams,
      stepsLog:        calculationRun.stepsLog,
      resultGroupId:   calculationRun.resultGroupId,
      resultGroupCode: groups.code,
      notes:           calculationRun.notes,
      createdBy:       calculationRun.createdBy,
      createdAt:       calculationRun.createdAt,
    })
    .from(calculationRun)
    .leftJoin(groups, eq(calculationRun.resultGroupId, groups.id))
    .where(eq(calculationRun.id, id));

  if (!run) return null;

  // Load outputs with property details.
  const outputRows = await db
    .select({
      principalObjectId: calculationRunOutput.principalObjectId,
      outputRole:        calculationRunOutput.outputRole,
      propertyId:        property.id,
      propertyCode:      property.code,
      propertyNickname:  property.nickname,
    })
    .from(calculationRunOutput)
    .leftJoin(
      property,
      eq(calculationRunOutput.principalObjectId, property.principalObjectId),
    )
    .where(eq(calculationRunOutput.calculationRunId, id));

  return {
    id:              run.id,
    code:            run.code,
    algorithmType:   run.algorithmType,
    status:          run.status,
    inputParams:     run.inputParams as CalcRunDetail["inputParams"],
    stepsLog:        run.stepsLog as DivisionComputation,
    resultGroupId:   run.resultGroupId ?? null,
    resultGroupCode: run.resultGroupCode ?? null,
    notes:           run.notes ?? null,
    createdBy:       run.createdBy ?? null,
    createdAt:       run.createdAt.toISOString(),
    outputs:         outputRows.map((o) => ({
      principalObjectId: o.principalObjectId,
      outputRole:        o.outputRole,
      propertyId:        o.propertyId ?? null,
      propertyCode:      o.propertyCode ?? null,
      propertyNickname:  o.propertyNickname ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// getPropertyCalculationSource
// ---------------------------------------------------------------------------
//
// Returns the calculation_run that created a given property, identified by
// the property's principalObjectId. Returns null if none.

export async function getPropertyCalculationSource(
  propertyPrincipalObjectId: string,
): Promise<CalcSourceResult> {
  const [row] = await db
    .select({
      runId:   calculationRun.id,
      runCode: calculationRun.code,
      status:  calculationRun.status,
    })
    .from(calculationRunOutput)
    .innerJoin(calculationRun, eq(calculationRunOutput.calculationRunId, calculationRun.id))
    .where(eq(calculationRunOutput.principalObjectId, propertyPrincipalObjectId))
    .limit(1);

  if (!row) return null;
  return { runId: row.runId, runCode: row.runCode, status: row.status };
}

// ---------------------------------------------------------------------------
// getPropertyPrincipalObjectId  (convenience for the API route)
// ---------------------------------------------------------------------------
//
// Resolves a property UUID → its principal_object UUID (needed to query
// calculation_run_output).

export async function getPropertyPrincipalObjectId(
  propertyId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ principalObjectId: property.principalObjectId })
    .from(property)
    .where(eq(property.id, propertyId))
    .limit(1);
  return row?.principalObjectId ?? null;
}
