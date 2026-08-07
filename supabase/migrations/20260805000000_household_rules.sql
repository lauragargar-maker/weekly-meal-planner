-- Each household configures how its menus are generated.
--
-- Everything here was hardcoded in src/utils/menuGenerator.ts, which is fine for
-- one family and wrong for fifteen: the interviews turned up two households with
-- opposite needs (always one dish vs. always a starter and a main), and the
-- generator was choosing at random between them.
--
-- A JSONB column rather than a table: it is one row per household, it is always
-- read together with the household, and no query ever needs to filter by it. A
-- separate table would duplicate the RLS policies for nothing.
--
-- The shape and the meaning of each field live in src/lib/householdRules.ts.
-- Nothing is enforced here on purpose: parseRules() falls back per field, so a
-- rule added later reaches existing rows as its default instead of needing a
-- migration to backfill it.

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{}'::JSONB;

-- Existing households keep today's behaviour by inheriting the defaults, with
-- two documented exceptions (see docs/beta-plan.md, block B and block C):
--
--   * legumeMinLunches becomes a MINIMUM. The generator used to demand exactly
--     one legume lunch and reject a week with two.
--   * noRepeatProtein is on, where only fish and egg were cross-checked before.
--     Their weeks will come out different. Accepted deliberately: it is what
--     both interviewees asked for.
--
-- An empty object is a household on defaults, which is what every existing row
-- becomes. Writing the defaults out explicitly would freeze today's values into
-- the data and stop a future change to DEFAULT_RULES from reaching them.

COMMENT ON COLUMN households.rules IS
  'Menu generation rules. Shape in src/lib/householdRules.ts; {} means defaults.';
