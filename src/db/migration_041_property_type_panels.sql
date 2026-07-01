-- Slice #19.02 — Property type panel-visibility flags
--
-- Adds three boolean show/hide flags to lookup_property_type.
-- These replace the code-side type-config.ts approach: each property type now
-- declares which form panels are visible directly in the database, editable
-- via Reference Data → Property Types (admin UI checkboxes).
--
-- Column semantics: TRUE = show the panel, FALSE = hide it.
-- DEFAULT FALSE = "all panels hidden" is the safe default for newly-added
-- types (the admin must explicitly enable each panel it needs).
--
-- Backfills all 14 existing rows according to the profiles they carried in
-- type-config.ts before this migration.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + UPDATE ... WHERE key = '...'.

ALTER TABLE lookup_property_type
  ADD COLUMN IF NOT EXISTS show_tarla_parcela boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_address       boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_street_view   boolean NOT NULL DEFAULT FALSE;

-- ── Urban / Built: no Tarla/Parcela; show Address + Street View ─────────────
UPDATE lookup_property_type
  SET show_tarla_parcela = FALSE,
      show_address       = TRUE,
      show_street_view   = TRUE
  WHERE key IN ('APARTAMENT', 'CASA', 'TEREN_CONSTRUIT',
                'GARAJ', 'SPATIU_COMERCIAL', 'BIROU');

-- ── Agricultural / Rural: show Tarla/Parcela; no Address / Street View ───────
UPDATE lookup_property_type
  SET show_tarla_parcela = TRUE,
      show_address       = FALSE,
      show_street_view   = FALSE
  WHERE key IN ('TEREN_ARABIL', 'PASUNE', 'VIE', 'LIVADA', 'FANATA');

-- ── Forest / Vegetation: show Tarla/Parcela; no Address / Street View ────────
UPDATE lookup_property_type
  SET show_tarla_parcela = TRUE,
      show_address       = FALSE,
      show_street_view   = FALSE
  WHERE key IN ('PADURE', 'VEGETATIE_FORESTIERA');

-- ── Generic (Linear): show everything ────────────────────────────────────────
UPDATE lookup_property_type
  SET show_tarla_parcela = TRUE,
      show_address       = TRUE,
      show_street_view   = TRUE
  WHERE key = 'LINIARA';
