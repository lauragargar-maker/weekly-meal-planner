# Weekly Meal Planning Web App

A modern web application for generating and managing weekly meal plans with Supabase integration. The app automatically generates weekly menus based on predefined rules and can send notifications via WhatsApp.

## Features

- 🔐 **Households**: Passwordless (magic link) sign-in; each household has its own private dish catalog and menus, with invite-code signup
- 📅 **Weekly Menu Generation**: Automatically generates weekly menus with starter + main or single-course lunches, and main-course dinners
- 📱 **Visual Agenda View**: Beautiful, responsive calendar-style view of the weekly menu
- 🔔 **WhatsApp Notifications**: Automatically send weekly menus to designated contacts every Friday
- 🔄 **Real-time Updates**: Menu updates in real-time using Supabase subscriptions
- 📱 **Mobile-First Design**: Fully responsive, accessible interface

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Date Handling**: date-fns

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Supabase account and project
- (Optional) WhatsApp API credentials for notifications

## Setup Instructions

### 1. Clone and Install

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the SQL script from `supabase/schema.sql`
3. Copy your project URL and anon key from Settings > API

### 3. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Deploy Edge Functions (Optional)

If you want to use the scheduled menu generation and WhatsApp notifications:

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Deploy Edge Functions:
   ```bash
   supabase functions deploy generate-weekly-menu
   supabase functions deploy send-whatsapp-notification
   ```

5. Set environment variables in Supabase Dashboard:
   - Go to Edge Functions > Settings
   - Add your WhatsApp API credentials (if using)

### 5. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

The app will be available at `http://localhost:5173`

## Database Schema

### `dish_ideas` Table
Stores available dishes that can be used in meal plans.

- `id`: UUID (primary key)
- `name`: TEXT (dish name)
- `category`: TEXT ('starter', 'main', or 'single')
- `meal_type`: TEXT ('lunch', 'dinner', or 'both')
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### `weekly_menus` Table
Stores generated weekly menus.

- `id`: UUID (primary key)
- `week_start`: DATE (Monday of the week)
- `week_end`: DATE (Sunday of the week)
- `menu_items`: JSONB (array of menu items)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

## Menu Generation Rules

The app follows these rules when generating menus:

1. **Lunches**: 
   - Either: Starter + Main course
   - Or: Single-course meal
   - Alternates between these options throughout the week

2. **Dinners**: 
   - Main course only

3. **Diversity**: 
   - Ensures variety by shuffling dish selections
   - Cycles through available dishes

## Edge Functions

### `generate-weekly-menu`
Generates a new weekly menu based on available dish ideas.

**Usage:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-weekly-menu \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### `send-whatsapp-notification`
Sends the current week's menu via WhatsApp.

**Usage:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-whatsapp-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'
```

## Scheduling Menu Generation

To automatically generate menus every Friday, set up a cron job or use a service like:

- **GitHub Actions**: Create a workflow that runs on schedule
- **Vercel Cron**: Use Vercel's cron jobs feature
- **AWS EventBridge**: Schedule Lambda functions
- **Google Cloud Scheduler**: Set up scheduled Cloud Functions

Example GitHub Actions workflow (`.github/workflows/generate-menu.yml`):

```yaml
name: Generate Weekly Menu
on:
  schedule:
    - cron: '0 8 * * FRI'  # Every Friday at 8 AM UTC
  workflow_dispatch:

jobs:
  generate-menu:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Menu
        run: |
          curl -X POST ${{ secrets.SUPABASE_FUNCTION_URL }}/generate-weekly-menu \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
      
      - name: Send WhatsApp Notification
        run: |
          curl -X POST ${{ secrets.SUPABASE_FUNCTION_URL }}/send-whatsapp-notification \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d "{\"phoneNumber\": \"${{ secrets.WHATSAPP_CONTACT }}\"}"
```

## WhatsApp Integration

The app supports WhatsApp notifications through various providers:

1. **Twilio WhatsApp API** (Recommended)
   - Easy to set up
   - Sandbox available for testing
   - See `supabase/functions/send-whatsapp-notification/README.md` for details

2. **WhatsApp Business API**
   - Requires business verification
   - More complex setup

3. **MessageBird**
   - Alternative provider

## Accounts and Households

Users sign in with a magic link (passwordless email). A new user redeems an **invite code**
to create their household — the private space that owns their dish catalog and weekly menus.
Row Level Security restricts every read and write to the member's own household.
See `SETUP.md` for creating invite codes and migrating a single-user install.

## Building for Production

```bash
npm run build
# or
yarn build
# or
pnpm build
```

The production build will be in the `dist` directory.

## Project Structure

```
.
├── src/
│   ├── components/          # React components
│   │   └── MenuAgendaView.tsx
│   ├── lib/
│   │   └── supabase.ts      # Supabase client
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   ├── utils/
│   │   └── menuGenerator.ts # Menu generation logic
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── supabase/
│   ├── schema.sql           # Database schema
│   └── functions/           # Edge Functions
│       ├── generate-weekly-menu/
│       └── send-whatsapp-notification/
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.








