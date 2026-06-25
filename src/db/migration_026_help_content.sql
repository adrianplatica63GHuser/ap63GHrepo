-- migration_026_help_content.sql
-- Slice #16.UX.02 — On-screen Help (Background + How-To popovers, micro-hints)
--
-- Creates two new tables:
--   help_content — one row per "screen" (bilingual Background + How-To text),
--                  surfaced via the <HelpButton> popover.
--   help_hint    — micro-hints for hidden mouse/keyboard behaviour (e.g. drag
--                  to select on the Properties Map, wheel-zoom on the
--                  Document big-page viewer), surfaced via <HelpHint>.
--
-- `screen_key` / `hint_key` values are matched against a code-side registry
-- (src/lib/help/registry.ts) — this migration only creates storage, it does
-- not seed any rows. Content is entered later by Adrian via Administration ->
-- Help Content.
--
-- Idempotent: safe to re-run (CREATE TABLE IF NOT EXISTS).

-- ---------------------------------------------------------------------------
-- help_content
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS help_content (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_key    text        NOT NULL UNIQUE,
  background_en text,
  background_ro text,
  how_to_en     text,
  how_to_ro     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER touch_updated_at_help_content
  BEFORE UPDATE ON help_content
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- help_hint
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS help_hint (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_key text        NOT NULL,
  hint_key   text        NOT NULL,
  text_en    text,
  text_ro    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT help_hint_screen_hint_unique UNIQUE (screen_key, hint_key)
);

CREATE OR REPLACE TRIGGER touch_updated_at_help_hint
  BEFORE UPDATE ON help_hint
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
