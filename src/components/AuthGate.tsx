import { useAuth } from '../lib/auth-context'
import App from '../App'
import LoginScreen from './LoginScreen'
import OnboardingScreen from './OnboardingScreen'

/** Renders the app only for a signed-in user with a household. */
export default function AuthGate() {
  const { loading, session, household, householdError, refreshHousehold, signOut } = useAuth()

  if (loading) {
    return (
      <div
        className="min-h-screen bg-crema-100 flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-full border-4 border-crema-300 border-t-verde-500 animate-spin motion-reduce:animate-pulse" />
          <p className="mt-4 text-base font-bold font-sans text-tinta-500">
            Montando vuestra semana…
          </p>
        </div>
      </div>
    )
  }

  if (!session) return <LoginScreen />

  if (!household && householdError) {
    return (
      <div className="min-h-screen bg-crema-100 flex items-center justify-center p-7">
        <div className="card max-w-md border-[3px] border-rojo-500 text-center" role="alert">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rojo-100 text-[30px] font-extrabold text-rojo-500"
            aria-hidden="true"
          >
            !
          </div>
          <h2 className="mt-[18px] text-xl font-extrabold text-rojo-500">
            No se pudo cargar tu hogar
          </h2>
          <p className="mt-2 text-sm font-bold font-sans text-tinta-500">{householdError}</p>
          <div className="mt-5 flex gap-3 justify-center">
            <button onClick={() => refreshHousehold()} className="btn-primary">
              Reintentar
            </button>
            <button onClick={() => signOut()} className="btn-secondary">
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
