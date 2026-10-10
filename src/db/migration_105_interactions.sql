-- migration_105_interactions.sql
-- Slice #38.83 - „Interacțiuni": the storage for the log of interactions with clients.
--
-- WHAT THIS DOES
--   Three new tables, nothing changed in any existing one:
--
--   interaction — one row per contact with a client, whatever its channel. The
--     spec's manual entry form (§4), its grid (§3) and its audit line (§6):
--       channel             EMAIL | WHATSAPP | SMS | PHONE | MEETING | PAPER_MAIL, required
--       direction           INBOUND | OUTBOUND, required, default OUTBOUND
--       occurred_at         timestamptz, required — in the future only when status is
--                           SCHEDULED, which the API checks (a CHECK cannot call now())
--       person_id           → person, required, natural or judicial;
--                           ON DELETE CASCADE: a person's interactions go with the person,
--                           as every other link of a person does (Ask first #1)
--       subject             required, 1–120 characters after trimming (a CHECK)
--       description         optional, client-facing
--       internal_note       optional, team-only — its own column, never mixed into the
--                           description (§6)
--       status              LOGGED | NEEDS_REPLY | SENT | COMPLETED | SCHEDULED, default LOGGED
--       follow_up_on        date, optional
--       related_property_id → property, optional (Ask first #4: a property only);
--                           ON DELETE SET NULL — the interaction outlives the property
--       created_at, created_by, updated_at, updated_by — the session's email, as
--                           person.updated_by is written; updated_at is also what two people
--                           editing one row compare (§7: a stale save answers 409)
--     ASCII keys here, the Romanian words in messages (person_document.cota_mod's rule).
--     Not a principal object: no code, no versions, no Clasificări (Ask first #2).
--
--   interaction_document — the documents an interaction is about. A LINK, never a
--     copy: no file is stored here (§6 „link, do not upload"). The pair is unique;
--     both sides cascade.
--
--   interaction_tag — an interaction's tags, its own table (Ask first #3), the
--     pair unique; suggestions come from the tags already used on interactions.
--
-- NO GMAIL, NO WHATSAPP (Adrian, 2026-10-10): no account, token, sync state or
-- message id is stored.
--
-- IDEMPOTENT: IF NOT EXISTS throughout; a second run changes nothing.

BEGIN;

CREATE TABLE IF NOT EXISTS interaction (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel             text        NOT NULL
                      CONSTRAINT interaction_channel_check
                      CHECK (channel IN ('EMAIL', 'WHATSAPP', 'SMS', 'PHONE', 'MEETING', 'PAPER_MAIL')),
  direction           text        NOT NULL DEFAULT 'OUTBOUND'
                      CONSTRAINT interaction_direction_check
                      CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  occurred_at         timestamptz NOT NULL,
  person_id           uuid        NOT NULL REFERENCES person (id) ON DELETE CASCADE,
  subject             text        NOT NULL
                      CONSTRAINT interaction_subject_check
                      CHECK (char_length(btrim(subject)) BETWEEN 1 AND 120),
  description         text,
  internal_note       text,
  status              text        NOT NULL DEFAULT 'LOGGED'
                      CONSTRAINT interaction_status_check
                      CHECK (status IN ('LOGGED', 'NEEDS_REPLY', 'SENT', 'COMPLETED', 'SCHEDULED')),
  follow_up_on        date,
  related_property_id uuid        REFERENCES property (id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          text,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text
);

CREATE INDEX IF NOT EXISTS interaction_occurred_at_idx ON interaction (occurred_at DESC);
CREATE INDEX IF NOT EXISTS interaction_person_idx      ON interaction (person_id);
CREATE INDEX IF NOT EXISTS interaction_status_idx      ON interaction (status);

CREATE TABLE IF NOT EXISTS interaction_document (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id uuid        NOT NULL REFERENCES interaction (id) ON DELETE CASCADE,
  document_id    uuid        NOT NULL REFERENCES document (id)    ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interaction_document_unique UNIQUE (interaction_id, document_id)
);

CREATE INDEX IF NOT EXISTS interaction_document_document_idx ON interaction_document (document_id);

CREATE TABLE IF NOT EXISTS interaction_tag (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id uuid        NOT NULL REFERENCES interaction (id) ON DELETE CASCADE,
  tag            text        NOT NULL
                 CONSTRAINT interaction_tag_tag_check
                 CHECK (char_length(btrim(tag)) BETWEEN 1 AND 60),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interaction_tag_unique UNIQUE (interaction_id, tag)
);

CREATE INDEX IF NOT EXISTS interaction_tag_tag_idx ON interaction_tag (tag);

COMMIT;
