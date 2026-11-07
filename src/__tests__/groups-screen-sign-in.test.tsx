/**
 * Slice 41.98 — Administrare → Grupuri: „Ce este un Grup?" open once per sign-in and across the row; the wizard 3 units and
 * the list at 75 % of its old units; calm rows; „Toate sus" / „Toate la stânga"; and a choice pressed in the wizard on
 * the note box for `workflow_choice_highlight`.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";

import { markSignIn, signInStamp, SIGN_IN_STAMP_KEY } from "@/lib/auth/sign-in-stamp";
import { shownForKey, takeOncePerSignIn } from "@/components/tiles/once-per-sign-in";
import { GroupWorkflowsWizard, HIGHLIGHT_ON } from "@/components/screen/group-workflows-wizard";
import { forgetWorkflowHighlight, usableHighlight, WORKFLOW_HIGHLIGHT_MS } from "@/components/screen/workflow-highlight";
import { ADMIN_GROUPS_LIST_UNITS, ADMIN_GROUPS_SCREEN, ADMIN_GROUPS_WIZARD_UNITS } from "@/lib/ui/screen-tiles";
import { tableUnits } from "@/lib/ui/field-widths";
import { TIME_FRAME_DEFAULTS } from "@/lib/time-frames/config";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

beforeEach(() => {
  localStorage.clear();
});

describe("„Ce este un Grup?” once per sign-in (Ask first 1)", () => {
  it("the first opening in a sign-in takes it; the next openings in that sign-in do not; a new sign-in takes it again", () => {
    expect(signInStamp()).toBe("none");
    expect(takeOncePerSignIn("admin-groups", "about")).toBe(true);
    expect(takeOncePerSignIn("admin-groups", "about")).toBe(false);
    expect(localStorage.getItem(shownForKey("admin-groups", "about"))).toBe("none");
    markSignIn(1234);
    expect(localStorage.getItem(SIGN_IN_STAMP_KEY)).toBe("1234");
    expect(takeOncePerSignIn("admin-groups", "about")).toBe(true);
    expect(takeOncePerSignIn("admin-groups", "about")).toBe(false);
    // Each screen its own.
    expect(takeOncePerSignIn("admin-stamps", "about")).toBe(true);
  });

  it("the login form stamps a sign-in; Grupuri reveals the tile for the visit through it", () => {
    expect(read("src", "app", "login", "login-form.tsx")).toMatch(/clearSessionCache\(queryClient\);\s*\/\/[^\n]*\n\s*markSignIn\(\);/);
    const view = read("src", "app", "admin", "groups", "_components", "groups-list-view.tsx");
    expect(view).toContain('useOncePerSignIn(ADMIN_GROUPS_REGISTRY.entity, "about", tiles.choice.reveal);');
    // „Am înțeles" is still the toggle: for this sign-in, no longer for good.
    expect(view).toContain('<GroupAboutTile onUnderstood={() => tiles.choice.toggle("about")} />');
  });
});

describe("the widths, the row and „Panouri” (Ask first 2, 3)", () => {
  it("the wizard 3 units; the list 75 % of its old units, rounded down; the about tile a line of its own", () => {
    const before = tableUnits(["groupCode", "description", "rowActions"]);
    expect(before).toBe(6);
    expect(ADMIN_GROUPS_LIST_UNITS).toBe(Math.floor(0.75 * before));
    expect(ADMIN_GROUPS_WIZARD_UNITS).toBe(3);
    expect(ADMIN_GROUPS_SCREEN.flowUnits).toBe(ADMIN_GROUPS_WIZARD_UNITS + ADMIN_GROUPS_LIST_UNITS);
    const about = read("src", "app", "admin", "groups", "_components", "group-about-tile.tsx");
    expect(about).toMatch(/className="basis-full /);
    expect(about).not.toContain("screenPanel(");
    expect(read("src", "app", "admin", "groups", "_components", "groups-list-view.tsx")).toContain(
      '<WorkflowsTile kind="group" units={ADMIN_GROUPS_WIZARD_UNITS}',
    );
  });

  it("„Toate sus” and „Toate la stânga” on Grupuri, a group, Ștampile and a stamp", () => {
    expect(read("src", "components", "screen", "admin-tiles.tsx")).toContain("allUp={allUp} />");
    for (const f of [
      ["groups", "groups-list-view.tsx"], ["groups", "group-editor.tsx"], ["stamps", "stamps-list-view.tsx"], ["stamps", "stamp-applicator.tsx"],
    ]) expect(read("src", "app", "admin", f[0], "_components", f[1])).toMatch(/<AdminTilesBar[\s\S]*?\ballUp\b[\s\S]*?\/>/);
  });

  it("the list's rows are calm (quiet-row.ts)", () => {
    const view = read("src", "app", "admin", "groups", "_components", "groups-list-view.tsx");
    expect(view).toContain("<tr key={g.id} className={`${QUIET_ROW} ");
    expect(view).toContain("${QUIET_ROW_BUTTONS}`} data-row-buttons={QUIET_ROW_MARK}");
  });
});

describe("a choice on the note box (Ask first 5)", () => {
  afterEach(() => {
    jest.useRealTimers();
    forgetWorkflowHighlight();
  });

  it("the setting: 3 s by default; a saved value 0 – 10 s, anything else the default", () => {
    expect(TIME_FRAME_DEFAULTS.workflow_choice_highlight).toEqual({ value: 3000, unit: "milliseconds" });
    expect(WORKFLOW_HIGHLIGHT_MS).toBe(3000);
    expect([usableHighlight(0), usableHighlight(10_000), usableHighlight(10_001), usableHighlight("x"), usableHighlight(1.5)]).toEqual([0, 10_000, 3000, 3000, 3000]);
  });

  it("pressing a choice lights the item and its steps from the same moment, for the setting's time; another restarts it", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ items: [{ key: "workflow_choice_highlight", value: 2000 }] }) })) as unknown as typeof fetch;
    render(<GroupWorkflowsWizard units={3} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.querySelectorAll("[data-wizard-lit]")).toHaveLength(0);
    const create = document.querySelector<HTMLElement>('[data-wizard-choice="create"]')!;
    fireEvent.click(create.querySelector("input")!);
    expect(create.hasAttribute("data-wizard-lit")).toBe(true);
    expect(screen.getByRole("list").hasAttribute("data-wizard-lit")).toBe(true);
    for (const c of HIGHLIGHT_ON.split(" ")) expect(create.classList).toContain(c);
    act(() => { jest.advanceTimersByTime(1500); });
    const del = document.querySelector<HTMLElement>('[data-wizard-choice="delete"]')!;
    fireEvent.click(del.querySelector("input")!);
    expect(create.hasAttribute("data-wizard-lit")).toBe(false);
    expect(del.hasAttribute("data-wizard-lit")).toBe(true);
    act(() => { jest.advanceTimersByTime(1500); });
    expect(del.hasAttribute("data-wizard-lit")).toBe(true); // restarted: 1,5 s of 2 s
    act(() => { jest.advanceTimersByTime(600); });
    expect(document.querySelectorAll("[data-wizard-lit]")).toHaveLength(0);
    // The padding and border are always there, transparent at rest: nothing moves.
    expect(del.className).toMatch(/border-transparent/);
    localStorage.removeItem("ga40-group-wizard-v1");
  });
});
