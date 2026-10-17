/**
 * ANAF's answer for one CUI, read into what a juridical person's form holds.                         (Slice #39.64)
 *
 * The service is ANAF's „PlatitorTvaRest" (v9, documented 2025-02-04 in doc_WS_V9.txt):
 *   POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva   [{"cui": <n>, "data": "yyyy-MM-dd"}]
 * free, no key, one request a second. It answers `{ found: [...], notFound: [...] }`, and each found entry carries
 * `date_generale` (denumire, nrRegCom, telefon, forma_juridica, …), a structured `adresa_sediu_social` and a
 * `stare_inactiv` block.
 *
 * Pure and free of server imports: the form and the parties step read `AnafCompany` too.
 */

export const ANAF_VERSION = "v9";
export const ANAF_URL = `https://webservicesp.anaf.ro/api/PlatitorTvaRest/${ANAF_VERSION}/tva`;

export type AnafAddress = {
  streetLine: string;
  postalCode: string;
  locality: string;
  county: string;
  country: string;
};

export type AnafCompany = {
  cui: string;
  name: string;
  tradeRegisterNumber: string;
  phone: string;
  address: AnafAddress;
  /** As ANAF writes it — „SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ", say — or "". */
  legalForm: string;
  /** Inactive for tax purposes: the date it became so (yyyy-MM-dd), or "" when ANAF gives none. Null = active. */
  inactiveSince: string | null;
  /** Struck off the register: the date, or null. */
  deregisteredOn: string | null;
};

export type AnafAnswer = { kind: "found"; company: AnafCompany } | { kind: "notFound" };

/**
 * A CUI as a person types it — „RO 14399840", „ro14399840", „14 399 840" — to its digits, or null when it is not one.
 * A Romanian CUI is 2 to 10 digits and never starts with 0.
 */
export function normalizeCui(input: string | null | undefined): string | null {
  const s = (input ?? "").replace(/\s+/g, "").replace(/^RO/i, "");
  return /^[1-9]\d{1,9}$/.test(s) ? s : null;
}

/** ANAF often writes ş and ţ with a cedilla; the archive's Romanian uses the comma below. */
export function commaBelow(s: string): string {
  return s.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");
}

function text(v: unknown): string {
  return typeof v === "string" ? commaBelow(v.replace(/\s+/g, " ").trim()) : typeof v === "number" ? String(v) : "";
}

function date(v: unknown): string | null {
  const s = text(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

/** ANAF writes counties in capitals — „BACĂU", „MUNICIPIUL BUCUREȘTI"; the archive writes „Bacău". Mixed case is kept. */
export function countyCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
}

/** „Str. Foișorului" + „7" + „Bl. A, Ap. 3" → „Str. Foișorului nr. 7, Bl. A, Ap. 3". */
export function anafStreetLine(street: string, number: string, details: string): string {
  const head = [street, number ? `nr. ${number}` : ""].filter(Boolean).join(" ");
  return [head, details].filter(Boolean).join(", ");
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

/**
 * One found entry → the company. The structured head-office address is preferred; when ANAF sends none, the street
 * line is `date_generale.adresa` whole, as ANAF wrote it, and the other address fields stay empty.
 */
export function readAnafEntry(entry: unknown, cui: string): AnafCompany {
  const e = rec(entry);
  const g = rec(e.date_generale);
  const a = rec(e.adresa_sediu_social);
  const inactive = rec(e.stare_inactiv);
  const street = anafStreetLine(text(a.sdenumire_Strada), text(a.snumar_Strada), text(a.sdetalii_Adresa));
  const structured = Boolean(street || text(a.sdenumire_Localitate));
  const isInactive = inactive.statusInactivi === true;
  return {
    cui: text(g.cui) || cui,
    name: text(g.denumire),
    tradeRegisterNumber: text(g.nrRegCom),
    phone: text(g.telefon),
    address: structured
      ? {
          streetLine: street,
          postalCode: text(a.scod_Postal) || text(g.codPostal),
          locality: text(a.sdenumire_Localitate),
          county: countyCase(text(a.sdenumire_Judet)),
          country: text(a.stara) || "România",
        }
      : { streetLine: text(g.adresa), postalCode: text(g.codPostal), locality: "", county: "", country: text(g.adresa) ? "România" : "" },
    legalForm: text(g.forma_juridica),
    inactiveSince: isInactive ? date(inactive.dataInactivare) ?? "" : null,
    deregisteredOn: date(inactive.dataRadiere),
  };
}

/** The service's whole answer for one CUI. Anything that is not its shape is thrown, and the route calls that „down". */
export function readAnafAnswer(body: unknown, cui: string): AnafAnswer {
  const b = rec(body);
  if (!Array.isArray(b.found) && !Array.isArray(b.notFound)) throw new Error("ANAF answered without found / notFound");
  const found = (Array.isArray(b.found) ? b.found : []).find((f) => text(rec(rec(f).date_generale).cui) === cui)
    ?? (Array.isArray(b.found) && b.found.length === 1 ? b.found[0] : undefined);
  if (found === undefined) return { kind: "notFound" };
  const company = readAnafEntry(found, cui);
  return company.name ? { kind: "found", company } : { kind: "notFound" };
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * The archive's „Tip" for ANAF's legal form, by the names „Date de referință" holds today (SRL, SA, SRL-D, PFA, II,
 * IF, ONG, Altele) — a proposal the user sees and may untick. A form it does not recognise proposes „Altele"; no form
 * at all proposes nothing.
 */
export function proposedTypeName(legalForm: string): string | null {
  const f = fold(legalForm);
  if (!f.trim()) return null;
  if (/debutant/.test(f)) return "SRL-D";
  if (/raspundere limitata/.test(f)) return "SRL";
  if (/pe actiuni|societate pe actiuni/.test(f)) return "SA";
  if (/persoana fizica autorizata/.test(f)) return "PFA";
  if (/intreprindere individuala/.test(f)) return "II";
  if (/intreprindere familiala/.test(f)) return "IF";
  if (/asociatie|fundatie|organizatie neguvernamentala|federatie/.test(f)) return "ONG";
  return "Altele";
}

/** The id of the type named `name` in the list, matched without case or diacritics — or null. */
export function typeIdByName(types: readonly { id: string; name: string }[], name: string | null): string | null {
  if (!name) return null;
  return types.find((t) => fold(t.name).trim() === fold(name).trim())?.id ?? null;
}
