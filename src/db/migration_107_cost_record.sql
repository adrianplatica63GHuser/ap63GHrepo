-- migration_107_cost_record.sql
-- Slice #39.17 - „Setări → Costuri": what each provider has cost, by period.
--
-- WHAT THIS DOES
--   Creates cost_record: one row per amount a provider charged (or is
--   expected to charge) for a period — a day of Google Maps, a month of a
--   plan, a year of a domain. The Costuri tiles add these up per month, draw
--   them over time and forecast the month's end.
--
-- WHO WRITES IT
--   Today only Adrian, from the tiles („Adaugă o sumă"): a bill's figure, a
--   plan's price, a domain's yearly fee — source 'entered'. The sources
--   'live' (read from a provider's billing interface) and 'counted' (worked
--   out from the application's own count, e.g. paid AI reads) are for the
--   collectors a later slice adds once a billing key exists; the constraint
--   names them now so that slice needs no migration.
--
-- THE AMOUNT AND ITS CURRENCY
--   Each amount is kept in the currency the provider bills (Google bills CA$,
--   Anthropic, Vercel and GitHub US$, the .ro registry EUR), with the CA$ rate
--   used at the time, so a total in CA$ never depends on today's rate.
--
-- NO FOREIGN KEY, NO USER
--   A cost belongs to the business, not to a record or an account.

BEGIN;

CREATE TABLE IF NOT EXISTS cost_record (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  amount       numeric(12, 2) NOT NULL,
  currency     text NOT NULL,
  cad_rate     numeric(12, 6) NOT NULL,
  source       text NOT NULL,
  note         text,
  entered_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_record_provider_check CHECK (provider ~ '^[a-z][a-z-]{1,39}$'),
  CONSTRAINT cost_record_period_check   CHECK (period_end >= period_start),
  CONSTRAINT cost_record_amount_check   CHECK (amount >= 0),
  CONSTRAINT cost_record_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT cost_record_rate_check     CHECK (cad_rate > 0),
  CONSTRAINT cost_record_source_check   CHECK (source IN ('live', 'counted', 'entered'))
);

CREATE INDEX IF NOT EXISTS cost_record_provider_period_idx ON cost_record (provider, period_start);

COMMIT;
