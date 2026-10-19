-- Shopping ingredients per dish, and a recommended recipe link.
-- docs/shopping-list-spec.md §3.1–§3.4 and §3.9.
--
-- These are NOT `main_ingredients` (Verdura, Carne, Pasta…), which feed the
-- generator's rules and are left untouched. These are what has to be in the
-- kitchen to cook the dish — "Chuletas de cerdo", "Cebolla", "Sal" — and they
-- are what the shopping list is built from.
--
-- The shopping list's own tables (shopping_lists, shopping_list_items) come in
-- a later migration, with the PR that uses them.
--
-- RUN BEFORE MERGING THE FRONTEND. Everything here is additive, so the app
-- already in production keeps working after it runs; the new app cannot load
-- the Platos screen until it has. Dev first, then production.
--
-- It inserts no rows: the starter ingredients are seeded from the frontend
-- (spec §6.2), from src/data/starterIngredients.ts.

-- ============================================================
-- 1. The household's ingredient catalogue
-- ============================================================

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  -- toKey(name) from src/lib/nameKey.ts: lower case, no accents (ñ kept),
  -- single spaces. Computed by the frontend so the two can never disagree.
  name_key TEXT NOT NULL CHECK (char_length(name_key) BETWEEN 1 AND 40),
  section TEXT NOT NULL DEFAULT 'other' CONSTRAINT ingredients_section_allowed CHECK (section IN (
    'produce', 'meat', 'fish', 'deli', 'dairy_eggs', 'bakery',
    'grocery', 'frozen', 'drinks', 'household', 'other'
  )),
  -- "Básico de casa": always at home, never on the shopping list.
  is_staple BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT ingredients_household_name_key_unique UNIQUE (household_id, name_key)
);

CREATE INDEX IF NOT EXISTS idx_ingredients_household_id ON ingredients(household_id);

DROP TRIGGER IF EXISTS update_ingredients_updated_at ON ingredients;
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. Which ingredients each dish takes
-- ============================================================

CREATE TABLE IF NOT EXISTS dish_ingredients (
  dish_id UUID NOT NULL REFERENCES dish_ideas(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (dish_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_dish_ingredients_household_id ON dish_ingredients(household_id);
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_ingredient_id ON dish_ingredients(ingredient_id);

-- ============================================================
-- 3. Recipe link on the dish, and the two household flags
-- ============================================================

ALTER TABLE dish_ideas ADD COLUMN IF NOT EXISTS recipe_url TEXT;

ALTER TABLE dish_ideas DROP CONSTRAINT IF EXISTS dish_ideas_recipe_url_valid;
ALTER TABLE dish_ideas
  ADD CONSTRAINT dish_ideas_recipe_url_valid
  CHECK (recipe_url IS NULL OR (recipe_url ~ '^https://' AND char_length(recipe_url) <= 500));

-- When the starter ingredients were applied to this household (spec §6.2).
ALTER TABLE households ADD COLUMN IF NOT EXISTS ingredients_seeded_at TIMESTAMP WITH TIME ZONE;
-- When the household went through the guided "what does each dish take" flow (spec §5.3).
ALTER TABLE households ADD COLUMN IF NOT EXISTS shopping_guide_seen_at TIMESTAMP WITH TIME ZONE;

-- Members can rename their household already; the new flags are written through
-- that same UPDATE policy, so no new policy is needed on `households`.

-- ============================================================
-- 4. Row Level Security: every member manages their household's rows
-- ============================================================

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage their household ingredients" ON ingredients;
CREATE POLICY "Members manage their household ingredients" ON ingredients
  FOR ALL TO authenticated
  USING (household_id = current_household_id())
  WITH CHECK (household_id = current_household_id());

DROP POLICY IF EXISTS "Members manage their household dish ingredients" ON dish_ingredients;
CREATE POLICY "Members manage their household dish ingredients" ON dish_ingredients
  FOR ALL TO authenticated
  USING (household_id = current_household_id())
  WITH CHECK (household_id = current_household_id());

-- ============================================================
-- 5. Verification — run separately, after the migration
-- ============================================================
--
-- Supabase's SQL Editor shows result sets, not notices. Expect every column = 1.
--
-- SELECT
--   (SELECT count(*) FROM information_schema.tables
--      WHERE table_name = 'ingredients')                                   AS ingredients,
--   (SELECT count(*) FROM information_schema.tables
--      WHERE table_name = 'dish_ingredients')                              AS dish_ingredients,
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_name = 'dish_ideas' AND column_name = 'recipe_url')     AS recipe_url,
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_name = 'households' AND column_name = 'ingredients_seeded_at') AS seeded_at,
--   (SELECT count(*) FROM information_schema.columns
--      WHERE table_name = 'households' AND column_name = 'shopping_guide_seen_at') AS guide_seen_at,
--   (SELECT count(*) FROM pg_policies
--      WHERE tablename = 'ingredients')                                     AS ingredients_policy,
--   (SELECT count(*) FROM pg_policies
--      WHERE tablename = 'dish_ingredients')                                AS dish_ingredients_policy;
