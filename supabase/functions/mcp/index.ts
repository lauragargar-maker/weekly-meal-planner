// The ¡Ñam! MCP server. All of it lives in src/mcp/ and is bundled into
// ./bundle.js by `npm run build:mcp`; this file only hands it the environment.
//
// Deploy with JWT verification OFF (`--no-verify-jwt`): assistants must reach
// the OAuth discovery document and the 401 challenge before they have a token.
// The server checks the token itself on every other request.
import { createHandler } from './bundle.js'

Deno.serve(
  createHandler({
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    amplitudeApiKey: Deno.env.get('AMPLITUDE_API_KEY') || undefined,
  })
)
