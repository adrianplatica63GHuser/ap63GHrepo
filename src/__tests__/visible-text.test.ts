/**
 * @jest-environment jsdom
 *
 * Slice 41.20 — a name as the screen shows it: never what only a screen reader hears.
 *
 * Adrian: „why are you showing me the string "System ID "? I cannot see it anywhere!" The Identity tile's heading held
 * the system ID corner (system-id-corner.tsx), whose „ID sistem" is `sr-only`. jsdom has no layout, so the widths
 * (`headingParts`) are TC-TILES-26 step 9's; the rule for which text counts is pinned here.
 *
 * Slice 41.22 moved the ID out of every tile heading, into the page bar. The rule stands for any heading with a part
 * only a screen reader hears, so the example below keeps the corner's markup as that case — not as where it is drawn.
 */
import { isUnseen, visibleName, visibleParts, visibleText } from "@/components/tiles/visible-text";

function heading(html: string): HTMLElement {
  document.body.innerHTML = `<section data-tile="identity"><h2 class="flex items-center gap-2">${html}</h2></section>`;
  return document.querySelector("h2")!;
}

/** A part with an `sr-only` label, marked up as SystemIdCorner draws the ID (41.22: in the page bar, no longer in a heading). */
const corner = (code: string) =>
  `<span class="shrink-0 whitespace-nowrap" data-system-id><span class="sr-only">ID sistem </span><span class="select-all">${code}</span></span>`;

describe("the visible-text rule (Ask first 1)", () => {
  it("a heading with an sr-only part reads „Identitate · PPERS 77369” — never „ID sistem” (the pre-41.22 Identity heading)", () => {
    const h = heading(`Identitate${corner("PPERS 77369")}`);
    expect(h.textContent).toBe("IdentitateID sistem PPERS 77369"); // what the bubble used to say
    expect(visibleName(h)).toBe("Identitate · PPERS 77369");
    expect(visibleParts(h).map((p) => p.text)).toEqual(["Identitate", "PPERS 77369"]);
  });

  it("a heading with no corner is its own text", () => {
    expect(visibleName(heading("Date cadastrale"))).toBe("Date cadastrale");
    expect(visibleName(heading("  Date\n   generale "))).toBe("Date generale");
  });

  it("sr-only, aria-hidden, hidden and display:none are all left out", () => {
    const h = heading(
      `<span>Contact</span><span aria-hidden="true">*</span><span hidden>ascuns</span><span style="display:none">nimic</span><span style="visibility:hidden">nici</span><span class="sr-only">doar citit</span>`,
    );
    expect(visibleName(h)).toBe("Contact");
    for (const el of Array.from(h.children).slice(1)) expect(isUnseen(el)).toBe(true);
    expect(isUnseen(h.children[0])).toBe(false);
  });

  it("a field's label: its visible words, nested parts glued as written", () => {
    document.body.innerHTML = `<label><span>Nume<span class="sr-only"> (obligatoriu)</span><span aria-hidden="true"> *</span></span><input></label>`;
    expect(visibleText(document.querySelector("label > span")!)).toBe("Nume");
  });

  it("parts are the heading's direct children that show any text", () => {
    const h = heading(`<span></span>Titlu<span><span class="sr-only">ascuns</span></span>${corner("DOC01590")}`);
    expect(visibleParts(h).map((p) => p.text)).toEqual(["Titlu", "DOC01590"]);
  });
});
