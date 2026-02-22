# Send WhatsApp Notification Edge Function

This Edge Function sends the weekly menu to a designated WhatsApp contact.

## Environment Variables

Set these in your Supabase dashboard:
- `WHATSAPP_API_URL`: Your WhatsApp API endpoint
- `WHATSAPP_API_KEY`: Your WhatsApp API key
- `WHATSAPP_CONTACT`: Default phone number to send to (optional)

## Usage

Call this function via HTTP POST:

```bash
curl -X POST https://lqpofdkhcljwuezdallq.supabase.co/functions/v1/Whatsapp-message \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxcG9mZGtoY2xqd3VlemRhbGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MjQ0MjgsImV4cCI6MjA3NjMwMDQyOH0.9yelZUgks7JDm_uX4QdTwPD8dcExw99JLiQIoXeI7AU" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+34646426431"}'
```

Or just call without body if `WHATSAPP_CONTACT` is set in environment variables.

## Scheduled Execution

To run this function every Friday morning after the menu is generated, set up a cron job:

```yaml
name: Send WhatsApp Notification
on:
  schedule:
    - cron: '0 9 * * FRI'  # Every Friday at 9 AM UTC (1 hour after menu generation)
  workflow_dispatch:

jobs:
  send-notification:
    runs-on: ubuntu-latest
    steps:
      - name: Send Notification
        run: |
          curl -X POST ${{ secrets.SUPABASE_FUNCTION_URL }}/send-whatsapp-notification \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

## WhatsApp Integration Options

1. **Twilio WhatsApp API** (Recommended for ease of use)
   - Sign up at https://www.twilio.com
   - Get WhatsApp sandbox number
   - Use Twilio API endpoint

2. **WhatsApp Business API**
   - Requires business verification
   - More complex setup

3. **MessageBird**
   - Alternative WhatsApp API provider

## Example Implementation with Twilio

Update the `sendWhatsAppMessage` function in `index.ts`:

```typescript
async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<void> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER')
  
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${twilioWhatsAppNumber}`,
        To: `whatsapp:${phoneNumber}`,
        Body: message,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Twilio API error: ${await response.text()}`)
  }
}
```








