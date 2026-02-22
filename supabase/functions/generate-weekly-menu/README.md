# Generate Weekly Menu Edge Function

This Edge Function automatically generates a weekly menu based on available dish ideas.

## Usage

Call this function via HTTP POST:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-weekly-menu \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## Scheduled Execution

To run this function every Friday morning, set up a cron job or use Supabase's scheduled functions feature.

You can also use external services like:
- GitHub Actions with scheduled workflows
- Vercel Cron Jobs
- AWS EventBridge
- Google Cloud Scheduler

Example GitHub Actions workflow:
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
```








