-- migration_109_skill_attempt.sql
-- Slice #39.41 - the skills' progress: every quiz attempt, per user.
--
-- WHAT THIS DOES
--   Creates skill_attempt: one row per quiz a user finished — which skill,
--   which variant of its quiz, the questions asked and the answers given, how
--   many were right, and whether that passed. Nothing else about progress is
--   stored. Closed / Open / Mastered / Obsolete, a Path's mastery and when a
--   failed quiz opens again are COMPUTED from these rows by
--   src/lib/skills/progress.ts, so a revised skills catalogue can never leave a
--   stale state behind: a skill renumbered keeps its attempts (they are stored
--   against its key, which never changes), a skill removed has them ignored.
--
-- THE USER
--   user_id is the id the application already keys a caller on
--   (getCurrentUser().id): the Supabase Auth user id, or 'uat-no-auth' on a box
--   that runs without accounts — which is Ciprian's, and he is the one who will
--   take the quizzes. So there is no foreign key to app_users: that box has no
--   rows there. 'anonymous' (no session) is refused.
--
-- PASSED IS THE 80 % RULE, AND THE DATABASE HOLDS IT TOO
--   Passing is at least 80 %: ceil(0.8 x n) right out of n, 8 of 10. The
--   server decides it (the browser never does); the CHECK below says the same
--   in integers — 5 x correct >= 4 x n — so no row can claim a pass the rule
--   does not give.
--
-- WHO WRITES IT
--   Only the server's recordAttempt() (src/lib/skills/attempts.ts), called by
--   the quiz page's scoring (#39.43). Starting over is a script, not a button:
--   npm run skills:reset-progress.

BEGIN;

CREATE TABLE IF NOT EXISTS skill_attempt (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        text NOT NULL,
  skill_key      text NOT NULL,
  quiz_variant   text NOT NULL,
  items          jsonb NOT NULL,
  question_count integer NOT NULL,
  correct_count  integer NOT NULL,
  passed         boolean NOT NULL,
  started_at     timestamptz NOT NULL,
  finished_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_attempt_user_check     CHECK (user_id <> '' AND user_id <> 'anonymous'),
  CONSTRAINT skill_attempt_skill_check    CHECK (skill_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT skill_attempt_variant_check  CHECK (quiz_variant ~ '^[a-z0-9-]{1,40}$'),
  CONSTRAINT skill_attempt_items_check    CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) = question_count),
  CONSTRAINT skill_attempt_count_check    CHECK (question_count > 0 AND correct_count >= 0 AND correct_count <= question_count),
  CONSTRAINT skill_attempt_passed_check   CHECK (passed = (correct_count * 5 >= question_count * 4)),
  CONSTRAINT skill_attempt_time_check     CHECK (finished_at >= started_at)
);

CREATE INDEX IF NOT EXISTS skill_attempt_user_idx ON skill_attempt (user_id, skill_key, finished_at);

COMMIT;
