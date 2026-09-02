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
 * ⚠️ **THE LABELS ARE MESSAGE KEYS, NOT STRINGS — and they used to be strings.**
 * Until Slice #32.16 this file held the Romanian words themselves, under a
 * comment claiming they were domain terms that stay the same regardless of
 * locale (the way "Tarla/Sola" and "Carte Funciară" genuinely do in the
 * Property form). UAT overturned that: an English-speaking user opening a
 * document's "Taxe și onorarii" block met „Nr. document", „Data autentificării"
 * and „Instituție înregistrare" with nothing else on the screen in Romanian,
 * so they did not read as domain vocabulary — they read as three labels the
 * application had forgotten to translate. Adrian ruled "Please fix".
 *
 * What each value now holds is a key path RELATIVE to the `document`
 * namespace — `"typeLabels.nrAuthenticDeed"` — resolved by the caller, which
 * is `document-form.tsx`. This module stays free of `next-intl`: it is
 * imported by tests and by non-React code, and a `useTranslations` call in
 * here would tie a pure lookup table to a React render.
 *
 * Every key referenced below must exist under `document.typeLabels` in BOTH
 * message files or the form renders the raw key path. `document.test.ts`
 * asserts exactly that, key by key, in both locales.
 *
 * NOTE (Slice #15.05): configs are keyed by `lookup_document_type.key`
 * (a plain string slug, e.g. "CONTRACT_VANZARE") instead of the old
 * `PaperworkType` enum. The literal key values are unchanged — only the
 * source of truth moved from a hardcoded Postgres enum to an admin-managed
 * lookup table row.
 */

export type TypeConfig = {
  /**
   * Override labels for the three common fields, as key paths under the
   * `document` message namespace — NOT as display strings. Resolve with
   * `t(cfg.labels.nrDocument)` where `t = useTranslations("document")`.
   */
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
    nrDocument:   "typeLabels.nrGeneric",
    dateDocument: "typeLabels.dateAuthenticated",
    institution:  "typeLabels.institutionRegistrar",
  },
};

// ---------------------------------------------------------------------------
// Per-type label overrides — keyed by lookup_document_type.key
// ---------------------------------------------------------------------------

const CONFIG: Record<string, TypeConfig> = {

  TITLU_PROPRIETATE: {
    labels: {
      nrDocument:   "typeLabels.nrPropertyTitle",
      dateDocument: "typeLabels.dateIssued",
      institution:  "typeLabels.institutionIssuer",
    },
  },

  CERTIFICAT_MOSTENITOR: {
    labels: {
      nrDocument:   "typeLabels.nrInheritanceCertificate",
      dateDocument: "typeLabels.dateIssued",
      institution:  "typeLabels.institutionNotary",
    },
  },

  CONTRACT_VANZARE: {
    labels: {
      nrDocument:   "typeLabels.nrAuthenticDeed",
      dateDocument: "typeLabels.dateAuthenticated",
      institution:  "typeLabels.institutionNotary",
    },
  },

  CONTRACT_INCHIRIERE: {
    labels: {
      nrDocument:   "typeLabels.nrRentalContract",
      dateDocument: "typeLabels.dateAuthenticated",
      institution:  "typeLabels.institutionRegistrar",
    },
  },

  CONTRACT_ARENDA: {
    labels: {
      nrDocument:   "typeLabels.nrLeaseContract",
      dateDocument: "typeLabels.dateAuthenticated",
      institution:  "typeLabels.institutionRegistrar",
    },
  },

  ACT_DONATIE: {
    labels: {
      nrDocument:   "typeLabels.nrGiftDeed",
      dateDocument: "typeLabels.dateAuthenticated",
      institution:  "typeLabels.institutionNotary",
    },
  },

  TESTAMENT: {
    labels: {
      nrDocument:   "typeLabels.nrWill",
      dateDocument: "typeLabels.dateAuthenticated",
      institution:  "typeLabels.institutionNotary",
    },
  },

  // ── Slice #19.03: new type entries ──────────────────────────────────────

  HOTARARE_JUDECATOREASCA: {
    labels: {
      nrDocument:   "typeLabels.nrRuling",
      dateDocument: "typeLabels.dateRuled",
      institution:  "typeLabels.institutionCourt",
    },
  },

  HOTARARE_ADMINISTRATIVA: {
    labels: {
      nrDocument:   "typeLabels.nrRuling",
      dateDocument: "typeLabels.dateEmitted",
      institution:  "typeLabels.institutionAuthority",
    },
  },

  DOCUMENTATIE_CADASTRALA: {
    labels: {
      nrDocument:   "typeLabels.nrCadastral",
      dateDocument: "typeLabels.dateRegistered",
      institution:  "typeLabels.institutionCadastral",
    },
  },

  AUTORIZATIE_CONSTRUIRE: {
    labels: {
      nrDocument:   "typeLabels.nrPermit",
      dateDocument: "typeLabels.dateEmitted",
      institution:  "typeLabels.institutionAuthority",
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
