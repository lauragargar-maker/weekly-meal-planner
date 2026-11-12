import { describe, expect, it } from 'vitest'
import { mcpServerUrl, pendingAuthorizationId } from './oauthConsent'

describe('pendingAuthorizationId', () => {
  it('reads the id on the consent path', () => {
    expect(pendingAuthorizationId({ pathname: '/oauth/consent', search: '?authorization_id=abc' })).toBe('abc')
    expect(pendingAuthorizationId({ pathname: '/oauth/consent/', search: '?authorization_id=abc' })).toBe('abc')
  })

  it('ignores the parameter anywhere else', () => {
    expect(pendingAuthorizationId({ pathname: '/', search: '?authorization_id=abc' })).toBeNull()
    expect(pendingAuthorizationId({ pathname: '/oauth/consent', search: '' })).toBeNull()
  })
})

describe('mcpServerUrl', () => {
  it('is only offered when switched on', () => {
    expect(mcpServerUrl('https://x.supabase.co/', 'true')).toBe('https://x.supabase.co/functions/v1/mcp')
    expect(mcpServerUrl('https://x.supabase.co', undefined)).toBeNull()
    expect(mcpServerUrl('', 'true')).toBeNull()
  })
})
