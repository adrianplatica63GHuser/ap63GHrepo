-- migration_100_ai_paid_read.sql
-- Slice #38.40 - „Setări → AI" counts this month's paid reads.
--
-- WHAT THIS DOES
--   Creates ai_paid_read: one row per answer the application received from
--   the Anthropic Messages API — which route asked, with which model, when,
--   and whether it succeeded. Nothing recorded the reads before, so the count
--   starts when this ships; „Setări" says „din <data>", the first row's date.
--
-- WHO WRITES IT
--   recordPaidRead (src/lib/ai/paid-reads.ts), called after every Messages
--   call: ai-interpret, the doc-type engine's read-sample and cluster, the
--   import's scan-folder and extract-id-card. A network failure that never
--   reached the API is not a read and writes nothing. A write that fails is
--   logged and never fails the read it records.
--
-- NO FOREIGN KEY, NO USER
--   A read is counted, not attributed: the screen shows a number for the
--   month. The route is text so a renamed route keeps its history readable.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_paid_read (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route   text NOT NULL,
  model   text NOT NULL,
  success boolean NOT NULL,
  at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_paid_read_at_idx ON ai_paid_read (at);

COMMIT;
