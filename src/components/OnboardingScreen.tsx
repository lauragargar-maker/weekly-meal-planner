import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'

type Mode = 'create' | 'join'

export default function OnboardingScreen() {
  const { session, signOut, refreshHousehold } = useAuth()
  const [mode, setMode] = useState<Mode>('create')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [familyCode, setFamilyCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const { error: rpcError } =
        mode === 'create'
          ? await supabase.rpc('redeem_invite_and_create_household', {
              invite_code: inviteCode.trim(),
              household_name: householdName.trim(),
            })
          : await supabase.rpc('join_household', {
              family_code: familyCode.trim(),
            })
      if (rpcError) throw rpcError
      await refreshHousehold()
    } catch (err) {
      console.error('Error setting up household:', err)
      setError(err instanceof Error ? err.message : 'Failed to set up your household')
    } finally {
      setSubmitting(false)
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 px-3 py-2 text-sm font-medium rounded-lg border ${
      active
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up your household</h1>
        <p className="text-gray-600 mb-6">
          Your household is the private space for your dishes and weekly menus, shared by
          everyone in your family.
        </p>

        <div className="flex gap-2 mb-6" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            className={tabClass(mode === 'create')}
            onClick={() => switchMode('create')}
          >
            Create a household
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'join'}
            className={tabClass(mode === 'join')}
            onClick={() => switchMode('join')}
          >
            Join my family
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'create' ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="household-name">
                Household name
              </label>
              <input
                id="household-name"
                type="text"
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                placeholder="e.g. Casa García"
              />

              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invite-code">
                Invite code
              </label>
              <input
                id="invite-code"
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-1"
                placeholder="Your beta invite code"
              />
              <p className="text-xs text-gray-500 mb-4">
                You need an invite code from the WeeklyMenu team to join the beta.
              </p>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="family-code">
                Family code
              </label>
              <input
                id="family-code"
                type="text"
                required
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-1"
                placeholder="e.g. 4F7A2C9B"
              />
              <p className="text-xs text-gray-500 mb-4">
                Ask the family member who created your household for the family code — it's
                shown at the top of their app.
              </p>
            </>
          )}

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting
              ? 'Setting up...'
              : mode === 'create'
                ? 'Create household'
                : 'Join household'}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-500 flex items-center justify-between">
          <span>{session?.user?.email}</span>
          <button onClick={() => signOut()} className="text-primary-600 hover:text-primary-700 font-medium">
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
