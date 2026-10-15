/**
 * Slice #38.72 — „Incursiune": the eye on a list row shows one tile from inside the object, beside the list.
 *
 * A LOOK, NOT AN EDIT, as a preview is (#37.24, preview-tiles.test.tsx): the tile reuses the detail screens'
 * tiles in their read-only forms and reaches no form and no write. One at a time; while it is open every
 * magnifier on the list is released and disabled. TC-TILES-11 steps 6–7 drive it in the browser.
 *
 * Slice #39.04 changed this file in place: the eye, the chain link and the magnifier are independent toggles on
 * ONE row (`@/lib/ui/row-tiles`, row-tiles.test.ts) — any subset open, the other rows' three disabled, the tiles in
 * one 40 rem column beside the list in the order Previzualizare, Legături, Incursiune. Each changed test quotes
 * what it held before.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ListPreviewRow, ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { IncursionButton, LinksButton } from "@/components/tiles/incursion-button";
import { RelatedTile, readOnlyButtons, type RelatedRow } from "@/components/tiles/related-tile";
import { IncursionHead } from "@/components/tiles/incursion-head";
import {
  PAGES_TILE_EMPTY_HEIGHT_PX,
  PREVIEW_TILE_HEIGHT_PX,
  RELATED_READONLY_SLOTS,
  RELATED_SLOTS,
  ROW_TILE_CEILING_PX,
  ROW_TILE_EMPTY_CLASS,
  rowTileMinPx,
  rowTileStyle,
} from "@/lib/ui/field-widths";
import { PagesPanel, PEEK_NAME_CHARS, peekName, usePagesPanelState } from "@/app/documents/_components/pages-panel";
import { RELATED_TILE_SURFACE } from "@/lib/ui/tile-surface";
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

/** The list's tile, stubbed: which row it is for, and (#38.76) which tile. */
function Stub({ target, view, onClose }: { target: PreviewTarget; view: string; onClose: () => void }) {
  return (
    <section data-incursion={target.kind} data-for={target.id} data-incursion-view={view}>
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
                    <LinksButton target={{ kind: "property", id }} />
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
const link = (id: string) => document.querySelector<HTMLButtonElement>(`[data-row="${id}"] [data-links-toggle]`)!;

describe("the eye opens its row's Incursiune; the other rows' three wait (#38.72, #39.04)", () => {
  // #38.72 read: „pressed, it shows its row's tile beside the list, closes the open preview and disables every magnifier".
  it("pressed, it shows its row's tile in the column; the row's preview stays; every other row's three are disabled", async () => {
    renderList();
    await act(async () => fireEvent.click(magnifier("A")));
    await waitFor(() => expect(document.querySelectorAll("[data-preview]")).toHaveLength(1));
    await act(async () => fireEvent.click(eye("A")));
    expect(tile()).toHaveAttribute("data-for", "A");
    expect(eye("A")).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll("[data-preview]")).toHaveLength(1);
    expect(magnifier("A")).toBeEnabled();
    expect(magnifier("A")).toHaveAttribute("aria-pressed", "true");
    for (const b of [magnifier("B"), eye("B"), link("B")]) {
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("aria-pressed", "false");
    }
  });

  // #38.72 read: „one at a time: another row's eye moves it there (Ask first #1); the same eye again closes it and
  // frees the magnifiers".
  it("another row's eye does nothing while this row has a tile; the same eye again closes it and frees every row", async () => {
    renderList();
    await act(async () => fireEvent.click(eye("A")));
    await act(async () => fireEvent.click(eye("B")));
    expect(tile()).toHaveAttribute("data-for", "A");
    expect([eye("A").getAttribute("aria-pressed"), eye("B").getAttribute("aria-pressed")]).toEqual(["true", "false"]);
    await act(async () => fireEvent.click(eye("A")));
    expect(tile()).toBeNull();
    for (const id of ["A", "B"]) for (const b of [magnifier(id), eye(id), link(id)]) expect(b).toBeEnabled();
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
    // #38.89: the tile now reads the person's history, so it is given the person.
    // #39.05: was `<InteractionsTile personId={target.id} title={t("interactions")} surface={INCURSION_SURFACE[target.kind]} fill />`
    // — the history alone still, and now a row opens the person's screen with C on it.
    // #39.25: `fill` became `peek={{ head: head(t("interactions")), style: rowTileStyle(target.kind) }}` — the title line
    // with the name and „Închide", the tile as tall as its rows.
    expect(TILE).toMatch(/<InteractionsTile\s+personId=\{target\.id\}\s+title=\{t\("interactions"\)\}\s+surface=\{INCURSION_SURFACE\[target\.kind\]\}\s+peek=\{\{ head: head\(t\("interactions"\)\), style: rowTileStyle\(target\.kind\) \}\}\s/);
    expect(TILE).toContain("<PropertyMiniMap corners={q.data} onChange={() => {}} readOnly />");
    expect(TILE).not.toContain("onFullScreen");
    // #39.25: was `<PagesPanel documentId={documentId} mode="peek" state={state} surface={surface} />`.
    expect(TILE).toContain('<PagesPanel documentId={documentId} mode="peek" state={state} surface={surface} peekHead={peekHead} />');
  });

  it("„Pagini” in its peek mode draws neither the turn and its „Salvează”, nor a row's bin, nor „+ Adaugă pagină”, and leaves the unsaved note", () => {
    const pages = read("src", "app", "documents", "_components", "pages-panel.tsx");
    expect(pages).toContain('mode:             "edit" | "view" | "peek";');
    expect(pages).toContain('{pages.length > 0 && mode !== "peek" && (');
    expect(pages).toContain('if (mode === "peek") return;');
    // Add and delete were already the edit mode's alone.
    expect((pages.match(/\{mode === "edit" && \(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  // #38.72/#38.75 read: „fills the row beside the list, never narrower than the tile on its screen" —
  // `className="flex min-w-0 flex-1 flex-col gap-2 self-stretch"`, `style={{ minWidth: rem(INCURSION_MIN_REM[target.kind]) }}`.
  // #39.04 read: „is the column's width; the Incursiune fills the column's height, „Legături” keeps its own" —
  // `className={view === "peek" ? "flex w-full min-w-0 flex-1 flex-col gap-2" : "flex w-full min-w-0 flex-col gap-2"}`.
  it("is the column's width (#39.04); „Hartă” and „Pagini” fill the column's height, „Legături” and „Interacțiuni” are their rows' (#39.25)", () => {
    expect(TILE).toContain('const fills = view === "peek" && (target.kind === "property" || target.kind === "document");');
    expect(TILE).toContain('className={fills ? "flex w-full min-w-0 flex-1 flex-col" : "flex w-full min-w-0 flex-col"}');
    expect(TILE).not.toContain("export const INCURSION_MIN_REM");
    const tiles = read("src", "components", "tiles", "preview-tiles.tsx");
    expect(tiles).toContain("export const ROW_TILES_STYLE: CSSProperties = { width: rem(PAGES_PANEL_REM) };");
    expect(tiles).toContain('<div data-list-row-tiles className="flex max-w-full shrink-0 flex-col gap-4 self-stretch" style={ROW_TILES_STYLE}>');
  });

  it("the four lists draw magnifier, eye, chain link, arrow, and offer the tile", () => {
    for (const dir of ["properties", "documents", "natural-persons", "judicial-persons"]) {
      const view = read("src", "app", dir, "list-view.tsx");
      const actions = view.slice(view.indexOf('data-row-actions=""'), view.indexOf("</span>", view.indexOf('data-row-actions=""')));
      const at = (s: string) => actions.indexOf(s);
      // #38.72 held magnifier, eye, arrow (`at("<IncursionButton") < at("icon={ArrowRight}")`); #38.76 puts the
      // chain link between the eye and the arrow.
      expect([dir, at("<PreviewButton") > -1 && at("<PreviewButton") < at("<IncursionButton") && at("<IncursionButton") < at("<LinksButton") && at("<LinksButton") < at("icon={ArrowRight}")]).toEqual([dir, true]);
      // #39.04: and the ids of the rows it shows (was `<ListPreviews incursion={IncursionTile}>`).
      // #39.26: and the list's address, over several lines — it was the one line
      // `<ListPreviews incursion={IncursionTile} rowIds={query.data?.items.map((i) => i.id)}>`.
      const openMatch = view.match(/<ListPreviews\s+incursion=\{IncursionTile\}\s+rowIds=\{query\.data\?\.items\.map\(\(i\) => i\.id\)\}\s+address=\{\{[^}]*\}\}\s*>/);
      expect([dir, openMatch !== null]).toEqual([dir, true]);
      const open = openMatch![0];
      // Slice #38.75: around the whole list, its first child the toolbar; the table frame in `ListPreviewRow`.
      expect([dir, view.slice(view.indexOf(open) + open.length).trimStart().startsWith("{/* Toolbar")]).toEqual([dir, true]);
      expect([dir, /<ListPreviewRow>\s*<div className=\{`\$\{TABLE_FRAME\}/.test(view)]).toEqual([dir, true]);
      expect([dir, /<\/ListPreviews>\s*\);\s*\}\s*$/.test(view)]).toEqual([dir, true]);
    }
  });

  it("the four lists' button column holds the four buttons side by side (128 px, #38.76)", () => {
    const widths = read("src", "lib", "ui", "field-widths.ts");
    // #38.72: „three buttons side by side (94 px)", `content: 6`. #38.76 adds the chain link: 4 × 26 + 3 × 8 = 128 px.
    expect(widths).toContain('listRowActions: { content: 8, kind: "fixed" },');
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
    // #39.04: was `expect(kids[1]).toBe(tile())` — the tile stands in the row tiles' column now.
    expect(kids[1]).toHaveAttribute("data-list-row-tiles");
    expect(kids[1].contains(tile())).toBe(true);
    // The toolbar and the table's row are inside the list's body, so the tile's height is all of theirs.
    expect(body().querySelector("[data-list-toolbar]")).not.toBeNull();
    expect(body().querySelector("[data-list-previews]")).not.toBeNull();
    expect(body().className).not.toMatch(/(^|\s)w-full(\s|$)/);
  });

  it("the list is not stretched; the column is, and the Incursiune fills it (Ask first #1, #2; #39.04)", () => {
    const tiles = read("src", "components", "tiles", "preview-tiles.tsx");
    expect(tiles).toContain('<div data-list-incursion-row className="flex flex-wrap items-start gap-4">');
    // #38.75 read `expect(TILE).toContain("self-stretch")`: the tile stretched itself; now the column does.
    expect(tiles).toMatch(/data-list-row-tiles className="[^"]*\bself-stretch\b/);
    // #39.25: was `view === "peek" ? "flex w-full min-w-0 flex-1 flex-col gap-2"` — the map and the pages only now.
    expect(TILE).toContain('fills ? "flex w-full min-w-0 flex-1 flex-col"');
  });

  it("the map's box and the page viewer grow into the height, never below today's; „Interacțiuni” grows, its sentence at the top", () => {
    expect(TILE).toContain('className={`${surface} flex flex-1 flex-col`}');
    expect(TILE).toContain('className="relative flex-1 overflow-hidden rounded-md border border-card-rim dark:border-zinc-800"');
    expect(TILE).toContain("style={{ minHeight: rem(MAP_BOX_HEIGHT_REM) }}");
    expect(TILE).not.toContain("style={{ height: rem(MAP_BOX_HEIGHT_REM) }}");
    const interactions = read("src", "components", "tiles", "interactions-tile.tsx");
    // #38.89 changes this in place: it read `className={fill ? `${surface} flex-1` : surface}`. The tile is a column
    // now — its title, then its rows scrolling in what is left — and still grows in an Incursiune.
    // #39.25: it read `className={fill ? `${surface} flex flex-1 flex-col` : `${surface} flex flex-col`}` — beside a list
    // it no longer grows: it is as tall as its rows, under the ceiling.
    expect(interactions).toContain("className={peek ? `${surface} flex flex-col ${ROW_TILE_EMPTY_CLASS} has-[[data-person-interaction]]:min-h-0` : `${surface} flex flex-col`}");
    const pages = read("src", "app", "documents", "_components", "pages-panel.tsx");
    expect(pages).toContain('mode === "peek" ? "flex flex-1 flex-col" : "",');
    expect(pages).toContain('"flex flex-1 flex-col gap-3 lg:flex-row lg:items-stretch"');
    // #38.75: `mode === "peek" ? "order-2 flex flex-1 flex-col lg:order-1"`; #38.82 gives the scan three parts of four.
    expect(pages).toContain('mode === "peek" ? "order-2 flex min-w-0 flex-1 flex-col lg:order-1 lg:flex-[3_1_0%]"');
    // The viewer's own floor stays: it grows from 320 px, never below.
    expect(pages).toContain('"relative min-h-[320px] flex-1 overflow-hidden');
  });

  it("each tile's surface is its registry group's on its own screen — the fixed group's purple, for all three", () => {
    const saved = documentTileRegistry({ typeKey: null, tabs: [], pages: true });
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

describe("the chain link shows „Legături” beside the list, read-only, in green (#38.76)", () => {
  const TILE = read("src", "app", "_components", "incursion-tile.tsx");
  const RELATED = read("src", "components", "tiles", "related-tile.tsx");
  const BUTTON = read("src", "components", "tiles", "incursion-button.tsx");

  // #38.76 read: „pressed, it shows its row's „Legături”, reads pressed, closes the open preview and locks every magnifier".
  it("pressed, it shows its row's „Legături” and reads pressed; the row's preview stays; the other rows wait", async () => {
    renderList();
    await act(async () => fireEvent.click(magnifier("A")));
    await waitFor(() => expect(document.querySelectorAll("[data-preview]")).toHaveLength(1));
    await act(async () => fireEvent.click(link("A")));
    expect(tile()).toHaveAttribute("data-for", "A");
    expect(tile()).toHaveAttribute("data-incursion-view", "links");
    expect(link("A")).toHaveAttribute("aria-pressed", "true");
    expect(eye("A")).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelectorAll("[data-preview]")).toHaveLength(1);
    expect(magnifier("A")).toBeEnabled();
    for (const b of [magnifier("B"), eye("B"), link("B")]) expect(b).toBeDisabled();
  });

  // #38.76 read: „one choice with the eye: an eye after it closes it and the reverse; another row's chain link moves
  // it; pressed again it closes".
  it("independent of the eye (#39.04): both open together, in the column's order, whatever order pressed", async () => {
    renderList();
    await act(async () => fireEvent.click(eye("A")));
    await act(async () => fireEvent.click(link("A")));
    await act(async () => fireEvent.click(magnifier("A")));
    expect([eye("A"), link("A"), magnifier("A")].map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "true", "true"]);
    await waitFor(() => expect(document.querySelectorAll("[data-preview]")).toHaveLength(1));
    const column = document.querySelector<HTMLElement>("[data-list-row-tiles]")!;
    const order = [...column.children].map((c) => (c.hasAttribute("data-preview") ? "preview" : c.getAttribute("data-incursion-view")));
    expect(order).toEqual(["preview", "links", "peek"]);
    await act(async () => fireEvent.click(link("A")));
    expect([...document.querySelectorAll("[data-incursion]")].map((s) => s.getAttribute("data-incursion-view"))).toEqual(["peek"]);
    await act(async () => fireEvent.click(eye("A")));
    await act(async () => fireEvent.click(magnifier("A")));
    expect(document.querySelector("[data-list-row-tiles]")).toBeNull();
    for (const id of ["A", "B"]) for (const b of [magnifier(id), eye(id), link(id)]) expect(b).toBeEnabled();
  });

  it("its icon is the very one „Asociază …” wears inside „Legături” — lucide's Link — and its name „Legături” / „Links”", () => {
    expect(RELATED).toContain('Link as LinkIcon, ');
    expect(BUTTON).toContain('import { Eye, Link as LinkIcon } from "lucide-react";');
    expect(BUTTON).toContain('icon={LinkIcon} label={t("links")}');
    expect(JSON.parse(read("messages", "ro-RO.json")).shared.incursion.links).toBe("Legături");
    expect(JSON.parse(read("messages", "en-GB.json")).shared.incursion.links).toBe("Links");
  });

  it("the tile is each screen's own „Legături”, read-only, through its own hooks — no fork", () => {
    expect(TILE).toContain('<PropertyRelatedTile propertyId={target.id} label={label} readOnly />');
    expect(TILE).toContain('<DocumentRelatedTile documentId={target.id} label={label} readOnly />');
    expect(TILE).toMatch(/<PersonRelatedTile\s+personId=\{target\.id\}\s+backBase=\{target\.kind === "company" \? "\/judicial-persons" : "\/natural-persons"\}\s+label=\{label\}\s+readOnly\s+\/>/);
    for (const f of [
      ["src", "app", "natural-persons", "_components", "person-related-tile.tsx"],
      ["src", "app", "properties", "_components", "property-related-tile.tsx"],
      ["src", "app", "documents", "_components", "document-related-tile.tsx"],
    ]) {
      expect([f.at(-1), read(...f).includes("readOnly={readOnly}")]).toEqual([f.at(-1), true]);
    }
  });

  it("wears its screen's green: the registry's `related` group, RELATED_TILE_SURFACE, on all four", () => {
    const saved = documentTileRegistry({ typeKey: null, tabs: [], pages: true });
    for (const group of [
      tileGroupOf(NP_TILE_REGISTRY, "related"),
      tileGroupOf(JP_TILE_REGISTRY, "related"),
      tileGroupOf(PROP_TILE_REGISTRY, "related"),
      tileGroupOf(saved, "related"),
    ]) {
      expect(group).toBe("related");
      expect(groupSurface(group)).toBe(RELATED_TILE_SURFACE);
    }
    expect(TILE).toContain('person: groupSurface(tileGroupOf(NP_TILE_REGISTRY, "related")),');
    // #39.04: was `flex flex-1 flex-col` — „Legături" keeps its own height in the column now.
    // #39.25: was `className={`${LINKS_SURFACE[target.kind]} flex flex-col`}` with `style={{ height: INTERACTIONS_TILE_STYLE.minHeight }}`
    // — now as tall as its rows, under the ceiling, and the empty tile its preview's height.
    expect(TILE).toContain("className={`${LINKS_SURFACE[target.kind]} flex flex-col ${ROW_TILE_EMPTY_CLASS} has-[[data-one-line-row]]:min-h-0`}");
    expect(TILE).toContain("style={rowTileStyle(target.kind)}");
    expect(TILE).not.toContain("INTERACTIONS_TILE_STYLE");
    // The rows keep their own, calmer green (#38.15): RelatedTile draws them, whatever `readOnly` is.
    expect(RELATED).toMatch(/data-related-rows=""\s*\/\/[^\n]*\n\s*className=\{RELATED_ROWS_SURFACE\}/);
  });
});

describe("„Legături” read-only draws no association control (#38.76)", () => {
  const rows: RelatedRow[] = [
    {
      key: "natural:1", kind: "natural", radioLabel: "Ion", content: "Ion", title: "Ion", href: "/natural-persons/1?readonly=true",
      buttons: {
        share: <button type="button" data-share-button="">Cotă</button>,
        view: <span data-view="">Vizualizare</span>,
        preview: <button type="button" disabled data-preview-button="">Previzualizare</button>,
      },
      dissociate: jest.fn(async () => {}),
    },
    {
      key: "property:2", kind: "property", radioLabel: "Teren", content: "Teren", title: "Teren", href: "/properties/2?readonly=true",
      buttons: { relation: <span data-relation-bubble="">Vecin</span> },
      dissociate: jest.fn(async () => {}),
    },
  ];
  const draw = (readOnly: boolean) =>
    render(
      <RelatedTile
        readOnly={readOnly}
        label="Legături"
        rows={rows}
        loading={false}
        associate={[{ label: "associatePerson", onClick: jest.fn() }]}
        belowRows={<p data-below="">Total</p>}
        extraButtons={<button type="button" data-extra="">Înscrisuri citate</button>}
        underButtons={<div data-under="" />}
      />,
    );

  it("on its screen: radios, „Asociază …”, „Dezasociază”, the share button and what the screen passes", () => {
    const { container } = draw(false);
    expect(container.querySelector("[data-preview-button]")).not.toBeNull();
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(container.textContent).toContain("associatePerson");
    expect(container.textContent).toContain("dissociate");
    for (const sel of ["[data-share-button]", "[data-below]", "[data-extra]", "[data-under]"]) expect(container.querySelector(sel)).not.toBeNull();
  });

  it("read-only: the rows, their kinds' icons, „Vizualizare” and „Relația” — and no radio, no associate, no dissociate, no share, nothing below", () => {
    const { container } = draw(true);
    // #39.25: and no „Previzualizare” — not even disabled — in a row of two slots, „Relația” and „Vizualizare”.
    expect(container.querySelector("[data-preview-button]")).toBeNull();
    expect([...container.querySelector("[data-one-line-row]")!.querySelectorAll("[data-slot]")].map((s) => s.getAttribute("data-slot"))).toEqual(["relation", "view"]);
    expect(container.querySelectorAll("[data-one-line-row]")).toHaveLength(2);
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    expect(container.textContent).not.toContain("associatePerson");
    expect(container.textContent).not.toContain("dissociate");
    for (const sel of ["[data-share-button]", "[data-below]", "[data-extra]", "[data-under]"]) expect(container.querySelector(sel)).toBeNull();
    expect(container.textContent).toContain("Vizualizare");
    expect(container.querySelector("[data-relation-bubble]")).not.toBeNull();
    // A click selects nothing: no row is marked chosen.
    fireEvent.click(container.querySelector("[data-one-line-row]")!);
    expect(container.querySelector(".bg-cta-pale")).toBeNull();
  });
});

describe("„Pagini” in an Incursiune: three quarters for the scan, names cut at 20 characters (#38.82)", () => {
  const DOC = "33333333-3333-4333-8333-333333333333";
  const NAME = "Plan de amplasament, scara 1:500"; // 32 characters
  const PAGE = { id: "44444444-4444-4444-8444-444444444444", documentId: DOC, pageNumber: 1, pageName: NAME, pageNotes: "o notă", fileName: "plan.png", fileSize: 10, mimeType: "image/png", rotation: 0, createdAt: "", updatedAt: "" };
  const UNNAMED = { ...PAGE, id: "55555555-5555-4555-8555-555555555555", pageNumber: 2, pageName: null, fileName: "scanare-extras-carte-funciara-2019.png" };
  const answer = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

  function Panel({ mode }: { mode: "peek" | "view" }) {
    const state = usePagesPanelState(DOC);
    return <PagesPanel documentId={DOC} mode={mode} state={state} />;
  }
  const draw = (mode: "peek" | "view") => {
    global.fetch = jest.fn((url: string) =>
      url.endsWith("/view") ? answer({ url: "/api/files/plan.png", mimeType: "image/png", fileName: "plan.png" }) : answer([PAGE, UNNAMED]),
    ) as unknown as typeof fetch;
    return render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Panel mode={mode} />
      </QueryClientProvider>,
    );
  };
  afterEach(() => {
    (global as { fetch?: unknown }).fetch = undefined;
  });

  it("cuts a name at 20 characters by count, then „…”; a shorter one is left whole", () => {
    expect(PEEK_NAME_CHARS).toBe(20);
    expect(peekName(NAME)).toBe("Plan de amplasament,…");
    expect(Array.from(peekName(NAME))).toHaveLength(21);
    expect(peekName("Pagina 1")).toBe("Pagina 1");
    expect(peekName("ăîâșțăîâșțăîâșțăîâșț")).toBe("ăîâșțăîâșțăîâșțăîâșț"); // 20 with diacritics: whole
  });

  it("in peek: no Notes column, neither arrow nor pen on a row, „Tipărire” kept; the name cut, its title whole — the file name too", async () => {
    const { container } = draw("peek");
    await waitFor(() => expect(container.querySelectorAll("tbody tr")).toHaveLength(2));
    expect([...container.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["colNum", "colName", "colActions"]);
    expect(container.querySelector('[aria-label="notes"]')).toBeNull();
    expect(container.querySelector('[aria-label="view"]')).toBeNull();
    expect(container.querySelectorAll('[aria-label="print"]')).toHaveLength(2);
    const names = [...container.querySelectorAll<HTMLElement>("[data-page-name]")];
    expect(names.map((n) => n.textContent)).toEqual(["Plan de amplasament,…", "scanare-extras-carte…"]);
    expect(names.map((n) => n.title)).toEqual([NAME, UNNAMED.fileName]);
  });

  it("on the document's own screen, nothing of that changes: the Notes column, the pen, the names whole", async () => {
    const { container } = draw("view");
    await waitFor(() => expect(container.querySelectorAll("tbody tr")).toHaveLength(2));
    expect([...container.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["colNum", "colName", "colNotes", "colActions"]);
    expect(container.querySelectorAll('[aria-label="notes"]')).toHaveLength(2);
    expect(container.querySelector("[data-page-name]")!.textContent).toBe(NAME);
  });

  it("gives the scan three parts of the width and the list one, in an Incursiune only", () => {
    const pages = read("src", "app", "documents", "_components", "pages-panel.tsx");
    expect(pages).toContain('"order-2 flex min-w-0 flex-1 flex-col lg:order-1 lg:flex-[3_1_0%]"');
    expect(pages).toContain('"order-1 w-full min-w-0 lg:order-2 lg:w-auto lg:flex-[1_1_0%]"');
    // The document's own screen keeps its 380 px list.
    expect(pages).toContain('"order-1 w-full lg:order-2 lg:w-[380px] lg:shrink-0"');
  });
});

/**
 * #39.25 — Adrian, 2026-10-13: the „Incursiune: <name>” bar above „Legături” and „Interacțiuni” goes with its „Deschide”;
 * „Închide” comes down onto the tile's own title line; the disabled „Previzualizare” goes; an empty tile is the preview's
 * height, one with a few rows its rows', and a long one stops at the ceiling and scrolls.
 */
describe("„Legături” and „Interacțiuni” beside the lists: no head bar, „Închide” on the tile's line, as tall as their rows (#39.25)", () => {
  const TILE = read("src", "app", "_components", "incursion-tile.tsx");
  const PAGES = read("src", "app", "documents", "_components", "pages-panel.tsx");

  it("draws no bar above the tile and no „Deschide” on it — the name stays in the section's aria-label", () => {
    expect(TILE).not.toContain('{t("title")}: {name}');
    expect(TILE).not.toContain("ArrowRight");
    expect(TILE).not.toContain("previewHref");
    expect(TILE).not.toContain('tPreview("open")');
    expect(TILE).toContain('aria-label={`${t("title")}: ${name}`}');
  });

  it("each of the four tiles carries the line: the tile's name, the record's, „Închide” (Ask first #1, #2)", () => {
    expect(TILE).toContain("const head = (title: string) => <IncursionHead title={title} name={name} closeLabel={closeLabel} onClose={onClose} />;");
    for (const v of ['head={head(t("links"))}', 'head={head(t("map"))}', 'peek={{ head: head(t("interactions"))', "peekHead={{ name, closeLabel, onClose }}"]) {
      expect([v, TILE.includes(v)]).toEqual([v, true]);
    }
    expect(PAGES).toContain("{peekHead && <IncursionName name={peekHead.name} />}");
    expect(PAGES).toContain("{peekHead && <IncursionClose label={peekHead.closeLabel} onClose={peekHead.onClose} />}");
  });

  it("the line reads „Legături — <name>”, the name cut with its whole text in the tooltip, and „Închide” closes", () => {
    const onClose = jest.fn();
    const { container } = render(<IncursionHead title="Legături" name="Popescu Ion" closeLabel="Închide" onClose={onClose} />);
    const h2 = container.querySelector("h2")!;
    expect(h2.textContent).toBe("Legături— Popescu Ion");
    const nameEl = container.querySelector<HTMLElement>("[data-incursion-name]")!;
    expect(nameEl.title).toBe("Popescu Ion");
    expect(nameEl.className).toMatch(/\btruncate\b/);
    expect(nameEl.className).toMatch(/\bnormal-case\b/);
    fireEvent.click(container.querySelector("[data-incursion-close]")!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("button, a")).toHaveLength(1);
  });

  it("read-only and empty, its sentence has no padding of its own, so the tile is the preview's height", () => {
    const { container } = render(<RelatedTile readOnly label="Legături" rows={[]} loading={false} associate={[]} />);
    const p = container.querySelector<HTMLElement>("[data-related-empty]")!;
    expect(p.className).not.toMatch(/\bpy-6\b/);
    const onScreen = render(<RelatedTile label="Legături" rows={[]} loading={false} associate={[]} />).container;
    expect(onScreen.querySelector<HTMLElement>("[data-related-empty]")!.className).toMatch(/\bpx-4 py-6\b/);
  });

  it("a read-only row keeps „Relația” and „Vizualizare” only", () => {
    expect(RELATED_READONLY_SLOTS).toEqual(["relation", "view"]);
    expect(RELATED_SLOTS).toEqual(["share", "relation", "view", "preview"]);
    const rest = readOnlyButtons({ share: "s", relation: "r", view: "v", preview: "p" });
    expect(Object.keys(rest).sort()).toEqual(["relation", "view"]);
  });

  it("heights: empty, the row's preview's (measured); a long one stops at #39.04's 436 px", () => {
    // #39.28 re-measured the persons' four-line previews: it was `{ person: 102, company: 102, … }`.
    expect(PREVIEW_TILE_HEIGHT_PX).toEqual({ person: 123, company: 124, property: 195, document: 643 });
    expect(ROW_TILE_CEILING_PX).toBe(PAGES_TILE_EMPTY_HEIGHT_PX);
    expect(ROW_TILE_CEILING_PX).toBe(436);
    expect(rowTileMinPx("person")).toBe(123);
    expect(rowTileMinPx("property")).toBe(195);
    // A document's preview, with its page, is taller than the ceiling: its empty tile is the ceiling's height.
    expect(rowTileMinPx("document")).toBe(436);
    expect(rowTileStyle("company")).toEqual({ "--row-tile-empty": "124px", maxHeight: 436 });
    // The floor holds only while the tile is empty: a row lifts it, so a few rows are their own height.
    expect(ROW_TILE_EMPTY_CLASS).toBe("min-h-[var(--row-tile-empty)]");
  });

  it("the rows are in the tile's flow, scrolling past the ceiling — not pinned to a fixed box", () => {
    expect(TILE).toContain('<div className="min-h-0 overflow-y-auto" data-incursion-links="">');
    expect(TILE).not.toContain('className="absolute inset-0 overflow-y-auto" data-incursion-links=""');
    const interactions = read("src", "components", "tiles", "interactions-tile.tsx");
    expect(interactions).toContain('<div className="min-h-0 overflow-y-auto" data-interactions-rows="">');
  });
});
