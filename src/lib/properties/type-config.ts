/**
 * Per-type UI configuration for the Property form.
 *
 * Each property type declares which sections are visible/hidden in the form.
 * Keys are `lookup_property_type.key` slugs (stable strings generated on
 * insert by the admin value-list query layer).
 *
 * Profiles:
 *  URBAN       — Apartment / House / Built Land: hide Tarla/Parcela;
 *                show Address and Street View.
 *  AGRICULTURAL — Arable / Pasture: hide Address and Street View;
 *                show Tarla/Parcela.
 *  FOREST      — Forest / Vegetation: hide Address and Street View;
 *                show Tarla/Parcela.
 *  GENERIC     — Linear / unknown: everything visible (safe default).
 *
 * Adding a new type via Reference Data → Property Types auto-generates a key
 * slug and falls back to GENERIC until explicitly added here.
 */

export type PropertyTypeConfig = {
  /** Hide Tarla/Sola and Parcelă fields (urban properties have neither). */
  hideTarlaParcela: boolean;
  /** Hide the entire Address section (agricultural / forest parcels). */
  hideAddress:      boolean;
  /** Hide the Street View toggle + panel (agricultural / forest parcels). */
  hideStreetView:   boolean;
};

// ---------------------------------------------------------------------------
// Generic / fallback config — all sections visible
// ---------------------------------------------------------------------------

const GENERIC: PropertyTypeConfig = {
  hideTarlaParcela: false,
  hideAddress:      false,
  hideStreetView:   false,
};

// ---------------------------------------------------------------------------
// Profile constants
// ---------------------------------------------------------------------------

const URBAN: PropertyTypeConfig = {
  hideTarlaParcela: true,
  hideAddress:      false,
  hideStreetView:   false,
};

const AGRICULTURAL: PropertyTypeConfig = {
  hideTarlaParcela: false,
  hideAddress:      true,
  hideStreetView:   true,
};

const FOREST: PropertyTypeConfig = {
  hideTarlaParcela: false,
  hideAddress:      true,
  hideStreetView:   true,
};

// ---------------------------------------------------------------------------
// Per-type overrides — keyed by lookup_property_type.key
// ---------------------------------------------------------------------------

const CONFIG: Record<string, PropertyTypeConfig> = {
  // ── Urban / Built ────────────────────────────────────────────────────────
  APARTAMENT:      URBAN,
  CASA:            URBAN,
  TEREN_CONSTRUIT: URBAN,
  // Pre-wired for future Reference Data additions (GENERIC until created)
  GARAJ:           URBAN,
  SPATIU_COMERCIAL: URBAN,
  BIROU:           URBAN,

  // ── Agricultural / Rural ─────────────────────────────────────────────────
  TEREN_ARABIL:    AGRICULTURAL,
  PASUNE:          AGRICULTURAL,
  // Pre-wired for future additions
  VIE:             AGRICULTURAL,
  LIVADA:          AGRICULTURAL,
  FANATA:          AGRICULTURAL,

  // ── Forest / Vegetation ──────────────────────────────────────────────────
  PADURE:                 FOREST,
  VEGETATIE_FORESTIERA:   FOREST,

  // ── Linear / Water / Special → GENERIC (all fields visible) ─────────────
  LINIARA: GENERIC,
  // APA_CURGATOARE, APA_STATATOARE, SPECIAL → GENERIC (not yet seeded)
};

// ---------------------------------------------------------------------------
// Exported accessor
// ---------------------------------------------------------------------------

/** `key` is `lookup_property_type.key` (or null/undefined while loading). */
export function getPropertyTypeConfig(
  key: string | null | undefined,
): PropertyTypeConfig {
  if (!key) return GENERIC;
  return CONFIG[key] ?? GENERIC;
}
