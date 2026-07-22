import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'

interface FeedbackButtonProps {
  householdId: string
  userId: string
}

export default function FeedbackButton({ householdId, userId }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) textareaRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const closeModal = () => {
    setOpen(false)
    setMessage('')
    setSent(false)
    setError(null)
  }

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const { error: insertError } = await supabase.from('feedback').insert({
        household_id: householdId,
        user_id: userId,
        message: trimmed,
        context: window.location.pathname,
      })
      if (insertError) throw insertError
      trackEvent('feedback_submitted')
      setSent(true)
      setMessage('')
    } catch (err) {
      console.error('Error sending feedback:', err)
      setError('No se pudo enviar el feedback. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-full shadow-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
      >
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Cuéntanos qué tal</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sent ? (
              <div className="text-center py-4">
                <p className="text-gray-800 font-medium mb-4">¡Gracias por tu feedback!</p>
                <button onClick={closeModal} className="btn-primary">Cerrar</button>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="feedback-message">
                  Ideas, fallos o cualquier cosa que quieras contarnos
                </label>
                <textarea
                  ref={textareaRef}
                  id="feedback-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Escribe aquí..."
                />
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
