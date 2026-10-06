/**
 * Slice #37.82 — „Conexiuni": #37.81's divider between every two groups that
 * are drawn — „Etichete / Cuvinte cheie", „Grupuri", „Ștampile", „Vezi și" —
 * never first, never last, never two together. On an older version
 * „Etichete" is not drawn and „Grupuri" comes first with no line above it.
 * The groups stand 0.5rem from each line, so two groups are the 1rem they were
 * apart plus the line.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { EntityMetadataTab } from "@/components/entity-metadata-tab";
import { DIVIDER_HORIZONTAL } from "@/lib/ui/divider";

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
let versions: { id: string; versionNumber: number; snapshot: Record<string, string | null>; createdAt: string }[] = [];
let meta: Record<string, unknown> = META;
beforeEach(() => {
  calls = [];
  versions = [];
  meta = META;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
    const json = url === "/api/meta" ? meta
      : url.endsWith("/versions") ? { items: versions }
      : url.endsWith("/tags") && url.startsWith("/api/metadata") ? { tags: ["arendă", "moștenire", "litigiu"] }
      : url === "/api/tags" ? { tags: [] }
      : url.endsWith("/cross-refs") ? { crossRefs: CROSS_REFS }
      : {};
    return { ok: true, status: 200, redirected: false, json: async () => json };
  }) as unknown as typeof fetch;
});

function renderTile(part?: "connections") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EntityMetadataTab apiPath="/api/meta" queryKey="meta-conn-dividers" backHref="/x" backEntityName="X" part={part} />
    </QueryClientProvider>,
  );
}

/** The groups' column: each child a group or a divider, in order. */
const sequence = (): string[] => {
  const col = document.querySelector<HTMLElement>("[data-connections-groups]");
  if (!col) throw new Error("no groups column");
  return [...col.children].map((c) => (c as HTMLElement).dataset.divider ? "line" : (c.querySelector("h3")?.textContent ?? c.textContent ?? "").trim().split(/\s/)[0]);
};

describe("„Conexiuni”: a line between its groups (Slice #37.82)", () => {
  it("on the latest version: four groups, three lines, one between every two", async () => {
    renderTile("connections");
    await screen.findByRole("button", { name: "tags.remove arendă" });
    await waitFor(() => expect(sequence()).toHaveLength(7));
    expect(sequence().map((s) => (s === "line" ? "line" : "group"))).toEqual(["group", "line", "group", "line", "group", "line", "group"]);
    expect(sequence()[0]).toMatch(/tags\.title/);
    const lines = [...document.querySelectorAll<HTMLElement>("[data-connections-groups] > [data-divider]")];
    expect(lines).toHaveLength(3);
    for (const l of lines) expect(l.className).toBe(DIVIDER_HORIZONTAL);
    // 0.5rem either side of a line: the 1rem the groups were apart, plus the line.
    expect(document.querySelector("[data-connections-groups]")!.className).toMatch(/(^| )gap-2( |$)/);
  });

  it("on an older version „Etichete” is not drawn: „Grupuri” first, no line above it, two lines", async () => {
    versions = [
      { id: "v0", versionNumber: 0, snapshot: { importance: null, relevance: null, provenance: "MANUAL" }, createdAt: "" },
      { id: "v1", versionNumber: 1, snapshot: { importance: "HIGH", relevance: null, provenance: "MANUAL" }, createdAt: "" },
    ];
    renderTile(); // both sections in one panel: the version controls are there
    fireEvent.click(await screen.findByRole("button", { name: "version.prev" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "tags.remove arendă" })).toBeNull());
    const seq = sequence();
    expect(seq[0]).not.toBe("line");
    expect(seq[seq.length - 1]).not.toBe("line");
    expect(seq.filter((s) => s === "line")).toHaveLength(2);
    expect(seq[0]).toMatch(/groups\.title/);
  });

  it("with no principal object: „Grupuri” and „Ștampile”, one line between them", async () => {
    meta = { ...META, principalObjectId: null };
    renderTile("connections");
    await screen.findByText("stamps.empty");
    expect(sequence()).toEqual(["groups.title", "line", "stamps.title"]);
  });
});
