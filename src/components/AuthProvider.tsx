import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../lib/auth-context'
import { Household } from '../types'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionResolved, setSessionResolved] = useState(false)
  const [household, setHousehold] = useState<Household | null>(null)
  const [householdResolved, setHouseholdResolved] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionResolved(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchHousehold = useCallback(async (userId: string): Promise<Household | null> => {
    const { data, error } = await supabase
      .from('household_members')
      .select('households(id, name)')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error loading household:', error)
      return null
    }
    return (data?.households as unknown as Household) ?? null
  }, [])

  // Key on the user id (not the session object) so token refreshes don't refetch.
  const userId = session?.user?.id ?? null

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

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
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
      signInWithEmail,
      signOut,
      refreshHousehold,
    }),
    [sessionResolved, householdResolved, session, household, signInWithEmail, signOut, refreshHousehold]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
