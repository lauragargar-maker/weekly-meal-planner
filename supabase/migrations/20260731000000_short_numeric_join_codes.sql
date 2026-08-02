-- Join codes go from 8 alphanumeric characters to 6 digits.
--
-- The old default (upper(substr(md5(...), 1, 8))) produced codes like "4F7A2C9B",
-- which users found long and awkward to dictate. Six digits give 900.000
-- combinations, which is plenty while the beta is invite-only, and read out loud
-- as two groups of three.
--
-- Existing codes are regenerated: today the only ones in circulation belong to
-- the founder household, so this is the last moment where changing them is free.

-- Codes start at 100000 so none has a leading zero: "007421" invites the question
-- of whether the zeros are part of the code.
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate TEXT;
BEGIN
  -- The UNIQUE constraint is the real guarantee; this loop just keeps it from
  -- being hit in practice, since a bare random default would eventually collide.
  FOR i IN 1..50 LOOP
    candidate := (100000 + floor(random() * 900000))::INT::TEXT;
    IF NOT EXISTS (SELECT 1 FROM households WHERE join_code = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Could not generate a unique join code after 50 attempts';
END $$;

ALTER TABLE households ALTER COLUMN join_code SET DEFAULT generate_join_code();

-- Regenerated one row at a time: inside a single UPDATE, generate_join_code()
-- cannot see the values the same statement is assigning, so it could hand out
-- the same code twice.
--
-- Only rows that are not already a 6-digit code are touched, so replaying this
-- migration is a no-op. Without that guard a replay would reissue every code in
-- the table, invalidating the ones families already have written down.
DO $$
DECLARE
  household_id UUID;
BEGIN
  FOR household_id IN SELECT id FROM households WHERE join_code !~ '^\d{6}$' LOOP
    UPDATE households SET join_code = generate_join_code() WHERE id = household_id;
  END LOOP;
END $$;

-- Codes are shown as "123 456", so people type them back with the space in the
-- middle. Normalising on digits only accepts that, along with dashes and any
-- other punctuation they add.
CREATE OR REPLACE FUNCTION join_household(family_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_household UUID;
  v_code TEXT := regexp_replace(coalesce(join_household.family_code, ''), '\D', '', 'g');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM household_members WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'You already belong to a household';
  END IF;

  SELECT id INTO v_household
  FROM households
  WHERE join_code = v_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid family code';
  END IF;

  INSERT INTO household_members (user_id, household_id, role)
  VALUES (v_user, v_household, 'member');

  RETURN v_household;
END $$;

REVOKE EXECUTE ON FUNCTION join_household(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_household(TEXT) TO authenticated;
