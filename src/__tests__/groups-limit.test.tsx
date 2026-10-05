/**
 * Slice #38.10 — a record already in as many groups as it may: „Grupuri" says
 * so in plain words and its „+" is disabled, instead of opening an empty
 * picker. Under the limit it works as before; with no group left to join, the
 * picker says „niciun grup disponibil". The number is the server's own
 * constant. One component, the four record screens.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { readFileSync } from "fs";
import { join } from "path";

import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { MAX_GROUPS_PER_ITEM, MAX_GROUPS_PER_PROPERTY } from "@/lib/groups/validation";

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

const group = (n: number) => ({ id: `g${n}`, code: `GRP-00${n}`, position: n, description: `Grupul ${n}` });
const meta = (groups: number) => ({
  principalObjectId: "po-1",
  groups: Array.from({ length: groups }, (_, i) => group(i + 1)),
  stamps: [],
  importance: null, relevance: null, provenance: "MANUAL", provenanceHistory: [],
  importanceUpdatedAt: null, relevanceUpdatedAt: null, provenanceUpdatedAt: null,
});

let current = meta(3);
let available: { id: string; code: string; description: string }[] = [];
let calls: { url: string; method: string }[] = [];
beforeEach(() => {
  calls = [];
  available = [{ id: "g9", code: "GRP-009", description: "Altul" }];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET" });
    const json = url.endsWith("/entity-references") ? current
      : url.endsWith("/versions") ? { items: [] }
      : url === "/api/metadata/po-1/groups" ? { groups: available }
      : url.includes("/tags") ? { tags: [] }
      : url.endsWith("/cross-refs") ? { crossRefs: [] }
      : {};
    return { ok: true, status: 200, redirected: false, json: async () => json };
  }) as unknown as typeof fetch;
});

function renderTile(apiPath = "/api/properties/p1/entity-references") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EntityMetadataTab apiPath={apiPath} queryKey={`groups-limit-${Math.random()}`} backHref="/x" backEntityName="X" part="connections" />
    </QueryClientProvider>,
  );
}

describe("„Grupuri” at the limit (#38.10)", () => {
  it("the limit is the server's: three for a property, three for a person or a document", () => {
    expect(MAX_GROUPS_PER_PROPERTY).toBe(3);
    expect(MAX_GROUPS_PER_ITEM).toBe(3);
  });

  it("three groups: „+” disabled, named by the limit, and the line under the list says it — the number from the constant", async () => {
    current = meta(3);
    renderTile();
    const plus = await screen.findByRole("button", { name: `groups.limitReached:${MAX_GROUPS_PER_PROPERTY}` });
    expect(plus).toBeDisabled();
    expect(plus).not.toHaveAttribute("aria-expanded", "true");
    const line = document.querySelector<HTMLElement>("[data-groups-limit]")!;
    expect(line.textContent).toBe(`groups.limit:${MAX_GROUPS_PER_PROPERTY}`);
    expect(line.className).toMatch(/\bitalic\b/);
    expect(screen.queryByRole("button", { name: "groups.add" })).toBeNull();
  });

  it("two groups: „+” enabled, no line; it opens the picker", async () => {
    current = meta(2);
    renderTile();
    const plus = await screen.findByRole("button", { name: "groups.add" });
    expect(plus).toBeEnabled();
    expect(document.querySelector("[data-groups-limit]")).toBeNull();
    fireEvent.click(plus);
    await waitFor(() => expect(screen.getByRole("option", { name: "GRP-009 — Altul" })).toBeTruthy());
  });

  it("under the limit with no group left to join: the picker says „niciun grup disponibil”", async () => {
    current = meta(1);
    available = [];
    renderTile();
    fireEvent.click(await screen.findByRole("button", { name: "groups.add" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "groups.noneAvailable" })).toBeTruthy());
  });

  it("a person's or a document's screen reads the item limit", async () => {
    current = meta(3);
    renderTile("/api/documents/d1/entity-references");
    expect(await screen.findByRole("button", { name: `groups.limitReached:${MAX_GROUPS_PER_ITEM}` })).toBeDisabled();
  });

  it("no second „3” is written in the component, and both languages say it", () => {
    const src = readFileSync(join(process.cwd(), "src", "components", "entity-metadata-tab.tsx"), "utf8");
    expect(src).toMatch(/const groupCap = apiPath\.startsWith\("\/api\/properties\/"\) \? MAX_GROUPS_PER_PROPERTY : MAX_GROUPS_PER_ITEM;/);
    const ro = JSON.parse(readFileSync(join(process.cwd(), "messages", "ro-RO.json"), "utf8")).shared.entityMetadata.groups;
    const en = JSON.parse(readFileSync(join(process.cwd(), "messages", "en-GB.json"), "utf8")).shared.entityMetadata.groups;
    expect(ro.limit).toBe("Un element poate face parte din cel mult {max} grupuri. Scoateți-l dintr-un grup pentru a-l adăuga în altul.");
    expect(en.limit).toBe("A record can belong to at most {max} groups. Remove it from one to add it to another.");
    expect(ro.noneAvailable).toBe("niciun grup disponibil");
    for (const m of [ro, en]) expect(m.limit).not.toMatch(/\b3\b/);
  });
});
