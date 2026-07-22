-- In-app feedback: household members can leave a free-text note from
-- anywhere in the app. Feedback is scoped to a household like every other
-- table; review it from the Supabase SQL editor (bypasses RLS).

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(trim(message)) > 0),
  -- Free-text hint about where in the app the feedback was left, e.g. the
  -- view the user was on. Not validated against a fixed set of screens.
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_household_id ON feedback(household_id);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members submit feedback for their household" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (household_id = current_household_id() AND user_id = auth.uid());

CREATE POLICY "Members view their household feedback" ON feedback
  FOR SELECT TO authenticated USING (household_id = current_household_id());
