-- migration_009_fix_diacritics.sql
SET client_encoding = 'UTF8';
-- Repair Romanian diacritics in all lookup tables.
-- Root cause: rows were inserted when the DB connection was not set to UTF-8,
-- so multi-byte UTF-8 sequences were stored as latin1 mojibake.
-- Fix: UPDATE every affected row keyed on sort_order (names are corrupted).
-- Safe to run multiple times (idempotent UPDATEs).

-- ── lookup_property_type ─────────────────────────────────────────────────────
UPDATE lookup_property_type SET name = 'Teren Arabil'    WHERE sort_order = 1;
UPDATE lookup_property_type SET name = 'Teren Construit' WHERE sort_order = 2;
UPDATE lookup_property_type SET name = 'Liniară'         WHERE sort_order = 3;
UPDATE lookup_property_type SET name = 'Pășune'          WHERE sort_order = 4;
UPDATE lookup_property_type SET name = 'Apartament'      WHERE sort_order = 5;
UPDATE lookup_property_type SET name = 'Casă'            WHERE sort_order = 6;

-- ── lookup_use_category ──────────────────────────────────────────────────────
UPDATE lookup_use_category SET name = 'Arabil'      WHERE sort_order = 1;
UPDATE lookup_use_category SET name = 'Pășune'      WHERE sort_order = 2;
UPDATE lookup_use_category SET name = 'Fânețe'      WHERE sort_order = 3;
UPDATE lookup_use_category SET name = 'Vie'         WHERE sort_order = 4;
UPDATE lookup_use_category SET name = 'Livadă'      WHERE sort_order = 5;
UPDATE lookup_use_category SET name = 'Pădure'      WHERE sort_order = 6;
UPDATE lookup_use_category SET name = 'Ape'         WHERE sort_order = 7;
UPDATE lookup_use_category SET name = 'Neproductiv' WHERE sort_order = 8;

-- ── lookup_person_type ───────────────────────────────────────────────────────
UPDATE lookup_person_type SET name = 'Persoană Fizică'   WHERE sort_order = 1;
UPDATE lookup_person_type SET name = 'Persoană Juridică' WHERE sort_order = 2;
UPDATE lookup_person_type SET name = 'Expert'            WHERE sort_order = 3;
UPDATE lookup_person_type SET name = 'PFA'               WHERE sort_order = 4;
UPDATE lookup_person_type SET name = 'Instituție'        WHERE sort_order = 5;
UPDATE lookup_person_type SET name = 'ONG'               WHERE sort_order = 6;
UPDATE lookup_person_type SET name = 'Consiliu Local'    WHERE sort_order = 7;

-- ── lookup_citizenship ───────────────────────────────────────────────────────
UPDATE lookup_citizenship SET name = 'Română'     WHERE sort_order = 1;
UPDATE lookup_citizenship SET name = 'Moldoveană' WHERE sort_order = 2;
UPDATE lookup_citizenship SET name = 'Americană'  WHERE sort_order = 3;
UPDATE lookup_citizenship SET name = 'Germană'    WHERE sort_order = 4;
UPDATE lookup_citizenship SET name = 'Franceză'   WHERE sort_order = 5;
UPDATE lookup_citizenship SET name = 'Italiană'   WHERE sort_order = 6;
UPDATE lookup_citizenship SET name = 'Spaniolă'   WHERE sort_order = 7;
UPDATE lookup_citizenship SET name = 'Engleză'    WHERE sort_order = 8;

-- ── lookup_document_type ─────────────────────────────────────────────────────
UPDATE lookup_document_type SET name = 'Act de Adjudecare'            WHERE sort_order = 1;
UPDATE lookup_document_type SET name = 'Act Cadastru'                 WHERE sort_order = 2;
UPDATE lookup_document_type SET name = 'Autorizare'                   WHERE sort_order = 3;
UPDATE lookup_document_type SET name = 'Aviz de Instituție'           WHERE sort_order = 4;
UPDATE lookup_document_type SET name = 'Certificat Fiscal'            WHERE sort_order = 5;
UPDATE lookup_document_type SET name = 'Certificat de Macanentur'     WHERE sort_order = 6;
UPDATE lookup_document_type SET name = 'Certificat de Bunuri'         WHERE sort_order = 7;
UPDATE lookup_document_type SET name = 'Certificat de Urbanism'       WHERE sort_order = 8;
UPDATE lookup_document_type SET name = 'Contract de Arendă'           WHERE sort_order = 9;
UPDATE lookup_document_type SET name = 'Contract de Închiriere'       WHERE sort_order = 10;
UPDATE lookup_document_type SET name = 'Contract de Partaj'           WHERE sort_order = 11;
UPDATE lookup_document_type SET name = 'Contract de Prestări Servicii' WHERE sort_order = 12;
UPDATE lookup_document_type SET name = 'Contract de Vânzare'          WHERE sort_order = 13;
UPDATE lookup_document_type SET name = 'Extras din Carte Funciară'    WHERE sort_order = 14;
UPDATE lookup_document_type SET name = 'Extras din PUG'               WHERE sort_order = 15;
UPDATE lookup_document_type SET name = 'Hotărâre Judecătorească'      WHERE sort_order = 16;
UPDATE lookup_document_type SET name = 'Titlu de Proprietate'         WHERE sort_order = 17;

-- ── lookup_institution ───────────────────────────────────────────────────────
UPDATE lookup_institution SET name = 'OCPI',                   institution_type = 'Cadastru'                WHERE sort_order = 1;
UPDATE lookup_institution SET name = 'Primăria Municipiului',  institution_type = 'Administrație Locală'    WHERE sort_order = 2;
UPDATE lookup_institution SET name = 'Consiliu Județean',      institution_type = 'Administrație Județeană' WHERE sort_order = 3;
UPDATE lookup_institution SET name = 'ANAF',                   institution_type = 'Fiscal'                  WHERE sort_order = 4;
UPDATE lookup_institution SET name = 'Notariat',               institution_type = 'Juridic'                 WHERE sort_order = 5;
UPDATE lookup_institution SET name = 'Judecătorie',            institution_type = 'Juridic'                 WHERE sort_order = 6;
UPDATE lookup_institution SET name = 'Tribunal',               institution_type = 'Juridic'                 WHERE sort_order = 7;

-- ── lookup_service_interest ──────────────────────────────────────────────────
UPDATE lookup_service_interest SET name = 'Consultanță Juridică', category = 'Serviciu' WHERE sort_order = 1;
UPDATE lookup_service_interest SET name = 'Evaluare Imobiliară',  category = 'Serviciu' WHERE sort_order = 2;
UPDATE lookup_service_interest SET name = 'Mediere',              category = 'Serviciu' WHERE sort_order = 3;
UPDATE lookup_service_interest SET name = 'Topografie',           category = 'Serviciu' WHERE sort_order = 4;
UPDATE lookup_service_interest SET name = 'Cumpărare',            category = 'Interes'  WHERE sort_order = 5;
UPDATE lookup_service_interest SET name = 'Vânzare',              category = 'Interes'  WHERE sort_order = 6;
UPDATE lookup_service_interest SET name = 'Închiriere',           category = 'Interes'  WHERE sort_order = 7;
UPDATE lookup_service_interest SET name = 'Arendare',             category = 'Interes'  WHERE sort_order = 8;
