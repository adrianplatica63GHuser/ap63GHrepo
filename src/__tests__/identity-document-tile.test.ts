/**
 * The identity tile's rules.                                             (Slice 40.83)
 *
 * src/lib/identity-documents/form.ts: the rows a kind's fields flow into, the paths the tile holds, the notice a
 * change of type gives, VALABIL / EXPIRAT, the CNP's error and warnings — and the form-schema's identity payload,
 * versions and dirty check. Invented values only.
 */
import {
  identityChangeNotice,
  identityCnpError,
  identityCnpWarnings,
  identityFieldRows,
  identityTilePaths,
  identityValidity,
} from "@/lib/identity-documents/form";
import { IDENTITY_KINDS, IDENTITY_KIND_VALUES } from "@/lib/identity-documents/kinds";
import { cnpControlDigit, emptyIdentityValues } from "@/lib/identity-documents/validation";
import {
  computeFieldHighlights,
  emptyFormValues,
  formValuesEqual,
  identityPayload,
  snapshotToFormValues,
  toApiPayload,
  versionLabelColor,
} from "@/app/documents/_components/form-schema";
import { documentTileRegistry, IDENTITY_TILE, FIELDS_TILE } from "@/app/documents/_components/document-tiles";
import type { DocumentSnapshot } from "@/lib/documents/validation";

const CNP = (() => {
  const first12 = "185042140012";
  return `${first12}${cnpControlDigit(first12)}`;
})();

describe("the tile's fields", () => {
  it.each([...IDENTITY_KIND_VALUES])("%s: every field once, in the card's order, in whole-unit rows", (kind) => {
    const { units, rows } = identityFieldRows(kind);
    expect(units).toBeGreaterThanOrEqual(3);
    expect(rows.flat().map((f) => f.key)).toEqual(IDENTITY_KINDS[kind].fields.map((f) => f.key));
  });

  // 40.94 (Ask first 1, 6): the kind's own rows, as written — never re-flowed — in a tile of 3 units, the least it
  // takes; the widest row (the passports' Data nașterii | Locul nașterii) fits in it.
  it.each([...IDENTITY_KIND_VALUES])("%s: the kind's rows as written, 3 units", (kind) => {
    const { units, rows } = identityFieldRows(kind);
    expect(rows.map((r) => r.map((f) => f.key))).toEqual(IDENTITY_KINDS[kind].rows.map((r) => r.map((f) => f.key)));
    expect(units).toBe(3);
  });

  it("the paths: the document's own columns where the card prints them, the rest under identity.", () => {
    // 40.94: the new card's first row is Seria și numărul | CNP, then Nume | Prenume.
    expect(identityTilePaths("CI_NOU").slice(0, 3)).toEqual(["nrDocument", "identity.cnp", "identity.lastName"]);
    expect(identityTilePaths("CI_NOU")).toContain("issuerPersonId");
    expect(identityTilePaths("CI_NOU")).toContain("dateValidUntil");
    expect(identityTilePaths("CI_VECHE")).not.toContain("dateValidUntil");
  });
});

describe("a change of type", () => {
  const held = { ...emptyIdentityValues(), lastName: "Testescu", domicileAddress: "Str. Probei 1", cardNumber: "000111" };

  it("between kinds: names what the new kind has no field for", () => {
    expect(identityChangeNotice("CI_NOU", "PASAPORT", held)).toEqual({ kind: "removes", fields: ["domicileAddress", "cardNumber"] });
    expect(identityChangeNotice("CI_NOU", "CI_VECHE", { ...emptyIdentityValues(), lastName: "Testescu" })).toBeNull();
  });

  it("to an ordinary type: refused while a value is held, silent when none is", () => {
    expect(identityChangeNotice("CI_NOU", null, held)).toEqual({ kind: "held" });
    expect(identityChangeNotice("CI_NOU", null, emptyIdentityValues())).toBeNull();
  });

  it("from an ordinary type, or to the same kind: nothing to say", () => {
    expect(identityChangeNotice(null, "PASAPORT", held)).toBeNull();
    expect(identityChangeNotice("CI_NOU", "CI_NOU", held)).toBeNull();
  });
});

describe("VALABIL / EXPIRAT", () => {
  const today = new Date(2026, 9, 26);
  it("from „Valabil până la” and today", () => {
    expect(identityValidity("2026-10-25", today, 30)).toEqual({ kind: "expired" });
    expect(identityValidity("2026-10-26", today, 30)).toEqual({ kind: "expiringSoon", days: 0 });
    expect(identityValidity("2026-11-10", today, 30)).toEqual({ kind: "expiringSoon", days: 15 });
    expect(identityValidity("2031-01-01", today, 30)).toEqual({ kind: "valid" });
  });
  it("nothing without a date", () => {
    expect(identityValidity("", today, 30)).toBeNull();
    expect(identityValidity(null, today, 30)).toBeNull();
  });
});

describe("the CNP", () => {
  it("refused without its control digit, allowed empty", () => {
    expect(identityCnpError(CNP)).toBeNull();
    expect(identityCnpError("")).toBeNull();
    expect(identityCnpError(`${CNP.slice(0, 12)}${(Number(CNP[12]) + 1) % 10}`)).toBe("identity_cnp_invalid");
  });
  it("warns when it disagrees with Sex or Data nașterii", () => {
    expect(identityCnpWarnings({ cnp: CNP, sex: "FEMALE", dateOfBirth: "1985-04-21" })).toEqual(["cnp_sex_mismatch"]);
    expect(identityCnpWarnings({ cnp: CNP, sex: "MALE", dateOfBirth: "1985-04-22" })).toEqual(["cnp_birth_date_mismatch"]);
    expect(identityCnpWarnings({ cnp: CNP, sex: "MALE", dateOfBirth: "" })).toEqual([]);
  });
});

describe("the form's identity values", () => {
  it("the payload: the kind's own fields, every other one null; none on an ordinary type", () => {
    const values = { ...emptyFormValues, identity: { ...emptyFormValues.identity, lastName: " Testescu ", cardNumber: "000111", mrz: "A\nB" } };
    expect(identityPayload(values.identity, "PASAPORT")).toMatchObject({ lastName: "Testescu", cardNumber: null, mrz: "A\nB" });
    expect(toApiPayload(values, "CI_NOU").identity).toMatchObject({ lastName: "Testescu", cardNumber: "000111" });
    expect(toApiPayload(values, null)).not.toHaveProperty("identity");
  });

  it("a version: its identity values reach the form, frame per field, and colour the label", () => {
    const base = { identity: null } as unknown as DocumentSnapshot;
    const after = { identity: { ...emptyIdentityValues(), lastName: "Testescu" } } as unknown as DocumentSnapshot;
    expect(snapshotToFormValues(after).identity.lastName).toBe("Testescu");
    expect(computeFieldHighlights(base, after)).toMatchObject({ "identity.lastName": "green" });
    expect(versionLabelColor(after, { identity: { ...emptyIdentityValues(), lastName: "Popa" } } as unknown as DocumentSnapshot)).toBe("red");
  });

  it("an identity edit makes the form dirty", () => {
    const edited = { ...emptyFormValues, identity: { ...emptyFormValues.identity, cnp: CNP } };
    expect(formValuesEqual(emptyFormValues, edited)).toBe(false);
    expect(formValuesEqual(emptyFormValues, { ...emptyFormValues })).toBe(true);
  });
});

describe("the tiles", () => {
  it("an identity type's record tile is „Act de identitate”, with no form tile and no parties", () => {
    const reg = documentTileRegistry({ typeKey: "CARTE_IDENTITATE", tabs: [], pages: true, identity: true, parties: true, ownFields: false });
    expect(reg.all).toContain(IDENTITY_TILE);
    expect(reg.all).not.toContain(FIELDS_TILE);
    expect(reg.all).not.toContain("parties");
    expect(reg.defaults).toContain(IDENTITY_TILE);
  });
});
