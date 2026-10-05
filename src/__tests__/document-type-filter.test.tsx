/**
 * Slice #38.07 — the Documents list's „Tip document:" names the one type
 * chosen, says „N tipuri afișate" in italics for several and „Niciun tip" for
 * none; „Câmp specific" works only for exactly one type that has a form with a
 * closed-list field, and its ⓘ says so in italics. Driven in the browser by
 * TC-DOC-16.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";

import { customFieldFilter, typeFilterTrigger } from "@/lib/documents/type-filter";
import { HintBubble } from "@/lib/ui/hint-bubble";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const ro = JSON.parse(read("messages", "ro-RO.json"));
const en = JSON.parse(read("messages", "en-GB.json"));
const VIEW = read("src", "app", "documents", "list-view.tsx");

const field = (key: string, type: string, options: { value: string; labelRo: string }[] = []) => ({ key, labelRo: key, labelEn: key, type, options, order: 1 });
const CVC = { id: "cvc", name: "Contract de Vânzare", templateFields: [field("starePlata", "select", [{ value: "A", labelRo: "Achitat" }]), field("pret", "number")] };
const TEXT_ONLY = { id: "txt", name: "Act cu formular fără liste", templateFields: [field("nota", "text")] };
const NO_FORM = { id: "adv", name: "Adeverință", templateFields: null };
const TYPES = [CVC, TEXT_ONLY, NO_FORM];

describe("„Tip document:” — the button's words (#38.07)", () => {
  it("every type, or no choice in the URL: „Toate tipurile”", () => {
    expect(typeFilterTrigger(TYPES, undefined)).toEqual({ kind: "all" });
    expect(typeFilterTrigger(TYPES, ["cvc", "txt", "adv"])).toEqual({ kind: "all" });
  });
  it("exactly one: its name", () => {
    expect(typeFilterTrigger(TYPES, ["cvc"])).toEqual({ kind: "one", name: "Contract de Vânzare" });
  });
  it("several but not all: the count", () => {
    expect(typeFilterTrigger(TYPES, ["cvc", "adv"])).toEqual({ kind: "several", count: 2 });
  });
  it("none: „Niciun tip”", () => {
    expect(typeFilterTrigger(TYPES, [])).toEqual({ kind: "none" });
  });
  it("while the types load: „Toate tipurile”, never „Niciun tip”", () => {
    expect(typeFilterTrigger([], ["cvc"])).toEqual({ kind: "all" });
  });
  it("an id no type has is not counted", () => {
    expect(typeFilterTrigger(TYPES, ["cvc", "gone"])).toEqual({ kind: "one", name: "Contract de Vânzare" });
  });

  it("the words, in both languages — several as an ICU plural", () => {
    expect(ro.document.noTypes).toBe("Niciun tip");
    expect(ro.document.typesShown).toBe("{count, plural, one {# tip afișat} few {# tipuri afișate} other {# de tipuri afișate}}");
    expect(en.document.noTypes).toBe("No type");
    expect(en.document.typesShown).toBe("{count, plural, one {# type shown} other {# types shown}}");
  });

  it("the screen: one name cut with an ellipsis and its tooltip; several and none in italics; no more „n/N”", () => {
    expect(VIEW).toMatch(/className="max-w-56 truncate[^"]*" title=\{trigger\.name\} data-type-trigger="one"/);
    expect(VIEW).toMatch(/className="font-medium italic[^"]*" data-type-trigger=\{trigger\.kind\}/);
    expect(VIEW).not.toMatch(/\$\{checkedIds\.size\}\/\$\{allTypeIds\.length\}/);
  });
});

describe("„Câmp specific” — when it works (#38.07)", () => {
  it("one type with a closed-list field: enabled, offering that type's closed-list fields", () => {
    const r = customFieldFilter(TYPES, ["cvc"]);
    expect(r.enabled).toBe(true);
    expect(r.options.map((o) => o.key)).toEqual(["starePlata"]);
  });
  it("one type whose form has no closed-list field: disabled", () => {
    expect(customFieldFilter(TYPES, ["txt"])).toEqual({ enabled: false, options: [] });
  });
  it("one type with no form: disabled", () => {
    expect(customFieldFilter(TYPES, ["adv"])).toEqual({ enabled: false, options: [] });
  });
  it("two types, every type, or none: disabled", () => {
    expect(customFieldFilter(TYPES, ["cvc", "adv"])).toEqual({ enabled: false, options: [] });
    expect(customFieldFilter(TYPES, undefined)).toEqual({ enabled: false, options: [] });
    expect(customFieldFilter(TYPES, [])).toEqual({ enabled: false, options: [] });
  });

  it("the screen: the row is drawn once the types load, the field select disabled by the rule", () => {
    expect(VIEW).toMatch(/\{typeOptions\.length > 0 && \(\s*<div className="flex flex-wrap items-center gap-3" data-toolbar-row="second">/);
    expect(VIEW).toContain("disabled={!customField.enabled}");
    expect(VIEW).toContain("customFieldFilter(typeOptions, initialDocumentTypeIds)");
  });

  it("the ⓘ says, in italics, when it becomes active — in both languages", () => {
    expect(ro.shared.listFilters.customFieldWhenActive).toBe(
      "Câmpul specific este activ numai când la „Tip document” este ales un singur tip, iar acel tip are un formular cu câmpuri cu listă închisă de valori.",
    );
    expect(en.shared.listFilters.customFieldWhenActive).toMatch(/exactly one type/);
    // The hint no longer offers „every type's when none is".
    expect(ro.shared.listFilters.customFieldHint).not.toMatch(/ale tuturor/);
    expect(en.shared.listFilters.customFieldHint).not.toMatch(/every type's/);
  });

  it("HintBubble draws a note after the text, in italics, inside the same tooltip", () => {
    render(
      <HintBubble id="h" text="Explicația." note="Activ numai așa." triggerLabel="Despre">
        <span>x</span>
      </HintBubble>,
    );
    const tip = screen.getByRole("tooltip", { hidden: true });
    expect(tip).toHaveTextContent("Explicația. Activ numai așa.");
    const em = tip.querySelector("em[data-hint-note]")!;
    expect(em.textContent).toBe("Activ numai așa.");
    expect(em.className).toMatch(/\bitalic\b/);
  });
});
