-- Open signup: anyone signed in can create a household, no beta code needed.
--
-- Until now the only way to create one was redeem_invite_and_create_household,
-- which spends an invite code in the same call. This is that function without
-- the code: same checks, same result.
--
-- The beta's functions and the invite_codes table stay on purpose. A browser
-- still running the previous frontend — between this migration and the Vercel
-- deploy, or from cache afterwards — calls redeem_invite_and_create_household
-- and must keep working. The table also records which code each tester used.
-- Dropping them is a later cleanup, once nobody can be on the old frontend.
--
-- Run BEFORE merging the PR that switches the frontend to create_household:
-- the new frontend calls a function that does not exist until this runs.
-- Backward compatible with the old frontend. Dev first, then production.

CREATE OR REPLACE FUNCTION create_household(household_name TEXT)
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

  IF household_name IS NULL OR length(trim(household_name)) = 0 THEN
    RAISE EXCEPTION 'Household name is required';
  END IF;

  INSERT INTO households (name) VALUES (trim(household_name)) RETURNING id INTO v_household;
  INSERT INTO household_members (user_id, household_id, role) VALUES (v_user, v_household, 'owner');

  RETURN v_household;
END $$;

REVOKE EXECUTE ON FUNCTION create_household(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_household(TEXT) TO authenticated;

-- Verification — run separately. Expect one row, `authenticated_can_run` = true.
--
-- SELECT has_function_privilege('authenticated', 'create_household(text)', 'EXECUTE')
--   AS authenticated_can_run;
