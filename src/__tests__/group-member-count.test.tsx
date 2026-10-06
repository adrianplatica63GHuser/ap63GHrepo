/**
 * Slice #38.11 — in „Conexiuni" → „Grupuri" the number in brackets after a
 * group's code is how many members the group has now — „GRP-001 [2]" — not this
 * record's position in it, a high-water counter („[12]" in a group of two).
 * The count is read in the same query that returns the record's groups.
 */
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { readFileSync } from "fs";
import { join } from "path";

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
  // A group of two whose members hold positions 11 and 12 — what Adrian saw on GRP-001.
  groups: [
    { id: "g1", code: "GRP-001", position: 12, description: "Moștenirea Ionescu", memberCount: 2 },
    { id: "g2", code: "GRP-002", position: 1, description: "Arendă", memberCount: 1 },
  ],
  stamps: [],
  importance: null, relevance: null, provenance: "MANUAL", provenanceHistory: [],
  importanceUpdatedAt: null, relevanceUpdatedAt: null, provenanceUpdatedAt: null,
};

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    const json = url === "/api/meta" ? META : url.endsWith("/versions") ? { items: [] } : url.includes("/tags") ? { tags: [] } : url.endsWith("/cross-refs") ? { crossRefs: [] } : {};
    return { ok: true, status: 200, redirected: false, json: async () => json };
  }) as unknown as typeof fetch;
});

describe("„Grupuri”: the group's member count in brackets (#38.11)", () => {
  it("reads [2] for a group of two whose member here holds position 12; unpadded; „2 membri” as its tooltip", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <EntityMetadataTab apiPath="/api/meta" queryKey="group-member-count" backHref="/x" backEntityName="X" part="connections" />
      </QueryClientProvider>,
    );
    const chip = (await screen.findByText(/^GRP-001/)).closest("span")!;
    expect(chip.textContent).toBe("GRP-001 [2]");
    expect(chip.getAttribute("title")).toBe("groups.members:2");
    expect(chip.textContent).not.toMatch(/12|\[02\]/);
    const one = (await screen.findByText(/^GRP-002/)).closest("span")!;
    expect(one.textContent).toBe("GRP-002 [1]");
  });

  it("the count comes from the query that lists the record's groups — one count per group, in that query", () => {
    const src = readFileSync(join(process.cwd(), "src", "lib", "groups", "queries.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function listEntityGroupTags("), src.indexOf("export async function listEntityGroupTags(") + 1200);
    expect(fn).toMatch(/memberCount: sql<number>`\(SELECT count\(\*\)::int FROM "group_member" AS gm WHERE gm\.group_id = \$\{groups\.id\}\)`/);
    expect(src).toMatch(/export type GroupEntityTag = \{[^}]*memberCount: number \}/);
  });

  it("the words, in both languages", () => {
    const ro = JSON.parse(readFileSync(join(process.cwd(), "messages", "ro-RO.json"), "utf8")).shared.entityMetadata.groups;
    const en = JSON.parse(readFileSync(join(process.cwd(), "messages", "en-GB.json"), "utf8")).shared.entityMetadata.groups;
    expect(ro.members).toBe("{count, plural, one {# membru} few {# membri} other {# de membri}}");
    expect(en.members).toBe("{count, plural, one {# member} other {# members}}");
  });
});
