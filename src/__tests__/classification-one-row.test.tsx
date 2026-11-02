/**
 * „Clasificare" on the four record screens. One component draws the tile on all four, so it is tested once here.
 * Slice 41.10 replaced #37.68's one row (Importanță and Relevanță side by side, the save on „Istoric"'s line) with a
 * gray tile's read view and „Editează" (see the describe below). The file keeps its name.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { ListTile } from "@/components/tiles/list-tile";
import { CLASSIFICATION_UNITS, LIST_UNITS, unitsRem } from "@/lib/ui/field-widths";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const META = {
  principalObjectId: "po-1",
  groups: [],
  stamps: [],
  importance: "LOW",
  relevance: "CURRENT",
  provenance: "MANUAL",
  provenanceHistory: [],
  importanceUpdatedAt: new Date().toISOString(),
  relevanceUpdatedAt: null,
  provenanceUpdatedAt: new Date().toISOString(),
};
const snapshot = { importance: "LOW", relevance: "CURRENT", provenance: "MANUAL" };

let meta: Record<string, unknown> = META;
let versions: { id: string; versionNumber: number; snapshot: typeof snapshot; createdAt: string }[] = [];
let calls: { url: string; method: string; body?: string }[] = [];
beforeEach(() => {
  calls = [];
  versions = [];
  meta = META;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
    const json = url === "/api/meta" ? meta
      : url.endsWith("/versions") ? { items: versions }
      : {};
    return { ok: true, status: 200, redirected: false, json: async () => json };
  }) as unknown as typeof fetch;
});

function renderTile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EntityMetadataTab apiPath="/api/meta" queryKey="meta-test" backHref="/x" backEntityName="X" part="classification" />
    </QueryClientProvider>,
  );
}

const items = () => [...document.querySelectorAll<HTMLElement>("[data-classification-item]")];

function renderInFrame() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ListTile tile="classification" title="Clasificare" readEdit units={2}>
        <EntityMetadataTab apiPath="/api/meta" queryKey="meta-test" backHref="/x" backEntityName="X" part="classification" />
      </ListTile>
    </QueryClientProvider>,
  );
}

/**
 * Slice 41.10 — „Clasificare" as a gray tile (was #37.68: Importanță and Relevanță on one row, the save on „Istoric"'s
 * line). Read: the three values as text, one to a row, label above value, each with its „Marchează ca verificat";
 * „Editează" opens the three selects with „Salvează" and „Renunță"; 2 units; with no value, one line.
 */
describe("„Clasificare”: read, and edited with „Editează” (Slice 41.10)", () => {
  it("reads the three values as text, one to a row, label above value, each with its review button; no select", async () => {
    renderTile();
    await screen.findByRole("heading", { name: "importance.title" });
    expect(items().map((i) => i.dataset.classificationItem)).toEqual(["importance", "relevance", "provenance"]);
    expect(document.querySelectorAll("select")).toHaveLength(0);
    expect(items().map((i) => i.querySelector("[data-read-value]")?.textContent)).toEqual(["importance.low", "relevance.current", "provenance.manual"]);
    for (const i of items()) {
      expect(i.querySelector("h3")!.compareDocumentPosition(i.querySelector("[data-read-value]")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(i.querySelector("h3")!.className).toBe("font-colhead text-xs font-normal tracking-[0.02em] text-label");
      // 41.28: no „i" on an item's title any more — the tile has one.
      expect(i.querySelector("[data-info-glyph]")).toBeNull();
    }
    // 41.28 (Ask first 1): Importanță and Proveniență were stamped today — drawn reviewed, „Verificat azi", disabled;
    // Relevanță never was — the ordinary button. (Until 41.28 every item read „markReviewed.button".)
    for (const k of [0, 2]) {
      const b = within(items()[k]).getByRole("button", { name: "markReviewed.today" });
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute("aria-pressed", "true");
    }
    expect(within(items()[1]).getByRole("button", { name: "markReviewed.button" })).toBeEnabled();
    // 41.28 (Ask first 2): „(actualizat azi)" follows the value on its line, before the button.
    const line = items()[0].querySelector("[data-classification-line]")!;
    expect(line.querySelector("[data-read-value]")!.compareDocumentPosition(within(items()[0]).getByText("lastChangedToday")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.contains(within(items()[0]).getByText("lastChangedToday"))).toBe(true);
    expect(within(items()[1]).queryByText("lastChangedToday")).toBeNull();
    // 41.28 (Ask first 3): one „i" in the tile, named for the tile. 41.37 inverted in place — it was „at the right end
    // of its top line" ([data-classification-top]); now on the title's line, right after „Clasificare" (the tile's hint
    // slot), and the top line is drawn only with several versions.
    // Rendered here without a tile around it, so the „i" stays on that top line; in a tile, the next test.
    expect(document.querySelectorAll("[data-info-glyph]")).toHaveLength(1);
    expect(document.querySelector("[data-classification-top] [data-info-glyph]")).not.toBeNull();
    // No save while reading: „Editează" is the way in.
    expect(screen.queryByRole("button", { name: "save" })).toBeNull();
    expect(screen.getByRole("button", { name: /^editTile/ })).toBeTruthy();
  });

  it("41.37: in its tile the one „i” sits on the title's line, right after „Clasificare”; no top line with one version", async () => {
    renderInFrame();
    await waitFor(() => expect(document.querySelector("[data-tile-title-line] [data-info-glyph]")).not.toBeNull());
    const line = document.querySelector("[data-tile-title-line]")!;
    expect(line.querySelector("h2")!.textContent).toBe("Clasificare");
    expect(line.querySelector("h2")!.nextElementSibling!.querySelector("[data-info-glyph]")).not.toBeNull();
    expect(document.querySelectorAll("[data-info-glyph]")).toHaveLength(1);
    expect(document.querySelector("[data-classification-top]")).toBeNull();
  });

  it("„Editează”: three selects, „Salvează” disabled until something changes, then one save writes the three values and it reads again", async () => {
    renderTile();
    fireEvent.click(await screen.findByRole("button", { name: /^editTile/ }));
    const selects = await screen.findAllByRole("combobox");
    expect(selects.map((x) => x.getAttribute("aria-label"))).toEqual(["importance.title", "relevance.title", "provenance.title"]);
    // While editing, no review button: it marks the saved value, not the one being chosen.
    expect(screen.queryByRole("button", { name: "markReviewed.button" })).toBeNull();
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
    // A change writes nothing until „Salvează".
    fireEvent.change(selects[0], { target: { value: "HIGH" } });
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    // Queried afresh: IconButton replaces its button when `disabled` flips (FU-291).
    await waitFor(() => expect(screen.getByRole("button", { name: "save" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toBe("/api/metadata/po-1");
    expect(JSON.parse(patch.body!)).toEqual({ importance: "HIGH", relevance: "CURRENT", provenance: "MANUAL" });
    await waitFor(() => expect(document.querySelectorAll("select")).toHaveLength(0));
  });

  it("„Renunță” puts the values back and sends nothing", async () => {
    renderTile();
    fireEvent.click(await screen.findByRole("button", { name: /^editTile/ }));
    fireEvent.change((await screen.findAllByRole("combobox"))[1], { target: { value: "FUTURE" } });
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    await waitFor(() => expect(document.querySelectorAll("select")).toHaveLength(0));
    expect(items()[1].querySelector("[data-read-value]")?.textContent).toBe("relevance.current");
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("on a version that is not the latest: no „Editează”, no review buttons", async () => {
    versions = [
      { id: "v0", versionNumber: 0, snapshot, createdAt: "" },
      { id: "v1", versionNumber: 1, snapshot: { ...snapshot, importance: "HIGH" }, createdAt: "" },
    ];
    renderTile();
    fireEvent.click(await screen.findByRole("button", { name: "version.prev" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /^editTile/ })).toBeNull());
    expect(screen.queryByRole("button", { name: "markReviewed.button" })).toBeNull();
  });

  it("in its frame: „Editează” in the title's corner, the blue outline while editing", async () => {
    const { container } = renderInFrame();
    const edit = await screen.findByRole("button", { name: /^editTile/ });
    expect(container.querySelector("[data-tile-action-slot]")!.contains(edit)).toBe(true);
    fireEvent.click(edit);
    await waitFor(() => expect(container.querySelector("[data-tile]")).toHaveAttribute("data-tile-editing"));
    expect(container.querySelector("[data-tile]")!.className).toContain("outline-bl-strong");
  });

  it("with no value at all it folds to one line — the title, „necompletat”, „Adaugă” — which opens the selects", async () => {
    meta = { ...META, importance: null, relevance: null, provenance: null };
    const { container } = renderInFrame();
    await waitFor(() => expect(container.querySelector("[data-empty-tile=classification]")).not.toBeNull());
    expect(container.querySelector("[data-tile]")).toHaveAttribute("data-tile-folded");
    expect(container.querySelector("[data-tile-title]")).toBeNull();
    fireEvent.click(container.querySelector("[data-empty-tile-add]")!);
    await waitFor(() => expect(container.querySelectorAll("select")).toHaveLength(3));
    expect(container.querySelector("[data-tile]")).not.toHaveAttribute("data-tile-folded");
  });

  // 41.10: 2 units of 119 px, 254 px — half of 40.98's 4 (524 px).
  it("the tile is 2 units on all four screens", () => {
    expect(CLASSIFICATION_UNITS).toBe(2);
    for (const k of ["naturalPerson", "judicialPerson", "property", "document"] as const) {
      expect(LIST_UNITS[k].classification).toBe(2);
    }
    expect(unitsRem(2) * 16).toBe(254);
  });
});
