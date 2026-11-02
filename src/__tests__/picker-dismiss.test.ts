/**
 * Slice 41.39 — Adrian: „once I click on the groups dropdown the tile freezes: if I click out of the drop The drop down
 * doesn't come back to closed, it stays open; Also I cannot resize the tile".
 *
 * The group and stamp pickers close on a press outside their section and on Esc (the focus back on the „+"), and their
 * options are cut so a 500-character description can never widen the tile.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { renderHook } from "@testing-library/react";
import { PICKER_DESCRIPTION_CHARS, pickerOptionText, usePickerDismiss } from "@/lib/ui/picker-dismiss";

const META = readFileSync(join(process.cwd(), "src/components/entity-metadata-tab.tsx"), "utf8");

describe("41.39 — the pickers close", () => {
  function setup(open = true) {
    document.body.innerHTML = '<section id="s"><button id="plus">+</button><select id="box"></select></section><input id="out">';
    const scope = { current: document.getElementById("s") };
    const close = jest.fn();
    const focusBack = () => document.getElementById("plus");
    const hook = renderHook(({ o }) => usePickerDismiss(o, close, scope, focusBack), { initialProps: { o: open } });
    return { close, hook };
  }

  it("a press outside closes it; a press inside (the box, the „+”) does not", () => {
    const { close } = setup();
    document.getElementById("box")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    document.getElementById("plus")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(close).not.toHaveBeenCalled();
    document.getElementById("out")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("Esc closes it and puts the focus back on its „+”", () => {
    const { close } = setup();
    document.getElementById("box")!.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.id).toBe("plus");
  });

  it("closed, it listens to nothing", () => {
    const { close } = setup(false);
    document.getElementById("out")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(close).not.toHaveBeenCalled();
  });
});

describe("41.39 — no picker can widen the tile", () => {
  it("an option is the code and the description cut to about 60 characters, „…” where cut", () => {
    expect(pickerOptionText("AB", "Scurtă")).toBe("AB — Scurtă");
    expect(pickerOptionText("AB", null)).toBe("AB");
    const long = "cuvânt ".repeat(80).trim();
    const text = pickerOptionText("AB", long);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThanOrEqual("AB — ".length + PICKER_DESCRIPTION_CHARS + 1);
  });

  it("both selects take what is left of their row, and each option carries the whole description as its title", () => {
    for (const mark of ["data-groups-picker", "data-stamps-picker"]) {
      const at = META.indexOf(`${mark}=""`);
      expect(at).toBeGreaterThan(0);
      expect(META.slice(META.lastIndexOf("<select", at), at)).toContain('className="min-w-0 flex-1 rounded border');
    }
    expect(META).toContain("{pickerOptionText(g.code, g.description)}");
    expect(META).toContain("{pickerOptionText(s.code, s.shortDescription)}");
    expect(META).toContain("title={g.description ?? undefined}");
    expect(META.match(/usePickerDismiss\(showAdd, closePicker, sectionRef, pickerToggle\)/g) ?? []).toHaveLength(2);
  });
});
