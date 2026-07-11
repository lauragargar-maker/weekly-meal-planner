-- Multi-tenant foundation: households, memberships, invite codes,
-- per-household data ownership and RLS.
--
-- After running this migration the app requires a signed-in user that
-- belongs to a household. Existing dishes/menus are moved into a
-- "Founder household"; see the end of this file for how to attach your
-- own login to it.

-- ============================================================
-- 1. New tables
-- ============================================================

CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- One household per user for now (user_id is the primary key).
CREATE TABLE IF NOT EXISTS household_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_members_household_id
  ON household_members(household_id);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY CHECK (length(trim(code)) > 0),
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. Add household ownership to existing tables
-- ============================================================

ALTER TABLE dish_ideas
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE CASCADE;

ALTER TABLE weekly_menus
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE CASCADE;

-- Move pre-existing single-tenant data into a founder household.
DO $$
DECLARE
  v_founder UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM dish_ideas WHERE household_id IS NULL)
     OR EXISTS (SELECT 1 FROM weekly_menus WHERE household_id IS NULL) THEN
    INSERT INTO households (name) VALUES ('Founder household') RETURNING id INTO v_founder;
    UPDATE dish_ideas SET household_id = v_founder WHERE household_id IS NULL;
    UPDATE weekly_menus SET household_id = v_founder WHERE household_id IS NULL;
    RAISE NOTICE 'Existing data assigned to founder household %', v_founder;
  END IF;
END $$;

ALTER TABLE dish_ideas ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE weekly_menus ALTER COLUMN household_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dish_ideas_household_id ON dish_ideas(household_id);
CREATE INDEX IF NOT EXISTS idx_weekly_menus_household_id ON weekly_menus(household_id);

-- One menu per week PER HOUSEHOLD (was globally unique).
ALTER TABLE weekly_menus DROP CONSTRAINT IF EXISTS weekly_menus_week_start_key;
ALTER TABLE weekly_menus
  ADD CONSTRAINT weekly_menus_household_week_unique UNIQUE (household_id, week_start);

-- ============================================================
-- 3. Helper: the calling user's household
-- ============================================================

-- SECURITY DEFINER so it can read household_members regardless of RLS.
CREATE OR REPLACE FUNCTION current_household_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION current_household_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_household_id() TO authenticated;

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
-- invite_codes: no policies on purpose — clients can never read or write
-- codes directly; they are only consumed via the RPC below.

CREATE POLICY "Members can view their household" ON households
  FOR SELECT TO authenticated USING (id = current_household_id());

CREATE POLICY "Members can rename their household" ON households
  FOR UPDATE TO authenticated
  USING (id = current_household_id())
  WITH CHECK (id = current_household_id());

CREATE POLICY "Users can view their own membership" ON household_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Drop the single-tenant policies from schema.sql / fix-rls-policies.sql.
DROP POLICY IF EXISTS "Anyone can view dish ideas" ON dish_ideas;
DROP POLICY IF EXISTS "Only admins can insert dish ideas" ON dish_ideas;
DROP POLICY IF EXISTS "Only admins can update dish ideas" ON dish_ideas;
DROP POLICY IF EXISTS "Only admins can delete dish ideas" ON dish_ideas;
DROP POLICY IF EXISTS "Anyone can view weekly menus" ON weekly_menus;
DROP POLICY IF EXISTS "Anyone can insert weekly menus" ON weekly_menus;
DROP POLICY IF EXISTS "Anyone can update weekly menus" ON weekly_menus;
DROP POLICY IF EXISTS "Authenticated users can insert weekly menus" ON weekly_menus;
DROP POLICY IF EXISTS "Authenticated users can update weekly menus" ON weekly_menus;

CREATE POLICY "Members manage their household dishes" ON dish_ideas
  FOR ALL TO authenticated
  USING (household_id = current_household_id())
  WITH CHECK (household_id = current_household_id());

CREATE POLICY "Members manage their household menus" ON weekly_menus
  FOR ALL TO authenticated
  USING (household_id = current_household_id())
  WITH CHECK (household_id = current_household_id());

-- ============================================================
-- 5. Signup RPC: redeem an invite code and create a household
-- ============================================================

CREATE OR REPLACE FUNCTION redeem_invite_and_create_household(
  invite_code TEXT,
  household_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code invite_codes%ROWTYPE;
  v_household UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM household_members WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'You already belong to a household';
  END IF;

  IF household_name IS NULL OR length(trim(household_name)) = 0 THEN
    RAISE EXCEPTION 'Household name is required';
  END IF;

  SELECT * INTO v_code
  FROM invite_codes
  WHERE code = trim(redeem_invite_and_create_household.invite_code)
  FOR UPDATE;

  IF NOT FOUND
     OR v_code.used_count >= v_code.max_uses
     OR (v_code.expires_at IS NOT NULL AND v_code.expires_at < NOW()) THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  UPDATE invite_codes SET used_count = used_count + 1 WHERE code = v_code.code;

  INSERT INTO households (name) VALUES (trim(household_name)) RETURNING id INTO v_household;
  INSERT INTO household_members (user_id, household_id, role) VALUES (v_user, v_household, 'owner');

  RETURN v_household;
END $$;

REVOKE EXECUTE ON FUNCTION redeem_invite_and_create_household(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_invite_and_create_household(TEXT, TEXT) TO authenticated;

-- ============================================================
-- 6. Manual follow-ups (run in the SQL editor, not part of the migration)
-- ============================================================

-- a) Attach YOUR login to the founder household. Sign in to the app once
--    (magic link), then run — replacing the email:
--
--    INSERT INTO household_members (user_id, household_id, role)
--    SELECT u.id, h.id, 'owner'
--    FROM auth.users u, households h
--    WHERE u.email = 'you@example.com'
--      AND h.name = 'Founder household'
--    ON CONFLICT (user_id) DO NOTHING;
--
-- b) Create invite codes for beta testers, e.g.:
--
--    INSERT INTO invite_codes (code, max_uses, expires_at)
--    VALUES ('AMIGOS-2026', 20, NOW() + INTERVAL '90 days');
