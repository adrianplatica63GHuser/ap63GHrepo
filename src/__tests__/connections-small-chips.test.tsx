/**
 * Slice #37.69 — „Conexiuni": each tag is a small chip that only wraps its
 * text, and every remove „×" in the tile — a tag's, a group's, a stamp's, a
 * „Vezi și" link's — shows only while the pointer is over its chip or row, or
 * the chip or row has focus. jsdom draws no hover, so what is checked is the
 * rule as classes: transparent until `group-hover` / `group-focus-within`, the
 * tag's „×" laid over the chip rather than in its flow, and still a named,
 * clickable button.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { EntityMetadataTab } from "@/components/entity-metadata-tab";

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
  groups: [{ id: "g1", code: "GRP-001", position: 1, description: "Moștenirea Ionescu", memberCount: 2 }],
  stamps: [{ id: "s1", code: "URGENT", shortDescription: "De rezolvat" }],
  importance: null, relevance: null, provenance: "MANUAL", provenanceHistory: [],
  importanceUpdatedAt: null, relevanceUpdatedAt: null, provenanceUpdatedAt: null,
};
const CROSS_REFS = [
  { id: "x1", peerType: "PROPERTY", peerEntityId: "p1", peerName: "Teren", peerCode: "PROP1", note: null, isOwner: true },
];

let calls: { url: string; method: string; body?: string }[] = [];
beforeEach(() => {
  calls = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
    const json = url === "/api/meta" ? META
      : url.endsWith("/tags") && url.startsWith("/api/metadata") ? { tags: ["arendă", "moștenire", "litigiu"] }
      : url === "/api/tags" ? { tags: [] }
      : url.endsWith("/cross-refs") ? { crossRefs: CROSS_REFS }
      : {};
    return { ok: true, status: 200, redirected: false, json: async () => json };
  }) as unknown as typeof fetch;
});

function renderTile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EntityMetadataTab apiPath="/api/meta" queryKey="meta-chips" backHref="/x" backEntityName="X" part="connections" />
    </QueryClientProvider>,
  );
}

/** The element that carries a button's placement and reveal classes: its tooltip wrapper. */
const wrapperOf = (button: HTMLElement): HTMLElement => button.parentElement as HTMLElement;

const REVEAL = ["opacity-0", "group-hover:opacity-100", "group-focus-within:opacity-100"];

describe("„Conexiuni”: small tag chips, the „×” only on hover or focus (Slice #37.69)", () => {
  it("a chip only wraps its text: 4 px above and below, 8 px a side, the chips 6 px apart", async () => {
    renderTile();
    const remove = await screen.findByRole("button", { name: "tags.remove arendă" });
    const chip = remove.closest<HTMLElement>("[data-tag-chip]");
    expect(chip).not.toBeNull();
    expect(chip!.className).toMatch(/(^| )px-2( |$)/);
    expect(chip!.className).toMatch(/(^| )py-1( |$)/);
    expect(chip!.className).toMatch(/(^| )text-sm( |$)/);
    expect(chip!.className).not.toMatch(/px-3/);
    expect(chip!.closest("[data-tag-chips]")!.className).toMatch(/(^| )gap-1\.5( |$)/);
    expect(document.querySelectorAll("[data-tag-chip]")).toHaveLength(3);
  });

  it("a chip's „×” is hidden until the chip is hovered or focused, and laid over the chip, not in its flow", async () => {
    renderTile();
    const remove = await screen.findByRole("button", { name: "tags.remove arendă" });
    const chip = remove.closest<HTMLElement>("[data-tag-chip]")!;
    expect(chip.className).toMatch(/(^| )group( |$)/);
    expect(chip.className).toMatch(/(^| )relative( |$)/);
    const wrap = wrapperOf(remove);
    for (const c of REVEAL) expect(wrap.classList).toContain(c);
    expect(wrap.classList).toContain("absolute");
    // Where nothing hovers (a touch screen) it is always drawn.
    expect(wrap.className).toContain("[@media(hover:none)]:opacity-100");
    // Not removed from the page: still named and still a tab stop.
    expect(remove.getAttribute("tabindex")).not.toBe("-1");
    expect(remove).toBeEnabled();
  });

  it("clicking the „×” still removes that tag", async () => {
    renderTile();
    fireEvent.click(await screen.findByRole("button", { name: "tags.remove moștenire" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    const del = calls.find((c) => c.method === "DELETE")!;
    expect(del.url).toBe("/api/metadata/po-1/tags");
    expect(JSON.parse(del.body!)).toEqual({ tag: "moștenire" });
  });

  it("Grupuri, Ștampile and Vezi și: each row's „×” shows only while its row is hovered or focused", async () => {
    renderTile();
    for (const name of ["groups.remove GRP-001", "stamps.remove URGENT", "crossRef.remove"]) {
      const remove = await screen.findByRole("button", { name });
      const row = remove.closest("li")!;
      expect(row.className).toMatch(/(^| )group( |$)/);
      for (const c of REVEAL) expect(wrapperOf(remove).classList).toContain(c);
    }
  });
});
