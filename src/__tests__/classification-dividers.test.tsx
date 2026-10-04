/**
 * Slice #37.81 — „Clasificare subiectivă": one divider for every line in the
 * tile. A vertical one between Importanță's and Relevanță's cells, a
 * horizontal one before Proveniență, and the version controls' line — all the
 * shared `Divider` (src/lib/ui/divider.tsx), 1 px in the rim colour inside the
 * tile's padding. Each of the two cells centres its content across; the grid
 * centres the shorter down against the taller. Measured in the browser by
 * TC-TILES-16.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import fs from "node:fs";
import path from "node:path";

import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { DIVIDER_HORIZONTAL, DIVIDER_VERTICAL, Divider } from "@/lib/ui/divider";

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

const pair = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>("[data-classification-pair]");
  if (!el) throw new Error("no pair row");
  return el;
};

const dividers = (root: ParentNode = document) => [...root.querySelectorAll<HTMLElement>("[data-divider]")];

describe("„Clasificare subiectivă”: the dividers and the two cells (Slice #37.81)", () => {
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

  it("a vertical divider between the two cells, each centred; a horizontal one before Proveniență", async () => {
    renderTile();
    await screen.findAllByText("importance.title");
    const row = pair();
    const kids = [...row.children] as HTMLElement[];
    expect(kids.map((k) => k.tagName === "SECTION" ? "cell" : k.dataset.divider)).toEqual(["cell", "vertical", "cell"]);
    for (const cell of [kids[0], kids[2]]) {
      expect(cell.className).toMatch(/items-center/);
      expect(cell.className).toMatch(/text-center/);
    }
    expect(row.className).toMatch(/\bgrid\b/);
    expect(row.className).toMatch(/items-center/);
    expect(row.style.gridTemplateColumns).toBe("minmax(0, 1fr) auto minmax(0, 1fr)");
    // The horizontal line comes right after the pair row, before Proveniență's section.
    const next = row.nextElementSibling as HTMLElement;
    expect(next.dataset.divider).toBe("horizontal");
    expect(next.nextElementSibling?.querySelector("h3")?.textContent).toBe("provenance.title");
    // One version: no version line, so two dividers in the tile.
    expect(dividers()).toHaveLength(2);
  });

  it("with two versions the version controls' line is the shared divider too; on an older one the same holds", async () => {
    versions = [
      { id: "v0", versionNumber: 0, snapshot, createdAt: "" },
      { id: "v1", versionNumber: 1, snapshot: { ...snapshot, importance: "HIGH" }, createdAt: "" },
    ];
    renderTile();
    const prev = await screen.findByRole("button", { name: "version.prev" });
    await waitFor(() => expect(dividers()).toHaveLength(3));
    expect(dividers()[0].dataset.divider).toBe("horizontal");
    expect(dividers()[0].previousElementSibling?.contains(prev)).toBe(true);
    // No bespoke border left on the version line.
    expect((dividers()[0].previousElementSibling as HTMLElement).className).not.toMatch(/border-b/);
    fireEvent.click(prev);
    await waitFor(() => expect(screen.queryByRole("button", { name: "markReviewed.button" })).toBeNull());
    expect(dividers().map((d) => d.dataset.divider)).toEqual(["horizontal", "vertical", "horizontal"]);
    expect([...pair().children].filter((c) => c.tagName === "SECTION")).toHaveLength(2);
  });

  it("no line in the tile is drawn any other way", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "components", "entity-metadata-tab.tsx"), "utf8");
    const part = src.slice(src.indexOf("{showClassification && (<>"), src.indexOf("{showConnections && (<>"));
    // The only rim border left is the „Clasificare" subheader, drawn when both sections share one panel (no `part`).
    expect(part.match(/border-b border-card-rim/g) ?? []).toHaveLength(1);
    expect(part).toMatch(/\{!part && \(\s*<h3 className="border-b border-card-rim/);
    expect((part.match(/<Divider\b/g) ?? [])).toHaveLength(3);
  });
});
