/**
 * „Decedat" and „Data decesului" — the rules, the age, the form, the tree's time, the backfill.   (Slice #39.30)
 *
 * Adrian, 2026-10-13: „it is very awkward if a dead person's age on screen counts up to today … make it behave like
 * in real life … propagate this change to all the inheritance tree functionality".
 */
import { DEATH_PROBLEM_TEXT, DeathRefusedError, checkedDeath, deathProblem, localIsoDate, normaliseDeath } from "@/lib/persons/death";
import { ageOnDate, personAge, personAgeText, personAgeYears } from "@/lib/persons/person-age";
import { emptyFormValues, formSchema, fromApiPayload, toApiPayload } from "@/app/natural-persons/_components/form-schema";
import { bornAfter, diedBy } from "@/lib/inheritance/documents";
import { deathDate, lifeYears, type TreePerson } from "@/lib/inheritance/layout";
import { deathFromNotes, mergeSources, planBackfill } from "../../scripts/backfill-deceased/plan";

const TODAY = new Date(2026, 9, 13, 12, 0, 0); // 13.10.2026, local

describe("the rules (src/lib/persons/death.ts)", () => {
  it("a date only on a person marked dead, never before the birth, never in the future", () => {
    expect(deathProblem({ isDeceased: true, dateOfDeath: "1998-03-12", dateOfBirth: "1921-05-01" }, TODAY)).toBeNull();
    expect(deathProblem({ isDeceased: true, dateOfDeath: null, dateOfBirth: "1921-05-01" }, TODAY)).toBeNull(); // dead, date unknown
    expect(deathProblem({ isDeceased: false, dateOfDeath: null }, TODAY)).toBeNull();
    expect(deathProblem({ isDeceased: false, dateOfDeath: "1998-03-12" }, TODAY)).toBe("DEATH_WITHOUT_DECEASED");
    expect(deathProblem({ isDeceased: true, dateOfDeath: "1920-01-01", dateOfBirth: "1921-05-01" }, TODAY)).toBe("DEATH_BEFORE_BIRTH");
    expect(deathProblem({ isDeceased: true, dateOfDeath: "2026-10-14" }, TODAY)).toBe("DEATH_IN_FUTURE");
    expect(deathProblem({ isDeceased: true, dateOfDeath: "2026-10-13" }, TODAY)).toBeNull(); // today is not the future
    expect(deathProblem({ isDeceased: true, dateOfDeath: "1921-05-01", dateOfBirth: "1921-05-01" }, TODAY)).toBeNull();
  });

  it("today is the local calendar day, not UTC's", () => {
    expect(localIsoDate(new Date(2026, 0, 2, 0, 30))).toBe("2026-01-02");
  });

  it("unticking clears the date; a refusal is thrown with its code and its Romanian sentence", () => {
    expect(normaliseDeath({ isDeceased: false, dateOfDeath: "1998-03-12" })).toEqual({ isDeceased: false, dateOfDeath: null });
    expect(checkedDeath({ isDeceased: false, dateOfDeath: "1998-03-12" }, TODAY)).toEqual({ isDeceased: false, dateOfDeath: null });
    let caught: unknown;
    try {
      checkedDeath({ isDeceased: true, dateOfDeath: "2030-01-01" }, TODAY);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DeathRefusedError);
    expect((caught as DeathRefusedError).code).toBe("DEATH_IN_FUTURE");
    expect((caught as DeathRefusedError).message).toBe(DEATH_PROBLEM_TEXT.DEATH_IN_FUTURE);
    expect(DEATH_PROBLEM_TEXT.DEATH_BEFORE_BIRTH).toMatch(/nu poate fi înainte de „Data nașterii”/);
  });
});

describe("the age stops at death (src/lib/persons/person-age.ts)", () => {
  it("a living person's counted to today; a dead person's at the date of death, marked „†”; dead with no date, none", () => {
    expect(personAge({ dateOfBirth: "1950-06-15" }, TODAY)).toEqual({ kind: "alive", years: 76 });
    expect(personAge({ dateOfBirth: "1921-05-01", isDeceased: true, dateOfDeath: "1998-04-30" }, TODAY)).toEqual({ kind: "dead", years: 76 });
    expect(personAge({ dateOfBirth: "1921-05-01", isDeceased: true, dateOfDeath: "1998-05-01" }, TODAY)).toEqual({ kind: "dead", years: 77 });
    expect(personAge({ dateOfBirth: "1921-05-01", isDeceased: true, dateOfDeath: null }, TODAY)).toEqual({ kind: "deadUndated" });
    expect(personAge({ dateOfBirth: null }, TODAY)).toBeNull();
    expect(ageOnDate("2000-02-29", "2001-02-28")).toBe(0);
  });

  it("shown as „76”, „76 †” or „Decedat”, and a sort by age compares the number shown", () => {
    expect(personAgeText({ dateOfBirth: "1950-06-15" }, "Decedat", TODAY)).toBe("76");
    expect(personAgeText({ dateOfBirth: "1921-05-01", isDeceased: true, dateOfDeath: "1998-04-30" }, "Decedat", TODAY)).toBe("76 †");
    expect(personAgeText({ dateOfBirth: "1921-05-01", isDeceased: true }, "Decedat", TODAY)).toBe("Decedat");
    expect(personAgeText({ dateOfBirth: null }, "Decedat", TODAY)).toBeNull();
    expect(personAgeYears({ dateOfBirth: "1921-05-01", isDeceased: true, dateOfDeath: "1998-04-30" }, TODAY)).toBe(76);
    expect(personAgeYears({ dateOfBirth: "1921-05-01", isDeceased: true }, TODAY)).toBeNull();
  });
});

describe("the form (natural-persons/_components/form-schema.ts)", () => {
  const base = { ...emptyFormValues, lastName: "Test", dateOfBirth: "1921-05-01" };

  it("„Decedat” is off by default, and unticking sends no date", () => {
    expect(emptyFormValues.isDeceased).toBe(false);
    expect(toApiPayload({ ...base, isDeceased: false, dateOfDeath: "1998-03-12" })).toMatchObject({ isDeceased: false, dateOfDeath: null });
    expect(toApiPayload({ ...base, isDeceased: true, dateOfDeath: "1998-03-12" })).toMatchObject({ isDeceased: true, dateOfDeath: "1998-03-12" });
    expect(toApiPayload({ ...base, isDeceased: true, dateOfDeath: "" })).toMatchObject({ isDeceased: true, dateOfDeath: null });
  });

  it("refuses a date before the birth or in the future, on „Data decesului”, in the API's words", () => {
    const before = formSchema.safeParse({ ...base, isDeceased: true, dateOfDeath: "1900-01-01" });
    expect(before.success).toBe(false);
    expect(before.error!.issues.find((i) => i.path.join(".") === "dateOfDeath")?.message).toBe(DEATH_PROBLEM_TEXT.DEATH_BEFORE_BIRTH);
    const future = formSchema.safeParse({ ...base, isDeceased: true, dateOfDeath: "2999-01-01" });
    expect(future.error!.issues.find((i) => i.path.join(".") === "dateOfDeath")?.message).toBe(DEATH_PROBLEM_TEXT.DEATH_IN_FUTURE);
    expect(formSchema.safeParse({ ...base, isDeceased: true, dateOfDeath: "1998-03-12" }).success).toBe(true);
    // A stale date under an unticked box is not an error: it is not sent.
    expect(formSchema.safeParse({ ...base, isDeceased: false, dateOfDeath: "2999-01-01" }).success).toBe(true);
  });

  it("a record — or a version from before migration_108 — loads as alive when it says nothing", () => {
    const row = { natural: { lastName: "X" } as never, addresses: [], notes: null };
    expect(fromApiPayload(row)).toMatchObject({ isDeceased: false, dateOfDeath: "" });
  });
});

describe("the inheritance tree's time (#39.13, #39.30)", () => {
  const p = (dob: string | null, isDeceased = false, dateOfDeath: string | null = null): TreePerson => ({
    id: "x", displayName: "X", firstName: "X", lastName: null, nickname: null, gender: null, dateOfBirth: dob, isDeceased, dateOfDeath,
  });

  it("dead by a year: died in it or before; today, everyone marked dead; an unknown date never guessed", () => {
    expect(diedBy(p("1921-05-01", true, "1998-03-12"), 1998)).toBe(true);
    expect(diedBy(p("1921-05-01", true, "1998-03-12"), 1997)).toBe(false);
    expect(diedBy(p("1921-05-01", true, "1998-03-12"), null)).toBe(true);
    expect(diedBy(p("1921-05-01", true, null), null)).toBe(true);
    expect(diedBy(p("1921-05-01", true, null), 2000)).toBe(false);
    expect(diedBy(p("1921-05-01"), null)).toBe(false);
    // The slider still fades the not-yet-born.
    expect(bornAfter(p("1921-05-01"), 1920)).toBe(true);
  });

  it("„1921–1998” under a dead person's name; „1921–?” with the date unknown; nothing for the living", () => {
    expect(lifeYears(p("1921-05-01", true, "1998-03-12"))).toBe("1921–1998");
    expect(lifeYears(p("1921-05-01", true, null))).toBe("1921–?");
    expect(lifeYears(p(null, true, "1998-03-12"))).toBe("?–1998");
    expect(lifeYears(p("1921-05-01"))).toBeNull();
    expect(deathDate(p("1921-05-01", true, "1998-03-12"))).toBe("12.03.1998");
    expect(deathDate(p("1921-05-01", false, "1998-03-12"))).toBeNull();
  });
});

describe("the backfill (scripts/backfill-deceased/plan.ts)", () => {
  const row = (personId: string, extra: Partial<{ isDeceased: boolean; dateOfDeath: string | null; dateOfBirth: string | null }> = {}) => ({
    personId, code: `PPERS${personId}`, isDeceased: false, dateOfDeath: null, dateOfBirth: "1921-05-01", ...extra,
  });

  it("reads the date the big seed wrote into the notes", () => {
    expect(deathFromNotes("Pensionar. Data decesului: 12.03.1998. (date de test)")).toBe("1998-03-12");
    expect(deathFromNotes("nimic")).toBeNull();
  });

  it("ticks and dates when the sources agree; ticks without a date when they do not, or when the date is refused", () => {
    const rows = [row("1"), row("2"), row("3"), row("4", { isDeceased: true, dateOfDeath: "1990-01-01" }), row("5")];
    const said = [
      { personId: "1", date: "1998-03-12", from: "notele seed-ului" },
      { personId: "1", date: "1998-03-12", from: "certificatul 55/2018" },
      { personId: "2", date: "1998-03-12", from: "certificatul 1" },
      { personId: "2", date: "1999-01-01", from: "certificatul 2" },
      { personId: "3", date: "1900-01-01", from: "certificatul 3" },
      { personId: "4", date: "1998-03-12", from: "certificatul 4" },
      { personId: "5", date: "2999-01-01", from: "certificatul 5" },
      { personId: "9", date: "1998-03-12", from: "certificatul 9" }, // a company, or a person gone: no row
    ];
    const { changes, skipped } = planBackfill(mergeSources(rows, said), TODAY);
    expect(changes.map((c) => [c.code, c.dateOfDeath])).toEqual([
      ["PPERS1", "1998-03-12"],
      ["PPERS2", null],
      ["PPERS3", null],
      ["PPERS5", null],
    ]);
    expect(changes[1].why).toMatch(/date diferite/);
    expect(changes[2].why).toMatch(/DEATH_BEFORE_BIRTH/);
    expect(changes[3].why).toMatch(/DEATH_IN_FUTURE/);
    // A person already marked dead is left exactly as they are — even with another date.
    expect(skipped.map((s) => s.code)).toEqual(["PPERS4"]);
  });

  it("a second run changes nothing", () => {
    const said = [{ personId: "1", date: "1998-03-12", from: "certificatul 55/2018" }];
    const after = [row("1", { isDeceased: true, dateOfDeath: "1998-03-12" })];
    expect(planBackfill(mergeSources(after, said), TODAY).changes).toEqual([]);
  });
});
