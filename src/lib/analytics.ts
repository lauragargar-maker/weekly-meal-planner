import * as amplitude from '@amplitude/analytics-browser'

const apiKey = import.meta.env.VITE_AMPLITUDE_API_KEY || ''

let initialized = false

export const initAnalytics = (): void => {
  if (!apiKey || initialized) return
  amplitude.init(apiKey, {
    defaultTracking: {
      pageViews: true,
      sessions: true,
      formInteractions: false,
      fileDownloads: false,
    },
  })
  initialized = true
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
