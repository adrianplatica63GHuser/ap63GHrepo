/**
 * The document-type catalogue the classifier is taught, and the ONE place that
 * decides whether a key it hands back is usable.
 *
 * `KNOWN_DOCUMENT_TYPES` is this codebase's copy of `lookup_document_type`:
 * every (key, name) pair a seeded database holds.
 * `src/__tests__/document-type-catalogue-single-source.test.ts` binds it to
 * `src/db/sync-reference-data.sql` in BOTH directions, and to the two
 * migrations that changed the row set after that file was written, so the list
 * and the catalogue cannot drift apart again without a test going red.
 *
 * WHY THE INVARIANT IS NOT DECORATION
 * -----------------------------------
 * Slice #23.01.Import wrote the warning; Slice #29.07 is the slice that made it
 * true. A key in this list with no seeded row is not harmless: the scan route
 * whitelists the model's `suggestedTypeKey` against these keys, the resolver
 * then finds no stored row carrying it and — before #29.07 — fell through to
 * creating a type from the free-text LABEL, so the document landed under a slug
 * of the display name and every carve-out that matches the canonical key was
 * looking at a key that would never appear again in that database. Measured in
 * the 29.01 report, finding F6: the sales contract came back CONTRACT_VANZARE
 * and both identity cards CARTE_IDENTITATE — canonical keys, both on this list
 * — and all three were filed under keys generated from the label.
 * `CARTE_DE_IDENTITATE`, not `CARTE_IDENTITATE`, so `ID_CARD_TYPE_KEYS` (which
 * matches the literal key) never found them again.
 *
 * #29.07 closed it from both ends. The three keys that had no seeded row —
 * AUTORIZATIE_CONSTRUIRE, DOCUMENTATIE_CADASTRALA and HOTARARE_ADMINISTRATIVA,
 * seeded by `migration_035_seed_doc_types.sql` and missing from
 * `sync-reference-data.sql` — are in the seed now; and `canonicalTypeKey` below
 * feeds `resolveClassifiedDocumentType`, so when a type does have to be created
 * the key the codebase already defines is the key the row gets.
 *
 * ⚠️ **AUTORIZATIE IS GONE FROM THIS LIST AND THAT IS NOT AN OVERSIGHT.**
 * `migration_043_doctype_cleanup.sql` DELETES that row (key `AUTORIZATIE`, name
 * `Autorizare`) after reassigning its documents, its version snapshots and its
 * person-role pairs to AUTORIZATIE_ALT (`Autorizație`) — so on a migrated
 * database the key resolves to nothing, which is the same invariant broken in
 * the other direction. `sync-reference-data.sql` was still seeding the row and
 * no longer does.
 *
 * ⚠️ **CERTIFICAT_SARCINI READS AS THE WRONG NAME, AND IT IS A NAMING DECISION
 * RATHER THAN A SWAP.** The key is paired with `Certificat de Bunuri` while
 * CERTIFICAT_SARCINI_ALT carries `Certificat de Sarcini`, which is the wrong
 * way round to anyone reading the Romanian — so it was worth establishing which
 * it is, and this is where the answer is finally written down. The history, in
 * three files: `migration_009_fix_diacritics.sql:53` named the row at
 * sort_order 7 `Certificat de Bunuri`;
 * `migration_020_rename_to_document.sql:64` backfilled `key` by matching that
 * display NAME against the old `paperwork_type` enum and so chose
 * CERTIFICAT_SARCINI; `migration_021_keep_alternate_wordings.sql:15-16` then
 * recorded the pair as settled and added the second wording as its own type.
 * Nothing ever named CERTIFICAT_SARCINI `Certificat de Sarcini`, so there is no
 * swap to undo — the key is simply older than the name beside it, and `key` is
 * immutable by design (migration_020), so renaming the key is not on the table.
 * What the mismatch costs is a model told only `CERTIFICAT_SARCINI` filing an
 * encumbrance certificate under a row the user sees as "Certificat de Bunuri".
 * The remedy is below and it is why this list carries names at all: the classify
 * prompt shows the stored NAME beside every key, so the model chooses between
 * two visible Romanian names instead of between two keys that look
 * interchangeable. Renaming the display value would be a data change needing a
 * migration, and it is not this slice's.
 *
 * Six entries were removed by Slice #23.01.Import and stay removed:
 *
 *   CARTE_IDENTITATE_ALT  - never seeded. migration_021 deliberately defines
 *                           the only three alternate Romanian wordings
 *                           (the AUTORIZATIE, CERTIFICAT_SARCINI and
 *                           EXTRAS_CARTE_FUNCIARA families -- of which
 *                           AUTORIZATIE's base row was later deleted by
 *                           migration_043, leaving AUTORIZATIE_ALT alone);
 *                           "Carte de Identitate"
 *                           has one wording. Offering the key made an ID
 *                           card land under an auto-created type, so
 *                           getPersonIdCardLink (which matches the literal
 *                           key CARTE_IDENTITATE) never found it.
 *   CASA, LINIARA, PASUNE, TEREN_ARABIL, TEREN_CONSTRUIT
 *                         - these are lookup_PROPERTY_type keys
 *                           (migration_039), not document types. Listing
 *                           them invited the model to classify a document as
 *                           a kind of land parcel.
 *
 * Slice #19.06 — folder scan + extract.
 */

import { UNCLASSIFIED_DOCUMENT_TYPE_KEY } from "@/lib/documents/document-type-match";

/**
 * ⚠️ **The NAME is the one a seeded database stores, byte for byte** — including
 * `Autorizație De Construire`'s odd capital "De", which is what
 * `migration_035_seed_doc_types.sql` wrote and therefore what the row is
 * called. The single-source test compares these strings against the seed file
 * exactly; a tidier spelling here would be a lie about the database, not a
 * typo fixed.
 *
 * ⚠️ **UNCLASSIFIED is a catalogue row and NOT an answer.** It is listed here
 * because `lookup_document_type` really holds it and the invariant this list
 * exists for is about rows; `canonicalTypeKey` below refuses it, and every
 * prompt renders the list without it. Its display name is `NECLASIFICAT` on a
 * migrated database and, since #29.07, on a rebuilt one too — that divergence
 * was `src/db/rebuild-known-differences.txt`'s and is closed.
 */
export const KNOWN_DOCUMENT_TYPES = [
  { key: "ACT_ADJUDECARE",             name: "Act de Adjudecare" },
  { key: "ACT_CADASTRU",               name: "Act Cadastru" },
  { key: "ACT_DONATIE",                name: "Act de Donație" },
  { key: "AUTORIZATIE_ALT",            name: "Autorizație" },
  { key: "AUTORIZATIE_CONSTRUIRE",     name: "Autorizație De Construire" },
  { key: "AVIZ_INSTITUTIE",            name: "Aviz de Instituție" },
  { key: "CARTE_IDENTITATE",           name: "Carte de Identitate" },
  { key: "CERTIFICAT_FISCAL",          name: "Certificat Fiscal" },
  { key: "CERTIFICAT_MOSTENITOR",      name: "Certificat de Moștenitor" },
  { key: "CERTIFICAT_SARCINI",         name: "Certificat de Bunuri" },
  { key: "CERTIFICAT_SARCINI_ALT",     name: "Certificat de Sarcini" },
  { key: "CERTIFICAT_URBANISM",        name: "Certificat de Urbanism" },
  { key: "CONTRACT_ARENDA",            name: "Contract de Arendă" },
  { key: "CONTRACT_INCHIRIERE",        name: "Contract de Închiriere" },
  { key: "CONTRACT_PARTAJ",            name: "Contract de Partaj" },
  { key: "CONTRACT_PRESTARI_SERVICII", name: "Contract de Prestări Servicii" },
  { key: "CONTRACT_VANZARE",           name: "Contract de Vânzare" },
  { key: "DOCUMENTATIE_CADASTRALA",    name: "Documentație Cadastrală" },
  { key: "EXTRAS_CARTE_FUNCIARA",      name: "Extras din Carte Funciară" },
  { key: "EXTRAS_CARTE_FUNCIARA_ALT",  name: "Extras de Carte Funciară" },
  { key: "EXTRAS_PUG",                 name: "Extras din PUG" },
  { key: "HOTARARE_ADMINISTRATIVA",    name: "Hotărâre Administrativă" },
  { key: "HOTARARE_JUDECATOREASCA",    name: "Hotărâre Judecătorească" },
  { key: "TESTAMENT",                  name: "Testament" },
  { key: "TITLU_PROPRIETATE",          name: "Titlu de Proprietate" },
  { key: "UNCLASSIFIED",               name: "NECLASIFICAT" },
] as const;

export type KnownDocumentType = (typeof KNOWN_DOCUMENT_TYPES)[number];
export type KnownTypeKey = KnownDocumentType["key"];

/**
 * The same catalogue as keys alone — what every existing caller whitelists
 * against. Derived rather than restated: a second literal list is a second
 * thing to forget.
 */
export const KNOWN_TYPE_KEYS: readonly KnownTypeKey[] =
  KNOWN_DOCUMENT_TYPES.map((type) => type.key);

/**
 * The key a classifier's answer actually gives us, or `null`.   (Slice #29.07)
 *
 * ⚠️ **ONE POSITION ON UNCLASSIFIED, WHERE THERE WERE THREE.** The scan route
 * whitelisted the key and let UNCLASSIFIED through; `ai-interpret` whitelisted
 * it and stripped UNCLASSIFIED; `matchDocumentType` whitelisted nothing and
 * skipped UNCLASSIFIED. Each was defensible alone and together they were three
 * places to edit when the rule changed — so the rule is here, and the three
 * callers ask it. What it says: **an UNCLASSIFIED key is the ABSENCE of an
 * answer, not an answer**, because filing a document under the catch-all on the
 * strength of it makes "the model had no idea" and "the model said
 * NECLASIFICAT" one indistinguishable outcome. That is finding F1.
 *
 * ⚠️ **`matchDocumentType`'s own UNCLASSIFIED skip STAYS, and is not
 * redundant.** This function guards the boundary where a MODEL's output is
 * read; that rule guards a `ClassifierAnswer` reaching it from anywhere,
 * including a `typeKey` posted to `/api/document-types/resolve` by a client
 * this route cannot vouch for. Two guards on two different inputs, not one
 * guard written twice.
 *
 * ⚠️ **Stripping UNCLASSIFIED at the scan boundary is behaviour-preserving for
 * `isIdCardEntry`, measured rather than assumed.** That function reads the
 * scan's `typeKey` and treats "a missing key" and "the explicitly-uncertain
 * UNCLASSIFIED" identically — both fall through to its label heuristic — so a
 * `null` where UNCLASSIFIED used to be takes the same branch. Those are the
 * only two readers of `ScanResult.typeKey`; the other is `ensureDocType`, which
 * hands it straight to the resolver.
 */
export function canonicalTypeKey(raw: unknown): KnownTypeKey | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === UNCLASSIFIED_DOCUMENT_TYPE_KEY) return null;
  return (KNOWN_TYPE_KEYS as readonly string[]).includes(trimmed)
    ? (trimmed as KnownTypeKey)
    : null;
}

/**
 * The catalogue as prompt text: one `KEY — Romanian name` per line, without the
 * catch-all.
 *
 * The names are here because the keys alone are not enough to choose between
 * CERTIFICAT_SARCINI and CERTIFICAT_SARCINI_ALT — see the module header. Both
 * prompts render the same list, so the extract prompt's "same list as classify"
 * is now true by construction rather than by two `join`s agreeing.
 */
const KNOWN_TYPE_LINES = KNOWN_DOCUMENT_TYPES
  .filter((type) => type.key !== UNCLASSIFIED_DOCUMENT_TYPE_KEY)
  .map((type) => `  ${type.key} — ${type.name}`)
  .join("\n");

// ---------------------------------------------------------------------------
// Phase 1 — classification (Haiku 4.5, cheap)
// ---------------------------------------------------------------------------

export const CLASSIFY_SYSTEM_PROMPT = `You classify Romanian official documents from scanned images or photos.
Your job is to identify what kind of document it is and whether structured data can be extracted from it.

Known document types — the KEY, then the Romanian name it is stored under.
Choose the closest match, or null when none of them fits:
${KNOWN_TYPE_LINES}

Respond with ONLY a single JSON object, no prose, no markdown fences.

Shape:
{
  "classifiedLabel": string,       // short human-readable Romanian name, e.g. "Titlu de Proprietate"
  "suggestedTypeKey": string | null,  // one of the known keys above, or null if none fits
  "confidence": "high" | "medium" | "low",
  "extractable": boolean,          // true if structured fields (title, number, date) can be read
  "notes": string | null           // optional 1-sentence note about unusual features or why it is not extractable
}

Rules:
- CARTE_IDENTITATE only when the document is clearly a Romanian national ID card (CI) or a similar personal identity card.
- Choose between two keys by the NAME beside them, never by the key alone. CERTIFICAT_SARCINI is stored as "Certificat de Bunuri" and CERTIFICAT_SARCINI_ALT as "Certificat de Sarcini"; AUTORIZATIE_ALT is the general "Autorizație" and AUTORIZATIE_CONSTRUIRE is a building permit.
- If the image is blank, rotated beyond reading, or is a photograph of furniture/people (not a document), set extractable=false and suggestedTypeKey=null.
- If the document title is in the top-right corner (ANCPI template code), that is a strong signal — use it.
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;

// ---------------------------------------------------------------------------
// Slice #21.03.Import — per-type extraction prompt (document-detail AI Interpret)
// ---------------------------------------------------------------------------
//
// A fixed EXTRACT_SYSTEM_PROMPT used to sit above this block, serving the
// orphaned Import-wizard's extract-document route. Slice #23.04.Import deleted
// both; the scan-folder route keeps using CLASSIFY_SYSTEM_PROMPT above.
//
// The document-detail "AI Interpret" action
// (src/app/api/documents/[id]/ai-interpret/route.ts) builds its prompt
// dynamically instead: a small fixed baseline (title, nrDocument,
// dateDocument, subject — the fields every document type shows after the
// Slice #21.03.Import Phase 1 UI simplification) plus, when the document's
// type has one, that type's template_fields (see
// src/lib/documents/template-fields.ts). Anything the model finds that
// doesn't fit a known field — generic or template — goes into "unmappedRaw"
// and is folded into the document's Notes field by the route, never dropped.

import { templateFieldFormatHint, type DocumentTemplateField } from "@/lib/documents/template-fields";

export const GENERIC_EXTRACT_FIELD_DESCRIPTIONS: Record<string, string> = {
  title:        "document title as printed",
  nrDocument:   "document number (nr. / no.)",
  dateDocument: "issue date, ISO yyyy-mm-dd",
  subject:      "brief subject / object of the document",
};

// ---------------------------------------------------------------------------
// Slice #21.04.Import (party extraction) — structured people/organizations
// acting in one of the document type's configured lookup_doc_type_person_role
// roles (e.g. "Vânzător", "Cumpărător", "Notar", "Reprezentant legal /
// Mandatar"). Fully data-driven: the caller passes whatever role names are
// actually configured for the document's type — this module has no
// hardcoded notion of "seller" or "buyer". If a type has no roles configured
// at all, the caller should omit partyRoleNames (or pass []) and skip this
// section entirely rather than asking the model to guess at role names —
// matching the app's "admin-managed roles, never auto-guessed" convention.
// ---------------------------------------------------------------------------

export function buildExtractSystemPrompt(
  templateFields: DocumentTemplateField[],
  partyRoleNames: string[] = [],
): string {
  const genericLines = Object.entries(GENERIC_EXTRACT_FIELD_DESCRIPTIONS)
    .map(([key, desc]) => `    "${key}": string | null,  // ${desc}`)
    .join("\n");

  const customLines = templateFields
    .map((f) => {
      const hint = f.aiHint?.trim() ? ` — ${f.aiHint.trim()}` : "";
      return `    "${f.key}": string | null,  // ${templateFieldFormatHint(f.type)}${hint} (${f.labelRo})`;
    })
    .join("\n");

  const partiesSection = partyRoleNames.length > 0
    ? `,
  "parties": [                            // people/organizations acting in one of these roles for THIS document: ${partyRoleNames.join(", ")}
    {
      "roleName": string,                 // must exactly match one of: ${partyRoleNames.join(", ")}
      "personType": "NATURAL" | "JUDICIAL",
      "name": string | null,              // judicial: full legal name. natural: leave null if firstName/lastName given below
      "firstName": string | null,         // natural person only
      "lastName": string | null,          // natural person only
      "cnp": string | null,               // Romanian CNP (natural person only), digits only
      "cuiNumber": string | null,         // Romanian CUI (judicial person only)
      "idDocumentNumber": string | null,  // ID card series+number (natural person only)
      "idIssuingAuthority": string | null,
      "domiciliu": string | null,         // address / registered office, as printed
      "rawText": string                   // the full original text describing this party, verbatim
    }
  ]`
    : "";

  const partiesRule = partyRoleNames.length > 0
    ? "\n- \"parties\": one entry per distinct real person or organization — if a role has several people (e.g. multiple sellers), include one entry per person, all with the same roleName. Only include a party if the document actually names a specific person/organization for that role; never invent or guess an entry. Do not also repeat this party's information under \"unmappedRaw\" — parties are captured once, here."
    : "";

  return `You extract structured data from scanned Romanian official documents.
Respond with ONLY a single JSON object, no prose, no markdown fences.

Known document types (the same list the classify step is given) — the KEY, then the Romanian name it is stored under. Choose the closest, or null:
${KNOWN_TYPE_LINES}

Shape:
{
  "suggestedTypeKey": string | null,     // one of the known keys above, or null if none fits
  "classifiedLabel": string | null,      // short human-readable Romanian name for this document type
  "fields": {
${genericLines}${customLines ? "\n" + customLines : ""}
  },
  "lowConfidenceFields": string[],       // field keys (generic or type-specific) where you are not confident
  "unmappedRaw": { [label: string]: string }  // ANY other printed text that does not fit a field above — never drop information${partiesSection}
}

Rules:
- Dates must be ISO yyyy-mm-dd or null. Convert Romanian format (zi.luna.an) to ISO.
- Numbers must be numeric strings only (digits + decimal separator), no units.
- Do not guess. If a field is not visible or not applicable for this document, return null.${partiesRule}
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;
}

// ---------------------------------------------------------------------------
// Slice #21.10.Import — discover mode (schema-free reading)
// ---------------------------------------------------------------------------
//
// buildExtractSystemPrompt above is SCHEMA-DRIVEN: it hands the model a target
// field list (the generic baseline plus the type's template_fields) and asks it
// to fill those in, with `unmappedRaw` as the leftovers channel. That works well
// for a document type we already understand.
//
// It works badly for a type we do NOT understand yet. With no template the
// model is told to look for four fields and dump everything else into one flat
// map — and because that map is framed as leftovers, the model self-censors: it
// answers "what else is printed here?" rather than "read me this document".
// Adrian's ask (Slice #21.10.Import) is the opposite framing.
//
// So discover mode gives the model NO target fields at all. It asks for two
// lists instead:
//   recognised — every label -> value pair, both sides VERBATIM as printed
//   sections   — everything else, grouped by the model's own inferred headings,
//                in document order
//
// Nothing here is persisted. The result is printed to the dev-server console
// (see src/lib/documents/discover-log.ts) and returned in the response body so
// the same run can be inspected via browser automation — the precedent set by
// Slice #21.02.Import when it stopped making these diagnostics console-only.
//
// The deliberate design choice is VERBATIM on both sides of a pair. Normalising
// "Nr. cadastral" to some canonical key, or reformatting its value, is exactly
// the schema-fitting this mode exists to avoid: the printed Romanian label is
// the evidence for what a future template field should be called, and a
// normalised label has already thrown that evidence away.

export function buildDiscoverSystemPrompt(): string {
  return `You are reading a Romanian official document whose type this system does not yet understand.
There is NO target field list. Do not try to fit the document into a schema.
Your job is to report EVERYTHING the document says, split into two lists.

Respond with ONLY a single JSON object, no prose, no markdown fences.

Shape:
{
  "documentLabel": string | null,   // short Romanian name for what this appears to be, e.g. "Contract de arendă"
  "recognised": [                   // every label -> value pair you can read anywhere in the document
    {
      "name":       string,         // the label EXACTLY as printed in Romanian, e.g. "Nr. cadastral"
      "value":      string,         // the value EXACTLY as printed
      "confidence": "high" | "medium" | "low"
    }
  ],
  "sections": [                     // everything that is NOT a label -> value pair
    {
      "heading": string,            // the heading as printed, or a short Romanian description you infer if the block is unheaded
      "lines":   [string]           // that block's lines, verbatim, in the order printed
    }
  ]
}

Rules:
- "recognised" is for anything that reads as a field: a printed label followed by a value ("Nr. 1234", "Data: 12.04.2021", "Suprafață: 2.500 mp", a filled-in form box).
- VERBATIM ON BOTH SIDES. Do not translate the label. Do not rename it to a tidier or more canonical field name. Do not reformat the value — leave dates as "12.04.2021" if that is what is printed, leave "2.500,00 RON" with its Romanian separators. The exact printed wording is the point.
- "sections" is for prose, clauses, tables, signature blocks, stamps, headers and footers — anything with no label/value shape. Preserve document order, top to bottom, first page to last.
- Every piece of printed text must appear in exactly ONE of the two lists. Do not summarise, do not paraphrase, do not omit boilerplate, do not drop text you judge unimportant. Completeness matters more than tidiness in this mode.
- If something is hard to read, still report it and set confidence "low" — never drop it for being uncertain.
- Report what is printed, not what you infer it means. Never invent a label that is not on the page.
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;
}
