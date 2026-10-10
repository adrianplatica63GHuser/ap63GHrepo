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

import { ListPreviews, PreviewButton } from "@/components/tiles/preview-tiles";
import { IncursionButton } from "@/components/tiles/incursion-button";
import type { PreviewTarget } from "@/lib/ui/previews";

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
    expect(TILE).toContain('<InteractionsTile title={t("interactions")} surface={TILE_SURFACE} fill />');
    expect(TILE).toContain("<PropertyMiniMap corners={q.data} onChange={() => {}} readOnly />");
    expect(TILE).not.toContain("onFullScreen");
    expect(TILE).toContain('<PagesPanel documentId={documentId} mode="peek" state={state} />');
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
    expect(TILE).toContain('className="flex min-w-0 flex-1 flex-col gap-2"');
    expect(TILE).toContain("style={{ minWidth: rem(INCURSION_MIN_REM[target.kind]) }}");
  });

  it("the four lists draw magnifier, eye, arrow, and offer the tile", () => {
    for (const dir of ["properties", "documents", "natural-persons", "judicial-persons"]) {
      const view = read("src", "app", dir, "list-view.tsx");
      const actions = view.slice(view.indexOf('data-row-actions=""'), view.indexOf("</span>", view.indexOf('data-row-actions=""')));
      const at = (s: string) => actions.indexOf(s);
      expect([dir, at("<PreviewButton") > -1 && at("<PreviewButton") < at("<IncursionButton") && at("<IncursionButton") < at("icon={ArrowRight}")]).toEqual([dir, true]);
      expect([dir, view.includes("<ListPreviews incursion={IncursionTile}>")]).toEqual([dir, true]);
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
