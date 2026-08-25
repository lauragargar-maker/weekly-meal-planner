# Product analytics events

The events ¡Ñam! sends to Amplitude, with their properties and where in the code each
one fires. Meant to make the dashboard readable without digging through the source.

**The code is the source of truth, not this document.** When you add, rename or remove
a `trackEvent`, update the matching table here too. To list them all:

```
grep -rn "trackEvent(" src/
```

## How it is wired

Everything goes through `trackEvent(name, properties?)` in `src/lib/analytics.ts`, a
thin wrapper over `@amplitude/unified`. Setup details that change how the numbers read:

- **EU region.** The Amplitude project lives in the European zone (`serverZone: 'EU'`)
  and the key only authenticates against that zone.
- **`autocapture` is on.** On top of the events below, Amplitude records page views,
  clicks and element interactions by itself. The ones listed here are the deliberate
  ones; the rest is automatic noise.
- **Session replay at 100%** (`sampleRate: 1`), with `defaultMaskLevel: 'medium'`: form
  fields (login email, household name, feedback text) are masked, static product text
  stays legible.
- **Identity.** `identifyUser(userId)` sets the user and `identifyHousehold(householdId)`
  puts them in the `household_id` group, so numbers can be counted per household and not
  only per person. `resetAnalytics()` clears both on sign-out.
- Without `VITE_AMPLITUDE_API_KEY` nothing initializes and every call is a no-op, so
  local development does not pollute the series.

## Sign-in and account

| Event | Properties | Where |
|---|---|---|
| `login_otp_requested` | — | `LoginScreen.tsx:21` |
| `login_otp_request_failed` | `reason` (error message, or `unknown`) | `LoginScreen.tsx:30` |
| `session_signed_in` | — | `AuthProvider.tsx:23` |
| `session_signed_out` | — | `AuthProvider.tsx:25` |

`login_otp_requested` fires **on submit**, before the request resolves: the funnel
measures drop-off between asking for a code and signing in, separately from technical
send failures.

> **Renamed, series intentionally split.** Both events were named after magic links
> (`login_link_requested`, `login_link_request_failed`) and kept those names for a while
> after sign-in moved to 6-digit OTP codes (M8, `docs/beta-plan.md`). They were renamed
> together on 2026-08-24. History before and after that date lives under two different
> names — read each pair as a merged event in Amplitude.

## Onboarding

| Event | Properties | Where |
|---|---|---|
| `household_created` | — | `OnboardingScreen.tsx:139` |
| `household_joined` | — | `OnboardingScreen.tsx:164` |
| `household_setup_failed` | `mode` (`create` \| `join`), `reason` | `OnboardingScreen.tsx:148`, `:169` |
| `catalog_seeded` | `dish_count` (dishes that were missing and got seeded) | `App.tsx:618` |

The funnel for a new household is: `login_otp_requested` → `session_signed_in` →
`household_created` (or `household_joined`) → `catalog_seeded` → `menu_generated`.

## Menu

| Event | Properties | Where |
|---|---|---|
| `menu_generated` | `week_start`, `trigger` (`manual` \| `next_week` \| `auto_initial_load`) | `App.tsx:243`, `:351` |
| `menu_degraded` | `unmet` (labels of the rules that could not be met, comma-separated; `rule_combination` when no single rule is to blame) | `App.tsx:172` |
| `week_regenerated` | — | `FamilyView.tsx:72` |
| `week_viewed` | `offset` (weeks relative to the current one: `-1`, `0`, `1`) | `App.tsx:450` |
| `next_week_menu_viewed` | — | `App.tsx:460` |

`menu_generated` with `trigger: 'auto_initial_load'` is the menu created automatically
when the app opens with no stored week. Nobody chose it, so keep it apart when measuring
intent.

`menu_degraded` is the signal that the generator could not satisfy every household rule.
If it climbs as new households arrive, the problem is in the rules, not in the interface.

## Menu editing

| Event | Properties | Where |
|---|---|---|
| `day_editor_opened` | `surface` (`sheet` on mobile \| `panel` on desktop) | `App.tsx:817` |
| `menu_item_edited` | `meal_type` (`lunch` \| `dinner`), `dish_slot` (`starter` \| `main` \| `single`) | `App.tsx:537` |
| `day_format_changed` | `meal_type`, `action` (`add` \| `remove` a first course) | `App.tsx:546`, `:551` |

## Dish catalog

| Event | Properties | Where |
|---|---|---|
| `dish_added` | `category` (`starter` \| `main` \| `single`) | `App.tsx:560`, `:582` |
| `dish_edited` | `category` | `App.tsx:576` |
| `dish_deleted` | — | `App.tsx:599` |

`dish_added` fires from two places: creating a dish from the catalog, and saving an
improvised one while editing the menu ("¿Lo guardamos?").

## Household and feedback

| Event | Properties | Where |
|---|---|---|
| `household_rules_saved` | — | `FamilyView.tsx:57` |
| `feedback_submitted` | `type` (`bug` \| `idea` \| `otro` \| `none`), `screen` (`semana` \| `platos` \| `familia`) | `FeedbackSheet.tsx:131` |

The feedback text itself does **not** reach Amplitude — it is stored in the `feedback`
table in Supabase. The event only counts how many and from which screen.
