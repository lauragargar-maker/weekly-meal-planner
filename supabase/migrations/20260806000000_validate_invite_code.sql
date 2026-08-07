-- Check a beta invite code without spending it.
--
-- The redesigned onboarding (handoff/specs/onboarding-v2.md §1) asks for the
-- house name and the beta code on their own screen, before three steps of rules
-- and dishes, so that an invalid code costs nobody three steps of work. The only
-- function available until now was redeem_invite_and_create_household, which
-- validates and creates in the same call: using it to check would either create
-- a household nobody asked for yet, or leave the check until the very end and
-- defeat the point of asking early.
--
-- Read-only. It consumes nothing, and the real redemption still happens at the
-- end of the flow, so a code exhausted in between still fails there — which is
-- correct, and the reason the last step handles that error rather than assuming
-- the earlier check still holds.
--
-- Note on exposure: this makes probing for valid codes cheaper than before,
-- since it has no side effect. It is limited to authenticated users, the same
-- as redemption, and the beta's codes are multi-use and short-lived. If codes
-- ever become single-use and valuable, this wants rate limiting.

CREATE OR REPLACE FUNCTION validate_invite_code(invite_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code invite_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_code
  FROM invite_codes
  WHERE code = trim(validate_invite_code.invite_code);

  RETURN FOUND
     AND v_code.used_count < v_code.max_uses
     AND (v_code.expires_at IS NULL OR v_code.expires_at >= NOW());
END $$;

REVOKE EXECUTE ON FUNCTION validate_invite_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_invite_code(TEXT) TO authenticated;
