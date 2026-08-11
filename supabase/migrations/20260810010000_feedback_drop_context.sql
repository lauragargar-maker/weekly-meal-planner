-- Drops `feedback.context`, replaced by `screen` and `app_version` in
-- 20260810000000.
--
-- The column was filled with `window.location.pathname`, and the app has no
-- router: every view is React state served from the root, so every row said "/"
-- and the column distinguished nothing. Confirmed empty in dev and in
-- production before writing this (Laura, 2026-08-10).
--
-- ============================================================
-- ORDER: this one runs AFTER the merge, not before
-- ============================================================
--
-- The opposite of its sibling. 20260810000000 only adds nullable columns, so it
-- is safe to run while the old frontend is still live. This one takes a column
-- away that **the frontend in production still writes on every insert**
-- (`FeedbackButton.tsx`), so running it early makes PostgREST reject the insert
-- and nobody can send feedback until the deploy lands.
--
-- So: run 20260810000000 → merge the PR (which is the deploy) → check that a
-- feedback message goes through → and only then run this file.
--
-- Dropping is not reversible. Re-adding the column would bring it back empty.

-- Check before dropping — expect 0. Run it on its own; the SQL Editor shows
-- result sets, not notices.
--
-- SELECT count(*) AS rows_with_context FROM feedback
--   WHERE context IS NOT NULL AND trim(context) <> '';

ALTER TABLE feedback DROP COLUMN IF EXISTS context;

-- ============================================================
-- Verification — run separately, after the migration
-- ============================================================
--
-- Expect `context_left` = 0.
--
-- SELECT count(*) AS context_left FROM information_schema.columns
--   WHERE table_name = 'feedback' AND column_name = 'context';
