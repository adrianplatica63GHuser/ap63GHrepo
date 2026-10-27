/**
 * The one module that validates an identity document's values.          (Slice 40.82)
 *
 * A write that sets a field its kind does not have is refused with a named code; a CNP is 13 digits with a valid
 * checksum, or empty; dates are ISO dates; sex is MALE or FEMALE. A CNP that disagrees with the same document's sex
 * or date of birth is a warning, never a refusal. Every CNP below is invented, built to pass the checksum.
 */
import {
  IDENTITY_CNP_INVALID_CODE,
  IDENTITY_DATE_INVALID_CODE,
  IDENTITY_FIELD_NOT_IN_KIND_CODE,
  IDENTITY_SEX_INVALID_CODE,
  checkIdentityWrite,
  cnpControlDigit,
  cnpDateOfBirth,
  cnpSex,
  emptyIdentityValues,
  identityHoldsValues,
  identityInputSchema,
  identitySnapshotsEqual,
  identityWarnings,
  isIsoDate,
  isValidCnp,
  valuesOutsideKind,
} from "@/lib/identity-documents/validation";

/** An invented CNP for this sex digit and birth date, with its control digit. */
const cnp = (s: number, yymmdd: string, serial = "40001") => {
  const first12 = `${s}${yymmdd}${serial}`;
  return `${first12}${cnpControlDigit(first12)}`;
};

describe("the CNP", () => {
  it("passes 13 digits whose last is the control digit", () => {
    expect(isValidCnp(cnp(1, "850421"))).toBe(true);
    expect(isValidCnp(cnp(2, "901114"))).toBe(true);
    // weights 279146358279, mod 11, 10 → 1
    expect(isValidCnp("1850421400123")).toBe(true);
  });

  it("refuses a wrong control digit, a wrong length, a letter", () => {
    const good = cnp(1, "850421");
    const bad = good.slice(0, 12) + String((Number(good[12]) + 1) % 10);
    expect(isValidCnp(bad)).toBe(false);
    expect(isValidCnp(good.slice(0, 12))).toBe(false);
    expect(isValidCnp(`${good}0`)).toBe(false);
    expect(isValidCnp(`A${good.slice(1)}`)).toBe(false);
  });

  it("reads the sex and the date of birth it encodes", () => {
    expect(cnpSex(cnp(1, "850421"))).toBe("MALE");
    expect(cnpSex(cnp(6, "050101"))).toBe("FEMALE");
    expect(cnpSex(cnp(9, "850421"))).toBeNull();
    expect(cnpDateOfBirth(cnp(1, "850421"))).toBe("1985-04-21");
    expect(cnpDateOfBirth(cnp(5, "050101"))).toBe("2005-01-01");
    expect(cnpDateOfBirth(cnp(3, "991231"))).toBe("1899-12-31");
    expect(cnpDateOfBirth(cnp(7, "850421"))).toBeNull();
    expect(cnpDateOfBirth(cnp(1, "850231"))).toBeNull();
  });
});

describe("checkIdentityWrite", () => {
  it("accepts a kind's own fields, trimmed, an empty string read as null", () => {
    const out = checkIdentityWrite("CI_NOU", { lastName: "  Popescu ", firstName: "", cnp: cnp(1, "850421"), sex: "MALE" });
    expect(out).toEqual({ ok: true, values: { lastName: "Popescu", firstName: null, cnp: cnp(1, "850421"), sex: "MALE" } });
  });

  it("names only the keys the input names, so a PATCH leaves the others alone", () => {
    const out = checkIdentityWrite("PASAPORT", { domicileCounty: "Ilfov" });
    expect(out.ok && Object.keys(out.values)).toEqual(["domicileCounty"]);
  });

  it("keeps an MRZ's lines, each trimmed", () => {
    const out = checkIdentityWrite("CI_NOU", { mrz: "  IDROUPOPESCU<<ION<<<  \r\n\n  RT1234567<ROU  " });
    expect(out.ok && out.values.mrz).toBe("IDROUPOPESCU<<ION<<<\nRT1234567<ROU");
  });

  it("refuses a value on a field the kind does not have, naming the fields", () => {
    expect(checkIdentityWrite("CI_VECHE", { cnp: cnp(1, "850421"), mrz: "X" })).toEqual({
      ok: false, code: IDENTITY_FIELD_NOT_IN_KIND_CODE, fields: ["cnp", "mrz"],
    });
    expect(checkIdentityWrite("PASAPORT", { domicileCountry: "Spania" })).toEqual({
      ok: false, code: IDENTITY_FIELD_NOT_IN_KIND_CODE, fields: ["domicileCountry"],
    });
    expect(checkIdentityWrite("CI_NOU", { dateOfBirth: "1985-04-21" })).toEqual({
      ok: false, code: IDENTITY_FIELD_NOT_IN_KIND_CODE, fields: ["dateOfBirth"],
    });
  });

  it("allows null on a field the kind does not have — it sets nothing", () => {
    expect(checkIdentityWrite("CI_VECHE", { cnp: null, mrz: "" }).ok).toBe(true);
  });

  it("refuses a CNP without a valid checksum, a malformed date, a sex that is not MALE or FEMALE", () => {
    expect(checkIdentityWrite("CI_NOU", { cnp: "1234567890123" })).toEqual({ ok: false, code: IDENTITY_CNP_INVALID_CODE, fields: ["cnp"] });
    expect(checkIdentityWrite("CI_NOU", { cnp: "12345" })).toEqual({ ok: false, code: IDENTITY_CNP_INVALID_CODE, fields: ["cnp"] });
    expect(checkIdentityWrite("PASAPORT", { dateOfBirth: "21.04.1985" })).toEqual({ ok: false, code: IDENTITY_DATE_INVALID_CODE, fields: ["dateOfBirth"] });
    expect(checkIdentityWrite("PASAPORT", { dateOfBirth: "1985-02-30" })).toEqual({ ok: false, code: IDENTITY_DATE_INVALID_CODE, fields: ["dateOfBirth"] });
    expect(checkIdentityWrite("CI_NOU", { sex: "M" })).toEqual({ ok: false, code: IDENTITY_SEX_INVALID_CODE, fields: ["sex"] });
  });
});

describe("the input block", () => {
  it("takes the table's fields and nothing else", () => {
    expect(identityInputSchema.safeParse({ lastName: "Popescu", cnp: null }).success).toBe(true);
    expect(identityInputSchema.safeParse({ nrDocument: "RT 123456" }).success).toBe(false);
    expect(identityInputSchema.safeParse({ lastName: 3 }).success).toBe(false);
  });
});

describe("warnings, never refusals", () => {
  it("a CNP that disagrees with the sex or the date of birth printed beside it", () => {
    const values = { ...emptyIdentityValues(), cnp: cnp(1, "850421"), sex: "FEMALE" as const, dateOfBirth: "1985-04-22" };
    expect(identityWarnings(values).map((w) => w.code)).toEqual(["cnp_sex_mismatch", "cnp_birth_date_mismatch"]);
    expect(identityWarnings({ ...values, sex: "MALE", dateOfBirth: "1985-04-21" })).toEqual([]);
    expect(identityWarnings({ ...values, cnp: null })).toEqual([]);
  });
});

describe("change of kind, holding values, snapshots", () => {
  it("names the values a kind has no field for", () => {
    const v = { ...emptyIdentityValues(), lastName: "Popa", cnp: cnp(1, "850421"), mrz: "X", fatherFirstName: "Ion" };
    expect(valuesOutsideKind("CI_VECHE", v)).toEqual(["cnp", "mrz"]);
    expect(valuesOutsideKind("CI_NOU", v)).toEqual(["fatherFirstName"]);
  });

  it("an empty row holds nothing", () => {
    expect(identityHoldsValues(emptyIdentityValues())).toBe(false);
    expect(identityHoldsValues(null)).toBe(false);
    expect(identityHoldsValues({ ...emptyIdentityValues(), civilStatus: "căsătorit" })).toBe(true);
  });

  it("a snapshot from before 40.82 (no block) equals an empty one, and differs from one holding a value", () => {
    expect(identitySnapshotsEqual(undefined, emptyIdentityValues())).toBe(true);
    expect(identitySnapshotsEqual(null, null)).toBe(true);
    expect(identitySnapshotsEqual(null, { ...emptyIdentityValues(), lastName: "Popa" })).toBe(false);
  });

  it("isIsoDate is a calendar date, not a shape", () => {
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2023-02-29")).toBe(false);
    expect(isIsoDate("2024-2-9")).toBe(false);
  });
});
