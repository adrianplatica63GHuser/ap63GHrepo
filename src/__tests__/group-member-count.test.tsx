/**
 * Slice 41.95 rewrote this suite in place. It was #38.11's: in „Conexiuni" → „Grupuri" the number in brackets after a
 * group's code is how many members the group has now — „GRP-001 [2]", „2 membri" as its tooltip
 * (`data-group-member-count`). Adrian, 2026-11-06: „The Groups section: • should not display the numbers of items in
 * the group • when hovering over the Grey rectangle that contains the ID of the group the system will no longer display
 * the number of members in the group". So the rectangle reads the code alone, with no tooltip; the description beside it
 * runs to the tile's edge, cut after three lines (two for a stamp), whole in the bubble. The query still returns the
 * count (`memberCount`), which the group screens and the map use.
 */
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { readFileSync } from "fs";
import { join } from "path";

import { CODE_RECT, EntityMetadataTab } from "@/components/entity-metadata-tab";

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
  groups: [
    { id: "g1", code: "GRP-001", position: 12, description: "Moștenirea Ionescu", memberCount: 2 },
    { id: "g2", code: "GRP-002", position: 1, description: "Arendă", memberCount: 1 },
  ],
  stamps: [{ id: "s1", code: "URGENT", shortDescription: "De rezolvat" }],
  importance: null, relevance: null, provenance: "MANUAL", provenanceHistory: [],
  importanceUpdatedAt: null, relevanceUpdatedAt: null, provenanceUpdatedAt: null,
};

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    const json = url === "/api/meta" ? META : url.endsWith("/versions") ? { items: [] } : url.includes("/tags") ? { tags: [] } : url.endsWith("/cross-refs") ? { crossRefs: [] } : {};
    return { ok: true, status: 200, redirected: false, json: async () => json };
  }) as unknown as typeof fetch;
});

function renderTile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EntityMetadataTab apiPath="/api/meta" queryKey="group-member-count" backHref="/x" backEntityName="X" part="connections" />
    </QueryClientProvider>,
  );
}

describe("„Grupuri”: the code alone, no member count (Slice 41.95; was #38.11's „[2]”)", () => {
  it("the rectangle reads the code alone, with no tooltip and no data-group-member-count", async () => {
    renderTile();
    const code = await screen.findByText("GRP-001");
    expect(code.className).toBe(CODE_RECT);
    expect(code.textContent).toBe("GRP-001");
    expect(code.getAttribute("title")).toBeNull();
    expect(code.closest("[data-code-chip]")!.getAttribute("title")).toBeNull();
    expect(document.querySelector("[data-group-member-count]")).toBeNull();
    expect(screen.getByText("GRP-002").textContent).toBe("GRP-002");
    expect(document.body.textContent).not.toMatch(/\[\d+\]/);
  });

  it("the description is the link to the group, to the tile's edge, cut after three lines; a stamp's after two", async () => {
    renderTile();
    const desc = (await screen.findByText("Moștenirea Ionescu")).closest<HTMLElement>("a")!;
    expect(desc.getAttribute("data-row-description")).toBe("3");
    for (const c of ["min-w-0", "flex-1", "line-clamp-3"]) expect(desc.classList).toContain(c);
    // The whole text for the bubble, shown only when it is cut (TextTooltip measures).
    expect(desc.getAttribute("data-hint")).toBe("Moștenirea Ionescu");
    expect(desc.closest("li")!.querySelector("[data-code-chip]")!.contains(desc)).toBe(false);
    const stamp = (await screen.findByText("De rezolvat")).closest<HTMLElement>("a")!;
    expect(stamp.getAttribute("data-row-description")).toBe("2");
    expect(stamp.classList).toContain("line-clamp-2");
  });

  it("the count is no longer drawn — and its words are gone from both languages", () => {
    const src = readFileSync(join(process.cwd(), "src", "components", "entity-metadata-tab.tsx"), "utf8");
    expect(src).not.toMatch(/labelMembers|groups\.members|data-group-member-count/);
    for (const l of ["ro-RO", "en-GB"]) {
      const g = JSON.parse(readFileSync(join(process.cwd(), "messages", `${l}.json`), "utf8")).shared.entityMetadata.groups;
      expect(g.members).toBeUndefined();
    }
  });

  it("the query still returns the count, for the screens that show it", () => {
    const src = readFileSync(join(process.cwd(), "src", "lib", "groups", "queries.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function listEntityGroupTags("), src.indexOf("export async function listEntityGroupTags(") + 1200);
    expect(fn).toMatch(/memberCount: sql<number>`\(SELECT count\(\*\)::int FROM "group_member" AS gm WHERE gm\.group_id = \$\{groups\.id\}\)`/);
  });
});
