-- migration_013_person_roles.sql
-- Slice 10.03 — Person Roles reference list
--
-- Creates the lookup_person_role table and pre-populates it with 56 distinct
-- roles (deduplicated and sorted alphabetically from the supplied list).
-- Idempotent: safe to re-run (uses CREATE TABLE IF NOT EXISTS + INSERT … ON CONFLICT DO NOTHING).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lookup_person_role (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Auto-update trigger (same pattern as all other lookup tables)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE TRIGGER touch_updated_at_lookup_person_role
  BEFORE UPDATE ON lookup_person_role
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- Seed data — 56 distinct roles, ordered alphabetically
-- ---------------------------------------------------------------------------

INSERT INTO lookup_person_role (id, name, description, sort_order, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Adjudecatar', '(principalul beneficiar care dobândește proprietatea prin licitație în executare silită)', 1, now(), now()),
  (gen_random_uuid(), 'Arendator', '(proprietarul care dă în arendă)', 2, now(), now()),
  (gen_random_uuid(), 'Arendaș', '(cel care ia în arendă și exploatează)', 3, now(), now()),
  (gen_random_uuid(), 'Autoritate locală', '(emitent)', 4, now(), now()),
  (gen_random_uuid(), 'Beneficiar / Client', NULL, 5, now(), now()),
  (gen_random_uuid(), 'Beneficiar / Solicitant', '(cel care obține autorizația, de obicei proprietarul)', 6, now(), now()),
  (gen_random_uuid(), 'Chiriaș / Locatar', '(cel care închiriază)', 7, now(), now()),
  (gen_random_uuid(), 'Constructor / Antreprenor', '(responsabil de execuție)', 8, now(), now()),
  (gen_random_uuid(), 'Coproprietar', '(în cazuri de indiviziune)', 9, now(), now()),
  (gen_random_uuid(), 'Coproprietar / Co-moștenitor', '(apare în același certificat)', 10, now(), now()),
  (gen_random_uuid(), 'Coproprietari / Coindivizari', '(părți care partajează)', 11, now(), now()),
  (gen_random_uuid(), 'Creditor', '(inițiator al executării)', 12, now(), now()),
  (gen_random_uuid(), 'Creditor / Ipotecar', '(pentru verificare sarcini)', 13, now(), now()),
  (gen_random_uuid(), 'Cumpărător', '(Dobânditor)', 14, now(), now()),
  (gen_random_uuid(), 'Debitor', '(cel al cărui bun este adjudecat)', 15, now(), now()),
  (gen_random_uuid(), 'Debitor / Plătitor de impozite', '(cel pentru care se atestă situația fiscală)', 16, now(), now()),
  (gen_random_uuid(), 'Executor judecătoresc', '(emitent)', 17, now(), now()),
  (gen_random_uuid(), 'Garant', NULL, 18, now(), now()),
  (gen_random_uuid(), 'Judecător / Instanță', '(emitent)', 19, now(), now()),
  (gen_random_uuid(), 'Locator', '(proprietarul care închiriază)', 20, now(), now()),
  (gen_random_uuid(), 'Martor / Notar', '(la autentificare, dacă e cazul)', 21, now(), now()),
  (gen_random_uuid(), 'Mediator / Judecător', '(în caz de partaj judiciar)', 22, now(), now()),
  (gen_random_uuid(), 'Moștenitor', '(principalul beneficiar)', 23, now(), now()),
  (gen_random_uuid(), 'Moștenitor / succesor', '(în cazuri de continuare a procedurii)', 24, now(), now()),
  (gen_random_uuid(), 'Moștenitor / Succesor', '(în cazuri specifice)', 25, now(), now()),
  (gen_random_uuid(), 'Moștenitori', NULL, 26, now(), now()),
  (gen_random_uuid(), 'Notar', '(autentificator)', 27, now(), now()),
  (gen_random_uuid(), 'Notar public', '(care emite certificatul)', 28, now(), now()),
  (gen_random_uuid(), 'Prestator', '(Furnizor de servicii)', 29, now(), now()),
  (gen_random_uuid(), 'Proiectant', '(în unele cazuri)', 30, now(), now()),
  (gen_random_uuid(), 'Proiectant / Arhitect', '(elaborator)', 31, now(), now()),
  (gen_random_uuid(), 'Proiectant / Consultant', NULL, 32, now(), now()),
  (gen_random_uuid(), 'Proprietar', '(Deținător de bunuri imobile/mobiliare)', 33, now(), now()),
  (gen_random_uuid(), 'Proprietar / Coproprietar', '(al imobilului)', 34, now(), now()),
  (gen_random_uuid(), 'Proprietar / Titular', '(al imobilului)', 35, now(), now()),
  (gen_random_uuid(), 'Proprietar / Titular al imobilului', NULL, 36, now(), now()),
  (gen_random_uuid(), 'Proprietar / Titular de drept real', '(principalul interesat)', 37, now(), now()),
  (gen_random_uuid(), 'Proprietar / Titular de drepturi înscrise', NULL, 38, now(), now()),
  (gen_random_uuid(), 'Pârât / Debitor', NULL, 39, now(), now()),
  (gen_random_uuid(), 'Reclamant / Petent', NULL, 40, now(), now()),
  (gen_random_uuid(), 'Reprezentant al instituției emitente', '(ex: mediu, cultură, utilități)', 41, now(), now()),
  (gen_random_uuid(), 'Reprezentant legal', '(al părților)', 42, now(), now()),
  (gen_random_uuid(), 'Reprezentant legal (al părților)', NULL, 43, now(), now()),
  (gen_random_uuid(), 'Reprezentant legal / Mandatar', '(prin procură)', 44, now(), now()),
  (gen_random_uuid(), 'Solicitant', '(cel care cere eliberarea certificatului)', 45, now(), now()),
  (gen_random_uuid(), 'Solicitant / Beneficiar', '(cel care comandă lucrarea)', 46, now(), now()),
  (gen_random_uuid(), 'Solicitant / Titular de drepturi', NULL, 47, now(), now()),
  (gen_random_uuid(), 'Solicitant / Titular de rol fiscal', NULL, 48, now(), now()),
  (gen_random_uuid(), 'Succesor universal', '(cu titlu particular)', 49, now(), now()),
  (gen_random_uuid(), 'Titular / Proprietar', '(principalul beneficiar)', 50, now(), now()),
  (gen_random_uuid(), 'Titular al imobilului', NULL, 51, now(), now()),
  (gen_random_uuid(), 'Titular al succesiunii / Defunct', '(persoana decedată)', 52, now(), now()),
  (gen_random_uuid(), 'Titular de drept', '(cel în favoarea căruia s-a pronunțat)', 53, now(), now()),
  (gen_random_uuid(), 'Topograf / Expert cadastral', '(cel care întocmește documentația)', 54, now(), now()),
  (gen_random_uuid(), 'Urbanist / Proiectant', NULL, 55, now(), now()),
  (gen_random_uuid(), 'Vânzător', '(Transmitent)', 56, now(), now())
ON CONFLICT DO NOTHING;
