import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'

/** The three screens the app has; sent along so feedback can be placed. */
export type FeedbackScreen = 'semana' | 'platos' | 'familia'

type FeedbackType = 'bug' | 'idea' | 'otro'

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Algo falla' },
  { value: 'idea', label: 'Una idea' },
  { value: 'otro', label: 'Otra cosa' },
]

/** Shortest message we accept, spaces not counted. */
const MIN_MESSAGE_LENGTH = 4
const MAX_MESSAGE_LENGTH = 1000
/** One submission per this many ms, so a double tap does not send twice. */
const SUBMIT_COOLDOWN_MS = 10_000
/** Drag this far down and the sheet closes. */
const DRAG_CLOSE_THRESHOLD_PX = 80

// Module scope on purpose: the sheet unmounts when it closes, so a ref would
// forget the last submission the moment the user closes and reopens it.
let lastSubmittedAt = 0

interface FeedbackSheetProps {
  screen: FeedbackScreen
  householdId: string
  userId: string
  onClose: () => void
}

/**
 * Short feedback sheet: optional type, mandatory text, and the acknowledgement
 * rendered inside the same sheet instead of closing it. See
 * `specs/feedback-button.md`.
 */
export default function FeedbackSheet({ screen, householdId, userId, onClose }: FeedbackSheetProps) {
  const [type, setType] = useState<FeedbackType | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragY, setDragY] = useState(0)

  const sheetRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragStartY = useRef<number | null>(null)

  // Nothing behind the sheet scrolls while it is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Focus goes into the sheet and comes back to the header button on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    // On mobile autofocusing raises the keyboard over the sheet before the title
    // can be read, so only desktop gets it.
    if (window.matchMedia('(min-width: 768px)').matches) {
      textareaRef.current?.focus()
    } else {
      sheetRef.current?.focus()
    }
    return () => previouslyFocused?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !sheetRef.current) return

      const focusables = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled])'
        )
      )
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (e.shiftKey && (active === first || !sheetRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const trimmed = message.trim()
  const canSubmit = message.replace(/\s/g, '').length >= MIN_MESSAGE_LENGTH

  const handleSubmit = async () => {
    if (!canSubmit || sending) return

    const now = Date.now()
    if (now - lastSubmittedAt < SUBMIT_COOLDOWN_MS) {
      setError('Acabas de enviarnos algo. Espera unos segundos, por favor.')
      return
    }

    setSending(true)
    setError(null)
    try {
      const { error: insertError } = await supabase.from('feedback').insert({
        household_id: householdId,
        user_id: userId,
        message: trimmed.slice(0, MAX_MESSAGE_LENGTH),
        type,
        screen,
        app_version: __APP_VERSION__,
      })
      if (insertError) throw insertError

      lastSubmittedAt = Date.now()
      trackEvent('feedback_submitted', { type: type ?? 'none', screen })
      setSent(true)
    } catch (err) {
      console.error('Error sending feedback:', err)
      // The message stays in state: nobody should have to type it twice.
      setError('No hemos podido enviarlo. Inténtalo en un momento.')
    } finally {
      setSending(false)
    }
  }

  const closeButton = (
    <button
      onClick={onClose}
      aria-label="Cerrar"
      className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-white text-lg font-extrabold text-tinta-500 transition-colors duration-120 hover:bg-crema-50 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
    >
      ✕
    </button>
  )

  return (
    <div
      className="anim-scrim fixed inset-0 z-40 flex items-end justify-center bg-[rgba(38,33,28,0.42)] md:items-center md:p-7"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
        className="anim-sheet w-full rounded-t-[28px] border-t-[3px] border-tinta-900 bg-crema-100 px-5 pt-3 pb-6 outline-none shadow-sheet md:anim-pop md:w-[460px] md:rounded-sheet md:border-[3px] md:px-6 md:pt-4 md:pb-7 md:shadow-modal"
      >
        {/* Grab area: dragging the sheet down closes it. Mobile only. */}
        <div
          onPointerDown={(e) => {
            dragStartY.current = e.clientY
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (dragStartY.current === null) return
            setDragY(Math.max(0, e.clientY - dragStartY.current))
          }}
          onPointerUp={() => {
            dragStartY.current = null
            if (dragY > DRAG_CLOSE_THRESHOLD_PX) onClose()
            else setDragY(0)
          }}
          className="-mx-5 -mt-3 cursor-grab px-5 pb-2 pt-3 touch-none md:hidden"
        >
          <div className="mx-auto h-[5px] w-11 rounded-full bg-crema-300" aria-hidden="true" />
        </div>

        {sent ? (
          <div className="py-2 text-center" role="status" aria-live="polite">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-tinta-900 bg-verde-500 text-2xl font-extrabold text-white"
              aria-hidden="true"
            >
              ✓
            </div>
            <h2 id="feedback-title" className="mt-3.5 text-[21px] font-extrabold">
              ¡Gracias!
            </h2>
            <p className="mt-1.5 text-sm font-bold font-sans text-tinta-500">
              Lo leeremos esta semana. Si hace falta, te escribimos al correo.
            </p>
            <button
              onClick={onClose}
              className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-full border-[3px] border-tinta-900 bg-white px-6 py-3 font-extrabold text-tinta-900 shadow-[4px_4px_0_#f0e2c8] transition-colors duration-120 hover:bg-crema-50 active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="feedback-title" className="text-[23px] font-extrabold leading-tight">
                  ¿Nos cuentas qué tal?
                </h2>
                <p className="mt-1 text-sm font-bold font-sans text-tinta-500">
                  Estamos en beta y leemos todo lo que llega.
                </p>
              </div>
              {closeButton}
            </div>

            <div
              role="radiogroup"
              aria-label="Tipo de comentario"
              className="mt-4 flex gap-2"
              onKeyDown={(e) => {
                // Arrow keys move between options, as expected of a radiogroup.
                const step =
                  e.key === 'ArrowRight' || e.key === 'ArrowDown'
                    ? 1
                    : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                      ? -1
                      : 0
                if (step === 0) return
                e.preventDefault()
                const current = TYPES.findIndex((t) => t.value === type)
                const next = (current + step + TYPES.length) % TYPES.length
                setType(TYPES[next].value)
                e.currentTarget.querySelectorAll('button')[next]?.focus()
              }}
            >
              {TYPES.map((option, index) => {
                const selected = type === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    // Roving tab stop; with nothing chosen the first chip takes it.
                    tabIndex={selected || (type === null && index === 0) ? 0 : -1}
                    disabled={sending}
                    // Tapping the chosen one again clears it: the type is optional.
                    onClick={() => setType(selected ? null : option.value)}
                    className={`flex min-h-[44px] flex-1 items-center justify-center rounded-full border-2 px-2 text-sm font-extrabold transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? 'border-tinta-900 bg-amarillo-500 text-tinta-900'
                        : 'border-crema-300 bg-white text-tinta-500 hover:bg-crema-50'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <label className="sr-only" htmlFor="feedback-message">
              Tu comentario
            </label>
            <textarea
              ref={textareaRef}
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Cuéntanoslo con tus palabras…"
              // 16px minimum, or iOS zooms the page in when it gets focus.
              className="input-nam mt-3 min-h-[104px] resize-none rounded-[20px] border-[3px] border-tinta-900 text-base font-bold shadow-pop-sm disabled:opacity-60"
            />

            {error && (
              <p className="error-nam" role="alert">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || sending}
              aria-busy={sending}
              className="btn-primary mt-4 w-full disabled:bg-crema-400 disabled:text-crema-100"
            >
              {sending ? 'Enviando…' : 'Enviar'}
            </button>

            <p className="mt-3 text-center text-[12.5px] font-bold font-sans text-tinta-500">
              Enviamos también en qué pantalla estabas y la versión de la app. Nada más.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
