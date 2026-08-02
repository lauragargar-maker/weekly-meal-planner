import { createContext, useContext } from 'react'
import { Session } from '@supabase/supabase-js'
import { Household } from '../types'

export interface AuthContextValue {
  /** Resolving the session and household on first load. */
  loading: boolean
  session: Session | null
  /** The signed-in user's household; null until onboarding completes. */
  household: Household | null
  /** Set when the household lookup itself failed (as opposed to the user having none). */
  householdError: string | null
  /** Email the user a one-time sign-in code. */
  signInWithEmail: (email: string) => Promise<void>
  /** Exchange the emailed code for a session. */
  verifyCode: (email: string, code: string) => Promise<void>
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
