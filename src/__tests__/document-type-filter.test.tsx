/**
 * Slice #38.07 — the Documents list's „Tip document:" names the one type
 * chosen, says „N tipuri afișate" in italics for several and „Niciun tip" for
 * none; „Câmp specific" works only for exactly one type that has a form with a
 * closed-list field, and its ⓘ says so in italics. Driven in the browser by
 * TC-DOC-16.
 *
 * Slice #38.18 — „Tip document:" moved to the second row, in front of „Câmp
 * specific:", with a green or red sign between them whose tooltip says why;
 * a disabled „Câmp specific:" looks disabled.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";

import { customFieldFilter, customFieldState, foldForSearch, typeFilterTrigger, typesMatching } from "@/lib/documents/type-filter";
import { CustomFieldSign } from "@/components/documents/custom-field-sign";
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

  it("the screen: the field joins the second row once the types load, its select disabled by the rule", () => {
    expect(VIEW).toMatch(/\{typeOptions\.length > 0 && \(\s*<>\s*<CustomFieldSign/);
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

describe("the sign between „Tip document:” and „Câmp specific:” (#38.18)", () => {
  const ROF = ro.shared.listFilters;
  const all = customFieldState(TYPES, undefined);
  const cases: [string, ReturnType<typeof customFieldState>, string, string][] = [
    ["every type (no choice in the URL)", all, "off", "all"],
    ["every type, ticked one by one", customFieldState(TYPES, ["cvc", "txt", "adv"]), "off", "all"],
    ["none", customFieldState(TYPES, []), "off", "none"],
    ["two", customFieldState(TYPES, ["cvc", "adv"]), "off", "several"],
    ["one without a form", customFieldState(TYPES, ["adv"]), "off", "noForm"],
    ["one whose form has no closed-list field", customFieldState(TYPES, ["txt"]), "off", "noClosedList"],
    ["one with a closed-list form", customFieldState(TYPES, ["cvc"]), "on", "—"],
  ];

  it.each(cases)("%s: the state and its reason", (_label, state, sign, reason) => {
    expect(state.enabled).toBe(sign === "on");
    expect(state.reason ?? "—").toBe(reason);
  });

  it("agrees with „Câmp specific”'s own rule on every input", () => {
    for (const checked of [undefined, [], ["cvc"], ["txt"], ["adv"], ["cvc", "adv"], ["cvc", "txt", "adv"], ["nobody"]]) {
      expect({ checked, on: customFieldState(TYPES, checked).enabled }).toEqual({ checked, on: customFieldFilter(TYPES, checked).enabled });
    }
  });

  it("names the one type, and counts several", () => {
    expect(customFieldState(TYPES, ["cvc"]).typeName).toBe("Contract de Vânzare");
    expect(customFieldState(TYPES, ["adv"]).typeName).toBe("Adeverință");
    expect(customFieldState(TYPES, ["cvc", "adv"]).count).toBe(2);
  });

  const note = (s: ReturnType<typeof customFieldState>): string =>
    s.enabled
      ? ROF.customFieldSignOffers.replace("{type}", s.typeName)
      : ({ all: ROF.customFieldSignAll, none: ROF.customFieldSignNone, several: "Sunt bifate 2 tipuri — alegeți la „Tip document” un singur tip.", noForm: ROF.customFieldSignNoForm.replace("{type}", s.typeName), noClosedList: ROF.customFieldSignNoClosedList.replace("{type}", s.typeName) } as Record<string, string>)[s.reason!];

  it.each(cases)("%s: the icon, its colour, its name, and its tooltip on hover and on keyboard focus", (_label, state, sign) => {
    const title = state.enabled ? ROF.customFieldSignOn : ROF.customFieldSignOff;
    render(<CustomFieldSign state={state} title={title} note={note(state)} />);
    const el = screen.getByRole("img", { name: `${title}. ${note(state)}` });
    expect(el).toHaveAttribute("data-custom-field-sign", sign);
    expect(el).toHaveAttribute("tabindex", "0");
    const svg = el.querySelector("svg")!;
    // Colour is not the only carrier: two different shapes.
    expect(svg.getAttribute("class")).toMatch(state.enabled ? /lucide-circle-check/ : /lucide-ban/);
    expect(svg.getAttribute("class")).toMatch(state.enabled ? /\btext-success\b.*\bdark:text-success-dark\b/ : /\btext-danger\b.*\bdark:text-danger-dark\b/);
    // Hover opens the tooltip; it says the state and the reason (as icon-button.test.tsx hovers).
    const over = createEvent.pointerOver(el);
    Object.defineProperty(over, "pointerType", { value: "mouse" });
    fireEvent(el, over);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent(title);
    expect(tip).toHaveTextContent(note(state));
    const out = createEvent.pointerOut(el);
    Object.defineProperty(out, "pointerType", { value: "mouse" });
    fireEvent(el, out);
    expect(screen.queryByRole("tooltip")).toBeNull();
    // A keyboard focus opens it too.
    const real = Element.prototype.matches;
    const spy = jest.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, sel: string) {
      return sel === ":focus-visible" ? true : real.call(this, sel);
    });
    act(() => el.focus());
    expect(screen.getByRole("tooltip")).toHaveTextContent(note(state));
    spy.mockRestore();
  });

  it("the words, in both languages — several as an ICU plural; the colours are theme tokens", () => {
    for (const k of ["customFieldSignOn", "customFieldSignOff", "customFieldSignOffers", "customFieldSignAll", "customFieldSignNone", "customFieldSignSeveral", "customFieldSignNoForm", "customFieldSignNoClosedList"]) {
      expect([k, typeof ro.shared.listFilters[k], typeof en.shared.listFilters[k]]).toEqual([k, "string", "string"]);
    }
    expect(ro.shared.listFilters.customFieldSignSeveral).toMatch(/\{count, plural, one \{.*\} few \{.*\} other \{.*\}\}/);
    expect(en.shared.listFilters.customFieldSignSeveral).toMatch(/\{count, plural, one \{.*\} other \{.*\}\}/);
    const css = read("src", "app", "globals.css");
    expect(css).toMatch(/--color-success:\s+#15803D/);
    expect(css).toMatch(/--color-success-dark:\s+#4ADE80/);
    expect(css).toMatch(/--color-danger-dark:\s+#F87171/);
  });

  it("a disabled „Câmp specific:” looks it: the label greyed and in italics, the box faded and dashed, the cursor not-allowed", () => {
    const box = VIEW.slice(VIEW.indexOf("data-custom-field-box="), VIEW.indexOf('aria-describedby="custom-field-hint"'));
    expect(box).toMatch(/customField\.enabled\s*\?\s*"inline-flex items-center gap-1\.5 rounded-md border border-wire bg-white/);
    expect(box).toMatch(/: "inline-flex cursor-not-allowed items-center gap-1\.5 rounded-md border border-dashed border-wire bg-cta-pale/);
    expect(box).toContain('customField.enabled ? "text-fade" : "italic text-fade dark:text-zinc-500"');
    expect(VIEW).toMatch(/disabled=\{!customField\.enabled\}[\s\S]{0,200}disabled:cursor-not-allowed disabled:italic disabled:text-fade/);
  });
});

/** Slice #38.48 — a search box in the dropdown, under „Toate tipurile", above the divider. */
describe("„Tip document” — the search box (#38.48)", () => {
  const TYPES_RO = [
    { id: "1", name: "Certificat de moștenitor" },
    { id: "2", name: "Contract de vânzare" },
    { id: "3", name: "Autorizație de construire" },
    { id: "4", name: "Hotărâre judecătorească" },
    { id: "5", name: "Certificat de urbanism" },
  ];
  const names = (q: string) => typesMatching(TYPES_RO, q).map((t) => t.name);

  it("folds case and diacritics: „ș”/„s”, „ț”/„t”, „ă”/„a”, „â”/„a”, „î”/„i”, either spelling of „ș” and „ț”", () => {
    expect(foldForSearch("Moștenitor")).toBe("mostenitor");
    expect(foldForSearch("AUTORIZAȚIE")).toBe("autorizatie");
    expect(foldForSearch("Hotărâre judecătorească")).toBe("hotarare judecatoreasca");
    expect(foldForSearch("Înscris")).toBe("inscris");
    // The cedilla forms older keyboards and OCR write: U+015F, U+0163.
    expect(foldForSearch("moştenitor autorizaţie")).toBe("mostenitor autorizatie");
    expect(foldForSearch("  de   vânzare ")).toBe("de vanzare");
  });

  it("narrows to the names that contain what was typed, in their own order", () => {
    expect(names("mostenitor")).toEqual(["Certificat de moștenitor"]);
    expect(names("CERTIFICAT")).toEqual(["Certificat de moștenitor", "Certificat de urbanism"]);
    expect(names("hotarare")).toEqual(["Hotărâre judecătorească"]);
    expect(names("de vanzare")).toEqual(["Contract de vânzare"]);
    expect(names("devanzare")).toEqual([]); // the spaces count
    expect(names("zzz")).toEqual([]);
  });

  it("a blank search shows every type", () => {
    expect(names("")).toEqual(TYPES_RO.map((t) => t.name));
    expect(names("   ")).toEqual(TYPES_RO.map((t) => t.name));
  });

  it("the words, in both languages", () => {
    expect(ro.document.typeSearchPlaceholder).toBe("Caută un tip…");
    expect(ro.document.typeSearchEmpty).toBe("Niciun tip nu se potrivește.");
    expect(en.document.typeSearchPlaceholder).toBe("Search the types…");
    expect(en.document.typeSearchEmpty).toBe("No type matches.");
  });

  it("the screen: the box under „Toate tipurile”, above the divider; focused on opening, emptied on closing; the rows it hides never untick", () => {
    const dropdown = VIEW.slice(VIEW.indexOf("function DocumentTypeFilterDropdown"), VIEW.indexOf("// Types"));
    expect(dropdown.indexOf("{allTypesLabel}\n")).toBeLessThan(dropdown.indexOf("data-type-search"));
    expect(dropdown).toMatch(/<div className="border-b border-crease[^"]*">\s*<input\s+ref=\{searchRef\}/);
    expect(dropdown).toContain("if (open) searchRef.current?.focus();");
    expect(dropdown).toMatch(/const close = \(\) => \{\s*setOpen\(false\);\s*setQuery\(""\);\s*\};/);
    expect(dropdown).not.toMatch(/setOpen\(false\)(?!;\s*setQuery)/);
    expect(dropdown).toContain("const shownTypes = typesMatching(types, query);");
    expect(dropdown).toContain("{shownTypes.map((ty) => (");
    // „Toate tipurile" and each row act on the whole list, never on what the search shows.
    expect(dropdown).toContain("const next = allChecked ? new Set<string>() : new Set(allTypeIds);");
    expect(dropdown).toMatch(/data-type-search-empty=""[\s\S]*?\{searchEmptyLabel\}/);
    // Not while the types load: an empty list then is not „nothing matches".
    expect(dropdown).toContain("{types.length > 0 && shownTypes.length === 0 && (");
    expect(dropdown).toContain('className="px-3 py-2 text-sm italic text-fade"');
  });
});
