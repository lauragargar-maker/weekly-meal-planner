-- A dish gets several ingredients instead of one, and the list grows with the
-- two carbs that were missing.
--
-- `main_ingredient` was a single value, so a lasagna could be pasta OR meat but
-- never both, and the same-day rules never saw the half that was left out. Rice
-- and potato did not exist at all, so "arroz con pollo" was filed as meat and
-- the "don't repeat the carb" rule could not see it.
--
-- BEFORE RUNNING: check how many dishes are unlabelled, since an unlabelled dish
-- is invisible to every rule and this migration cannot invent a value for it:
--
--   SELECT count(*) FROM dish_ideas WHERE main_ingredient IS NULL;
--
-- They come through as an empty array; the notice at the end of this migration
-- reports how many there were.
--
-- This runs while a single household exists. Relabelling by name is only safe
-- while that is true — once families have renamed and edited their own dishes,
-- a by-name UPDATE stops being a patch and becomes a guess.
--
-- DEPLOY TOGETHER WITH THE FRONTEND. The two are not compatible in either
-- direction: the old app writes `main_ingredient`, which this migration drops,
-- and the new app writes `main_ingredients`, which does not exist until it runs.
-- Whichever goes first, saving a dish fails until the other lands.
--
-- It neither inserts nor deletes rows. Dishes added to or removed from
-- src/data/starterCatalog.ts only affect households created afterwards; existing
-- households keep exactly the dishes they have.

-- ============================================================
-- 1. New column
-- ============================================================

ALTER TABLE dish_ideas
  ADD COLUMN IF NOT EXISTS main_ingredients TEXT[] NOT NULL DEFAULT '{}'
    CHECK (main_ingredients <@ ARRAY[
      'pasta', 'rice', 'potato', 'meat', 'fish', 'egg', 'legume', 'vegetable'
    ]::TEXT[]);

-- ============================================================
-- 2. Backfill: every dish keeps what it had, as a one-element array
-- ============================================================

UPDATE dish_ideas
  SET main_ingredients = ARRAY[main_ingredient]
  WHERE main_ingredient IS NOT NULL
    AND cardinality(main_ingredients) = 0;

-- ============================================================
-- 3. Data patch: the starter-catalogue dishes get their real ingredients
-- ============================================================
--
-- Only rows that still hold the single value the backfill produced are touched
-- (an empty array counts, so unlabelled dishes are reachable), which leaves a
-- dish somebody already edited by hand alone.
--
-- The names are the ones IN THE DATABASE, and they are NOT the names in
-- src/data/starterCatalog.ts. Verified against both environments on 2026-08-05:
-- production is a hand-built family catalogue that barely overlaps with the seed
-- template (3 names of 17), while dev holds several seeded test households plus
-- leftovers from the original English sample data. Hence three blocks below.
--
-- Sauces and garnishes are deliberately absent: the tomato in "bacalao con
-- tomate" is not a serving of vegetables, and tagging it as one would let a
-- household believe the vegetable rule was met when it wasn't.
--
-- To re-verify before running, in each environment:
--
--   SELECT name, main_ingredient FROM dish_ideas ORDER BY name;
--
-- The notice at the end reports rows actually touched. A name that exists in
-- neither environment is a harmless no-op.

DO $$
DECLARE
  patch RECORD;
  v_patched INTEGER := 0;
  v_rows INTEGER;
BEGIN
  FOR patch IN
    SELECT * FROM (VALUES
      -- ---- Block A: seed-template names ----
      -- Cover dev's seeded households, and three of them exist in production too
      -- (Arroz a la cubana, Ensalada de pasta, Tortilla de patatas).
      ('Judías verdes con patata',      ARRAY['vegetable', 'potato']),
      ('Ensaladilla rusa',              ARRAY['vegetable', 'potato']),
      ('Estofado de ternera',           ARRAY['vegetable', 'meat', 'potato']),
      ('Tortilla de patatas',           ARRAY['egg', 'potato']),
      ('Revuelto de champiñones',       ARRAY['vegetable', 'egg']),
      -- Was 'pasta': banned from dinner as if it were pasta, and a pasta
      -- frequency rule would have counted it.
      ('Arroz a la cubana',             ARRAY['rice', 'egg']),
      ('Paella mixta',                  ARRAY['meat', 'rice']),
      ('Fideuá',                        ARRAY['fish', 'pasta']),
      ('Lentejas con verduras',         ARRAY['vegetable', 'legume']),
      -- Renamed to "Cocido" for new households.
      ('Cocido de garbanzos',           ARRAY['meat', 'legume']),
      ('Fabada asturiana',              ARRAY['meat', 'legume']),
      ('Garbanzos con espinacas',       ARRAY['vegetable', 'legume']),
      ('Judías pintas con arroz',       ARRAY['rice', 'legume']),
      ('Arroz con pollo',               ARRAY['meat', 'rice']),
      ('Lasaña de carne',               ARRAY['meat', 'pasta']),
      ('Ensalada de pasta',             ARRAY['vegetable', 'pasta']),
      ('Guiso de patatas con costillas', ARRAY['meat', 'potato']),

      -- ---- Block B: production's own names ----
      -- Hand-built dishes that never came from the template.
      -- Tagged 'pasta' but it is rice. Present in both environments.
      ('Risotto',                       ARRAY['rice']),
      -- Tagged 'meat', with the rice missing entirely.
      ('Paella',                        ARRAY['rice', 'meat']),
      ('Lasaña casera',                 ARRAY['pasta', 'meat']),
      ('Macarrones con chistorra',      ARRAY['pasta', 'meat']),
      ('Spaguetti boloñesa',            ARRAY['pasta', 'meat']),
      -- Plain "Cocido" in both environments; the template calls it
      -- "Cocido de garbanzos", so block A never reaches it.
      ('Cocido',                        ARRAY['meat', 'legume']),
      -- Was NULL in production: unlabelled means invisible to every rule.
      ('Espinacas con bechamel',        ARRAY['vegetable']),
      -- Tagged 'pasta', but they are potato and the household counts them as such.
      ('Ñoquis',                        ARRAY['potato']),
      -- Tagged 'pasta'; the pastry is not pasta and the filling is what counts.
      ('Empanadas Malvón',              ARRAY['meat']),
      -- Plain "Lentejas" in both environments, cooked with vegetables.
      ('Lentejas',                      ARRAY['vegetable', 'legume']),

      -- ---- Block C: dev-only ----
      -- These two do exist, in dev, which is why they are back: they were
      -- dropped when production turned out not to have them.
      ('Marmitako de atún',             ARRAY['fish', 'potato']),
      ('Pisto con arroz',               ARRAY['vegetable', 'rice']),
      -- NULL in dev.
      ('Papas con mojo picón',          ARRAY['potato']),
      -- Two rows, one tagged 'vegetable' and one 'legume'; neither is right.
      ('Patatas a lo pobre',            ARRAY['potato', 'vegetable']),
      ('Huevos fritos con bacon',       ARRAY['meat', 'egg'])
    ) AS t(name, ingredients)
  LOOP
    UPDATE dish_ideas
      SET main_ingredients = patch.ingredients
      WHERE name = patch.name
        AND cardinality(main_ingredients) <= 1;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_patched := v_patched + v_rows;
  END LOOP;

  -- Counted from the 2026-08-05 inventory: ~123 rows in dev (six or seven seeded
  -- households, so several rows per name) and exactly 13 in production. A number
  -- far below that means the names have drifted and the list needs rechecking.
  --
  -- Supabase's SQL Editor does NOT display RAISE NOTICE — it shows result sets
  -- only. Run the verification query at the end of this file instead; psql or the
  -- Supabase CLI do show notices, if you happen to be using them.
  RAISE NOTICE 'Relabelled % dish row(s) from % names in the patch list.', v_patched, 32;
END $$;

-- ============================================================
-- 4. Retire the old column
-- ============================================================
--
-- The client loads every dish of the household and filters in JS, so the index
-- was never used for a lookup.

DO $$
DECLARE
  v_unlabelled INTEGER;
BEGIN
  SELECT count(*) INTO v_unlabelled FROM dish_ideas WHERE cardinality(main_ingredients) = 0;
  IF v_unlabelled > 0 THEN
    RAISE NOTICE '% dish(es) have no ingredients and are invisible to every rule. Review them in the app.', v_unlabelled;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_dish_ideas_main_ingredient;

ALTER TABLE dish_ideas DROP COLUMN IF EXISTS main_ingredient;

-- ============================================================
-- 5. Verification — run this separately, after the migration
-- ============================================================
--
-- Stands in for the notices above, which Supabase's SQL Editor does not show.
-- `patched` counts rows whose ingredients now match exactly what the patch list
-- intended, so it is the same number the notice would have reported.
--
-- WITH patch(name, ingredients) AS (VALUES
--   ('Judías verdes con patata', ARRAY['vegetable','potato']),
--   ('Ensaladilla rusa', ARRAY['vegetable','potato']),
--   ('Estofado de ternera', ARRAY['vegetable','meat','potato']),
--   ('Tortilla de patatas', ARRAY['egg','potato']),
--   ('Revuelto de champiñones', ARRAY['vegetable','egg']),
--   ('Arroz a la cubana', ARRAY['rice','egg']),
--   ('Paella mixta', ARRAY['meat','rice']),
--   ('Fideuá', ARRAY['fish','pasta']),
--   ('Lentejas con verduras', ARRAY['vegetable','legume']),
--   ('Cocido de garbanzos', ARRAY['meat','legume']),
--   ('Fabada asturiana', ARRAY['meat','legume']),
--   ('Garbanzos con espinacas', ARRAY['vegetable','legume']),
--   ('Judías pintas con arroz', ARRAY['rice','legume']),
--   ('Arroz con pollo', ARRAY['meat','rice']),
--   ('Lasaña de carne', ARRAY['meat','pasta']),
--   ('Ensalada de pasta', ARRAY['vegetable','pasta']),
--   ('Guiso de patatas con costillas', ARRAY['meat','potato']),
--   ('Risotto', ARRAY['rice']),
--   ('Paella', ARRAY['rice','meat']),
--   ('Lasaña casera', ARRAY['pasta','meat']),
--   ('Macarrones con chistorra', ARRAY['pasta','meat']),
--   ('Spaguetti boloñesa', ARRAY['pasta','meat']),
--   ('Cocido', ARRAY['meat','legume']),
--   ('Espinacas con bechamel', ARRAY['vegetable']),
--   ('Ñoquis', ARRAY['potato']),
--   ('Empanadas Malvón', ARRAY['meat']),
--   ('Lentejas', ARRAY['vegetable','legume']),
--   ('Marmitako de atún', ARRAY['fish','potato']),
--   ('Pisto con arroz', ARRAY['vegetable','rice']),
--   ('Papas con mojo picón', ARRAY['potato']),
--   ('Patatas a lo pobre', ARRAY['potato','vegetable']),
--   ('Huevos fritos con bacon', ARRAY['meat','egg'])
-- )
-- SELECT
--   (SELECT count(*) FROM dish_ideas d JOIN patch p ON p.name = d.name
--      WHERE d.main_ingredients = p.ingredients)                         AS patched,
--   (SELECT count(*) FROM dish_ideas)                                    AS total_dishes,
--   (SELECT count(*) FROM dish_ideas
--      WHERE cardinality(main_ingredients) = 0)                          AS unlabelled,
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_name = 'dish_ideas' AND column_name = 'main_ingredient') AS old_column_left;
