import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'

export default function OnboardingScreen() {
  const { session, signOut, refreshHousehold } = useAuth()
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('redeem_invite_and_create_household', {
        invite_code: inviteCode.trim(),
        household_name: householdName.trim(),
      })
      if (rpcError) throw rpcError
      await refreshHousehold()
    } catch (err) {
      console.error('Error creating household:', err)
      setError(err instanceof Error ? err.message : 'Failed to create your household')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your household</h1>
        <p className="text-gray-600 mb-6">
          Your household is the private space for your dishes and weekly menus.
          You need an invite code from the WeeklyMenu team to join the beta.
        </p>

        <form onSubmit={handleSubmit}>
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
            placeholder="Your beta invite code"
          />

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating household...' : 'Create household'}
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
