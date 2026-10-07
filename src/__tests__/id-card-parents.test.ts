/**
 * An identity card creates its holder's father and mother too  (Slice #38.29)
 *
 * The pure parts: which parents a read offers, the surname taken from the
 * holder and marked unconfirmed, the „Note" line, the body a parent is created
 * with, the link's direction — the parent holds „Tată" / „Mamă" — and that the
 * migration, the reference-data file and the provenance list say the same.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  blankDrafts,
  cardParentsFrom,
  draftsFromCard,
  followHolderSurname,
  incompleteParents,
  parentGender,
  parentLink,
  parentNote,
  parentOutcomeSentences,
  parentPersonBody,
  parentsToCreate,
  personName,
  withSurname,
} from "@/lib/import/id-card-parents";
import { PROVENANCE_VALUES } from "@/lib/metadata/provenance";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

describe("the read: parents as two named fields", () => {
  it("takes the father's and the mother's first names", () => {
    expect(cardParentsFrom({ father: "Ion", mother: "Maria" })).toEqual({ father: "Ion", mother: "Maria" });
  });

  it("trims and folds whitespace; blank, null-ish and non-strings read as absent", () => {
    expect(cardParentsFrom({ father: "  Ion  Vasile ", mother: "" })).toEqual({ father: "Ion Vasile", mother: null });
    expect(cardParentsFrom({ father: "null", mother: "—" })).toEqual({ father: null, mother: null });
    expect(cardParentsFrom({ father: 7, mother: ["Maria"] })).toEqual({ father: null, mother: null });
  });

  it.each([[undefined], [null], ["Ion"], [["Ion", "Maria"]], [42]])("a %j is no parents at all", (raw) => {
    expect(cardParentsFrom(raw)).toEqual({ father: null, mother: null });
  });

  it("the route's prompt asks for them by name and no longer offers them to unmappedRaw", () => {
    const route = read("src", "app", "api", "admin", "import", "extract-id-card", "route.ts");
    expect(route).toMatch(/"parents": \{/);
    expect(route).toMatch(/Never put a parent's name in unmappedRaw/);
    expect(route).not.toMatch(/e\.g\. a parent's name/);
    expect(route).toMatch(/parents: cardParentsFrom\(raw\.parents\)/);
  });
});

describe("which parents a read offers", () => {
  it("one ticked row per parent the card names, the holder's surname assumed", () => {
    expect(draftsFromCard({ father: "Ion", mother: "Maria" }, "Popescu")).toEqual([
      { kind: "FATHER", checked: true, firstName: "Ion", lastName: "Popescu", surnameAssumed: true },
      { kind: "MOTHER", checked: true, firstName: "Maria", lastName: "Popescu", surnameAssumed: true },
    ]);
  });

  it("a parent the card does not name is not offered", () => {
    expect(draftsFromCard({ father: null, mother: "Maria" }, "Popescu").map((d) => d.kind)).toEqual(["MOTHER"]);
    expect(draftsFromCard({ father: null, mother: null }, "Popescu")).toEqual([]);
  });

  it("with no holder surname there is nothing to assume", () => {
    expect(draftsFromCard({ father: "Ion", mother: null }, "  ")[0]).toMatchObject({ lastName: "", surnameAssumed: false });
  });

  it("„Adaugă nou” offers both, unticked, to type", () => {
    expect(blankDrafts("Popescu")).toEqual([
      { kind: "FATHER", checked: false, firstName: "", lastName: "Popescu", surnameAssumed: true },
      { kind: "MOTHER", checked: false, firstName: "", lastName: "Popescu", surnameAssumed: true },
    ]);
  });
});

describe("the parents' surname", () => {
  it("an assumed surname follows the holder's; one the user typed stays", () => {
    const [father, mother] = draftsFromCard({ father: "Ion", mother: "Maria" }, "Popescu");
    const typed = withSurname(mother, "Ionescu");
    expect(typed.surnameAssumed).toBe(false);
    expect(followHolderSurname([father, typed], "Popa")).toEqual([
      { ...father, lastName: "Popa", surnameAssumed: true },
      typed,
    ]);
  });

  it("an emptied surname is assumed again from the holder's", () => {
    const [father] = blankDrafts("Popescu");
    expect(followHolderSurname([withSurname(father, "")], "Popescu")[0]).toMatchObject({ lastName: "Popescu", surnameAssumed: true });
  });
});

describe("which parents are created", () => {
  const drafts = [
    { kind: "FATHER" as const, checked: true, firstName: "Ion", lastName: "Popescu", surnameAssumed: true },
    { kind: "MOTHER" as const, checked: true, firstName: " ", lastName: "Popescu", surnameAssumed: true },
  ];

  it("only a ticked parent with both names", () => {
    expect(parentsToCreate(drafts).map((d) => d.kind)).toEqual(["FATHER"]);
    expect(parentsToCreate(drafts.map((d) => ({ ...d, checked: false })))).toEqual([]);
  });

  it("a ticked parent missing a name is reported, an unticked one is not", () => {
    expect(incompleteParents(drafts).map((d) => d.kind)).toEqual(["MOTHER"]);
    expect(incompleteParents([{ ...drafts[1], checked: false }])).toEqual([]);
  });
});

describe("the parent's record", () => {
  it("the role decides the gender", () => {
    expect(parentGender("FATHER")).toBe("MALE");
    expect(parentGender("MOTHER")).toBe("FEMALE");
  });

  it("the „Note” line names the holder and its code, and the card's DOC code when there is one", () => {
    expect(parentNote({ name: "Popescu Andrei", code: "PPERS00012" })).toBe(
      "Creat din cartea de identitate a lui Popescu Andrei (PPERS00012)",
    );
    expect(parentNote({ name: "Popescu Andrei", code: "PPERS00012", documentCode: "DOC00045" })).toBe(
      "Creat din cartea de identitate DOC00045 a lui Popescu Andrei (PPERS00012)",
    );
  });

  it("is created with the new provenance, the role's gender and the note", () => {
    const [father] = draftsFromCard({ father: " Ion ", mother: null }, "Popescu");
    expect(parentPersonBody(father, "N")).toEqual({
      firstName: "Ion",
      lastName: "Popescu",
      gender: "MALE",
      notes: "N",
      provenance: "RELATIVE_ID_CARD",
    });
    expect(PROVENANCE_VALUES).toContain("RELATIVE_ID_CARD");
  });

  it("„Nume Prenume”", () => {
    expect(personName("Popescu", "Ion")).toBe("Popescu Ion");
    expect(personName(null, "Ion")).toBe("Ion");
  });
});

describe("the link: the parent holds „Tată” / „Mamă” towards the holder", () => {
  it("is posted on the HOLDER, naming the parent and the kind", () => {
    expect(parentLink("holder-1", "parent-2", "MOTHER")).toEqual({
      url: "/api/people/holder-1/parents",
      body: { parentId: "parent-2", kind: "MOTHER" },
    });
  });

  it("the server finds the role by parent_kind, never by name, and ticks the PARENT", () => {
    const src = read("src", "lib", "persons", "parent-roles.ts");
    expect(src).toMatch(/eq\(lookupPersonRole\.parentKind, kind\)/);
    expect(src).not.toMatch(/lookupPersonRole\.name/);
    // associatePersonsToPerson(person, [ticked], role): the ticked one holds the role.
    expect(src).toMatch(/associatePersonsToPerson\(holderId, \[parentId\], roleId\)/);
  });
});

describe("the migration, the reference data and the provenance list agree", () => {
  const migration = read("src", "db", "migration_095_parents_from_id_card.sql");
  const refdata = read("src", "db", "sync-reference-data.sql");

  it("the CHECK lists exactly PROVENANCE_VALUES", () => {
    const check = /CHECK \(provenance IN \(([\s\S]*?)\)\)/.exec(migration)![1];
    expect(check.match(/'([A-Z_]+)'/g)!.map((q) => q.slice(1, -1))).toEqual([...PROVENANCE_VALUES]);
  });

  it.each([
    ["Tată", "(părintele, bărbat)", 64, "FATHER"],
    ["Mamă", "(părintele, femeie)", 65, "MOTHER"],
  ])("„%s”: the same row in both files, its kind, and „Părinte”'s converse", (name, description, sort, kind) => {
    for (const src of [migration, refdata]) {
      expect(src).toContain(`'${name}', '${description}', ${sort}`);
      expect(src).toContain(`('${name}', '${kind}')`);
      expect(src).toMatch(/converse_name\s+= 'Copil',\s+converse_name_male\s+= 'Fiu',\s+converse_name_female = 'Fiică'/);
    }
  });
});

describe("the row's sentences", () => {
  const t = (key: string, v?: Record<string, string>) => `${key}${v ? JSON.stringify(v) : ""}`;
  it("one per parent, in the outcome's words", () => {
    expect(
      parentOutcomeSentences(
        [
          { kind: "FATHER", result: "created", personId: "a" },
          { kind: "MOTHER", result: "failed", error: "HTTP 500" },
        ],
        t,
      ),
    ).toEqual([
      'outcomeCreated{"who":"whoFather"}',
      'outcomeFailed{"who":"whoMother","error":"HTTP 500"}',
    ]);
    expect(parentOutcomeSentences(undefined, t)).toEqual([]);
  });
});
