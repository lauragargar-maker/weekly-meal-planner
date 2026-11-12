import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createHandler } from './server'
import { memoryStore, seedMenu } from './testStore'

const URL_BASE = 'https://proj.supabase.co'
const MCP_URL = `${URL_BASE}/functions/v1/mcp`

/** A server whose Auth knows one token, `good`, belonging to a user with (or without) a household. */
const server = ({ household = 'h1' as string | null, amplitudeApiKey = undefined as string | undefined } = {}) => {
  const store = memoryStore()
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (url === `${URL_BASE}/auth/v1/user`) {
      const authorized = new Headers(init?.headers).get('Authorization') === 'Bearer good'
      return authorized ? Response.json({ id: 'u1' }) : new Response('{}', { status: 401 })
    }
    return Response.json({})
  })
  const membership = {
    select: () => membership,
    eq: () => membership,
    maybeSingle: async () => ({ data: household ? { household_id: household } : null, error: null }),
  }
  const tokens: string[] = []
  const handler = createHandler(
    { supabaseUrl: URL_BASE, supabaseAnonKey: 'anon', amplitudeApiKey },
    {
      fetch: fetchStub as unknown as typeof fetch,
      now: () => new Date('2026-11-12T10:00:00Z'),
      clientFor: token => {
        tokens.push(token)
        return { from: () => membership } as unknown as SupabaseClient
      },
      storeFor: () => store,
    }
  )
  const rpc = (body: unknown, token: string | null = 'good') =>
    handler(
      new Request('http://edge-runtime.internal/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      })
    )
  return { handler, rpc, store, calls, tokens }
}

describe('authorization', () => {
  it('points a caller without a token at the authorization server', async () => {
    const { rpc } = server()
    const response = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, null)
    expect(response.status).toBe(401)
    expect(response.headers.get('WWW-Authenticate')).toContain(
      `resource_metadata="${MCP_URL}/.well-known/oauth-protected-resource"`
    )
  })

  it('rejects a token Supabase Auth does not recognise', async () => {
    const { rpc, tokens } = server()
    const response = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'forged')
    expect(response.status).toBe(401)
    // Nothing was queried on its behalf.
    expect(tokens).toEqual([])
  })

  it('serves the protected-resource metadata without a token', async () => {
    const { handler } = server()
    const response = await handler(new Request('http://edge-runtime.internal/mcp/.well-known/oauth-protected-resource'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      resource: MCP_URL,
      authorization_servers: [`${URL_BASE}/auth/v1`],
    })
  })

  it('queries the database with the caller\'s own token', async () => {
    const { rpc, tokens } = server()
    await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    expect(tokens).toEqual(['good'])
  })

  it('tells a user with no household to finish signing up', async () => {
    const { rpc } = server({ household: null })
    const response = await rpc({ jsonrpc: '2.0', id: 7, method: 'tools/list' })
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.id).toBe(7)
    expect(body.error.message).toContain('todavía no tiene una casa')
  })
})

describe('protocol', () => {
  it('initializes, echoing a protocol version it supports', async () => {
    const { rpc } = server()
    const response = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
    })
    const { result } = await response.json()
    expect(result.protocolVersion).toBe('2025-03-26')
    expect(result.capabilities).toEqual({ tools: {} })
    expect(result.serverInfo.name).toBe('nam')
  })

  it('falls back to its own version for one it does not know', async () => {
    const { rpc } = server()
    const response = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } })
    expect((await response.json()).result.protocolVersion).toBe('2025-06-18')
  })

  it('accepts notifications without replying', async () => {
    const { rpc } = server()
    const response = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(response.status).toBe(202)
    expect(await response.text()).toBe('')
  })

  it('lists the tools with their safety hints', async () => {
    const { rpc } = server()
    const { result } = await (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json()
    const byName = Object.fromEntries(result.tools.map((t: { name: string }) => [t.name, t]))
    expect(byName.ver_menu.annotations.readOnlyHint).toBe(true)
    expect(byName.cambiar_plato.annotations.readOnlyHint).toBe(false)
    expect(byName.generar_menu.annotations.destructiveHint).toBe(true)
    expect(byName.cambiar_plato.inputSchema.required).toEqual(['dia', 'comida', 'plato'])
  })

  it('runs a tool for the household, on Madrid\'s date', async () => {
    const { rpc, store } = server()
    seedMenu(store, '2026-11-09', [{ day: '2026-11-12', meal_type: 'dinner', main: 'Boquerones' }])
    const response = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ver_menu', arguments: {} } })
    const { result } = await response.json()
    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain('Cena: Boquerones')
    expect(result.content[0].text).toContain('(2026-11-12) — HOY')
  })

  it('returns a mistake in the arguments as a tool error, not a protocol error', async () => {
    const { rpc } = server()
    const response = await rpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'cambiar_plato', arguments: { dia: 'hoy', comida: 'cena', plato: 'x' } },
    })
    const body = await response.json()
    expect(body.error).toBeUndefined()
    expect(body.result.isError).toBe(true)
  })

  it('answers unknown tools, unknown methods and broken JSON with protocol errors', async () => {
    const { rpc } = server()
    const tool = await (await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'borrar_todo' } })).json()
    expect(tool.error.code).toBe(-32602)
    const method = await (await rpc({ jsonrpc: '2.0', id: 6, method: 'resources/list' })).json()
    expect(method.error.code).toBe(-32601)
    const broken = await rpc('{not json')
    expect(broken.status).toBe(400)
  })

  it('does not open a stream', async () => {
    const { handler } = server()
    const response = await handler(new Request('http://edge-runtime.internal/mcp', { headers: { Authorization: 'Bearer good' } }))
    expect(response.status).toBe(405)
  })
})

describe('analytics', () => {
  const callMenu = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ver_menu', arguments: { semana: 'siguiente' } } }

  it('reports each tool call to Amplitude under the user and the household', async () => {
    const { rpc, calls } = server({ amplitudeApiKey: 'amp-key' })
    await rpc(callMenu)
    const sent = calls.find(call => call.url.includes('amplitude'))!
    expect(sent.url).toBe('https://api.eu.amplitude.com/2/httpapi')
    const body = JSON.parse(String(sent.init?.body))
    expect(body.api_key).toBe('amp-key')
    expect(body.events[0]).toMatchObject({
      user_id: 'u1',
      event_type: 'mcp_tool_called',
      groups: { household_id: 'h1' },
      event_properties: { tool: 'ver_menu', ok: true, week: 'siguiente' },
    })
  })

  it('reports the week a day belongs to', async () => {
    const { rpc, calls } = server({ amplitudeApiKey: 'amp-key' })
    await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'quitar_primer_plato', arguments: { dia: '2026-11-18', comida: 'cena' } },
    })
    const body = JSON.parse(String(calls.find(call => call.url.includes('amplitude'))!.init?.body))
    // Nothing to remove, so the tool answers with an error — and that is still reported.
    expect(body.events[0].event_properties).toEqual({ tool: 'quitar_primer_plato', ok: false, week: 'siguiente' })
  })

  it('stays silent without a key', async () => {
    const { rpc, calls } = server()
    await rpc(callMenu)
    expect(calls.some(call => call.url.includes('amplitude'))).toBe(false)
  })
})
