-- migration_056_schema_migrations.sql
--
-- Creates schema_migrations table and backfills all migrations applied
-- before this tracking system existed (008 through 055).
-- Safe to apply multiple times: CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT        PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- MD5 of the file contents at time of apply.
  -- NULL for backfill rows (applied before tracking was introduced).
  checksum    TEXT
);

-- Backfill: every migration file already applied to this database.
-- applied_at is approximated as now(); checksum is NULL (pre-history).
INSERT INTO schema_migrations (filename) VALUES
  ('migration_008_principal_object.sql'),
  ('migration_008_repair.sql'),
  ('migration_009_fix_diacritics.sql'),
  ('migration_010_paperwork_pages.sql'),
  ('migration_011_lookup_others.sql'),
  ('migration_012_lookup_others_description.sql'),
  ('migration_013_person_paperwork_quality.sql'),
  ('migration_013_person_roles.sql'),
  ('migration_014_doc_type_person_role.sql'),
  ('migration_015_property_person_role.sql'),
  ('migration_016_property_person_role.sql'),
  ('migration_017_person_paperwork_role.sql'),
  ('migration_018_judicial_contact_persons.sql'),
  ('migration_019_import_classify.sql'),
  ('migration_020_rename_to_document.sql'),
  ('migration_021_keep_alternate_wordings.sql'),
  ('migration_022_judicial_person_types.sql'),
  ('migration_023_drop_id_doc_paired_check.sql'),
  ('migration_024_drop_has_contact_check.sql'),
  ('migration_025_soft_delete_aware_cnp_cui_uniqueness.sql'),
  ('migration_026_help_content.sql'),
  ('migration_027_property_corner_original_index.sql'),
  ('migration_028_property_type_usecat_fk.sql'),
  ('migration_029_property_versions.sql'),
  ('migration_030_person_versions.sql'),
  ('migration_031_document_versions.sql'),
  ('migration_032_groups.sql'),
  ('migration_033_property_calculated_area.sql'),
  ('migration_034_property_address_streetview.sql'),
  ('migration_035_document_institution_fk.sql'),
  ('migration_035_group_code_prefix_split.sql'),
  ('migration_035_group_member_person_document.sql'),
  ('migration_035_seed_doc_types.sql'),
  ('migration_036_natural_person_physical_type.sql'),
  ('migration_037_person_code_prefix_split.sql'),
  ('migration_038_natural_person_correspondence_same_as_home.sql'),
  ('migration_039_property_type_key.sql'),
  ('migration_040_property_type_seed.sql'),
  ('migration_041_property_type_panels.sql'),
  ('migration_042_document_new_fields.sql'),
  ('migration_043_doctype_cleanup.sql'),
  ('migration_044_stamps.sql'),
  ('migration_045_entity_metadata.sql'),
  ('migration_046_metadata_field_timestamps.sql'),
  ('migration_047_metadata_fixes.sql'),
  ('migration_048_entity_tags.sql'),
  ('migration_049_entity_cross_ref.sql'),
  ('migration_050_metadata_updated_by.sql'),
  ('migration_051_polymorphic_member_fk.sql'),
  ('migration_052_drop_dead_document_columns.sql'),
  ('migration_053_full_text_search.sql'),
  ('migration_054_updated_by.sql'),
  ('migration_055_relationship_roles.sql'),
  ('migration_056_schema_migrations.sql')
ON CONFLICT (filename) DO NOTHING;
