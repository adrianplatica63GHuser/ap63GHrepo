/**
 * Slice #39.05 — a person's „Interacțiuni" tile: the history (B) and the action panel (C) under it.
 *
 * C is the module's own `LogTile`, stubbed here (its form is covered by the interactions suites): what this file
 * holds is when C is drawn, collapsed or expanded, what it is given, and how B's „+" and rows reach it. The
 * browser half is TC-INT-06.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let search = new URLSearchParams();
const guardedAction = jest.fn((fn: () => void) => fn());

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "ro",
}));
jest.mock("next/navigation", () => ({ useSearchParams: () => search }));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedNavigate: jest.fn(), guardedAction }),
}));
jest.mock("@/components/toast", () => ({ useToast: () => ({ toast: null, show: jest.fn() }) }));
jest.mock("@/app/interactions/_components/log-tile", () => ({
  LogTile: (p: { scope: string; scopeName: string; selectedId: string | null; personFixed?: boolean; onModeNew: () => void }) => (
    <section data-log-stub="" data-scope={p.scope} data-scope-name={p.scopeName} data-selected={p.selectedId ?? ""} data-fixed={String(!!p.personFixed)} />
  ),
}));

import { PersonInteractionsTile } from "@/app/_components/person-interactions-tile";
import { InteractionsTile } from "@/components/tiles/interactions-tile";
import { LOG_PARAM, personBase, personLogHref, readLog } from "@/lib/interactions/links";

const ROWS = [
  { id: "i2", channel: "MEETING", direction: "OUTBOUND", occurredAt: "2026-10-10T09:00:00Z", personId: "p1", personName: "X", personType: "NATURAL", subject: "Întâlnire", status: "LOGGED", followUpOn: null, documentCount: 0, updatedAt: "2026-10-10T09:00:00Z" },
  { id: "i1", channel: "EMAIL", direction: "INBOUND", occurredAt: "2026-10-08T09:00:00Z", personId: "p1", personName: "X", personType: "NATURAL", subject: "Ofertă", status: "LOGGED", followUpOn: null, documentCount: 0, updatedAt: "2026-10-08T09:00:00Z" },
];

beforeEach(() => {
  search = new URLSearchParams();
  guardedAction.mockClear();
  global.fetch = jest.fn(async () => ({ ok: true, redirected: false, json: async () => ({ items: ROWS, total: 2 }) })) as unknown as typeof fetch;
});

function renderTile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PersonInteractionsTile personId="p1" personName="Ana Pop" title="Interacțiuni" surface="s" />
    </QueryClientProvider>,
  );
}
const stub = () => document.querySelector<HTMLElement>("[data-log-stub]");
const panel = () => document.querySelector<HTMLElement>("[data-person-log]")!;
const row = (id: string) => document.querySelector<HTMLElement>(`[data-person-interaction="${id}"]`)!;

describe("the address and C (#39.05)", () => {
  it("helpers: the person's screen by type, ?log=new or ?log=<id>; nothing asked → collapsed", () => {
    expect(LOG_PARAM).toBe("log");
    expect(personBase("JUDICIAL")).toBe("/judicial-persons");
    expect(personBase("NATURAL")).toBe("/natural-persons");
    expect(personLogHref("/natural-persons", "p1")).toBe("/natural-persons/p1?log=new");
    expect(personLogHref("/judicial-persons", "c1", "i9")).toBe("/judicial-persons/c1?log=i9");
    expect(readLog(null)).toEqual({ expanded: false, select: null });
    expect(readLog("new")).toEqual({ expanded: true, select: null });
    expect(readLog("i9")).toEqual({ expanded: true, select: "i9" });
  });

  it("without the parameter C is collapsed to one large button, „Înregistrează o interacțiune”", () => {
    renderTile();
    expect(panel()).toHaveAttribute("data-person-log", "collapsed");
    expect(stub()).toBeNull();
    expect(document.querySelector("[data-log-expand]")).toHaveTextContent("screen.logTitle");
    // The spec's indigo is the app's „accent" variant (#38.85); stretched by its flex column.
    const src = readFileSync(join(process.cwd(), "src", "app", "_components", "person-interactions-tile.tsx"), "utf8");
    expect(src).toMatch(/label=\{t\("screen\.logTitle"\)\}\s+showLabel\s+variant="accent"\s+size="lg"/);
    expect(document.querySelector("[data-person-log]")!.className).toContain("flex-col");
  });

  it("?log=new opens C expanded on a new record; ?log=<id> on that row, which reads selected in B", async () => {
    search = new URLSearchParams({ log: "new" });
    const a = renderTile();
    expect(panel()).toHaveAttribute("data-person-log", "expanded");
    expect(stub()).toHaveAttribute("data-selected", "");
    a.unmount();
    search = new URLSearchParams({ log: "i2" });
    renderTile();
    expect(stub()).toHaveAttribute("data-selected", "i2");
    await waitFor(() => expect(row("i2")).toHaveAttribute("aria-selected", "true"));
    expect(row("i1")).toHaveAttribute("aria-selected", "false");
  });

  it("C is the module's LogTile, the person fixed and its picker hidden", () => {
    search = new URLSearchParams({ log: "new" });
    renderTile();
    expect(stub()).toHaveAttribute("data-scope", "p1");
    expect(stub()).toHaveAttribute("data-scope-name", "Ana Pop");
    expect(stub()).toHaveAttribute("data-fixed", "true");
  });

  it("the large button expands C in place on a new record; „Restrânge” collapses it through the guard", async () => {
    renderTile();
    await act(async () => fireEvent.click(document.querySelector("[data-log-expand]")!));
    expect(stub()).toHaveAttribute("data-selected", "");
    await act(async () => fireEvent.click(document.querySelector("[data-log-collapse]")!));
    expect(guardedAction).toHaveBeenCalledTimes(1);
    expect(stub()).toBeNull();
  });
});

describe("B reaches C (#39.05)", () => {
  it("„Interacțiune nouă” expands C on a new record, in place", async () => {
    renderTile();
    await act(async () => fireEvent.click(document.querySelector("[data-interactions-new]")!));
    expect(panel()).toHaveAttribute("data-person-log", "expanded");
    expect(stub()).toHaveAttribute("data-selected", "");
  });

  it("a row chooses itself into C, expanding it", async () => {
    renderTile();
    await waitFor(() => expect(row("i1")).not.toBeNull());
    await act(async () => fireEvent.click(row("i1")));
    expect(stub()).toHaveAttribute("data-selected", "i1");
    expect(row("i1")).toHaveAttribute("aria-selected", "true");
  });

  it("B keeps its height, C under it, the tile 40 rem wide", () => {
    renderTile();
    const tile = document.querySelector<HTMLElement>('[data-tile="interactions"]')!;
    expect(tile.style.width).toBe("40rem");
    expect(tile.style.height).toBe("");
    expect(tile.querySelector<HTMLElement>("[data-interactions-history]")!.style.height).toBe("410px");
    expect(tile.lastElementChild).toBe(panel());
  });
});

describe("the Incursiune shows B only (#39.05)", () => {
  // #39.25: `fill` became `peek` — the Incursiune's title line replaces the tile's own, and „Deschide în
  // „Interacțiuni”" (`[data-interactions-open]`) is not drawn (Adrian: „if an Open button was already on the tile,
  // remove it").
  it("no „Interacțiune nouă” without onNew, no C, and in an Incursiune no „Deschide în „Interacțiuni”” (#39.25)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <InteractionsTile personId="p1" title="Interacțiuni" surface="s" peek={{ head: <div data-peek-head="" />, style: { maxHeight: 436 } }} onRow={() => {}} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(row("i2")).not.toBeNull());
    expect(document.querySelector("[data-interactions-new]")).toBeNull();
    expect(document.querySelector("[data-person-log]")).toBeNull();
    expect(document.querySelector("[data-interactions-open]")).toBeNull();
    expect(document.querySelector("[data-peek-head]")).not.toBeNull();
    const tile = document.querySelector<HTMLElement>('[data-tile="interactions"]')!;
    expect(tile.style.maxHeight).toBe("436px");
    expect(tile.className).toContain("has-[[data-person-interaction]]:min-h-0");
  });

  it("on a person's screen „Deschide în „Interacțiuni”” stays (#39.25 is the Incursiune's alone)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <InteractionsTile personId="p1" title="Interacțiuni" surface="s" onRow={() => {}} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(row("i2")).not.toBeNull());
    expect(document.querySelector("[data-interactions-open]")).not.toBeNull();
  });

  it("its rows open the person's screen with C expanded on the row (Ask first 4)", () => {
    const tile = readFileSync(join(process.cwd(), "src", "app", "_components", "incursion-tile.tsx"), "utf8");
    expect(tile).toContain('onRow={(id) => guardedNavigate(personLogHref(target.kind === "company" ? "/judicial-persons" : "/natural-persons", target.id, id))}');
    expect(tile).not.toMatch(/<InteractionsTile[\s\S]*?onNew=/);
    expect(tile).not.toContain("PersonInteractionsTile");
  });

  it("both person screens draw B and C through the composite", () => {
    for (const dir of ["natural-persons", "judicial-persons"]) {
      const src = readFileSync(join(process.cwd(), "src", "app", dir, "_components", "person-detail-tiles.tsx"), "utf8");
      expect([dir, src.includes("<PersonInteractionsTile personId={personId} personName={personName}")]).toEqual([dir, true]);
      expect([dir, src.includes("<InteractionsTile ")]).toEqual([dir, false]);
    }
  });
});
