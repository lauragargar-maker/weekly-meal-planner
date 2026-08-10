-- The redesigned feedback sheet (specs/feedback-button.md) sends three things
-- besides the message: what kind of feedback it is, which of the three screens
-- the user was on, and which build of the app they were running. All three were
-- being crammed into the free-text `context` column, which made them impossible
-- to filter on when reviewing feedback from the SQL Editor.
--
-- The three columns are NULLABLE on purpose: the frontend in production today
-- writes only `message` and `context`, so this migration can be run before the
-- PR is merged without breaking it. Old rows keep their NULLs.

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS type TEXT
    CHECK (type IS NULL OR type IN ('bug', 'idea', 'otro'));

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS screen TEXT;

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS app_version TEXT;

-- `context` stays for the rows that already used it. Nothing writes it anymore.
COMMENT ON COLUMN feedback.context IS
  'Superseded by screen and app_version (migration 20260810000000). Kept for old rows.';

-- The INSERT policy checks household_id and user_id only, so it already covers
-- the new columns; no policy change is needed.

-- ============================================================
-- Verification — run separately, after the migration
-- ============================================================
--
-- Supabase's SQL Editor shows result sets, not notices. Expect `new_columns` = 3
-- and `type_constraint` = 1.
--
-- SELECT
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_name = 'feedback'
--        AND column_name IN ('type', 'screen', 'app_version'))  AS new_columns,
--   (SELECT count(*) FROM pg_constraint
--      WHERE conrelid = 'feedback'::regclass
--        AND pg_get_constraintdef(oid) ILIKE '%idea%')          AS type_constraint;
