/**
 * Slice #39.64 — the import's parties step offers ANAF for a company it is about to create, so the company arrives
 * complete. Rendered with ANAF's answer recorded (the route mocked through `fetch`), and the create's body read.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "ro-RO",
}));
jest.mock("next/navigation", () => ({ usePathname: () => "/admin/import" }));
jest.mock("@/components/help/help-hint", () => ({ HelpHint: () => null }));

import { AiPartyLinkerDialog, type AiExtractedParty } from "@/app/documents/_components/ai-party-linker-dialog";
import { readAnafAnswer } from "@/lib/anaf/company";
import { ACTIVE, INACTIVE } from "@/lib/anaf/recorded-answers";

function party(over: Partial<AiExtractedParty> = {}): AiExtractedParty {
  return {
    roleName: "Vânzător",
    personRoleId: "00000000-0000-4000-8000-0000000000aa",
    roleMissing: false,
    holdsShare: false,
    personType: "JUDICIAL",
    name: "Dedeman",
    firstName: null,
    lastName: null,
    cnp: null,
    cuiNumber: "RO 2816464",
    idDocumentNumber: null,
    idIssuingAuthority: null,
    domiciliu: null,
    rawText: "DEDEMAN SRL, CUI RO2816464",
    matchCandidate: null,
    possibleMatches: [],
    ...over,
  };
}

type Call = { url: string; method: string; body: unknown };

function routeAnswer(body: unknown, cui: string) {
  const a = readAnafAnswer(body, cui);
  if (a.kind !== "found") throw new Error("recorded answer must be found");
  return {
    kind: "found",
    version: "v9",
    company: a.company,
    proposedType: a.company.legalForm.includes("DEBUTANT") ? { id: "t-srld", name: "SRL-D" } : { id: "t-srl", name: "SRL" },
  };
}

function mockFetch(anaf: unknown): Call[] {
  const calls: Call[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
    // A plain object, not a `Response`: jsdom has no fetch API of its own.
    const json = (b: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, redirected: false, json: async () => b });
    if (url.startsWith("/api/judicial-persons/anaf")) return json(anaf);
    if (url === "/api/judicial-persons") return json({ person: { id: "new-jp" } }, 201);
    if (url.includes("/persons")) return json({ ok: true });
    return json({}, 404);
  }) as unknown as typeof fetch;
  return calls;
}

const wrap = (ui: ReactNode) => render(<>{ui}</>);

describe("the parties step: „Completează din ANAF” for a company about to be created", () => {
  it("offers it only for a juridical person with a CUI and no exact match", () => {
    mockFetch(routeAnswer(ACTIVE, "2816464"));
    const { unmount } = wrap(<AiPartyLinkerDialog documentId="d1" parties={[party()]} onClose={() => undefined} />);
    expect(document.querySelector("[data-party-anaf]")).not.toBeNull();
    unmount();
    wrap(<AiPartyLinkerDialog documentId="d1" parties={[party({ cuiNumber: null })]} onClose={() => undefined} />);
    expect(document.querySelector("[data-party-anaf]")).toBeNull();
  });

  it("asks ANAF by the CUI, shows the rows, and creates the company with what is ticked", async () => {
    const calls = mockFetch(routeAnswer(ACTIVE, "2816464"));
    const onClose = jest.fn();
    wrap(<AiPartyLinkerDialog documentId="d1" parties={[party()]} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    await waitFor(() => expect(document.querySelector("[data-anaf-changes]")).not.toBeNull());
    expect(calls[0].url).toBe("/api/judicial-persons/anaf?cui=2816464");
    // The reader's „Dedeman" is kept unless ticked; the empty fields are filled.
    const rows = [...document.querySelectorAll<HTMLElement>("[data-anaf-row]")].map((r) => [r.dataset.anafRow, r.dataset.anafKind]);
    expect(rows[0]).toEqual(["name", "replace"]);
    expect(rows).toContainEqual(["phone", "fill"]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "createAndLink" }));
    });
    await waitFor(() => expect(calls.some((c) => c.url === "/api/judicial-persons")).toBe(true));
    const create = calls.find((c) => c.url === "/api/judicial-persons")!.body as Record<string, unknown>;
    expect(create).toMatchObject({
      name: "Dedeman",
      cuiNumber: "2816464",
      phone: "0234513330",
      judicialPersonTypeId: "t-srl",
      addresses: [{ kind: "HEADQUARTERS", streetLine: "Str. Alexei Tolstoi nr. 8", postalCode: "600093", locality: "Mun. Bacău", county: "Bacău", country: "România" }],
    });
    expect(create).not.toHaveProperty("notes");
  });

  it("the name ticked: ANAF's name; an inactive company: the warning and its dated line in „Note”", async () => {
    const calls = mockFetch(routeAnswer(INACTIVE, "40000001"));
    wrap(<AiPartyLinkerDialog documentId="d1" parties={[party({ name: "Exemplu", cuiNumber: "40000001" })]} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    await waitFor(() => expect(document.querySelector("[data-anaf-inactive]")).not.toBeNull());
    const nameTick = document.querySelector<HTMLInputElement>('[data-anaf-row="name"] input')!;
    expect(nameTick.checked).toBe(false);
    fireEvent.click(nameTick);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "createAndLink" }));
    });
    await waitFor(() => expect(calls.some((c) => c.url === "/api/judicial-persons")).toBe(true));
    const create = calls.find((c) => c.url === "/api/judicial-persons")!.body as Record<string, string>;
    expect(create.name).toBe("EXEMPLU INACTIV SRL");
    expect(create.judicialPersonTypeId).toBe("t-srld");
    expect(create.tradeRegisterNumber).toBe("J40/1/2019");
    expect(create.notes).toMatch(/^ANAF \d\d\.\d\d\.\d{4}: inactivă fiscal din 03\.05\.2024\.$/);
  });

  it("without asking ANAF the create is as before: name, CUI, the reader's address", async () => {
    const calls = mockFetch(routeAnswer(ACTIVE, "2816464"));
    wrap(<AiPartyLinkerDialog documentId="d1" parties={[party({ domiciliu: "Bacău, str. Tolstoi 8" })]} onClose={() => undefined} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "createAndLink" }));
    });
    await waitFor(() => expect(calls.some((c) => c.url === "/api/judicial-persons")).toBe(true));
    const create = calls.find((c) => c.url === "/api/judicial-persons")!.body as Record<string, unknown>;
    expect(create).toEqual({
      name: "Dedeman",
      cuiNumber: "RO 2816464",
      addresses: [{ kind: "HEADQUARTERS", streetLine: "Bacău, str. Tolstoi 8", country: "România" }],
      provenance: expect.anything(),
    });
    expect(calls.some((c) => c.url.startsWith("/api/judicial-persons/anaf"))).toBe(false);
  });
});
