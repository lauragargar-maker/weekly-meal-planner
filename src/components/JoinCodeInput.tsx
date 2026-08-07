import { useRef } from 'react'

/**
 * The six-digit house code, one box per digit (onboarding-v2.md §5).
 *
 * A single field with maxLength=6 — what the login screen still uses — hides how
 * many digits are expected and gives no sense of progress. Pasting the whole
 * code spreads it across the boxes, because people copy it out of the WhatsApp
 * message somebody sent them.
 */
export default function JoinCodeInput({
  value,
  onChange,
  disabled,
}: {
  /** Exactly six characters, padded with spaces where empty. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, ' ').slice(0, 6).split('')

  const setDigit = (index: number, digit: string) => {
    const next = [...digits]
    next[index] = digit || ' '
    onChange(next.join('').trimEnd())
  }

  const handleChange = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, '')
    if (!typed) {
      setDigit(index, '')
      return
    }

    // More than one digit means a paste: spread it from here onwards.
    if (typed.length > 1) {
      const next = [...digits]
      for (let i = 0; i < typed.length && index + i < 6; i++) next[index + i] = typed[i]
      onChange(next.join('').trimEnd())
      inputs.current[Math.min(index + typed.length, 5)]?.focus()
      return
    }

    setDigit(index, typed)
    inputs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && digits[index] === ' ' && index > 0) {
      // Backspace on an empty box steps back rather than doing nothing.
      event.preventDefault()
      setDigit(index - 1, '')
      inputs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowLeft') inputs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight') inputs.current[index + 1]?.focus()
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Código de la casa, seis dígitos">
      {digits.map((digit, index) => (
        <div key={index} className="flex items-center gap-2">
          {/* Grouped 3 + 3, the way the code is shown and dictated. */}
          {index === 3 && <span className="w-2.5" aria-hidden="true" />}
          <input
            ref={(element) => (inputs.current[index] = element)}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            disabled={disabled}
            aria-label={`Dígito ${index + 1}`}
            value={digit.trim()}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
            className="h-[60px] w-11 rounded-[14px] border-[3px] border-tinta-900 bg-white text-center text-[26px] font-extrabold text-tinta-900 caret-verde-500 focus:border-verde-500 focus:outline-none focus:ring-2 focus:ring-verde-500 disabled:opacity-60"
          />
        </div>
      ))}
    </div>
  )
}
