/**
 * @jest-environment node
 *
 * Slice #38.43 — a calculation run can be deleted.
 *
 * The route refuses what is no run (a non-UUID before any query, an unknown
 * UUID after it), passes the access check's refusal through, and answers the
 * deleted run's code. The confirmation counts what stays, in both languages.
 *
 * jest cannot load intl-messageformat (ESM), so the one plural in each message
 * is chosen here the way ICU does: an exact `=N` arm first, then the
 * language's plural category (Intl.PluralRules), `#` read as the count.
 */

import fs from "node:fs";
import path from "node:path";

const denied = { current: null as Response | null };
jest.mock("@/lib/auth/current-role", () => ({ requireFullAccess: jest.fn(async () => denied.current) }));
const deleteCalculationRun = jest.fn();
jest.mock("@/lib/calculation/runs", () => ({
  deleteCalculationRun: (...a: unknown[]) => deleteCalculationRun(...a),
  getCalculationRun: jest.fn(),
}));

import type { NextRequest } from "next/server";
import { DELETE } from "@/app/api/calculation/runs/[id]/route";
import { deleteRunBody, isRunId } from "@/lib/calculation/delete-run";

const RUN = "6f1c2b9e-3d4a-4f5b-8c7d-1e2f3a4b5c6d";
const call = (id: string) => DELETE({} as NextRequest, { params: Promise.resolve({ id }) });

beforeEach(() => {
  denied.current = null;
  deleteCalculationRun.mockReset();
});

describe("DELETE /api/calculation/runs/[id]", () => {
  it("refuses an id that is not a UUID with 404, before any query", async () => {
    const res = await call("CALC00001");
    expect(res.status).toBe(404);
    expect(deleteCalculationRun).not.toHaveBeenCalled();
  });

  it("refuses an unknown run with 404", async () => {
    deleteCalculationRun.mockResolvedValue(null);
    const res = await call(RUN);
    expect(res.status).toBe(404);
    expect(deleteCalculationRun).toHaveBeenCalledWith(RUN);
  });

  it("answers the deleted run's code", async () => {
    deleteCalculationRun.mockResolvedValue({ code: "CALC00008" });
    const res = await call(RUN);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: "CALC00008" });
  });

  it("passes the access check's refusal through, deleting nothing", async () => {
    denied.current = Response.json({ error: "Forbidden" }, { status: 403 });
    const res = await call(RUN);
    expect(res.status).toBe(403);
    expect(deleteCalculationRun).not.toHaveBeenCalled();
  });

  it("isRunId takes a UUID in either case and nothing else", () => {
    expect(isRunId(RUN)).toBe(true);
    expect(isRunId(RUN.toUpperCase())).toBe(true);
    expect(isRunId(`${RUN}x`)).toBe(false);
    expect(isRunId("")).toBe(false);
  });
});

type Msgs = { calculationHistory: { delete: Record<string, string> } };
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", f), "utf8")) as Msgs;
const RO = read("ro-RO.json").calculationHistory.delete;
const EN = read("en-GB.json").calculationHistory.delete;

/** `{code}` replaced, and the one `{count, plural, …}` chosen as ICU chooses. */
function format(msg: string, locale: string, values: { code: string; count: number }): string {
  const start = msg.indexOf("{count, plural,");
  let depth = 0;
  let end = start;
  for (; end < msg.length; end++) {
    if (msg[end] === "{") depth++;
    if (msg[end] === "}" && --depth === 0) break;
  }
  const body = msg.slice(start + "{count, plural,".length, end);
  const arms = new Map<string, string>();
  for (const m of body.matchAll(/\s*(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g)) arms.set(m[1], m[2]);
  const arm = arms.get(`=${values.count}`) ?? arms.get(new Intl.PluralRules(locale).select(values.count)) ?? arms.get("other")!;
  return (msg.slice(0, start) + arm.replace(/#/g, String(values.count)) + msg.slice(end + 1)).replace("{code}", values.code);
}

describe("the confirmation counts what stays", () => {
  const say = (count: number, group: string | null, msgs = RO, locale = "ro") => {
    const b = deleteRunBody({ code: "CALC00008", outputCount: count, resultGroupCode: group });
    return format(msgs[b.key], locale, b.values);
  };

  it("four parcels and a group — the header's sentence", () => {
    expect(say(4, "GRP-050")).toBe("Calculul CALC00008 se șterge; cele 4 proprietăți și grupul create rămân.");
  });

  it("one, twenty, none — and no group", () => {
    expect(say(1, "GRP-050")).toBe("Calculul CALC00008 se șterge; proprietatea și grupul create rămân.");
    expect(say(20, null)).toBe("Calculul CALC00008 se șterge; cele 20 de proprietăți create rămân.");
    expect(say(0, null)).toBe("Calculul CALC00008 se șterge; proprietățile pe care le crease au fost deja șterse.");
    expect(say(3, null)).toBe("Calculul CALC00008 se șterge; cele 3 proprietăți create rămân.");
  });

  it("in English too", () => {
    expect(say(4, "GRP-050", EN, "en")).toBe("Calculation CALC00008 is deleted; the 4 properties and the group it created stay.");
    expect(say(1, null, EN, "en")).toBe("Calculation CALC00008 is deleted; the property it created stays.");
  });

  it("the key follows the group, and a count is never negative or fractional", () => {
    expect(deleteRunBody({ code: "C", outputCount: 2, resultGroupCode: null }).key).toBe("bodyNoGroup");
    expect(deleteRunBody({ code: "C", outputCount: 2, resultGroupCode: "G" }).key).toBe("bodyWithGroup");
    expect(deleteRunBody({ code: "C", outputCount: -1, resultGroupCode: null }).values.count).toBe(0);
    expect(deleteRunBody({ code: "C", outputCount: 2.7, resultGroupCode: null }).values.count).toBe(2);
  });

  it("every word exists in both languages", () => {
    for (const k of ["action", "title", "bodyWithGroup", "bodyNoGroup", "confirm", "deleting", "cancel", "error"]) {
      expect([k, typeof RO[k], typeof EN[k]]).toEqual([k, "string", "string"]);
    }
  });
});
