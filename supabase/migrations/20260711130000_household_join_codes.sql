-- Family members join an existing household with a short join code.
-- Every household gets a code automatically; it is shown in the app header
-- so the owner can share it with the rest of the family.

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS join_code TEXT NOT NULL UNIQUE
    DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 8));

CREATE OR REPLACE FUNCTION join_household(family_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_household UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM household_members WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'You already belong to a household';
  END IF;

  SELECT id INTO v_household
  FROM households
  WHERE join_code = upper(trim(join_household.family_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid family code';
  END IF;

  INSERT INTO household_members (user_id, household_id, role)
  VALUES (v_user, v_household, 'member');

  RETURN v_household;
END $$;

REVOKE EXECUTE ON FUNCTION join_household(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_household(TEXT) TO authenticated;
