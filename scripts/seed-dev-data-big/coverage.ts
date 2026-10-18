/**
 * The coverage table every run prints: each of Adrian's figures, its target, and the value reached.   (Slice #39.20)
 *
 * PURE. seed.ts reads the rows back FROM THE DATABASE after the run and hands them here, so the table says what
 * was written, not what was planned. 39.21–39.23 add their lines to `coverageLines`.
 */

/** One natural person as read back: the fields Adrian's 90 % is about, and their relatives in the seed. */
export type NaturalRow = {
  cnp: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  relatives: number;
};

export type JudicialRow = {
  cui: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  representatives: number;
};

export type CoverageLine = {
  label: string;
  /** "≥ 90 %", "= 450", … — as printed */
  target: string;
  /** as printed: "412 / 450 (91.6 %)" */
  value: string;
  met: boolean;
};

const MARKER = "(date de test)";
const filled = (s: string | null | undefined): boolean => !!s && s.trim().length > 0;
export const meaningful = (notes: string | null | undefined): number =>
  (notes ?? "").replace(MARKER, "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** A percentage to one decimal — what is printed is what is compared, so 57/100 is 57.0, not 56.999… */
const pctOf = (hits: number, of: number): number => (of === 0 ? 0 : Math.round((hits / of) * 1000) / 10);

export function share(label: string, hits: number, of: number, min: number): CoverageLine {
  const pct = pctOf(hits, of);
  return { label, target: `${min === 100 ? "=" : "≥"} ${min} %`, value: `${hits} / ${of} (${pct.toFixed(1)} %)`, met: of > 0 && pct >= min };
}

export function exactly(label: string, n: number, want: number): CoverageLine {
  return { label, target: `= ${want}`, value: String(n), met: n === want };
}

export function atLeast(label: string, n: number, want: number): CoverageLine {
  return { label, target: `≥ ${want}`, value: String(n), met: n >= want };
}

export type CoverageInput = {
  natural: NaturalRow[];
  judicial: JudicialRow[];
  /** distinct generations among the seed's family members, and the earliest birth year */
  generations: number;
  earliestBirthYear: number | null;
  /** each family situation and how many times it occurs */
  scenarios: { label: string; count: number }[];
  scenarioMin: number;
  targets: { natural: number; judicial: number };
};

export function coverageLines(c: CoverageInput): CoverageLine[] {
  const n = c.natural;
  const j = c.judicial;
  const natAll = n.filter((r) => filled(r.cnp) && filled(r.dateOfBirth) && filled(r.placeOfBirth) && filled(r.phone) && filled(r.email) && meaningful(r.notes) >= 5);
  const jurAll = j.filter((r) => filled(r.cui) && filled(r.phone) && filled(r.email) && meaningful(r.notes) >= 5);
  return [
    exactly("Persoane fizice", n.length, c.targets.natural),
    share("PF cu CNP", n.filter((r) => filled(r.cnp)).length, n.length, 90),
    share("PF cu data nașterii", n.filter((r) => filled(r.dateOfBirth)).length, n.length, 90),
    share("PF cu locul nașterii", n.filter((r) => filled(r.placeOfBirth)).length, n.length, 90),
    share("PF cu un telefon", n.filter((r) => filled(r.phone)).length, n.length, 90),
    share("PF cu un e-mail", n.filter((r) => filled(r.email)).length, n.length, 90),
    share("PF cu note de minimum 5 cuvinte", n.filter((r) => meaningful(r.notes) >= 5).length, n.length, 90),
    share("PF cu toate cele de mai sus", natAll.length, n.length, 90),
    share("PF cu minimum 3 rude în sistem", n.filter((r) => r.relatives >= 3).length, n.length, 50),
    atLeast("Generații în familii", c.generations, 5),
    {
      label: "Cel mai vechi an de naștere",
      target: "≥ 1900",
      value: c.earliestBirthYear === null ? "—" : String(c.earliestBirthYear),
      met: c.earliestBirthYear !== null && c.earliestBirthYear >= 1900 && c.earliestBirthYear <= 1915,
    },
    ...c.scenarios.map((s) => atLeast(`Situație: ${s.label}`, s.count, c.scenarioMin)),
    exactly("Persoane juridice", j.length, c.targets.judicial),
    share("PJ cu CUI", j.filter((r) => filled(r.cui)).length, j.length, 90),
    share("PJ cu un telefon", j.filter((r) => filled(r.phone)).length, j.length, 90),
    share("PJ cu un e-mail", j.filter((r) => filled(r.email)).length, j.length, 90),
    share("PJ cu note de minimum 5 cuvinte", j.filter((r) => meaningful(r.notes) >= 5).length, j.length, 90),
    share("PJ cu toate cele de mai sus", jurAll.length, j.length, 90),
    share("PJ cu minimum un reprezentant din sistem", j.filter((r) => r.representatives >= 1).length, j.length, 50),
  ];
}

/** The table as printed: one line per figure, a ✓ or ✗, and a last line saying whether all are met. */
export function formatCoverage(lines: CoverageLine[]): string {
  const w = Math.max(...lines.map((l) => l.label.length));
  const rows = lines.map((l) => `${l.met ? "✓" : "✗"} ${l.label.padEnd(w)}  ${l.target.padEnd(8)}  ${l.value}`);
  const bad = lines.filter((l) => !l.met).length;
  return [...rows, bad === 0 ? `Toate cele ${lines.length} cerințe sunt îndeplinite.` : `! ${bad} din ${lines.length} cerințe NU sunt îndeplinite.`].join("\n");
}

// ---------------------------------------------------------------------------
// Properties (#39.21)
// ---------------------------------------------------------------------------

/** One property as read back: its kind, its stored corners projected to Stereo 70, its area, its owners. */
export type PropertyRow = {
  type: string | null;
  useCategory: string | null;
  hasAddress: boolean;
  /** stored corners in Stereo 70 metres, or null when it has none */
  corners: { n: number; e: number }[] | null;
  /** calculated_area_mp, as the app's computeCornerGeometry stored it */
  calculatedArea: number | null;
  surface: number | null;
  owners: number;
  /** every owner alive today, or the single owner of an unsettled estate */
  ownersFit: boolean;
};

export type PropertyFacts = {
  rows: PropertyRow[];
  target: number;
  tpc: string;
  curti: string;
  /** pairs of new lots that overlap; new lots overlapping a property already in the database (the line aside) */
  overlapsNew: number;
  overlapsExisting: number;
  /** drawn lots inside Bragadiru's range */
  inRange: number;
  /** drawn lots sharing an edge with another new lot */
  touching: number;
  /** the line cluster: lots standing on Adrian's line, and how much of it their edges cover */
  onLine: { lots: number; covered: number; length: number };
};

function around(label: string, hits: number, of: number, want: number, slack = 3): CoverageLine {
  const pct = pctOf(hits, of);
  return { label, target: `≈ ${want} %`, value: `${hits} / ${of} (${pct.toFixed(1)} %)`, met: of > 0 && Math.abs(pct - want) <= slack };
}

export function propertyLines(f: PropertyFacts): CoverageLine[] {
  const r = f.rows;
  const drawn = r.filter((x) => x.corners && x.corners.length >= 3);
  const areaAgrees = drawn.filter((x) => x.calculatedArea !== null && x.surface !== null && Math.abs(x.surface - x.calculatedArea) <= x.calculatedArea * 0.05);
  return [
    exactly("Proprietăți", r.length, f.target),
    around(`„${f.curti}"`, r.filter((x) => x.useCategory === f.curti).length, r.length, 60),
    around(`„${f.tpc}"`, r.filter((x) => x.type === f.tpc).length, r.length, 80),
    share(`„${f.curti}" care sunt „${f.tpc}"`, r.filter((x) => x.useCategory === f.curti && x.type === f.tpc).length, r.filter((x) => x.useCategory === f.curti).length, 100),
    around("Cu colțuri pe hartă", drawn.length, r.length, 60),
    around("Cu adresă", r.filter((x) => x.hasAddress).length, r.length, 50),
    share("Desenate în Bragadiru (Stereo 70)", f.inRange, drawn.length, 100),
    share("Desenate în grupuri care se ating", f.touching, drawn.length, 50),
    exactly("Suprapuneri între loturile noi", f.overlapsNew, 0),
    exactly("Suprapuneri cu proprietăți existente", f.overlapsExisting, 0),
    share("Suprafața declarată la ±5 % de cea desenată", areaAgrees.length, drawn.length, 100),
    exactly("Loturi pe linia lui Adrian, spre SV", f.onLine.lots, 6),
    {
      label: "Linia acoperită de laturile lor de NE",
      target: `= ${f.onLine.length.toFixed(2)} m`,
      value: `${f.onLine.covered.toFixed(2)} m`,
      met: Math.abs(f.onLine.covered - f.onLine.length) < 0.5,
    },
    share("Cu minimum un proprietar", r.filter((x) => x.owners >= 1).length, r.length, 100),
    share("Proprietari în viață (sau succesiune nedezbătută)", r.filter((x) => x.ownersFit).length, r.length, 100),
  ];
}

// ---------------------------------------------------------------------------
// Documents (#39.22)
// ---------------------------------------------------------------------------

export type DocumentFacts = {
  target: number;
  /** read back from the database */
  total: number;
  contracts: number;
  /** contracts with an „Act adițional la" link from an act */
  contractsWithAct: number;
  /** per form field of the four (label → contracts that have it) */
  fourFields: { label: string; filled: number }[];
  /** contracts whose form has price, currency and date of payment */
  priced: number;
  withPages: number;
  maxPerParty: number;
  maxAllowed: number;
  /** broken rules in the plan (documentViolations) — must be none */
  violations: number;
  /** title → certificat de moștenitor → sale, linked in date order */
  chains: number;
  chainsMin: number;
};

export function documentLines(f: DocumentFacts): CoverageLine[] {
  return [
    exactly("Documente", f.total, f.target),
    share("Contracte de vânzare", f.contracts, f.total, 40),
    share("Contracte cu act adițional legat", f.contractsWithAct, f.contracts, 50),
    ...f.fourFields.map((x) => share(`Contracte cu „${x.label}"`, x.filled, f.contracts, 70)),
    share("Contracte cu preț, monedă și data plății", f.priced, f.contracts, 70),
    share("Documente cu pagini (fișiere de test)", f.withPages, f.total, 100),
    { label: "Cele mai multe documente pe o persoană", target: `≤ ${f.maxAllowed}`, value: String(f.maxPerParty), met: f.maxPerParty <= f.maxAllowed },
    exactly("Reguli încălcate (date, vârste, proprietari, cote)", f.violations, 0),
    atLeast("Lanțuri titlu → certificat → vânzare", f.chains, f.chainsMin),
  ];
}

// ---------------------------------------------------------------------------
// Links, notes, metadata, groups, stamps, tags (#39.23)
// ---------------------------------------------------------------------------

export type FinishFacts = {
  objects: number;
  /** rows on each object’s „Legături" tile, read back */
  rows: number[];
  notes: { properties: [number, number]; documents: [number, number] };
  classified: { importance: number; relevance: number; provenance: number };
  groups: number;
  stamps: number;
  distinctTags: number;
  targets: { groups: number; stamps: number; tags: number };
  maxGroupsPerObject: number;
  maxStampsPerObject: number;
  tagsPerTagged: { min: number; max: number };
  trails: number;
  trailsMin: number;
  withXref: number;
};

export function finishLines(f: FinishFacts): CoverageLine[] {
  const within = f.rows.filter((n) => n >= 3 && n <= 15).length;
  return [
    share("Obiecte cu 3–15 rânduri în „Legături”", within, f.objects, 90),
    { label: "Cele mai multe rânduri în „Legături”", target: "≤ 15", value: String(Math.max(0, ...f.rows)), met: Math.max(0, ...f.rows) <= 15 },
    share("Proprietăți cu „Note extinse”", f.notes.properties[0], f.notes.properties[1], 70),
    share("Documente cu „Note extinse”", f.notes.documents[0], f.notes.documents[1], 70),
    share("Obiecte cu „Importanță”", f.classified.importance, f.objects, 70),
    share("Obiecte cu „Relevanță”", f.classified.relevance, f.objects, 70),
    share("Obiecte cu „Proveniență”", f.classified.provenance, f.objects, 70),
    exactly("Grupuri", f.groups, f.targets.groups),
    exactly("Ștampile", f.stamps, f.targets.stamps),
    exactly("Etichete distincte", f.distinctTags, f.targets.tags),
    { label: "Grupuri pe un obiect", target: "≤ 3", value: String(f.maxGroupsPerObject), met: f.maxGroupsPerObject <= 3 },
    { label: "Ștampile pe un obiect", target: "≤ 4", value: String(f.maxStampsPerObject), met: f.maxStampsPerObject <= 4 },
    { label: "Etichete pe un obiect", target: "3–10", value: `${f.tagsPerTagged.min}–${f.tagsPerTagged.max}`, met: f.tagsPerTagged.min >= 3 && f.tagsPerTagged.max <= 10 },
    atLeast("Trasee de proveniență", f.trails, f.trailsMin),
    around("Obiecte cu „Vezi și”", f.withXref, f.objects, 30),
  ];
}

// ---------------------------------------------------------------------------
// Slice #39.81: what the archive gained since the seed was designed
// ---------------------------------------------------------------------------

export type EnrichFacts = {
  tarlas: { planned: number; total: number; withPlace: number; withNotes: number; withOutline: number; withParcels: number; withPlan: number };
  /** drawn lots on a seeded tarla, and how many stand inside its outline */
  lotsOnTarla: { drawn: number; inside: number };
  professions: { used: number; adults: number; withProfession: number };
  relationships: { used: number; available: number; adults: number; withAny: number };
  natural: {
    withPhone: number; phone2: number; working: number; workPhone: number; workEmail: number; withEmail: number; email2: number;
    idCards: number; withMrz: number; cardNumber: number; passports: number; correspondence: number; postal: number; sameAsHome: number; addressNotes: number;
  };
  judicial: { total: number; correspondence: number };
  /** properties with an address, and those whose address carries the Street View line */
  streetView: { addressed: number; withLine: number };
  documents: {
    issuerPlanned: number; issuer: number; issuerRead: number; titles: number; uatProprietar: number; cadastral: number; surveyor: number;
    imported: number; aiInterpreted: number; cited: number; cotaSurface: number; pageNotes: number; rotated: number; cornerSources: number;
  };
  institutions: { planned: number; total: number; publicBody: number; publicBodyPlanned: number };
};

/** The lines for every field and table the seed fills since #39.81 — read back from the database, like the rest. */
export function enrichLines(f: EnrichFacts): CoverageLine[] {
  const t = f.tarlas;
  const n = f.natural;
  const d = f.documents;
  return [
    exactly("Tarlale ale seed-ului", t.total, t.planned),
    atLeast("Tarlale planificate", t.planned, 5),
    share("Tarlale cu localitate și județ", t.withPlace, t.total, 100),
    share("Tarlale cu „Note extinse”", t.withNotes, t.total, 100),
    share("Tarlale cu contur", t.withOutline, t.total, 100),
    share("Tarlale cu parcele", t.withParcels, t.total, 100),
    share("Tarlale cu plan parcelar", t.withPlan, t.total, 100),
    share("Loturi desenate în conturul tarlalei lor", f.lotsOnTarla.inside, f.lotsOnTarla.drawn, 100),
    atLeast("Profesii folosite, din cele 13", f.professions.used, 12),
    share("Adulți cu „Tip profesional”", f.professions.withProfession, f.professions.adults, 100),
    exactly("„Relația cu firma”: valori folosite", f.relationships.used, f.relationships.available),
    share("Adulți cu o „Relația cu firma”", f.relationships.withAny, f.relationships.adults, 60),
    share("Al doilea telefon (din cei cu telefon)", n.phone2, n.withPhone, 15),
    share("Telefon de serviciu (din cei care lucrează)", n.workPhone, n.working, 25),
    atLeast("E-mail de serviciu", n.workEmail, 20),
    share("Al doilea e-mail (din cei cu e-mail)", n.email2, n.withEmail, 8),
    share("Cărți de identitate cu MRZ", n.withMrz, n.idCards, 100),
    atLeast("Cărți de identitate cu numărul cardului", n.cardNumber, 10),
    atLeast("Pașapoarte (copii)", n.passports, 3),
    atLeast("Adrese de corespondență", n.correspondence, 10),
    atLeast("Adrese poștale", n.postal, 5),
    atLeast("„Corespondență la domiciliu”", n.sameAsHome, 100),
    atLeast("Adrese cu note", n.addressNotes, 10),
    atLeast("Firme cu adresă de corespondență", f.judicial.correspondence, 20),
    share("Adrese de proprietăți cu rândul Street View", f.streetView.withLine, f.streetView.addressed, 15),
    exactly("Instituții emitente (persoane juridice)", f.institutions.total, f.institutions.planned),
    exactly("… dintre ele autorități publice", f.institutions.publicBody, f.institutions.publicBodyPlanned),
    share("Documente cu emitent sau notar, cu „Emitent” ales", d.issuer, d.issuerPlanned, 90),
    atLeast("Documente cu „Emitent citit” de confirmat", d.issuerRead, 10),
    share("Titluri cu „UAT proprietar”", d.uatProprietar, d.titles, 100),
    share("Acte de cadastru cu topograf", d.surveyor, d.cadastral, 100),
    atLeast("Documente importate (titlu de import)", d.imported, 30),
    atLeast("Documente citite de AI", d.aiInterpreted, 30),
    atLeast("Contracte cu înscrisuri citate", d.cited, 15),
    atLeast("Cote în m²", d.cotaSurface, 50),
    atLeast("Pagini cu note", d.pageNotes, 30),
    atLeast("Pagini rotite", d.rotated, 10),
    atLeast("Loturi desenate dintr-un act de cadastru", d.cornerSources, 5),
  ];
}

/** The column check (columns.ts): every column the map says the seed writes holds a value on one of its rows. */
export function columnLine(checked: number, empty: string[]): CoverageLine {
  const shown = empty.slice(0, 8).join(", ") + (empty.length > 8 ? `, … (${empty.length})` : "");
  return { label: "Coloane scrise de seed, cu valoare", target: "= toate", value: `${checked - empty.length} / ${checked}${empty.length ? ` — goale: ${shown}` : ""}`, met: checked > 0 && empty.length === 0 };
}
