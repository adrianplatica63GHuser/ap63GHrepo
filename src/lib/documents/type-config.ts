/**
 * Per-type UI configuration for the Document form.
 *
 * Each document type declares:
 *  - which sections are visible in the form
 *  - per-type overrides for common field labels (nrDocument, dateDocument,
 *    institution)
 *
 * Label strings are Romanian — they are domain terms that stay the same
 * regardless of the active locale (same as "Tarla/Sola", "Carte Funciară" in
 * the Property form).
 *
 * NOTE (Slice #15.05): configs are now keyed by `lookup_document_type.key`
 * (a plain string slug, e.g. "CONTRACT_VANZARE") instead of the old
 * `PaperworkType` enum. The literal key values are unchanged — only the
 * source of truth moved from a hardcoded Postgres enum to an admin-managed
 * lookup table row.
 */

export type TypeConfig = {
  /** Show Emitent + Baza Legala + UAT + Suprafata fields */
  showTitlu:        boolean;
  /** Show Certificat Mostenitor-specific fields */
  showMostenitor:   boolean;
  /** Show dateStart + dateEnd fields */
  showDateRange:    boolean;
  /** Show date_valid_until field (validity/expiry date for decisions, permits) */
  showValidUntil:   boolean;
  /** Show surveyor FK picker (for DOCUMENTATIE_CADASTRALA) */
  showSurveyor:     boolean;

  /** Override labels for common fields (Romanian domain terms) */
  labels: {
    nrDocument:   string;
    dateDocument: string;
    institution:  string;
  };
};

// ---------------------------------------------------------------------------
// Generic / fallback config — used for all types without a specific entry
// ---------------------------------------------------------------------------

const GENERIC: TypeConfig = {
  showTitlu:      false,
  showMostenitor: false,
  showDateRange:  false,
  showValidUntil: false,
  showSurveyor:   false,
  labels: {
    nrDocument:   "Nr. document",
    dateDocument: "Data autentificării",
    institution:  "Instituție înregistrare",
  },
};

// ---------------------------------------------------------------------------
// Per-type overrides — keyed by lookup_document_type.key
// ---------------------------------------------------------------------------

const CONFIG: Record<string, TypeConfig> = {

  TITLU_PROPRIETATE: {
    showTitlu:      true,
    showMostenitor: false,
    showDateRange:  false,
    showValidUntil: false,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. titlu proprietate",
      dateDocument: "Data eliberării",
      institution:  "Emitent",
    },
  },

  CERTIFICAT_MOSTENITOR: {
    showTitlu:      false,
    showMostenitor: true,
    showDateRange:  false,
    showValidUntil: false,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. certificat de moștenitor",
      dateDocument: "Data eliberării",
      institution:  "Notariat",
    },
  },

  CONTRACT_VANZARE: {
    showTitlu:      false,
    showMostenitor: false,
    showDateRange:  false,
    showValidUntil: false,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. act autentic",
      dateDocument: "Data autentificării",
      institution:  "Notariat",
    },
  },

  CONTRACT_INCHIRIERE: {
    showTitlu:      false,
    showMostenitor: false,
    showDateRange:  true,
    showValidUntil: false,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. contract de închiriere",
      dateDocument: "Data autentificării",
      institution:  "Instituție înregistrare",
    },
  },

  CONTRACT_ARENDA: {
    showTitlu:      false,
    showMostenitor: false,
    showDateRange:  true,
    showValidUntil: false,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. contract de arendă",
      dateDocument: "Data autentificării",
      institution:  "Instituție înregistrare",
    },
  },

  ACT_DONATIE: {
    showTitlu:      false,
    showMostenitor: false,
    showDateRange:  false,
    showValidUntil: false,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. act autentic donație",
      dateDocument: "Data autentificării",
      institution:  "Notariat",
    },
  },

  TESTAMENT: {
    showTitlu:      false,
    showMostenitor: false,
    showDateRange:  false,
    showValidUntil: false,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. act autentic testament",
      dateDocument: "Data autentificării",
      institution:  "Notariat",
    },
  },

  // ── Slice #19.03: new type entries ──────────────────────────────────────

  HOTARARE_JUDECATOREASCA: {
    showTitlu:      false,
    showMostenitor: false,
    showDateRange:  false,
    showValidUntil: true,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. hotărâre",
      dateDocument: "Data hotărârii",
      institution:  "Instanță / Autoritate",
    },
  },

  HOTARARE_ADMINISTRATIVA: {
    showTitlu:      false,
    showMostenitor: false,
    showDateRange:  false,
    showValidUntil: true,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. hotărâre",
      dateDocument: "Data emiterii",
      institution:  "Autoritate emitentă",
    },
  },

  DOCUMENTATIE_CADASTRALA: {
    showTitlu:      false,
    showMostenitor: false,
    showDateRange:  false,
    showValidUntil: false,
    showSurveyor:   true,
    labels: {
      nrDocument:   "Nr. OCPI",
      dateDocument: "Data înregistrării",
      institution:  "OCPI / Autoritate",
    },
  },

  AUTORIZATIE_CONSTRUIRE: {
    showTitlu:      false,
    showMostenitor: false,
    showDateRange:  false,
    showValidUntil: true,
    showSurveyor:   false,
    labels: {
      nrDocument:   "Nr. autorizație",
      dateDocument: "Data emiterii",
      institution:  "Autoritate emitentă",
    },
  },
};

// ---------------------------------------------------------------------------
// Exported accessor
// ---------------------------------------------------------------------------

/** `key` is `lookup_document_type.key` (or undefined while the type list is loading). */
export function getTypeConfig(key: string | undefined | null): TypeConfig {
  if (!key) return GENERIC;
  return CONFIG[key] ?? GENERIC;
}
