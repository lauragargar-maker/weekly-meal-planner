-- Recipe links may be any web address, not only https ones.
-- docs/shopping-list-spec.md §4.2.
--
-- Households want to link a file in their Google Drive or a family blog on
-- plain http. The frontend adds https:// when a link is pasted without it, so
-- this only has to let http through as well. Anything else — `javascript:`,
-- `data:` — stays out: the link becomes an href in the dish sheet, and those
-- would run code for whoever opens it.
--
-- Run after 20261014000000_dish_shopping_ingredients.sql. Widening a CHECK is
-- backward compatible. Dev first, then production.

ALTER TABLE dish_ideas DROP CONSTRAINT IF EXISTS dish_ideas_recipe_url_valid;
ALTER TABLE dish_ideas
  ADD CONSTRAINT dish_ideas_recipe_url_valid
  CHECK (recipe_url IS NULL OR (recipe_url ~* '^https?://' AND char_length(recipe_url) <= 500));

-- Verification — run separately. Expect `allows_http` = true.
--
-- SELECT pg_get_constraintdef(oid) LIKE '%https?%' AS allows_http
-- FROM pg_constraint WHERE conname = 'dish_ideas_recipe_url_valid';
