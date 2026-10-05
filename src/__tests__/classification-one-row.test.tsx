/**
 * Slice #37.68 — „Clasificări" on the four record screens:
 * Importanță and Relevanță are two columns of one row, and the save button
 * stands on „Istoric"'s line, against the tile's right edge. One component
 * draws the tile on all four screens, so it is tested once here; the units are
 * in field-widths.test.ts.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { EntityMetadataTab } from "@/components/entity-metadata-tab";
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
const historyLine = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>("[data-history-line]");
  if (!el) throw new Error("no „Istoric” line");
  return el;
};

describe("„Clasificări”: Importanță and Relevanță on one row (Slice #37.68)", () => {
  it("the row holds exactly Importanță and Relevanță, each with its select and review button; Proveniență is under it", async () => {
    renderTile();
    await screen.findByRole("heading", { name: "importance.title" });
    const sections = [...pair().children].filter((c) => c.tagName === "SECTION");
    expect(sections).toHaveLength(2);
    expect(sections.map((s) => s.querySelector("h3")?.textContent)).toEqual(["importance.title", "relevance.title"]);
    for (const s of sections) {
      expect(s.querySelectorAll("select")).toHaveLength(1);
      expect(within(s as HTMLElement).getByRole("button", { name: "markReviewed.button" })).toBeTruthy();
    }
    // „Actualizat …" stays under its own select.
    expect(within(sections[0] as HTMLElement).getByText("lastChangedToday")).toBeTruthy();
    expect(within(sections[1] as HTMLElement).queryByText("lastChangedToday")).toBeNull();
    // Proveniență is not in the row: a section of its own after it.
    const provenance = screen.getByRole("heading", { name: "provenance.title" }).closest("section");
    expect(provenance).not.toBeNull();
    expect(pair().contains(provenance)).toBe(false);
    expect(pair().compareDocumentPosition(provenance!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Slice #38.01: Proveniență starts on the shared left line, the pair row's two cells do not.
    expect(provenance).toHaveAttribute("data-aligned-left");
    for (const s of sections) expect(s).not.toHaveAttribute("data-aligned-left");
  });

  it("the save button is on „Istoric”'s line, after the title (the line's right end), and nowhere else", async () => {
    renderTile();
    const save = await screen.findByRole("button", { name: "save" });
    const line = historyLine();
    expect(line.contains(save)).toBe(true);
    expect(line.className).toMatch(/justify-between/);
    expect(line.firstElementChild?.textContent).toBe("provenance.historyTitle");
    // The button is the line's last element — inside its tooltip's wrapper.
    expect(line.lastElementChild?.contains(save)).toBe(true);
    expect(screen.getAllByRole("button", { name: "save" })).toHaveLength(1);
  });

  it("it keeps its behaviour: disabled until something changes, then a save writes the three values", async () => {
    renderTile();
    expect(await screen.findByRole("button", { name: "save" })).toBeDisabled();
    fireEvent.change(pair().querySelectorAll("select")[0], { target: { value: "HIGH" } });
    // Queried afresh: IconButton replaces its button when `disabled` flips (FU-291).
    await waitFor(() => expect(screen.getByRole("button", { name: "save" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toBe("/api/metadata/po-1");
    expect(JSON.parse(patch.body!)).toEqual({ importance: "HIGH", relevance: "CURRENT", provenance: "MANUAL" });
    // „✓ Salvat" after the save, still on „Istoric"'s line.
    const saved = await screen.findByRole("button", { name: "saved" });
    expect(historyLine().contains(saved)).toBe(true);
  });

  it("on a version that is not the latest there is no save button, and „Istoric” is alone on its line", async () => {
    versions = [
      { id: "v0", versionNumber: 0, snapshot, createdAt: "" },
      { id: "v1", versionNumber: 1, snapshot: { ...snapshot, importance: "HIGH" }, createdAt: "" },
    ];
    renderTile();
    fireEvent.click(await screen.findByRole("button", { name: "version.prev" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "save" })).toBeNull());
    expect(historyLine().children).toHaveLength(1);
    expect(historyLine().textContent).toBe("provenance.historyTitle");
  });

  it("the tile is 3 units on all four screens — the fewest that hold the row (rule 17)", () => {
    expect(CLASSIFICATION_UNITS).toBe(3);
    for (const k of ["naturalPerson", "judicialPerson", "property", "document"] as const) {
      expect(LIST_UNITS[k].classification).toBe(3);
    }
    expect(unitsRem(3) * 16).toBe(476);
  });
});
