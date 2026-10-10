/**
 * Slice #37.67 — on a Natural and a Judicial Person, „Persoane" („Persoane
 * corelate" on a company), „Proprietăți" and „Acte" become one tile,
 * „Corelate", built as the Document's and the Property's (#37.65, #37.66): the
 * same RelatedTile, rows and units, drawn once for both screens.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { PersonRelatedTile } from "@/app/natural-persons/_components/person-related-tile";
import { NP_TILE_OF_TAB, NP_TILE_REGISTRY, NP_TILES } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_OF_TAB, JP_TILE_REGISTRY, JP_TILES } from "@/app/judicial-persons/_components/person-tiles";
import { parseStoredTiles, tilesOfTab } from "@/lib/ui/tiles";
import { LIST_UNITS } from "@/lib/ui/field-widths";

const mockPush = jest.fn();
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedNavigate: jest.fn() }),
}));
jest.mock("@/components/tiles/preview-tiles", () => ({ PreviewButton: () => null }));

const REFERENCES = [
  { id: "c1", code: "JPERS1", type: "JUDICIAL", displayName: "Firma SRL", associatedAt: "", relationshipRoleId: "x", relationshipRoleName: "Reprezentant legal", roleShown: { kind: "role", name: "Reprezentat(ă) / Mandant(ă)" } }, // #38.70
  { id: "p1", code: "PPERS1", type: "NATURAL", displayName: "Maria", associatedAt: "", relationshipRoleId: "y", relationshipRoleName: "Soț", roleShown: { kind: "role", name: "Soț" } },
  { id: "p2", code: "PPERS2", type: "NATURAL", displayName: "Vasile", associatedAt: "", relationshipRoleId: "z", relationshipRoleName: "Moștenitor", roleShown: { kind: "held-by-viewed", name: "Moștenitor" } },
  { id: "p3", code: "PPERS3", type: "NATURAL", displayName: "Ana", associatedAt: "", relationshipRoleId: null, relationshipRoleName: null, roleShown: { kind: "none" } },
];
const PROPERTIES = [
  { id: "r1", code: "PROP2", label: "Teren", roleName: "Proprietar", associatedAt: "" },
  { id: "r2", code: "PROP3", label: "Vecina", roleName: null, associatedAt: "" },
];
const DOCUMENTS = [
  { linkId: "l1", id: "d1", code: "DOC1", typeName: "Contract de Vânzare", title: "CVC 1", roleName: "Vânzător", associatedAt: "" },
  { linkId: "l2", id: "d1", code: "DOC1", typeName: "Contract de Vânzare", title: "CVC 1", roleName: "Martor", associatedAt: "" },
  { linkId: "l3", id: "d2", code: "DOC2", typeName: "Certificat de moștenitor", title: "CM 1", roleName: "Defunct", associatedAt: "" },
  { linkId: "l4", id: "d3", code: "DOC3", typeName: "Plan", title: null, roleName: null, associatedAt: "" },
];

let calls: { url: string; method: string }[] = [];
beforeEach(() => {
  calls = [];
  mockPush.mockReset();
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET" });
    const json = url.endsWith("/references") ? { items: REFERENCES }
      : url.endsWith("/properties") ? { items: PROPERTIES }
      : url.endsWith("/documents") ? { items: DOCUMENTS }
      : {};
    return { ok: true, status: 200, json: async () => json };
  }) as unknown as typeof fetch;
});

function renderTile(backBase = "/natural-persons") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PersonRelatedTile personId="me" backBase={backBase} label="Corelate" /></QueryClientProvider>);
}

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByRole("radio", { name: new RegExp(`^${name}`) }).closest("li");
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

describe("a person's „Corelate”", () => {
  it("natural persons, judicial persons, properties, documents — one line each, „Nume (Rol)”, „Etichetă scurtă (Tip)”", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    const groups = [...document.querySelectorAll<HTMLElement>("[data-related-group]")];
    expect(groups.map((g) => g.dataset.relatedGroup)).toEqual(["natural", "judicial", "property", "document"]);
    expect(groups.map((g) => [...g.querySelectorAll("[data-row-content]")].map((c) => c.textContent))).toEqual([
      ["Maria (Soț)", "Vasile", "Ana"], // a role held by the viewed person is behind „Relația"; none, the name alone
      ["Firma SRL (Reprezentat(ă) / Mandant(ă))"],
      ["Teren (Proprietar)", "Vecina"],
      ["CVC 1 (Contract de Vânzare)", "CVC 1 (Contract de Vânzare)", "CM 1 (Certificat de moștenitor)", "Plan"],
    ]);
    for (const li of screen.getAllByRole("listitem")) {
      expect([...li.querySelectorAll<HTMLElement>("[data-slot]")].map((s) => s.dataset.slot)).toEqual(["share", "relation", "view", "preview"]);
      expect(li.className).toContain("whitespace-nowrap");
      expect(li.querySelector('[data-slot="share"]')?.childElementCount).toBe(0); // the share stays on the Document
    }
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("the person's role in a document is behind „Relația”, not in the content; a click outside hides it", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    const seller = rowOf("CVC 1 — Vânzător");
    expect(seller.textContent).not.toContain("Vânzător");
    fireEvent.click(within(seller).getByRole("button", { name: "relationship" }));
    expect(screen.getByRole("status")).toHaveTextContent("roleInDocument:Vânzător");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("status")).toBeNull();
    // A certificate party's „Defunct" is its role (Slice #38.38; a quality read
    // through `qualityDefunct` until then); a document with no role has no button.
    fireEvent.click(within(rowOf("CM 1 — Defunct")).getByRole("button", { name: "relationship" }));
    expect(screen.getByRole("status")).toHaveTextContent("roleInDocument:Defunct");
    expect(within(rowOf("document — —")).queryByRole("button", { name: "relationship" })).toBeNull();
  });

  it("a role with no converse, held by the person viewed, is a sentence behind „Relația”", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    expect(within(rowOf("Maria")).queryByRole("button", { name: "relationship" })).toBeNull();
    fireEvent.click(within(rowOf("Vasile")).getByRole("button", { name: "relationship" }));
    expect(screen.getByRole("status")).toHaveTextContent("roleHeldByViewed:Moștenitor");
  });

  it.each([
    ["Maria", "/api/people/me/references/p1"],
    ["Firma SRL", "/api/people/me/references/c1"],
    ["Teren", "/api/people/me/properties/r1"],
    ["CVC 1 — Martor", "/api/people/me/documents/d1?linkId=l2"],
  ])("„Dezasociază” on %s removes its link through its kind's route", async (name, url) => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${name}`) }));
    expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "dissociate" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual([url]));
  });

  it.each(["/natural-persons", "/judicial-persons"])("on %s the three „Asociază …” open associate-person, -property and -document", async (base) => {
    renderTile(base);
    await screen.findByRole("group", { name: "Corelate" });
    for (const name of ["associatePerson", "associateProperty", "associateDocument"]) fireEvent.click(screen.getByRole("button", { name }));
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
      `${base}/me/associate-person`,
      `${base}/me/associate-property`,
      `${base}/me/associate-document`,
    ]);
  });
});

describe.each([
  ["the Natural Person's", NP_TILES as readonly string[], NP_TILE_REGISTRY, NP_TILE_OF_TAB, "naturalPerson"],
  ["the Judicial Person's", JP_TILES as readonly string[], JP_TILE_REGISTRY, JP_TILE_OF_TAB, "judicialPerson"],
] as const)("„Corelate” in %s registry", (_n, tiles, registry, ofTab, screenKey) => {
  it("lists related and not the three", () => {
    expect(tiles).toContain("related");
    for (const was of ["associations", "properties", "documents"]) expect(tiles).not.toContain(was);
  });

  it.each(["associations", "properties", "documents"])("a stored %s reads back as related", (was) => {
    expect(parseStoredTiles(JSON.stringify(["identity", was]), registry as never)).toEqual(["identity", "related"]);
  });

  it("?tab=related, properties or document adds it; its units are the Document's", () => {
    for (const tab of ["related", "properties", "document"]) expect(tilesOfTab(ofTab as never, tab)).toEqual(["related"]);
    expect(LIST_UNITS[screenKey].related).toBe(LIST_UNITS.document.related);
  });
});
