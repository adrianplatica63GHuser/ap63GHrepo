/**
 * What the property step says WILL happen, before anything does.  (Slice #26.07)
 *
 * `planForMatches` is the whole of that decision and it is pure, which is the
 * reason it is a function at all: inside the route it would sit behind a
 * database round trip, and its wrong cells are not crashes — they are a user
 * ticking a box that promises one thing and produces another.
 *
 * The `ambiguous` row is the one to read twice. Two Properties for one parcel
 * is a state this archive genuinely holds, because until this slice the import
 * created them: the create path's own comment admitted it had "nothing to
 * deduplicate against". The plan refuses that folder rather than choosing, and
 * these tests are what stop a later simplification turning `matches[0]` into an
 * answer.
 */

import {
  planForMatches,
  type CadastralMatch,
} from "@/lib/properties/import-property-plan";

function match(code: string, cornerCount = 0): CadastralMatch {
  return {
    id: `id-${code}`,
    code,
    nickname: null,
    principalObjectId: `po-${code}`,
    tarlaSola: "47/2",
    parcela: "225/3",
    cornerCount,
  };
}

const FOLDER = {
  folderName: "47per2-225per3",
  tarlaSola: "47per2",
  parcela: "225per3",
  offeredCornerCount: 0,
};

describe("planForMatches", () => {
  it("creates when nothing matches", () => {
    // ⚠️ `offeredCornerCount: 6`, not the fixture's 0. With 0 the assertions
    // below are true of any implementation — measured, making the create branch
    // return `cornersToAdd: folder.offeredCornerCount` left the whole suite
    // green. `cornersToAdd` means "will be added to an EXISTING property"; on a
    // create the corners travel inside the create itself, and reporting them
    // here would put a second confirmation on a card that needs none.
    const plan = planForMatches({ ...FOLDER, offeredCornerCount: 6 }, []);
    expect(plan.action).toBe("create");
    expect(plan.cornersToAdd).toBe(0);
    expect(plan.cornersKept).toBe(0);
    expect(plan.offeredCornerCount).toBe(6);
  });

  it("reports the identifiers as they will be WRITTEN, not as the folder spells them", () => {
    // `47per2` on the folder and `47/2` in the field is the one difference the
    // user has to be able to see before agreeing to it.
    const plan = planForMatches(FOLDER, []);
    expect(plan.tarlaSola).toBe("47/2");
    expect(plan.parcela).toBe("225/3");
    expect(plan.folderName).toBe("47per2-225per3");
  });

  it("links when exactly one matches", () => {
    const plan = planForMatches(FOLDER, [match("PROP-00007")]);
    expect(plan.action).toBe("link");
    expect(plan.matches).toHaveLength(1);
  });

  it("offers corners only when the match has none of its own", () => {
    const plan = planForMatches({ ...FOLDER, offeredCornerCount: 6 }, [match("PROP-00007", 0)]);
    expect(plan.action).toBe("link");
    expect(plan.cornersToAdd).toBe(6);
    expect(plan.cornersKept).toBe(0);
  });

  it("keeps existing corners and offers nothing, however many the file holds", () => {
    // The brief asks for the add-to-an-empty-property case and no other.
    // Replacing discards hand-fixed corner order, and this plan must never be
    // the thing that proposes it.
    const plan = planForMatches({ ...FOLDER, offeredCornerCount: 6 }, [match("PROP-00007", 4)]);
    expect(plan.cornersToAdd).toBe(0);
    expect(plan.cornersKept).toBe(4);
    expect(plan.offeredCornerCount).toBe(6);
  });

  it("offers nothing when the folder has no corners to give", () => {
    const plan = planForMatches({ ...FOLDER, offeredCornerCount: 0 }, [match("PROP-00007", 0)]);
    expect(plan.cornersToAdd).toBe(0);
    expect(plan.cornersKept).toBe(0);
  });

  it("refuses outright when two Properties carry one parcel", () => {
    const plan = planForMatches({ ...FOLDER, offeredCornerCount: 6 }, [
      match("PROP-00007", 0),
      match("PROP-00019", 4),
    ]);
    expect(plan.action).toBe("ambiguous");
    // Neither corner promise is made, because neither Property has been chosen.
    expect(plan.cornersToAdd).toBe(0);
    expect(plan.cornersKept).toBe(0);
    // …and both are named, so the user knows which two to reconcile.
    expect(plan.matches.map((m) => m.code)).toEqual(["PROP-00007", "PROP-00019"]);
  });
});
