-- Slice #18.05 — Person versioning (full-snapshot history)
--
-- Every Person (natural OR judicial) keeps a complete version history. Version
-- 0 is the state at creation; every saved edit appends the next version. Each
-- version stores a FULL snapshot (the person's own editable fields + its
-- address blocks) as JSONB, so reconstructing "version N" is a direct lookup —
-- no delta replay. The label colour and per-field highlights shown in the UI
-- are derived at display time by diffing snapshot N against snapshot N-1
-- (snapshots are the single source of truth; nothing derived is persisted).
--
-- One shared table covers both subtypes: they both FK person.id, and the
-- snapshot JSON shape simply differs by person.type. Snapshot JSON shapes
-- (kept identical between this backfill and the app's write paths in
-- src/lib/persons/queries.ts and src/lib/judicial-persons/queries.ts):
--
--   NATURAL:
--     {
--       "notes":   person.notes,                       -- string|null
--       "natural": { firstName, lastName, nickname, cnp, idDocumentType,
--                    idDocumentNumber, gender, dateOfBirth, personalPhone1,
--                    personalPhone2, workPhone, personalEmail1, personalEmail2,
--                    workEmail, placeOfBirth, idIssuingAuthority, idValidFrom,
--                    idValidUntil, idCardNumber, idMrzRaw, citizenshipId },
--                                                       -- all string|null
--       "addresses": { "HOME": ADDR|null, "CORRESPONDENCE": ADDR|null }
--     }
--
--   JUDICIAL:
--     {
--       "notes":    person.notes,                      -- string|null
--       "judicial": { name, nickname, judicialPersonTypeId, cuiNumber,
--                     tradeRegisterNumber, contactPerson1Id, contactPerson2Id,
--                     correspondenceSameAsHq },
--                       -- all string|null, except correspondenceSameAsHq: bool
--       "addresses": { "HEADQUARTERS": ADDR|null, "CORRESPONDENCE": ADDR|null }
--     }
--
--   ADDR = { streetLine, postalCode, locality, county, country, notes }
--          (all string|null)
--
-- Idempotent: CREATE ... IF NOT EXISTS, and the backfill skips any person that
-- already has a version 0.

CREATE TABLE IF NOT EXISTS person_version (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id      uuid        NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  version_number integer     NOT NULL,
  snapshot       jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS person_version_person_number_unique
  ON person_version (person_id, version_number);

-- Backfill: give every existing person a version 0 from its current state.
-- (Soft-deleted persons are included too — harmless, and keeps the invariant
-- "every person has at least one version" total.) The CASE picks the shape by
-- person.type; the address sub-objects are null when no row of that kind exists.
INSERT INTO person_version (person_id, version_number, snapshot)
SELECT
  p.id,
  0,
  CASE
    WHEN p.type = 'NATURAL' THEN jsonb_build_object(
      'notes', p.notes,
      'natural', (
        SELECT jsonb_build_object(
          'firstName',          n.first_name,
          'lastName',           n.last_name,
          'nickname',           n.nickname,
          'cnp',                n.cnp,
          'idDocumentType',     n.id_document_type,
          'idDocumentNumber',   n.id_document_number,
          'gender',             n.gender,
          'dateOfBirth',        n.date_of_birth,
          'personalPhone1',     n.personal_phone_1,
          'personalPhone2',     n.personal_phone_2,
          'workPhone',          n.work_phone,
          'personalEmail1',     n.personal_email_1,
          'personalEmail2',     n.personal_email_2,
          'workEmail',          n.work_email,
          'placeOfBirth',       n.place_of_birth,
          'idIssuingAuthority', n.id_issuing_authority,
          'idValidFrom',        n.id_valid_from,
          'idValidUntil',       n.id_valid_until,
          'idCardNumber',       n.id_card_number,
          'idMrzRaw',           n.id_mrz_raw,
          'citizenshipId',      n.citizenship_id
        )
        FROM natural_person n
        WHERE n.person_id = p.id
        LIMIT 1
      ),
      'addresses', jsonb_build_object(
        'HOME',           (SELECT jsonb_build_object('streetLine', a.street_line, 'postalCode', a.postal_code, 'locality', a.locality, 'county', a.county, 'country', a.country, 'notes', a.notes) FROM address a WHERE a.person_id = p.id AND a.kind = 'HOME' LIMIT 1),
        'CORRESPONDENCE', (SELECT jsonb_build_object('streetLine', a.street_line, 'postalCode', a.postal_code, 'locality', a.locality, 'county', a.county, 'country', a.country, 'notes', a.notes) FROM address a WHERE a.person_id = p.id AND a.kind = 'CORRESPONDENCE' LIMIT 1)
      )
    )
    ELSE jsonb_build_object(
      'notes', p.notes,
      'judicial', (
        SELECT jsonb_build_object(
          'name',                   j.name,
          'nickname',               j.nickname,
          'judicialPersonTypeId',   j.judicial_person_type_id,
          'cuiNumber',              j.cui_number,
          'tradeRegisterNumber',    j.trade_register_number,
          'contactPerson1Id',       j.contact_person_1_id,
          'contactPerson2Id',       j.contact_person_2_id,
          'correspondenceSameAsHq', j.correspondence_same_as_hq
        )
        FROM judicial_person j
        WHERE j.person_id = p.id
        LIMIT 1
      ),
      'addresses', jsonb_build_object(
        'HEADQUARTERS',   (SELECT jsonb_build_object('streetLine', a.street_line, 'postalCode', a.postal_code, 'locality', a.locality, 'county', a.county, 'country', a.country, 'notes', a.notes) FROM address a WHERE a.person_id = p.id AND a.kind = 'HEADQUARTERS' LIMIT 1),
        'CORRESPONDENCE', (SELECT jsonb_build_object('streetLine', a.street_line, 'postalCode', a.postal_code, 'locality', a.locality, 'county', a.county, 'country', a.country, 'notes', a.notes) FROM address a WHERE a.person_id = p.id AND a.kind = 'CORRESPONDENCE' LIMIT 1)
      )
    )
  END
FROM person p
WHERE NOT EXISTS (
  SELECT 1 FROM person_version v
  WHERE v.person_id = p.id AND v.version_number = 0
);
