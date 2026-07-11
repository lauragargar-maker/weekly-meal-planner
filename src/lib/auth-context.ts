import { createContext, useContext } from 'react'
import { Session } from '@supabase/supabase-js'
import { Household } from '../types'

export interface AuthContextValue {
  /** Resolving the session and household on first load. */
  loading: boolean
  session: Session | null
  /** The signed-in user's household; null until onboarding completes. */
  household: Household | null
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  /** Re-fetch the household (e.g. right after onboarding creates it). */
  refreshHousehold: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
