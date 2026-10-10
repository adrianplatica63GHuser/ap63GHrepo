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
import { IncursionButton, LinksButton } from "@/components/tiles/incursion-button";
import { RelatedTile, type RelatedRow } from "@/components/tiles/related-tile";
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

  it("the four lists draw magnifier, eye, chain link, arrow, and offer the tile", () => {
    for (const dir of ["properties", "documents", "natural-persons", "judicial-persons"]) {
      const view = read("src", "app", dir, "list-view.tsx");
      const actions = view.slice(view.indexOf('data-row-actions=""'), view.indexOf("</span>", view.indexOf('data-row-actions=""')));
      const at = (s: string) => actions.indexOf(s);
      // #38.72 held magnifier, eye, arrow (`at("<IncursionButton") < at("icon={ArrowRight}")`); #38.76 puts the
      // chain link between the eye and the arrow.
      expect([dir, at("<PreviewButton") > -1 && at("<PreviewButton") < at("<IncursionButton") && at("<IncursionButton") < at("<LinksButton") && at("<LinksButton") < at("icon={ArrowRight}")]).toEqual([dir, true]);
      expect([dir, view.includes("<ListPreviews incursion={IncursionTile}>")]).toEqual([dir, true]);
      // Slice #38.75: around the whole list, its first child the toolbar; the table frame in `ListPreviewRow`.
      expect([dir, /<ListPreviews incursion=\{IncursionTile\}>\s*\{\/\* Toolbar/.test(view)]).toEqual([dir, true]);
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

describe("the chain link shows „Legături” beside the list, read-only, in green (#38.76)", () => {
  const TILE = read("src", "app", "_components", "incursion-tile.tsx");
  const RELATED = read("src", "components", "tiles", "related-tile.tsx");
  const BUTTON = read("src", "components", "tiles", "incursion-button.tsx");

  it("pressed, it shows its row's „Legături”, reads pressed, closes the open preview and locks every magnifier", async () => {
    renderList();
    await act(async () => fireEvent.click(magnifier("A")));
    await waitFor(() => expect(document.querySelectorAll("[data-preview]")).toHaveLength(1));
    await act(async () => fireEvent.click(link("A")));
    expect(tile()).toHaveAttribute("data-for", "A");
    expect(tile()).toHaveAttribute("data-incursion-view", "links");
    expect(link("A")).toHaveAttribute("aria-pressed", "true");
    expect(eye("A")).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelectorAll("[data-preview]")).toHaveLength(0);
    for (const id of ["A", "B"]) expect(magnifier(id)).toBeDisabled();
  });

  it("one choice with the eye: an eye after it closes it and the reverse; another row's chain link moves it; pressed again it closes", async () => {
    renderList();
    await act(async () => fireEvent.click(link("A")));
    await act(async () => fireEvent.click(eye("A")));
    expect(document.querySelectorAll("[data-incursion]")).toHaveLength(1);
    expect(tile()).toHaveAttribute("data-incursion-view", "peek");
    expect([eye("A").getAttribute("aria-pressed"), link("A").getAttribute("aria-pressed")]).toEqual(["true", "false"]);
    await act(async () => fireEvent.click(link("B")));
    expect(tile()).toHaveAttribute("data-for", "B");
    expect(tile()).toHaveAttribute("data-incursion-view", "links");
    expect([eye("A"), link("A"), eye("B"), link("B")].map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "false", "true"]);
    await act(async () => fireEvent.click(link("B")));
    expect(tile()).toBeNull();
    for (const id of ["A", "B"]) expect(magnifier(id)).toBeEnabled();
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
    const saved = documentTileRegistry({ typeKey: null, tabs: [], succession: false, pages: true });
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
    expect(TILE).toContain("className={`${LINKS_SURFACE[target.kind]} flex flex-1 flex-col`}");
    // The rows keep their own, calmer green (#38.15): RelatedTile draws them, whatever `readOnly` is.
    expect(RELATED).toMatch(/data-related-rows=""\s*\/\/[^\n]*\n\s*className=\{RELATED_ROWS_SURFACE\}/);
  });
});

describe("„Legături” read-only draws no association control (#38.76)", () => {
  const rows: RelatedRow[] = [
    {
      key: "natural:1", kind: "natural", radioLabel: "Ion", content: "Ion", title: "Ion", href: "/natural-persons/1?readonly=true",
      buttons: { share: <button type="button" data-share-button="">Cotă</button>, view: <span data-view="">Vizualizare</span> },
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
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(container.textContent).toContain("associatePerson");
    expect(container.textContent).toContain("dissociate");
    for (const sel of ["[data-share-button]", "[data-below]", "[data-extra]", "[data-under]"]) expect(container.querySelector(sel)).not.toBeNull();
  });

  it("read-only: the rows, their kinds' icons, „Vizualizare” and „Relația” — and no radio, no associate, no dissociate, no share, nothing below", () => {
    const { container } = draw(true);
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
