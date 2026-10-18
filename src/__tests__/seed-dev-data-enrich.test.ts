/**
 * What the big seed writes since #39.81 (scripts/seed-dev-data-big/enrich.ts, professions.ts) — its own tarlas, the
 * professions and „Relația cu firma", the institutions as issuers, the persons', companies' and documents' other
 * fields. Pure, like the rest of the seed's suite (seed-dev-data-big.test.ts); seed.ts writes
 * what these plan, and the runner's `seed-rehearsal` reads it back from a database.
 */
import fs from "fs";
import path from "path";
import { generateFamilies, TODAY } from "../../scripts/seed-dev-data-big/families";
import { naturalDetails } from "../../scripts/seed-dev-data-big/persons";
import { generateCompanies } from "../../scripts/seed-dev-data-big/companies";
import { generateProperties, TPC, type TypeFlags } from "../../scripts/seed-dev-data-big/properties";
import { generateDocuments } from "../../scripts/seed-dev-data-big/documents";
import { centroid, overlaps, pointInPolygon } from "../../scripts/seed-dev-data-big/geometry";
import { makeRng } from "../../scripts/seed-dev-data-big/rng";
import { ageAt } from "../../scripts/seed-dev-data-big/dates";
import { PROFESSIONS, professionOf } from "../../scripts/seed-dev-data-big/professions";
import {
  assignTarlas,
  companyTypeName,
  documentExtras,
  EXTRA_PARCELS,
  idCardMrz,
  INSTITUTIONS,
  judicialExtras,
  mrzCheck,
  naturalExtras,
  propertyExtras,
  PUBLIC_BODY_TYPES,
  RELATIONSHIPS,
  relationshipsOf,
  streetViewLine,
  tarlaCodes,
  tarlaParcelLabel,
} from "../../scripts/seed-dev-data-big/enrich";

const SEED = 2026;
const plan = generateFamilies(SEED);
const details = naturalDetails(plan, makeRng(7), new Set());
const companies = generateCompanies(makeRng(9), plan, details, new Set());
const flags = new Map<string, TypeFlags>([
  [TPC, { tarla: true, address: true }], ["Teren extravilan", { tarla: true, address: false }],
  ["Casă", { tarla: false, address: true }], ["Teren construit", { tarla: false, address: true }], ["Apartament", { tarla: false, address: true }],
]);
// as seed.ts plans them: one placeholder tarla code, then the seed's own tarlas by where each lot stands
const props = generateProperties(makeRng(11), { plan, companies, existing: [], takenNumbers: new Set(), tarlas: ["T"], flags, names: new Map() });
const tarlas = assignTarlas(makeRng(12), props, flags, (n) => tarlaCodes(n, (c) => c === "T203"));
const forms = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "db", "document-type-forms.json"), "utf8")).forms as Record<string, { key: string; type: string; options: { value: string }[] | null }[]>;
const optionsOf = (k: string) => Object.fromEntries(forms[k].filter((f) => f.type === "select").map((f) => [f.key, (f.options ?? []).map((o) => o.value)]));
const docs = generateDocuments(makeRng(13), { plan, details, companies, properties: props, contractForm: optionsOf("CONTRACT_VANZARE"), actForm: optionsOf("ACT_ADITIONAL") });
const persons = new Map(plan.persons.map((p) => [p.key, p]));

describe("the seed's own tarlas", () => {
  it("codes from T201 on, skipping one the locality already has", () => {
    expect(tarlaCodes(4, (c) => c === "T202")).toEqual(["T201", "T203", "T204", "T205"]);
  });

  it("every lot of a type that shows a tarla is on one of them, and no other lot is", () => {
    const codes = new Set(tarlas.map((t) => t.code));
    expect(tarlas.length).toBeGreaterThanOrEqual(5);
    expect(codes.has("T203")).toBe(false);
    for (const p of props) {
      if (flags.get(p.type)!.tarla) expect(codes.has(p.tarla!)).toBe(true);
      else expect([p.tarla, p.parcela]).toEqual([null, null]);
    }
  });

  it("parcels numbered 1, 2, … on each tarla, its lots' and a few more nobody in the seed owns", () => {
    for (const t of tarlas) {
      expect(t.parcels.map((p) => p.parcela)).toEqual(t.parcels.map((_, i) => String(i + 1)));
      expect(t.parcels.filter((p) => p.property === null)).toHaveLength(EXTRA_PARCELS);
      for (const x of t.parcels.filter((p) => p.property)) {
        const lot = props.find((p) => p.key === x.property)!;
        expect([lot.tarla, lot.parcela, lot.surface]).toEqual([t.code, x.parcela, x.areaSqm]);
      }
    }
    // at least one parcel whose use is no category, so the plan keeps it as printed
    expect(tarlas.some((t) => t.parcels.some((p) => p.use === "Drum de exploatare"))).toBe(true);
  });

  it("a cluster stays on one tarla, its lots on consecutive parcels", () => {
    const clusters = new Map<number, typeof props>();
    for (const p of props) if (p.cluster && p.tarla) clusters.set(p.cluster.id, [...(clusters.get(p.cluster.id) ?? []), p]);
    for (const lots of clusters.values()) {
      expect(new Set(lots.map((p) => p.tarla)).size).toBe(1);
      const nrs = lots.sort((a, b) => a.cluster!.index - b.cluster!.index).map((p) => Number(p.parcela));
      expect(nrs).toEqual(nrs.map((_, i) => nrs[0] + i));
    }
  });

  it("every drawn lot stands inside its tarla's outline", () => {
    for (const p of props.filter((q) => q.corners && q.tarla)) {
      const t = tarlas.find((x) => x.code === p.tarla)!;
      expect(pointInPolygon(centroid(p.corners!), t.outline)).toBe(true);
    }
  });

  it("the outlines hardly ever cross — each tarla the hull of the lots in one square", () => {
    let crossing = 0;
    for (let i = 0; i < tarlas.length; i++) for (let j = i + 1; j < tarlas.length; j++) if (overlaps(tarlas[i].outline, tarlas[j].outline)) crossing++;
    expect(crossing).toBeLessThanOrEqual(3);
  });

  it("a nickname that named the placeholder now names the lot's tarla and parcel, and every nickname is unique", () => {
    expect(props.filter((p) => /(?<![\p{L}\p{N}])T P\d/u.test(p.nickname))).toEqual([]);
    expect(new Set(props.map((p) => p.nickname)).size).toBe(props.length);
    const named = props.filter((p) => p.tarla && p.nickname.includes(tarlaParcelLabel(p.tarla, p.parcela)!));
    expect(named.length).toBeGreaterThan(0);
  });

  it("each tarla has a description, notes marked as test data, and a plan's number and date", () => {
    for (const t of tarlas) {
      expect(t.descriere).toMatch(/^Sola din \S+ orașului Bragadiru$/);
      expect(t.notes).toContain("(date de test)");
      expect(t.planDate >= "1992-01-01" && t.planDate <= "2004-12-31").toBe(true);
      expect(t.planNr).toMatch(/^\d+$/);
    }
  });
});

describe("professions and „Relația cu firma”", () => {
  it("a child has none; an adult the occupation's, or „Persoană privată”", () => {
    expect(professionOf({ dob: "2015-01-01", dod: null }, null)).toBeNull();
    expect(professionOf({ dob: "1970-01-01", dod: null }, "notar public")).toBe("Notar");
    expect(professionOf({ dob: "1970-01-01", dod: null }, "expert cadastral autorizat")).toBe("Topograf / expert cadastral");
    expect(professionOf({ dob: "1930-01-01", dod: "1990-01-01" }, "agricultor în Bragadiru")).toBe("Fermier / arendaș");
    expect(professionOf({ dob: "1970-01-01", dod: null }, "medic de familie în Bragadiru")).toBe("Persoană privată");
    expect(professionOf({ dob: "1970-01-01", dod: null }, null)).toBe("Persoană privată");
  });

  it("never „Expert” — the value migration_114 renamed", () => {
    expect(PROFESSIONS).not.toContain("Expert" as never);
    expect(details.some((d) => (d.personType as string) === "Expert")).toBe(false);
  });

  it("twelve of the thirteen professions are held, and every adult holds one", () => {
    expect(new Set(details.map((d) => d.personType).filter(Boolean)).size).toBeGreaterThanOrEqual(12);
    for (const d of details) {
      const p = persons.get(d.key)!;
      expect(d.personType === null).toBe(ageAt(p.dob, p.dod ?? TODAY) < 18);
    }
  });

  it("every relationship is used, and most adults hold one that their documents or lots make true", () => {
    const rels = relationshipsOf(makeRng(5), plan, new Map(details.map((d) => [d.key, d.personType])), props, docs);
    expect(new Set([...rels.values()].flat())).toEqual(new Set(RELATIONSHIPS));
    const adults = plan.persons.filter((p) => ageAt(p.dob, p.dod ?? TODAY) >= 18);
    expect(adults.filter((p) => (rels.get(p.key) ?? []).length > 0).length / adults.length).toBeGreaterThanOrEqual(0.6);
    // a seller of land sold land
    for (const [k, list] of rels) {
      if (!list.includes("Vânzător de teren")) continue;
      expect(docs.some((d) => d.parties.some((x) => x.key === k && x.role === "Vânzător"))).toBe(true);
    }
  });
});

describe("a natural person's other fields", () => {
  const extras = naturalExtras(makeRng(3), plan, details);

  it("the MRZ check digit is ICAO 9303's — the specimen's own figures", () => {
    expect(mrzCheck("L898902C3")).toBe("6");
    expect(mrzCheck("740812")).toBe("2");
    expect(mrzCheck("120415")).toBe("9");
  });

  it("an identity card's MRZ: two lines of 36, IDROU and the names, the number, the dates, each with its check digit", () => {
    const mrz = idCardMrz({ lastName: "Ștefănescu", firstName: "Ana-Maria", number: "IF123456", cnp: "2850315460012", dob: "1985-03-15", sex: "FEMALE", until: "2031-03-15" });
    const [a, b] = mrz.split("\n");
    expect([a.length, b.length]).toEqual([36, 36]);
    expect(a.startsWith("IDROUSTEFANESCU<<ANA<MARIA<")).toBe(true);
    expect(b.slice(0, 10)).toBe(`IF123456<${mrzCheck("IF123456<")}`);
    expect(b.slice(10, 13)).toBe("ROU");
    expect(b.slice(13, 20)).toBe(`850315${mrzCheck("850315")}`);
    expect(b[20]).toBe("F");
    expect(b.slice(28, 35)).toBe("2460012");
  });

  it("every identity card has its MRZ; a passport only on a child with none", () => {
    for (const d of details) {
      const x = extras.get(d.key)!;
      expect(!!x.idMrzRaw).toBe(!!d.idCard);
      if (x.passport) {
        const p = persons.get(d.key)!;
        expect(d.idCard).toBeNull();
        expect(ageAt(p.dob, TODAY)).toBeLessThan(14);
        expect(x.passport.from >= p.dob && x.passport.until > TODAY).toBe(true);
      }
    }
    expect([...extras.values()].filter((x) => x.passport).length).toBeGreaterThanOrEqual(3);
  });

  it("„same as home” and a correspondence address never together; both, and the post box, only for a living adult", () => {
    for (const d of details) {
      const x = extras.get(d.key)!;
      const p = persons.get(d.key)!;
      expect(x.sameAsHome && !!x.correspondence).toBe(false);
      if (x.sameAsHome || x.correspondence || x.postal) expect(!p.dod && ageAt(p.dob, TODAY) >= 18).toBe(true);
    }
  });

  it("each field on its share: second phones, work phones and e-mails, card numbers", () => {
    const v = [...extras.values()];
    const n = (f: (x: (typeof v)[number]) => unknown) => v.filter(f).length;
    expect(n((x) => x.personalPhone2)).toBeGreaterThan(50);
    expect(n((x) => x.workPhone)).toBeGreaterThan(50);
    expect(n((x) => x.workEmail)).toBeGreaterThan(20);
    expect(n((x) => x.personalEmail2)).toBeGreaterThan(20);
    expect(n((x) => x.idCardNumber)).toBeGreaterThanOrEqual(10);
    expect(n((x) => x.correspondence)).toBeGreaterThanOrEqual(10);
    expect(n((x) => x.homeNotes)).toBeGreaterThanOrEqual(10);
  });
});

describe("companies, institutions and issuers", () => {
  it("a company's correspondence address exactly when it is not the headquarters'", () => {
    for (const x of judicialExtras(makeRng(4), companies).values()) expect(x.sameAsHq).toBe(!x.correspondence);
  });

  it("the notaries' and lawyers' offices carry migration_115's types", () => {
    const notary = companies.find((c) => c.name.startsWith("Biroul Individual Notarial"))!;
    expect(companyTypeName(notary)).toBe("Birou notarial");
    const other = companies.find((c) => !c.name.startsWith("Biroul") && !c.name.startsWith("Cabinet"))!;
    expect(companyTypeName(other)).toBe(other.type);
    for (const t of ["Birou notarial", "Cabinet sau societate de avocatură"]) expect(PUBLIC_BODY_TYPES).toContain(t as never);
  });

  it("an institution for every „Emitent” the documents carry, and every public body's type a public-body type", () => {
    const names = new Set(INSTITUTIONS.map((i) => i.name));
    for (const d of docs) if (d.fields.emitent) expect(names.has(d.fields.emitent)).toBe(true);
    for (const i of INSTITUTIONS) expect(i.publicBody).toBe((PUBLIC_BODY_TYPES as readonly string[]).includes(i.type));
    expect(new Set(INSTITUTIONS.map((i) => i.key)).size).toBe(INSTITUTIONS.length);
  });

  const extras = documentExtras(makeRng(6), docs, { details, companies, properties: props, institutionOf: new Map(INSTITUTIONS.map((i) => [i.name, i.key])) });
  const byKey = new Map(docs.map((d) => [d.key, d]));

  it("the issuer: the institution „Emitent” names, else the notary's office; a few only read, for a person to confirm", () => {
    const inst = new Map(INSTITUTIONS.map((i) => [i.name, i.key]));
    let read = 0;
    for (const d of docs) {
      const x = extras.get(d.key)!;
      expect(x.issuer !== null && x.issuerRead !== null).toBe(false);
      if (x.issuerRead) read++;
      if (x.issuer && d.fields.emitent) expect(x.issuer).toBe(inst.get(d.fields.emitent));
      if (x.issuer && !d.fields.emitent) {
        const office = companies.find((c) => c.key === x.issuer)!;
        expect(office.name.startsWith("Biroul Individual Notarial")).toBe(true);
      }
    }
    expect(read).toBeGreaterThanOrEqual(10);
    expect([...extras.values()].filter((x) => x.issuer).length / docs.length).toBeGreaterThan(0.7);
  });

  it("the owner's UAT on every title; the surveyor on every cadastral act that has one; a drawn lot's act claims it", () => {
    for (const d of docs) {
      const x = extras.get(d.key)!;
      if (d.type === "TITLU_PROPRIETATE") expect(x.uatProprietar).toBeTruthy();
      if (d.type === "ACT_CADASTRU") expect(x.surveyor).toBe(d.parties.find((p) => p.role === "Topograf / Expert cadastral")?.key ?? null);
      if (x.cornerSourceOf) expect(d.properties).toEqual([x.cornerSourceOf]);
    }
  });

  it("an import's traces: its title and the AI's reading together; a contract cites its prior titles, linked, and a certificate not in the archive", () => {
    let linked = 0;
    for (const d of docs) {
      const x = extras.get(d.key)!;
      // the title an import gave it, or an issuer only read, means the AI read it
      expect(x.aiInterpreted).toBe(!!x.importTitle || !!x.issuerRead);
      if (x.cited.length) expect(d.type).toBe("CONTRACT_VANZARE");
      for (const c of x.cited) {
        if (c.status === "LINKED") {
          linked++;
          const t = byKey.get(c.linked!)!;
          expect(t.links.some((l) => l.to === d.key && l.role === "Titlu anterior al")).toBe(true);
          expect([c.nrDocument, c.dateDocument]).toEqual([t.nr, t.date]);
        } else expect(c.linked).toBeNull();
      }
    }
    expect([...extras.values()].filter((x) => x.importTitle).length).toBeGreaterThanOrEqual(30);
    expect(linked).toBeGreaterThan(0);
  });

  it("a share in m² is that share of the lot's surface", () => {
    let n = 0;
    for (const d of docs) {
      for (const [i, m2] of extras.get(d.key)!.cotaSuprafata) {
        const lot = props.find((p) => p.key === d.properties[0])!;
        expect(m2).toBeCloseTo((lot.surface * d.parties[i].pct!) / 100, 1);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(50);
  });
});

describe("the last fields", () => {
  it("the Street View line as Google gives it; only on a drawn lot's address", () => {
    expect(streetViewLine({ streetLine: "Str. Gării nr. 12", locality: "Bragadiru", county: "Ilfov", postalCode: "077025" })).toBe("Strada Gării 12, Bragadiru 077025");
    expect(streetViewLine({ streetLine: "Str. Aleea Florilor nr. 3", locality: "Bragadiru", county: "Ilfov", postalCode: "077025" })).toBe("Aleea Florilor 3, Bragadiru 077025");
    for (const [k, x] of propertyExtras(makeRng(9), props)) if (x.streetView) expect(props.find((p) => p.key === k)!.corners).not.toBeNull();
  });
});
