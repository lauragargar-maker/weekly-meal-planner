-- Migration: Add main_ingredient column to dish_ideas table
-- Run this in your Supabase SQL Editor to add the new column to existing databases

-- Add the main_ingredient column
ALTER TABLE dish_ideas 
ADD COLUMN IF NOT EXISTS main_ingredient TEXT CHECK (main_ingredient IN ('pasta', 'meat', 'fish', 'egg', 'legume', 'vegetable'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_dish_ideas_main_ingredient ON dish_ideas(main_ingredient);

-- Update existing dishes with main_ingredient values (optional - you can update these manually)
UPDATE dish_ideas SET main_ingredient = 'vegetable' WHERE name IN ('Caesar Salad', 'Minestrone Soup', 'Caprese Salad', 'Gazpacho', 'Vegetable Stir Fry', 'Vegetarian Burger');
UPDATE dish_ideas SET main_ingredient = 'pasta' WHERE name IN ('Pasta Carbonara', 'Risotto', 'Lasagna');
UPDATE dish_ideas SET main_ingredient = 'meat' WHERE name IN ('Grilled Chicken Breast', 'Beef Steak', 'Pork Chops', 'Chicken Curry', 'Chicken Wrap');
UPDATE dish_ideas SET main_ingredient = 'fish' WHERE name IN ('Salmon Fillet', 'Fish Tacos', 'Poke Bowl');
UPDATE dish_ideas SET main_ingredient = 'egg' WHERE name IN ('Quiche Lorraine');
UPDATE dish_ideas SET main_ingredient = 'legume' WHERE name IN ('Bruschetta', 'Falafel Bowl');

