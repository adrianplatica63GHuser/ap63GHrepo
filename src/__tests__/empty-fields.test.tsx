/**
 * Slice 40.71 — in a tile that holds some values, the empty fields hide behind „Arată N câmpuri goale”.
 *
 * The rule (`src/lib/ui/empty-fields.ts`): a field hides when it is unset as loaded and now, and is not on its form's
 * always-shown list (`ALWAYS_SHOWN_FIELDS`, field-widths.ts); a tile with nothing in it hides nothing (40.64's one
 * line). The hook (`src/components/tiles/empty-fields.tsx`): nothing hides on a new record, in a tile drawn whole (a
 * pulse, an error) or once the link was pressed. The link: the count as a plural, the names on one line, all of them
 * in its tooltip. The four forms use it, and keep the hidden fields mounted.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EmptyFieldsLink, hiddenFieldStyle, useEmptyFields } = require("@/components/tiles/empty-fields") as typeof import("@/components/tiles/empty-fields");
import { emptyFieldsToHide } from "@/lib/ui/empty-fields";
import { ALWAYS_SHOWN_FIELDS } from "@/lib/ui/field-widths";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

const CONTACT = ["personalPhone1", "personalPhone2", "workPhone", "personalEmail1", "personalEmail2", "workEmail"];
const loaded = { personalPhone1: "0721 000 000", personalEmail1: "", personalPhone2: "", workPhone: "", personalEmail2: "", workEmail: "" };

describe("which fields hide (Ask first 1, 2)", () => {
  it("a partly filled tile hides its empty fields, in their order", () => {
    expect(emptyFieldsToHide({ paths: CONTACT, always: [], loaded, now: loaded })).toEqual(["personalPhone2", "workPhone", "personalEmail1", "personalEmail2", "workEmail"]);
  });
  it("a wholly empty tile hides nothing — it is 40.64's one line", () => {
    const none = Object.fromEntries(CONTACT.map((k) => [k, ""]));
    expect(emptyFieldsToHide({ paths: CONTACT, always: [], loaded: none, now: none })).toEqual([]);
  });
  it("a field that gets a value stays shown, and one emptied while typing does not vanish", () => {
    const now = { ...loaded, workPhone: "021 000 0000", personalPhone1: "" };
    expect(emptyFieldsToHide({ paths: CONTACT, always: [], loaded, now })).not.toContain("workPhone");
    expect(emptyFieldsToHide({ paths: CONTACT, always: [], loaded, now })).not.toContain("personalPhone1");
  });
  it("the always-shown fields stay, even empty — CNP on a person first", () => {
    const person = { lastName: "Popescu", firstName: "", cnp: "", nickname: "" };
    const paths = ["lastName", "firstName", "nickname", "cnp"];
    expect(emptyFieldsToHide({ paths, always: ALWAYS_SHOWN_FIELDS.naturalPerson, loaded: person, now: person })).toEqual(["nickname"]);
  });
  it("a select at the value a new record starts with counts as unset", () => {
    const v = { country: "România", streetLine: "Str. X", county: "" };
    expect(emptyFieldsToHide({ paths: ["streetLine", "county", "country"], always: [], loaded: v, now: v, defaults: { country: "România" } })).toEqual(["county", "country"]);
  });
  it("the always-shown lists are the header's", () => {
    expect(ALWAYS_SHOWN_FIELDS).toEqual({
      naturalPerson: ["lastName", "firstName", "cnp"],
      judicialPerson: ["name", "cuiNumber"],
      property: ["propertyTypeId", "address.locality", "tarlaId", "parcela"],
      document: ["documentTypeId", "title", "dateDocument", "nrDocument"],
    });
  });
});

describe("the visit (Ask first 2)", () => {
  const args = { loaded, now: loaded, always: [] as string[] };
  it("nothing hides on a new record, or in a tile drawn whole", () => {
    const { result } = renderHook(() => useEmptyFields({ ...args, active: false }));
    expect(result.current.hide("contact", CONTACT)).toEqual([]);
    const { result: saved } = renderHook(() => useEmptyFields({ ...args, active: true }));
    expect(saved.current.hide("contact", CONTACT, true)).toEqual([]);
    expect(saved.current.hide("contact", CONTACT)).toHaveLength(5);
  });
  it("once opened, a tile stays open — the other tiles do not", () => {
    const { result } = renderHook(() => useEmptyFields({ ...args, active: true }));
    act(() => result.current.show("contact"));
    expect(result.current.hide("contact", CONTACT)).toEqual([]);
    expect(result.current.hide("other", CONTACT)).toHaveLength(5);
  });
  it("a hidden field is display: none inline, over its own style", () => {
    expect(hiddenFieldStyle(true, { width: "8.5rem" })).toEqual({ width: "8.5rem", display: "none" });
    expect(hiddenFieldStyle(false, { width: "8.5rem" })).toEqual({ width: "8.5rem" });
  });
});

describe("the link (Ask first 3)", () => {
  it("says how many, names them, keeps them all in its tooltip, and shows them when pressed", () => {
    const onShow = jest.fn();
    render(<EmptyFieldsLink tile="contact" labels={["Telefon 2", "Telefon serviciu", "Email 1", "Email 2"]} onShow={onShow} />);
    const link = screen.getByRole("button");
    expect(link).toHaveTextContent('show:{"count":4}');
    expect(link.getAttribute("title")).toBe('all:{"names":"Telefon 2, Telefon serviciu, Email 1, Email 2"}');
    expect(document.querySelector("[data-empty-fields-names]")).toHaveTextContent("Telefon 2, Telefon serviciu, Email 1, Email 2");
    expect(document.querySelector("[data-empty-fields-names]")?.className).toMatch(/\btruncate\b/);
    expect(document.querySelector("[data-empty-fields]")?.getAttribute("data-empty-fields-count")).toBe("4");
    fireEvent.click(link);
    fireEvent.keyDown(link, { key: "Enter" });
    expect(onShow).toHaveBeenCalledTimes(2);
  });
  it("draws nothing when nothing is hidden", () => {
    const { container } = render(<EmptyFieldsLink tile="contact" labels={[]} onShow={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("is not a <button>, so a read-only view's disabled fieldset does not disable it", () => {
    render(<fieldset disabled><EmptyFieldsLink tile="contact" labels={["Email 2"]} onShow={() => {}} /></fieldset>);
    expect(screen.getByRole("button").tagName).toBe("SPAN");
  });
});

describe("the copy (Ask first 3)", () => {
  const ro = JSON.parse(read("messages", "ro-RO.json")).shared.emptyFields;
  const en = JSON.parse(read("messages", "en-GB.json")).shared.emptyFields;
  it("the count is a plural — one, few and other in Romanian, one and other in English", () => {
    expect(ro.show).toBe("{count, plural, one {Arată un câmp gol} few {Arată # câmpuri goale} other {Arată # de câmpuri goale}}");
    expect(en.show).toBe("{count, plural, one {Show # empty field} other {Show # empty fields}}");
    expect(ro.all).toContain("{names}");
    expect(en.all).toContain("{names}");
  });
});

describe("the four forms use it (Ask first 1, 4)", () => {
  const FORMS = [
    "src/app/natural-persons/_components/natural-person-form.tsx",
    "src/app/judicial-persons/_components/judicial-person-form.tsx",
    "src/app/properties/_components/property-form.tsx",
    "src/app/documents/_components/document-form.tsx",
  ];
  it.each(FORMS.map((f) => [f]))("%s provides the hidden set, ends its tiles with the link, and its fields read it", (file) => {
    const src = read(file);
    expect(src).toMatch(/<HiddenFieldsContext\.Provider value=\{hiddenFields\}>/);
    expect(src).toMatch(/emptyFieldsLink\(/);
    expect(src).toMatch(/useEmptyFields\(\{\s*active: !isCreate,/);
    // Every field component that hides keeps itself mounted: display: none, never an early return.
    expect(src).toMatch(/style=\{hiddenFieldStyle\(hiddenEmpty, /);
    expect(src).not.toMatch(/if \(hiddenEmpty\) return/);
  });
  it("the address block's fields read it too, and it draws the link under its fields", () => {
    const src = read("src/components/address/address-block.tsx");
    expect(src).toMatch(/useFieldHidden\(name\)/);
    expect(src).toMatch(/\{emptyFields\}/);
  });
  it("a row whose every field is hidden takes no room", () => {
    expect(read("src/app/globals.css")).toMatch(/div:has\(> \[data-empty-hidden\]\):not\(:has\(> :not\(\[data-empty-hidden\]\)\)\) \{\s*display: none;/);
  });
});
