/**
 * Shared constants for the folder-scan / document-extraction API routes.
 *
 * KNOWN_TYPE_KEYS is derived from the seeded rows in lookup_document_type.
 * Keep this list in sync whenever new types are added via migration.
 *
 * Slice #19.06 — folder scan + extract.
 */

export const KNOWN_TYPE_KEYS = [
  "ACT_ADJUDECARE",
  "ACT_CADASTRU",
  "ACT_DONATIE",
  "AUTORIZATIE",
  "AUTORIZATIE_ALT",
  "AUTORIZATIE_CONSTRUIRE",
  "AVIZ_INSTITUTIE",
  "CARTE_IDENTITATE",
  "CARTE_IDENTITATE_ALT",
  "CASA",
  "CERTIFICAT_FISCAL",
  "CERTIFICAT_MOSTENITOR",
  "CERTIFICAT_SARCINI",
  "CERTIFICAT_SARCINI_ALT",
  "CERTIFICAT_URBANISM",
  "CONTRACT_ARENDA",
  "CONTRACT_INCHIRIERE",
  "CONTRACT_PARTAJ",
  "CONTRACT_PRESTARI_SERVICII",
  "CONTRACT_VANZARE",
  "DOCUMENTATIE_CADASTRALA",
  "EXTRAS_CARTE_FUNCIARA",
  "EXTRAS_CARTE_FUNCIARA_ALT",
  "EXTRAS_PUG",
  "HOTARARE_ADMINISTRATIVA",
  "HOTARARE_JUDECATOREASCA",
  "LINIARA",
  "PASUNE",
  "TEREN_ARABIL",
  "TEREN_CONSTRUIT",
  "TESTAMENT",
  "TITLU_PROPRIETATE",
  "UNCLASSIFIED",
] as const;

export type KnownTypeKey = (typeof KNOWN_TYPE_KEYS)[number];

// ---------------------------------------------------------------------------
// Phase 1 — classification (Haiku 4.5, cheap)
// ---------------------------------------------------------------------------

export const CLASSIFY_SYSTEM_PROMPT = `You classify Romanian official documents from scanned images or photos.
Your job is to identify what kind of document it is and whether structured data can be extracted from it.

Known document type keys (choose the closest match, or UNCLASSIFIED):
${KNOWN_TYPE_KEYS.join(", ")}

Respond with ONLY a single JSON object, no prose, no markdown fences.

Shape:
{
  "classifiedLabel": string,       // short human-readable Romanian name, e.g. "Titlu de Proprietate"
  "suggestedTypeKey": string,      // one of the known keys above, or null if none fits
  "institution": string | null,    // issuing authority, e.g. "OCPI Ilfov" or "Judecatoria Sectorului 6"
  "confidence": "high" | "medium" | "low",
  "extractable": boolean,          // true if structured fields (title, number, date, parties) can be read
  "notes": string | null           // optional 1-sentence note about unusual features or why it is not extractable
}

Rules:
- CARTE_IDENTITATE only when the document is clearly a Romanian national ID card (CI) or a similar personal identity card.
- If the image is blank, rotated beyond reading, or is a photograph of furniture/people (not a document), set extractable=false and suggestedTypeKey=null.
- If the document title is in the top-right corner (ANCPI template code), that is a strong signal — use it.
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;

// ---------------------------------------------------------------------------
// Phase 2 — extraction (Sonnet 4.6, per approved file)
// ---------------------------------------------------------------------------

export const EXTRACT_SYSTEM_PROMPT = `You extract structured data from scanned Romanian official documents.
Respond with ONLY a single JSON object, no prose, no markdown fences.

Fields to extract (all nullable — only set what you can actually read):
{
  "fields": {
    "title": string | null,              // document title as printed
    "nrDocument": string | null,         // document number (nr. / no.)
    "dateDocument": string | null,       // issue date, ISO yyyy-mm-dd
    "institution": string | null,        // issuing institution
    "institutionId": string | null,      // institution internal code / CUI if printed
    "emitent": string | null,            // signatory / emitent name
    "bazaLegala": string | null,         // legal basis reference (lege, articol)
    "uatProprietate": string | null,     // UAT of the property
    "uatProprietar": string | null,      // UAT of the owner
    "suprafata": string | null,          // area/surface in m2 or ha — numeric string only, digits + decimal separator
    "nrDosarSuccesoral": string | null,  // succession dossier number
    "dataDecesului": string | null,      // date of death, ISO yyyy-mm-dd
    "ultimulDomiciliu": string | null,   // last domicile of deceased
    "nrCertificatDeces": string | null,  // death certificate number
    "dateStart": string | null,          // period start date, ISO yyyy-mm-dd
    "dateEnd": string | null,            // period end date, ISO yyyy-mm-dd
    "titularText": string | null,        // name of the holder / titular
    "defunctText": string | null,        // name of the deceased
    "partiesAText": string | null,       // party A names (seller / proprietar / creditor etc.)
    "partiesBText": string | null,       // party B names (buyer / dobanditor / debitor etc.)
    "subject": string | null,            // brief subject / object of the document
    "notes": string | null               // any important information not captured by the above fields
  },
  "lowConfidenceFields": string[],       // field keys where you are not confident in the reading
  "unmappedRaw": { [label: string]: string }  // other printed text that does not fit any field above
}

Rules:
- Dates must be ISO yyyy-mm-dd or null. Convert Romanian format (zi.luna.an) to ISO.
- suprafata: numeric value only (e.g. "1234.56" or "0.45"), no units.
- Do not guess. If a field is not visible or not applicable for this document type, return null.
- Output strictly valid JSON — no comments, no trailing commas, no markdown code fences.`;
