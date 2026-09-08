-- `dairy` ("Lácteos") joins the allowed main_ingredients.
--
-- It is a protein alongside meat, fish, egg and legume — the code says so in
-- INGREDIENT_GROUP and PROTEIN_AXIS — so "no repitas la proteína" now also
-- blocks cheese at lunch and cheese at dinner on the same day. Nothing in the
-- database encodes that; the axis lives in the frontend. All this migration does
-- is stop the CHECK from rejecting the value.
--
-- RUN BEFORE MERGING THE FRONTEND. Widening a CHECK is backward compatible, so
-- the old app keeps working after it runs — but the new app cannot save a dish
-- tagged Lácteos until it has, and the merge is the deploy. Dev first, then
-- production.
--
-- It neither inserts nor deletes rows. 'Provolone al horno' is added to
-- src/data/starterCatalog.ts, which is a template copied at onboarding: only
-- households created afterwards get it. Existing households keep exactly the
-- dishes they have, and can add it by hand from Platos.

-- ============================================================
-- 1. Drop the old allow-list CHECK, whatever Postgres named it
-- ============================================================
--
-- The constraint was created inline by `ADD COLUMN ... CHECK (...)` in
-- 20260804000000, so it carries an auto-generated name rather than one this repo
-- chose. Finding it by its definition beats guessing the name and silently
-- dropping nothing — which would leave 'dairy' rejected in a migration that
-- reported success.
--
-- The not-empty constraint from 20260807000000 is a different one and is left
-- alone: it never mentions 'legume'.

DO $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'dish_ideas'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%legume%'
    AND pg_get_constraintdef(oid) NOT LIKE '%dairy%';

  IF v_name IS NULL THEN
    -- Either this migration already ran, or the allow-list is not there at all.
    -- Only the first is acceptable.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'dish_ideas'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%dairy%'
    ) THEN
      RAISE EXCEPTION
        'No allow-list CHECK found on dish_ideas.main_ingredients. Run 20260804000000_dish_main_ingredients.sql first.';
    END IF;
  ELSE
    EXECUTE format('ALTER TABLE dish_ideas DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

-- ============================================================
-- 2. The same allow-list, plus 'dairy', under a name the repo owns
-- ============================================================

ALTER TABLE dish_ideas
  DROP CONSTRAINT IF EXISTS dish_ideas_main_ingredients_allowed;

ALTER TABLE dish_ideas
  ADD CONSTRAINT dish_ideas_main_ingredients_allowed
  CHECK (main_ingredients <@ ARRAY[
    'pasta', 'rice', 'potato', 'meat', 'fish', 'egg', 'legume', 'dairy', 'vegetable'
  ]::TEXT[]);

-- ============================================================
-- 3. Verification — run separately, after the migration
-- ============================================================
--
-- Supabase's SQL Editor shows result sets, not notices. Expect `allowed` = 1,
-- `stale` = 0 and `not_empty` = 1.
--
-- SELECT
--   (SELECT count(*) FROM pg_constraint
--      WHERE conrelid = 'dish_ideas'::regclass
--        AND conname = 'dish_ideas_main_ingredients_allowed')          AS allowed,
--   (SELECT count(*) FROM pg_constraint
--      WHERE conrelid = 'dish_ideas'::regclass AND contype = 'c'
--        AND pg_get_constraintdef(oid) LIKE '%legume%'
--        AND pg_get_constraintdef(oid) NOT LIKE '%dairy%')             AS stale,
--   (SELECT count(*) FROM pg_constraint
--      WHERE conname = 'dish_ideas_main_ingredients_not_empty')        AS not_empty;
