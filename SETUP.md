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
5. This will create:
   - `dish_ideas` table with sample data
   - `weekly_menus` table
   - Necessary indexes and triggers
   - Row Level Security policies

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

## Adding Dish Ideas (Admin)

To add or modify dish ideas, you need admin privileges:

1. **Set your user role to admin** in Supabase:

   ```sql
   -- First, create a user in Supabase Auth if you haven't already
   -- Then update the user's role:
   
   UPDATE auth.users 
   SET raw_user_meta_data = jsonb_set(
     COALESCE(raw_user_meta_data, '{}'::jsonb), 
     '{role}', 
     '"admin"'
   )
   WHERE id = 'your-user-id-here';
   ```

2. **Insert dish ideas** via SQL:

   ```sql
   INSERT INTO dish_ideas (name, category, meal_type) VALUES
     ('Dish Name', 'starter', 'lunch'),
     ('Another Dish', 'main', 'both'),
     ('Single Course Meal', 'single', 'lunch');
   ```

   Or use the Supabase dashboard's Table Editor.

## Setting Up Edge Functions (Optional)

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








