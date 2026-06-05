-- migration_014_doc_type_person_role.sql
-- Slice 10.04 — Document Type ↔ Person Role associations
--
-- Creates the lookup_doc_type_person_role junction table and pre-populates it
-- with 75 associations. Name-based CTEs resolve IDs from the two lookup tables
-- so the seed is independent of UUID values.
-- Idempotent: safe to re-run (CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lookup_doc_type_person_role (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id uuid        NOT NULL REFERENCES lookup_document_type(id) ON DELETE CASCADE,
  person_role_id   uuid        NOT NULL REFERENCES lookup_person_role(id)   ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type_id, person_role_id)
);

-- ---------------------------------------------------------------------------
-- Seed data — 75 associations, resolved by name
-- ---------------------------------------------------------------------------

WITH doc AS (SELECT id, name FROM lookup_document_type),
     rol AS (SELECT id, name FROM lookup_person_role)
INSERT INTO lookup_doc_type_person_role (id, document_type_id, person_role_id, created_at)
SELECT gen_random_uuid(), d.id, r.id, now()
FROM (VALUES
  ('Act de Adjudecare',             'Adjudecatar'),
  ('Act de Adjudecare',             'Debitor'),
  ('Act de Adjudecare',             'Executor judecătoresc'),
  ('Act de Adjudecare',             'Creditor'),
  ('Act de Adjudecare',             'Moștenitor / succesor'),
  ('Act Cadastru',                  'Proprietar / Titular de drept real'),
  ('Act Cadastru',                  'Solicitant / Beneficiar'),
  ('Act Cadastru',                  'Coproprietar'),
  ('Act Cadastru',                  'Reprezentant legal / Mandatar'),
  ('Act Cadastru',                  'Topograf / Expert cadastral'),
  ('Autorizare',                    'Beneficiar / Solicitant'),
  ('Autorizare',                    'Proprietar / Titular'),
  ('Autorizare',                    'Constructor / Antreprenor'),
  ('Autorizare',                    'Proiectant / Arhitect'),
  ('Autorizare',                    'Reprezentant legal'),
  ('Aviz de Instituție',            'Solicitant / Beneficiar'),
  ('Aviz de Instituție',            'Titular al imobilului'),
  ('Aviz de Instituție',            'Reprezentant al instituției emitente'),
  ('Aviz de Instituție',            'Proiectant / Consultant'),
  ('Certificat Fiscal',             'Solicitant / Titular de rol fiscal'),
  ('Certificat Fiscal',             'Proprietar / Coproprietar'),
  ('Certificat Fiscal',             'Moștenitor / Succesor'),
  ('Certificat Fiscal',             'Debitor / Plătitor de impozite'),
  ('Certificat de Moștenitor',      'Moștenitor'),
  ('Certificat de Moștenitor',      'Solicitant'),
  ('Certificat de Moștenitor',      'Titular al succesiunii / Defunct'),
  ('Certificat de Moștenitor',      'Coproprietar / Co-moștenitor'),
  ('Certificat de Moștenitor',      'Reprezentant legal / Mandatar'),
  ('Certificat de Moștenitor',      'Notar public'),
  ('Certificat de Moștenitor',      'Succesor universal'),
  ('Certificat de Bunuri',          'Solicitant / Titular de drepturi'),
  ('Certificat de Bunuri',          'Proprietar'),
  ('Certificat de Bunuri',          'Moștenitor'),
  ('Certificat de Bunuri',          'Coproprietar'),
  ('Certificat de Urbanism',        'Solicitant / Beneficiar'),
  ('Certificat de Urbanism',        'Proprietar / Titular al imobilului'),
  ('Certificat de Urbanism',        'Reprezentant legal / Mandatar'),
  ('Certificat de Urbanism',        'Proiectant'),
  ('Contract de Arendă',            'Arendator'),
  ('Contract de Arendă',            'Arendaș'),
  ('Contract de Arendă',            'Reprezentant legal'),
  ('Contract de Arendă',            'Martor / Notar'),
  ('Contract de Închiriere',        'Locator'),
  ('Contract de Închiriere',        'Chiriaș / Locatar'),
  ('Contract de Închiriere',        'Garant'),
  ('Contract de Închiriere',        'Reprezentant legal'),
  ('Contract de Partaj',            'Coproprietari / Coindivizari'),
  ('Contract de Partaj',            'Moștenitori'),
  ('Contract de Partaj',            'Notar'),
  ('Contract de Partaj',            'Mediator / Judecător'),
  ('Contract de Prestări Servicii', 'Prestator'),
  ('Contract de Prestări Servicii', 'Beneficiar / Client'),
  ('Contract de Prestări Servicii', 'Reprezentant legal (al părților)'),
  ('Contract de Vânzare',           'Vânzător'),
  ('Contract de Vânzare',           'Cumpărător'),
  ('Contract de Vânzare',           'Notar'),
  ('Contract de Vânzare',           'Reprezentant legal / Mandatar'),
  ('Contract de Vânzare',           'Moștenitor / Succesor'),
  ('Extras din Carte Funciară',     'Solicitant / Beneficiar'),
  ('Extras din Carte Funciară',     'Proprietar / Titular de drepturi înscrise'),
  ('Extras din Carte Funciară',     'Reprezentant legal'),
  ('Extras din Carte Funciară',     'Creditor / Ipotecar'),
  ('Extras din PUG',                'Solicitant / Beneficiar'),
  ('Extras din PUG',                'Autoritate locală'),
  ('Extras din PUG',                'Urbanist / Proiectant'),
  ('Hotărâre Judecătorească',       'Reclamant / Petent'),
  ('Hotărâre Judecătorească',       'Pârât / Debitor'),
  ('Hotărâre Judecătorească',       'Moștenitor / Succesor'),
  ('Hotărâre Judecătorească',       'Titular de drept'),
  ('Hotărâre Judecătorească',       'Judecător / Instanță'),
  ('Titlu de Proprietate',          'Titular / Proprietar'),
  ('Titlu de Proprietate',          'Moștenitor / Succesor'),
  ('Titlu de Proprietate',          'Coproprietar'),
  ('Titlu de Proprietate',          'Reprezentant legal')
) AS pairs(doc_name, role_name)
JOIN doc d ON d.name = pairs.doc_name
JOIN rol r ON r.name = pairs.role_name
ON CONFLICT DO NOTHING;
