-- Every dish must declare at least one ingredient.
--
-- The app already enforces this (AddDishModal will not save without one, and
-- both the seed catalogue and the onboarding always supply them), so this is
-- the guarantee underneath: a dish with no ingredients is invisible to every
-- rule — it can never be the fish of the week or the vegetable of a dinner —
-- while still counting towards the catalogue's totals, so a household is told
-- it has enough dishes and then gets a menu that ignores what it asked for.
--
-- RUN AFTER 20260804000000_dish_main_ingredients.sql, and after cleaning up any
-- dish left with an empty array. Production came out clean from that migration;
-- dev did not, because it holds hand-made test dishes that were never labelled.
--
-- To find them:
--
--   SELECT h.name AS hogar, d.id, d.name
--   FROM dish_ideas d JOIN households h ON h.id = d.household_id
--   WHERE cardinality(d.main_ingredients) = 0
--   ORDER BY h.name, d.name;
--
-- Then either label them (preferred — the app can do it: Platos → el plato →
-- marcar ingredientes) or delete them if they were throwaway test data.

-- ============================================================
-- 1. Refuse to run against dirty data, with a message that says which dishes
-- ============================================================
--
-- Without this the ALTER below still fails, but with Postgres's own wording,
-- which names the constraint and not the rows. This names the rows.

DO $$
DECLARE
  v_offenders TEXT;
  v_count INTEGER;
BEGIN
  SELECT count(*), string_agg(name, ', ' ORDER BY name)
    INTO v_count, v_offenders
  FROM dish_ideas
  WHERE cardinality(main_ingredients) = 0;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Cannot require ingredients: % dish(es) still have none (%). Label or delete them first; see the query at the top of this file.',
      v_count, v_offenders;
  END IF;
END $$;

-- ============================================================
-- 2. The constraint
-- ============================================================
--
-- Separate from the CHECK added in 20260804000000, which restricts WHICH
-- ingredients are allowed. This one is about there being any at all, and keeping
-- them apart means a violation says which of the two rules was broken.

ALTER TABLE dish_ideas
  ADD CONSTRAINT dish_ideas_main_ingredients_not_empty
  CHECK (cardinality(main_ingredients) > 0);

-- ============================================================
-- 3. Verification — run separately, after the migration
-- ============================================================
--
-- Supabase's SQL Editor shows result sets, not notices. Expect `constraint` = 1
-- and `empty_dishes` = 0.
--
-- SELECT
--   (SELECT count(*) FROM pg_constraint
--      WHERE conname = 'dish_ideas_main_ingredients_not_empty')     AS constraint,
--   (SELECT count(*) FROM dish_ideas
--      WHERE cardinality(main_ingredients) = 0)                     AS empty_dishes;
