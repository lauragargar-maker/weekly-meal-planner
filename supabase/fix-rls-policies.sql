-- Fix RLS Policies to Allow Anonymous Access
-- Run this in your Supabase SQL Editor

-- Drop existing policies for weekly_menus
DROP POLICY IF EXISTS "Anyone can view weekly menus" ON weekly_menus;
DROP POLICY IF EXISTS "Authenticated users can insert weekly menus" ON weekly_menus;
DROP POLICY IF EXISTS "Authenticated users can update weekly menus" ON weekly_menus;

-- Create new policies that allow anonymous/public access
-- Anyone can view weekly menus
CREATE POLICY "Anyone can view weekly menus" ON weekly_menus
  FOR SELECT USING (true);

-- Anyone can insert weekly menus (anonymous access)
CREATE POLICY "Anyone can insert weekly menus" ON weekly_menus
  FOR INSERT WITH CHECK (true);

-- Anyone can update weekly menus (anonymous access)
CREATE POLICY "Anyone can update weekly menus" ON weekly_menus
  FOR UPDATE USING (true);

-- Verify the policies are set correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'weekly_menus'
ORDER BY policyname;








