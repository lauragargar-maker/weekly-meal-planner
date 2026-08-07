/**
 * The header the numbered steps share.
 *
 * Only the three steps that configure the house are numbered: the branch, the
 * create screen and the join screen carry a label and no progress bar. The old
 * flow promised "3 pasos" and then asked for things that were in none of them.
 */
export default function OnboardingHeader({
  label,
  step,
  onBack,
}: {
  label: string
  /** 1-3 for the numbered steps; omit on the screens that are not steps. */
  step?: 1 | 2 | 3
  onBack: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver"
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-white text-xl font-extrabold text-tinta-900 transition-colors duration-120 hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
      >
        <span aria-hidden="true">‹</span>
      </button>

      <div className="min-w-0 flex-1">
        {step && (
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((segment) => (
              <span
                key={segment}
                className={`h-1.5 flex-1 rounded-full ${
                  segment <= step ? 'bg-verde-500' : 'bg-crema-300'
                }`}
              />
            ))}
          </div>
        )}
        <p className={`text-xs font-extrabold uppercase tracking-[0.08em] text-tinta-300 ${step ? 'mt-2' : ''}`}>
          {label}
        </p>
      </div>
    </div>
  )
}
