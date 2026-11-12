/**
 * "Today" for a household, wherever the server happens to run.
 *
 * The week helpers in `utils/weekStart.ts` read the local clock, which in the
 * browser is the family's own. The MCP server runs in UTC, where late on a
 * Sunday night in Spain it is still Sunday but a few hours earlier it would
 * disagree around midnight — and a wrong Monday queries a week that is not
 * there. Product weeks are Europe/Madrid (docs/product-kpis.md), so the date is
 * read in that zone and handed on as a local date at noon: every helper
 * downstream only looks at the calendar day.
 */
export const madridToday = (now: Date = new Date()): Date => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return new Date(part('year'), part('month') - 1, part('day'), 12)
}
