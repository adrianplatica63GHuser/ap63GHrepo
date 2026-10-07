/**
 * Slice #38.03 — the Property's heading names its type, and its ⓘ says which
 * tiles that type shows. The explanation is built from the type's three flags
 * (typeShows), never from a list per type; the <h1>'s name stays the record's
 * name alone. Driven in the browser by TC-PROP-11.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";
import { Map as MapIcon } from "lucide-react";

import { RecordHeading } from "@/lib/ui/record-heading";
import { PropertyTypeHeading, TYPE_SEPARATOR } from "@/app/properties/_components/property-type-heading";
import { sameProfile, typeShows, TYPE_TILES, type PropertyTypeProfile } from "@/lib/properties/type-profile";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const mockMessages: Record<string, Record<string, unknown>> = {
  "ro-RO": JSON.parse(read("messages", "ro-RO.json")),
  "en-GB": JSON.parse(read("messages", "en-GB.json")),
};
let mockLocale = "ro-RO";

// The real message files, with {name} placeholders filled — enough ICU for these keys.
jest.mock("next-intl", () => ({
  useLocale: () => mockLocale,
  useTranslations: (ns: string) => (key: string, values?: Record<string, string>) => {
    const msg = [ns, ...key.split(".")].reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], mockMessages[mockLocale]);
    if (typeof msg !== "string") throw new Error(`no message ${ns}.${key}`);
    return msg.replace(/\{(\w+)\}/g, (_, k: string) => values?.[k] ?? `{${k}}`);
  },
}));

const profile = (name: string, t: boolean, a: boolean, s: boolean): PropertyTypeProfile => ({
  id: name,
  name,
  showTarlaParcela: t,
  showAddress: a,
  showStreetView: s,
});
// migration_041's three profiles.
const URBAN = profile("Teren Construit", false, true, true);
const RURAL = profile("Teren Arabil", true, false, false);
const LINEAR = profile("Liniară", true, true, true);

beforeEach(() => {
  mockLocale = "ro-RO";
});

describe("typeShows — the type's flags, restated (#38.03)", () => {
  it("urban: Adresă and Street View shown, Tarla/Solă and Parcelă not", () => {
    expect(typeShows(URBAN)).toEqual({ shown: ["address", "streetView"], hidden: [], tarlaParcela: false });
  });
  it("agricultural / forest: the two tiles hidden, Tarla/Solă and Parcelă shown", () => {
    expect(typeShows(RURAL)).toEqual({ shown: [], hidden: ["address", "streetView"], tarlaParcela: true });
  });
  it("LINIARA: everything", () => {
    expect(typeShows(LINEAR)).toEqual({ shown: ["address", "streetView"], hidden: [], tarlaParcela: true });
  });
  it("a mixed type keeps the screen's order on both sides", () => {
    expect(typeShows(profile("X", true, false, true))).toEqual({ shown: ["streetView"], hidden: ["address"], tarlaParcela: true });
  });
  it("no type: everything shows, as the form does", () => {
    expect(typeShows(null)).toEqual({ shown: [...TYPE_TILES], hidden: [], tarlaParcela: true });
  });
  it("sameProfile compares the name and the three flags", () => {
    expect(sameProfile(URBAN, { ...URBAN })).toBe(true);
    expect(sameProfile(URBAN, { ...URBAN, showAddress: false })).toBe(false);
    expect(sameProfile(URBAN, { ...URBAN, name: "Alt" })).toBe(false);
    expect(sameProfile(null, null)).toBe(true);
    expect(sameProfile(URBAN, null)).toBe(false);
  });
});

describe("PropertyTypeHeading (#38.03)", () => {
  const part = () => document.querySelector<HTMLElement>("[data-heading-type]");
  const bubble = () => screen.getByRole("tooltip", { hidden: true });

  it("„  -  (Tip)\": the separator as written, the type in parentheses and in italics, an ⓘ", () => {
    render(<PropertyTypeHeading type={URBAN} />);
    const sep = part()!.querySelector("[data-heading-type-separator]")!;
    expect(sep.textContent).toBe("  -  ");
    expect(TYPE_SEPARATOR).toBe("  -  ");
    expect(sep.className).toMatch(/whitespace-pre/);
    const name = part()!.querySelector("[data-heading-type-name]")!;
    expect(name.textContent).toBe("(Teren Construit)");
    expect(name.className).toMatch(/\bitalic\b/);
    expect(part()!.className).toMatch(/text-2xl/);
    expect(screen.getByRole("button", { name: "Despre tipul proprietății" })).toBeTruthy();
    // The bubble's text is in italics.
    expect(bubble().parentElement!.className).toMatch(/\[&_\[role=tooltip\]\]:italic/);
  });

  it.each([
    ["urban", URBAN, "Pentru acest tip se afișează „Adresă” și „Street View”. Tarla/Solă și Parcelă nu apar în „Identificare cadastrală”."],
    ["agricultural", RURAL, "Pentru acest tip nu se afișează „Adresă” și „Street View”. Tarla/Solă și Parcelă apar în „Identificare cadastrală”."],
    ["LINIARA", LINEAR, "Pentru acest tip se afișează „Adresă” și „Street View”. Tarla/Solă și Parcelă apar în „Identificare cadastrală”."],
    ["mixed", profile("X", false, false, true), "Pentru acest tip se afișează „Street View”; nu se afișează „Adresă”. Tarla/Solă și Parcelă nu apar în „Identificare cadastrală”."],
  ])("the explanation for a %s type, in Romanian", (_label, type, text) => {
    render(<PropertyTypeHeading type={type} />);
    expect(bubble()).toHaveTextContent(text);
  });

  it("the same in English", () => {
    mockLocale = "en-GB";
    render(<PropertyTypeHeading type={RURAL} />);
    expect(bubble()).toHaveTextContent("This type does not show “Address” and “Street View”. Tarla/Solă and Parcelă appear in “Cadastral identification”.");
  });

  it("no type: nothing after the name — no dash, no ⓘ", () => {
    const { container } = render(<PropertyTypeHeading type={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("drawn after the <h1>, never in it: the heading's name stays the record's name", () => {
    render(
      <header>
        <RecordHeading icon={MapIcon} name="Teren construit Str. Leordeni 45" />
        <PropertyTypeHeading type={URBAN} />
      </header>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Teren construit Str. Leordeni 45" });
    expect(h1.contains(part())).toBe(false);
    expect(h1.nextElementSibling).toBe(part());
  });

  it("the Property screen draws it after its heading, from the type the form reports", () => {
    const tiles = read("src", "app", "properties", "_components", "property-detail-tiles.tsx");
    expect(tiles).toMatch(/<RecordHeading icon=\{MapIcon\} name=\{propertyName\} \/>\s*<PropertyTypeHeading type=\{type\} \/>/);
    expect(tiles).toContain("onTypeChange={onTypeChange}");
    const form = read("src", "app", "properties", "_components", "property-form.tsx");
    expect(form).toMatch(/onTypeChange\?\.\(typeProfile\)/);
  });
});
