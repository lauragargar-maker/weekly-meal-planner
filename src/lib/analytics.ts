import * as amplitude from '@amplitude/unified'

const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY || ''

let initialized = false

export const initAnalytics = (): void => {
  if (!apiKey || initialized) return
  initialized = true
  void amplitude.initAll(apiKey, {
    analytics: {
      autocapture: true,
    },
    sessionReplay: {
      sampleRate: 1,
      // Mask all text/inputs by default (login email, household name,
      // feedback text) rather than opting fields out one by one.
      privacyConfig: {
        defaultMaskLevel: 'conservative',
      },
    },
  })
}

export const identifyUser = (userId: string): void => {
  if (!initialized) return
  amplitude.setUserId(userId)
}

export const identifyHousehold = (householdId: string): void => {
  if (!initialized) return
  amplitude.setGroup('household_id', householdId)
}

export const trackEvent = (name: string, properties?: Record<string, unknown>): void => {
  if (!initialized) return
  amplitude.track(name, properties)
}

export const resetAnalytics = (): void => {
  if (!initialized) return
  amplitude.reset()
}
