/**
 * Groups, stamps, tags, „Importanță", „Relevanță", „Proveniență", provenance trails and „Vezi și" for the big
 * seed's objects.                                                                            (Slice #39.23)
 *
 * PURE. Twice the SQL seed's 12 groups, 7 stamps and 73 distinct tags — 24, 14 and 146 — with Romanian names
 * that fit an archive of property in Bragadiru, applied only to the seed's own objects:
 *   - groups to about half of them, one to three each (the app refuses a fourth — MAX_GROUPS_PER_ITEM);
 *   - stamps to about half, one to four each;
 *   - tags to every one, three to ten each, every tag used;
 *   - each of the three classifications on 78 % of the objects, from their own value lists;
 *   - a provenance trail — two or three changes of „Proveniență", back-dated over 2023–2026 — on about 5 %;
 *   - „Vezi și" on about 30 %, one to four each, to other objects of the seed.
 * The archive's real objects get nothing, and the groups, stamps and tags already in the database are not used.
 */
import type { Rng } from "./rng";
import { addDays } from "./dates";

export type Kind = "NATURAL" | "JUDICIAL" | "PROPERTY" | "DOCUMENT";
export type GroupTarget = "PHYSICAL_PERSON" | "JUDICIAL_PERSON" | "PROPERTY" | "DOCUMENT";
export const groupTargetOf = (k: Kind): GroupTarget => (k === "NATURAL" ? "PHYSICAL_PERSON" : k === "JUDICIAL" ? "JUDICIAL_PERSON" : k);

export const MAX_GROUPS = 3;
export const MAX_STAMPS = 4;
export const TAGS_PER_OBJECT = [3, 10] as const;
export const CLASSIFIED_SHARE = 0.78;
export const TRAIL_SHARE = 0.05;
export const XREF_SHARE = 0.3;

/** 24 groups, six for each kind of object. The description is what the screen shows. */
export const GROUPS: readonly (readonly [GroupTarget, string])[] = [
  ["PHYSICAL_PERSON", "Moștenitori în dosare succesorale deschise. Persoane chemate la succesiunile încă nedezbătute (date de test)."],
  ["PHYSICAL_PERSON", "Cumpărători de loturi 2015–2026. Persoane care au cumpărat terenuri de construcții în Bragadiru (date de test)."],
  ["PHYSICAL_PERSON", "Vânzători din parcelările vechi. Foști proprietari ai terenurilor parcelate după 2005 (date de test)."],
  ["PHYSICAL_PERSON", "Persoane de contact pentru acte. Membrii familiilor care se ocupă de documente (date de test)."],
  ["PHYSICAL_PERSON", "Reprezentanți ai firmelor. Administratori și mandatari cu procuri (date de test)."],
  ["PHYSICAL_PERSON", "Familii vechi din Bragadiru. Descendenți ai titularilor de titluri din 1991–1997 (date de test)."],
  ["JUDICIAL_PERSON", "Dezvoltatori imobiliari. Firme care au parcelat și vândut loturi (date de test)."],
  ["JUDICIAL_PERSON", "Birouri notariale. Notariatele la care s-au autentificat actele (date de test)."],
  ["JUDICIAL_PERSON", "Firme de cadastru și topografie. Autorii planurilor și ai intabulărilor (date de test)."],
  ["JUDICIAL_PERSON", "Arendași și cooperative agricole. Cei care lucrează terenurile extravilane (date de test)."],
  ["JUDICIAL_PERSON", "Constructori și antreprenori. Firmele care au construit pe loturile vândute (date de test)."],
  ["JUDICIAL_PERSON", "Asociații și fundații locale. Organizații din comunitatea Bragadiru (date de test)."],
  ["PROPERTY", "Parcelarea de pe aliniamentul de nord-est. Loturile aliniate pe latura comună (date de test)."],
  ["PROPERTY", "Curți-construcții cu acces din drum asfaltat. Loturi gata de autorizare (date de test)."],
  ["PROPERTY", "Terenuri în indiviziune. Proprietăți cu mai mulți coproprietari pe cote (date de test)."],
  ["PROPERTY", "Succesiuni nedezbătute. Imobile ale unor proprietari decedați (date de test)."],
  ["PROPERTY", "Extravilan arendat. Terenuri arabile și pășuni date în arendă (date de test)."],
  ["PROPERTY", "Case și apartamente locuite. Imobile cu adresă în Bragadiru (date de test)."],
  ["DOCUMENT", "Lanțuri de proprietate complete. Titlu, certificat de moștenitor, vânzare, act adițional (date de test)."],
  ["DOCUMENT", "Contracte de vânzare cu plata integrală. Prețul achitat la autentificare (date de test)."],
  ["DOCUMENT", "Acte adiționale pentru intabulare. Completări după măsurătorile cadastrale (date de test)."],
  ["DOCUMENT", "Acte de identitate ale părților. Copii depuse la dosarele de vânzare (date de test)."],
  ["DOCUMENT", "Urbanism și construire. Certificate de urbanism, autorizații, avize (date de test)."],
  ["DOCUMENT", "Dosare succesorale. Certificate de moștenitor și testamente (date de test)."],
];

/** 14 stamps: a short label and the note behind it. */
export const STAMPS: readonly (readonly [string, string])[] = [
  ["Verificat la OCPI", "Datele au fost comparate cu extrasul de carte funciară."],
  ["Original în arhiva fizică", "Exemplarul original se află în dulapul de acte."],
  ["De scanat din nou", "Scanare ilizibilă pe unele pagini."],
  ["Predat avocatului", "Dosar transmis pentru analiză juridică."],
  ["Așteaptă semnătura", "Actul mai are nevoie de semnătura unei părți."],
  ["Intabulat", "Dreptul este înscris în cartea funciară."],
  ["Neintabulat", "Dreptul nu este încă înscris în cartea funciară."],
  ["Cu sarcini", "Imobilul are ipotecă sau alte sarcini înscrise."],
  ["Taxe locale la zi", "Certificatul fiscal arată taxele plătite."],
  ["Cadastru de refăcut", "Măsurătorile trebuie actualizate."],
  ["Dosar complet", "Toate actele necesare sunt la dosar."],
  ["Lipsă act de proprietate", "Nu s-a găsit titlul sau contractul inițial."],
  ["Contestat în instanță", "Există un litigiu în curs."],
  ["Seed mare — date de test", "Obiecte create de scripts/seed-dev-data-big — se pot șterge cu --remove."],
];

/** 146 tags, lower-case as the app stores them, distinct. */
export const TAGS: readonly string[] = [
  // what the object is about
  "teren agricol", "intravilan", "extravilan", "curți construcții", "teren de construcții", "lot", "parcelare", "casă",
  "apartament", "anexă", "pășune", "livadă", "vie", "fânețe", "teren viran", "drum de acces", "servitute de trecere",
  "împrejmuire", "parcelă", "utilități", "racord electric", "racord apă", "canalizare", "gaze", "front stradal", "colț de stradă",
  // legal acts and situations
  "succesiune", "moștenire", "succesiune nedezbătută", "certificat de moștenitor", "testament", "legat", "donație",
  "vânzare", "vânzare-cumpărare", "act adițional", "antecontract", "promisiune de vânzare", "procură", "mandat",
  "partaj", "partaj voluntar", "indiviziune", "devălmășie", "coproprietate", "cotă-parte", "uzufruct", "arendă",
  "închiriere", "comodat", "ipotecă", "sarcini", "radiere ipotecă", "executare silită", "adjudecare", "litigiu",
  "grănițuire", "revendicare", "uzucapiune", "expropriere", "retrocedare", "fond funciar", "legea 18/1991",
  "titlu de proprietate", "reconstituire", "punere în posesie",
  // cadastre and urbanism
  "cadastru", "intabulare", "carte funciară", "număr cadastral", "plan de amplasament", "ridicare topografică",
  "dezmembrare", "alipire", "lotizare", "certificat de urbanism", "autorizație de construire", "pug", "puz", "aviz",
  "regim de înălțime", "pot și cut", "stereo 70", "coordonate", "măsurători",
  // people and parties
  "notar", "avocat", "expert cadastral", "executor", "mandatar", "moștenitor", "defunct", "cumpărător", "vânzător",
  "dezvoltator", "arendaș", "chiriaș", "vecin", "rudă", "familie", "minor", "tutelă",
  // the file's state
  "verificat", "de verificat", "incomplet", "complet", "original", "copie", "copie legalizată", "scanat", "de scanat",
  "prioritar", "urgent", "arhivat", "în lucru", "dosar complet", "lipsă acte", "de completat", "de semnat", "semnat",
  "trimis la ocpi", "răspuns ocpi", "taxe plătite", "taxe restante", "de reînnoit", "expirat",
  // places
  "bragadiru", "ilfov", "cornetu", "măgurele", "clinceni", "domnești", "jilava", "sector 5", "ghencea",
  "șoseaua alexandriei", "str. independenței", "str. haiducului", "str. leordeni", "str. gării", "str. teilor",
  "str. viilor", "str. livezii", "str. fermei", "valea ciorogârlei", "lacul sabar",
];

export const IMPORTANCE = ["LOW", "MEDIUM", "HIGH"] as const;
export const RELEVANCE = ["INACTIVE", "HISTORICAL", "CURRENT", "FUTURE"] as const;
export const PROVENANCE = ["MANUAL", "IMAGE", "DOC_FILE", "COORDINATE_FILE", "ALGORITHM", "AI_INTERPRETED", "EXTERNAL_FEED"] as const;

export type Target = { key: string; kind: Kind; dead?: boolean };

export type MetadataPlan = {
  /** object key → group indices into GROUPS (only groups of its own kind) */
  groups: Map<string, number[]>;
  /** object key → stamp indices into STAMPS */
  stamps: Map<string, number[]>;
  tags: Map<string, string[]>;
  importance: Map<string, (typeof IMPORTANCE)[number]>;
  relevance: Map<string, (typeof RELEVANCE)[number]>;
  provenance: Map<string, (typeof PROVENANCE)[number]>;
  /** object key → its provenance values in order and the day of each change */
  trails: Map<string, { values: (typeof PROVENANCE)[number][]; dates: string[] }>;
  xrefs: { from: string; to: string; note: string | null }[];
};

const XREF_NOTES = ["Vezi și: aceeași familie", "Vezi și: dosarul conex", "Același notar / aceeași tranzacție", "Referință din registrul de intrări", "Posibil duplicat — de verificat", "Menționat în corespondență", null];

export function planMetadata(r: Rng, targets: Target[]): MetadataPlan {
  const plan: MetadataPlan = { groups: new Map(), stamps: new Map(), tags: new Map(), importance: new Map(), relevance: new Map(), provenance: new Map(), trails: new Map(), xrefs: [] };
  for (const t of r.shuffle(targets).slice(0, Math.ceil(targets.length / 2))) {
    const own = GROUPS.map((g, i) => [g, i] as const).filter(([g]) => g[0] === groupTargetOf(t.kind)).map(([, i]) => i);
    plan.groups.set(t.key, r.shuffle(own).slice(0, r.int(1, MAX_GROUPS)));
  }
  for (const t of r.shuffle(targets).slice(0, Math.ceil(targets.length / 2))) {
    plan.stamps.set(t.key, r.shuffle(STAMPS.map((_, i) => i)).slice(0, r.int(1, MAX_STAMPS)));
  }
  for (const t of targets) plan.tags.set(t.key, r.shuffle(TAGS).slice(0, r.int(TAGS_PER_OBJECT[0], TAGS_PER_OBJECT[1])));
  // every tag used at least once
  for (const tag of TAGS) {
    if ([...plan.tags.values()].some((s) => s.includes(tag))) continue;
    const t = r.shuffle(targets).find((x) => plan.tags.get(x.key)!.length < TAGS_PER_OBJECT[1])!;
    plan.tags.get(t.key)!.push(tag);
  }
  for (const t of targets) {
    if (r.chance(CLASSIFIED_SHARE)) plan.importance.set(t.key, r.weighted([["LOW", 30], ["MEDIUM", 50], ["HIGH", 20]]));
    if (r.chance(CLASSIFIED_SHARE)) plan.relevance.set(t.key, t.dead ? "HISTORICAL" : r.weighted([["CURRENT", 60], ["HISTORICAL", 25], ["INACTIVE", 10], ["FUTURE", 5]]));
    if (r.chance(CLASSIFIED_SHARE)) {
      const p = t.kind === "DOCUMENT" ? r.weighted([["IMAGE", 40], ["DOC_FILE", 35], ["AI_INTERPRETED", 15], ["MANUAL", 10]]) : t.kind === "PROPERTY" ? r.weighted([["MANUAL", 40], ["COORDINATE_FILE", 35], ["DOC_FILE", 25]]) : r.weighted([["MANUAL", 60], ["IMAGE", 25], ["EXTERNAL_FEED", 15]]);
      plan.provenance.set(t.key, p as (typeof PROVENANCE)[number]);
    }
  }
  // provenance trails: two or three changes, ending on the object's provenance
  for (const t of r.shuffle(targets.filter((x) => plan.provenance.has(x.key))).slice(0, Math.round(targets.length * TRAIL_SHARE))) {
    const last = plan.provenance.get(t.key)!;
    const steps = r.int(2, 3);
    const values: (typeof PROVENANCE)[number][] = [];
    while (values.length < steps) {
      const v = r.pick(PROVENANCE.filter((p) => p !== values.at(-1) && p !== last));
      values.push(v);
    }
    values.push(last);
    const dates: string[] = [];
    let d = addDays("2023-01-10", r.int(0, 400));
    for (let i = 0; i < values.length; i++) {
      dates.push(d);
      d = addDays(d, r.int(40, 260));
    }
    plan.trails.set(t.key, { values, dates });
  }
  // „Vezi și": 30 %, one to four each, to other objects of the seed
  for (const t of r.shuffle(targets).slice(0, Math.round(targets.length * XREF_SHARE))) {
    const to = r.shuffle(targets).filter((x) => x.key !== t.key).slice(0, r.int(1, 4));
    for (const x of to) plan.xrefs.push({ from: t.key, to: x.key, note: r.pick(XREF_NOTES) });
  }
  return plan;
}
