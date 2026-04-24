export const SETTINGS = {
  // Day of week from which the user can access next week's menu.
  // Uses JS getDay() convention: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.
  // Sat(6) always resets (it starts the new current week) regardless of this value.
  upcomingWeekUnlockDay: 3, // Wednesday
}
