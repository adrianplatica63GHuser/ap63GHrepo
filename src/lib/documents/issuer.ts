/**
 * A document's issuer — a juridical person, preferably of a public-body type.            (Slice #39.72)
 *
 * migration_115 (39.71) made every institution of the „Instituții” list a juridical person; migration_116 dropped the
 * list, so the issuer field on every document type (Emitent, Notariat, Instanță / Autoritate, …) picks a person. The
 * picker offers the juridical persons whose type is a public-body type (`lookup_judicial_person_type.public_body`)
 * first, and every juridical person on search.
 *
 * The AI reads the issuer off the pages (`issuerRead`) and the screen offers that reading as a PROPOSAL (D-12, #34.02):
 * an existing person it names is offered with one click, and a body the archive does not hold yet is made only when a
 * person presses the button — with the type its name suggests, and then the ANAF lookup (39.64) when it has a CIF.
 *
 * PURE: no React, no DB. Unit-tested in src/__tests__/document-issuer.test.ts.
 */
import { foldLookupName, matchInstitution, type NamedLookupRow } from "@/lib/import/lookup-name-match";

/** One juridical person the issuer picker can offer. */
export type IssuerOption = {
  id: string;
  code: string;
  displayName: string;
  /** The person's type name, or null. */
  typeName: string | null;
  /** Its type is a public-body type. */
  publicBody: boolean;
  cuiNumber: string | null;
};

/** A public-body type, as the picker's endpoint lists them. */
export type PublicBodyType = { id: string; name: string };

/**
 * The public-body type a name suggests, as migration_115 typed the institutions it converted — the same rules, in the
 * same order, on the same fold. First the name's own words (a court, a notary, a bailiff, a lawyer, a territorial or a
 * central authority, a town hall or a council), and nothing when the name says none of them: a guess the name does
 * not support would type a body wrongly in silence, and „—” is a value the person can see and change.
 */
const NAME_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(judecatori|tribunal|curtea )/, "Instanță"],
  [/notar/, "Birou notarial"],
  [/executor/, "Birou de executor judecătoresc"],
  [/avocat/, "Cabinet sau societate de avocatură"],
  [/^(ocpi|ajfp|dgrfp|institutia prefectului|prefectura)/, "Instituție publică teritorială"],
  [/^(anaf|ancpi|ministerul|guvernul)/, "Autoritate publică centrală"],
  [/^(primaria|consiliu|consiliul|spclep|serviciul public comunitar)/, "Autoritate locală"],
];

/** The name of the public-body type `name` suggests, or null. */
export function publicBodyTypeNameFor(name: string | null | undefined): string | null {
  const folded = foldLookupName(name ?? "");
  if (folded === "") return null;
  for (const [re, type] of NAME_RULES) if (re.test(folded)) return type;
  return null;
}

/** The id of that type among `types`, matched on the fold — or null when the archive has no such type. */
export function publicBodyTypeIdFor(name: string | null | undefined, types: readonly PublicBodyType[]): string | null {
  const typeName = publicBodyTypeNameFor(name);
  if (typeName === null) return null;
  const want = foldLookupName(typeName);
  return types.find((t) => foldLookupName(t.name) === want)?.id ?? null;
}

/**
 * The juridical person the AI's reading names, among `options`, or null — the matcher the identity cards and the
 * cited documents already use (`matchInstitution`: exact, contained as a word, then the aliases), over the persons'
 * names. A null is an instruction to ASK, never a licence to create.
 */
export function matchIssuer(raw: string | null | undefined, options: readonly IssuerOption[]): string | null {
  const rows: NamedLookupRow[] = options.map((o) => ({ id: o.id, name: o.displayName }));
  return matchInstitution(raw, rows);
}

/** The picker's order: public-body persons first, then by name (Romanian collation), then by code. */
export function sortIssuers(options: readonly IssuerOption[]): IssuerOption[] {
  return [...options].sort(
    (a, b) =>
      Number(b.publicBody) - Number(a.publicBody) ||
      a.displayName.localeCompare(b.displayName, "ro") ||
      a.code.localeCompare(b.code),
  );
}

/**
 * The options the select shows: the public-body persons, then — so a value is never blank on screen — the document's
 * own issuer and the persons picked by search in this session, when the list does not already hold them.
 */
export function issuerSelectOptions(
  listed: readonly IssuerOption[],
  extra: readonly { id: string; displayName: string }[],
): { value: string; label: string }[] {
  const out = sortIssuers(listed).map((o) => ({ value: o.id, label: o.displayName }));
  const seen = new Set(out.map((o) => o.value));
  for (const e of extra) {
    if (!e.id || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push({ value: e.id, label: e.displayName });
  }
  return out;
}
