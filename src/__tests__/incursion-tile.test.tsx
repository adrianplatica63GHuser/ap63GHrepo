/**
 * Slice #38.72 — „Incursiune": the eye on a list row shows one tile from inside the object, beside the list.
 *
 * A LOOK, NOT AN EDIT, as a preview is (#37.24, preview-tiles.test.tsx): the tile reuses the detail screens'
 * tiles in their read-only forms and reaches no form and no write. One at a time; while it is open every
 * magnifier on the list is released and disabled. TC-TILES-11 steps 6–7 drive it in the browser.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ListPreviewRow, ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { IncursionButton } from "@/components/tiles/incursion-button";
import type { PreviewTarget } from "@/lib/ui/previews";
import { groupSurface, PINNED_TILE_SURFACE } from "@/lib/ui/tile-surface";
import { tileGroupOf } from "@/lib/ui/tiles";
import { NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { PROP_TILE_REGISTRY } from "@/app/properties/_components/property-tiles";
import { documentTileRegistry } from "@/app/documents/_components/document-tiles";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedNavigate: jest.fn() }),
}));
jest.mock("@/components/tiles/preview-data", () => ({
  loadPreview: async (target: { id: string }) => ({ title: `Teren ${target.id}`, fields: {} }),
}));

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

/** The list's tile, stubbed: which row it is for. */
function Stub({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
  return (
    <section data-incursion={target.kind} data-for={target.id}>
      <button type="button" onClick={onClose} aria-label="close-stub" />
    </section>
  );
}

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ListPreviews incursion={Stub}>
        <div data-list-toolbar="" />
        <ListPreviewRow>
          <table>
            <tbody>
              {["A", "B"].map((id) => (
                <tr key={id}>
                  <td data-row={id}>
                    <PreviewButton target={{ kind: "property", id }} />
                    <IncursionButton target={{ kind: "property", id }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListPreviewRow>
      </ListPreviews>
    </QueryClientProvider>,
  );
}
const magnifier = (id: string) => document.querySelector<HTMLButtonElement>(`[data-row="${id}"] [data-preview-toggle]`)!;
const eye = (id: string) => document.querySelector<HTMLButtonElement>(`[data-row="${id}"] [data-incursion-toggle]`)!;
const tile = () => document.querySelector<HTMLElement>("[data-incursion]");

describe("the eye opens one Incursiune, and the magnifiers yield to it (#38.72)", () => {
  it("pressed, it shows its row's tile beside the list, closes the open preview and disables every magnifier", async () => {
    renderList();
    await act(async () => fireEvent.click(magnifier("A")));
    await waitFor(() => expect(document.querySelectorAll("[data-preview]")).toHaveLength(1));
    await act(async () => fireEvent.click(eye("A")));
    expect(tile()).toHaveAttribute("data-for", "A");
    expect(eye("A")).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll("[data-preview]")).toHaveLength(0);
    for (const id of ["A", "B"]) {
      expect(magnifier(id)).toBeDisabled();
      expect(magnifier(id)).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("one at a time: another row's eye moves it there (Ask first #1); the same eye again closes it and frees the magnifiers", async () => {
    renderList();
    await act(async () => fireEvent.click(eye("A")));
    await act(async () => fireEvent.click(eye("B")));
    expect(tile()).toHaveAttribute("data-for", "B");
    expect([eye("A").getAttribute("aria-pressed"), eye("B").getAttribute("aria-pressed")]).toEqual(["false", "true"]);
    await act(async () => fireEvent.click(eye("B")));
    expect(tile()).toBeNull();
    for (const id of ["A", "B"]) expect(magnifier(id)).toBeEnabled();
  });

  it("„Închide” on the tile closes it as the eye does", async () => {
    renderList();
    await act(async () => fireEvent.click(eye("A")));
    await act(async () => fireEvent.click(document.querySelector('[aria-label="close-stub"]')!));
    expect(tile()).toBeNull();
    expect(eye("A")).toHaveAttribute("aria-pressed", "false");
  });

  it("is absent where a list offers no Incursiune, and its magnifiers are never locked", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <ListPreviews>
          <div data-row="C">
            <PreviewButton target={{ kind: "person", id: "C" }} />
            <IncursionButton target={{ kind: "person", id: "C" }} />
          </div>
        </ListPreviews>
      </QueryClientProvider>,
    );
    expect(eye("C")).toBeNull();
    expect(magnifier("C")).toBeEnabled();
  });
});

describe("a look, not an edit (#38.72)", () => {
  const TILE = read("src", "app", "_components", "incursion-tile.tsx");

  it("reaches no form, no version strip, no association tab and no write", () => {
    for (const banned of [/-form"/, /version-nav/i, /-tab"/, /entity-metadata-tab/, /method:\s*"(POST|PATCH|PUT|DELETE)"/]) {
      expect(TILE).not.toMatch(banned);
    }
  });

  it("reuses the three tiles in their read-only forms", () => {
    // Slice #38.75: in its own screen's surface, not the card's (`INCURSION_SURFACE`, below).
    expect(TILE).toContain('<InteractionsTile title={t("interactions")} surface={INCURSION_SURFACE[target.kind]} fill />');
    expect(TILE).toContain("<PropertyMiniMap corners={q.data} onChange={() => {}} readOnly />");
    expect(TILE).not.toContain("onFullScreen");
    expect(TILE).toContain('<PagesPanel documentId={documentId} mode="peek" state={state} surface={surface} />');
  });

  it("„Pagini” in its peek mode draws neither the turn and its „Salvează”, nor a row's bin, nor „+ Adaugă pagină”, and leaves the unsaved note", () => {
    const pages = read("src", "app", "documents", "_components", "pages-panel.tsx");
    expect(pages).toContain('mode:             "edit" | "view" | "peek";');
    expect(pages).toContain('{pages.length > 0 && mode !== "peek" && (');
    expect(pages).toContain('if (mode === "peek") return;');
    // Add and delete were already the edit mode's alone.
    expect((pages.match(/\{mode === "edit" && \(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("fills the row beside the list, never narrower than the tile on its screen", () => {
    // Slice #38.75: and `self-stretch`, to the list's height.
    expect(TILE).toContain('className="flex min-w-0 flex-1 flex-col gap-2 self-stretch"');
    expect(TILE).toContain("style={{ minWidth: rem(INCURSION_MIN_REM[target.kind]) }}");
  });

  it("the four lists draw magnifier, eye, arrow, and offer the tile", () => {
    for (const dir of ["properties", "documents", "natural-persons", "judicial-persons"]) {
      const view = read("src", "app", dir, "list-view.tsx");
      const actions = view.slice(view.indexOf('data-row-actions=""'), view.indexOf("</span>", view.indexOf('data-row-actions=""')));
      const at = (s: string) => actions.indexOf(s);
      expect([dir, at("<PreviewButton") > -1 && at("<PreviewButton") < at("<IncursionButton") && at("<IncursionButton") < at("icon={ArrowRight}")]).toEqual([dir, true]);
      expect([dir, view.includes("<ListPreviews incursion={IncursionTile}>")]).toEqual([dir, true]);
      // Slice #38.75: around the whole list, its first child the toolbar; the table frame in `ListPreviewRow`.
      expect([dir, /<ListPreviews incursion=\{IncursionTile\}>\s*\{\/\* Toolbar/.test(view)]).toEqual([dir, true]);
      expect([dir, /<ListPreviewRow>\s*<div className=\{`\$\{TABLE_FRAME\}/.test(view)]).toEqual([dir, true]);
      expect([dir, /<\/ListPreviews>\s*\);\s*\}\s*$/.test(view)]).toEqual([dir, true]);
    }
  });

  it("the four lists' button column holds the three buttons side by side (94 px)", () => {
    const widths = read("src", "lib", "ui", "field-widths.ts");
    expect(widths).toContain('listRowActions: { content: 6, kind: "fixed" },');
  });

  it("is named „Incursiune” in Romanian and „Peek inside” in English (Ask first #3)", () => {
    expect(JSON.parse(read("messages", "ro-RO.json")).shared.incursion.button).toBe("Incursiune");
    expect(JSON.parse(read("messages", "en-GB.json")).shared.incursion.button).toBe("Peek inside");
  });
});

describe("as tall as the list, in the purple it has on its own screen (#38.75)", () => {
  const TILE = read("src", "app", "_components", "incursion-tile.tsx");
  const row = () => document.querySelector<HTMLElement>("[data-list-incursion-row]")!;
  const body = () => document.querySelector<HTMLElement>("[data-list-body]")!;

  it("stands beside the WHOLE list — toolbar to pagination — not beside the table alone", async () => {
    renderList();
    expect([...row().children]).toEqual([body()]);
    // While nothing stands beside it the list keeps the page's whole width, as its column always had.
    expect(body().className).toMatch(/(^|\s)w-full(\s|$)/);
    await act(async () => fireEvent.click(eye("A")));
    const kids = [...row().children];
    expect(kids).toHaveLength(2);
    expect(kids[0]).toBe(body());
    expect(kids[1]).toBe(tile());
    // The toolbar and the table's row are inside the list's body, so the tile's height is all of theirs.
    expect(body().querySelector("[data-list-toolbar]")).not.toBeNull();
    expect(body().querySelector("[data-list-previews]")).not.toBeNull();
    expect(body().className).not.toMatch(/(^|\s)w-full(\s|$)/);
  });

  it("the list is not stretched; the tile is (Ask first #1, #2)", () => {
    const tiles = read("src", "components", "tiles", "preview-tiles.tsx");
    expect(tiles).toContain('<div data-list-incursion-row className="flex flex-wrap items-start gap-4">');
    expect(TILE).toContain("self-stretch");
  });

  it("the map's box and the page viewer grow into the height, never below today's; „Interacțiuni” grows, its sentence at the top", () => {
    expect(TILE).toContain('className={`${surface} flex flex-1 flex-col`}');
    expect(TILE).toContain('className="relative flex-1 overflow-hidden rounded-md border border-card-rim dark:border-zinc-800"');
    expect(TILE).toContain("style={{ minHeight: rem(MAP_BOX_HEIGHT_REM) }}");
    expect(TILE).not.toContain("style={{ height: rem(MAP_BOX_HEIGHT_REM) }}");
    const interactions = read("src", "components", "tiles", "interactions-tile.tsx");
    expect(interactions).toContain("className={fill ? `${surface} flex-1` : surface}");
    const pages = read("src", "app", "documents", "_components", "pages-panel.tsx");
    expect(pages).toContain('mode === "peek" ? "flex flex-1 flex-col" : "",');
    expect(pages).toContain('"flex flex-1 flex-col gap-3 lg:flex-row lg:items-stretch"');
    expect(pages).toContain('mode === "peek" ? "order-2 flex flex-1 flex-col lg:order-1"');
    // The viewer's own floor stays: it grows from 320 px, never below.
    expect(pages).toContain('"relative min-h-[320px] flex-1 overflow-hidden');
  });

  it("each tile's surface is its registry group's on its own screen — the fixed group's purple, for all three", () => {
    const saved = documentTileRegistry({ typeKey: null, tabs: [], succession: false, pages: true });
    for (const group of [
      tileGroupOf(NP_TILE_REGISTRY, "interactions"),
      tileGroupOf(JP_TILE_REGISTRY, "interactions"),
      tileGroupOf(PROP_TILE_REGISTRY, "map"),
      tileGroupOf(saved, "pages"),
    ]) {
      expect(group).toBe("fixed");
      expect(groupSurface(group)).toBe(PINNED_TILE_SURFACE);
    }
  });

  it("takes the surface from the registry, not a second list, and never the card's", () => {
    expect(TILE).toContain('person: groupSurface(tileGroupOf(NP_TILE_REGISTRY, "interactions")),');
    expect(TILE).toContain('company: groupSurface(tileGroupOf(JP_TILE_REGISTRY, "interactions")),');
    expect(TILE).toContain('property: groupSurface(tileGroupOf(PROP_TILE_REGISTRY, "map")),');
    expect(TILE).toContain('document: groupSurface(tileGroupOf(documentTileRegistry(SAVED_DOCUMENT), "pages")),');
    expect(TILE).not.toMatch(/\bTILE_SURFACE\b/);
    expect(TILE).not.toContain("PINNED_TILE_SURFACE");
    expect(TILE).toContain('surface={INCURSION_SURFACE.property}');
    expect(TILE).toContain('surface={INCURSION_SURFACE.document}');
  });
});
