/**
 * Slice #37.66 — the Property's „Proprietăți corelate", „Persoane" and „Acte"
 * become one tile, „Corelate", built as the Document's (#37.64, #37.65): the
 * same RelatedTile, rows and units.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { PropertyRelatedTile } from "@/app/properties/_components/property-related-tile";
import { PROP_TILE_OF_TAB, PROP_TILE_REGISTRY, PROP_TILES } from "@/app/properties/_components/property-tiles";
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

const PERSONS = [
  { id: "c1", code: "JPERS1", type: "JUDICIAL", displayName: "Firma SRL", roleName: "Proprietar", associatedAt: "" },
  { id: "p1", code: "PPERS1", type: "NATURAL", displayName: "Ion", roleName: null, associatedAt: "" },
];
const REFERENCES = [
  { id: "r1", code: "PROP2", label: "Parcela mare", associatedAt: "", relationshipRoleId: "x", relationshipRoleName: "Inclus în", roleReadsFromViewed: true },
  { id: "r2", code: "PROP3", label: "Vecina", associatedAt: "", relationshipRoleId: null, relationshipRoleName: null, roleReadsFromViewed: false },
];
const DOCUMENTS = [{ id: "d1", code: "DOC1", typeName: "Contract de Vânzare", title: "CVC 1", associatedAt: "" }];

let calls: { url: string; method: string }[] = [];
beforeEach(() => {
  calls = [];
  mockPush.mockReset();
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET" });
    const json = url.endsWith("/persons") ? { items: PERSONS }
      : url.endsWith("/references") ? { items: REFERENCES }
      : url.endsWith("/documents") ? { items: DOCUMENTS }
      : {};
    return { ok: true, status: 200, json: async () => json };
  }) as unknown as typeof fetch;
});

function renderTile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PropertyRelatedTile propertyId="prop" label="Corelate" /></QueryClientProvider>);
}

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByRole("radio", { name: new RegExp(`^${name}`) }).closest("li");
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

describe("the Property's „Corelate”", () => {
  it("natural persons, judicial persons, properties, documents — one line each, „Nume (Rol)”, „Etichetă scurtă (Tip)”", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    const groups = [...document.querySelectorAll<HTMLElement>("[data-related-group]")];
    expect(groups.map((g) => g.dataset.relatedGroup)).toEqual(["natural", "judicial", "property", "document"]);
    expect(groups.map((g) => [...g.querySelectorAll("[data-row-content]")].map((c) => c.textContent))).toEqual([
      ["Ion"], // no role: the name alone
      ["Firma SRL (Proprietar)"],
      ["Parcela mare", "Vecina"],
      ["CVC 1 (Contract de Vânzare)"],
    ]);
    for (const li of screen.getAllByRole("listitem")) {
      expect([...li.querySelectorAll<HTMLElement>("[data-slot]")].map((s) => s.dataset.slot)).toEqual(["share", "relation", "view", "preview"]);
      expect(li.className).toContain("whitespace-nowrap");
    }
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("no share button on this screen — the share is a person's link to a document", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    expect(screen.queryByRole("button", { name: "share" })).toBeNull();
    for (const li of screen.getAllByRole("listitem")) expect(li.querySelector('[data-slot="share"]')?.childElementCount).toBe(0);
  });

  it("a related property's relationship is behind „Relația”, a sentence that reads one way; a click outside hides it", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    expect(within(rowOf("Vecina")).queryByRole("button", { name: "relationship" })).toBeNull();
    expect(within(rowOf("CVC 1")).queryByRole("button", { name: "relationship" })).toBeNull(); // a property's documents carry no role
    expect(rowOf("Parcela mare").textContent).not.toContain("Inclus în");
    fireEvent.click(within(rowOf("Parcela mare")).getByRole("button", { name: "relationship" }));
    expect(screen.getByRole("status")).toHaveTextContent("roleForward:Inclus în|Parcela mare");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([
    ["Firma SRL", "/api/properties/prop/persons/c1"],
    ["Parcela mare", "/api/properties/prop/references/r1"],
    ["CVC 1", "/api/properties/prop/documents/d1"],
  ])("„Dezasociază” on %s removes its link through its kind's route", async (name, url) => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${name}`) }));
    fireEvent.click(screen.getByRole("button", { name: "dissociate" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual([url]));
  });

  it("„Asociază persoană”, „Asociază proprietate”, „Asociază act” open associate-person, -reference and -document", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    for (const name of ["associatePerson", "associateProperty", "associateDocument"]) fireEvent.click(screen.getByRole("button", { name }));
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
      "/properties/prop/associate-person",
      "/properties/prop/associate-reference",
      "/properties/prop/associate-document",
    ]);
  });
});

describe("„Corelate” in the Property's registry", () => {
  it("lists related and not the three, on the left beside the map column", () => {
    expect(PROP_TILES).toContain("related");
    for (const was of ["associations", "persons", "documents"]) expect(PROP_TILES as readonly string[]).not.toContain(was);
    expect(PROP_TILE_REGISTRY.placement?.right).not.toContain("related");
  });

  it.each(["associations", "persons", "documents"])("a stored %s reads back as related", (was) => {
    expect(parseStoredTiles(JSON.stringify(["cadastral", was]), PROP_TILE_REGISTRY)).toEqual(["cadastral", "related"]);
  });

  it("?tab=related, persons or document adds it; its units are the Document's", () => {
    for (const tab of ["related", "persons", "document"]) expect(tilesOfTab(PROP_TILE_OF_TAB, tab)).toEqual(["related"]);
    expect(LIST_UNITS.property.related).toBe(LIST_UNITS.document.related);
  });
});
