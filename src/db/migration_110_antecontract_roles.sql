-- migration_110_antecontract_roles.sql
-- Slice #39.59 (FU-344) - the antecontract's roles in the reference data: „Promitent vânzător" and
-- „Promitent cumpărător", both holding a share, beside „Notar", which does not.
--
-- WHY
--   Until now only the dev seed created them (scripts/seed-dev-data/seed.ts, DOC_TYPE_ROLES), so on a
--   rebuilt database or on Supabase an antecontract's parties could only be linked without a role - and,
--   since #39.57, its „Părți" tile stayed empty there. Adrian, 2026-10-15: „It must be addressed, please do it!".
--
-- WHAT THIS DOES - ADDITIVE ONLY, never renames, never deletes, never changes an existing row:
--   1. each of the two roles is added to lookup_person_role where no role of that NAME exists, with a
--      description in its neighbours' style and the next sort_orders after migration_095's „Mamă" (65);
--   2. the three „Antecontract" pairs are added to lookup_doc_type_person_role where missing, „holds_share"
--      on for both promitenți and off for „Notar". A pair that exists already (dev, where the seed made it)
--      is left exactly as it is.
--   The role is found by name (lookup_person_role.name is not unique; the oldest by sort_order, then id,
--   wins, as the seed's own lookup does), the type by its key.
--
-- src/db/sync-reference-data.sql gains the same rows, so a database built from that file agrees with
-- one built from the migrations (verify-rebuild).

BEGIN;

INSERT INTO lookup_person_role (id, name, description, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), v.name, v.description, v.sort_order, now(), now()
  FROM (VALUES
    ('Promitent vânzător',   '(cel care promite să vândă, prin antecontract)',   66),
    ('Promitent cumpărător', '(cel care promite să cumpere, prin antecontract)', 67)
  ) AS v(name, description, sort_order)
 WHERE NOT EXISTS (SELECT 1 FROM lookup_person_role r WHERE r.name = v.name);

INSERT INTO lookup_doc_type_person_role (id, document_type_id, person_role_id, holds_share, created_at)
SELECT gen_random_uuid(), d.id,
       (SELECT r.id FROM lookup_person_role r WHERE r.name = v.role_name ORDER BY r.sort_order, r.id LIMIT 1),
       v.holds_share, now()
  FROM (VALUES
    ('Promitent vânzător',   true),
    ('Promitent cumpărător', true),
    ('Notar',                false)
  ) AS v(role_name, holds_share)
  JOIN lookup_document_type d ON d.key = 'ANTECONTRACT'
 WHERE EXISTS (SELECT 1 FROM lookup_person_role r WHERE r.name = v.role_name)
ON CONFLICT (document_type_id, person_role_id) DO NOTHING;

COMMIT;
