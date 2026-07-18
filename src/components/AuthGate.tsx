import { useAuth } from '../lib/auth-context'
import App from '../App'
import LoginScreen from './LoginScreen'
import OnboardingScreen from './OnboardingScreen'

/** Renders the app only for a signed-in user with a household. */
export default function AuthGate() {
  const { loading, session, household, householdError, refreshHousehold, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!session) return <LoginScreen />

  if (!household && householdError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">No se pudo cargar tu hogar</h2>
          <p className="text-gray-700 mb-4">{householdError}</p>
          <div className="flex gap-3">
            <button onClick={() => refreshHousehold()} className="btn-primary">
              Reintentar
            </button>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Salir
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!household) return <OnboardingScreen />

  return <App household={household} />
}
