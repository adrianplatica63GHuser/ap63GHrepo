-- migration_101_user_tile_default.sql
-- Slice #38.41 - „Contul meu": each user's own default tiles.
--
-- WHAT THIS DOES
--   Creates user_tile_default: per user and per kind of record (natural
--   person, judicial person, property, document), the tiles „Implicit" returns
--   to on that kind's screens. Until now „Implicit" returned to each
--   registry's built-in `defaults`, the same for everyone, and a choice lived
--   only in the browser (localStorage `ga40-tiles-<entity>-v1`). A saved set
--   follows the user across browsers; the built-in `defaults` stay the fallback
--   for anyone who has saved none.
--
-- THE USER
--   `user_id` is the Supabase Auth id the session resolves to (the synthetic
--   „uat-no-auth" on UAT), the same identity every other per-user read uses.
--   No foreign key: app_users is keyed by that id too, but a row here outliving
--   an account costs nothing and deleting accounts never touches it.
--
-- THE TILES
--   jsonb, an array of tile keys as the registry names them on the day of the
--   save. A tile renamed or removed since is read through the registry's
--   `renamed` map and filtered (src/lib/ui/tile-defaults.ts) — never failed on.

BEGIN;

CREATE TABLE IF NOT EXISTS user_tile_default (
  user_id    text        NOT NULL,
  kind       text        NOT NULL CHECK (kind IN ('natural-person', 'judicial-person', 'property', 'document')),
  tiles      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);

COMMIT;
