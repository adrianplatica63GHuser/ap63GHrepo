/**
 * „OBIECTUL VÂNZĂRII" SAYS WHAT IS BEING SOLD.                   (Slice #38.49)
 *
 * Adrian: the contract de vânzare's „Obiectul vânzării" tile „does not contain
 * the actual asset that is changing hands" — a concise description „compiled
 * from all the information available", giving „a clear image of the type of
 * asset, and possibly purpose of sale". This composes it, BY RULE (#38.49's
 * Ask first 2): free, the same answer twice, and it works on every contract
 * already in the archive. The text is stored in the form's `descriereObiect`
 * and can be corrected by hand; „Recompune" writes it again.
 *
 * THE SOURCES, each left out when blank — never written as „necunoscut":
 *   - the properties linked to the contract: type and use category, area
 *     (the official one, else the calculated one), tarla / parcela, the
 *     cadastral and CF numbers, the locality;
 *   - the share sold: the sellers' cota-parte from „Părți", when it is less
 *     than the whole;
 *   - „Scop vânzare": „pentru comasare" when it is a comasare. An ordinary
 *     sale, or „Alt scop", adds nothing a reader can use.
 * Several properties are summed up — how many, their total area, where — not
 * listed one by one.
 *
 * ⚠️ THE WORDING IS AN ASSUMPTION (a domain fact, #38.49's header): what an
 * expert wants to read here is Adrian's and Ciprian's call. The handover holds
 * three samples for them to correct. Measured on shapes, not one example:
 * one property, several, a share, no scope, every source blank.
 *
 * PURE — no DB, no React; `sale-object-description.test.ts` covers it.
 */

/** One property linked to the contract, as `listDocumentProperties` returns it. */
export interface SaleObjectProperty {
  propertyType?: string | null;
  useCategory?: string | null;
  surfaceAreaMp?: number | string | null;
  calculatedAreaMp?: number | string | null;
  tarla?: string | null;
  parcela?: string | null;
  cadastralNumber?: string | null;
  carteFunciara?: string | null;
  locality?: string | null;
}

/** One party of the contract, as `listDocumentPersons` returns it. */
export interface SaleObjectParty {
  roleName?: string | null;
  holdsShare?: boolean;
  cotaParte?: number | null;
}

export interface SaleObjectSources {
  properties: readonly SaleObjectProperty[];
  parties?: readonly SaleObjectParty[];
  /** `custom_fields.scopVanzare`: OBISNUITA, COMASARE or ALTUL. */
  scopVanzare?: string | null;
}

/** The form's key for the description (migration_102). */
export const SALE_OBJECT_FIELD_KEY = "descriereObiect";

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const blank = (s: string | null | undefined): s is null | undefined => s === null || s === undefined || s.trim() === "";

function area(p: SaleObjectProperty): number | null {
  for (const v of [p.surfaceAreaMp, p.calculatedAreaMp]) {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** „5.000 mp", „5.780,48 mp" — Romanian separators, at most two decimals. */
export function formatMp(n: number): string {
  return `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2, useGrouping: "always" } as Intl.NumberFormatOptions).format(n)} mp`;
}

/** The kind of asset: „Teren arabil"; the use category added when the type does not already say it. */
function kind(p: SaleObjectProperty): string | null {
  const type = blank(p.propertyType) ? null : p.propertyType!.trim();
  const use = blank(p.useCategory) ? null : p.useCategory!.trim();
  if (!type) return use ? `Teren ${use.toLowerCase()}` : null;
  const t = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  return use && !fold(type).includes(fold(use)) ? `${t} (categoria ${use.toLowerCase()})` : t;
}

function tarlaParcela(p: SaleObjectProperty): string | null {
  const t = blank(p.tarla) ? null : `T ${p.tarla!.trim()}`;
  const pa = blank(p.parcela) ? null : `P ${p.parcela!.trim()}`;
  return t && pa ? `${t} / ${pa}` : (t ?? pa);
}

function localities(props: readonly SaleObjectProperty[]): string | null {
  const seen = new Map<string, string>();
  for (const p of props) if (!blank(p.locality)) seen.set(fold(p.locality!), p.locality!.trim());
  return seen.size ? `loc. ${[...seen.values()].join(", ")}` : null;
}

/** „1/2", „2/3" for a share a person would write as a fraction; otherwise „63,64%". */
export function formatShare(percent: number): string {
  for (let q = 2; q <= 12; q++) {
    const p = Math.round((percent * q) / 100);
    // Within what numeric(7,4) keeps: 1/3 is stored 33.3333; 63,64 is not 7/11 (63.6364).
    if (p > 0 && p < q && Math.abs((p / q) * 100 - percent) < 0.001) {
      // The lowest terms: 2/4 is 1/2.
      const g = gcd(p, q);
      return `${p / g}/${q / g}`;
    }
  }
  return `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(percent)}%`;
}
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The share the sellers sell, in percent — only when it is a part, not the whole, and stated. */
export function soldShare(parties: readonly SaleObjectParty[]): number | null {
  const sellers = parties.filter((p) => p.holdsShare && !blank(p.roleName) && fold(p.roleName!).startsWith("vanzat"));
  const stated = sellers.map((p) => p.cotaParte).filter((c): c is number => typeof c === "number" && Number.isFinite(c) && c > 0);
  if (stated.length === 0 || stated.length !== sellers.length) return null;
  const total = stated.reduce((a, b) => a + b, 0);
  return total < 99.995 ? Math.round(total * 10000) / 10000 : null;
}

const TERENURI = (props: readonly SaleObjectProperty[]) =>
  props.every((p) => fold(p.propertyType ?? "").startsWith("teren") || (blank(p.propertyType) && !blank(p.useCategory)));

/** The description, or "" when no source says anything. */
export function composeSaleObjectDescription({ properties, parties = [], scopVanzare }: SaleObjectSources): string {
  const what: string[] = [];
  if (properties.length === 1) {
    const p = properties[0];
    const a = area(p);
    what.push(
      ...[
        kind(p),
        a !== null ? formatMp(a) : null,
        tarlaParcela(p),
        blank(p.cadastralNumber) ? null : `nr. cad. ${p.cadastralNumber!.trim()}`,
        blank(p.carteFunciara) ? null : `CF ${p.carteFunciara!.trim()}`,
        localities(properties),
      ].filter((x): x is string => x !== null),
    );
  } else if (properties.length > 1) {
    const areas = properties.map(area);
    const known = areas.filter((a): a is number => a !== null);
    const total = known.reduce((a, b) => a + b, 0);
    what.push(
      ...[
        `${properties.length} ${TERENURI(properties) ? "terenuri" : "imobile"}`,
        known.length === 0 ? null : known.length === properties.length ? `${formatMp(total)} în total` : `cel puțin ${formatMp(total)}`,
        localities(properties),
      ].filter((x): x is string => x !== null),
    );
  }
  const why: string[] = [];
  const share = soldShare(parties);
  if (share !== null) why.push(`cotă ${formatShare(share)}`);
  if (scopVanzare === "COMASARE") why.push("pentru comasare");
  if (what.length === 0) return why.join(", ").replace(/^./, (c) => c.toUpperCase());
  return why.length ? `${what.join(", ")} — ${why.join(", ")}` : what.join(", ");
}
