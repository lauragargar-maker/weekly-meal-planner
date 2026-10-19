-- The household's shopping list. docs/shopping-list-spec.md §3.7–§3.8 and §5.
--
-- One list per household (in progress or closed, §5.10): a new one replaces
-- the old. Its items are a frozen copy of what the menu needed when it was made
-- (D4) — names and sections are copied, not joined — plus what was added by
-- hand. Every member sees the same list and the same ticks, live.
--
-- RUN BEFORE MERGING THE FRONTEND, after 20261014000000_dish_shopping_ingredients.
-- It is additive: the app in production keeps working after it runs. Dev
-- first, then production.

-- ============================================================
-- 1. The list
-- ============================================================

CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  -- Days chosen that had a menu and went into the list.
  days DATE[] NOT NULL,
  -- Days chosen that had no menu, for the notice.
  skipped_days DATE[] NOT NULL DEFAULT '{}',
  -- Dishes in those days with no ingredients, or no longer in Platos.
  missing_dishes TEXT[] NOT NULL DEFAULT '{}',
  -- Hash of the menu and ingredients the list was made from (spec §5.7).
  fingerprint TEXT NOT NULL,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT shopping_lists_one_per_household UNIQUE (household_id),
  CONSTRAINT shopping_lists_has_days CHECK (cardinality(days) > 0)
);

-- ============================================================
-- 2. Its items
-- ============================================================

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  -- NULL for something added by hand that is not in the ingredient catalogue.
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  section TEXT NOT NULL CONSTRAINT shopping_list_items_section_allowed CHECK (section IN (
    'produce', 'meat', 'fish', 'deli', 'dairy_eggs', 'bakery',
    'grocery', 'frozen', 'drinks', 'household', 'other'
  )),
  origin TEXT NOT NULL CHECK (origin IN ('menu', 'manual')),
  -- [{ "dish": "Lentejas", "day": "2026-10-14", "meal": "lunch" }]; empty when manual.
  sources JSONB NOT NULL DEFAULT '[]',
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list_id ON shopping_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_household_id ON shopping_list_items(household_id);

-- ============================================================
-- 3. Row Level Security: every member manages their household's list
-- ============================================================

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage their household shopping list" ON shopping_lists;
CREATE POLICY "Members manage their household shopping list" ON shopping_lists
  FOR ALL TO authenticated
  USING (household_id = current_household_id())
  WITH CHECK (household_id = current_household_id());

DROP POLICY IF EXISTS "Members manage their household shopping list items" ON shopping_list_items;
CREATE POLICY "Members manage their household shopping list items" ON shopping_list_items
  FOR ALL TO authenticated
  USING (household_id = current_household_id())
  WITH CHECK (household_id = current_household_id());

-- ============================================================
-- 4. Realtime, so a tick on one phone shows on the others (spec §5.9)
-- ============================================================
--
-- Adding a table that is already in the publication is an error, so each one
-- is added only if missing; the migration can run twice.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shopping_lists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shopping_lists;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shopping_list_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shopping_list_items;
  END IF;
END $$;

-- ============================================================
-- 5. Verification — run separately, after the migration
-- ============================================================
--
-- Expect every column = 1.
--
-- SELECT
--   (SELECT count(*) FROM information_schema.tables WHERE table_name = 'shopping_lists')      AS lists,
--   (SELECT count(*) FROM information_schema.tables WHERE table_name = 'shopping_list_items') AS items,
--   (SELECT count(*) FROM pg_policies WHERE tablename = 'shopping_lists')                     AS lists_policy,
--   (SELECT count(*) FROM pg_policies WHERE tablename = 'shopping_list_items')                AS items_policy,
--   (SELECT count(*) FROM pg_publication_tables
--      WHERE pubname = 'supabase_realtime' AND tablename = 'shopping_lists')                  AS lists_realtime,
--   (SELECT count(*) FROM pg_publication_tables
--      WHERE pubname = 'supabase_realtime' AND tablename = 'shopping_list_items')             AS items_realtime;
