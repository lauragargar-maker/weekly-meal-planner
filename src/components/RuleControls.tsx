import { ReactNode } from 'react'

/**
 * The controls the rule blocks are built from.
 *
 * They live apart from any one screen because the onboarding asks the same
 * questions the household settings do — blocks A, C and D in `onboarding-v2.md`
 * §2 and §3, all four blocks in Familia. Two copies would drift.
 */

export function RuleCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border-2 border-crema-300 bg-white">
      {children}
    </div>
  )
}

/** Rows inside a RuleCard are separated by a divider, not by a border each. */
export function RuleRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5 [&+&]:border-t-2 [&+&]:border-crema-200">
      {children}
    </div>
  )
}

function RuleLabel({ title, help }: { title: string; help?: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-base font-extrabold leading-tight">{title}</span>
      {help && (
        <span className="mt-0.5 block text-[12.5px] font-bold font-sans leading-[1.35] text-tinta-500">
          {help}
        </span>
      )}
    </span>
  )
}

/**
 * Range 0-7, not 1-7: without zero a household cannot say "no legumes" or "no
 * pasta at all", and the whole point of the block is that it can.
 */
export function RuleStepper({
  title,
  suffix,
  value,
  onChange,
  min = 0,
  max = 7,
}: {
  title: string
  suffix: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  const button = (delta: number, label: string, glyph: string, dark: boolean) => {
    const next = value + delta
    const disabled = next < min || next > max
    return (
      <button
        type="button"
        onClick={() => onChange(next)}
        disabled={disabled}
        // Dimmed at the limit rather than removed: a button that disappears
        // makes the row jump and hides that the limit is where you are.
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-[22px] font-extrabold transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
          dark ? 'bg-tinta-900 text-crema-100' : 'border-2 border-crema-300 text-tinta-600'
        }`}
        aria-label={`${label}: ${title}`}
      >
        <span aria-hidden="true">{glyph}</span>
      </button>
    )
  }

  return (
    <RuleRow>
      <RuleLabel title={title} help={suffix} />
      <span className="flex flex-none items-center gap-2">
        {button(-1, 'Quitar uno', '−', false)}
        <span
          className="min-w-6 text-center text-[22px] font-extrabold tabular-nums"
          aria-live="polite"
          aria-label={`${title}, ${value} ${suffix}`}
        >
          {value}
        </span>
        {button(1, 'Añadir uno', '+', true)}
      </span>
    </RuleRow>
  )
}

export function RuleSwitch({
  title,
  help,
  checked,
  onChange,
}: {
  title: string
  help?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <RuleRow>
      <RuleLabel title={title} help={help} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative h-[38px] w-16 flex-none rounded-full transition-colors duration-180 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 ${
          checked ? 'bg-verde-500' : 'bg-crema-300'
        }`}
      >
        <span
          className={`absolute top-1 h-[30px] w-[30px] rounded-full bg-white shadow transition-[left] duration-180 ${
            checked ? 'left-[30px]' : 'left-1'
          }`}
          aria-hidden="true"
        />
      </button>
    </RuleRow>
  )
}

/** A vertical radiogroup: one option per row, with an example underneath. */
export function RuleChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  layout = 'rows',
}: {
  label: string
  options: { value: T; title: string; example?: string; badge?: string }[]
  value: T
  onChange: (value: T) => void
  /**
   * 'side-by-side' is the two-option form of onboarding-v2.md §2: equal columns
   * with a fixed minimum height, so both keep the same size when the selected
   * one goes from a 2px border to a 3px one.
   */
  layout?: 'rows' | 'side-by-side'
}) {
  const sideBySide = layout === 'side-by-side'

  return (
    <div>
      <p className="text-[19px] font-extrabold" id={`choice-${label}`}>
        {label}
      </p>
      <div
        className={`mt-2 ${sideBySide ? 'flex gap-2.5' : 'flex flex-col gap-2'}`}
        role="radiogroup"
        aria-labelledby={`choice-${label}`}
      >
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`box-border rounded-2xl bg-white text-left transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 ${
                sideBySide
                  ? 'flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 p-2 text-center'
                  : 'flex min-h-12 items-center gap-3 p-[13px]'
              } ${
                selected
                  ? 'border-[3px] border-tinta-900 shadow-pop-sm'
                  : 'border-2 border-crema-300 hover:bg-crema-100'
              }`}
            >
              {!sideBySide && (
                <span
                  className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full ${
                    selected ? 'bg-verde-500 text-[13px] text-white' : 'border-2 border-crema-400'
                  }`}
                  aria-hidden="true"
                >
                  {selected && '✓'}
                </span>
              )}
              <span className={sideBySide ? 'min-w-0' : 'min-w-0 flex-1'}>
                <span className={`flex items-center gap-2 ${sideBySide ? 'justify-center' : ''}`}>
                  <span className="text-base font-extrabold">{option.title}</span>
                  {option.badge && (
                    <span className="rounded-full bg-verde-100 px-2 py-0.5 text-xs font-extrabold text-verde-700">
                      {option.badge}
                    </span>
                  )}
                </span>
                {option.example && (
                  <span
                    className={`mt-0.5 block font-bold font-sans text-tinta-500 ${
                      sideBySide ? 'text-[12.5px]' : 'text-[13px]'
                    }`}
                  >
                    {option.example}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Multi-select chips. Marking none is a valid answer. */
export function RuleChips<T extends string>({
  title,
  help,
  options,
  selected,
  onToggle,
}: {
  title: string
  help?: string
  options: { value: T; label: string }[]
  selected: T[]
  onToggle: (value: T) => void
}) {
  return (
    <div className="rounded-[20px] border-2 border-crema-300 bg-white p-4">
      <p className="text-base font-extrabold" id={`chips-${title}`}>
        {title}
      </p>
      {help && (
        <p className="mt-0.5 text-[12.5px] font-bold font-sans text-tinta-500">{help}</p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-labelledby={`chips-${title}`}>
        {options.map((option) => {
          const on = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option.value)}
              className={`flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-[15px] font-extrabold transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 ${
                on
                  ? 'border-verde-500 bg-verde-500 text-white'
                  : 'border-crema-300 text-tinta-900 hover:bg-crema-100'
              }`}
            >
              {on && <span aria-hidden="true">✓</span>}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
