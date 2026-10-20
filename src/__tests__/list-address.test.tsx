/**
 * #39.26 — Back from a record returns to the list exactly as it was, open tiles included.
 *
 * Adrian, 2026-10-13: „I expect the back button will take me to the exactly the same screen I was on". The four
 * principal lists keep their search, page, own filters and the open row tiles in their address (`?q=…&page=…&row=…
 * &tiles=…`, replacing the history entry), and the page's scroll in the session by history slot. TC-TILES-11 step 12
 * drives the round trip in the browser.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  LIST_PARAM,
  MAX_SCROLL_MEMORY,
  MAX_SEARCH,
  carryListAddress,
  keepScroll,
  queryOf,
  readListAddress,
  scrollFor,
  writeListAddress,
} from "@/lib/ui/list-address";
import { ListPreviewRow, ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { IncursionButton, LinksButton } from "@/components/tiles/incursion-button";
import type { PreviewTarget } from "@/lib/ui/previews";

jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({ useUnsavedChanges: () => ({ guardedNavigate: jest.fn() }) }));
jest.mock("@/components/tiles/preview-data", () => ({ loadPreview: async (t: { id: string }) => ({ title: `Ion ${t.id}`, fields: {} }) }));
jest.mock("next/navigation", () => ({ usePathname: () => "/natural-persons", useSearchParams: () => new URLSearchParams(window.location.search) }));

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const params = (s: string) => new URLSearchParams(s);
const LISTS = [
  ["natural-persons", "person", "NaturalPersonListView"],
  ["judicial-persons", "company", "JudicialPersonListView"],
  ["properties", "property", "PropertyListView"],
  ["documents", "document", "DocumentListView"],
] as const;

describe("the address's rules (pure)", () => {
  it("reads what a list wrote: search, page from 1, its own filters, the row and its tiles in the column's order", () => {
    const a = readListAddress(params("q=Ion&page=3&expiring=1&field=f&value=v&row=r1&tiles=peek,preview&documentTypeIds=t"), ["expiring", "field", "value"]);
    expect(a).toEqual({ search: "Ion", page: 2, filters: { expiring: "1", field: "f", value: "v" }, row: "r1", tiles: ["preview", "peek"] });
  });

  it("reads anything malformed as unset — a list never refuses to open over its address", () => {
    expect(readListAddress(params("page=0")).page).toBe(0);
    expect(readListAddress(params("page=-2")).page).toBe(0);
    expect(readListAddress(params("page=abc")).page).toBe(0);
    expect(readListAddress(params("page=99999999")).page).toBe(0);
    // A row without tiles, or tiles without a row, opens nothing; an unknown tile is dropped.
    expect(readListAddress(params("row=r1"))).toMatchObject({ row: null, tiles: [] });
    expect(readListAddress(params("tiles=preview"))).toMatchObject({ row: null, tiles: [] });
    expect(readListAddress(params("row=r1&tiles=map,links"))).toMatchObject({ row: "r1", tiles: ["links"] });
    expect(readListAddress(params(`q=${"x".repeat(MAX_SEARCH + 50)}`)).search).toHaveLength(MAX_SEARCH);
    // A filter the list does not name is not its own.
    expect(readListAddress(params("expiring=1")).filters).toEqual({});
  });

  it("writes a patch and leaves the rest alone; empty, page 1 or no tiles take their keys out", () => {
    const base = params("documentTypeIds=t&q=old&page=4&row=r1&tiles=preview");
    expect(writeListAddress(base, { search: "Ion " }).toString()).toBe("documentTypeIds=t&q=Ion&page=4&row=r1&tiles=preview");
    expect(writeListAddress(base, { page: 0 }).toString()).toBe("documentTypeIds=t&q=old&row=r1&tiles=preview");
    expect(writeListAddress(base, { page: 1 }).get(LIST_PARAM.page)).toBe("2");
    expect(writeListAddress(base, { row: "r2", tiles: ["peek", "preview"] }).toString()).toBe("documentTypeIds=t&q=old&page=4&row=r2&tiles=preview%2Cpeek");
    expect(writeListAddress(base, { row: null, tiles: [] }).toString()).toBe("documentTypeIds=t&q=old&page=4");
    expect(writeListAddress(base, { filters: { expiring: "", field: "f" } }).toString()).toBe("documentTypeIds=t&q=old&page=4&row=r1&tiles=preview&field=f");
    expect(queryOf(params(""))).toBe("");
    expect(queryOf(params("q=a"))).toBe("?q=a");
  });

  it("a new filter carries the search and the list's filters — not the page, not the tiles, not other keys", () => {
    const carried = carryListAddress(params("q=Ion&page=3&row=r&tiles=preview&expiring=1&documentTypeIds=t&x=y"), ["expiring", "field"]);
    expect(carried.toString()).toBe("q=Ion&expiring=1");
  });

  it("keeps the scroll by list and history slot, newest last, the oldest dropped", () => {
    let m = keepScroll([], "/a#1", 120.4);
    m = keepScroll(m, "/a#2", 30);
    m = keepScroll(m, "/a#1", 200);
    expect(m).toEqual([["/a#2", 30], ["/a#1", 200]]);
    expect(scrollFor(m, "/a#1")).toBe(200);
    expect(scrollFor(m, "/a#3")).toBeNull();
    expect(scrollFor([["/a#1", -5]], "/a#1")).toBeNull();
    for (let i = 0; i < MAX_SCROLL_MEMORY + 5; i++) m = keepScroll(m, `/b#${i}`, i);
    expect(m).toHaveLength(MAX_SCROLL_MEMORY);
    expect(scrollFor(m, "/a#1")).toBeNull();
    expect(scrollFor(m, `/b#${MAX_SCROLL_MEMORY + 4}`)).toBe(MAX_SCROLL_MEMORY + 4);
  });
});

describe("the row tiles start from the address and write back into it", () => {
  function Stub({ target, view }: { target: PreviewTarget; view: string }) {
    return <section data-incursion={target.kind} data-for={target.id} data-incursion-view={view} />;
  }
  const draw = (address: { row: string | null; tiles: ("preview" | "links" | "peek")[] }, rowIds?: string[]) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ListPreviews incursion={Stub} rowIds={rowIds} address={{ kind: "person", ...address }}>
          <ListPreviewRow>
            <table>
              <tbody>
                {["A", "B"].map((id) => (
                  <tr key={id}>
                    <td data-row={id}>
                      <PreviewButton target={{ kind: "person", id }} />
                      <IncursionButton target={{ kind: "person", id }} />
                      <LinksButton target={{ kind: "person", id }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ListPreviewRow>
        </ListPreviews>
      </QueryClientProvider>,
    );
  const views = () => [...document.querySelectorAll("[data-list-row-tiles] > *")].map((c) => (c.hasAttribute("data-preview") ? "preview" : c.getAttribute("data-incursion-view")));
  beforeEach(() => window.history.replaceState(null, "", "/natural-persons?q=Ion"));

  it("opens on mount the tiles the address held, on its row, its three pressed", async () => {
    window.history.replaceState(null, "", "/natural-persons?q=Ion&row=B&tiles=preview,peek");
    await act(async () => {
      draw({ row: "B", tiles: ["preview", "peek"] }, ["A", "B"]);
    });
    expect(views()).toEqual(["preview", "peek"]);
    expect(document.querySelector('[data-row="B"] [data-incursion-toggle]')).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector('[data-row="A"] [data-incursion-toggle]')).toBeDisabled();
  });

  it("a row no longer on the page opens nothing, and the address loses it (Ask first #3)", async () => {
    window.history.replaceState(null, "", "/natural-persons?q=Ion&row=Z&tiles=links");
    await act(async () => {
      draw({ row: "Z", tiles: ["links"] }, ["A", "B"]);
    });
    expect(document.querySelector("[data-list-row-tiles]")).toBeNull();
    expect(window.location.search).toBe("?q=Ion");
  });

  it("writes every change into the address, replacing the entry — never a new one", async () => {
    const before = window.history.length;
    await act(async () => {
      draw({ row: null, tiles: [] }, ["A", "B"]);
    });
    await act(async () => fireEvent.click(document.querySelector('[data-row="A"] [data-links-toggle]')!));
    await act(async () => fireEvent.click(document.querySelector('[data-row="A"] [data-preview-toggle]')!));
    expect(window.location.search).toBe("?q=Ion&row=A&tiles=preview%2Clinks");
    await act(async () => fireEvent.click(document.querySelector('[data-row="A"] [data-preview-toggle]')!));
    await act(async () => fireEvent.click(document.querySelector('[data-row="A"] [data-links-toggle]')!));
    expect(window.location.search).toBe("?q=Ion");
    expect(window.history.length).toBe(before);
  });

  it("without an address (a test, another screen) it starts closed and touches no address", async () => {
    window.history.replaceState(null, "", "/x?row=A&tiles=preview");
    await act(async () => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <ListPreviews incursion={Stub}>
            <div data-row="A">
              <PreviewButton target={{ kind: "person", id: "A" }} />
            </div>
          </ListPreviews>
        </QueryClientProvider>,
      );
    });
    expect(document.querySelector("[data-list-row-tiles]")).toBeNull();
    expect(window.location.search).toBe("?row=A&tiles=preview");
  });
});

describe("the four lists keep their view in their address (#39.26)", () => {
  it.each(LISTS)("%s: starts from it, writes it back, keeps its scroll, hands the tiles theirs", (dir, kind) => {
    const view = read("src", "app", dir, "list-view.tsx");
    // Slice #39.61: Proprietăți reads its filter bar's keys from the address too.
    expect(view).toMatch(/const address = useListAddress\((DOCUMENT_ADDRESS_FILTERS|PROPERTY_FILTER_KEYS|FILTER_KEYS)?\);/);
    expect(view).toContain("useState(address.search);");
    expect(view).toContain("useState(address.page);");
    // The search as typed, not the debounced one — a link that carries it must find the box's word.
    expect(view).toMatch(/useWriteListAddress\(\s*\{ search: searchInput, page: currentPage/);
    expect(view).toContain("useListScrollMemory(query.isSuccess);");
    expect(view).toContain(`address={{ kind: "${kind}", row: address.row, tiles: address.tiles }}`);
    // The search's debounce sends the list to its first page only when the search changed — on mount the address's
    // page stands. It read `setDebouncedSearch(searchInput.trim()); setCurrentPage(0);` on every run.
    expect(view).toMatch(/const next = searchInput\.trim\(\);\s*if \(next === debouncedSearch\) return;/);
    expect(view).toContain("}, [searchInput, debouncedSearch]);");
  });

  it.each(LISTS)("%s: its page renders it in a Suspense boundary, inside ListAddressScope", (dir, _kind, comp) => {
    const page = read("src", "app", dir, "page.tsx");
    expect(page).toMatch(new RegExp(`<Suspense>\\s*<ListAddressScope>\\s*<${comp}[^>]*/>\\s*</ListAddressScope>\\s*</Suspense>`));
  });

  it("Acte keeps „Expiră curând” and the custom field in its address; its type filter carries the search and them", () => {
    const view = read("src", "app", "documents", "list-view.tsx");
    expect(view).toContain('const DOCUMENT_ADDRESS_FILTERS = ["expiring", "field", "value"] as const;');
    expect(view).toContain('useState(address.filters.expiring === "1")');
    expect(view).toContain('useState(address.filters.field ?? "")');
    expect(view).toContain('useState(address.filters.value ?? "")');
    // Slice #39.63: and the shared bar's keys with them (`FILTER_KEYS`); it carried DOCUMENT_ADDRESS_FILTERS alone.
    expect(view).toContain("const FILTER_KEYS = [...DOCUMENT_ADDRESS_FILTERS, ...DOCUMENT_FILTER_KEYS];");
    expect(view).toContain("carryListAddress(new URLSearchParams(window.location.search), FILTER_KEYS)");
  });

  it("the scroll is kept by the Navigation API's history slot — a list opened from the menu is a new slot", () => {
    const hook = read("src", "components", "list", "use-list-address.tsx");
    expect(hook).toContain("nav?.currentEntry?.key ?? null");
    // #40.02: the list's frame, which scrolls now — was `querySelector<HTMLElement>("[data-page-scroll]")`.
    expect(hook).toContain('querySelector<HTMLElement>("main [data-list-frame]")');
    expect(hook).toContain("window.history.replaceState(null, \"\", `${pathname}${next}`);");
    expect(hook).not.toMatch(/router\.(push|replace)/);
  });
});
