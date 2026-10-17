/**
 * @jest-environment node
 *
 * Slice #39.64 — a juridical person filled from ANAF by its CUI. The reader of ANAF's answer, the change list, the
 * call (spaced a second apart, one retry on a page that is not JSON) and the route — all against recorded answers,
 * because the sandbox and CI cannot reach ANAF. The live check is in the handover.
 */
jest.mock("@/lib/admin/value-lists/queries", () => ({
  listValues: jest.fn(async () => [
    { id: "t-srl", name: "SRL" },
    { id: "t-srld", name: "SRL-D" },
    { id: "t-other", name: "Altele" },
  ]),
}));
const mockLookup = jest.fn();
jest.mock("@/lib/anaf/lookup", () => {
  const actual = jest.requireActual("@/lib/anaf/lookup");
  return { ...actual, lookupAnafCompany: (...a: unknown[]) => mockLookup(...a) };
});

import type { NextRequest } from "next/server";
import {
  ANAF_URL,
  commaBelow,
  countyCase,
  normalizeCui,
  proposedTypeName,
  readAnafAnswer,
  typeIdByName,
  type AnafCompany,
} from "@/lib/anaf/company";
import {
  anafRows,
  anafTarget,
  appendNoteLine,
  applyAnafRows,
  defaultTaken,
  inactiveNoteLine,
  type AnafTarget,
} from "@/lib/anaf/fill";
import { ACTIVE, INACTIVE, NOT_FOUND } from "@/lib/anaf/recorded-answers";
import { GET } from "@/app/api/judicial-persons/anaf/route";

const { AnafUnavailable, lookupAnafCompany, resetAnafSpacing, ANAF_SPACING_MS } =
  jest.requireActual("@/lib/anaf/lookup") as typeof import("@/lib/anaf/lookup");

const EMPTY: AnafTarget = {
  name: "", tradeRegisterNumber: "", phone: "", judicialPersonTypeId: "",
  streetLine: "", postalCode: "", locality: "", county: "", country: "",
};

function found(body: unknown, cui: string): AnafCompany {
  const a = readAnafAnswer(body, cui);
  if (a.kind !== "found") throw new Error("expected found");
  return a.company;
}

describe("the CUI as typed", () => {
  it.each([
    ["2816464", "2816464"],
    ["RO2816464", "2816464"],
    ["ro 2816464", "2816464"],
    [" 28 16 464 ", "2816464"],
  ])("%s → %s", (input, want) => expect(normalizeCui(input)).toBe(want));
  it.each([[""], ["RO"], ["0123"], ["1"], ["12345678901"], ["J40/1/2019"], [null]])("%s is not a CUI", (input) =>
    expect(normalizeCui(input)).toBeNull());
});

describe("ANAF's answer, read", () => {
  it("an active company: name, phone, the structured head office, the legal form, no inactivity", () => {
    expect(found(ACTIVE, "2816464")).toEqual({
      cui: "2816464",
      name: "DEDEMAN SRL",
      tradeRegisterNumber: "",
      phone: "0234513330",
      address: { streetLine: "Str. Alexei Tolstoi nr. 8", postalCode: "600093", locality: "Mun. Bacău", county: "Bacău", country: "România" },
      legalForm: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ",
      inactiveSince: null,
      deregisteredOn: null,
    });
  });

  it("an inactive company: the date it became so; ş and ţ written with the comma below; capitals tamed", () => {
    const c = found(INACTIVE, "40000001");
    expect(c.inactiveSince).toBe("2024-05-03");
    expect(c.tradeRegisterNumber).toBe("J40/1/2019");
    expect(c.address).toEqual({
      streetLine: "Str. Exemplului nr. 1, Bl. A, Ap. 2",
      postalCode: "030000",
      locality: "Sector 3 Mun. București",
      county: "Municipiul București",
      country: "România",
    });
  });

  it("an unknown CUI is notFound (ANAF's own 404 body)", () => {
    expect(readAnafAnswer(NOT_FOUND, "1")).toEqual({ kind: "notFound" });
  });

  it("an answer of another shape throws, so the route can call it down", () => {
    expect(() => readAnafAnswer({ cod: 500 }, "1")).toThrow();
    expect(() => readAnafAnswer("<html>", "1")).toThrow();
  });

  it("no structured address: the general one as the street line, as ANAF wrote it", () => {
    const body = { found: [{ date_generale: { cui: 5, denumire: "X SRL", adresa: "JUD. CLUJ, MUN. CLUJ-NAPOCA, STR. A, NR.1" } }] };
    expect(found(body, "5").address).toEqual({
      streetLine: "JUD. CLUJ, MUN. CLUJ-NAPOCA, STR. A, NR.1", postalCode: "", locality: "", county: "", country: "România",
    });
  });

  it("helpers: comma below, county case", () => {
    expect(commaBelow("Şos. Virtuţii")).toBe("Șos. Virtuții");
    expect(countyCase("BACĂU")).toBe("Bacău");
    expect(countyCase("CARAŞ-SEVERIN")).toBe("Caraş-Severin");
    expect(countyCase("Prahova")).toBe("Prahova");
  });
});

describe("the „Tip” proposed from the legal form", () => {
  it.each([
    ["SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ", "SRL"],
    ["SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ - DEBUTANT", "SRL-D"],
    ["SOCIETATE COMERCIALĂ PE ACŢIUNI", "SA"],
    ["PERSOANĂ FIZICĂ AUTORIZATĂ", "PFA"],
    ["ÎNTREPRINDERE INDIVIDUALĂ", "II"],
    ["ÎNTREPRINDERE FAMILIALĂ", "IF"],
    ["ASOCIAŢIE", "ONG"],
    ["FUNDAŢIE", "ONG"],
    ["REGIE AUTONOMĂ", "Altele"],
    ["", null],
  ])("%s → %s", (form, want) => expect(proposedTypeName(form)).toBe(want));

  it("found in the list by name, without case or diacritics", () => {
    const types = [{ id: "a", name: "SRL" }, { id: "b", name: "Altele" }];
    expect(typeIdByName(types, "srl")).toBe("a");
    expect(typeIdByName(types, "SA")).toBeNull();
    expect(typeIdByName(types, null)).toBeNull();
  });
});

describe("what would change (Ask first 1)", () => {
  const company = found(ACTIVE, "2816464");
  const proposed = anafTarget(company, "t-srl");

  it("an empty record: every field ANAF fills, all ticked", () => {
    const rows = anafRows(EMPTY, proposed);
    expect(rows.map((r) => [r.field, r.kind])).toEqual([
      ["name", "fill"], ["phone", "fill"], ["judicialPersonTypeId", "fill"],
      ["streetLine", "fill"], ["postalCode", "fill"], ["locality", "fill"], ["county", "fill"], ["country", "fill"],
    ]);
    expect([...defaultTaken(rows)]).toHaveLength(8);
  });

  it("a value that differs is shown old → new and not taken unless ticked; the same value is not shown", () => {
    const current = { ...EMPTY, name: "Dedeman", phone: "0234 513 330", county: "BACĂU" };
    const rows = anafRows(current, proposed);
    const name = rows.find((r) => r.field === "name")!;
    expect(name).toEqual({ field: "name", current: "Dedeman", proposed: "DEDEMAN SRL", kind: "replace" });
    expect(rows.find((r) => r.field === "county")).toBeUndefined(); // „BACĂU" is „Bacău"
    expect(rows.find((r) => r.field === "phone")?.kind).toBe("replace"); // spacing inside differs
    expect(defaultTaken(rows).has("name")).toBe(false);
    const applied = applyAnafRows(current, rows, defaultTaken(rows));
    expect(applied.name).toBe("Dedeman");
    expect(applied.locality).toBe("Mun. Bacău");
    expect(applyAnafRows(current, rows, new Set(["name"])).name).toBe("DEDEMAN SRL");
  });

  it("a field ANAF leaves empty is never offered — it never blanks the record", () => {
    const rows = anafRows({ ...EMPTY, tradeRegisterNumber: "J04/2621/1992" }, proposed);
    expect(rows.find((r) => r.field === "tradeRegisterNumber")).toBeUndefined();
  });
});

describe("an inactive company's line in „Note” (Ask first 2)", () => {
  it("dated, with the date it became inactive", () => {
    expect(inactiveNoteLine(found(INACTIVE, "40000001"), "2026-10-17")).toBe("ANAF 17.10.2026: inactivă fiscal din 03.05.2024.");
    expect(inactiveNoteLine(found(ACTIVE, "2816464"), "2026-10-17")).toBeNull();
  });
  it("appended on its own line, once, and only when it fits in 300 characters", () => {
    expect(appendNoteLine("", "L")).toBe("L");
    expect(appendNoteLine("Prima notă.\n", "L")).toBe("Prima notă.\nL");
    expect(appendNoteLine("a\nL", "L")).toBe("a\nL");
    expect(appendNoteLine("x".repeat(299), "L")).toBeNull();
  });
});

describe("the call (Ask first 3: one per click, spaced apart — three seconds, measured)", () => {
  beforeEach(() => resetAnafSpacing());
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("posts the CUI as a number with the day, to v9", async () => {
    const fetchImpl = jest.fn(async () => json(200, ACTIVE));
    const a = await lookupAnafCompany("2816464", { fetchImpl: fetchImpl as unknown as typeof fetch, day: "2026-10-17" });
    expect(a.kind).toBe("found");
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toBe(ANAF_URL);
    expect(ANAF_URL).toBe("https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva");
    expect(JSON.parse(String(calls[0][1].body))).toEqual([{ cui: 2816464, data: "2026-10-17" }]);
  });

  it("a 404 with ANAF's body is notFound, not down", async () => {
    const a = await lookupAnafCompany("1", { fetchImpl: (async () => json(404, NOT_FOUND)) as unknown as typeof fetch });
    expect(a).toEqual({ kind: "notFound" });
  });

  it("a 500, a network error, or three pages that are not JSON are down", async () => {
    const sleep = async () => undefined;
    await expect(lookupAnafCompany("2", { fetchImpl: (async () => json(500, {})) as unknown as typeof fetch, sleep })).rejects.toBeInstanceOf(AnafUnavailable);
    await expect(lookupAnafCompany("2", { fetchImpl: (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch, sleep })).rejects.toBeInstanceOf(AnafUnavailable);
    const html = jest.fn(async () => new Response("<html><body>Request Rejected</body></html>", { status: 200 }));
    await expect(lookupAnafCompany("2", { fetchImpl: html as unknown as typeof fetch, sleep })).rejects.toThrow(/not JSON: „Request Rejected"/);
    expect(html).toHaveBeenCalledTimes(3);
  });

  it("a page that is not JSON, then the answer: found — asked again", async () => {
    let n = 0;
    const fetchImpl = jest.fn(async () => (n++ === 0 ? new Response("<html>busy</html>", { status: 200 }) : json(200, ACTIVE)));
    const a = await lookupAnafCompany("2816464", { fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => undefined });
    expect(a.kind).toBe("found");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("two clicks a moment apart: the second waits until the spacing has passed", async () => {
    let clock = 10_000;
    const waits: number[] = [];
    const deps = {
      now: () => clock,
      sleep: async (ms: number) => { waits.push(ms); clock += ms; },
      fetchImpl: (async () => { clock += 100; return json(200, ACTIVE); }) as unknown as typeof fetch,
    };
    await Promise.all([lookupAnafCompany("2816464", deps), lookupAnafCompany("2816464", deps)]);
    expect(waits).toEqual([ANAF_SPACING_MS - 100]);
  });
});

describe("GET /api/judicial-persons/anaf", () => {
  const get = (cui: string) => GET(new Request(`http://localhost/api/judicial-persons/anaf?cui=${encodeURIComponent(cui)}`) as unknown as NextRequest);
  beforeEach(() => mockLookup.mockReset());

  it("found: the company and the proposed type from Reference Data", async () => {
    mockLookup.mockResolvedValue(readAnafAnswer(ACTIVE, "2816464"));
    const res = await get("RO 2816464");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(mockLookup).toHaveBeenCalledWith("2816464");
    expect(body).toMatchObject({ kind: "found", version: "v9", company: { name: "DEDEMAN SRL" }, proposedType: { id: "t-srl", name: "SRL" } });
  });

  it("an inactive SRL-D: SRL-D proposed, the inactivity carried", async () => {
    mockLookup.mockResolvedValue(readAnafAnswer(INACTIVE, "40000001"));
    const body = await (await get("40000001")).json();
    expect(body.proposedType).toEqual({ id: "t-srld", name: "SRL-D" });
    expect(body.company.inactiveSince).toBe("2024-05-03");
  });

  it("not found, a bad CUI, ANAF down", async () => {
    mockLookup.mockResolvedValue({ kind: "notFound" });
    expect(await (await get("1234")).json()).toEqual({ kind: "notFound", version: "v9" });
    const bad = await get("abc");
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("badCui");
    mockLookup.mockRejectedValue(new AnafUnavailable("ANAF answered HTTP 503"));
    const down = await get("1234");
    expect(down.status).toBe(502);
    expect((await down.json()).code).toBe("anafDown");
  });
});
