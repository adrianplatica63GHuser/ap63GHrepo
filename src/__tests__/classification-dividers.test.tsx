/**
 * Slice #37.81 — „Clasificări": one divider for every line in the
 * tile, the shared `Divider` (src/lib/ui/divider.tsx), 1 px in the rim colour inside the tile's padding.
 *
 * Slice 41.10: the tile reads as a gray tile — the three values one to a row, no cells side by side — so the vertical
 * divider and the one before Proveniență went with the pair row; the version controls' line keeps its. #38.01's
 * shifted select rows and shared left line went too: `classification-left-line.ts` is no longer drawn, and only its
 * own arithmetic is still tested here.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import fs from "node:fs";
import path from "node:path";

import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { DIVIDER_HORIZONTAL, DIVIDER_VERTICAL, Divider } from "@/lib/ui/divider";
import {
  SELECT_ROW_SHIFT,
  SHARED_LEFT_VAR,
  SHIFTED_SELECT_ROW,
  shiftedSelectLeft,
  useSharedLeftLine,
} from "@/lib/ui/classification-left-line";

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

let versions: { id: string; versionNumber: number; snapshot: typeof snapshot; createdAt: string }[] = [];
let calls: { url: string; method: string; body?: string }[] = [];
beforeEach(() => {
  calls = [];
  versions = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
    const json = url === "/api/meta" ? META
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

const dividers = (root: ParentNode = document) => [...root.querySelectorAll<HTMLElement>("[data-divider]")];

describe("„Clasificări”: the dividers and the two cells (Slice #37.81)", () => {
  it("the shared divider is one look: 1 px in the rim colour, horizontal or vertical", () => {
    const { container } = render(<><Divider /><Divider vertical /></>);
    const [h, v] = [...container.querySelectorAll<HTMLElement>("[role=separator]")];
    expect(h.className).toBe(DIVIDER_HORIZONTAL);
    expect(v.className).toBe(DIVIDER_VERTICAL);
    expect(h).toHaveAttribute("aria-orientation", "horizontal");
    expect(v).toHaveAttribute("aria-orientation", "vertical");
    for (const el of [h, v]) expect(el.className).toMatch(/border-card-rim dark:border-zinc-700/);
    expect(DIVIDER_HORIZONTAL).toMatch(/\bborder-t\b/);
    expect(DIVIDER_VERTICAL).toMatch(/\bborder-l\b/);
  });

  // Slice 41.10: was „a vertical divider between the two cells, each centred; a horizontal one before Proveniență".
  it("one version: no line in the tile; the three values one to a row", async () => {
    renderTile();
    await screen.findAllByText("importance.title");
    expect(document.querySelector("[data-classification-pair]")).toBeNull();
    expect(dividers()).toHaveLength(0);
    const items = [...document.querySelectorAll<HTMLElement>("[data-classification-item]")];
    expect(items.map((i) => i.dataset.classificationItem)).toEqual(["importance", "relevance", "provenance"]);
    for (const i of items) expect(i.parentElement).toBe(items[0].parentElement);
  });

  it("with two versions the version controls' line is the shared divider; on an older one the same holds", async () => {
    versions = [
      { id: "v0", versionNumber: 0, snapshot, createdAt: "" },
      { id: "v1", versionNumber: 1, snapshot: { ...snapshot, importance: "HIGH" }, createdAt: "" },
    ];
    renderTile();
    const prev = await screen.findByRole("button", { name: "version.prev" });
    await waitFor(() => expect(dividers()).toHaveLength(1));
    expect(dividers()[0].dataset.divider).toBe("horizontal");
    expect(dividers()[0].previousElementSibling?.contains(prev)).toBe(true);
    // No bespoke border left on the version line.
    expect((dividers()[0].previousElementSibling as HTMLElement).className).not.toMatch(/border-b/);
    fireEvent.click(prev);
    await waitFor(() => expect(screen.queryByRole("button", { name: "markReviewed.button" })).toBeNull());
    expect(dividers().map((d) => d.dataset.divider)).toEqual(["horizontal"]);
  });

  it("no line in the tile is drawn any other way", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "components", "entity-metadata-tab.tsx"), "utf8");
    const part = src.slice(src.indexOf("{showClassification && (<>"), src.indexOf("{showConnections && (<>"));
    // The only rim border left is the „Clasificare" subheader, drawn when both sections share one panel (no `part`).
    expect(part.match(/border-b border-card-rim/g) ?? []).toHaveLength(1);
    expect(part).toMatch(/\{!part && \(\s*<h3 className="border-b border-card-rim/);
    expect((part.match(/<Divider\b/g) ?? [])).toHaveLength(1);
    expect(src).not.toContain("classification-left-line");
  });
});

/**
 * Slice #38.01 — each cell's select row a little further left: the select
 * 0.75 × its centred gap from the cell's left edge, its button beside it; the
 * title and the notes still centred. Proveniență starts on Importanță's select's
 * left edge, which the column above both measures and carries as
 * `--classification-left`. Measured in the browser by TC-TILES-16.
 */
// Slice 41.10: the module is no longer drawn (the tile has no pair row); its arithmetic stays tested while it stays.
describe("„Clasificări”: the select rows shifted, Proveniență on Importanță's left line (Slice #38.01)", () => {
  it("the shift is a quarter of the gap, and the row's tracks share the free width 0.75 : 1.25", () => {
    expect(SELECT_ROW_SHIFT).toBe(0.25);
    expect(SHIFTED_SELECT_ROW).toEqual({ gridTemplateColumns: "0.75fr auto 1.25fr", columnGap: 0 });
    // The browser's numbers (runner 20261005T185820Z-28557): cells 208.5 px, selects 105 and 132 px;
    // today's gaps 51.75 and 38.25 px, so after the shift 38.8125 and 28.6875 — what was measured after.
    expect(shiftedSelectLeft(208.5, 105)).toBeCloseTo(0.75 * 51.75, 6);
    expect(shiftedSelectLeft(208.5, 132)).toBeCloseTo(0.75 * 38.25, 6);
    // The empty track is exactly that: 0.75 of the free width's two halves.
    expect(shiftedSelectLeft(208.5, 105)).toBeCloseTo((0.75 / (0.75 + 1.25)) * (208.5 - 105), 6);
  });

  it("the line is measured from Importanță's select to the pair row's left edge", () => {
    function Probe() {
      const ref = useSharedLeftLine();
      return (
        <div ref={ref} data-testid="column">
          <div data-classification-pair="">
            <section><select data-testid="first" /></section>
            <section><select /></section>
          </div>
        </div>
      );
    }
    const rect = (left: number) => ({ left, right: left, top: 0, bottom: 0, width: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
    const spy = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.dataset.testid === "first") return rect(150.5);
      if (this.hasAttribute("data-classification-pair")) return rect(111.75);
      return rect(0);
    });
    try {
      render(<Probe />);
      expect(screen.getByTestId("column").style.getPropertyValue(SHARED_LEFT_VAR)).toBe("38.75px");
    } finally {
      spy.mockRestore();
    }
  });

  it("with no pair row the line is not set", () => {
    function Probe() {
      const ref = useSharedLeftLine();
      return <div ref={ref} data-testid="column"><section><select /></section></div>;
    }
    render(<Probe />);
    expect(screen.getByTestId("column").style.getPropertyValue(SHARED_LEFT_VAR)).toBe("");
  });
});
