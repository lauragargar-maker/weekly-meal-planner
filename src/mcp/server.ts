import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { trackToolCall } from './analytics'
import { handleRpc, type RpcResponse } from './protocol'
import { supabaseStore, type Store } from './store'
import { madridToday } from './time'
import { weekOfCall } from './tools'

/**
 * The HTTP face of the ¡Ñam! MCP server: who is calling, and for which household.
 *
 * Sign-in is Supabase Auth acting as an OAuth 2.1 server. An assistant that
 * arrives without a token is pointed at it (RFC 9728 metadata plus the
 * `WWW-Authenticate` challenge), the person signs in to ¡Ñam! and approves on
 * `/oauth/consent`, and the assistant comes back with an access token that is
 * that person's own. The database is then queried WITH that token, so Row Level
 * Security scopes everything to their household exactly as it does for the app.
 * The service-role key is never used here, on purpose: there is no code path
 * that could read another family's menu.
 *
 * Runs as a Supabase Edge Function (`supabase/functions/mcp`), bundled from
 * this file by `scripts/build-mcp.mjs`. Nothing in it touches `Deno`, so the
 * tests drive it in Node.
 */

export interface ServerConfig {
  /** `https://<ref>.supabase.co` */
  supabaseUrl: string
  supabaseAnonKey: string
  /** Server-side Amplitude key. Unset disables analytics. */
  amplitudeApiKey?: string
}

/** Seams for the tests; production uses the defaults. */
export interface ServerDeps {
  fetch?: typeof fetch
  now?: () => Date
  /** Builds the household's store from the caller's token. */
  storeFor?: (db: SupabaseClient, householdId: string) => Store
  clientFor?: (token: string) => SupabaseClient
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...headers },
  })

const METADATA_PATH = '/.well-known/oauth-protected-resource'

export const createHandler = (config: ServerConfig, deps: ServerDeps = {}) => {
  const supabaseUrl = config.supabaseUrl.replace(/\/$/, '')
  const fetchImpl = deps.fetch ?? fetch
  const now = deps.now ?? (() => new Date())
  const storeFor = deps.storeFor ?? supabaseStore
  const clientFor =
    deps.clientFor ??
    ((token: string) =>
      createClient(supabaseUrl, config.supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }))

  // Where assistants reach this server. Built from the project URL rather than
  // from the incoming request, which inside the Edge runtime is an internal one.
  const publicUrl = `${supabaseUrl}/functions/v1/mcp`
  const metadataUrl = `${publicUrl}${METADATA_PATH}`

  const unauthorized = (description: string): Response =>
    json({ error: 'invalid_token', error_description: description }, 401, {
      'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}", error="invalid_token", error_description="${description}"`,
    })

  /** The user behind a token, as Supabase Auth itself sees it. */
  const userOf = async (token: string): Promise<string | null> => {
    const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: config.supabaseAnonKey },
    })
    if (!response.ok) return null
    const user = (await response.json()) as { id?: string }
    return user.id ?? null
  }

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    const { pathname } = new URL(request.url)

    if (pathname.endsWith(METADATA_PATH)) {
      return json({
        resource: publicUrl,
        authorization_servers: [`${supabaseUrl}/auth/v1`],
        bearer_methods_supported: ['header'],
        resource_name: '¡Ñam!',
      })
    }

    // No server-initiated messages, so there is no stream to open.
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST, OPTIONS' })
    }

    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return unauthorized('Missing access token')
    const userId = await userOf(token)
    if (!userId) return unauthorized('The access token is invalid or has expired')

    let message: unknown
    try {
      message = await request.json()
    } catch {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400)
    }

    const db = clientFor(token)
    const { data: membership, error } = await db
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.error('Could not read the household of the caller:', error)
      return json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } }, 500)
    }
    const householdId = (membership as { household_id?: string } | null)?.household_id
    if (!householdId) {
      // Signed in but never finished onboarding: there is nothing to plan yet.
      return json(
        {
          jsonrpc: '2.0',
          id: (message as { id?: string | number })?.id ?? null,
          error: {
            code: -32001,
            message: 'Esta cuenta de ¡Ñam! todavía no tiene una casa. Abre la app y crea la tuya o únete a una.',
          },
        },
        403
      )
    }

    const ctx = { store: storeFor(db, householdId), today: madridToday(now()) }
    const answer = async (one: unknown): Promise<RpcResponse | null> => {
      try {
        return await handleRpc(one, ctx, (tool, args, result) =>
          trackToolCall(
            config.amplitudeApiKey,
            {
              userId,
              householdId,
              tool,
              ok: !result.isError,
              week: weekOfCall(args, ctx.today),
            },
            fetchImpl
          )
        )
      } catch (failure) {
        console.error('MCP request failed:', failure)
        return {
          jsonrpc: '2.0',
          id: (one as { id?: string | number })?.id ?? null,
          error: { code: -32603, message: 'Internal error' },
        }
      }
    }

    if (Array.isArray(message)) {
      const responses = (await Promise.all(message.map(answer))).filter(Boolean)
      return responses.length > 0 ? json(responses) : new Response(null, { status: 202, headers: CORS })
    }
    const response = await answer(message)
    return response ? json(response) : new Response(null, { status: 202, headers: CORS })
  }
}
