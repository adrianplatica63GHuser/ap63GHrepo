/**
 * „Arată mai mult…” — every „Note…” box and the MRZ fold at five lines.
 *                                                               (Slice #37.40)
 *
 * jsdom has no layout, so the fold is checked against a stubbed height: the
 * box's `scrollHeight` (its full content, as a capped box still reports it)
 * and a computed style of 20 px lines, 4 px padding top and bottom and a 1 px
 * border. Then the guard: every notes width entry and the MRZ fold, and every
 * place that draws a „Note…” box draws it through GrowingText with the fold on.
 */
import fs from "fs";
import path from "path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

const RO = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "ro-RO.json"), "utf8")) as {
  shared: { fold: Record<string, string> };
};
jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) =>
    ns === "shared.fold" ? RO.shared.fold[key] : `${ns}.${key}`,
}));

import { GrowingText } from "@/components/forms/growing-text";
import { renderedLines } from "@/components/forms/growing-text-rules";
import * as WIDTHS from "@/lib/ui/field-widths";
import {
  ADDRESS,
  DOCUMENT,
  JUDICIAL_PERSON,
  NATURAL_PERSON,
  NOTE_FOLD_LINES,
  PROPERTY,
  SCREEN,
  type FieldWidth,
} from "@/lib/ui/field-widths";

const LINE = 20;
const PAD = 8; // 4 px top and bottom
let contentLines = 1;

beforeAll(() => {
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => contentLines * LINE + PAD,
  });
  const real = window.getComputedStyle;
  jest.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
    const cs = real(el);
    if (!(el instanceof HTMLTextAreaElement)) return cs;
    const stub: Record<string, string> = {
      lineHeight: `${LINE}px`,
      paddingTop: "4px",
      paddingBottom: "4px",
      borderTopWidth: "1px",
      borderBottomWidth: "1px",
    };
    // A proxy, not a spread: the accessible-name code calls its methods.
    return new Proxy(cs, {
      get(target, prop) {
        if (typeof prop === "string" && prop in stub) return stub[prop];
        const v = Reflect.get(target, prop) as unknown;
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    });
  });
});

function Box({ initial = "x", label = "Note" }: { initial?: string; label?: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <label>
        <span>{label}</span>
        <GrowingText value={v} onValueChange={setV} width="20rem" lines fold={NOTE_FOLD_LINES} />
      </label>
      <button type="button" onClick={() => setV("a value written from outside")}>
        reset
      </button>
    </>
  );
}

const box = () => document.querySelector("textarea") as HTMLTextAreaElement;

/** Render, then let the fold's measuring microtask run. */
async function mount(ui: React.ReactElement): Promise<void> {
  await act(async () => {
    render(ui);
  });
}

/** Fire an event, then let the fold's measuring microtask run. */
async function settle(fn: () => void): Promise<void> {
  await act(async () => {
    fn();
  });
}
const more = RO.shared.fold.showMore;
const less = RO.shared.fold.showLess;

describe("renderedLines", () => {
  it("counts the content's rendered lines from its height", async () => {
    expect(renderedLines(8 * LINE + PAD, PAD, LINE)).toBe(8);
    expect(renderedLines(5 * LINE + PAD, PAD, LINE)).toBe(5);
    expect(renderedLines(0, PAD, LINE)).toBe(0);
    expect(renderedLines(100, PAD, 0)).toBe(0);
  });
});

describe("the fold", () => {
  it("shows no link at five lines, and the box is not capped", async () => {
    contentLines = 5;
    await mount(<Box />);
    expect(screen.queryByRole("button", { name: more })).toBeNull();
    expect(box().dataset.folded).toBe("false");
    expect(box().style.maxHeight).toBe("");
  });

  it("folds above five lines — one long wrapped paragraph as much as five line breaks", async () => {
    contentLines = 9;
    await mount(<Box initial={"un paragraf lung ".repeat(40)} />);
    const link = screen.getByRole("button", { name: more });
    expect(link).toHaveAttribute("aria-expanded", "false");
    expect(link).toHaveAttribute("aria-controls", box().id);
    expect(box().dataset.folded).toBe("true");
    // Five lines, its padding and its border: 5 × 20 + 8 + 2.
    expect(box().style.maxHeight).toBe(`${5 * LINE + PAD + 2}px`);
  });

  it("„Arată mai mult…” shows everything and becomes „Arată mai puțin…”, which folds it back", async () => {
    contentLines = 7;
    await mount(<Box />);
    await settle(() => fireEvent.click(screen.getByRole("button", { name: more })));
    const back = screen.getByRole("button", { name: less });
    expect(back).toHaveAttribute("aria-expanded", "true");
    expect(box().dataset.folded).toBe("false");
    expect(box().style.maxHeight).toBe("");
    await settle(() => fireEvent.click(back));
    expect(screen.getByRole("button", { name: more })).toHaveAttribute("aria-expanded", "false");
    expect(box().dataset.folded).toBe("true");
  });

  it("unfolds while it has the focus, and folds again when it leaves", async () => {
    contentLines = 7;
    await mount(<Box />);
    await settle(() => fireEvent.focus(box()));
    expect(box().dataset.folded).toBe("false");
    await settle(() => fireEvent.blur(box()));
    expect(box().dataset.folded).toBe("true");
  });

  it("stays open after the focus leaves when „Arată mai mult…” was pressed", async () => {
    contentLines = 7;
    await mount(<Box />);
    await settle(() => fireEvent.focus(box()));
    await settle(() => fireEvent.click(screen.getByRole("button", { name: more })));
    await settle(() => fireEvent.blur(box()));
    expect(box().dataset.folded).toBe("false");
  });

  it("the link keeps the focus in the box when pressed with the mouse", async () => {
    contentLines = 7;
    await mount(<Box />);
    const down = fireEvent.mouseDown(screen.getByRole("button", { name: more }));
    expect(down).toBe(false); // default prevented
  });

  it("folds again when the value changes without a keystroke — a version change", async () => {
    contentLines = 7;
    await mount(<Box />);
    await settle(() => fireEvent.click(screen.getByRole("button", { name: more })));
    expect(box().dataset.folded).toBe("false");
    await settle(() => fireEvent.click(screen.getByRole("button", { name: "reset" })));
    expect(box().dataset.folded).toBe("true");
  });

  it("typing keeps it open", async () => {
    contentLines = 7;
    await mount(<Box />);
    await settle(() => fireEvent.click(screen.getByRole("button", { name: more })));
    await settle(() => fireEvent.change(box(), { target: { value: "x\ny\nz\nw\nv\nu\nt\ns" } }));
    expect(box().dataset.folded).toBe("false");
  });

  it("names itself by its label's text, so the link's words stay out of its name", async () => {
    contentLines = 7;
    await mount(<Box label="Note extinse" />);
    expect(screen.getByRole("textbox", { name: "Note extinse" })).toBe(box());
  });
});

describe("the guard: every „Note…” box and the MRZ fold", () => {
  it("every notes width entry, the MRZ and a stamp's notes fold at five lines", async () => {
    for (const [what, w] of [
      ["NATURAL_PERSON.notes", NATURAL_PERSON.notes],
      ["NATURAL_PERSON.idMrzRaw", NATURAL_PERSON.idMrzRaw],
      ["JUDICIAL_PERSON.notes", JUDICIAL_PERSON.notes],
      ["PROPERTY.notes", PROPERTY.notes],
      ["DOCUMENT.notes", DOCUMENT.notes],
      ["ADDRESS.notes", ADDRESS.notes],
      ["SCREEN.stampNotes", SCREEN.stampNotes],
    ] as [string, FieldWidth][]) {
      expect([what, w.fold]).toEqual([what, NOTE_FOLD_LINES]);
    }
    expect(NOTE_FOLD_LINES).toBe(5);
  });

  it("a NEW notes entry in field-widths.ts cannot appear without the fold", async () => {
    const missing: string[] = [];
    for (const [table, value] of Object.entries(WIDTHS)) {
      if (!value || typeof value !== "object") continue;
      for (const [key, w] of Object.entries(value as Record<string, unknown>)) {
        const fw = w as Partial<FieldWidth> | null;
        if (!fw || typeof fw !== "object" || !("kind" in fw) || !("step" in fw)) continue;
        if (/notes$/i.test(key) && fw.fold !== NOTE_FOLD_LINES) missing.push(`${table}.${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  const SRC = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), "src", ...p), "utf8");

  it.each([
    ["the Natural Person", ["app", "natural-persons", "_components", "natural-person-form.tsx"]],
    ["the Judicial Person", ["app", "judicial-persons", "_components", "judicial-person-form.tsx"]],
    ["the Property", ["app", "properties", "_components", "property-form.tsx"]],
    ["the Document", ["app", "documents", "_components", "document-form.tsx"]],
    ["the address block", ["components", "address", "address-block.tsx"]],
    ["the ID-card dialog", ["app", "admin", "import", "_components", "id-card-person-dialog.tsx"]],
  ])("%s's field helper passes the width's fold to GrowingText", (_what, file) => {
    expect(SRC(...file)).toMatch(/<GrowingText[\s\S]{0,400}?fold=\{width\.fold\}/);
  });

  it.each([
    ["„Note pagină” in the page dialog", ["app", "documents", "_components", "pages-panel.tsx"], /dialog\.pageNotes/],
    ["„Note” on a stamp", ["app", "admin", "stamps", "_components", "stamps-list-view.tsx"], /fields\.notes/],
    ["„Note” in the stamp applicator", ["app", "admin", "stamps", "_components", "stamp-applicator.tsx"], /fields\.notes/],
  ])("%s is a folding GrowingText, and no file with a „Note” label draws a raw <textarea>", (_what, file, label) => {
    const src = SRC(...file);
    expect(src).toMatch(label);
    expect(src).toMatch(/<GrowingText[\s\S]{0,600}?fold=\{(NOTE_FOLD_LINES|SCREEN\.stampNotes\.fold)\}/);
    expect(src).not.toMatch(/<textarea\b/);
  });
});
