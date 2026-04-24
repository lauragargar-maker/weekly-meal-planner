-- Add day_type column to dish_ideas
ALTER TABLE dish_ideas
  ADD COLUMN IF NOT EXISTS day_type TEXT NOT NULL DEFAULT 'anyday'
    CHECK (day_type IN ('weekday', 'weekendday', 'anyday'));

-- Set Tacos as weekendday
UPDATE dish_ideas
  SET day_type = 'weekendday'
  WHERE name ILIKE '%tacos%';

-- All other dishes stay as 'anyday' (the default)
