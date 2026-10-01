/**
 * The breadcrumb says what the screen it names says.          (Slice #37.07)
 *
 * FU-070: the Romanian crumb for the documents list said „Documente" while the
 * list's own title, the sidebar and the help all say „Acte".
 */
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

// breadcrumb-bar.tsx is a client component; only its pure `buildSegments` is
// under test, so what it imports for rendering is stood in for.
jest.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
jest.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
jest.mock("@/components/providers/navigation-history-provider", () => ({ useNavigationHistory: () => ({}) }));
jest.mock("@/components/help/screen-help-button", () => ({ ScreenHelpButton: () => null }));

describe("the breadcrumb's words", () => {
  it("FU-070: calls the documents list „Acte”, as its title does", () => {
    expect(ro.navigation.breadcrumb.documents).toBe(ro.document.listTitle);
    expect(ro.navigation.breadcrumb.documents).toBe("Acte");
  });
});

describe("the breadcrumb's segments", () => {
  it("FU-064: names /account/change-password, and skips the bare /account", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildSegments } = require("@/components/breadcrumb-bar") as typeof import("@/components/breadcrumb-bar");
    const segs = buildSegments("/account/change-password", (k: string) => `‹${k}›`, {});
    expect(segs.map((s) => s.label)).toEqual(["‹home›", "‹changePassword›"]);
    expect(segs[1].href).toBe("/account/change-password");
    expect(ro.navigation.breadcrumb.changePassword).toBe("Schimbă parola");
  });
});

describe("each „Asociază …” screen's crumb is its own title (Slice #37.34)", () => {
  // #37.27 found „Acasă › Persoane fizice › Adaugă persoană" on „Asociere persoană
  // corelată": one crumb per segment, whatever record it hung from. Now the crumb
  // is the screen's title, which depends on the record.
  const TITLE: Record<string, Record<string, string>> = {
    "natural-persons": {
      "associate-person": "shared.associatePersonReference.title",
      "associate-property": "shared.associateProperty.title",
      "associate-document": "shared.associateDocument.title",
    },
    "judicial-persons": {
      "associate-person": "shared.associatePersonReference.title",
      "associate-property": "shared.associateProperty.title",
      "associate-document": "shared.associateDocument.title",
    },
    documents: {
      "associate-person": "document.associatePerson.title",
      "associate-property": "shared.associateProperty.title",
      "associate-reference": "document.associateReference.title",
      "associate-party": "document.associateParty.title",
    },
    properties: {
      "associate-person": "property.associatePerson.title",
      "associate-document": "property.associateDocument.title",
      "associate-reference": "property.associateReference.title",
    },
  };
  const at = (messages: unknown, path: string): unknown =>
    path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);

  it("covers the thirteen screens, and each crumb reads as its screen's title, in both languages", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ASSOCIATE_CRUMB } = require("@/components/breadcrumb-bar") as typeof import("@/components/breadcrumb-bar");
    expect(Object.values(ASSOCIATE_CRUMB).reduce((n, m) => n + Object.keys(m).length, 0)).toBe(13);
    for (const [list, screens] of Object.entries(TITLE)) {
      for (const [segment, title] of Object.entries(screens)) {
        const key = ASSOCIATE_CRUMB[list]?.[segment];
        expect([list, segment, typeof key]).toEqual([list, segment, "string"]);
        for (const messages of [ro, en]) {
          expect([list, segment, at(messages, `navigation.breadcrumb.${key}`)]).toEqual([list, segment, at(messages, title)]);
        }
      }
    }
  });

  it("puts the screen after its record: Acasă › list › record › screen", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildSegments } = require("@/components/breadcrumb-bar") as typeof import("@/components/breadcrumb-bar");
    const segs = buildSegments("/natural-persons/p1/associate-person", (k: string) => `‹${k}›`, { "/natural-persons/p1": "Ion Exemplu" });
    expect(segs.map((s) => s.label)).toEqual(["‹home›", "‹naturalPersons›", "Ion Exemplu", "‹associatePersonOfPerson›"]);
    const doc = buildSegments("/documents/d1/associate-person", (k: string) => `‹${k}›`, { "/documents/d1": "Contract" });
    expect(doc.map((s) => s.label)).toEqual(["‹home›", "‹documents›", "Contract", "‹associatePersonOfDocument›"]);
  });
});
