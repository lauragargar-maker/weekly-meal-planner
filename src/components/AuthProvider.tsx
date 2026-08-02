import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../lib/auth-context'
import { Household } from '../types'
import { identifyUser, resetAnalytics, trackEvent } from '../lib/analytics'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionResolved, setSessionResolved] = useState(false)
  const [household, setHousehold] = useState<Household | null>(null)
  const [householdError, setHouseholdError] = useState<string | null>(null)
  const [householdResolved, setHouseholdResolved] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionResolved(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'SIGNED_IN') trackEvent('session_signed_in')
      if (event === 'SIGNED_OUT') {
        trackEvent('session_signed_out')
        resetAnalytics()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchHousehold = useCallback(async (userId: string): Promise<Household | null> => {
    const { data, error } = await supabase
      .from('household_members')
      .select('households(id, name, join_code)')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      // A failed lookup is not the same as having no household — surface it
      // instead of routing the user into onboarding.
      console.error('Error loading household:', error)
      setHouseholdError(error.message)
      return null
    }
    setHouseholdError(null)
    return (data?.households as unknown as Household) ?? null
  }, [])

  // Key on the user id (not the session object) so token refreshes don't refetch.
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (userId) identifyUser(userId)
  }, [userId])

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!userId) {
        setHousehold(null)
        setHouseholdResolved(sessionResolved)
        return
      }
      setHouseholdResolved(false)
      const result = await fetchHousehold(userId)
      if (active) {
        setHousehold(result)
        setHouseholdResolved(true)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [userId, sessionResolved, fetchHousehold])

  // No `emailRedirectTo`: the user types the code from the email instead of
  // following a link. On iOS the app is usually a home-screen shortcut, and a
  // link opens in Safari, landing the session in Safari's storage — so the
  // shortcut could never sign in. A code never leaves the app.
  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) throw error
  }, [])

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const refreshHousehold = useCallback(async () => {
    if (!session?.user) return
    setHousehold(await fetchHousehold(session.user.id))
  }, [session, fetchHousehold])

  const value = useMemo(
    () => ({
      loading: !sessionResolved || !householdResolved,
      session,
      household,
      householdError,
      signInWithEmail,
      verifyCode,
      signOut,
      refreshHousehold,
    }),
    [sessionResolved, householdResolved, session, household, householdError, signInWithEmail, verifyCode, signOut, refreshHousehold]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
