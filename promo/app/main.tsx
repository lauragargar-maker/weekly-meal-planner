import './clock'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Session } from '@supabase/supabase-js'
import App from '../../src/App'
import OnboardingScreen from '../../src/components/OnboardingScreen'
import { AuthContext, AuthContextValue } from '../../src/lib/auth-context'
import { Household } from '../../src/types'
import { resetDemo, supabase } from './fakeSupabase'
import { HOUSEHOLD_ID, MEMBERS } from './demoData'
import '../../src/index.css'

/**
 * The real app, signed in as a member of the demo household. `?user=pablo`
 * opens it as the second member; `?reset` starts the demo from scratch;
 * `?onboarding` shows a new account that has no household yet.
 */
const params = new URLSearchParams(location.search)
if (params.has('reset')) resetDemo()
const member = params.get('user') === 'pablo' ? MEMBERS.pablo : MEMBERS.ana

// The recording reads what "Compartir" would hand the phone's share sheet.
const handOff = (type: string, text: string) => {
  ;(window as unknown as { __namShared?: { type: string; text: string } }).__namShared = { type, text }
  window.parent.postMessage({ type, text }, '*')
}
navigator.share = async (data?: ShareData) => handOff('nam-share', data?.text ?? '')
// Kept from the real clipboard: the recording runs without a user gesture.
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: async (text: string) => handOff('nam-copy', text) },
})

async function start() {
  if (params.has('onboarding')) return startOnboarding()
  const { data } = await supabase.from('households').select('*').eq('id', HOUSEHOLD_ID).single()
  const household = data as Household
  const auth: AuthContextValue = {
    loading: false,
    session: { user: { id: member.id, email: member.email } } as unknown as Session,
    household,
    householdError: null,
    signInWithEmail: async () => {},
    verifyCode: async () => {},
    signOut: async () => {},
    refreshHousehold: async () => {},
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AuthContext.Provider value={auth}>
        <App household={household} />
      </AuthContext.Provider>
    </React.StrictMode>
  )
}

/** Somebody who has just signed in and has no household: the onboarding steps. */
function startOnboarding() {
  const auth: AuthContextValue = {
    loading: false,
    session: { user: { id: 'user-new', email: 'lucia@ejemplo.test' } } as unknown as Session,
    household: null,
    householdError: null,
    signInWithEmail: async () => {},
    verifyCode: async () => {},
    signOut: async () => {},
    refreshHousehold: async () => {},
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AuthContext.Provider value={auth}>
        <OnboardingScreen />
      </AuthContext.Provider>
    </React.StrictMode>
  )
}

start()
