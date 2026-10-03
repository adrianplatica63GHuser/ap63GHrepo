/**
 * Slice #37.65 — the Document's „Persoane", „Proprietăți" and „Acte corelate"
 * become one tile, „Corelate".
 *
 * The real tile over a real `QueryClient`, the edges mocked as in
 * one-line-rows.test.tsx (which keeps #37.64's row assertions). Here: the four
 * groups in Adrian's order with their icons, one selection across the tile,
 * one „Dezasociază" that removes the selected row's link through its kind's
 * route, the three „Asociază …" buttons, and the empty tile.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { DocumentRelatedTile } from "@/app/documents/_components/document-related-tile";
import { DOC_TILE_OF_TAB, documentTileRegistry } from "@/app/documents/_components/document-tiles";
import { parseStoredTiles, tilesOfTab } from "@/lib/ui/tiles";
import { LIST_UNITS, RELATED_UNITS } from "@/lib/ui/field-widths";

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
jest.mock("@/app/documents/_components/ai-reference-linker-dialog", () => ({ AiReferenceLinkerDialog: () => null }));

const person = (over: Record<string, unknown>) => ({
  linkId: "l", id: "p", code: "PPERS1", type: "NATURAL", displayName: "Ion",
  personRoleId: "r", roleName: "Vânzător", quality: null,
  cotaParte: null, cotaSuprafataMp: null, cotaMod: null, holdsShare: true, associatedAt: "",
  ...over,
});

// The API's order mixes the kinds; the tile groups them, keeping the order within a group.
const PERSONS = [
  person({ linkId: "l1", id: "c1", type: "JUDICIAL", displayName: "Firma SRL", roleName: "Cumpărător" }),
  person({ linkId: "l2", id: "p1", displayName: "Ion Vânzătorul" }),
  person({ linkId: "l3", id: "p2", displayName: "Ana A Doua", roleName: "Cumpărător" }),
];
const PROPERTIES = [{ id: "pr1", code: "PROP1", label: "Livada", associatedAt: "" }];
const REFERENCES = [{ id: "d1", code: "DOC1", typeName: "Plan", title: "PAD 1", associatedAt: "", relationshipRoleId: null, relationshipRoleName: null, roleReadsFromViewed: false }];

let calls: { url: string; method: string }[] = [];
let lists = { persons: PERSONS as unknown[], properties: PROPERTIES as unknown[], references: REFERENCES as unknown[] };

beforeEach(() => {
  calls = [];
  mockPush.mockReset();
  lists = { persons: PERSONS, properties: PROPERTIES, references: REFERENCES };
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET" });
    const json = url.endsWith("/persons") ? { items: lists.persons }
      : url.endsWith("/properties") ? { items: lists.properties }
      : url.endsWith("/references") ? { items: lists.references }
      : url.endsWith("/instrument-references") ? { read: false, items: [], documentTypes: [] }
      : {};
    return { ok: true, status: 200, json: async () => json };
  }) as unknown as typeof fetch;
});

function renderTile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><DocumentRelatedTile documentId="doc" label="Corelate" /></QueryClientProvider>);
}

const radio = (name: string) => screen.getByRole("radio", { name: new RegExp(`^${name}`) });

describe("„Corelate”", () => {
  it("lists natural persons, judicial persons, properties and documents, in that order, each with its kind's icon", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    const groups = [...document.querySelectorAll<HTMLElement>("[data-related-group]")];
    expect(groups.map((g) => g.dataset.relatedGroup)).toEqual(["natural", "judicial", "property", "document"]);
    // Within a group, the API's order.
    expect([...groups[0].querySelectorAll("[data-row-content]")].map((c) => c.textContent)).toEqual(["Ion Vânzătorul (Vânzător)", "Ana A Doua (Cumpărător)"]);
    const icons = groups.map((g) => g.querySelector("li svg")?.getAttribute("class") ?? "");
    expect(icons[0]).toMatch(/lucide-user\b/);
    expect(icons[1]).toMatch(/lucide-building-?2/);
    expect(icons[2]).toMatch(/lucide-map\b/);
    expect(icons[3]).toMatch(/lucide-file-text/);
    // The icon is decoration; the kind is read out with the row.
    expect(groups[1].querySelector("li svg")).toHaveAttribute("aria-hidden", "true");
    expect(groups[1].querySelector("li .sr-only")?.textContent).toBe("kind.judicial: ");
    // A thin line between two groups, no heading over them.
    expect(groups[0].className).not.toContain("border-t");
    expect(groups[1].className).toContain("border-t");
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("one selection across the tile, whatever the kind", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    fireEvent.click(radio("Livada"));
    expect(radio("Livada")).toBeChecked();
    fireEvent.click(radio("Firma SRL"));
    expect(radio("Firma SRL")).toBeChecked();
    expect(radio("Livada")).not.toBeChecked();
    expect(screen.getAllByRole("radio").filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
  });

  it.each([
    ["Firma SRL", "/api/documents/doc/persons/c1?linkId=l1"],
    ["Livada", "/api/documents/doc/properties/pr1"],
    ["PAD 1", "/api/documents/doc/references/d1"],
  ])("„Dezasociază” on %s removes its link through its kind's route", async (name, url) => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    const dissociate = screen.getByRole("button", { name: "dissociate" });
    expect(dissociate).toBeDisabled();
    fireEvent.click(radio(name));
    fireEvent.click(dissociate);
    await waitFor(() => expect(calls.filter((c) => c.method === "DELETE").map((c) => c.url)).toEqual([url]));
  });

  it("the three „Asociază …” open their screens, and are not offered while a row is selected", async () => {
    renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    const names = ["associatePerson", "associateProperty", "associateDocument"];
    const buttons = names.map((name) => screen.getByRole("button", { name }));
    buttons.forEach((b) => fireEvent.click(b));
    expect(mockPush.mock.calls.map((c) => c[0])).toEqual([
      "/documents/doc/associate-person",
      "/documents/doc/associate-property",
      "/documents/doc/associate-reference",
    ]);
    fireEvent.click(radio("Ion Vânzătorul"));
    for (const b of buttons) expect(b).toBeDisabled();
    // In one row with „Dezasociază" and „Înscrisuri citate", in that order.
    const row = buttons[0].closest("div.flex-wrap") as HTMLElement;
    expect(within(row).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
      ...names, "dissociate", "instrumentsButton",
    ]);
  });

  it("a group with no rows draws nothing; a tile with no rows at all says so in one line", async () => {
    lists = { persons: [], properties: PROPERTIES, references: [] };
    const { unmount } = renderTile();
    await screen.findByRole("group", { name: "Corelate" });
    expect([...document.querySelectorAll<HTMLElement>("[data-related-group]")].map((g) => g.dataset.relatedGroup)).toEqual(["property"]);
    unmount();
    lists = { persons: [], properties: [], references: [] };
    renderTile();
    expect(await screen.findByText("empty")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Corelate" })).toBeNull();
  });
});

describe("„Corelate” in the registry", () => {
  const CVC = { typeKey: "CONTRACT_VANZARE", tabs: ["Preț și taxe"], succession: false, pages: true };
  const PLAN = { typeKey: "PLAN_PARCELAR", tabs: [], succession: false, pages: true };

  it("lists related and not the three", () => {
    for (const layout of [CVC, PLAN]) {
      const all = documentTileRegistry(layout).all;
      expect(all).toContain("related");
      for (const was of ["persons", "properties", "associations"]) expect(all).not.toContain(was);
    }
  });

  it.each(["persons", "properties", "associations"])("a stored %s reads back as related, under any type's key", (was) => {
    for (const layout of [CVC, PLAN]) {
      expect(parseStoredTiles(JSON.stringify(["general", was]), documentTileRegistry(layout))).toEqual(["general", "related"]);
    }
    // All three stored together: one „Corelate".
    expect(parseStoredTiles(JSON.stringify(["persons", "properties", "associations"]), documentTileRegistry(CVC))).toEqual(["related"]);
  });

  it("?tab=persons, properties or related adds it — the association screens' „Înapoi” lands on it", () => {
    for (const tab of ["persons", "properties", "related"]) expect(tilesOfTab(DOC_TILE_OF_TAB, tab)).toEqual(["related"]);
  });

  it("is RELATED_UNITS (4) wide — the units #37.66 and #37.67 take", () => {
    expect(LIST_UNITS.document.related).toBe(RELATED_UNITS);
    expect(RELATED_UNITS).toBe(4);
  });
});
