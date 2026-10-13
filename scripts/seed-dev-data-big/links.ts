/**
 * „Legături" for every object the big seed made: between 3 and 15 rows, the aim being all of them.   (Slice #39.23)
 *
 * PURE. The tile counts, for a person, its person-to-person pairs, its property links and its document links
 * (one row per role); for a property, its property pairs, its persons and its documents; for a document, its
 * document pairs, its persons and its properties — `tileRows` counts the plan the same way. 39.20–39.22 keep
 * every object at 15 or fewer (their generators check before they add); `topUpLinks` brings the ones under 3 up
 * with links that make sense for the pair, using roles valid for it, and never takes anything past 15:
 *
 *   a company        its representatives (the contact persons) as „Reprezentant legal / Mandatar"; then a few
 *                    of the families as „Asociat / Acționar" — or, at a notary's office, „Angajat"; and when
 *                    the families' adults have no room left, another company as „Asociat / Acționar";
 *   a person         a grandparent's „Bunic"/„Bunică" line (a tie the tree reads as OTHER); an adult alive
 *                    today as „Angajat" at a company or „Vecin" of a property;
 *   a property       „Adiacent" to the lots it shares an edge with; then „Vecin" — a living adult nearby;
 *   a document       „Înscris doveditor pentru" a later document of the same party or property; the property of
 *                    its party.
 * Only the seed's own objects are linked: the archive's real objects get nothing.
 */
import type { Rng } from "./rng";
import { ageAt } from "./dates";
import { TODAY, type FamilyPlan } from "./families";
import type { CompanyPlan } from "./companies";
import type { PropertyPlan } from "./properties";
import type { DocPlan } from "./documents";
import { MAX_LINKS } from "./documents";

export const MIN_LINKS = 3;

export type ExtraLinks = {
  /** person ↔ person, `holder` holds `role` towards `other` */
  personPerson: { holder: string; other: string; role: "Reprezentant legal / Mandatar" | "Asociat / Acționar" | "Angajat" | "Bunic" | "Bunică" }[];
  personProperty: { person: string; property: string; role: "Vecin" }[];
  propertyProperty: { a: string; b: string; role: "Adiacent" }[];
  documentDocument: { from: string; to: string; role: "Înscris doveditor pentru" }[];
  documentProperty: { document: string; property: string }[];
};

export const emptyLinks = (): ExtraLinks => ({ personPerson: [], personProperty: [], propertyProperty: [], documentDocument: [], documentProperty: [] });

/** Rows on each object's „Legături" tile, as the plan (and the extra links) will write them. */
export function tileRows(plan: FamilyPlan, props: PropertyPlan[], docs: DocPlan[], extra: ExtraLinks = emptyLinks()): Map<string, number> {
  const m = new Map<string, number>();
  const bump = (k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const t of plan.ties) { bump(t.holder); bump(t.other); }
  for (const p of props) for (const o of p.owners) { bump(o.key); bump(p.key); }
  for (const d of docs) {
    for (const x of d.parties) { bump(x.key); bump(d.key); }
    for (const pk of new Set(d.properties)) { bump(pk); bump(d.key); }
    for (const l of d.links) { bump(d.key); bump(l.to); }
  }
  for (const x of extra.personPerson) { bump(x.holder); bump(x.other); }
  for (const x of extra.personProperty) { bump(x.person); bump(x.property); }
  for (const x of extra.propertyProperty) { bump(x.a); bump(x.b); }
  for (const x of extra.documentDocument) { bump(x.from); bump(x.to); }
  for (const x of extra.documentProperty) { bump(x.document); bump(x.property); }
  return m;
}

export type LinkContext = { plan: FamilyPlan; companies: CompanyPlan[]; properties: PropertyPlan[]; documents: DocPlan[]; edges: [string, string][] };

/** Links for every object under MIN_LINKS, none taking an object past MAX_LINKS. */
export function topUpLinks(r: Rng, ctx: LinkContext): ExtraLinks {
  const { plan, companies, properties, documents } = ctx;
  const extra = emptyLinks();
  const rows = tileRows(plan, properties, documents);
  const n = (k: string) => rows.get(k) ?? 0;
  const room = (k: string) => n(k) < MAX_LINKS;
  const add = (...ks: string[]) => ks.forEach((k) => rows.set(k, n(k) + 1));
  const persons = new Map(plan.persons.map((p) => [p.key, p]));
  const pairs = new Set<string>();
  // existing pairs, so a top-up never doubles one (person_person and property_property hold one row per pair)
  for (const t of plan.ties) pairs.add([t.holder, t.other].sort().join("|"));
  for (const p of properties) for (const o of p.owners) pairs.add(`${o.key}@${p.key}`);
  for (const d of documents) {
    for (const pk of d.properties) pairs.add(`${d.key}@${pk}`);
    for (const l of d.links) pairs.add([d.key, l.to].sort().join("|"));
  }
  const free = (a: string, b: string, sep = "|") => !pairs.has(sep === "|" ? [a, b].sort().join("|") : `${a}${sep}${b}`);
  const take = (a: string, b: string, sep = "|") => pairs.add(sep === "|" ? [a, b].sort().join("|") : `${a}${sep}${b}`);
  const livingAdults = () => r.shuffle(plan.persons.filter((p) => !p.dod && ageAt(p.dob, TODAY) >= 22).map((p) => p.key));

  // ── companies: their representatives, then members or staff
  for (const c of companies) {
    for (const k of c.representatives) {
      if (n(c.key) >= MIN_LINKS + 1) break;
      if (room(k) && room(c.key) && free(k, c.key)) {
        extra.personPerson.push({ holder: k, other: c.key, role: "Reprezentant legal / Mandatar" });
        take(k, c.key);
        add(k, c.key);
      }
    }
    const want = r.int(MIN_LINKS, MIN_LINKS + 2);
    const role = c.name.startsWith("Biroul Individual Notarial") ? "Angajat" : "Asociat / Acționar";
    for (const k of livingAdults()) {
      if (n(c.key) >= want || !room(c.key)) break;
      if (n(k) >= MAX_LINKS - 2 || !free(k, c.key)) continue;
      extra.personPerson.push({ holder: k, other: c.key, role });
      take(k, c.key);
      add(k, c.key);
    }
  }
  // companies still short — the families' adults are busy — hold shares in one another
  for (const c of companies) {
    if (n(c.key) >= MIN_LINKS || c.name.startsWith("Biroul Individual Notarial")) continue;
    for (const o of r.shuffle(companies)) {
      if (n(c.key) >= MIN_LINKS) break;
      if (o.key === c.key || n(o.key) >= MAX_LINKS - 1 || !free(o.key, c.key)) continue;
      extra.personPerson.push({ holder: o.key, other: c.key, role: "Asociat / Acționar" });
      take(o.key, c.key);
      add(o.key, c.key);
    }
  }

  // ── properties: adjacent lots, then neighbours
  const adj = new Map<string, string[]>();
  for (const [a, b] of ctx.edges) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  for (const p of properties) {
    for (const q of adj.get(p.key) ?? []) {
      if (n(p.key) >= MIN_LINKS) break;
      if (room(q) && free(p.key, q)) {
        extra.propertyProperty.push({ a: p.key, b: q, role: "Adiacent" });
        take(p.key, q);
        add(p.key, q);
      }
    }
  }

  // ── persons: a grandparent's line, then work or a neighbouring property
  const grandparents = (k: string) => {
    const p = persons.get(k)!;
    return p.parents.flatMap((pk) => persons.get(pk)!.parents);
  };
  const neighbourOf = (k: string): string | null => {
    const props = r.shuffle(properties.filter((p) => room(p.key) && free(k, p.key, "@")));
    return props[0]?.key ?? null;
  };
  for (const p of plan.persons) {
    for (let guard = 0; n(p.key) < MIN_LINKS && guard < 6; guard++) {
      const g = grandparents(p.key).find((gk) => room(gk) && free(gk, p.key));
      if (g) {
        extra.personPerson.push({ holder: g, other: p.key, role: persons.get(g)!.sex === "MALE" ? "Bunic" : "Bunică" });
        take(g, p.key);
        add(g, p.key);
        continue;
      }
      const adult = !p.dod && ageAt(p.dob, TODAY) >= 18;
      const firm = adult && r.chance(0.5) ? r.shuffle(companies).find((c) => room(c.key) && free(p.key, c.key)) : undefined;
      if (firm) {
        extra.personPerson.push({ holder: p.key, other: firm.key, role: "Angajat" });
        take(p.key, firm.key);
        add(p.key, firm.key);
        continue;
      }
      // a neighbour is someone alive and of age today
      const q = adult ? neighbourOf(p.key) : null;
      if (!q) break;
      extra.personProperty.push({ person: p.key, property: q, role: "Vecin" });
      take(p.key, q, "@");
      add(p.key, q);
    }
  }
  // properties still short: a neighbour
  for (const p of properties) {
    for (const k of livingAdults()) {
      if (n(p.key) >= MIN_LINKS || !room(p.key)) break;
      if (n(k) >= MAX_LINKS || !free(k, p.key, "@")) continue;
      extra.personProperty.push({ person: k, property: p.key, role: "Vecin" });
      take(k, p.key, "@");
      add(k, p.key);
    }
  }

  // ── documents: a later document of the same party or property; the property of its party
  const byParty = new Map<string, DocPlan[]>();
  for (const d of documents) for (const x of d.parties) byParty.set(x.key, [...(byParty.get(x.key) ?? []), d]);
  const ownedBy = new Map<string, string[]>();
  for (const p of properties) for (const o of p.owners) ownedBy.set(o.key, [...(ownedBy.get(o.key) ?? []), p.key]);
  for (const d of documents) {
    for (let guard = 0; n(d.key) < MIN_LINKS && guard < 6; guard++) {
      const related = r.shuffle([
        ...d.parties.flatMap((x) => byParty.get(x.key) ?? []),
        ...documents.filter((o) => o.properties.some((pk) => d.properties.includes(pk))),
      ]).find((o) => o.key !== d.key && o.date >= d.date && room(o.key) && free(d.key, o.key));
      if (related) {
        extra.documentDocument.push({ from: d.key, to: related.key, role: "Înscris doveditor pentru" });
        take(d.key, related.key);
        add(d.key, related.key);
        continue;
      }
      const pk = d.parties.flatMap((x) => ownedBy.get(x.key) ?? []).find((k) => room(k) && free(d.key, k, "@"));
      if (!pk) break;
      extra.documentProperty.push({ document: d.key, property: pk });
      take(d.key, pk, "@");
      add(d.key, pk);
    }
  }
  return extra;
}
