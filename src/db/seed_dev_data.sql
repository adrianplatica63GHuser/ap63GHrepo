-- =============================================================================
-- seed_dev_data.sql  — Slice #20.18
-- Fictional development seed data: 30 natural persons, 30 judicial persons,
-- 40 properties, 70 documents, 12 groups, 7 stamps, rich associations,
-- metadata, tags, and cross-references.
--
-- SAFE TO RUN MULTIPLE TIMES: starts with a full wipe of all entity data.
-- Reference/lookup tables are NOT touched.
-- Apply locally:
--   docker cp src/db/seed_dev_data.sql ga40prj-postgres:/tmp/seed.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/seed.sql
-- =============================================================================

SET client_encoding = 'UTF8';

BEGIN;

-- =============================================================================
-- 0. WIPE ALL ENTITY DATA (preserve lookup/reference tables)
-- =============================================================================

TRUNCATE
  entity_cross_reference,
  entity_tag,
  entity_provenance_log,
  entity_metadata_version,
  entity_metadata,
  stamp_member,
  group_member,
  calculation_run_output,
  calculation_run,
  document_page,
  document_document,
  person_document,
  property_document,
  person_person,
  property_person,
  property_property,
  document_version,
  person_version,
  property_version,
  property_corner,
  property_address,
  document,
  property,
  natural_person,
  judicial_person,
  address,
  person,
  stamps,
  groups,
  principal_object
  CASCADE;

-- Reset sequences
ALTER SEQUENCE principal_object_code_seq RESTART WITH 1;
ALTER SEQUENCE group_code_seq RESTART WITH 1;
ALTER SEQUENCE stamp_code_seq RESTART WITH 1;

-- =============================================================================
-- 1. PRINCIPAL_OBJECT  (170 rows: 60 persons + 40 properties + 70 documents)
-- Codes: PPERS00001-PPERS00030, JPERS00001-JPERS00030, PROP00001-PROP00040, DOC00001-DOC00070
-- =============================================================================

INSERT INTO principal_object (id, code, object_type, created_at) VALUES
-- Natural persons
  (gen_random_uuid(), 'PPERS00001', 'PERSON',   '2022-03-10 08:00:00+02'),
  (gen_random_uuid(), 'PPERS00002', 'PERSON',   '2022-03-10 08:05:00+02'),
  (gen_random_uuid(), 'PPERS00003', 'PERSON',   '2022-03-10 08:10:00+02'),
  (gen_random_uuid(), 'PPERS00004', 'PERSON',   '2022-03-10 08:15:00+02'),
  (gen_random_uuid(), 'PPERS00005', 'PERSON',   '2022-03-10 08:20:00+02'),
  (gen_random_uuid(), 'PPERS00006', 'PERSON',   '2022-03-10 08:25:00+02'),
  (gen_random_uuid(), 'PPERS00007', 'PERSON',   '2022-03-10 08:30:00+02'),
  (gen_random_uuid(), 'PPERS00008', 'PERSON',   '2022-03-10 08:35:00+02'),
  (gen_random_uuid(), 'PPERS00009', 'PERSON',   '2022-03-10 08:40:00+02'),
  (gen_random_uuid(), 'PPERS00010', 'PERSON',   '2022-03-10 08:45:00+02'),
  (gen_random_uuid(), 'PPERS00011', 'PERSON',   '2022-03-10 08:50:00+02'),
  (gen_random_uuid(), 'PPERS00012', 'PERSON',   '2022-03-10 08:55:00+02'),
  (gen_random_uuid(), 'PPERS00013', 'PERSON',   '2022-03-10 09:00:00+02'),
  (gen_random_uuid(), 'PPERS00014', 'PERSON',   '2022-03-10 09:05:00+02'),
  (gen_random_uuid(), 'PPERS00015', 'PERSON',   '2022-03-10 09:10:00+02'),
  (gen_random_uuid(), 'PPERS00016', 'PERSON',   '2022-03-10 09:15:00+02'),
  (gen_random_uuid(), 'PPERS00017', 'PERSON',   '2022-03-10 09:20:00+02'),
  (gen_random_uuid(), 'PPERS00018', 'PERSON',   '2022-03-10 09:25:00+02'),
  (gen_random_uuid(), 'PPERS00019', 'PERSON',   '2022-03-10 09:30:00+02'),
  (gen_random_uuid(), 'PPERS00020', 'PERSON',   '2022-03-10 09:35:00+02'),
  (gen_random_uuid(), 'PPERS00021', 'PERSON',   '2022-03-10 09:40:00+02'),
  (gen_random_uuid(), 'PPERS00022', 'PERSON',   '2022-03-10 09:45:00+02'),
  (gen_random_uuid(), 'PPERS00023', 'PERSON',   '2022-03-10 09:50:00+02'),
  (gen_random_uuid(), 'PPERS00024', 'PERSON',   '2022-03-10 09:55:00+02'),
  (gen_random_uuid(), 'PPERS00025', 'PERSON',   '2022-03-10 10:00:00+02'),
  (gen_random_uuid(), 'PPERS00026', 'PERSON',   '2022-03-10 10:05:00+02'),
  (gen_random_uuid(), 'PPERS00027', 'PERSON',   '2022-03-10 10:10:00+02'),
  (gen_random_uuid(), 'PPERS00028', 'PERSON',   '2022-03-10 10:15:00+02'),
  (gen_random_uuid(), 'PPERS00029', 'PERSON',   '2022-03-10 10:20:00+02'),
  (gen_random_uuid(), 'PPERS00030', 'PERSON',   '2022-03-10 10:25:00+02'),
-- Judicial persons
  (gen_random_uuid(), 'JPERS00001', 'PERSON',   '2022-04-01 09:00:00+02'),
  (gen_random_uuid(), 'JPERS00002', 'PERSON',   '2022-04-01 09:05:00+02'),
  (gen_random_uuid(), 'JPERS00003', 'PERSON',   '2022-04-01 09:10:00+02'),
  (gen_random_uuid(), 'JPERS00004', 'PERSON',   '2022-04-01 09:15:00+02'),
  (gen_random_uuid(), 'JPERS00005', 'PERSON',   '2022-04-01 09:20:00+02'),
  (gen_random_uuid(), 'JPERS00006', 'PERSON',   '2022-04-01 09:25:00+02'),
  (gen_random_uuid(), 'JPERS00007', 'PERSON',   '2022-04-01 09:30:00+02'),
  (gen_random_uuid(), 'JPERS00008', 'PERSON',   '2022-04-01 09:35:00+02'),
  (gen_random_uuid(), 'JPERS00009', 'PERSON',   '2022-04-01 09:40:00+02'),
  (gen_random_uuid(), 'JPERS00010', 'PERSON',   '2022-04-01 09:45:00+02'),
  (gen_random_uuid(), 'JPERS00011', 'PERSON',   '2022-04-01 09:50:00+02'),
  (gen_random_uuid(), 'JPERS00012', 'PERSON',   '2022-04-01 09:55:00+02'),
  (gen_random_uuid(), 'JPERS00013', 'PERSON',   '2022-04-01 10:00:00+02'),
  (gen_random_uuid(), 'JPERS00014', 'PERSON',   '2022-04-01 10:05:00+02'),
  (gen_random_uuid(), 'JPERS00015', 'PERSON',   '2022-04-01 10:10:00+02'),
  (gen_random_uuid(), 'JPERS00016', 'PERSON',   '2022-04-01 10:15:00+02'),
  (gen_random_uuid(), 'JPERS00017', 'PERSON',   '2022-04-01 10:20:00+02'),
  (gen_random_uuid(), 'JPERS00018', 'PERSON',   '2022-04-01 10:25:00+02'),
  (gen_random_uuid(), 'JPERS00019', 'PERSON',   '2022-04-01 10:30:00+02'),
  (gen_random_uuid(), 'JPERS00020', 'PERSON',   '2022-04-01 10:35:00+02'),
  (gen_random_uuid(), 'JPERS00021', 'PERSON',   '2022-04-01 10:40:00+02'),
  (gen_random_uuid(), 'JPERS00022', 'PERSON',   '2022-04-01 10:45:00+02'),
  (gen_random_uuid(), 'JPERS00023', 'PERSON',   '2022-04-01 10:50:00+02'),
  (gen_random_uuid(), 'JPERS00024', 'PERSON',   '2022-04-01 10:55:00+02'),
  (gen_random_uuid(), 'JPERS00025', 'PERSON',   '2022-04-01 11:00:00+02'),
  (gen_random_uuid(), 'JPERS00026', 'PERSON',   '2022-04-01 11:05:00+02'),
  (gen_random_uuid(), 'JPERS00027', 'PERSON',   '2022-04-01 11:10:00+02'),
  (gen_random_uuid(), 'JPERS00028', 'PERSON',   '2022-04-01 11:15:00+02'),
  (gen_random_uuid(), 'JPERS00029', 'PERSON',   '2022-04-01 11:20:00+02'),
  (gen_random_uuid(), 'JPERS00030', 'PERSON',   '2022-04-01 11:25:00+02'),
-- Properties
  (gen_random_uuid(), 'PROP00001',  'PROPERTY', '2022-05-02 10:00:00+02'),
  (gen_random_uuid(), 'PROP00002',  'PROPERTY', '2022-05-02 10:10:00+02'),
  (gen_random_uuid(), 'PROP00003',  'PROPERTY', '2022-05-02 10:20:00+02'),
  (gen_random_uuid(), 'PROP00004',  'PROPERTY', '2022-05-02 10:30:00+02'),
  (gen_random_uuid(), 'PROP00005',  'PROPERTY', '2022-05-02 10:40:00+02'),
  (gen_random_uuid(), 'PROP00006',  'PROPERTY', '2022-05-02 10:50:00+02'),
  (gen_random_uuid(), 'PROP00007',  'PROPERTY', '2022-05-02 11:00:00+02'),
  (gen_random_uuid(), 'PROP00008',  'PROPERTY', '2022-05-02 11:10:00+02'),
  (gen_random_uuid(), 'PROP00009',  'PROPERTY', '2022-05-02 11:20:00+02'),
  (gen_random_uuid(), 'PROP00010',  'PROPERTY', '2022-05-02 11:30:00+02'),
  (gen_random_uuid(), 'PROP00011',  'PROPERTY', '2022-05-02 11:40:00+02'),
  (gen_random_uuid(), 'PROP00012',  'PROPERTY', '2022-05-02 11:50:00+02'),
  (gen_random_uuid(), 'PROP00013',  'PROPERTY', '2022-05-03 09:00:00+02'),
  (gen_random_uuid(), 'PROP00014',  'PROPERTY', '2022-05-03 09:15:00+02'),
  (gen_random_uuid(), 'PROP00015',  'PROPERTY', '2022-05-03 09:30:00+02'),
  (gen_random_uuid(), 'PROP00016',  'PROPERTY', '2022-05-03 09:45:00+02'),
  (gen_random_uuid(), 'PROP00017',  'PROPERTY', '2022-05-03 10:00:00+02'),
  (gen_random_uuid(), 'PROP00018',  'PROPERTY', '2022-05-03 10:15:00+02'),
  (gen_random_uuid(), 'PROP00019',  'PROPERTY', '2022-05-03 10:30:00+02'),
  (gen_random_uuid(), 'PROP00020',  'PROPERTY', '2022-05-03 10:45:00+02'),
  (gen_random_uuid(), 'PROP00021',  'PROPERTY', '2022-06-01 09:00:00+02'),
  (gen_random_uuid(), 'PROP00022',  'PROPERTY', '2022-06-01 09:20:00+02'),
  (gen_random_uuid(), 'PROP00023',  'PROPERTY', '2022-06-01 09:40:00+02'),
  (gen_random_uuid(), 'PROP00024',  'PROPERTY', '2022-06-01 10:00:00+02'),
  (gen_random_uuid(), 'PROP00025',  'PROPERTY', '2022-06-01 10:20:00+02'),
  (gen_random_uuid(), 'PROP00026',  'PROPERTY', '2022-06-01 10:40:00+02'),
  (gen_random_uuid(), 'PROP00027',  'PROPERTY', '2022-06-01 11:00:00+02'),
  (gen_random_uuid(), 'PROP00028',  'PROPERTY', '2022-06-01 11:20:00+02'),
  (gen_random_uuid(), 'PROP00029',  'PROPERTY', '2022-06-01 11:40:00+02'),
  (gen_random_uuid(), 'PROP00030',  'PROPERTY', '2022-06-01 12:00:00+02'),
  (gen_random_uuid(), 'PROP00031',  'PROPERTY', '2022-07-04 09:00:00+02'),
  (gen_random_uuid(), 'PROP00032',  'PROPERTY', '2022-07-04 09:20:00+02'),
  (gen_random_uuid(), 'PROP00033',  'PROPERTY', '2022-07-04 09:40:00+02'),
  (gen_random_uuid(), 'PROP00034',  'PROPERTY', '2022-07-04 10:00:00+02'),
  (gen_random_uuid(), 'PROP00035',  'PROPERTY', '2022-07-04 10:20:00+02'),
  (gen_random_uuid(), 'PROP00036',  'PROPERTY', '2022-07-04 10:40:00+02'),
  (gen_random_uuid(), 'PROP00037',  'PROPERTY', '2022-07-04 11:00:00+02'),
  (gen_random_uuid(), 'PROP00038',  'PROPERTY', '2022-07-04 11:20:00+02'),
  (gen_random_uuid(), 'PROP00039',  'PROPERTY', '2022-07-04 11:40:00+02'),
  (gen_random_uuid(), 'PROP00040',  'PROPERTY', '2022-07-04 12:00:00+02'),
-- Documents
  (gen_random_uuid(), 'DOC00001',   'DOCUMENT', '2022-08-01 09:00:00+02'),
  (gen_random_uuid(), 'DOC00002',   'DOCUMENT', '2022-08-01 09:10:00+02'),
  (gen_random_uuid(), 'DOC00003',   'DOCUMENT', '2022-08-01 09:20:00+02'),
  (gen_random_uuid(), 'DOC00004',   'DOCUMENT', '2022-08-01 09:30:00+02'),
  (gen_random_uuid(), 'DOC00005',   'DOCUMENT', '2022-08-01 09:40:00+02'),
  (gen_random_uuid(), 'DOC00006',   'DOCUMENT', '2022-08-01 09:50:00+02'),
  (gen_random_uuid(), 'DOC00007',   'DOCUMENT', '2022-08-01 10:00:00+02'),
  (gen_random_uuid(), 'DOC00008',   'DOCUMENT', '2022-08-01 10:10:00+02'),
  (gen_random_uuid(), 'DOC00009',   'DOCUMENT', '2022-08-01 10:20:00+02'),
  (gen_random_uuid(), 'DOC00010',   'DOCUMENT', '2022-08-01 10:30:00+02'),
  (gen_random_uuid(), 'DOC00011',   'DOCUMENT', '2022-08-02 09:00:00+02'),
  (gen_random_uuid(), 'DOC00012',   'DOCUMENT', '2022-08-02 09:10:00+02'),
  (gen_random_uuid(), 'DOC00013',   'DOCUMENT', '2022-08-02 09:20:00+02'),
  (gen_random_uuid(), 'DOC00014',   'DOCUMENT', '2022-08-02 09:30:00+02'),
  (gen_random_uuid(), 'DOC00015',   'DOCUMENT', '2022-08-02 09:40:00+02'),
  (gen_random_uuid(), 'DOC00016',   'DOCUMENT', '2022-08-02 09:50:00+02'),
  (gen_random_uuid(), 'DOC00017',   'DOCUMENT', '2022-08-02 10:00:00+02'),
  (gen_random_uuid(), 'DOC00018',   'DOCUMENT', '2022-08-02 10:10:00+02'),
  (gen_random_uuid(), 'DOC00019',   'DOCUMENT', '2022-08-02 10:20:00+02'),
  (gen_random_uuid(), 'DOC00020',   'DOCUMENT', '2022-08-02 10:30:00+02'),
  (gen_random_uuid(), 'DOC00021',   'DOCUMENT', '2022-09-05 09:00:00+02'),
  (gen_random_uuid(), 'DOC00022',   'DOCUMENT', '2022-09-05 09:15:00+02'),
  (gen_random_uuid(), 'DOC00023',   'DOCUMENT', '2022-09-05 09:30:00+02'),
  (gen_random_uuid(), 'DOC00024',   'DOCUMENT', '2022-09-05 09:45:00+02'),
  (gen_random_uuid(), 'DOC00025',   'DOCUMENT', '2022-09-05 10:00:00+02'),
  (gen_random_uuid(), 'DOC00026',   'DOCUMENT', '2022-09-05 10:15:00+02'),
  (gen_random_uuid(), 'DOC00027',   'DOCUMENT', '2022-09-05 10:30:00+02'),
  (gen_random_uuid(), 'DOC00028',   'DOCUMENT', '2022-09-05 10:45:00+02'),
  (gen_random_uuid(), 'DOC00029',   'DOCUMENT', '2022-09-05 11:00:00+02'),
  (gen_random_uuid(), 'DOC00030',   'DOCUMENT', '2022-09-05 11:15:00+02'),
  (gen_random_uuid(), 'DOC00031',   'DOCUMENT', '2022-10-10 09:00:00+02'),
  (gen_random_uuid(), 'DOC00032',   'DOCUMENT', '2022-10-10 09:15:00+02'),
  (gen_random_uuid(), 'DOC00033',   'DOCUMENT', '2022-10-10 09:30:00+02'),
  (gen_random_uuid(), 'DOC00034',   'DOCUMENT', '2022-10-10 09:45:00+02'),
  (gen_random_uuid(), 'DOC00035',   'DOCUMENT', '2022-10-10 10:00:00+02'),
  (gen_random_uuid(), 'DOC00036',   'DOCUMENT', '2022-10-10 10:15:00+02'),
  (gen_random_uuid(), 'DOC00037',   'DOCUMENT', '2022-10-10 10:30:00+02'),
  (gen_random_uuid(), 'DOC00038',   'DOCUMENT', '2022-10-10 10:45:00+02'),
  (gen_random_uuid(), 'DOC00039',   'DOCUMENT', '2022-10-10 11:00:00+02'),
  (gen_random_uuid(), 'DOC00040',   'DOCUMENT', '2022-10-10 11:15:00+02'),
  (gen_random_uuid(), 'DOC00041',   'DOCUMENT', '2022-11-14 09:00:00+02'),
  (gen_random_uuid(), 'DOC00042',   'DOCUMENT', '2022-11-14 09:15:00+02'),
  (gen_random_uuid(), 'DOC00043',   'DOCUMENT', '2022-11-14 09:30:00+02'),
  (gen_random_uuid(), 'DOC00044',   'DOCUMENT', '2022-11-14 09:45:00+02'),
  (gen_random_uuid(), 'DOC00045',   'DOCUMENT', '2022-11-14 10:00:00+02'),
  (gen_random_uuid(), 'DOC00046',   'DOCUMENT', '2022-11-14 10:15:00+02'),
  (gen_random_uuid(), 'DOC00047',   'DOCUMENT', '2022-11-14 10:30:00+02'),
  (gen_random_uuid(), 'DOC00048',   'DOCUMENT', '2022-11-14 10:45:00+02'),
  (gen_random_uuid(), 'DOC00049',   'DOCUMENT', '2022-11-14 11:00:00+02'),
  (gen_random_uuid(), 'DOC00050',   'DOCUMENT', '2022-11-14 11:15:00+02'),
  (gen_random_uuid(), 'DOC00051',   'DOCUMENT', '2023-01-09 09:00:00+02'),
  (gen_random_uuid(), 'DOC00052',   'DOCUMENT', '2023-01-09 09:15:00+02'),
  (gen_random_uuid(), 'DOC00053',   'DOCUMENT', '2023-01-09 09:30:00+02'),
  (gen_random_uuid(), 'DOC00054',   'DOCUMENT', '2023-01-09 09:45:00+02'),
  (gen_random_uuid(), 'DOC00055',   'DOCUMENT', '2023-01-09 10:00:00+02'),
  (gen_random_uuid(), 'DOC00056',   'DOCUMENT', '2023-01-09 10:15:00+02'),
  (gen_random_uuid(), 'DOC00057',   'DOCUMENT', '2023-01-09 10:30:00+02'),
  (gen_random_uuid(), 'DOC00058',   'DOCUMENT', '2023-01-09 10:45:00+02'),
  (gen_random_uuid(), 'DOC00059',   'DOCUMENT', '2023-01-09 11:00:00+02'),
  (gen_random_uuid(), 'DOC00060',   'DOCUMENT', '2023-01-09 11:15:00+02'),
  (gen_random_uuid(), 'DOC00061',   'DOCUMENT', '2023-02-20 09:00:00+02'),
  (gen_random_uuid(), 'DOC00062',   'DOCUMENT', '2023-02-20 09:20:00+02'),
  (gen_random_uuid(), 'DOC00063',   'DOCUMENT', '2023-02-20 09:40:00+02'),
  (gen_random_uuid(), 'DOC00064',   'DOCUMENT', '2023-02-20 10:00:00+02'),
  (gen_random_uuid(), 'DOC00065',   'DOCUMENT', '2023-02-20 10:20:00+02'),
  (gen_random_uuid(), 'DOC00066',   'DOCUMENT', '2023-02-20 10:40:00+02'),
  (gen_random_uuid(), 'DOC00067',   'DOCUMENT', '2023-02-20 11:00:00+02'),
  (gen_random_uuid(), 'DOC00068',   'DOCUMENT', '2023-02-20 11:20:00+02'),
  (gen_random_uuid(), 'DOC00069',   'DOCUMENT', '2023-02-20 11:40:00+02'),
  (gen_random_uuid(), 'DOC00070',   'DOCUMENT', '2023-02-20 12:00:00+02');

-- =============================================================================
-- 2. PERSON rows (base table)
-- =============================================================================

INSERT INTO person (id, principal_object_id, code, type, display_name, notes, created_at, updated_at)
SELECT gen_random_uuid(), po.id, v.code, v.ptype::person_type, v.display_name, v.notes, v.cat::timestamptz, v.cat::timestamptz
FROM (VALUES
-- Natural persons
  ('PPERS00001','NATURAL','Ion Popescu',         'Proprietar terenuri agricole în Bragadiru. Colaborare activă.', '2022-03-10 08:00:00+02'),
  ('PPERS00002','NATURAL','Maria Ionescu',        'Moștenitoare după tatăl decedat în 2019.', '2022-03-10 08:05:00+02'),
  ('PPERS00003','NATURAL','Gheorghe Dumitru',     'Creat din carte de identitate scanată. Proprietar teren arabil.', '2022-03-10 08:10:00+02'),
  ('PPERS00004','NATURAL','Ana Constantin',       'Coproprietar teren cu fratele Nicolae. Dosar succesoral în curs.', '2022-03-10 08:15:00+02'),
  ('PPERS00005','NATURAL','Nicolae Popa',          'Proprietar mai multor parcele în tarla 3 și tarla 5.', '2022-03-10 08:20:00+02'),
  ('PPERS00006','NATURAL','Elena Marin',           'Coproprietar teren cu soțul.', '2022-03-10 08:25:00+02'),
  ('PPERS00007','NATURAL','Vasile Gheorghe',       'Avocat și reprezentant legal. Colaborator frecvent.', '2022-03-10 08:30:00+02'),
  ('PPERS00008','NATURAL','Ioana Radu',            'Solicitant autorizație construire bloc 7.', '2022-03-10 08:35:00+02'),
  ('PPERS00009','NATURAL','Dumitru Stan',          'Creat din carte de identitate. Proprietar casă și teren.', '2022-03-10 08:40:00+02'),
  ('PPERS00010','NATURAL','Florica Dinu',          'Proprietar teren pășune. Colaborare pentru arendare.', '2022-03-10 08:45:00+02'),
  ('PPERS00011','NATURAL','Alexandru Stoica',      'Coproprietar cu soția Mihaela Vlad.', '2022-03-10 08:50:00+02'),
  ('PPERS00012','NATURAL','Mihaela Vlad',          'Coproprietar și moștenitoare parțială.', '2022-03-10 08:55:00+02'),
  ('PPERS00013','NATURAL','Traian Ardelean',       'Proprietar teren vii. Dosar succesoral finalizat 2021.', '2022-03-10 09:00:00+02'),
  ('PPERS00014','NATURAL','Cornelia Oprea',        'Proprietar mai multor parcele adiacente str. Independenței.', '2022-03-10 09:05:00+02'),
  ('PPERS00015','NATURAL','Bogdan Ciobanu',        'Coproprietar teren cu părinții.', '2022-03-10 09:10:00+02'),
  ('PPERS00016','NATURAL','Adriana Luca',          'Proprietar apartament și garaj.', '2022-03-10 09:15:00+02'),
  ('PPERS00017','NATURAL','Sorin Niculescu',       'Beneficiar contract prestări servicii cu SC Topogeo Expert SRL.', '2022-03-10 09:20:00+02'),
  ('PPERS00018','NATURAL','Luminița Badea',        'Proprietar teren arabil moștenit de la părinți.', '2022-03-10 09:25:00+02'),
  ('PPERS00019','NATURAL','Cristian Moldovan',     'Cumpărător teren în 2022 de la Stela Manolescu.', '2022-03-10 09:30:00+02'),
  ('PPERS00020','NATURAL','Roxana Petrescu',       'Moștenitoare dosar succesoral Ionescu.', '2022-03-10 09:35:00+02'),
  ('PPERS00021','NATURAL','Marian Ene',            'Proprietar mai multor terenuri din tarla 5. Vârstnic.', '2022-03-10 09:40:00+02'),
  ('PPERS00022','NATURAL','Simona Tudor',          'Proprietar teren construit cu casă veche.', '2022-03-10 09:45:00+02'),
  ('PPERS00023','NATURAL','Petre Lazăr',           'Topograf autorizat. Expert cadastral independent.', '2022-03-10 09:50:00+02'),
  ('PPERS00024','NATURAL','Daniela Nistor',        'Beneficiar certificat urbanism pentru extindere.', '2022-03-10 09:55:00+02'),
  ('PPERS00025','NATURAL','Gabriel Florea',        'Constructor autorizat. Responsabil execuție bloc B2.', '2022-03-10 10:00:00+02'),
  ('PPERS00026','NATURAL','Oana Matei',            'Proprietar apartament bloc 3. Dosar înregistrat OCPI.', '2022-03-10 10:05:00+02'),
  ('PPERS00027','NATURAL','Augustin Coman',        'Proprietar teren fânețe. Cel mai în vârstă proprietar din zonă.', '2022-03-10 10:10:00+02'),
  ('PPERS00028','NATURAL','Lavinia Chirilă',       'Proprietar lot nou rezultat din dezmembrare 2022.', '2022-03-10 10:15:00+02'),
  ('PPERS00029','NATURAL','Radu Barbu',            'Cumpărător recent. Contract vânzare autentificat notarial.', '2022-03-10 10:20:00+02'),
  ('PPERS00030','NATURAL','Stela Manolescu',       'Vânzător teren 2022. Proprietar inițial al mai multor parcele.', '2022-03-10 10:25:00+02'),
-- Judicial persons
  ('JPERS00001','JUDICIAL','SC Agro Trans SRL',                 'Firmă de transport și comercializare produse agricole din zonă.', '2022-04-01 09:00:00+02'),
  ('JPERS00002','JUDICIAL','SC Construct Plus SRL',             'Constructor autorizat. Execută lucrări în Bragadiru și Cornetu.', '2022-04-01 09:05:00+02'),
  ('JPERS00003','JUDICIAL','SC Imobiliare Centru SA',           'Societate de administrare și tranzacționare imobile.', '2022-04-01 09:10:00+02'),
  ('JPERS00004','JUDICIAL','Birou Notarial Popescu & Asociații','Birou notarial care a autentificat mai multe contracte din zonă.', '2022-04-01 09:15:00+02'),
  ('JPERS00005','JUDICIAL','SC Verde Land SRL',                 'Investitor în terenuri agricole. Arendator pe termen lung.', '2022-04-01 09:20:00+02'),
  ('JPERS00006','JUDICIAL','PFA Petre Lazăr Expert Cadastral',  'PFA autorizat pentru lucrări topografice și cadastrale.', '2022-04-01 09:25:00+02'),
  ('JPERS00007','JUDICIAL','SC Drumuri și Poduri SRL',          'Firmă de construcții infrastructură rutieră.', '2022-04-01 09:30:00+02'),
  ('JPERS00008','JUDICIAL','Primăria Comunei Bragadiru',        'Emitent autorizații și avize pentru UAT Bragadiru.', '2022-04-01 09:35:00+02'),
  ('JPERS00009','JUDICIAL','SC Topogeo Expert SRL',             'Firmă de topografie și consultanță cadastrală.', '2022-04-01 09:40:00+02'),
  ('JPERS00010','JUDICIAL','SC CasaGroup SA',                   'Dezvoltator imobiliar rezidențial. Proiecte în Ilfov.', '2022-04-01 09:45:00+02'),
  ('JPERS00011','JUDICIAL','Consiliu Județean Ilfov',           'Autoritate publică județeană. Emitent avize și hotărâri.', '2022-04-01 09:50:00+02'),
  ('JPERS00012','JUDICIAL','SC AlphaConstruct SRL',             'Firmă de construcții civile și industriale.', '2022-04-01 09:55:00+02'),
  ('JPERS00013','JUDICIAL','OCPI Ilfov',                        'Oficiu de Cadastru și Publicitate Imobiliară Ilfov.', '2022-04-01 10:00:00+02'),
  ('JPERS00014','JUDICIAL','SC BetaImob SRL-D',                 'Start-up imobiliar. Intermediar tranzacții terenuri.', '2022-04-01 10:05:00+02'),
  ('JPERS00015','JUDICIAL','IF Radu și Ionescu',                'Întreprindere familială. Activitate agricolă.', '2022-04-01 10:10:00+02'),
  ('JPERS00016','JUDICIAL','SC Geodezica Plus SRL',             'Firmă specializată în ridicări topo și GIS.', '2022-04-01 10:15:00+02'),
  ('JPERS00017','JUDICIAL','SC Forestia SA',                    'Societate de administrare fond forestier și păduri.', '2022-04-01 10:20:00+02'),
  ('JPERS00018','JUDICIAL','PFA Maria Ionescu Expert Contabil', 'Expert contabil autorizat CECCAR.', '2022-04-01 10:25:00+02'),
  ('JPERS00019','JUDICIAL','SC Terra Invest SRL',               'Investitor în terenuri intravilane și extravilane.', '2022-04-01 10:30:00+02'),
  ('JPERS00020','JUDICIAL','SC Nord Agro SRL',                  'Firmă agricolă. Administrează 450 ha teren arabil în Ilfov.', '2022-04-01 10:35:00+02'),
  ('JPERS00021','JUDICIAL','SC Arhitectura Viitorului SRL',     'Birou de arhitectură. Proiecte rezidențiale și comerciale.', '2022-04-01 10:40:00+02'),
  ('JPERS00022','JUDICIAL','SC Energo Construct SA',            'Construcții și instalații energetice.', '2022-04-01 10:45:00+02'),
  ('JPERS00023','JUDICIAL','Asociația Proprietarilor Bloc 7',   'Asociație de proprietari. Administrează imobilul bloc 7.', '2022-04-01 10:50:00+02'),
  ('JPERS00024','JUDICIAL','SC Administrare Imobile SRL',       'Firmă de administrare și întreținere imobile.', '2022-04-01 10:55:00+02'),
  ('JPERS00025','JUDICIAL','SC Delta Prom SRL',                 'Promovare și intermediere imobiliară.', '2022-04-01 11:00:00+02'),
  ('JPERS00026','JUDICIAL','SC Topocad SRL',                    'Firmă de cadastru și topografie. Partener OCPI Ilfov.', '2022-04-01 11:05:00+02'),
  ('JPERS00027','JUDICIAL','Judecătoria Sectorului 5',          'Instanță judecătorească. Emitent hotărâri judecătorești.', '2022-04-01 11:10:00+02'),
  ('JPERS00028','JUDICIAL','SC ProAgro SRL',                    'Producție și procesare produse agricole.', '2022-04-01 11:15:00+02'),
  ('JPERS00029','JUDICIAL','SC Rezidențial Nord SA',            'Dezvoltator complex rezidențial în nordul comunei.', '2022-04-01 11:20:00+02'),
  ('JPERS00030','JUDICIAL','II Gheorghe Dumitru',               'Întreprindere individuală. Prestări servicii agricole.', '2022-04-01 11:25:00+02')
) AS v(code, ptype, display_name, notes, cat)
JOIN principal_object po ON po.code = v.code;

-- =============================================================================
-- 3. NATURAL_PERSON rows (30)
-- =============================================================================

INSERT INTO natural_person (
  person_id, first_name, last_name, nickname, cnp,
  id_document_type, id_document_number, id_card_number,
  gender, date_of_birth, place_of_birth,
  id_issuing_authority, id_valid_from, id_valid_until,
  personal_phone_1, personal_phone_2, personal_email_1, work_email,
  citizenship_id, physical_person_type_id,
  correspondence_same_as_home
)
SELECT
  p.id,
  v.first_name, v.last_name, v.nickname, v.cnp,
  v.id_doc_type::id_document_type, v.id_doc_nr, v.id_card_nr,
  v.gender::gender, v.dob::date, v.pob,
  v.issuing_auth, v.id_from::date, v.id_until::date,
  v.phone1, v.phone2, v.email1, v.email_w,
  (SELECT id FROM lookup_citizenship WHERE name = v.citizenship LIMIT 1),
  (SELECT id FROM lookup_person_type WHERE name = v.person_type_name LIMIT 1),
  v.corr_same
FROM (VALUES
  ('PPERS00001','Ion',       'Popescu',   NULL,          '1650312130012','ID_CARD','IF123456','IF123456','MALE',  '1965-03-12','Bragadiru',   'SPCLEP Bragadiru','2015-04-10','2025-04-10','0722 111 001',NULL,            'ion.popescu@email.ro',      NULL,               'Română','Persoană Fizică',false),
  ('PPERS00002','Maria',     'Ionescu',   'Mari',        '2720825130023','ID_CARD','IF234567','IF234567','FEMALE','1972-08-25','Bragadiru',   'SPCLEP Bragadiru','2017-09-01','2027-09-01','0733 222 002',NULL,            'maria.ionescu@email.ro',    NULL,               'Română','Persoană Fizică',false),
  ('PPERS00003','Gheorghe',  'Dumitru',   'Ghiță',       '1580311130034','ID_CARD','IF345678','IF345678','MALE',  '1958-03-11','Cornetu',     'SPCLEP Cornetu',  '2013-05-20','2023-05-20','0744 333 003',NULL,            'ghe.dumitru@email.ro',      NULL,               'Română','Persoană Fizică',true),
  ('PPERS00004','Ana',       'Constantin',NULL,          '2800517130045','ID_CARD','IF456789','IF456789','FEMALE','1980-05-17','București',   'SPCLEP Sect.3',   '2019-06-01','2029-06-01','0755 444 004',NULL,            'ana.constantin@email.ro',   NULL,               'Română','Persoană Fizică',false),
  ('PPERS00005','Nicolae',   'Popa',      'Nicu',        '1470228130056','ID_CARD','IF567890','IF567890','MALE',  '1947-02-28','Bragadiru',   'SPCLEP Bragadiru','2010-03-15','2025-03-15','0766 555 005',NULL,            NULL,                        NULL,               'Română','Persoană Fizică',false),
  ('PPERS00006','Elena',     'Marin',     NULL,          '2630914130067','ID_CARD','IF678901','IF678901','FEMALE','1963-09-14','Bragadiru',   'SPCLEP Bragadiru','2014-10-01','2024-10-01','0777 666 006',NULL,            'elena.marin@email.ro',      NULL,               'Română','Persoană Fizică',false),
  ('PPERS00007','Vasile',    'Gheorghe',  NULL,          '1750422130078','ID_CARD','IF789012','IF789012','MALE',  '1975-04-22','București',   'SPCLEP Sect.1',   '2018-05-10','2028-05-10','0788 777 007','0788 777 008', 'vasile.gheorghe@avocat.ro', 'v.gheorghe@firma.ro','Română','Persoană Fizică',false),
  ('PPERS00008','Ioana',     'Radu',      NULL,          '2881201130089','ID_CARD','IF890123','IF890123','FEMALE','1988-12-01','Chitila',     'SPCLEP Chitila',  '2020-01-15','2030-01-15','0799 888 008',NULL,            'ioana.radu@email.ro',       NULL,               'Română','Persoană Fizică',false),
  ('PPERS00009','Dumitru',   'Stan',      'Mitică',      '1540630130090','ID_CARD','IF901234','IF901234','MALE',  '1954-06-30','Bragadiru',   'SPCLEP Bragadiru','2012-07-20','2022-07-20','0700 999 009',NULL,            NULL,                        NULL,               'Română','Persoană Fizică',true),
  ('PPERS00010','Florica',   'Dinu',      NULL,          '2610108130011','ID_CARD','IF012345','IF012345','FEMALE','1961-01-08','Bragadiru',   'SPCLEP Bragadiru','2016-02-01','2026-02-01','0711 000 010',NULL,            'florica.dinu@email.ro',     NULL,               'Română','Persoană Fizică',false),
  ('PPERS00011','Alexandru', 'Stoica',    'Alex',        '1700719130022','ID_CARD','IF123450','IF123450','MALE',  '1970-07-19','București',   'SPCLEP Sect.4',   '2017-08-05','2027-08-05','0722 011 011',NULL,            'alex.stoica@email.ro',      NULL,               'Română','Persoană Fizică',false),
  ('PPERS00012','Mihaela',   'Vlad',      'Miha',        '2831005130033','ID_CARD','IF234560','IF234560','FEMALE','1983-10-05','Cornetu',     'SPCLEP Cornetu',  '2021-11-01','2031-11-01','0733 022 012',NULL,            'mihaela.vlad@email.ro',     NULL,               'Română','Persoană Fizică',false),
  ('PPERS00013','Traian',    'Ardelean',  NULL,          '1490327130044','ID_CARD','IF345670','IF345670','MALE',  '1949-03-27','Turda',       'SPCLEP Turda',    '2009-04-10','2024-04-10','0744 033 013',NULL,            NULL,                        NULL,               'Română','Persoană Fizică',false),
  ('PPERS00014','Cornelia',  'Oprea',     NULL,          '2671215130055','ID_CARD','IF456780','IF456780','FEMALE','1967-12-15','Bragadiru',   'SPCLEP Bragadiru','2015-01-20','2025-01-20','0755 044 014',NULL,            'cornelia.oprea@email.ro',   NULL,               'Română','Persoană Fizică',false),
  ('PPERS00015','Bogdan',    'Ciobanu',   NULL,          '1850809130066','ID_CARD','IF567800','IF567800','MALE',  '1985-08-09','Popești-Leordeni','SPCLEP P-L','2022-09-01','2032-09-01','0766 055 015',NULL,            'bogdan.ciobanu@email.ro',   NULL,               'Română','Persoană Fizică',false),
  ('PPERS00016','Adriana',   'Luca',      NULL,          '2781123130077','ID_CARD','IF678900','IF678900','FEMALE','1978-11-23','Bragadiru',   'SPCLEP Bragadiru','2018-12-10','2028-12-10','0777 066 016',NULL,            'adriana.luca@email.ro',     NULL,               'Română','Persoană Fizică',false),
  ('PPERS00017','Sorin',     'Niculescu', NULL,          '1930214130088','ID_CARD','IF789000','IF789000','MALE',  '1993-02-14','București',   'SPCLEP Sect.2',   '2021-03-01','2031-03-01','0788 077 017',NULL,            'sorin.nic@email.ro',        NULL,               'Română','Persoană Fizică',false),
  ('PPERS00018','Luminița',  'Badea',     NULL,          '2560430130099','ID_CARD','IF890100','IF890100','FEMALE','1956-04-30','Bragadiru',   'SPCLEP Bragadiru','2011-05-15','2026-05-15','0799 088 018',NULL,            NULL,                        NULL,               'Română','Persoană Fizică',false),
  ('PPERS00019','Cristian',  'Moldovan',  'Cristi',      '1760908130010','ID_CARD','IF901200','IF901200','MALE',  '1976-09-08','Cluj-Napoca', 'SPCLEP Cluj',     '2019-10-01','2029-10-01','0700 099 019',NULL,            'cristi.moldovan@email.ro',  NULL,               'Română','Persoană Fizică',false),
  ('PPERS00020','Roxana',    'Petrescu',  NULL,          '2910621130021','ID_CARD','IF012300','IF012300','FEMALE','1991-06-21','București',   'SPCLEP Sect.5',   '2023-07-01','2033-07-01','0711 100 020',NULL,            'roxana.petrescu@email.ro',  NULL,               'Română','Persoană Fizică',false),
  ('PPERS00021','Marian',    'Ene',       NULL,          '1430115130032','ID_CARD','IF123400','IF123400','MALE',  '1943-01-15','Bragadiru',   'SPCLEP Bragadiru','2005-02-01','2025-02-01','0722 111 021',NULL,            NULL,                        NULL,               'Română','Persoană Fizică',true),
  ('PPERS00022','Simona',    'Tudor',     NULL,          '2680704130043','ID_CARD','IF234500','IF234500','FEMALE','1968-07-04','Bragadiru',   'SPCLEP Bragadiru','2016-08-10','2026-08-10','0733 122 022',NULL,            'simona.tudor@email.ro',     NULL,               'Română','Persoană Fizică',false),
  ('PPERS00023','Petre',     'Lazăr',     NULL,          '1721111130054','ID_CARD','IF345500','IF345500','MALE',  '1972-11-11','Bragadiru',   'SPCLEP Bragadiru','2018-12-01','2028-12-01','0744 133 023','0744 133 024', 'petre.lazar@topogeo.ro',    NULL,               'Română','Expert',false),
  ('PPERS00024','Daniela',   'Nistor',    NULL,          '2820320130065','ID_CARD','IF456500','IF456500','FEMALE','1982-03-20','Iași',        'SPCLEP Iași',     '2020-04-01','2030-04-01','0755 144 024',NULL,            'daniela.nistor@email.ro',   NULL,               'Română','Persoană Fizică',false),
  ('PPERS00025','Gabriel',   'Florea',    'Gabi',        '1690516130076','ID_CARD','IF567500','IF567500','MALE',  '1969-05-16','Bragadiru',   'SPCLEP Bragadiru','2014-06-01','2024-06-01','0766 155 025','0766 155 026', 'gabriel.florea@construct.ro',NULL,              'Română','Persoană Fizică',false),
  ('PPERS00026','Oana',      'Matei',     NULL,          '2940827130087','ID_CARD','IF678500','IF678500','FEMALE','1994-08-27','București',   'SPCLEP Sect.6',   '2022-09-10','2032-09-10','0777 166 026',NULL,            'oana.matei@email.ro',       NULL,               'Română','Persoană Fizică',false),
  ('PPERS00027','Augustin',  'Coman',     'Gus',         '1381203130098','ID_CARD','IF789500','IF789500','MALE',  '1938-12-03','Bragadiru',   'SPCLEP Bragadiru','2000-01-10','2025-01-10','0788 177 027',NULL,            NULL,                        NULL,               'Română','Persoană Fizică',true),
  ('PPERS00028','Lavinia',   'Chirilă',   NULL,          '2861019130009','ID_CARD','IF890500','IF890500','FEMALE','1986-10-19','Pitești',     'SPCLEP Pitești',  '2019-11-01','2029-11-01','0799 188 028',NULL,            'lavinia.chirila@email.ro',  NULL,               'Română','Persoană Fizică',false),
  ('PPERS00029','Radu',      'Barbu',     NULL,          '1790206130020','ID_CARD','IF901500','IF901500','MALE',  '1979-02-06','București',   'SPCLEP Sect.3',   '2017-03-01','2027-03-01','0700 199 029',NULL,            'radu.barbu@email.ro',       NULL,               'Română','Persoană Fizică',false),
  ('PPERS00030','Stela',     'Manolescu', NULL,          '2551229130041','ID_CARD','IF012500','IF012500','FEMALE','1955-09-29','Bragadiru',   'SPCLEP Bragadiru','2012-10-15','2027-10-15','0711 200 030',NULL,            'stela.manolescu@email.ro',  NULL,               'Română','Persoană Fizică',false)
) AS v(code, first_name, last_name, nickname, cnp, id_doc_type, id_doc_nr, id_card_nr, gender, dob, pob, issuing_auth, id_from, id_until, phone1, phone2, email1, email_w, citizenship, person_type_name, corr_same)
JOIN person p ON p.code = v.code;

-- =============================================================================
-- 4. JUDICIAL_PERSON rows (30)
-- Contact persons reference natural persons by code
-- =============================================================================

INSERT INTO judicial_person (
  person_id, name, nickname, judicial_person_type_id,
  cui_number, trade_register_number,
  contact_person_1_id, contact_person_2_id,
  correspondence_same_as_hq
)
SELECT
  p.id,
  v.name, v.nickname,
  (SELECT id FROM lookup_judicial_person_type WHERE name = v.jtype LIMIT 1),
  v.cui, v.orc,
  (SELECT pp.id FROM person pp WHERE pp.code = v.cp1 LIMIT 1),
  (SELECT pp.id FROM person pp WHERE pp.code = v.cp2 LIMIT 1),
  v.corr_same
FROM (VALUES
  ('JPERS00001','SC Agro Trans SRL',                 'Agro Trans',   'SRL',   'RO12345601','J23/111/2005',  'PPERS00001',NULL,          false),
  ('JPERS00002','SC Construct Plus SRL',             'Construct+',   'SRL',   'RO23456702','J23/222/2010',  'PPERS00025',NULL,          false),
  ('JPERS00003','SC Imobiliare Centru SA',           'ImoCentru',    'SA',    'RO34567803','J40/333/2008',  'PPERS00029','PPERS00019',  false),
  ('JPERS00004','Birou Notarial Popescu & Asociații',NULL,           'Altele','RO45678904',NULL,            'PPERS00007',NULL,          true),
  ('JPERS00005','SC Verde Land SRL',                 'VerdeLand',    'SRL',   'RO56789005','J23/444/2015',  'PPERS00019',NULL,          false),
  ('JPERS00006','PFA Petre Lazăr Expert Cadastral',  'PFA Lazăr',    'PFA',   'RO67890106',NULL,            'PPERS00023',NULL,          true),
  ('JPERS00007','SC Drumuri și Poduri SRL',          'Drumuri SRL',  'SRL',   'RO78901207','J23/555/2012',  'PPERS00025',NULL,          false),
  ('JPERS00008','Primăria Comunei Bragadiru',        NULL,           'Altele','RO89012308',NULL,            NULL,         NULL,          true),
  ('JPERS00009','SC Topogeo Expert SRL',             'Topogeo',      'SRL',   'RO90123409','J23/666/2009',  'PPERS00023','PPERS00017',  false),
  ('JPERS00010','SC CasaGroup SA',                   'CasaGroup',    'SA',    'RO01234510','J40/777/2011',  'PPERS00029',NULL,          false),
  ('JPERS00011','Consiliu Județean Ilfov',           'CJ Ilfov',     'Altele','RO11223311',NULL,            NULL,         NULL,          true),
  ('JPERS00012','SC AlphaConstruct SRL',             'Alpha C',      'SRL',   'RO22334412','J23/888/2016',  'PPERS00025','PPERS00015',  false),
  ('JPERS00013','OCPI Ilfov',                        NULL,           'Altele','RO33445513',NULL,            NULL,         NULL,          true),
  ('JPERS00014','SC BetaImob SRL-D',                 'BetaImob',     'SRL-D', 'RO44556614','J23/999/2019',  'PPERS00029',NULL,          false),
  ('JPERS00015','IF Radu și Ionescu',                NULL,           'IF',    'RO55667715',NULL,            'PPERS00029','PPERS00017',  false),
  ('JPERS00016','SC Geodezica Plus SRL',             'GeodezicaPlus','SRL',   'RO66778816','J23/100/2013',  'PPERS00023',NULL,          false),
  ('JPERS00017','SC Forestia SA',                    'Forestia',     'SA',    'RO77889917','J23/200/2007',  NULL,         NULL,          false),
  ('JPERS00018','PFA Maria Ionescu Expert Contabil', 'PFA Ionescu',  'PFA',   'RO88990018',NULL,            'PPERS00002',NULL,          true),
  ('JPERS00019','SC Terra Invest SRL',               'TerraInvest',  'SRL',   'RO99001119','J23/300/2014',  'PPERS00019',NULL,          false),
  ('JPERS00020','SC Nord Agro SRL',                  'NordAgro',     'SRL',   'RO00112220','J23/400/2006',  'PPERS00021',NULL,          false),
  ('JPERS00021','SC Arhitectura Viitorului SRL',     'ArhViitor',    'SRL',   'RO11223321','J40/500/2017',  'PPERS00008',NULL,          false),
  ('JPERS00022','SC Energo Construct SA',            'EnergoCon',    'SA',    'RO22334422','J23/600/2004',  'PPERS00025',NULL,          false),
  ('JPERS00023','Asociația Proprietarilor Bloc 7',   'AsocBloc7',    'ONG',   'RO33445523',NULL,            'PPERS00016','PPERS00026',  true),
  ('JPERS00024','SC Administrare Imobile SRL',       'AdmImob',      'SRL',   'RO44556624','J23/700/2018',  NULL,         NULL,          false),
  ('JPERS00025','SC Delta Prom SRL',                 'DeltaProm',    'SRL',   'RO55667725','J23/800/2020',  'PPERS00029',NULL,          false),
  ('JPERS00026','SC Topocad SRL',                    'Topocad',      'SRL',   'RO66778826','J23/900/2011',  'PPERS00023',NULL,          false),
  ('JPERS00027','Judecătoria Sectorului 5',          NULL,           'Altele','RO77889927',NULL,            NULL,         NULL,          true),
  ('JPERS00028','SC ProAgro SRL',                    'ProAgro',      'SRL',   'RO88990028','J23/010/2009',  'PPERS00021',NULL,          false),
  ('JPERS00029','SC Rezidențial Nord SA',            'RezNord',      'SA',    'RO99001129','J23/020/2015',  'PPERS00010',NULL,          false),
  ('JPERS00030','II Gheorghe Dumitru',               NULL,           'II',    'RO00112230',NULL,            'PPERS00003',NULL,          true)
) AS v(code, name, nickname, jtype, cui, orc, cp1, cp2, corr_same)
JOIN person p ON p.code = v.code;

-- =============================================================================
-- 5. ADDRESS rows (for persons — mix of HOME and HEADQUARTERS)
-- =============================================================================

INSERT INTO address (id, person_id, kind, street_line, postal_code, locality, county, country, created_at, updated_at)
SELECT gen_random_uuid(), p.id, v.kind::address_kind, v.street, v.postal, v.locality, v.county, v.country, now(), now()
FROM (VALUES
  ('PPERS00001','HOME',        'Str. Independenței nr. 12',      '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00002','HOME',        'Str. Florilor nr. 3, ap. 2',     '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00002','POSTAL',      'Str. Mihai Eminescu nr. 45',     '010011','București',           'Ilfov',    'România'),
  ('PPERS00003','HOME',        'Str. Principală nr. 78',         '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00004','HOME',        'Bd. Unirii nr. 56, bl. C, ap. 14','030833','București',          'Ilfov',    'România'),
  ('PPERS00005','HOME',        'Str. Câmpului nr. 5',            '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00006','HOME',        'Str. Independenței nr. 7',       '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00007','HOME',        'Calea Victoriei nr. 23, et. 2',  '010061','București',           'Sector 1', 'România'),
  ('PPERS00007','POSTAL',      'Str. Avocaților nr. 4',          '030112','București',           'Sector 3', 'România'),
  ('PPERS00009','HOME',        'Str. Câmpului nr. 18',           '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00010','HOME',        'Str. Florilor nr. 9',            '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00011','HOME',        'Str. Păcii nr. 32, ap. 8',       '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00014','HOME',        'Str. Independenței nr. 25',      '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00019','HOME',        'Str. Câmpului nr. 2',            '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00021','HOME',        'Str. Principală nr. 3',          '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00022','HOME',        'Str. Florilor nr. 17',           '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00023','HOME',        'Str. Topo nr. 1',                '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00025','HOME',        'Str. Constructorilor nr. 8',     '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00027','HOME',        'Str. Principală nr. 1',          '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00029','HOME',        'Str. Nouă nr. 5',                '077015','Bragadiru',           'Ilfov',    'România'),
  ('PPERS00030','HOME',        'Str. Câmpului nr. 20',           '077015','Bragadiru',           'Ilfov',    'România'),
-- Judicial persons — HEADQUARTERS addresses
  ('JPERS00001','HEADQUARTERS','Str. Agricolă nr. 10',           '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00002','HEADQUARTERS','Str. Constructorilor nr. 22',    '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00003','HEADQUARTERS','Bd. Unirii nr. 100, et. 4',      '030833','București',           'Sector 3', 'România'),
  ('JPERS00004','HEADQUARTERS','Str. Notarilor nr. 2',           '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00005','HEADQUARTERS','Str. Verde nr. 14',              '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00006','HEADQUARTERS','Str. Topo nr. 3',                '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00007','HEADQUARTERS','Str. Drumari nr. 5',             '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00008','HEADQUARTERS','Str. Primăriei nr. 1',           '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00009','HEADQUARTERS','Str. Topo nr. 7',                '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00010','HEADQUARTERS','Bd. Eroilor nr. 45',             '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00011','HEADQUARTERS','Șos. Bragadiru-Cornetu nr. 1',   '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00013','HEADQUARTERS','Str. OCPI nr. 1',                '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00016','HEADQUARTERS','Str. Geodeziei nr. 3',           '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00020','HEADQUARTERS','Str. Agricolă nr. 50',           '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00026','HEADQUARTERS','Str. Topo nr. 9',                '077015','Bragadiru',           'Ilfov',    'România'),
  ('JPERS00029','HEADQUARTERS','Str. Rezidențial nr. 1',         '077015','Bragadiru',           'Ilfov',    'România')
) AS v(code, kind, street, postal, locality, county, country)
JOIN person p ON p.code = v.code;

-- =============================================================================
-- 6. PROPERTY rows (40)
-- PROP00001-PROP00012: Teren Arabil — mostly from text-file import, with corners
-- PROP00013-PROP00020: Teren Construit / Casă — with addresses
-- PROP00021-PROP00025: Apartament — address only
-- PROP00026-PROP00030: Casă + teren — with corners and addresses
-- PROP00031-PROP00040: Mixed (Pășune, Livadă, Teren Arabil) — some with corners
-- =============================================================================

INSERT INTO property (
  id, principal_object_id, code,
  property_type_id, use_category_id,
  nickname, tarla_sola, parcela, cadastral_number, carte_funciara,
  surface_area_mp, notes,
  created_at, updated_at
)
SELECT gen_random_uuid(), po.id, v.code,
  (SELECT id FROM lookup_property_type WHERE name = v.ptype LIMIT 1),
  (SELECT id FROM lookup_use_category  WHERE name = v.usecat LIMIT 1),
  v.nickname, v.tarla, v.parcela, v.cad_nr, v.cf_nr,
  v.surface_mp::numeric, v.notes,
  v.cat::timestamptz, v.cat::timestamptz
FROM (VALUES
-- Tarla 3 cluster — from text-file import
  ('PROP00001','Teren Arabil','Arabil','Parcela Ion Popescu T3-1',    'T3','1',  '12001','CF-101',5200.00,'Parcelă arabilă importată din fișier text. Tarla 3, zona nord.','2022-05-02 10:00:00+02'),
  ('PROP00002','Teren Arabil','Arabil','Parcela Popescu T3-2',         'T3','2',  '12002','CF-102',4800.00,'Adjacent cu parcela 1. Import text-file batch 1.','2022-05-02 10:10:00+02'),
  ('PROP00003','Teren Arabil','Arabil','Teren arabil T3-3',            'T3','3',  '12003','CF-103',5100.00,'Import text-file batch 1. Coordonate Stereo70 verificate.','2022-05-02 10:20:00+02'),
  ('PROP00004','Teren Arabil','Arabil','Teren arabil T3-4 (neregulat)','T3','4',  '12004','CF-104',3900.00,'Formă neregulată — 5 colțuri. Import text-file batch 1.','2022-05-02 10:30:00+02'),
  ('PROP00005','Teren Arabil','Arabil','Parcela Marin T3-5',           'T3','5',  '12005','CF-105',6200.00,'Parcelă arabilă. Proprietar Elena Marin.','2022-05-02 10:40:00+02'),
  ('PROP00006','Teren Arabil','Arabil','Parcela T3-6 Stoica',          'T3','6',  '12006','CF-106',5800.00,'Coproprietat Stoica-Vlad. Import text-file.','2022-05-02 10:50:00+02'),
  ('PROP00007','Teren Arabil','Arabil','Teren arabil T3-7',            'T3','7',  '12007','CF-107',4100.00,'Parte din succesiunea Ardelean.','2022-05-02 11:00:00+02'),
-- Tarla 5 cluster
  ('PROP00008','Teren Arabil','Arabil','Parcela Ene T5-1',             'T5','1',  '15001','CF-201',7800.00,'Tarla 5. Import text-file batch 2. Proprietar Marian Ene.','2022-05-02 11:10:00+02'),
  ('PROP00009','Teren Arabil','Arabil','Parcela Dinu T5-2',            'T5','2',  '15002','CF-202',6500.00,'Tarla 5. Folosință curentă pășune, categoria arabil.','2022-05-02 11:20:00+02'),
  ('PROP00010','Teren Arabil','Arabil','Parcela Badea T5-3',           'T5','3',  '15003','CF-203',7200.00,'Tarla 5. Proprietar Luminița Badea.','2022-05-02 11:30:00+02'),
  ('PROP00011','Pășune',      'Pășune','Pășune Coman T5-P1',           'T5','P1', '15010','CF-204',9400.00,'Pășune. Cel mai în vârstă proprietar Augustin Coman.','2022-05-02 11:40:00+02'),
  ('PROP00012','Teren Arabil','Arabil','Teren arabil T5-4',            'T5','4',  '15004','CF-205',5600.00,'Parcelă arabilă. Import text-file batch 2.','2022-05-02 11:50:00+02'),
-- Terenuri construite / case cu adresă
  ('PROP00013','Teren Construit','Arabil','Casa Popescu — str. Independenței',NULL,NULL,'13001','CF-301',720.00, 'Teren intravilan cu casă. Adresă: Str. Independenței nr. 12.','2022-05-03 09:00:00+02'),
  ('PROP00014','Teren Construit','Arabil','Casă Dinu — str. Florilor',         NULL,NULL,'13002','CF-302',650.00, 'Teren intravilan cu casă veche. Necesită lucrări.','2022-05-03 09:15:00+02'),
  ('PROP00015','Teren Construit','Arabil','Casă Oprea — str. Independenței',   NULL,NULL,'13003','CF-303',810.00, 'Teren construit. Autorizație construire emisă 2019.','2022-05-03 09:30:00+02'),
  ('PROP00016','Teren Construit','Arabil','Casă Tudor — str. Florilor',        NULL,NULL,'13004','CF-304',590.00, 'Casă cu etaj. Teren intravilan.','2022-05-03 09:45:00+02'),
  ('PROP00017','Casă',         'Arabil','Vilă Moldovan — str. Câmpului',       NULL,NULL,'13005','CF-305',1200.00,'Vilă cu piscină și garaj. Achiziție recentă.','2022-05-03 10:00:00+02'),
  ('PROP00018','Casă',         'Arabil','Casă Marin — str. Independenței',     NULL,NULL,'13006','CF-306',840.00, 'Casă familială. Teren 840 mp.','2022-05-03 10:15:00+02'),
  ('PROP00019','Teren Construit','Arabil','Casă Badea — teren intravilan',      NULL,NULL,'13007','CF-307',680.00, 'Teren intravilan. Casă în stare bună.','2022-05-03 10:30:00+02'),
  ('PROP00020','Casă',         'Arabil','Casă Ene — str. Principală',          NULL,NULL,'13008','CF-308',920.00, 'Casă veche. Proprietar Marian Ene.','2022-05-03 10:45:00+02'),
-- Apartamente
  ('PROP00021','Apartament',   NULL,   'Apartament Luca — bloc 3, ap. 8',      NULL,NULL,'21001','CF-401',67.00,  'Apartament 3 camere. Etaj 2. Bloc 3.','2022-06-01 09:00:00+02'),
  ('PROP00022','Apartament',   NULL,   'Apartament Radu — bloc 7, ap. 15',     NULL,NULL,'21002','CF-402',54.00,  'Apartament 2 camere. Etaj 4. Bloc 7.','2022-06-01 09:20:00+02'),
  ('PROP00023','Apartament',   NULL,   'Apartament Matei — bloc 3, ap. 12',    NULL,NULL,'21003','CF-403',72.00,  'Apartament 3 camere. Etaj 3. Bloc 3.','2022-06-01 09:40:00+02'),
  ('PROP00024','Apartament',   NULL,   'Apartament Nistor — bloc 2, ap. 4',    NULL,NULL,'21004','CF-404',48.00,  'Apartament 2 camere. Parter.','2022-06-01 10:00:00+02'),
  ('PROP00025','Apartament',   NULL,   'Apartament Petrescu — bloc 7, ap. 22', NULL,NULL,'21005','CF-405',58.00,  'Apartament 2 camere. Etaj 5. Vedere stradală.','2022-06-01 10:20:00+02'),
-- Case cu teren si colțuri
  ('PROP00026','Casă',         'Arabil','Casă Stoica — str. Păcii',            NULL,NULL,'26001','CF-501',750.00, 'Casă cu teren. Colțuri din plan cadastral.','2022-06-01 10:40:00+02'),
  ('PROP00027','Casă',         'Arabil','Casă Chirilă — lot nou',              NULL,NULL,'26002','CF-502',820.00, 'Lot rezultat din dezmembrare 2022. Casă nouă.','2022-06-01 11:00:00+02'),
  ('PROP00028','Casă',         'Arabil','Casă Barbu — str. Nouă',              NULL,NULL,'26003','CF-503',680.00, 'Achiziție 2022. Contract vânzare autentificat.','2022-06-01 11:20:00+02'),
  ('PROP00029','Casă',         'Arabil','Casă Ciobanu — coproprietate',        NULL,NULL,'26004','CF-504',900.00, 'Coproprietate familie Ciobanu.','2022-06-01 11:40:00+02'),
  ('PROP00030','Casă',         'Arabil','Casă Niculescu — proprietate nouă',   NULL,NULL,'26005','CF-505',610.00, 'Beneficiar tânăr. Construcție 2021.','2022-06-01 12:00:00+02'),
-- Parcele diverse cu colțuri (batches suplimentare)
  ('PROP00031','Teren Arabil','Fânețe','Fânețe Ardelean T2-1',                 'T2','1',  '12101','CF-601',8200.00,'Fânețe moștenire. Dosar succesoral finalizat.','2022-07-04 09:00:00+02'),
  ('PROP00032','Teren Arabil','Arabil','Parcelă Manolescu T2-2',               'T2','2',  '12102','CF-602',4400.00,'Parcelă vândută lui Cristian Moldovan în 2022.','2022-07-04 09:20:00+02'),
  ('PROP00033','Teren Arabil','Arabil','Parcelă Popa T3-8',                    'T3','8',  '12008','CF-107',6100.00,'Proprietar Nicolae Popa. Parte din grup T3.','2022-07-04 09:40:00+02'),
  ('PROP00034','Teren Arabil','Vie',   'Vie Ardelean — tarla 4',               'T4','1',  '14001','CF-701',3200.00,'Vie plantată 1998. Dosar succesoral.','2022-07-04 10:00:00+02'),
  ('PROP00035','Teren Arabil','Livadă','Livadă Constantin T4-2',               'T4','2',  '14002','CF-702',2800.00,'Livadă de meri și pruni. Proprietar Ana Constantin.','2022-07-04 10:20:00+02'),
  ('PROP00036','Pășune',      'Pășune','Pășune Dinu T6-1',                     'T6','1',  '16001','CF-801',11000.00,'Pășune extinsă. Arendată SC Nord Agro SRL.','2022-07-04 10:40:00+02'),
  ('PROP00037','Teren Arabil','Arabil','Teren Vlad-Stoica T3-9',               'T3','9',  '12009','CF-108',4700.00,'Coproprietate Stoica-Vlad. Import text-file.','2022-07-04 11:00:00+02'),
  ('PROP00038','Teren Arabil','Arabil','Parcelă Manolescu T1-1',               'T1','1',  '11001','CF-901',5300.00,'Ultimă parcelă vândută de Stela Manolescu.','2022-07-04 11:20:00+02'),
  ('PROP00039','Teren Arabil','Arabil','Parcelă comună T3-10',                 'T3','10', '12010','CF-109',3800.00,'Litigiu proprietate cu vecin. Dosar instanță.','2022-07-04 11:40:00+02'),
  ('PROP00040','Teren Construit','Arabil','Teren industrial Cornetu',          NULL,NULL,'40001','CF-001',15000.00,'Teren intravilan industrial. Zonă Cornetu.','2022-07-04 12:00:00+02')
) AS v(code, ptype, usecat, nickname, tarla, parcela, cad_nr, cf_nr, surface_mp, notes, cat)
JOIN principal_object po ON po.code = v.code;

-- =============================================================================
-- 7. PROPERTY_ADDRESS rows (for terenuri construite + case + apartamente)
-- =============================================================================

INSERT INTO property_address (id, property_id, street_line, postal_code, locality, county, country, street_view_street_line, created_at, updated_at)
SELECT gen_random_uuid(), pr.id, v.street, v.postal, v.locality, v.county, 'România', v.sv_street, now(), now()
FROM (VALUES
  ('PROP00013','Str. Independenței nr. 12','077015','Bragadiru','Ilfov','Str. Independenței 12'),
  ('PROP00014','Str. Florilor nr. 9',       '077015','Bragadiru','Ilfov', NULL),
  ('PROP00015','Str. Independenței nr. 25', '077015','Bragadiru','Ilfov','Str. Independenței 25'),
  ('PROP00016','Str. Florilor nr. 17',      '077015','Bragadiru','Ilfov', NULL),
  ('PROP00017','Str. Câmpului nr. 2',       '077015','Bragadiru','Ilfov','Str. Câmpului 2'),
  ('PROP00018','Str. Independenței nr. 7',  '077015','Bragadiru','Ilfov', NULL),
  ('PROP00019','Str. Câmpului nr. 18',      '077015','Bragadiru','Ilfov', NULL),
  ('PROP00020','Str. Principală nr. 3',     '077015','Bragadiru','Ilfov', NULL),
  ('PROP00021','Str. Noilor nr. 4, bl. 3, sc. A, ap. 8','077015','Bragadiru','Ilfov', NULL),
  ('PROP00022','Str. Noilor nr. 4, bl. 7, sc. B, ap. 15','077015','Bragadiru','Ilfov',NULL),
  ('PROP00023','Str. Noilor nr. 4, bl. 3, sc. A, ap. 12','077015','Bragadiru','Ilfov',NULL),
  ('PROP00024','Str. Noilor nr. 6, bl. 2, sc. A, ap. 4','077015','Bragadiru','Ilfov', NULL),
  ('PROP00025','Str. Noilor nr. 4, bl. 7, sc. B, ap. 22','077015','Bragadiru','Ilfov',NULL),
  ('PROP00026','Str. Păcii nr. 32',         '077015','Bragadiru','Ilfov','Str. Păcii 32'),
  ('PROP00027','Str. Nouă nr. 3',           '077015','Bragadiru','Ilfov', NULL),
  ('PROP00028','Str. Nouă nr. 5',           '077015','Bragadiru','Ilfov','Str. Nouă 5'),
  ('PROP00029','Str. Câmpului nr. 10',      '077015','Bragadiru','Ilfov', NULL),
  ('PROP00030','Str. Rezidențial nr. 2',    '077015','Bragadiru','Ilfov', NULL),
  ('PROP00040','Șos. Cornetu nr. 100',      '077040','Cornetu',  'Ilfov', NULL)
) AS v(code, street, postal, locality, county, sv_street)
JOIN property pr ON pr.code = v.code;

-- =============================================================================
-- 8. PROPERTY_CORNER rows (WGS84 — Bragadiru area, lat~44.355-44.375, lon~25.970-25.992)
-- Properties with text-file import have original_index set.
-- =============================================================================

INSERT INTO property_corner (id, property_id, sequence_no, lat, lon, original_index, created_at, updated_at)
SELECT gen_random_uuid(), pr.id, v.seq, v.lat, v.lon, v.orig_idx, now(), now()
FROM (VALUES
-- PROP00001 — Parcela T3-1 (4 colțuri, text-file, original_index set)
  ('PROP00001',1, 44.36000, 25.97500, 1),
  ('PROP00001',2, 44.36000, 25.97620, 2),
  ('PROP00001',3, 44.36080, 25.97620, 3),
  ('PROP00001',4, 44.36080, 25.97500, 4),
-- PROP00002 — Parcela T3-2 (4 colțuri, text-file)
  ('PROP00002',1, 44.36000, 25.97620, 1),
  ('PROP00002',2, 44.36000, 25.97740, 2),
  ('PROP00002',3, 44.36080, 25.97740, 3),
  ('PROP00002',4, 44.36080, 25.97620, 4),
-- PROP00003 — Parcela T3-3 (4 colțuri, text-file)
  ('PROP00003',1, 44.36000, 25.97740, 1),
  ('PROP00003',2, 44.36000, 25.97860, 2),
  ('PROP00003',3, 44.36080, 25.97860, 3),
  ('PROP00003',4, 44.36080, 25.97740, 4),
-- PROP00004 — Parcela T3-4 neregulată (5 colțuri, text-file)
  ('PROP00004',1, 44.36000, 25.97860, 1),
  ('PROP00004',2, 44.36000, 25.97980, 2),
  ('PROP00004',3, 44.36050, 25.98020, 3),
  ('PROP00004',4, 44.36080, 25.97980, 4),
  ('PROP00004',5, 44.36080, 25.97860, 5),
-- PROP00005 — Parcela T3-5 (4 colțuri, text-file)
  ('PROP00005',1, 44.36100, 25.97500, 1),
  ('PROP00005',2, 44.36100, 25.97620, 2),
  ('PROP00005',3, 44.36200, 25.97620, 3),
  ('PROP00005',4, 44.36200, 25.97500, 4),
-- PROP00006 — Parcela T3-6 (4 colțuri, text-file)
  ('PROP00006',1, 44.36100, 25.97620, 1),
  ('PROP00006',2, 44.36100, 25.97740, 2),
  ('PROP00006',3, 44.36200, 25.97740, 3),
  ('PROP00006',4, 44.36200, 25.97620, 4),
-- PROP00007 — Parcela T3-7 (4 colțuri, text-file)
  ('PROP00007',1, 44.36100, 25.97740, 1),
  ('PROP00007',2, 44.36100, 25.97860, 2),
  ('PROP00007',3, 44.36200, 25.97860, 3),
  ('PROP00007',4, 44.36200, 25.97740, 4),
-- PROP00008 — Parcela T5-1 (4 colțuri, text-file)
  ('PROP00008',1, 44.37000, 25.97900, 1),
  ('PROP00008',2, 44.37000, 25.98050, 2),
  ('PROP00008',3, 44.37100, 25.98050, 3),
  ('PROP00008',4, 44.37100, 25.97900, 4),
-- PROP00009 — Parcela T5-2 (4 colțuri, text-file)
  ('PROP00009',1, 44.37000, 25.98050, 1),
  ('PROP00009',2, 44.37000, 25.98200, 2),
  ('PROP00009',3, 44.37100, 25.98200, 3),
  ('PROP00009',4, 44.37100, 25.98050, 4),
-- PROP00010 — Parcela T5-3 (4 colțuri, text-file)
  ('PROP00010',1, 44.37100, 25.97900, 1),
  ('PROP00010',2, 44.37100, 25.98050, 2),
  ('PROP00010',3, 44.37200, 25.98050, 3),
  ('PROP00010',4, 44.37200, 25.97900, 4),
-- PROP00011 — Pășune Coman (4 colțuri, text-file)
  ('PROP00011',1, 44.37200, 25.97900, 1),
  ('PROP00011',2, 44.37200, 25.98200, 2),
  ('PROP00011',3, 44.37350, 25.98200, 3),
  ('PROP00011',4, 44.37350, 25.97900, 4),
-- PROP00012 — Parcela T5-4 (4 colțuri, text-file)
  ('PROP00012',1, 44.37100, 25.98200, 1),
  ('PROP00012',2, 44.37100, 25.98350, 2),
  ('PROP00012',3, 44.37200, 25.98350, 3),
  ('PROP00012',4, 44.37200, 25.98200, 4),
-- PROP00026 — Casă Stoica (4 colțuri, plan cadastral, no original_index)
  ('PROP00026',1, 44.35500, 25.97740, NULL),
  ('PROP00026',2, 44.35500, 25.97830, NULL),
  ('PROP00026',3, 44.35570, 25.97830, NULL),
  ('PROP00026',4, 44.35570, 25.97740, NULL),
-- PROP00027 — Casă Chirilă (4 colțuri, plan cadastral)
  ('PROP00027',1, 44.35440, 25.97740, NULL),
  ('PROP00027',2, 44.35440, 25.97830, NULL),
  ('PROP00027',3, 44.35500, 25.97830, NULL),
  ('PROP00027',4, 44.35500, 25.97740, NULL),
-- PROP00028 — Casă Barbu (4 colțuri, plan cadastral)
  ('PROP00028',1, 44.35500, 25.97650, NULL),
  ('PROP00028',2, 44.35500, 25.97740, NULL),
  ('PROP00028',3, 44.35570, 25.97740, NULL),
  ('PROP00028',4, 44.35570, 25.97650, NULL),
-- PROP00029 — Casă Ciobanu (4 colțuri, plan cadastral)
  ('PROP00029',1, 44.35440, 25.97560, NULL),
  ('PROP00029',2, 44.35440, 25.97650, NULL),
  ('PROP00029',3, 44.35540, 25.97650, NULL),
  ('PROP00029',4, 44.35540, 25.97560, NULL),
-- PROP00030 — Casă Niculescu (4 colțuri, plan cadastral)
  ('PROP00030',1, 44.35380, 25.97560, NULL),
  ('PROP00030',2, 44.35380, 25.97640, NULL),
  ('PROP00030',3, 44.35440, 25.97640, NULL),
  ('PROP00030',4, 44.35440, 25.97560, NULL),
-- PROP00031 — Fânețe Ardelean T2-1 (4 colțuri, text-file)
  ('PROP00031',1, 44.36300, 25.97300, 1),
  ('PROP00031',2, 44.36300, 25.97450, 2),
  ('PROP00031',3, 44.36420, 25.97450, 3),
  ('PROP00031',4, 44.36420, 25.97300, 4),
-- PROP00032 — Parcelă Manolescu T2-2 (4 colțuri, text-file)
  ('PROP00032',1, 44.36200, 25.97300, 1),
  ('PROP00032',2, 44.36200, 25.97450, 2),
  ('PROP00032',3, 44.36300, 25.97450, 3),
  ('PROP00032',4, 44.36300, 25.97300, 4),
-- PROP00033 — Parcelă Popa T3-8 (4 colțuri, text-file)
  ('PROP00033',1, 44.36100, 25.97860, 1),
  ('PROP00033',2, 44.36100, 25.97980, 2),
  ('PROP00033',3, 44.36200, 25.97980, 3),
  ('PROP00033',4, 44.36200, 25.97860, 4),
-- PROP00034 — Vie Ardelean T4-1 (4 colțuri, text-file)
  ('PROP00034',1, 44.36500, 25.97500, 1),
  ('PROP00034',2, 44.36500, 25.97620, 2),
  ('PROP00034',3, 44.36580, 25.97620, 3),
  ('PROP00034',4, 44.36580, 25.97500, 4),
-- PROP00035 — Livadă Constantin T4-2 (4 colțuri, text-file)
  ('PROP00035',1, 44.36500, 25.97620, 1),
  ('PROP00035',2, 44.36500, 25.97740, 2),
  ('PROP00035',3, 44.36580, 25.97740, 3),
  ('PROP00035',4, 44.36580, 25.97620, 4),
-- PROP00036 — Pășune Dinu T6-1 (4 colțuri, text-file — mare)
  ('PROP00036',1, 44.37400, 25.97900, 1),
  ('PROP00036',2, 44.37400, 25.98300, 2),
  ('PROP00036',3, 44.37600, 25.98300, 3),
  ('PROP00036',4, 44.37600, 25.97900, 4),
-- PROP00037 — Vlad-Stoica T3-9 (4 colțuri, text-file)
  ('PROP00037',1, 44.36200, 25.97860, 1),
  ('PROP00037',2, 44.36200, 25.97980, 2),
  ('PROP00037',3, 44.36300, 25.97980, 3),
  ('PROP00037',4, 44.36300, 25.97860, 4),
-- PROP00038 — Manolescu T1-1 (4 colțuri, text-file)
  ('PROP00038',1, 44.35800, 25.97300, 1),
  ('PROP00038',2, 44.35800, 25.97450, 2),
  ('PROP00038',3, 44.35900, 25.97450, 3),
  ('PROP00038',4, 44.35900, 25.97300, 4),
-- PROP00039 — Litigiu T3-10 (4 colțuri, text-file)
  ('PROP00039',1, 44.36300, 25.97860, 1),
  ('PROP00039',2, 44.36300, 25.97980, 2),
  ('PROP00039',3, 44.36400, 25.97980, 3),
  ('PROP00039',4, 44.36400, 25.97860, 4)
) AS v(code, seq, lat, lon, orig_idx)
JOIN property pr ON pr.code = v.code;

-- =============================================================================
-- 9. DOCUMENT rows (70)
-- Covers all major document types, various institutions, surveyors, etc.
-- =============================================================================

INSERT INTO document (
  id, principal_object_id, code,
  document_type_id, title, nr_document, date_document,
  institution_id, emitent, baza_legala,
  uat_proprietate, uat_proprietar,
  suprafata, nr_dosar_succesoral, data_decesului, ultimul_domiciliu, nr_certificat_deces,
  date_start, date_end,
  subject, surveyor_id, notes,
  created_at, updated_at
)
SELECT gen_random_uuid(), po.id, v.code,
  (SELECT id FROM lookup_document_type  WHERE key  = v.dtype_key LIMIT 1),
  v.title, v.nr_doc, v.date_doc::date,
  (SELECT id FROM lookup_institution WHERE name = v.inst LIMIT 1),
  v.emitent, v.baza_legala,
  v.uat_prop, v.uat_propr,
  v.suprafata::numeric,
  v.nr_dosar, v.data_dec::date, v.ultim_dom, v.nr_cert_dec,
  v.date_start::date, v.date_end::date,
  v.subject,
  (SELECT p.id FROM person p WHERE p.code = v.surveyor_code LIMIT 1),
  v.notes,
  v.cat::timestamptz, v.cat::timestamptz
FROM (VALUES
-- FORMAT: code,dtype_key,title,nr_doc,date_doc,inst,emitent,baza_legala,uat_prop,uat_propr,suprafata,nr_dosar,data_dec,ultim_dom,nr_cert_dec,date_start,date_end,subject,surveyor_code,notes,cat
-- TITLURI DE PROPRIETATE (8)
  ('DOC00001','TITLU_PROPRIETATE','Titlu Ion Popescu — Parcela T3-1','12345/P/2005','2005-07-15','Primăria Comunei Bragadiru','Agenția Domeniilor Statului','Legea 18/1991',   'Bragadiru','Bragadiru',5200.00,NULL,NULL,NULL,NULL,NULL,NULL,'Titlu de proprietate teren arabil parcela T3-1',NULL,'Titlu original. Prima intrare în evidențele CF.','2022-08-01 09:00:00+02'),
  ('DOC00002','TITLU_PROPRIETATE','Titlu Maria Ionescu — T3-2',     '12346/P/2005','2005-07-15','Primăria Comunei Bragadiru','Agenția Domeniilor Statului','Legea 18/1991',   'Bragadiru','Bragadiru',4800.00,NULL,NULL,NULL,NULL,NULL,NULL,'Titlu de proprietate teren arabil parcela T3-2',NULL,'Titlu original împreună cu T3-1.','2022-08-01 09:10:00+02'),
  ('DOC00003','TITLU_PROPRIETATE','Titlu Nicolae Popa — T3-8',      '12347/P/2005','2005-07-20','Primăria Comunei Bragadiru','Agenția Domeniilor Statului','Legea 18/1991',   'Bragadiru','Bragadiru',6100.00,NULL,NULL,NULL,NULL,NULL,NULL,'Titlu de proprietate parcela T3-8',NULL,NULL,'2022-08-01 09:20:00+02'),
  ('DOC00004','TITLU_PROPRIETATE','Titlu Marian Ene — T5-1,2,3',   '15001/P/2006','2006-03-10','Primăria Comunei Bragadiru','Agenția Domeniilor Statului','Legea 18/1991',   'Bragadiru','Bragadiru',21500.00,NULL,NULL,NULL,NULL,NULL,NULL,'Titlu cumulat parcele T5-1, T5-2, T5-3',NULL,'Marian Ene — titlu pe trei parcele.','2022-08-01 09:30:00+02'),
  ('DOC00005','TITLU_PROPRIETATE','Titlu Augustin Coman — Pășune', '15010/P/2006','2006-03-15','Primăria Comunei Bragadiru','Agenția Domeniilor Statului','Legea 18/1991',   'Bragadiru','Bragadiru',9400.00,NULL,NULL,NULL,NULL,NULL,NULL,'Titlu de proprietate pășune T5-P1',NULL,'Cel mai vechi proprietar.','2022-08-01 09:40:00+02'),
  ('DOC00006','TITLU_PROPRIETATE','Titlu Ardelean — Fânețe T2-1', '12101/P/2004','2004-11-05','Primăria Comunei Bragadiru','Agenția Domeniilor Statului','Legea 18/1991',   'Bragadiru','Bragadiru',8200.00,NULL,NULL,NULL,NULL,NULL,NULL,'Titlu fânețe moștenite',NULL,'Dosar succesoral finalizat ulterior.','2022-08-01 09:50:00+02'),
  ('DOC00007','TITLU_PROPRIETATE','Titlu Dinu — Pășune T6-1',     '16001/P/2007','2007-02-20','Primăria Comunei Bragadiru','Agenția Domeniilor Statului','Legea 18/1991',   'Bragadiru','Bragadiru',11000.00,NULL,NULL,NULL,NULL,NULL,NULL,'Titlu pășune extinsă T6',NULL,'Pășune arendată ulterior.','2022-08-01 10:00:00+02'),
  ('DOC00008','TITLU_PROPRIETATE','Titlu Manolescu — T1-1, T2-2', '11001/P/2003','2003-05-18','Primăria Comunei Bragadiru','Agenția Domeniilor Statului','Legea 18/1991',   'Bragadiru','Bragadiru',9700.00,NULL,NULL,NULL,NULL,NULL,NULL,'Titlu cumulat parcele T1-1 și T2-2',NULL,'Stela Manolescu, vândut ulterior.','2022-08-01 10:10:00+02'),
-- CONTRACTE DE VÂNZARE
  ('DOC00009','CONTRACT_VANZARE','Vânzare Manolescu→Moldovan T2-2','1201/AUTH/2022','2022-04-15','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,4400.00,NULL,NULL,NULL,NULL,NULL,NULL,'Vânzare parcelă T2-2 de la Stela Manolescu la Cristian Moldovan',NULL,'Contract autentificat. Preț 18.000 EUR.','2022-08-01 10:20:00+02'),
  ('DOC00010','CONTRACT_VANZARE','Vânzare Manolescu→Barbu T1-1',  '1205/AUTH/2022','2022-06-01','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,5300.00,NULL,NULL,NULL,NULL,NULL,NULL,'Vânzare ultimei parcele de la Stela Manolescu',NULL,'Preț 22.000 EUR. Notar: Birou Popescu.','2022-08-01 10:30:00+02'),
  ('DOC00011','CONTRACT_VANZARE','Vânzare casă Oprea→Niculescu',  '989/AUTH/2021','2021-09-20','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,810.00,NULL,NULL,NULL,NULL,NULL,NULL,'Vânzare casă str. Independenței 25',NULL,'Proprietate trecută pe Sorin Niculescu.','2022-08-02 09:00:00+02'),
  ('DOC00012','CONTRACT_VANZARE','Vânzare teren Popa→Verde Land', '567/AUTH/2020','2020-11-10','Notariat',NULL,NULL,NULL,NULL,6100.00,NULL,NULL,NULL,NULL,NULL,NULL,'Vânzare parcelă T3-8 — SC Verde Land SRL',NULL,'Tranzacție cu persoană juridică.','2022-08-02 09:10:00+02'),
-- CERTIFICATE DE MOȘTENITOR
  ('DOC00013','CERTIFICAT_MOSTENITOR','Cert. moștenitor Ionescu 2019','CM-1234/2019','2019-10-15','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,9600.00,'DS-5678/2019','2019-03-20','Str. Florilor nr. 3, Bragadiru','CERT-DC-901/2019',NULL,NULL,'Succesiune după tatăl Ion Ionescu decedat 2019',NULL,'Moștenitoare Maria Ionescu și Roxana Petrescu.','2022-08-02 09:20:00+02'),
  ('DOC00014','CERTIFICAT_MOSTENITOR','Cert. moștenitor Ardelean 2021','CM-2345/2021','2021-05-08','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,11400.00,'DS-6789/2021','2020-12-01','Str. Principală nr. 5, Turda','CERT-DC-112/2020',NULL,NULL,'Succesiune Traian Ardelean după mama sa',NULL,'Moștenitori: Ana Constantin, Nicolae Popa.','2022-08-02 09:30:00+02'),
  ('DOC00015','CERTIFICAT_MOSTENITOR','Cert. moștenitor Coman 2022',  'CM-3456/2022','2022-01-20','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,9400.00,'DS-7890/2021','2021-08-15','Str. Principală nr. 1, Bragadiru','CERT-DC-234/2021',NULL,NULL,'Succesiune pășune Augustin Coman',NULL,'Moștenitor unic Bogdan Ciobanu.','2022-08-02 09:40:00+02'),
-- EXTRASE CARTE FUNCIARĂ
  ('DOC00016','EXTRAS_CARTE_FUNCIARA','Extras CF-101 PROP00001',     'ECF-101/2022','2022-02-01','OCPI',NULL,NULL,NULL,NULL,5200.00,NULL,NULL,NULL,NULL,NULL,NULL,'Extras CF parcela T3-1 pentru dosar cadastral','PPERS00023','Solicitat de Petre Lazăr pentru documentație.','2022-08-02 09:50:00+02'),
  ('DOC00017','EXTRAS_CARTE_FUNCIARA','Extras CF-201 PROP00008',     'ECF-201/2022','2022-02-10','OCPI',NULL,NULL,NULL,NULL,7800.00,NULL,NULL,NULL,NULL,NULL,NULL,'Extras CF parcelă T5-1','PPERS00023','Solicitat pentru contract arendă.','2022-08-02 10:00:00+02'),
  ('DOC00018','EXTRAS_CARTE_FUNCIARA_ALT','Extras de CF-304 PROP00016','ECF-304/2022','2022-03-05','OCPI',NULL,NULL,NULL,NULL,590.00,NULL,NULL,NULL,NULL,NULL,NULL,'Extras carte funciară casă Tudor',NULL,'Solicitat de cumpărător pentru verificare sarcini.','2022-08-02 10:10:00+02'),
-- ACTE CADASTRU
  ('DOC00019','ACT_CADASTRU','Documentație cadastrală T3-1,2,3',   'DC-789/2022','2022-03-15','OCPI','SC Topogeo Expert SRL',NULL,NULL,NULL,15100.00,NULL,NULL,NULL,NULL,NULL,NULL,'Documentație cadastrală pentru 3 parcele T3','PPERS00023','Întocmit de Petre Lazăr.','2022-08-02 10:20:00+02'),
  ('DOC00020','ACT_CADASTRU','Documentație cadastrală T5-1,2,3',   'DC-790/2022','2022-04-01','OCPI','SC Topogeo Expert SRL',NULL,NULL,NULL,21500.00,NULL,NULL,NULL,NULL,NULL,NULL,'Documentație cadastrală parcele T5','JPERS00006',NULL,'2022-08-02 10:30:00+02'),
-- CERTIFICATE DE URBANISM
  ('DOC00021','CERTIFICAT_URBANISM','CU extindere casă Nistor',   'CU-456/2022','2022-05-10','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Certificat urbanism pentru extindere locuință',NULL,'Valabil 2 ani. Condiții PUG respectate.','2022-09-05 09:00:00+02'),
  ('DOC00022','CERTIFICAT_URBANISM','CU construcție bloc B2',     'CU-789/2021','2021-08-20','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Certificat urbanism bloc B2 Bragadiru',NULL,'Extins ulterior cu un an.','2022-09-05 09:15:00+02'),
-- AUTORIZAȚII
  ('DOC00023','AUTORIZATIE_ALT','Autorizație construire bloc B2',     'AC-123/2021','2021-10-15','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Autorizație construire imobil colectiv B2','JPERS00006','Constructor SC Construct Plus SRL.','2022-09-05 09:30:00+02'),
  ('DOC00024','AUTORIZATIE_ALT','Autorizație demolare gard',      'AD-45/2022','2022-06-01','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Autorizație demolare gard și garaj vechi',NULL,NULL,'2022-09-05 09:45:00+02'),
-- AVIZE INSTITUȚII
  ('DOC00025','AVIZ_INSTITUTIE','Aviz CJ Ilfov — PUG Bragadiru', 'AVIZ-001/2021','2021-04-12','Consiliu Județean',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Aviz favorabil pentru actualizare PUG Bragadiru',NULL,'Condiții respectate conform studiu PUG.','2022-09-05 10:00:00+02'),
  ('DOC00026','AVIZ_INSTITUTIE','Aviz APM — construcție B2',     'AVIZ-APM-55/2021','2021-09-01','Consiliu Județean',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Aviz mediu pentru construcție bloc B2',NULL,NULL,'2022-09-05 10:15:00+02'),
-- CONTRACTE DE ARENDĂ
  ('DOC00027','CONTRACT_ARENDA','Arendă Ene→Verde Land T5-1,2,3','CA-234/2022','2022-03-01',NULL,NULL,NULL,NULL,NULL,21500.00,NULL,NULL,NULL,NULL,'2022-03-01','2027-03-01','Contract arendă 5 ani — parcele T5 Marian Ene',NULL,'Chirie 300 EUR/ha/an.','2022-09-05 10:30:00+02'),
  ('DOC00028','CONTRACT_ARENDA','Arendă Dinu→Nord Agro pășune',  'CA-235/2022','2022-04-01',NULL,NULL,NULL,NULL,NULL,11000.00,NULL,NULL,NULL,NULL,'2022-04-01','2027-04-01','Contract arendă pășune T6-1 — SC Nord Agro SRL',NULL,'Arendă pe 5 ani.','2022-09-05 10:45:00+02'),
-- CONTRACTE DE ÎNCHIRIERE
  ('DOC00029','CONTRACT_INCHIRIERE','Închiriere ap. Luca — bloc 3','CI-88/2022','2022-07-01',NULL,NULL,NULL,NULL,NULL,67.00,NULL,NULL,NULL,NULL,'2022-07-01','2023-07-01','Închiriere apartament bl.3 ap.8 — 12 luni',NULL,'Chirie 350 EUR/lună.','2022-09-05 11:00:00+02'),
  ('DOC00030','CONTRACT_INCHIRIERE','Închiriere spațiu comercial','CI-99/2021','2021-09-01',NULL,NULL,NULL,NULL,NULL,120.00,NULL,NULL,NULL,NULL,'2021-09-01','2023-09-01','Închiriere spațiu comercial str. Principală',NULL,'Închiriat de SC Agro Trans SRL.','2022-09-05 11:15:00+02'),
-- CERTIFICATE FISCALE
  ('DOC00031','CERTIFICAT_FISCAL','CF Ion Popescu 2022',         'CFIS-1111/2022','2022-01-15','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Certificat fiscal 2022 Ion Popescu',NULL,'Fără datorii restante.','2022-10-10 09:00:00+02'),
  ('DOC00032','CERTIFICAT_FISCAL','CF Marian Ene 2022',          'CFIS-2222/2022','2022-01-20','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Certificat fiscal 2022 Marian Ene',NULL,'Fără datorii.','2022-10-10 09:15:00+02'),
  ('DOC00033','CERTIFICAT_FISCAL','CF Augustin Coman 2021',      'CFIS-3333/2021','2021-02-10','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Certificat fiscal 2021 Augustin Coman',NULL,'Solicitat pentru dosar succesoral.','2022-10-10 09:30:00+02'),
-- HOTĂRÂRI
  ('DOC00034','HOTARARE_JUDECATOREASCA','Hotărâre litigiu T3-10',  'HJ-456/2022','2022-09-15','Judecătorie',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Hotărâre judecătorească litigiu parcelă T3-10',NULL,'Câștig de cauză Ion Popescu vs. vecin.','2022-10-10 09:45:00+02'),
  ('DOC00035','HOTARARE_JUDECATOREASCA','Hotărâre succesiune Ardelean','HJ-112/2021','2021-03-20','Judecătorie',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Hotărâre judecătorească confirmare succesiune Ardelean',NULL,'Confirmat partaj conform.','2022-10-10 10:00:00+02'),
-- ACTE DE DONAȚIE
  ('DOC00036','ACT_DONATIE','Donație teren Constantin→Petrescu', '567/DON/2020','2020-08-12','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,2800.00,NULL,NULL,NULL,NULL,NULL,NULL,'Donație livadă T4-2 de la Ana Constantin',NULL,'Donație între rude. Fără condiții.','2022-10-10 10:15:00+02'),
-- CONTRACTE DE PARTAJ
  ('DOC00037','CONTRACT_PARTAJ','Partaj Stoica-Vlad teren T3-9', '678/PAR/2021','2021-11-05','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,4700.00,NULL,NULL,NULL,NULL,NULL,NULL,'Partaj amiabil teren T3-9 coproprietari Stoica și Vlad',NULL,'Partaj prin bună învoială.','2022-10-10 10:30:00+02'),
-- CERTIFICATE SARCINI
  ('DOC00038','CERTIFICAT_SARCINI','Certificat sarcini CF-101',  'CS-1001/2022','2022-01-05','OCPI',NULL,NULL,NULL,NULL,5200.00,NULL,NULL,NULL,NULL,NULL,NULL,'Certificat de sarcini parcela T3-1',NULL,'Fără sarcini. Solicitat pentru vânzare.','2022-10-10 10:45:00+02'),
  ('DOC00039','CERTIFICAT_SARCINI_ALT','Certificat sarcini CF-502','CS-1002/2022','2022-06-10','OCPI',NULL,NULL,NULL,NULL,820.00,NULL,NULL,NULL,NULL,NULL,NULL,'Certificat de sarcini lot Chirilă',NULL,NULL,'2022-10-10 11:00:00+02'),
-- CONTRACTE DE PRESTĂRI SERVICII
  ('DOC00040','CONTRACT_PRESTARI_SERVICII','CPS topografie T3 — Topogeo','CPS-001/2022','2022-02-01',NULL,'SC Topogeo Expert SRL',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Prestări servicii topografice bloc T3 6 parcele','PPERS00023','Beneficiar Ion Popescu.','2022-10-10 11:15:00+02'),
  ('DOC00041','CONTRACT_PRESTARI_SERVICII','CPS cadastru T5 — Topocad','CPS-002/2022','2022-03-01',NULL,'SC Topocad SRL',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Prestări servicii cadastrale parcele T5','JPERS00026',NULL,'2022-11-14 09:00:00+02'),
-- DOCUMENTE NEIDENTIFICATE
  ('DOC00042','UNCLASSIFIED','Document neidentificat 1',         NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Document scanat neidentificat — dosar 2019',NULL,'Importat din folderul Dosar Cadastral 2019.','2022-11-14 09:15:00+02'),
  ('DOC00043','UNCLASSIFIED','Document neidentificat 2',         NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Document scanat neidentificat — dosar 2019',NULL,'Importat din folderul Dosar Cadastral 2019.','2022-11-14 09:30:00+02'),
-- Documente suplimentare diverse
  ('DOC00044','EXTRAS_PUG','Extras PUG Bragadiru — zona T3',    'PUG-B-2022','2022-01-10','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Extras PUG zonă T3 - restricții și reglementări',NULL,'Solicitat pentru planuri construire.','2022-11-14 09:45:00+02'),
  ('DOC00045','EXTRAS_PUG','Extras PUG Bragadiru — zona intravilan','PUG-B-2022-I','2022-01-20','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Extras PUG zonă intravilană',NULL,NULL,'2022-11-14 10:00:00+02'),
  ('DOC00046','CARTE_IDENTITATE','CI Ion Popescu',              'IF123456',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Carte de identitate scanată — import automat.','2022-11-14 10:15:00+02'),
  ('DOC00047','CARTE_IDENTITATE','CI Gheorghe Dumitru',         'IF345678',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'CI scanată — creat din import ID card.','2022-11-14 10:30:00+02'),
  ('DOC00048','CARTE_IDENTITATE','CI Dumitru Stan',             'IF901234',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'CI scanată — creat din import ID card.','2022-11-14 10:45:00+02'),
  ('DOC00049','ACT_ADJUDECARE','Act adjudecare teren litigiu',  'ADJ-33/2022','2022-10-01','Judecătorie',NULL,NULL,NULL,NULL,3800.00,NULL,NULL,NULL,NULL,NULL,NULL,'Act adjudecare parcelă T3-10 la licitație',NULL,'Adjudecatar: SC Imobiliare Centru SA.','2022-11-14 11:00:00+02'),
  ('DOC00050','TESTAMENT','Testament Augustin Coman 2020',      'TEST-007/2020','2020-04-15','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Testament autentic Augustin Coman',NULL,'Lăsat moștenire lui Bogdan Ciobanu.','2022-11-14 11:15:00+02'),
-- Mai multe contracte / documente
  ('DOC00051','CONTRACT_VANZARE','Vânzare teren T4-1 Ardelean→Popescu','1300/AUTH/2021','2021-06-15','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,3200.00,NULL,NULL,NULL,NULL,NULL,NULL,'Vânzare vie T4-1 de la Traian Ardelean',NULL,'Preț 15.000 EUR.','2023-01-09 09:00:00+02'),
  ('DOC00052','CONTRACT_VANZARE','Vânzare T3-9 Stoica→Terra Invest','1400/AUTH/2022','2022-08-20','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,4700.00,NULL,NULL,NULL,NULL,NULL,NULL,'Vânzare parcelă T3-9 — SC Terra Invest SRL',NULL,'Vânzare post-partaj.','2023-01-09 09:15:00+02'),
  ('DOC00053','CONTRACT_ARENDA','Arendă pășune Coman→ProAgro',  'CA-300/2021','2021-05-01',NULL,NULL,NULL,NULL,NULL,9400.00,NULL,NULL,NULL,NULL,'2021-05-01','2026-05-01','Contract arendă pășune T5-P1 — SC ProAgro SRL',NULL,'5 ani. 200 EUR/ha/an.','2023-01-09 09:30:00+02'),
  ('DOC00054','CERTIFICAT_MOSTENITOR','Cert. moștenitor Ene 2022','CM-4567/2022','2022-07-10','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,21500.00,'DS-8901/2022','2022-01-10','Str. Principală nr. 3, Bragadiru','CERT-DC-345/2022',NULL,NULL,'Succesiune parțială după Marian Ene',NULL,'Moștenitor Bogdan Ciobanu (nepot).','2023-01-09 09:45:00+02'),
  ('DOC00055','AUTORIZATIE_ALT','Autorizație demolare clădire veche','AD-88/2022','2022-09-01','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Autorizație demolare corp C1',NULL,NULL,'2023-01-09 10:00:00+02'),
  ('DOC00056','CERTIFICAT_URBANISM','CU lotizare T3-1,2,3',     'CU-1000/2021','2021-11-15','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'CU pentru lotizare parcele T3',NULL,'Condiții PUG aplicate.','2023-01-09 10:15:00+02'),
  ('DOC00057','EXTRAS_CARTE_FUNCIARA','Extras CF-601 PROP00031','ECF-601/2022','2022-05-05','OCPI',NULL,NULL,NULL,NULL,8200.00,NULL,NULL,NULL,NULL,NULL,NULL,'Extras CF fânețe Ardelean','PPERS00023','Solicitat pentru dosar succesoral.','2023-01-09 10:30:00+02'),
  ('DOC00058','ACT_CADASTRU','Documentație cadastrală case str. Păcii','DC-900/2022','2022-10-01','OCPI','SC Geodezica Plus SRL',NULL,NULL,NULL,2430.00,NULL,NULL,NULL,NULL,NULL,NULL,'Documentație pentru 3 case pe str. Păcii','PPERS00023',NULL,'2023-01-09 10:45:00+02'),
  ('DOC00059','CONTRACT_PRESTARI_SERVICII','CPS expert contabil Ene','CPS-005/2022','2022-06-01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Servicii expert contabil pentru SC Nord Agro SRL',NULL,NULL,'2023-01-09 11:00:00+02'),
  ('DOC00060','HOTARARE_JUDECATOREASCA','Hotărâre partaj Stoica-Vlad','HJ-789/2020','2020-12-10','Judecătorie',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Hotărâre judecătorească partaj teren T3-9',NULL,'Baza legală pentru partajul amiabil.','2023-01-09 11:15:00+02'),
  ('DOC00061','AVIZ_INSTITUTIE','Aviz ANIF irigații parcele T3','AVIZ-ANIF-3/2022','2022-07-01','Consiliu Județean',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Aviz rețea irigații parcele T3',NULL,'Necesită investiție canale.','2023-02-20 09:00:00+02'),
  ('DOC00062','CONTRACT_PRESTARI_SERVICII','CPS topografie lot Chirilă','CPS-010/2022','2022-11-01',NULL,'SC Topocad SRL',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Dezmembrare și topografie lot Chirilă 820 mp','JPERS00026',NULL,'2023-02-20 09:20:00+02'),
  ('DOC00063','ACT_ADJUDECARE','Act adjudecare — SC Imobiliare','ADJ-50/2021','2021-12-15','Judecătorie',NULL,NULL,NULL,NULL,15000.00,NULL,NULL,NULL,NULL,NULL,NULL,'Act adjudecare teren industrial Cornetu',NULL,'Adjudecatar: SC Imobiliare Centru SA.','2023-02-20 09:40:00+02'),
  ('DOC00064','CERTIFICAT_FISCAL','CF Florica Dinu 2022',        'CFIS-4444/2022','2022-02-14','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Certificat fiscal Florica Dinu 2022',NULL,NULL,'2023-02-20 10:00:00+02'),
  ('DOC00065','CERTIFICAT_SARCINI','Certificat sarcini CF-801',  'CS-1003/2022','2022-04-20','OCPI',NULL,NULL,NULL,NULL,11000.00,NULL,NULL,NULL,NULL,NULL,NULL,'Certificat de sarcini pășune T6-1',NULL,'Verificat pentru contract arendă.','2023-02-20 10:20:00+02'),
  ('DOC00066','CONTRACT_INCHIRIERE','Închiriere birouri SC Topogeo','CI-150/2022','2022-08-01',NULL,NULL,NULL,NULL,NULL,120.00,NULL,NULL,NULL,NULL,'2022-08-01','2023-07-31','Închiriere spațiu birou SC Topogeo Expert SRL',NULL,NULL,'2023-02-20 10:40:00+02'),
  ('DOC00067','AUTORIZATIE_ALT','Autorizație racord electric bloc B2','ARE-22/2021','2021-12-01','Primăria Comunei Bragadiru',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Autorizație racord electric bloc B2',NULL,NULL,'2023-02-20 11:00:00+02'),
  ('DOC00068','CONTRACT_PARTAJ','Partaj succesoral moștenitori Ardelean','678/PAR/2021b','2021-05-15','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Partaj fânețe și vie între moștenitori Ardelean',NULL,NULL,'2023-02-20 11:20:00+02'),
  ('DOC00069','TESTAMENT','Testament Ion Popescu 2019',           'TEST-012/2019','2019-11-20','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Testament Ion Popescu privind parcelele T3',NULL,'Lăsat moștenire Mariei Ionescu.','2023-02-20 11:40:00+02'),
  ('DOC00070','CONTRACT_VANZARE','Vânzare ap. Matei→Petrescu bloc3','1500/AUTH/2023','2023-01-15','Notariat','Birou Notarial Popescu & Asociații',NULL,NULL,NULL,72.00,NULL,NULL,NULL,NULL,NULL,NULL,'Vânzare apartament bloc 3 ap.12',NULL,'Preț 62.000 EUR.','2023-02-20 12:00:00+02')
) AS v(code,dtype_key,title,nr_doc,date_doc,inst,emitent,baza_legala,uat_prop,uat_propr,suprafata,nr_dosar,data_dec,ultim_dom,nr_cert_dec,date_start,date_end,subject,surveyor_code,notes,cat)
JOIN principal_object po ON po.code = v.code;

-- Set date_valid_until for documents that need it
UPDATE document d
SET date_valid_until = v.dvu
FROM (VALUES
  ('DOC00021','2024-05-10'::date),('DOC00022','2023-08-20'::date),
  ('DOC00023','2024-10-15'::date),('DOC00024','2023-06-01'::date),
  ('DOC00055','2024-09-01'::date),('DOC00056','2023-11-15'::date),
  ('DOC00067','2023-12-01'::date)
) AS v(code, dvu)
WHERE d.code = v.code;

-- =============================================================================
-- 10. GROUPS (12 groups — GRP-001 to GRP-012)
-- =============================================================================

INSERT INTO groups (id, code, target_type, description, last_position, created_at, updated_at)
VALUES
  (gen_random_uuid(),'GRP-001','PROPERTY',      'Parcele din Tarla 3 — Bragadiru. Grup de parcele arabile adiacente din tarla 3, importate din fișiere text cadastrale.',          0,'2022-05-10 10:00:00+02','2022-05-10 10:00:00+02'),
  (gen_random_uuid(),'GRP-002','PROPERTY',      'Parcele din Tarla 5 — Bragadiru. Grup de parcele arabile și pășuni din tarla 5, proprietari multipli.',                          0,'2022-05-10 10:05:00+02','2022-05-10 10:05:00+02'),
  (gen_random_uuid(),'GRP-003','PROPERTY',      'Parcele adiacente Str. Independenței. Terenuri intravilane și construite de-a lungul strǎzii principale.',                       0,'2022-05-10 10:10:00+02','2022-05-10 10:10:00+02'),
  (gen_random_uuid(),'GRP-004','PHYSICAL_PERSON','Moștenitori Ionescu 2019. Persoane fizice beneficiare ale succesiunii după Ion Ionescu decedat în 2019.',                       0,'2022-05-10 10:15:00+02','2022-05-10 10:15:00+02'),
  (gen_random_uuid(),'GRP-005','PHYSICAL_PERSON','Coproprietari teren nord. Proprietari cu drepturi comune pe parcele din zona nordică a comunei Bragadiru.',                     0,'2022-05-10 10:20:00+02','2022-05-10 10:20:00+02'),
  (gen_random_uuid(),'GRP-006','JUDICIAL_PERSON','Firme de construcții și cadastru. Societăți colaboratoare pentru lucrări de construcții și topografie în zonă.',               0,'2022-05-10 10:25:00+02','2022-05-10 10:25:00+02'),
  (gen_random_uuid(),'GRP-007','DOCUMENT',      'Dosar succesoral Ionescu 2019. Documente aferente succesiunii după Ion Ionescu — certificate, extras CF, contracte.',            0,'2022-05-10 10:30:00+02','2022-05-10 10:30:00+02'),
  (gen_random_uuid(),'GRP-008','PROPERTY',      'Parcele din dezmembrare 2022. Loturi rezultate din operațiunea de dezmembrare aprobată în 2022.',                               0,'2022-05-10 10:35:00+02','2022-05-10 10:35:00+02'),
  (gen_random_uuid(),'GRP-009','PHYSICAL_PERSON','Proprietari Cartier Vest. Persoane fizice cu proprietăți în zona de vest a comunei, inclusiv str. Câmpului și str. Nouă.',      0,'2022-05-10 10:40:00+02','2022-05-10 10:40:00+02'),
  (gen_random_uuid(),'GRP-010','DOCUMENT',      'Contracte vânzare 2021–2023. Toate contractele de vânzare autentificate în perioada 2021-2023 pentru proprietăți din Bragadiru.',0,'2022-05-10 10:45:00+02','2022-05-10 10:45:00+02'),
  (gen_random_uuid(),'GRP-011','JUDICIAL_PERSON','Instituții colaboratoare. Birouri notariale, OCPI, Primărie și alte instituții cu care se colaborează frecvent.',               0,'2022-05-10 10:50:00+02','2022-05-10 10:50:00+02'),
  (gen_random_uuid(),'GRP-012','PROPERTY',      'Parcele cu litigii active. Terenuri care au sau au avut dosare juridice în curs — atenție la operațiunile cadastrale.',          0,'2022-05-10 10:55:00+02','2022-05-10 10:55:00+02');

-- Update last_position after member inserts (done below)
-- =============================================================================
-- 11. STAMPS (7 stamps — STMP-AAA through STMP-AAG)
-- Scenario: simulating documents loaded from a folder structure; stamps = folders
-- =============================================================================

INSERT INTO stamps (id, code, short_description, notes, created_at, updated_at)
VALUES
  (gen_random_uuid(),'STMP-AAA','Dosar Cadastral 2019',         'Ștampilă aplicată documentelor și proprietăților din dosarul cadastral arhivat în 2019. Folder: /Arhiva/2019/Cadastru/.','2022-05-15 09:00:00+02','2022-05-15 09:00:00+02'),
  (gen_random_uuid(),'STMP-AAB','Import Fișier Text Batch 1',   'Proprietăți create automat din fișier text coordonate Stereo70. Batch 1 (mai 2022) — parcele T3.','2022-05-15 09:05:00+02','2022-05-15 09:05:00+02'),
  (gen_random_uuid(),'STMP-AAC','Folder: Contracte Vânzare',    'Documente importate din folderul /Arhiva/Contracte/Vanzare/. Contracte autentificate notarial.','2022-05-15 09:10:00+02','2022-05-15 09:10:00+02'),
  (gen_random_uuid(),'STMP-AAD','Folder: Documente Cadastrale', 'Documente importate din /Arhiva/Cadastru/. Include acte cadastru, extrase CF, documentații topografice.','2022-05-15 09:15:00+02','2022-05-15 09:15:00+02'),
  (gen_random_uuid(),'STMP-AAE','Import Card Identitate',        'Persoane fizice create din imagini cărți de identitate scanate via OCR și recunoaștere vizuală AI.','2022-05-15 09:20:00+02','2022-05-15 09:20:00+02'),
  (gen_random_uuid(),'STMP-AAF','Dosar Moștenire Popescu',      'Entități asociate dosarului de moștenire Popescu/Ionescu. Persoane, documente și proprietăți relevante.','2022-05-15 09:25:00+02','2022-05-15 09:25:00+02'),
  (gen_random_uuid(),'STMP-AAG','UAT Bragadiru',                 'Proprietăți și documente aflate în raza UAT Bragadiru — commune Bragadiru, județul Ilfov.','2022-05-15 09:30:00+02','2022-05-15 09:30:00+02');

-- =============================================================================
-- 12. GROUP_MEMBER rows
-- =============================================================================

-- GRP-001: Parcele T3 — PROP00001 through PROP00007 + PROP00033, PROP00037, PROP00039
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-001'
  AND po.code IN ('PROP00001','PROP00002','PROP00003','PROP00004','PROP00005','PROP00006','PROP00007','PROP00033','PROP00037','PROP00039');

UPDATE groups SET last_position = 10 WHERE code = 'GRP-001';

-- GRP-002: Parcele T5 — PROP00008 through PROP00012 + PROP00036
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-002'
  AND po.code IN ('PROP00008','PROP00009','PROP00010','PROP00011','PROP00012','PROP00036');

UPDATE groups SET last_position = 6 WHERE code = 'GRP-002';

-- GRP-003: Parcele Str. Independenței — PROP00013, PROP00015, PROP00018
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-003'
  AND po.code IN ('PROP00013','PROP00015','PROP00018','PROP00014','PROP00016');

UPDATE groups SET last_position = 5 WHERE code = 'GRP-003';

-- GRP-004: Moștenitori Ionescu — PPERS00002 (Maria Ionescu), PPERS00020 (Roxana Petrescu)
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-004'
  AND po.code IN ('PPERS00002','PPERS00020');

UPDATE groups SET last_position = 2 WHERE code = 'GRP-004';

-- GRP-005: Coproprietari nord — PPERS00005, PPERS00010, PPERS00021, PPERS00027
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-005'
  AND po.code IN ('PPERS00005','PPERS00010','PPERS00021','PPERS00027');

UPDATE groups SET last_position = 4 WHERE code = 'GRP-005';

-- GRP-006: Firme construcții/cadastru — JPERS00002, JPERS00007, JPERS00009, JPERS00012, JPERS00016, JPERS00026
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-006'
  AND po.code IN ('JPERS00002','JPERS00007','JPERS00009','JPERS00012','JPERS00016','JPERS00026');

UPDATE groups SET last_position = 6 WHERE code = 'GRP-006';

-- GRP-007: Dosar succesoral Ionescu — DOC00013 (cert moștenitor), DOC00016 (extras CF), DOC00017
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-007'
  AND po.code IN ('DOC00013','DOC00016','DOC00038','DOC00069');

UPDATE groups SET last_position = 4 WHERE code = 'GRP-007';

-- GRP-008: Dezmembrare 2022 — PROP00027, PROP00028, PROP00032
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-008'
  AND po.code IN ('PROP00027','PROP00028','PROP00032');

UPDATE groups SET last_position = 3 WHERE code = 'GRP-008';

-- GRP-009: Proprietari Cartier Vest — PPERS00009, PPERS00019, PPERS00022, PPERS00025, PPERS00028, PPERS00029, PPERS00030
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-009'
  AND po.code IN ('PPERS00009','PPERS00019','PPERS00022','PPERS00025','PPERS00028','PPERS00029','PPERS00030');

UPDATE groups SET last_position = 7 WHERE code = 'GRP-009';

-- GRP-010: Contracte vânzare 2021-2023 — DOC00009, DOC00010, DOC00011, DOC00012, DOC00051, DOC00052, DOC00070
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-010'
  AND po.code IN ('DOC00009','DOC00010','DOC00011','DOC00012','DOC00051','DOC00052','DOC00070');

UPDATE groups SET last_position = 7 WHERE code = 'GRP-010';

-- GRP-011: Instituții colaboratoare — JPERS00004, JPERS00008, JPERS00011, JPERS00013, JPERS00027
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-011'
  AND po.code IN ('JPERS00004','JPERS00008','JPERS00011','JPERS00013','JPERS00027');

UPDATE groups SET last_position = 5 WHERE code = 'GRP-011';

-- GRP-012: Parcele litigii — PROP00039 (litigiu T3-10), PROP00034 (vie contestată)
INSERT INTO group_member (id, group_id, principal_object_id, position, created_at)
SELECT gen_random_uuid(), g.id, po.id, ROW_NUMBER() OVER (ORDER BY po.code), now()
FROM groups g, principal_object po
WHERE g.code = 'GRP-012'
  AND po.code IN ('PROP00039','PROP00034');

UPDATE groups SET last_position = 2 WHERE code = 'GRP-012';

-- =============================================================================
-- 13. STAMP_MEMBER rows
-- Scenario: files loaded from folders get stamped with the folder stamps
-- =============================================================================

-- STMP-AAA: Dosar Cadastral 2019 → properties and documents from 2019
INSERT INTO stamp_member (id, stamp_id, target_type, principal_object_id, created_at)
SELECT gen_random_uuid(), s.id,
  CASE WHEN po.object_type = 'PROPERTY' THEN 'PROPERTY' ELSE 'DOCUMENT' END::group_target_type,
  po.id, now()
FROM stamps s, principal_object po
WHERE s.code = 'STMP-AAA'
  AND po.code IN ('PROP00001','PROP00002','PROP00003','PROP00004','DOC00019','DOC00042','DOC00043');

-- STMP-AAB: Import Fișier Text Batch 1 → T3 parcels created from text file
INSERT INTO stamp_member (id, stamp_id, target_type, principal_object_id, created_at)
SELECT gen_random_uuid(), s.id, 'PROPERTY'::group_target_type, po.id, now()
FROM stamps s, principal_object po
WHERE s.code = 'STMP-AAB'
  AND po.code IN ('PROP00001','PROP00002','PROP00003','PROP00004','PROP00005','PROP00006','PROP00007');

-- STMP-AAC: Folder Contracte Vânzare → sale contracts
INSERT INTO stamp_member (id, stamp_id, target_type, principal_object_id, created_at)
SELECT gen_random_uuid(), s.id, 'DOCUMENT'::group_target_type, po.id, now()
FROM stamps s, principal_object po
WHERE s.code = 'STMP-AAC'
  AND po.code IN ('DOC00009','DOC00010','DOC00011','DOC00012','DOC00051','DOC00052','DOC00070');

-- STMP-AAD: Folder Documente Cadastrale → cadastral docs + extras CF
INSERT INTO stamp_member (id, stamp_id, target_type, principal_object_id, created_at)
SELECT gen_random_uuid(), s.id, 'DOCUMENT'::group_target_type, po.id, now()
FROM stamps s, principal_object po
WHERE s.code = 'STMP-AAD'
  AND po.code IN ('DOC00016','DOC00017','DOC00018','DOC00019','DOC00020','DOC00038','DOC00039','DOC00057','DOC00058');

-- STMP-AAE: Import Card Identitate → persons created from ID scans
INSERT INTO stamp_member (id, stamp_id, target_type, principal_object_id, created_at)
SELECT gen_random_uuid(), s.id, 'PHYSICAL_PERSON'::group_target_type, po.id, now()
FROM stamps s, principal_object po
WHERE s.code = 'STMP-AAE'
  AND po.code IN ('PPERS00003','PPERS00009','PPERS00021');

-- Also stamp the CI documents themselves
INSERT INTO stamp_member (id, stamp_id, target_type, principal_object_id, created_at)
SELECT gen_random_uuid(), s.id, 'DOCUMENT'::group_target_type, po.id, now()
FROM stamps s, principal_object po
WHERE s.code = 'STMP-AAE'
  AND po.code IN ('DOC00046','DOC00047','DOC00048');

-- STMP-AAF: Dosar Moștenire Popescu → persons + documents
INSERT INTO stamp_member (id, stamp_id, target_type, principal_object_id, created_at)
SELECT gen_random_uuid(), s.id,
  CASE po.object_type
    WHEN 'PERSON' THEN (
      CASE WHEN p.type = 'NATURAL' THEN 'PHYSICAL_PERSON' ELSE 'JUDICIAL_PERSON' END
    )
    ELSE 'DOCUMENT'
  END::group_target_type,
  po.id, now()
FROM stamps s
JOIN principal_object po ON po.code IN ('PPERS00001','PPERS00002','PPERS00020','DOC00013','DOC00069')
LEFT JOIN person p ON p.principal_object_id = po.id
WHERE s.code = 'STMP-AAF';

-- STMP-AAG: UAT Bragadiru → most properties
INSERT INTO stamp_member (id, stamp_id, target_type, principal_object_id, created_at)
SELECT gen_random_uuid(), s.id, 'PROPERTY'::group_target_type, po.id, now()
FROM stamps s, principal_object po
WHERE s.code = 'STMP-AAG'
  AND po.code IN (
    'PROP00001','PROP00002','PROP00003','PROP00004','PROP00005','PROP00006','PROP00007',
    'PROP00008','PROP00009','PROP00010','PROP00011','PROP00012',
    'PROP00013','PROP00014','PROP00015','PROP00016','PROP00017','PROP00018','PROP00019','PROP00020',
    'PROP00021','PROP00022','PROP00023','PROP00024','PROP00025',
    'PROP00026','PROP00027','PROP00028','PROP00029','PROP00030'
  );

-- =============================================================================
-- 14. PROPERTY_PERSON associations (with roles)
-- =============================================================================

INSERT INTO property_person (id, property_id, person_id, person_role_id, created_at)
SELECT gen_random_uuid(), pr.id, p.id,
  (SELECT id FROM lookup_person_role WHERE name = v.role LIMIT 1),
  now()
FROM (VALUES
  ('PROP00001','PPERS00001','Proprietar'),
  ('PROP00002','PPERS00002','Proprietar'),
  ('PROP00003','PPERS00002','Proprietar'),
  ('PROP00004','PPERS00002','Proprietar'),
  ('PROP00005','PPERS00006','Coproprietar'),
  ('PROP00005','PPERS00011','Coproprietar'),
  ('PROP00006','PPERS00006','Coproprietar'),
  ('PROP00006','PPERS00011','Coproprietar'),
  ('PROP00007','PPERS00013','Proprietar'),
  ('PROP00008','PPERS00021','Proprietar'),
  ('PROP00009','PPERS00021','Proprietar'),
  ('PROP00010','PPERS00018','Proprietar'),
  ('PROP00011','PPERS00027','Proprietar'),
  ('PROP00012','PPERS00021','Proprietar'),
  ('PROP00013','PPERS00001','Proprietar / Titular'),
  ('PROP00014','PPERS00010','Proprietar'),
  ('PROP00015','PPERS00014','Proprietar'),
  ('PROP00016','PPERS00022','Proprietar'),
  ('PROP00017','PPERS00019','Cumpărător'),
  ('PROP00018','PPERS00006','Proprietar'),
  ('PROP00019','PPERS00018','Proprietar'),
  ('PROP00020','PPERS00021','Proprietar'),
  ('PROP00021','PPERS00016','Proprietar'),
  ('PROP00022','PPERS00008','Proprietar'),
  ('PROP00023','PPERS00026','Proprietar'),
  ('PROP00024','PPERS00024','Proprietar'),
  ('PROP00025','PPERS00020','Proprietar'),
  ('PROP00026','PPERS00011','Coproprietar'),
  ('PROP00026','PPERS00012','Coproprietar'),
  ('PROP00027','PPERS00028','Proprietar'),
  ('PROP00028','PPERS00029','Cumpărător'),
  ('PROP00029','PPERS00015','Coproprietar'),
  ('PROP00030','PPERS00017','Proprietar'),
  ('PROP00031','PPERS00013','Proprietar'),
  ('PROP00032','PPERS00019','Cumpărător'),
  ('PROP00032','PPERS00030','Vânzător'),
  ('PROP00033','PPERS00005','Proprietar'),
  ('PROP00034','PPERS00013','Proprietar'),
  ('PROP00035','PPERS00004','Proprietar'),
  ('PROP00036','PPERS00010','Proprietar'),
  ('PROP00037','PPERS00011','Coproprietar'),
  ('PROP00037','PPERS00012','Coproprietar'),
  ('PROP00038','PPERS00030','Vânzător'),
  ('PROP00039','PPERS00001','Proprietar'),
  ('PROP00040','JPERS00003','Cumpărător')
) AS v(prop_code, pers_code, role)
JOIN property pr ON pr.code = v.prop_code
JOIN person p ON p.code = v.pers_code
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 15. PERSON_DOCUMENT associations
-- =============================================================================

INSERT INTO person_document (id, person_id, document_id, quality, person_role_id, created_at)
SELECT gen_random_uuid(), p.id, d.id, v.quality,
  (SELECT id FROM lookup_person_role WHERE name = v.role LIMIT 1),
  now()
FROM (VALUES
  -- Titluri proprietate
  ('PPERS00001','DOC00001',NULL,'Titular / Proprietar'),
  ('PPERS00002','DOC00002',NULL,'Titular / Proprietar'),
  ('PPERS00005','DOC00003',NULL,'Titular / Proprietar'),
  ('PPERS00021','DOC00004',NULL,'Titular / Proprietar'),
  ('PPERS00027','DOC00005',NULL,'Titular / Proprietar'),
  ('PPERS00013','DOC00006',NULL,'Titular / Proprietar'),
  ('PPERS00010','DOC00007',NULL,'Titular / Proprietar'),
  ('PPERS00030','DOC00008',NULL,'Titular / Proprietar'),
  -- Contracte vânzare
  ('PPERS00030','DOC00009',NULL,'Vânzător'),
  ('PPERS00019','DOC00009',NULL,'Cumpărător'),
  ('PPERS00007','DOC00009',NULL,'Notar'),
  ('PPERS00030','DOC00010',NULL,'Vânzător'),
  ('PPERS00029','DOC00010',NULL,'Cumpărător'),
  ('PPERS00007','DOC00010',NULL,'Notar'),
  ('PPERS00014','DOC00011',NULL,'Vânzător'),
  ('PPERS00017','DOC00011',NULL,'Cumpărător'),
  ('PPERS00005','DOC00012',NULL,'Vânzător'),
  -- Certificate moștenitor
  ('PPERS00002','DOC00013','MOSTENITOR','Moștenitor'),
  ('PPERS00020','DOC00013','MOSTENITOR','Moștenitor'),
  ('PPERS00004','DOC00014','MOSTENITOR','Moștenitor'),
  ('PPERS00005','DOC00014','MOSTENITOR','Moștenitor'),
  ('PPERS00015','DOC00015','MOSTENITOR','Moștenitor'),
  ('PPERS00027','DOC00015','DEFUNCT','Titular al succesiunii / Defunct'),
  -- Extras CF
  ('PPERS00001','DOC00016',NULL,'Solicitant / Beneficiar'),
  ('PPERS00021','DOC00017',NULL,'Solicitant / Beneficiar'),
  -- Acte cadastru
  ('PPERS00023','DOC00019',NULL,'Topograf / Expert cadastral'),
  ('PPERS00001','DOC00019',NULL,'Solicitant / Beneficiar'),
  ('PPERS00023','DOC00020',NULL,'Topograf / Expert cadastral'),
  ('PPERS00021','DOC00020',NULL,'Solicitant / Beneficiar'),
  -- CU și autorizații
  ('PPERS00024','DOC00021',NULL,'Solicitant / Beneficiar'),
  ('PPERS00008','DOC00022',NULL,'Beneficiar / Solicitant'),
  ('PPERS00008','DOC00023',NULL,'Beneficiar / Solicitant'),
  ('PPERS00025','DOC00023',NULL,'Constructor / Antreprenor'),
  -- Contracte arendă
  ('PPERS00021','DOC00027',NULL,'Arendator'),
  ('PPERS00010','DOC00028',NULL,'Arendator'),
  -- Contracte închiriere
  ('PPERS00016','DOC00029',NULL,'Locator'),
  -- Certificate fiscale
  ('PPERS00001','DOC00031',NULL,'Proprietar'),
  ('PPERS00021','DOC00032',NULL,'Proprietar'),
  ('PPERS00027','DOC00033',NULL,'Proprietar'),
  -- Hotărâri judecătorești
  ('PPERS00001','DOC00034',NULL,'Titular de drept'),
  ('PPERS00013','DOC00035',NULL,'Moștenitor'),
  -- Donație
  ('PPERS00004','DOC00036',NULL,'Proprietar'),
  ('PPERS00020','DOC00036',NULL,'Moștenitor'),
  -- Partaj
  ('PPERS00011','DOC00037',NULL,'Coproprietari / Coindivizari'),
  ('PPERS00012','DOC00037',NULL,'Coproprietari / Coindivizari'),
  -- Testament
  ('PPERS00027','DOC00050',NULL,'Proprietar'),
  ('PPERS00001','DOC00069',NULL,'Proprietar')
) AS v(pers_code, doc_code, quality, role)
JOIN person p ON p.code = v.pers_code
JOIN document d ON d.code = v.doc_code
ON CONFLICT DO NOTHING;

-- Also link judicial persons to some documents
INSERT INTO person_document (id, person_id, document_id, quality, person_role_id, created_at)
SELECT gen_random_uuid(), p.id, d.id, NULL,
  (SELECT id FROM lookup_person_role WHERE name = v.role LIMIT 1), now()
FROM (VALUES
  ('JPERS00005','DOC00027',NULL,'Arendaș'),
  ('JPERS00020','DOC00028',NULL,'Arendaș'),
  ('JPERS00003','DOC00049',NULL,'Adjudecatar'),
  ('JPERS00003','DOC00063',NULL,'Adjudecatar'),
  ('JPERS00009','DOC00040',NULL,'Prestator'),
  ('JPERS00026','DOC00041',NULL,'Prestator'),
  ('JPERS00026','DOC00062',NULL,'Prestator')
) AS v(pers_code, doc_code, quality_unused, role)
JOIN person p ON p.code = v.pers_code
JOIN document d ON d.code = v.doc_code
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 16. PROPERTY_DOCUMENT associations
-- =============================================================================

INSERT INTO property_document (id, property_id, document_id, created_at)
SELECT gen_random_uuid(), pr.id, d.id, now()
FROM (VALUES
  ('PROP00001','DOC00001'), ('PROP00001','DOC00016'), ('PROP00001','DOC00019'),
  ('PROP00001','DOC00038'), ('PROP00001','DOC00044'), ('PROP00001','DOC00056'),
  ('PROP00002','DOC00002'), ('PROP00002','DOC00019'),
  ('PROP00003','DOC00019'), ('PROP00003','DOC00056'),
  ('PROP00004','DOC00019'),
  ('PROP00005','DOC00005'),
  ('PROP00006','DOC00005'),
  ('PROP00007','DOC00006'),
  ('PROP00008','DOC00004'), ('PROP00008','DOC00017'), ('PROP00008','DOC00027'),
  ('PROP00009','DOC00004'), ('PROP00009','DOC00027'),
  ('PROP00010','DOC00004'), ('PROP00010','DOC00027'),
  ('PROP00011','DOC00005'), ('PROP00011','DOC00053'),
  ('PROP00013','DOC00031'), ('PROP00013','DOC00044'),
  ('PROP00015','DOC00021'),
  ('PROP00017','DOC00009'),
  ('PROP00022','DOC00029'),
  ('PROP00023','DOC00058'),
  ('PROP00026','DOC00058'),
  ('PROP00027','DOC00062'), ('PROP00027','DOC00039'),
  ('PROP00028','DOC00010'),
  ('PROP00029','DOC00015'),
  ('PROP00031','DOC00006'), ('PROP00031','DOC00014'), ('PROP00031','DOC00057'),
  ('PROP00032','DOC00008'), ('PROP00032','DOC00009'),
  ('PROP00033','DOC00003'), ('PROP00033','DOC00012'),
  ('PROP00034','DOC00034'), ('PROP00034','DOC00051'),
  ('PROP00035','DOC00035'), ('PROP00035','DOC00036'),
  ('PROP00036','DOC00007'), ('PROP00036','DOC00028'), ('PROP00036','DOC00065'),
  ('PROP00037','DOC00037'), ('PROP00037','DOC00060'),
  ('PROP00038','DOC00008'), ('PROP00038','DOC00010'),
  ('PROP00039','DOC00034'), ('PROP00039','DOC00049'),
  ('PROP00040','DOC00063')
) AS v(prop_code, doc_code)
JOIN property pr ON pr.code = v.prop_code
JOIN document d ON d.code = v.doc_code
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 17. PROPERTY_PROPERTY self-references (with roles)
-- =============================================================================

INSERT INTO property_property (id, property_id_a, property_id_b, relationship_role_id, created_at)
SELECT gen_random_uuid(),
  LEAST(pa.id, pb.id), GREATEST(pa.id, pb.id),
  (SELECT id FROM lookup_property_property_role WHERE name = v.role LIMIT 1),
  now()
FROM (VALUES
  ('PROP00001','PROP00002','Adiacent'),
  ('PROP00002','PROP00003','Adiacent'),
  ('PROP00003','PROP00004','Adiacent'),
  ('PROP00005','PROP00006','Adiacent'),
  ('PROP00006','PROP00007','Adiacent'),
  ('PROP00001','PROP00005','Contiguu'),
  ('PROP00008','PROP00009','Adiacent'),
  ('PROP00009','PROP00010','Adiacent'),
  ('PROP00010','PROP00011','Adiacent'),
  ('PROP00011','PROP00012','Adiacent'),
  ('PROP00027','PROP00028','Adiacent'),
  ('PROP00026','PROP00027','Adiacent'),
  ('PROP00031','PROP00032','Adiacent'),
  ('PROP00032','PROP00038','Adiacent'),
  ('PROP00033','PROP00037','Adiacent'),
  ('PROP00033','PROP00039','Adiacent'),
  ('PROP00034','PROP00035','Adiacent'),
  ('PROP00036','PROP00011','Contiguu'),
  ('PROP00013','PROP00001','Acces prin')
) AS v(code_a, code_b, role)
JOIN property pa ON pa.code = v.code_a
JOIN property pb ON pb.code = v.code_b
WHERE pa.id <> pb.id
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 18. DOCUMENT_DOCUMENT self-references (with roles)
-- =============================================================================

INSERT INTO document_document (id, document_id_a, document_id_b, relationship_role_id, created_at)
SELECT gen_random_uuid(),
  LEAST(da.id, db.id), GREATEST(da.id, db.id),
  (SELECT id FROM lookup_document_document_role WHERE name = v.role LIMIT 1),
  now()
FROM (VALUES
  ('DOC00009','DOC00038','Consolidat cu'),
  ('DOC00013','DOC00016','Consolidat cu'),
  ('DOC00013','DOC00038','Consolidat cu'),
  ('DOC00016','DOC00019','Consolidat cu'),
  ('DOC00021','DOC00023','Consolidat cu'),
  ('DOC00022','DOC00023','Versiune anterioară a'),
  ('DOC00035','DOC00014','Consolidat cu'),
  ('DOC00037','DOC00060','Versiune anterioară a'),
  ('DOC00051','DOC00036','Corecție a'),
  ('DOC00067','DOC00023','Anexă la')
) AS v(code_a, code_b, role)
JOIN document da ON da.code = v.code_a
JOIN document db ON db.code = v.code_b
WHERE da.id <> db.id
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 19. PERSON_PERSON self-references
-- =============================================================================

INSERT INTO person_person (id, person_id_a, person_id_b, relationship_role_id, created_at)
SELECT gen_random_uuid(),
  LEAST(pa.id, pb.id), GREATEST(pa.id, pb.id),
  (SELECT id FROM lookup_person_role WHERE name = v.role LIMIT 1),
  now()
FROM (VALUES
  ('PPERS00011','PPERS00012','Coproprietar'),
  ('PPERS00004','PPERS00005','Coproprietar / Co-moștenitor'),
  ('PPERS00002','PPERS00020','Moștenitor / Succesor'),
  ('PPERS00001','PPERS00007','Reprezentant legal'),
  ('PPERS00013','PPERS00004','Moștenitor'),
  ('PPERS00027','PPERS00015','Coproprietar')
) AS v(code_a, code_b, role)
JOIN person pa ON pa.code = v.code_a
JOIN person pb ON pb.code = v.code_b
WHERE pa.id <> pb.id
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20. ENTITY_METADATA — importance / relevance / provenance for most entities
-- =============================================================================

INSERT INTO entity_metadata (id, principal_object_id, importance, relevance, provenance,
  importance_updated_at, relevance_updated_at, provenance_updated_at, created_at, updated_at)
SELECT gen_random_uuid(), po.id,
  v.importance, v.relevance, v.provenance,
  now(), now(), now(), now(), now()
FROM (VALUES
-- Natural persons
  ('PPERS00001','HIGH',  'CURRENT',    'MANUAL'),
  ('PPERS00002','HIGH',  'CURRENT',    'MANUAL'),
  ('PPERS00003','MEDIUM','CURRENT',    'AI_INTERPRETED'),
  ('PPERS00004','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00005','HIGH',  'CURRENT',    'MANUAL'),
  ('PPERS00006','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00007','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00008','LOW',   'HISTORICAL', 'MANUAL'),
  ('PPERS00009','MEDIUM','CURRENT',    'AI_INTERPRETED'),
  ('PPERS00010','HIGH',  'CURRENT',    'MANUAL'),
  ('PPERS00011','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00012','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00013','HIGH',  'HISTORICAL', 'MANUAL'),
  ('PPERS00014','HIGH',  'CURRENT',    'MANUAL'),
  ('PPERS00015','LOW',   'FUTURE',     'MANUAL'),
  ('PPERS00016','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00017','LOW',   'CURRENT',    'MANUAL'),
  ('PPERS00018','HIGH',  'CURRENT',    'MANUAL'),
  ('PPERS00019','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00020','LOW',   'HISTORICAL', 'MANUAL'),
  ('PPERS00021','HIGH',  'HISTORICAL', 'MANUAL'),
  ('PPERS00022','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00023','HIGH',  'CURRENT',    'MANUAL'),
  ('PPERS00024','LOW',   'CURRENT',    'MANUAL'),
  ('PPERS00025','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00026','LOW',   'CURRENT',    'MANUAL'),
  ('PPERS00027','HIGH',  'HISTORICAL', 'MANUAL'),
  ('PPERS00028','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00029','MEDIUM','CURRENT',    'MANUAL'),
  ('PPERS00030','HIGH',  'HISTORICAL', 'MANUAL'),
-- Judicial persons
  ('JPERS00001','LOW',   'CURRENT',    'MANUAL'),
  ('JPERS00002','MEDIUM','CURRENT',    'MANUAL'),
  ('JPERS00003','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00004','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00005','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00006','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00007','MEDIUM','CURRENT',    'MANUAL'),
  ('JPERS00008','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00009','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00010','MEDIUM','FUTURE',     'MANUAL'),
  ('JPERS00011','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00013','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00016','MEDIUM','CURRENT',    'MANUAL'),
  ('JPERS00020','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00026','HIGH',  'CURRENT',    'MANUAL'),
  ('JPERS00027','HIGH',  'CURRENT',    'MANUAL'),
-- Properties
  ('PROP00001','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00002','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00003','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00004','MEDIUM','CURRENT',    'COORDINATE_FILE'),
  ('PROP00005','MEDIUM','CURRENT',    'COORDINATE_FILE'),
  ('PROP00006','MEDIUM','CURRENT',    'COORDINATE_FILE'),
  ('PROP00007','MEDIUM','CURRENT',    'COORDINATE_FILE'),
  ('PROP00008','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00009','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00010','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00011','HIGH',  'CURRENT',    'MANUAL'),
  ('PROP00012','MEDIUM','CURRENT',    'COORDINATE_FILE'),
  ('PROP00013','HIGH',  'CURRENT',    'MANUAL'),
  ('PROP00014','MEDIUM','CURRENT',    'MANUAL'),
  ('PROP00015','HIGH',  'CURRENT',    'MANUAL'),
  ('PROP00016','MEDIUM','CURRENT',    'MANUAL'),
  ('PROP00017','HIGH',  'CURRENT',    'MANUAL'),
  ('PROP00018','MEDIUM','CURRENT',    'MANUAL'),
  ('PROP00019','MEDIUM','CURRENT',    'MANUAL'),
  ('PROP00020','HIGH',  'CURRENT',    'MANUAL'),
  ('PROP00021','MEDIUM','CURRENT',    'MANUAL'),
  ('PROP00022','LOW',   'CURRENT',    'MANUAL'),
  ('PROP00023','MEDIUM','CURRENT',    'MANUAL'),
  ('PROP00024','LOW',   'CURRENT',    'MANUAL'),
  ('PROP00025','LOW',   'HISTORICAL', 'MANUAL'),
  ('PROP00026','HIGH',  'CURRENT',    'MANUAL'),
  ('PROP00027','HIGH',  'CURRENT',    'MANUAL'),
  ('PROP00028','HIGH',  'CURRENT',    'MANUAL'),
  ('PROP00029','MEDIUM','CURRENT',    'MANUAL'),
  ('PROP00030','MEDIUM','CURRENT',    'MANUAL'),
  ('PROP00031','HIGH',  'HISTORICAL', 'COORDINATE_FILE'),
  ('PROP00032','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00033','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00034','HIGH',  'HISTORICAL', 'COORDINATE_FILE'),
  ('PROP00035','MEDIUM','CURRENT',    'COORDINATE_FILE'),
  ('PROP00036','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00037','HIGH',  'HISTORICAL', 'COORDINATE_FILE'),
  ('PROP00038','HIGH',  'HISTORICAL', 'COORDINATE_FILE'),
  ('PROP00039','HIGH',  'CURRENT',    'COORDINATE_FILE'),
  ('PROP00040','MEDIUM','FUTURE',     'MANUAL'),
-- Documents
  ('DOC00001','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00002','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00003','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00004','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00005','HIGH',  'HISTORICAL', 'MANUAL'),
  ('DOC00006','HIGH',  'HISTORICAL', 'MANUAL'),
  ('DOC00007','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00008','HIGH',  'HISTORICAL', 'MANUAL'),
  ('DOC00009','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00010','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00011','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00012','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00013','HIGH',  'HISTORICAL', 'MANUAL'),
  ('DOC00014','HIGH',  'HISTORICAL', 'MANUAL'),
  ('DOC00015','HIGH',  'HISTORICAL', 'MANUAL'),
  ('DOC00016','MEDIUM','CURRENT',    'MANUAL'),
  ('DOC00017','MEDIUM','CURRENT',    'MANUAL'),
  ('DOC00019','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00020','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00021','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00022','MEDIUM','HISTORICAL', 'MANUAL'),
  ('DOC00023','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00027','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00028','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00034','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00035','HIGH',  'HISTORICAL', 'MANUAL'),
  ('DOC00036','MEDIUM','HISTORICAL', 'MANUAL'),
  ('DOC00042','LOW',   'HISTORICAL', 'IMAGE'),
  ('DOC00043','LOW',   'HISTORICAL', 'IMAGE'),
  ('DOC00046','LOW',   'HISTORICAL', 'AI_INTERPRETED'),
  ('DOC00047','LOW',   'HISTORICAL', 'AI_INTERPRETED'),
  ('DOC00048','LOW',   'HISTORICAL', 'AI_INTERPRETED'),
  ('DOC00049','MEDIUM','CURRENT',    'MANUAL'),
  ('DOC00050','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00051','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00052','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00069','HIGH',  'CURRENT',    'MANUAL'),
  ('DOC00070','HIGH',  'CURRENT',    'MANUAL')
) AS v(code, importance, relevance, provenance)
JOIN principal_object po ON po.code = v.code;

-- Seed entity_metadata_version v0 for the inserted metadata rows
INSERT INTO entity_metadata_version (id, entity_metadata_id, version_number, snapshot, created_at)
SELECT gen_random_uuid(), em.id, 0,
  jsonb_build_object('importance', em.importance, 'relevance', em.relevance, 'provenance', em.provenance),
  em.created_at
FROM entity_metadata em;

-- =============================================================================
-- 21. ENTITY_TAG rows
-- =============================================================================

INSERT INTO entity_tag (id, principal_object_id, tag, created_at)
SELECT gen_random_uuid(), po.id, v.tag, now()
FROM (VALUES
  ('PPERS00001','proprietar'),('PPERS00001','bragadiru'),('PPERS00001','teren arabil'),
  ('PPERS00002','moștenitoare'),('PPERS00002','bragadiru'),('PPERS00002','succesiune 2019'),
  ('PPERS00003','proprietar'),('PPERS00003','import carte identitate'),
  ('PPERS00004','moștenitoare'),('PPERS00004','succesiune ardelean'),
  ('PPERS00005','proprietar'),('PPERS00005','tarla 3'),('PPERS00005','tarla 5'),
  ('PPERS00007','avocat'),('PPERS00007','reprezentant legal'),
  ('PPERS00009','proprietar'),('PPERS00009','import carte identitate'),
  ('PPERS00010','proprietar'),('PPERS00010','pășune'),('PPERS00010','arendare'),
  ('PPERS00011','coproprietar'),('PPERS00011','stoica-vlad'),
  ('PPERS00012','coproprietar'),('PPERS00012','stoica-vlad'),
  ('PPERS00013','moștenitor'),('PPERS00013','vie'),('PPERS00013','fânețe'),
  ('PPERS00014','proprietar'),('PPERS00014','str. independenței'),
  ('PPERS00017','beneficiar'),('PPERS00017','bloc b2'),
  ('PPERS00021','proprietar'),('PPERS00021','tarla 5'),('PPERS00021','vârstnic'),
  ('PPERS00023','topograf'),('PPERS00023','expert cadastral'),('PPERS00023','pfa'),
  ('PPERS00025','constructor'),('PPERS00025','bloc b2'),
  ('PPERS00027','proprietar'),('PPERS00027','vârstnic'),('PPERS00027','pășune'),
  ('PPERS00029','cumpărător'),('PPERS00029','tranzacție 2022'),
  ('PPERS00030','vânzătoare'),('PPERS00030','foste proprietăți t1 t2'),
  ('JPERS00004','notariat'),('JPERS00004','autentificare'),
  ('JPERS00005','arendare'),('JPERS00005','teren arabil'),
  ('JPERS00006','pfa'),('JPERS00006','cadastru'),('JPERS00006','topografie'),
  ('JPERS00008','primărie'),('JPERS00008','autorizații'),('JPERS00008','bragadiru'),
  ('JPERS00009','topografie'),('JPERS00009','cadastru'),('JPERS00009','expert'),
  ('JPERS00013','ocpi'),('JPERS00013','cadastru'),('JPERS00013','ilfov'),
  ('JPERS00020','agricultură'),('JPERS00020','arendare'),('JPERS00020','ilfov'),
  ('JPERS00026','cadastru'),('JPERS00026','topografie'),('JPERS00026','topocad'),
  ('PROP00001','tarla 3'),('PROP00001','teren arabil'),('PROP00001','text file import'),
  ('PROP00002','tarla 3'),('PROP00002','teren arabil'),('PROP00002','text file import'),
  ('PROP00003','tarla 3'),('PROP00003','teren arabil'),
  ('PROP00004','tarla 3'),('PROP00004','formă neregulată'),
  ('PROP00005','tarla 3'),('PROP00005','coproprietate marin-stoica'),
  ('PROP00008','tarla 5'),('PROP00008','marian ene'),('PROP00008','arendare'),
  ('PROP00011','pășune'),('PROP00011','tarla 5'),('PROP00011','coman'),
  ('PROP00013','intravilan'),('PROP00013','casă'),('PROP00013','str. independenței'),
  ('PROP00017','vilă'),('PROP00017','piscină'),('PROP00017','cumpărare 2022'),
  ('PROP00021','apartament'),('PROP00021','bloc 3'),
  ('PROP00027','lot nou'),('PROP00027','dezmembrare 2022'),
  ('PROP00034','vie'),('PROP00034','litigiu'),
  ('PROP00036','pășune'),('PROP00036','arendare'),('PROP00036','nord agro'),
  ('PROP00039','litigiu'),('PROP00039','tarla 3'),('PROP00039','dosar instanță'),
  ('DOC00001','titlu proprietate'),('DOC00001','1991'),('DOC00001','bragadiru'),
  ('DOC00009','contract vânzare'),('DOC00009','2022'),('DOC00009','notarial'),
  ('DOC00013','certificat moștenitor'),('DOC00013','succesiune 2019'),
  ('DOC00019','documentație cadastrală'),('DOC00019','topografie'),
  ('DOC00034','hotărâre judecătorească'),('DOC00034','câștig de cauză'),
  ('DOC00042','neidentificat'),('DOC00042','import 2019'),
  ('DOC00046','carte identitate'),('DOC00046','ocr'),('DOC00046','ai import'),
  ('DOC00050','testament'),('DOC00050','coman')
) AS v(code, tag)
JOIN principal_object po ON po.code = v.code;

-- =============================================================================
-- 22. ENTITY_CROSS_REFERENCE — informal "See Also" links
-- =============================================================================

INSERT INTO entity_cross_reference (id, source_principal_object_id, target_principal_object_id, relationship_note, created_at)
SELECT gen_random_uuid(), src.id, tgt.id, v.note, now()
FROM (VALUES
  ('PPERS00001','PROP00001','Proprietarul principal al parcelei T3-1. Titlu proprietate din 2005.'),
  ('PPERS00005','PROP00033','Proprietar confirmat prin titlu de proprietate.'),
  ('PPERS00023','JPERS00006','Același topograf — PFA și SRL cu același asociat.'),
  ('DOC00013','DOC00016','Certificatul de moștenitor este completat de extrasul CF pentru aceleași parcele.'),
  ('DOC00034','PROP00039','Hotărârea judecătorească privind parcel T3-10 — litigiu rezolvat.'),
  ('PPERS00027','DOC00050','Testamentul lui Augustin Coman îl numește pe Bogdan Ciobanu moștenitor.'),
  ('PROP00037','PROP00039','Parcele adiacente cu istorii cadastrale diferite. A se verifica granița.')
) AS v(src_code, tgt_code, note)
JOIN principal_object src ON src.code = v.src_code
JOIN principal_object tgt ON tgt.code = v.tgt_code;

-- =============================================================================
-- 23. ENTITY_PROVENANCE_LOG — a few historical provenance changes
-- =============================================================================

INSERT INTO entity_provenance_log (id, entity_metadata_id, method, logged_at, created_at)
SELECT gen_random_uuid(), em.id, v.old_method, v.logged_at::date, now()
FROM (VALUES
  ('PROP00001','MANUAL','2022-05-01'),
  ('PROP00002','MANUAL','2022-05-01'),
  ('PROP00003','MANUAL','2022-05-01'),
  ('PPERS00003','MANUAL','2022-03-05'),
  ('PPERS00009','MANUAL','2022-03-05'),
  ('DOC00042','MANUAL','2022-08-01'),
  ('DOC00043','MANUAL','2022-08-01')
) AS v(code, old_method, logged_at)
JOIN principal_object po ON po.code = v.code
JOIN entity_metadata em ON em.principal_object_id = po.id;

-- =============================================================================
-- 24. RESET SEQUENCES after seed data
-- principal_object_code_seq: we used codes not tied to the sequence, but set it high
-- group_code_seq: we inserted GRP-001 through GRP-012 (seq 1-12)
-- stamp_code_seq: we inserted STMP-AAA through STMP-AAG (seq 1-7)
-- =============================================================================

SELECT setval('principal_object_code_seq', 500);
SELECT setval('group_code_seq', 12);
SELECT setval('stamp_code_seq', 7);

COMMIT;


