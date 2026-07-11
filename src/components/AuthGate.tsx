import { useAuth } from '../lib/auth-context'
import App from '../App'
import LoginScreen from './LoginScreen'
import OnboardingScreen from './OnboardingScreen'

/** Renders the app only for a signed-in user with a household. */
export default function AuthGate() {
  const { loading, session, household } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) return <LoginScreen />
  if (!household) return <OnboardingScreen />

  return <App household={household} />
}
