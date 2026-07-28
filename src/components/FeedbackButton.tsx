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
        className="fixed bottom-6 right-6 z-40 min-h-[44px] rounded-full bg-verde-600 px-5 py-3 text-sm font-extrabold text-white shadow-toast transition-colors duration-120 hover:bg-verde-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
      >
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[45] flex items-center justify-center bg-[rgba(38,33,28,0.5)] p-7"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-sheet bg-crema-100 py-7 px-6 shadow-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Enviar feedback"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-extrabold">Cuéntanos qué tal</h2>
              <button
                onClick={closeModal}
                aria-label="Cerrar"
                className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-white font-extrabold text-tinta-500 transition-colors duration-120 hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-verde-500"
              >
                ✕
              </button>
            </div>

            {sent ? (
              <div className="py-4 text-center">
                <p className="text-base font-extrabold">¡Gracias por tu feedback!</p>
                <button onClick={closeModal} className="btn-primary mt-5 w-full">
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <label className="label-nam mt-5" htmlFor="feedback-message">
                  Ideas, fallos o cualquier cosa que quieras contarnos
                </label>
                <textarea
                  ref={textareaRef}
                  id="feedback-message"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input-nam resize-y"
                  placeholder="Escribe aquí…"
                />
                {error && (
                  <p className="error-nam" role="alert">
                    {error}
                  </p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || submitting}
                  className="btn-dark mt-5 w-full"
                >
                  {submitting ? 'Enviando…' : 'Enviar'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
