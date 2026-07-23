/**
 * Per-type UI configuration for the Document form.
 *
 * NOTE (Slice #21.03.Import — Phase 1): every document type now shares one
 * generic field template (title, nr. document, date, institution, subject,
 * Notes) — the per-type conditional sections (Titlu de Proprietate,
 * Succession Details, Contract Period, Validity, Surveyor) were removed from
 * the form. This config now carries ONLY the per-type label overrides for the
 * three common fields (nrDocument / dateDocument / institution) — cosmetic
 * text on the same shared fields, not extra fields. Type-specific *fields*
 * are reintroduced dynamically per type via `lookup_document_type.template_fields`
 * (see src/lib/documents/template-fields.ts) — pure data, no code change.
 *
 * Label strings are Romanian — they are domain terms that stay the same
 * regardless of the active locale (same as "Tarla/Sola", "Carte Funciară" in
 * the Property form).
 *
 * NOTE (Slice #15.05): configs are keyed by `lookup_document_type.key`
 * (a plain string slug, e.g. "CONTRACT_VANZARE") instead of the old
 * `PaperworkType` enum. The literal key values are unchanged — only the
 * source of truth moved from a hardcoded Postgres enum to an admin-managed
 * lookup table row.
 */

export type TypeConfig = {
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
  labels: {
    nrDocument:   "Nr. document",
    dateDocument: "Data autentificării",
    institution:  "Instituție înregistrare",
  },
};

// ---------------------------------------------------------------------------
// Per-type label overrides — keyed by lookup_document_type.key
// ---------------------------------------------------------------------------

const CONFIG: Record<string, TypeConfig> = {

  TITLU_PROPRIETATE: {
    labels: {
      nrDocument:   "Nr. titlu proprietate",
      dateDocument: "Data eliberării",
      institution:  "Emitent",
    },
  },

  CERTIFICAT_MOSTENITOR: {
    labels: {
      nrDocument:   "Nr. certificat de moștenitor",
      dateDocument: "Data eliberării",
      institution:  "Notariat",
    },
  },

  CONTRACT_VANZARE: {
    labels: {
      nrDocument:   "Nr. act autentic",
      dateDocument: "Data autentificării",
      institution:  "Notariat",
    },
  },

  CONTRACT_INCHIRIERE: {
    labels: {
      nrDocument:   "Nr. contract de închiriere",
      dateDocument: "Data autentificării",
      institution:  "Instituție înregistrare",
    },
  },

  CONTRACT_ARENDA: {
    labels: {
      nrDocument:   "Nr. contract de arendă",
      dateDocument: "Data autentificării",
      institution:  "Instituție înregistrare",
    },
  },

  ACT_DONATIE: {
    labels: {
      nrDocument:   "Nr. act autentic donație",
      dateDocument: "Data autentificării",
      institution:  "Notariat",
    },
  },

  TESTAMENT: {
    labels: {
      nrDocument:   "Nr. act autentic testament",
      dateDocument: "Data autentificării",
      institution:  "Notariat",
    },
  },

  // ── Slice #19.03: new type entries ──────────────────────────────────────

  HOTARARE_JUDECATOREASCA: {
    labels: {
      nrDocument:   "Nr. hotărâre",
      dateDocument: "Data hotărârii",
      institution:  "Instanță / Autoritate",
    },
  },

  HOTARARE_ADMINISTRATIVA: {
    labels: {
      nrDocument:   "Nr. hotărâre",
      dateDocument: "Data emiterii",
      institution:  "Autoritate emitentă",
    },
  },

  DOCUMENTATIE_CADASTRALA: {
    labels: {
      nrDocument:   "Nr. OCPI",
      dateDocument: "Data înregistrării",
      institution:  "OCPI / Autoritate",
    },
  },

  AUTORIZATIE_CONSTRUIRE: {
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
