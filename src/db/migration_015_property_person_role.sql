-- ---------------------------------------------------------------------------
-- Slice 10.05 — lookup_property_person_role
-- ---------------------------------------------------------------------------
-- Whitelist of Person Roles that are valid for the Property ↔ Person
-- association.  When a user later associates a specific Person to a specific
-- Property they will be able to tag that link with one of these roles.
--
-- There is no second FK (no Property Type involved) — each row simply marks a
-- role from lookup_person_role as applicable to property-person links.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lookup_property_person_role (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_role_id uuid        NOT NULL
                             REFERENCES lookup_person_role(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lookup_property_person_role_unique UNIQUE (person_role_id)
);
