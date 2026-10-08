/**
 * Slice #37.64 — the Document's „Persoane", „Proprietăți" and „Acte corelate":
 * one line a row, the rest behind buttons. Since #37.65 they are one tile,
 * „Corelate", and these rows are its rows: the same assertions, read through it
 * (`related-tile.test.tsx` holds #37.65's own).
 *
 * The real tile over a real `QueryClient`, with only the edges mocked (the
 * router, the translations, the unsaved-changes guard, the preview opener and
 * the AI linker dialog). `useTranslations` returns the key — with its values
 * after a colon, so the share bubble's three values can be read.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { join } from "node:path";

import { DocumentRelatedTile } from "@/app/documents/_components/document-related-tile";
import { ROW_SLOT_REM } from "@/lib/ui/field-widths";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
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
  cotaParte: null, cotaSuprafataMp: null, cotaMod: null, holdsShare: true, associatedAt: "2026-10-03",
  ...over,
});

const PERSONS = [
  person({ linkId: "l1", displayName: "Ion Vânzătorul", roleName: "Vânzător" }),
  person({ linkId: "l2", displayName: "Maria Proiectant", roleName: "Proiectant / Consultant", holdsShare: false }),
  person({ linkId: "l3", displayName: "Ana Păstrată", roleName: "Proiectant / Consultant", holdsShare: false, cotaParte: 50 }),
  person({ linkId: "l4", displayName: "Fără Rol", personRoleId: null, roleName: null, holdsShare: false }),
];

const REFERENCES = [
  { id: "d1", code: "DOC1", typeName: "Contract de Vânzare", title: "CVC 2016", associatedAt: "", relationshipRoleId: "x", relationshipRoleName: "Titlu anterior al", roleReadsFromViewed: true },
  { id: "d2", code: "DOC2", typeName: "Carte funciară", title: null, associatedAt: "", relationshipRoleId: null, relationshipRoleName: null, roleReadsFromViewed: false },
];

let calls: { url: string; method: string; body?: string }[] = [];

beforeEach(() => {
  calls = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
    const json = url.endsWith("/persons") ? { items: PERSONS }
      : url.endsWith("/properties") ? { items: [{ id: "pr1", code: "PROP1", label: "Livada de la deal", associatedAt: "" }] }
      : url.endsWith("/references") ? { items: REFERENCES }
      : url.endsWith("/instrument-references") ? { read: true, items: [{ instrument: { status: "PENDING" } }, { instrument: { status: "PENDING" } }], documentTypes: [] }
      : {};
    return { ok: true, status: 200, json: async () => json };
  }) as unknown as typeof fetch;
});

function renderTile(tile: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{tile}</QueryClientProvider>);
}

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByRole("radio", { name: new RegExp(`^${name}`) }).closest("li");
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

describe("one line a row", () => {
  it("„Persoane”: „Nume (Rol)” on one line, cut with „…” and whole on hover, no heading row", async () => {
    renderTile(<DocumentRelatedTile documentId="doc" label="Corelate" />);
    await screen.findByRole("group", { name: "Corelate" });
    expect(screen.queryByRole("columnheader")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    const row = rowOf("Maria Proiectant");
    expect(row.className).toContain("whitespace-nowrap");
    const content = row.querySelector("[data-row-content]") as HTMLElement;
    expect(content.textContent).toBe("Maria Proiectant (Proiectant / Consultant)");
    expect(content).toHaveAttribute("title", "Maria Proiectant (Proiectant / Consultant)");
    expect(content.className).toContain("truncate");
    // A link with no role reads as the name alone.
    expect((rowOf("Fără Rol").querySelector("[data-row-content]") as HTMLElement).textContent).toBe("Fără Rol");
  });

  it("every row has the same slots, in the same places — a missing button leaves its slot empty", async () => {
    renderTile(<DocumentRelatedTile documentId="doc" label="Corelate" />);
    await screen.findByRole("group", { name: "Corelate" });
    for (const li of screen.getAllByRole("listitem")) {
      const slots = [...li.querySelectorAll<HTMLElement>("[data-slot]")];
      // #37.65: one slot set for the whole tile, whatever the row's kind.
      expect(slots.map((s) => s.dataset.slot)).toEqual(["share", "relation", "view", "preview"]);
      expect(slots[0].style.width).toBe(`${ROW_SLOT_REM.share}rem`);
    }
    expect(rowOf("Maria Proiectant").querySelector('[data-slot="share"]')?.childElementCount).toBe(0);
  });
});

describe("„Cotă”, the orange share button", () => {
  it("only where shareCells is not „none”: solid while empty, an outline once a value is stored", async () => {
    renderTile(<DocumentRelatedTile documentId="doc" label="Corelate" />);
    await screen.findByRole("group", { name: "Corelate" });
    const share = (name: string) => within(rowOf(name)).queryByRole("button", { name: "share" });
    expect(share("Maria Proiectant")).toBeNull();
    expect(rowOf("Maria Proiectant")).toHaveAttribute("data-share", "none");
    expect(share("Ion Vânzătorul")?.className).toContain("bg-orange-700");
    expect(share("Fără Rol")?.className).toContain("bg-orange-700");
    // A stored value on a role that holds none: the button stays, as an outline, the boxes read-only.
    expect(share("Ana Păstrată")?.className).toContain("bg-orange-50");
    // The three values are in its bubble — the box's own words for an empty one.
    const summary = document.getElementById(share("Ion Vânzătorul")?.getAttribute("aria-describedby") ?? "");
    expect(summary?.textContent).toBe("shareSummary:cotaPlaceholder|cotaMpPlaceholder|cotaModPlaceholder");
  });

  it("opens the three boxes beside the row; a value typed there is saved when Esc closes it", async () => {
    renderTile(<DocumentRelatedTile documentId="doc" label="Corelate" />);
    await screen.findByRole("group", { name: "Corelate" });
    const button = within(rowOf("Ion Vânzătorul")).getByRole("button", { name: "share" });
    fireEvent.click(button);
    const panel = screen.getByRole("group", { name: /^shareTitle — Ion Vânzătorul/ });
    expect(button).toHaveAttribute("aria-expanded", "true");
    const parte = within(panel).getByRole("textbox", { name: /^colCota — Ion Vânzătorul/ });
    expect(parte).toHaveFocus();
    expect(within(panel).getAllByRole("textbox")).toHaveLength(2);
    expect(within(panel).getAllByRole("combobox")).toHaveLength(1);
    fireEvent.change(parte, { target: { value: "50" } });
    fireEvent.keyDown(parte, { key: "Escape" });
    expect(screen.queryByRole("group", { name: /^shareTitle/ })).toBeNull();
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.url).toContain("linkId=l1");
    expect(JSON.parse(patch?.body ?? "{}").cotaParte).toBe(50);
  });

  it("a press outside closes it and saves what was typed, as leaving the box did", async () => {
    renderTile(<DocumentRelatedTile documentId="doc" label="Corelate" />);
    await screen.findByRole("group", { name: "Corelate" });
    fireEvent.click(within(rowOf("Fără Rol")).getByRole("button", { name: "share" }));
    const mp = screen.getByRole("textbox", { name: /^colCotaMp — Fără Rol/ });
    act(() => mp.focus());
    fireEvent.change(mp, { target: { value: "120" } });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("group", { name: /^shareTitle/ })).toBeNull();
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patches = calls.filter((c) => c.method === "PATCH");
    // One write: the box left untouched (the panel focused it first) writes nothing.
    expect(patches).toHaveLength(1);
    expect(JSON.parse(patches[0].body ?? "{}").cotaSuprafataMp).toBe(120);
  });

  it("a read-only share shows its boxes disabled, with #37.59's hint", async () => {
    renderTile(<DocumentRelatedTile documentId="doc" label="Corelate" />);
    await screen.findByRole("group", { name: "Corelate" });
    fireEvent.click(within(rowOf("Ana Păstrată")).getByRole("button", { name: "share" }));
    const panel = screen.getByRole("group", { name: /^shareTitle — Ana Păstrată/ });
    for (const box of [...within(panel).getAllByRole("textbox"), within(panel).getByRole("combobox")]) expect(box).toBeDisabled();
    expect(panel).toHaveTextContent("shareNotHeld");
  });
});

describe("„Acte corelate”", () => {
  it("„Etichetă scurtă (Tip)”, the type alone without a title; the relationship a button only with a role", async () => {
    renderTile(<DocumentRelatedTile documentId="doc" label="Corelate" />);
    await screen.findByRole("group", { name: "Corelate" });
    const rows = within(screen.getByRole("list", { name: "group.document" })).getAllByRole("listitem");
    expect(rows.map((r) => r.querySelector("[data-row-content]")?.textContent)).toEqual(["CVC 2016 (Contract de Vânzare)", "Carte funciară"]);
    expect(within(rows[1]).queryByRole("button", { name: "relationship" })).toBeNull();
    const rel = within(rows[0]).getByRole("button", { name: "relationship" });
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(rel);
    // The sentence #36.03 resolved, in the direction the flag gives.
    expect(screen.getByRole("status")).toHaveTextContent("roleForward:Titlu anterior al|CVC 2016");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(rel);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("„Înscrisuri citate” is one button that unfolds today's panel and folds it again, its badge the number waiting", async () => {
    renderTile(<DocumentRelatedTile documentId="doc" label="Corelate" />);
    await screen.findByRole("group", { name: "Corelate" });
    const button = screen.getByRole("button", { name: /instrumentsButton/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector("[data-instruments-panel]")).toBeNull();
    await waitFor(() => expect(button.querySelector("[data-icon-badge]")?.textContent).toBe("2"));
    fireEvent.click(button);
    expect(document.querySelector("[data-instruments-panel]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "openLinker" })).toBeInTheDocument();
    fireEvent.click(button);
    expect(document.querySelector("[data-instruments-panel]")).toBeNull();
  });
});

describe("„Proprietăți”", () => {
  it("a property's name on one line, the view and preview slots after it", async () => {
    renderTile(<DocumentRelatedTile documentId="doc" label="Corelate" />);
    await screen.findByRole("group", { name: "Corelate" });
    const row = within(screen.getByRole("list", { name: "group.property" })).getByRole("listitem");
    expect(row.querySelector("[data-row-content]")).toHaveAttribute("title", "Livada de la deal");
    // The two buttons it has, in their slots; the share and relationship slots empty.
    const slots = [...row.querySelectorAll<HTMLElement>("[data-slot]")];
    expect(slots.map((s) => [s.dataset.slot, s.childElementCount > 0])).toEqual([["share", false], ["relation", false], ["view", true], ["preview", false]]);
  });
});

describe("the three lists draw one-line rows for „Corelate”", () => {
  it("each is a hook giving RelatedTile its rows, with no table and no `compact` left", () => {
    for (const f of ["document-persons-tab.tsx", "document-properties-tab.tsx", "document-references-tab.tsx"]) {
      const src = readFileSync(join(__dirname, "..", "app", "documents", "_components", f), "utf8");
      expect([f, src.includes("const rows: RelatedRow[] = (items ?? []).map(")]).toEqual([f, true]);
      expect([f, /<table|<thead|\bcompact\b/.test(src)]).toEqual([f, false]);
    }
  });
});
