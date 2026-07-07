-- migration_063_time_frame_settings.sql
-- Creates the time_frame_setting table and seeds the 10 configurable
-- time-frame values used throughout the application.
--
-- Apply locally:  scripts\Apply-Migration.ps1
-- Apply to cloud: paste into Supabase SQL Editor

BEGIN;

INSERT INTO schema_migrations (filename) VALUES ('migration_063_time_frame_settings.sql')
  ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS time_frame_setting (
  key         text        PRIMARY KEY,
  value       integer     NOT NULL,
  -- 'days' | 'minutes' | 'hours' | 'months'
  unit        text        NOT NULL DEFAULT 'days',
  label_en    text        NOT NULL,
  label_ro    text        NOT NULL,
  description_en text,
  description_ro text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- seed rows  (INSERT … ON CONFLICT DO NOTHING so re-running is safe)
-- ---------------------------------------------------------------------------

INSERT INTO time_frame_setting (key, value, unit, label_en, label_ro, description_en, description_ro) VALUES
  ('dashboard_recent_days',    7,  'days',    'Recent activity window',         'Fereastra activitate recenta',    'How far back the dashboard "Recent" counts look',         'Cat de departe priveste contorul "Recente" de pe panou'),
  ('dashboard_expiring_docs',  60, 'days',    'Expiring documents horizon',     'Orizont documente ce expira',     'How far ahead the dashboard scans for expiring documents', 'Cat de departe scaneaza panoul pentru documente ce expira'),
  ('dashboard_stale_metadata', 90, 'days',    'Stale metadata threshold',       'Prag metadate invechite',         'Metadata older than this is flagged as stale on the dashboard', 'Metadatele mai vechi decat aceasta valoare sunt marcate ca invechite'),
  ('dashboard_expiring_amber', 14, 'days',    'Expiring soon (amber) threshold','Prag expirare curand (chihlimbar)','Documents expiring within this many days turn amber on the dashboard', 'Documentele care expira in aceasta perioada devin chihlimbar pe panou'),
  ('documents_expiring_soon',  30, 'days',    'Expiring-soon filter window',    'Fereastra filtru expira curand',  'Window used by the "Expiring soon" toggle on the Documents list', 'Fereastra folosita de filtrul "Expira curand" din lista Documente'),
  ('metadata_review_warning',  90, 'days',    'Metadata review warning age',    'Varsta avertizare revizuire metadate', 'Metadata fields older than this show a review warning',  'Campurile de metadate mai vechi decat aceasta valoare afiseaza un avertisment'),
  ('id_card_expiring_soon',    90, 'days',    'ID card expiring soon threshold','Prag CI expira curand',           'Days before expiry to warn that a person''s ID card is expiring', 'Zile inainte de expirare pentru a avertiza ca CI-ul expira'),
  ('recency_badge_red',         5, 'minutes', 'Recency badge red threshold',    'Prag insigna recenta (rosu)',     'Entities updated within this time get a red "New!" badge',  'Entitatile actualizate in aceasta perioada primesc o insigna "Nou!" rosie'),
  ('recency_badge_amber',      15, 'minutes', 'Recency badge amber threshold',  'Prag insigna recenta (chihlimbar)', 'Entities updated within this time get an amber badge',    'Entitatile actualizate in aceasta perioada primesc o insigna chihlimbar'),
  ('recency_badge_window',     30, 'minutes', 'Recency badge display window',   'Fereastra afisare insigna recenta', 'Entities updated within this time show any recency badge', 'Entitatile actualizate in aceasta perioada afiseaza o insigna de recenta')
ON CONFLICT (key) DO NOTHING;

COMMIT;
