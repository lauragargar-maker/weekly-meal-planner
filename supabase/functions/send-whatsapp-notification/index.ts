import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MenuItem {
  day: string
  meal_type: 'lunch' | 'dinner'
  starter?: string
  main?: string
  single?: string
}

function formatDayName(date: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const day = new Date(date).getDay()
  return days[day]
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMenuForWhatsApp(menuItems: MenuItem[], weekStart: string, weekEnd: string): string {
  const itemsByDay = menuItems.reduce((acc, item) => {
    if (!acc[item.day]) {
      acc[item.day] = { lunch: null, dinner: null }
    }
    if (item.meal_type === 'lunch') {
      acc[item.day].lunch = item
    } else if (item.meal_type === 'dinner') {
      acc[item.day].dinner = item
    }
    return acc
  }, {} as Record<string, { lunch: MenuItem | null; dinner: MenuItem | null }>)

  let message = `🍽️ *Weekly Meal Plan*\n`
  message += `${formatDate(weekStart)} - ${formatDate(weekEnd)}\n\n`

  const sortedDays = Object.keys(itemsByDay).sort()
  
  sortedDays.forEach((day) => {
    const { lunch, dinner } = itemsByDay[day]
    message += `*${formatDayName(day)} - ${formatDate(day)}*\n`
    
    if (lunch) {
      message += `🍴 *Lunch:*\n`
      if (lunch.single) {
        message += `  • ${lunch.single}\n`
      } else {
        if (lunch.starter) message += `  • Starter: ${lunch.starter}\n`
        if (lunch.main) message += `  • Main: ${lunch.main}\n`
      }
    }
    
    if (dinner) {
      message += `🍽️ *Dinner:*\n`
      if (dinner.main) {
        message += `  • ${dinner.main}\n`
      }
    }
    
    message += `\n`
  })

  return message
}

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


// async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<void> {
  // This is a placeholder for WhatsApp integration
  // You can use services like:
  // - Twilio API (https://www.twilio.com/docs/whatsapp)
  // - WhatsApp Business API
  // - MessageBird
  
//  const whatsappApiUrl = Deno.env.get('WHATSAPP_API_URL')
//  const whatsappApiKey = Deno.env.get('WHATSAPP_API_KEY')
  
 //   if (!whatsappApiUrl || !whatsappApiKey) {
 //   console.warn('WhatsApp API credentials not configured. Message would be:')
 //   console.log(message)
 //   return
 // }

//  try {
//    const response = await fetch(whatsappApiUrl, {
//      method: 'POST',
//      headers: {
//        'Content-Type': 'application/json',
//        'Authorization': `Bearer ${whatsappApiKey}`,
//      },
//      body: JSON.stringify({
//        to: phoneNumber,
//        message: message,
//      }),
//    })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // STALE — DO NOT REACTIVATE AS IS. The app moved its weeks to Monday
    // (see src/utils/weekStart.ts); this still looks up a Saturday
    // `week_start` and would never find the menu it means to send.
    //
    // Get next week's Saturday (week starts on next Saturday)
    const today = new Date()
    const weekStart = new Date(today)
    const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday
    // Calculate days until next Saturday
    const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
    weekStart.setDate(today.getDate() + daysUntilSaturday)
    weekStart.setHours(0, 0, 0, 0)

    // Get current week's menu
    const { data: menu, error: menuError } = await supabaseClient
      .from('weekly_menus')
      .select('*')
      .eq('week_start', weekStart.toISOString().split('T')[0])
      .single()

    if (menuError || !menu) {
      return new Response(
        JSON.stringify({ error: 'Menu for this week not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      )
    }

    // Get WhatsApp contact from environment or request body
    const phoneNumber = Deno.env.get('WHATSAPP_CONTACT') || 
      (await req.json()).phoneNumber

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp contact number not provided' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Format menu message
    const message = formatMenuForWhatsApp(
      menu.menu_items as MenuItem[],
      menu.week_start,
      menu.week_end
    )

    // Send WhatsApp message
    await sendWhatsAppMessage(phoneNumber, message)

    return new Response(
      JSON.stringify({ success: true, message: 'WhatsApp notification sent' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

