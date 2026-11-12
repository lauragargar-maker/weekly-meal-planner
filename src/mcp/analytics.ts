/**
 * Server-side product analytics for the MCP.
 *
 * The app reports to Amplitude from the browser; a menu read or edited through
 * an assistant never opens the app, so without this the household would look
 * idle on exactly the weeks it used ¡Ñam! the most conveniently. Events go to
 * the same project, with the same user id and `household_id` group, so they
 * fold into the per-household numbers (docs/analytics-events.md).
 *
 * Never throws and never waits long: analytics must not fail a tool call.
 */

// The project lives in Amplitude's EU region, like the browser SDK's `serverZone`.
const ENDPOINT = 'https://api.eu.amplitude.com/2/httpapi'

export interface McpEvent {
  userId: string
  householdId: string
  tool: string
  ok: boolean
  /** The week the call was about, relative to today, when it was about one. */
  week?: string
}

export const trackToolCall = async (
  apiKey: string | undefined,
  event: McpEvent,
  fetchImpl: typeof fetch = fetch
): Promise<void> => {
  if (!apiKey) return
  try {
    await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(1500),
      body: JSON.stringify({
        api_key: apiKey,
        events: [
          {
            user_id: event.userId,
            event_type: 'mcp_tool_called',
            time: Date.now(),
            insert_id: crypto.randomUUID(),
            platform: 'MCP',
            groups: { household_id: event.householdId },
            event_properties: {
              tool: event.tool,
              ok: event.ok,
              ...(event.week ? { week: event.week } : {}),
            },
          },
        ],
      }),
    })
  } catch (error) {
    console.error('Amplitude event not sent:', error)
  }
}
