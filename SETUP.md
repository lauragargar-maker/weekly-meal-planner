# Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Copy and paste the contents of `supabase/schema.sql` into the SQL editor
4. Click **Run** to execute the SQL script
5. Run each script in `supabase/migrations/` in filename (date) order the same way
6. Together these create:
   - `dish_ideas` and `weekly_menus` tables (owned per household)
   - `households`, `household_members`, and `invite_codes` tables
   - The `redeem_invite_and_create_household` signup function
   - Necessary indexes, triggers, and per-household Row Level Security policies

### 2b. Authentication and Invite Codes

The app signs users in with **magic links** (passwordless email), which Supabase Auth provides out of the box.

1. In **Authentication > URL Configuration**, set the Site URL to where the app runs
   (`http://localhost:5173` for development, your production URL when deployed).
2. New users must redeem an invite code to create their household. Create codes in the SQL editor:

   ```sql
   INSERT INTO invite_codes (code, max_uses, expires_at)
   VALUES ('AMIGOS-2026', 20, NOW() + INTERVAL '90 days');
   ```

   Additional family members don't need a beta invite code: they sign in and pick
   **"Join my family"** on the onboarding screen, entering the household's **family code**
   (shown in the app header of anyone already in the household).

   **Email rate limit:** Supabase's built-in mailer only sends a handful of auth emails per
   hour, which is too low even for one family. Configure custom SMTP (Project Settings >
   Auth > SMTP Settings — e.g. a free Brevo account or a Gmail app password) and then raise
   the email rate limit under Authentication > Rate Limits.

3. **Migrating from a single-user install:** the multi-tenant migration moves your existing
   dishes and menus into a household named `Founder household`. Sign in to the app once with
   your email, then attach your login to it:

   ```sql
   INSERT INTO household_members (user_id, household_id, role)
   SELECT u.id, h.id, 'owner'
   FROM auth.users u, households h
   WHERE u.email = 'you@example.com'
     AND h.name = 'Founder household'
   ON CONFLICT (user_id) DO NOTHING;
   ```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in your Supabase dashboard under **Settings > API**.

### 4. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Adding Dish Ideas

Signed-in users manage their own household's dishes directly in the app (dish editor and
"add new dish" flows). To bulk-load dishes for a household via SQL instead:

```sql
INSERT INTO dish_ideas (household_id, name, category, meal_type) VALUES
  ('household-uuid-here', 'Dish Name', 'starter', 'lunch'),
  ('household-uuid-here', 'Another Dish', 'main', 'both'),
  ('household-uuid-here', 'Single Course Meal', 'single', 'lunch');
```

Find the household UUID in the `households` table.

## Setting Up Edge Functions (Optional)

> **Note:** the edge functions predate multi-tenancy. They generate/send a single global
> menu and will not work against the per-household schema without being updated to take a
> household context and use the service role key. Skip them for now; scheduled generation
> and notifications are planned as a later phase.

### Prerequisites

Install Supabase CLI:

```bash
npm install -g supabase
```

### Deploy Edge Functions

1. **Login to Supabase**:
   ```bash
   supabase login
   ```

2. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   You can find your project ref in your Supabase dashboard URL:
   `https://app.supabase.com/project/your-project-ref`

3. **Deploy the functions**:
   ```bash
   supabase functions deploy generate-weekly-menu
   supabase functions deploy send-whatsapp-notification
   ```

### Configure Edge Function Environment Variables

In your Supabase dashboard:
1. Go to **Edge Functions > Settings**
2. Add the following secrets (if using WhatsApp notifications):
   - `WHATSAPP_API_URL`
   - `WHATSAPP_API_KEY`
   - `WHATSAPP_CONTACT` (optional)

## Setting Up WhatsApp Notifications (Optional)

### Using Twilio (Recommended)

1. Sign up at [twilio.com](https://www.twilio.com)
2. Get a WhatsApp sandbox number (for testing) or verified WhatsApp Business number
3. Get your Account SID and Auth Token
4. Update the `send-whatsapp-notification` Edge Function to use Twilio API
5. Set environment variables in Supabase:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_NUMBER`

### Scheduled Execution

To automatically generate menus and send notifications every Friday:

1. Set up a GitHub Actions workflow (see `.github/workflows/generate-menu.yml`)
2. Or use a cron service like:
   - Vercel Cron
   - AWS EventBridge
   - Google Cloud Scheduler

## Troubleshooting

### "Supabase credentials not found"

- Make sure your `.env` file exists in the root directory
- Verify that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set correctly
- Restart your development server after creating/updating `.env`

### "No dish ideas available"

- Make sure you've run the SQL schema script
- Check that the `dish_ideas` table has data
- Verify Row Level Security policies allow you to read from `dish_ideas`

### "Menu generation fails"

- Ensure you have at least one dish idea for each category (starter, main, single)
- Check that dish ideas have appropriate `meal_type` values
- Verify you have permission to insert into `weekly_menus`

### Real-time updates not working

- Make sure Realtime is enabled in your Supabase project
- Check that you're using the correct Supabase client configuration
- Verify your Supabase project has Realtime enabled for the tables

## Production Deployment

### Build for Production

```bash
npm run build
```

The production build will be in the `dist` directory.

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Add environment variables in Vercel dashboard

### Deploy to Netlify

1. Install Netlify CLI: `npm i -g netlify-cli`
2. Run: `netlify deploy --prod`
3. Add environment variables in Netlify dashboard

## Next Steps

- Customize the UI colors in `tailwind.config.js`
- Add more dish ideas to the database
- Set up automated menu generation
- Configure WhatsApp notifications
- Add user authentication for personal meal plans








