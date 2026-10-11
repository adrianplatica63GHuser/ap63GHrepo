/**
 * Slice #38.05 — beside a list, the open previews stand in ONE column after the
 * table: the first at the top, the second under it. The column drops below the
 * table only when the window cannot hold the table and one preview side by
 * side; before, the previews were items of the list's wrapping row themselves,
 * and the second wrapped under the TABLE. One component, the four lists.
 * Measured in the browser by TC-TILES-19.
 *
 * Slice #39.04 changed this file in place: a list's previews are no longer „two at most, from any rows, a third
 * replacing the oldest" in a column beside the TABLE (`data-list-preview-column`, gone). The magnifier is one of
 * a row's three toggles (`@/lib/ui/row-tiles`): one row at a time, its preview at the top of the row tiles'
 * column (`data-list-row-tiles`) beside the WHOLE list, 40 rem wide. Each changed assertion quotes what it read.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ListPreviewRow, ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedNavigate: jest.fn() }),
}));
jest.mock("@/components/tiles/preview-data", () => ({
  loadPreview: async (target: { id: string }) => ({ title: `Teren ${target.id}`, fields: {} }),
}));

function renderList(rowIds: readonly string[] | undefined = ["A", "B", "C"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (ids: readonly string[] | undefined) => (
    <QueryClientProvider client={client}>
      <ListPreviews rowIds={ids}>
        {/* Slice #38.75: `ListPreviews` holds the whole list; the table is `ListPreviewRow`. */}
        <ListPreviewRow>
          <div data-list-edge="">
            <table>
              <tbody>
                {["A", "B", "C"].map((id) => (
                  <tr key={id}>
                    <td>{id}</td>
                    <td data-row={id}>
                      <PreviewButton target={{ kind: "property", id }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListPreviewRow>
      </ListPreviews>
    </QueryClientProvider>
  );
  const r = render(tree(rowIds));
  return { ...r, rerenderWith: (ids: readonly string[] | undefined) => r.rerender(tree(ids)) };
}
const press = (id: string) => fireEvent.click(document.querySelector(`[data-row="${id}"] button`)!);
const row = () => document.querySelector<HTMLElement>("[data-list-incursion-row]")!;
const column = () => document.querySelector<HTMLElement>("[data-list-row-tiles]");

describe("a list's preview stands in the row tiles' column, beside the whole list (#38.05, #39.04)", () => {
  it("with none open there is no column — nothing takes a gap in the row", () => {
    renderList();
    expect(column()).toBeNull();
    expect(row().children).toHaveLength(1);
    expect(document.querySelector("[data-list-preview-column]")).toBeNull();
  });

  it("the preview opens in a column after the list's body, 40 rem wide", async () => {
    renderList();
    await act(async () => press("A"));
    await waitFor(() => expect(column()?.querySelectorAll("[data-preview]")).toHaveLength(1));
    // #38.05 read: the row (`data-list-previews`) holds the table's frame and the previews' column.
    const kids = [...row().children] as HTMLElement[];
    expect(kids).toHaveLength(2);
    expect(kids[0]).toHaveAttribute("data-list-body");
    expect(kids[1]).toBe(column());
    expect(column()!.className).toMatch(/\bflex-col\b/);
    expect(column()!.className).toMatch(/\bself-stretch\b/);
    expect(column()!.style.width).toBe("40rem");
    expect(row().className).toMatch(/\bflex-wrap\b/);
    await waitFor(() => expect([...column()!.querySelectorAll("[data-preview] h2")].map((h) => h.textContent)).toEqual(["Teren A"]));
    // The preview takes the column's width, not its own detail-screen width.
    expect(column()!.querySelector<HTMLElement>("[data-preview]")!.style.width).toBe("100%");
  });

  it("one row at a time: the other rows' magnifiers are disabled while it is open", async () => {
    // #38.05/#38.71 read: „still two at most: a third replaces the oldest, in the same column".
    renderList();
    await act(async () => press("A"));
    await waitFor(() => expect(column()?.querySelectorAll("[data-preview]")).toHaveLength(1));
    for (const id of ["B", "C"]) expect(document.querySelector(`[data-row="${id}"] button`)).toBeDisabled();
    await act(async () => press("B"));
    expect([...column()!.querySelectorAll("[data-preview]")]).toHaveLength(1);
  });

  it("a page change, a search or a filter that takes the open row off the screen closes it and frees every row (Ask first 2)", async () => {
    const { rerenderWith } = renderList(["A", "B", "C"]);
    await act(async () => press("A"));
    await waitFor(() => expect(column()).not.toBeNull());
    // A new page loading (no ids yet), then one that still holds the row: nothing closes.
    rerenderWith(undefined);
    rerenderWith(["A", "C"]);
    expect(column()).not.toBeNull();
    // A page without it: all close, every row free.
    rerenderWith(["B", "C"]);
    await waitFor(() => expect(column()).toBeNull());
    for (const id of ["A", "B", "C"]) expect(document.querySelector(`[data-row="${id}"] button`)).toBeEnabled();
  });

  it("the four lists draw their table through it, and pass the ids of the rows they show", () => {
    for (const dir of ["properties", "documents", "natural-persons", "judicial-persons"]) {
      const view = readFileSync(join(process.cwd(), "src", "app", dir, "list-view.tsx"), "utf8");
      // #38.05 matched a bare `<ListPreviews>`; #38.72 passes it the Incursiune tile; #39.04 its loaded rows' ids.
      expect([dir, view.includes("<ListPreviews incursion={IncursionTile} rowIds={query.data?.items.map((i) => i.id)}>")]).toEqual([dir, true]);
      expect([dir, /<ListPreviewRow>\s*<div className=\{`\$\{TABLE_FRAME\}/.test(view)]).toEqual([dir, true]);
    }
  });
});

describe("„Previzualizare” is a magnifier, a toggle (Slice #38.71)", () => {
  const button = (id: string) => document.querySelector<HTMLButtonElement>(`[data-row="${id}"] button`)!;

  it("pressed, it opens its row's preview and reads pressed; pressed again, it closes it", async () => {
    renderList();
    expect(button("A")).toHaveAttribute("aria-pressed", "false");
    expect(button("A").querySelector("svg.lucide-search")).not.toBeNull();
    expect(button("A").querySelector("svg.lucide-eye")).toBeNull();
    await act(async () => press("A"));
    await waitFor(() => expect(column()?.querySelectorAll("[data-preview]")).toHaveLength(1));
    expect(button("A")).toHaveAttribute("aria-pressed", "true");
    await act(async () => press("A"));
    await waitFor(() => expect(column()).toBeNull());
    expect(button("A")).toHaveAttribute("aria-pressed", "false");
  });

  it("„Închide” on the preview releases its magnifier (#39.04)", async () => {
    // #38.71 read here: „a third preview replaces the oldest, and the oldest row's magnifier is released with it".
    renderList();
    await act(async () => press("A"));
    await waitFor(() => expect(column()?.querySelectorAll("[data-preview]")).toHaveLength(1));
    const close = [...column()!.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.getAttribute("aria-label") === "close")!;
    await act(async () => fireEvent.click(close));
    await waitFor(() => expect(column()).toBeNull());
    expect(button("A")).toHaveAttribute("aria-pressed", "false");
  });

  it("on the four lists the magnifier is the row's first button and „Deschide” its last", () => {
    for (const dir of ["properties", "documents", "natural-persons", "judicial-persons"]) {
      const view = readFileSync(join(process.cwd(), "src", "app", dir, "list-view.tsx"), "utf8");
      const actions = view.slice(view.indexOf('data-row-actions=""'), view.indexOf("</span>", view.indexOf('data-row-actions=""')));
      expect([dir, actions.indexOf("<PreviewButton") > -1 && actions.indexOf("<PreviewButton") < actions.indexOf("icon={ArrowRight}")]).toEqual([dir, true]);
    }
  });

  it("its pressed look is the navy fill (primary), its name stays „Previzualizare”", () => {
    const tiles = readFileSync(join(process.cwd(), "src", "components", "tiles", "preview-tiles.tsx"), "utf8");
    expect(tiles).toContain('variant={pressed ? "primary" : "secondary"}');
    expect(tiles).toContain("aria-pressed={pressed}");
    expect(tiles).toContain('label={t("openPreview")}');
    expect(tiles).toContain("icon={Search}");
  });
});
