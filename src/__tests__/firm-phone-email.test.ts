/**
 * A firm has a phone and an e-mail of its own.                  (Slice #38.31)
 *
 * judicial_person.phone and .email (migration_096), edited on „Reprezentanți
 * și contact" above the contact persons, carried by the version snapshot, and
 * found by the list's search. The browser half is TC-PERS-09.
 */
import fs from "fs";
import path from "path";
import { isEmailShape } from "@/lib/persons/email-shape";
import { judicialPersonCreateSchema, judicialPersonUpdateSchema, type JudicialPersonSnapshot } from "@/lib/judicial-persons/validation";
import { JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS } from "@/lib/versioning/snapshot-registry";
import {
  EMAIL_SHAPE_ERROR, computeFieldHighlights, emptyFormValues, formSchema, snapshotToFormValues, toApiPayload,
} from "@/app/judicial-persons/_components/form-schema";
import { jpTileOfField } from "@/app/judicial-persons/_components/person-tiles";
import { SCREEN_ROWS } from "@/lib/ui/field-widths";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const msg = (f: string) => JSON.parse(read("messages", f));

describe("the e-mail's shape", () => {
  it.each(["", "  ", "office@firma.ro", "a.b-c@sub.domeniu.ro", " office@firma.ro "])("„%s” passes", (v) => {
    expect(isEmailShape(v)).toBe(true);
  });
  it.each(["firma-tc", "office@firma", "office firma@x.ro", "@firma.ro", "office@.ro", "0722 000 009", "a@b.ro."])("„%s” is refused", (v) => {
    expect(isEmailShape(v)).toBe(false);
  });
  it("null and undefined are no address, and fine", () => {
    expect(isEmailShape(null)).toBe(true);
    expect(isEmailShape(undefined)).toBe(true);
  });
});

describe("the form", () => {
  const base = { ...emptyFormValues, name: "TC SRL" };
  it("refuses a bad e-mail on the e-mail field, with the key the form shows in Romanian", () => {
    const r = formSchema.safeParse({ ...base, email: "firma-tc" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.join(".") === "email");
      expect(issue?.message).toBe(EMAIL_SHAPE_ERROR);
    }
    expect(formSchema.safeParse({ ...base, email: "office@firma.ro", phone: "anything at all" }).success).toBe(true);
  });
  it("sends both, trimmed, and an empty one as null", () => {
    expect(toApiPayload({ ...base, phone: " 0722 000 009 ", email: "office@firma.ro" })).toMatchObject({ phone: "0722 000 009", email: "office@firma.ro" });
    expect(toApiPayload(base)).toMatchObject({ phone: null, email: null });
  });
  it("shows the message from judicialPerson.hints in both languages", () => {
    expect(msg("ro-RO.json").judicialPerson.hints[EMAIL_SHAPE_ERROR]).toBe("Adresa de e-mail nu pare corectă — de exemplu office@firma.ro");
    expect(typeof msg("en-GB.json").judicialPerson.hints[EMAIL_SHAPE_ERROR]).toBe("string");
    expect(read("src", "app", "judicial-persons", "_components", "judicial-person-form.tsx")).toContain('error={errors.email ? t("hints.emailShape") : undefined}');
  });
  it("labels both fields in both languages", () => {
    for (const f of ["ro-RO.json", "en-GB.json"]) {
      const fields = msg(f).judicialPerson.fields;
      expect([typeof fields.phone, typeof fields.email]).toEqual(["string", "string"]);
    }
    expect(msg("ro-RO.json").judicialPerson.fields.phone).toBe("Telefon firmă");
    expect(msg("ro-RO.json").judicialPerson.fields.email).toBe("E-mail firmă");
  });
  it("puts both on „Reprezentanți și contact”, above the contact persons", () => {
    expect(SCREEN_ROWS.judicialPerson.contactPersons).toEqual([["phone"], ["email"], ["contactPerson"], ["contactPerson"]]);
    expect(jpTileOfField("phone")).toBe("contactPersons");
    expect(jpTileOfField("email")).toBe("contactPersons");
  });
});

describe("the API", () => {
  it("refuses a bad e-mail and takes a good one, on create and on update", () => {
    expect(judicialPersonCreateSchema.safeParse({ name: "TC", email: "firma-tc" }).success).toBe(false);
    expect(judicialPersonCreateSchema.safeParse({ name: "TC", email: "office@firma.ro", phone: "0722" }).success).toBe(true);
    expect(judicialPersonUpdateSchema.safeParse({ email: "firma-tc" }).success).toBe(false);
    expect(judicialPersonUpdateSchema.safeParse({ email: null, phone: null }).success).toBe(true);
  });
  it("the list's search finds a firm by its phone and its e-mail", () => {
    const q = read("src", "lib", "judicial-persons", "queries.ts");
    expect(q).toContain("ilike(judicialPerson.phone, searchPattern)");
    expect(q).toContain("ilike(judicialPerson.email, searchPattern)");
  });
  it("migration_096 adds both columns, nullable text", () => {
    const sql = read("src", "db", "migration_096_judicial_person_phone_email.sql");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS phone text,\s+ADD COLUMN IF NOT EXISTS email text;/);
  });
});

describe("the version history", () => {
  it("the snapshot carries both", () => {
    expect(JUDICIAL_PERSON_SNAPSHOT_FIELDS_KEYS).toEqual(expect.arrayContaining(["phone", "email"]));
    expect(read("src", "lib", "judicial-persons", "queries.ts")).toMatch(/phone:\s+j\?\.phone\s+\?\? null,\s+email:\s+j\?\.email\s+\?\? null,/);
  });

  const snap = (judicial: Record<string, unknown>): JudicialPersonSnapshot => ({
    notes: null,
    judicial: {
      name: "TC SRL", nickname: null, judicialPersonTypeId: null, cuiNumber: null, tradeRegisterNumber: null,
      contactPerson1Id: null, contactPerson2Id: null, correspondenceSameAsHq: false, ...judicial,
    } as JudicialPersonSnapshot["judicial"],
    addresses: { HEADQUARTERS: null, CORRESPONDENCE: null },
  });

  it("a snapshot from before migration_096 — no phone or e-mail key — reads as empty, and is no change", () => {
    const old = snap({});
    expect(snapshotToFormValues(old)).toMatchObject({ phone: "", email: "" });
    const same = snap({ phone: null, email: null });
    const h = computeFieldHighlights(old, same);
    expect([h.fields.phone, h.fields.email]).toEqual([undefined, undefined]);
  });

  it("the version that adds them marks both", () => {
    const h = computeFieldHighlights(snap({ phone: null, email: null }), snap({ phone: "0722", email: "office@firma.ro" }));
    expect([h.fields.phone, h.fields.email]).toEqual(["green", "green"]);
  });
});
