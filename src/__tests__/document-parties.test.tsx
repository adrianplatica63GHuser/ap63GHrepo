/**
 * Slice #38.33 — a contract de vânzare's „Părți”: its sellers and buyers, with
 * their shares, grouped by role; and „Legături” without them.
 *
 * Slice #39.48 — one rule for the three types with „Părți” (the act adițional and
 * the certificat de moștenitor too), and the line on „Legături” that says where
 * the parties are and brings „Părți” into view.
 *
 * The real tiles over a real `QueryClient`, the edges mocked as in
 * related-tile.test.tsx.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "fs";
import path from "path";
import type { ReactNode } from "react";

import { DocumentPartiesTile } from "@/app/documents/_components/document-parties-tile";
import { DocumentRelatedTile } from "@/app/documents/_components/document-related-tile";
import { PARTIES_TILE, documentTileRegistry } from "@/app/documents/_components/document-tiles";
import {
  PARTIES_TILE_TYPES,
  PARTY_ROLES_FIRST,
  hasPartiesTile,
  isPartyLink,
  partiesAssociatePath,
  partyGroupOrder,
} from "@/lib/documents/sale-parties";

jest.mock("next-intl", () => {
  const t = (key: string, values?: Record<string, unknown>) => (values ? `${key}:${Object.values(values).join("|")}` : key);
  // `rich`: the key, the count, and the <tile> chunk drawn by its function — what the line's button is.
  t.rich = (key: string, values: { count: number; tile: (chunks: string) => unknown }) => [`${key}:${values.count} `, values.tile("Părți")];
  return { useTranslations: () => t };
});
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedNavigate: jest.fn() }),
}));
jest.mock("@/components/tiles/preview-tiles", () => ({ PreviewButton: () => null }));
jest.mock("@/app/documents/_components/ai-reference-linker-dialog", () => ({ AiReferenceLinkerDialog: () => null }));

const person = (over: Record<string, unknown>) => ({
  linkId: "l", id: "p", code: "PPERS1", type: "NATURAL", displayName: "Ion",
  personRoleId: "r", roleName: "Vânzător",
  cotaParte: null, cotaSuprafataMp: null, cotaMod: null, holdsShare: true, associatedAt: "",
  ...over,
});

// Alphabetical, as the route sends them: the buyer first, the notary in between.
const PERSONS = [
  person({ linkId: "l1", id: "b1", displayName: "Ana Cumpărătoarea", roleName: "Cumpărător", cotaParte: 100 }),
  person({ linkId: "l2", id: "n1", displayName: "Ilie Notarul", roleName: "Notar", holdsShare: false }),
  person({ linkId: "l3", id: "s1", displayName: "Ion Vânzătorul", roleName: "Vânzător", cotaParte: 50 }),
  person({ linkId: "l4", id: "s2", type: "JUDICIAL", displayName: "Firma SRL", roleName: "Vânzător", cotaParte: 50 }),
];

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => {
    const json = url.endsWith("/persons") ? { items: PERSONS }
      : url.endsWith("/instrument-references") ? { read: false, items: [], documentTypes: [] }
      : { items: [] };
    return { ok: true, status: 200, json: async () => json };
  }) as unknown as typeof fetch;
});

const wrap = (node: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

describe("who is a party", () => {
  it("a link whose role holds a share on the type — data, not a list of names", () => {
    expect(isPartyLink({ holdsShare: true })).toBe(true);
    expect(isPartyLink({ holdsShare: false })).toBe(false);
  });
  it("a contract de vânzare, an act adițional and a certificat de moștenitor show „Părți”, and nothing else does", () => {
    // #38.34: the act adițional; #39.48: the certificate, by the same rule.
    expect(PARTIES_TILE_TYPES).toEqual(["CONTRACT_VANZARE", "ACT_ADITIONAL", "CERTIFICAT_MOSTENITOR"]);
    expect(hasPartiesTile("CONTRACT_VANZARE")).toBe(true);
    expect(hasPartiesTile("ACT_ADITIONAL")).toBe(true);
    expect(hasPartiesTile("CERTIFICAT_MOSTENITOR")).toBe(true);
    expect(hasPartiesTile("ANTECONTRACT")).toBe(false);
    expect(hasPartiesTile(null)).toBe(false);
  });
  it("„Asociază persoană” on „Părți” opens the certificate's own screen on a certificate, the common one elsewhere", () => {
    expect(partiesAssociatePath("CERTIFICAT_MOSTENITOR", "d 1")).toBe("/documents/d%201/associate-party");
    expect(partiesAssociatePath("CONTRACT_VANZARE", "d1")).toBe("/documents/d1/associate-person");
    expect(partiesAssociatePath("ACT_ADITIONAL", "d1")).toBe("/documents/d1/associate-person");
  });
  it("orders the groups sellers, buyers, then the rest alphabetically, then no role", () => {
    expect(PARTY_ROLES_FIRST).toEqual(["Vânzător", "Cumpărător"]);
    expect(partyGroupOrder(["Moștenitor / Succesor", null, "Cumpărător", "Vânzător", "Cumpărător", "Adjudecatar"])).toEqual([
      "Vânzător", "Cumpărător", "Adjudecatar", "Moștenitor / Succesor", null,
    ]);
  });
});

describe("„Părți”", () => {
  it("lists only the parties, grouped Vânzător then Cumpărător, each with its share", async () => {
    wrap(<DocumentPartiesTile documentId="doc" label="Părți" typeKey="CONTRACT_VANZARE" />);
    const group = await screen.findByRole("group", { name: "Părți" });
    await waitFor(() => expect(within(group).getAllByRole("radio")).toHaveLength(3));
    const headings = Array.from(group.querySelectorAll("[data-party-group-heading]")).map((h) => h.textContent);
    expect(headings).toEqual(["Vânzător", "Cumpărător"]);
    expect(within(group).queryByText("Ilie Notarul")).toBeNull();
    const order = within(group).getAllByRole("radio").map((r) => r.getAttribute("aria-label") ?? (r as HTMLInputElement).name);
    expect(order.join(" · ")).toMatch(/Ion Vânzătorul[\s\S]*Firma SRL[\s\S]*Ana Cumpărătoarea/);
  });

  it("offers „Asociază persoană” only", async () => {
    wrap(<DocumentPartiesTile documentId="doc" label="Părți" typeKey="CONTRACT_VANZARE" />);
    await screen.findByRole("group", { name: "Părți" });
    expect(screen.getByRole("button", { name: "associatePerson" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "associateProperty" })).toBeNull();
  });

  it("on a certificate, „Asociază persoană” opens „Adaugă parte la certificat”", async () => {
    mockPush.mockClear();
    wrap(<DocumentPartiesTile documentId="doc" label="Părți" typeKey="CERTIFICAT_MOSTENITOR" />);
    await screen.findByRole("group", { name: "Părți" });
    screen.getByRole("button", { name: "associatePerson" }).click();
    expect(mockPush).toHaveBeenCalledWith("/documents/doc/associate-party");
  });
});

describe("„Legături” beside it", () => {
  it("keeps the links that are not parties — the notary — and none of the parties (Ask first 1)", async () => {
    wrap(<DocumentRelatedTile documentId="doc" label="Legături" personScope="notParties" />);
    const group = await screen.findByRole("group", { name: "Legături" });
    await waitFor(() => expect(within(group).getByText("Ilie Notarul")).toBeTruthy());
    for (const name of ["Ion Vânzătorul", "Firma SRL", "Ana Cumpărătoarea"]) expect(within(group).queryByText(name)).toBeNull();
  });

  it("says in one line where the parties are and how many, and its „Părți” brings that tile into view (#39.48)", async () => {
    const tile = document.createElement("div");
    tile.setAttribute("data-tile", PARTIES_TILE);
    Object.defineProperty(tile, "offsetParent", { get: () => document.body }); // jsdom lays nothing out
    const scrolled = jest.fn();
    tile.scrollIntoView = scrolled;
    document.body.appendChild(tile);
    try {
      wrap(<DocumentRelatedTile documentId="doc" label="Legături" personScope="notParties" />);
      const line = await waitFor(() => {
        const el = document.querySelector("[data-parties-elsewhere]");
        if (!el) throw new Error("no line yet");
        return el as HTMLElement;
      });
      await waitFor(() => expect(line.getAttribute("data-parties-elsewhere")).toBe("3"));
      expect(line.textContent).toContain("elsewhere:3");
      within(line).getByRole("button", { name: "Părți" }).click();
      expect(scrolled).toHaveBeenCalled();
    } finally {
      tile.remove();
    }
  });

  it("draws no such line when it shows every person", async () => {
    wrap(<DocumentRelatedTile documentId="doc" label="Legături" />);
    await screen.findByRole("group", { name: "Legături" });
    expect(document.querySelector("[data-parties-elsewhere]")).toBeNull();
  });

  it("is told to on a contract de vânzare, and only while „Părți\" is shown", () => {
    // Unticked, „Părți" draws nothing, so the parties come back to „Legături" rather than vanish.
    const src = fs.readFileSync(path.join(process.cwd(), "src", "app", "documents", "_components", "document-detail-tiles.tsx"), "utf8");
    expect(src).toContain('personScope={layout.parties && choice.isShown("parties") ? "notParties" : "all"}');
    const form = fs.readFileSync(path.join(process.cwd(), "src", "app", "documents", "_components", "document-form.tsx"), "utf8");
    expect(form).toContain('parties: mode !== "create" && !!documentId && hasPartiesTile(selectedTypeKey)');
  });
});

describe("the tile", () => {
  it("stands after the type tiles and is ticked by default, on a saved contract only", () => {
    const reg = documentTileRegistry({ typeKey: "CONTRACT_VANZARE", tabs: ["A", "B"], pages: true, parties: true });
    expect(reg.all.slice(0, 4)).toEqual(["general", "tab:A", "tab:B", PARTIES_TILE]);
    expect(reg.defaults).toContain(PARTIES_TILE);
    expect(reg.groups?.record).toContain(PARTIES_TILE);
    expect(documentTileRegistry({ typeKey: "CONTRACT_VANZARE", tabs: ["A"], pages: false }).all).not.toContain(PARTIES_TILE);
  });
});
