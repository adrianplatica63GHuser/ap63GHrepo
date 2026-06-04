-- Migration 011 — Rename lookup_service_interest → lookup_others
--
-- The table previously held only "Serviciu" and "Interes" categories.
-- It now serves as a general-purpose "others" bucket; "Grup" (Groups) and
-- "Stampila" (Stamps) categories are added alongside the existing two.
--
-- Triggers attached to lookup_service_interest are automatically preserved
-- by PostgreSQL on table rename — no trigger changes required.

ALTER TABLE lookup_service_interest RENAME TO lookup_others;
