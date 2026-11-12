import { TOOLS, runTool, type ToolContext, type ToolResult } from './tools'

/**
 * The slice of the Model Context Protocol this server speaks: JSON-RPC over a
 * plain HTTP POST, tools only, no session.
 *
 * Written by hand rather than through the SDK because the slice is small and
 * the SDK's server transport assumes a long-lived process; an Edge Function
 * answers one request and is gone. Every request is self-contained, so there is
 * no session id to hand out and nothing to stream.
 */

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const DEFAULT_VERSION = '2025-06-18'

export const SERVER_INFO = { name: 'nam', title: '¡Ñam!', version: '1.0.0' }

const INSTRUCTIONS =
  '¡Ñam! es el planificador de menús semanales de una familia. Con estas herramientas puedes consultar y ' +
  'cambiar el menú de la casa de la persona. Empieza por ver_menu: devuelve la fecha de hoy y la de cada día, ' +
  'que necesitas para cualquier cambio. Solo se pueden poner platos del catálogo de la casa (listar_platos). ' +
  'Las semanas van de lunes a domingo; "comida" es la del mediodía y "cena" la de la noche.'

interface RpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

export interface RpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string }
}

/** Told about every tool call once it has run, for analytics. */
export type ToolObserver = (name: string, args: Record<string, unknown>, result: ToolResult) => void | Promise<void>

const rpcError = (id: RpcRequest['id'], code: number, message: string): RpcResponse => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
})

const toolList = () =>
  TOOLS.map(tool => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      title: tool.title,
      readOnlyHint: tool.readOnly,
      destructiveHint: tool.destructive ?? false,
      // Everything stays inside the household's own data.
      openWorldHint: false,
    },
  }))

/**
 * Answers one JSON-RPC message. Resolves to `null` for notifications, which
 * expect no reply.
 */
export const handleRpc = async (
  message: unknown,
  ctx: ToolContext,
  observe?: ToolObserver
): Promise<RpcResponse | null> => {
  const request = (message ?? {}) as RpcRequest
  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return rpcError(request.id, -32600, 'Invalid Request')
  }
  const { id, method, params = {} } = request
  const isNotification = id === undefined
  const ok = (result: unknown): RpcResponse => ({ jsonrpc: '2.0', id: id ?? null, result })

  if (isNotification) return null

  switch (method) {
    case 'initialize': {
      const requested = params.protocolVersion
      return ok({
        protocolVersion:
          typeof requested === 'string' && SUPPORTED_VERSIONS.includes(requested) ? requested : DEFAULT_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({ tools: toolList() })
    case 'tools/call': {
      const name = params.name
      const args = (params.arguments ?? {}) as Record<string, unknown>
      if (typeof name !== 'string') return rpcError(id, -32602, 'Missing tool name')
      const result = await runTool(name, args, ctx)
      if (!result) return rpcError(id, -32602, `Unknown tool: ${name}`)
      await observe?.(name, args, result)
      return ok({
        content: [{ type: 'text', text: result.text }],
        isError: result.isError ?? false,
      })
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}
