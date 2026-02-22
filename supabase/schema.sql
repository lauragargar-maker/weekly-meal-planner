-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Dish Ideas table
CREATE TABLE IF NOT EXISTS dish_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('starter', 'main', 'single')),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('lunch', 'dinner', 'both')),
  main_ingredient TEXT CHECK (main_ingredient IN ('pasta', 'meat', 'fish', 'egg', 'legume', 'vegetable')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly Menus table
CREATE TABLE IF NOT EXISTS weekly_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  menu_items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(week_start)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_dish_ideas_category ON dish_ideas(category);
CREATE INDEX IF NOT EXISTS idx_dish_ideas_meal_type ON dish_ideas(meal_type);
CREATE INDEX IF NOT EXISTS idx_dish_ideas_main_ingredient ON dish_ideas(main_ingredient);
CREATE INDEX IF NOT EXISTS idx_weekly_menus_week_start ON weekly_menus(week_start);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_dish_ideas_updated_at BEFORE UPDATE ON dish_ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_menus_updated_at BEFORE UPDATE ON weekly_menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE dish_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menus ENABLE ROW LEVEL SECURITY;

-- Policies for dish_ideas (readable by all authenticated users, writable by admins)
CREATE POLICY "Anyone can view dish ideas" ON dish_ideas
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert dish ideas" ON dish_ideas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can update dish ideas" ON dish_ideas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can delete dish ideas" ON dish_ideas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policies for weekly_menus (readable and writable by anyone - public access)
CREATE POLICY "Anyone can view weekly menus" ON weekly_menus
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert weekly menus" ON weekly_menus
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update weekly menus" ON weekly_menus
  FOR UPDATE USING (true);

-- Insert sample dish ideas (for initial setup)
INSERT INTO dish_ideas (name, category, meal_type, main_ingredient) VALUES
  -- Starters
  ('Caesar Salad', 'starter', 'both', 'vegetable'),
  ('Minestrone Soup', 'starter', 'lunch', 'vegetable'),
  ('Bruschetta', 'starter', 'both', 'vegetable'),
  ('Caprese Salad', 'starter', 'lunch', 'vegetable'),
  ('Gazpacho', 'starter', 'lunch', 'vegetable'),
  
  -- Main courses
  ('Grilled Chicken Breast', 'main', 'both', 'meat'),
  ('Pasta Carbonara', 'main', 'both', 'pasta'),
  ('Salmon Fillet', 'main', 'both', 'fish'),
  ('Beef Steak', 'main', 'both', 'meat'),
  ('Vegetable Stir Fry', 'main', 'both', 'vegetable'),
  ('Pork Chops', 'main', 'dinner', 'meat'),
  ('Fish Tacos', 'main', 'dinner', 'fish'),
  ('Risotto', 'main', 'dinner', 'pasta'),
  ('Lasagna', 'main', 'dinner', 'pasta'),
  ('Chicken Curry', 'main', 'dinner', 'meat'),
  
  -- Single course meals
  ('Quiche Lorraine', 'single', 'lunch', 'egg'),
  ('Chicken Wrap', 'single', 'lunch', 'meat'),
  ('Vegetarian Burger', 'single', 'lunch', 'vegetable'),
  ('Falafel Bowl', 'single', 'lunch', 'legume'),
  ('Poke Bowl', 'single', 'lunch', 'fish')
ON CONFLICT DO NOTHING;

