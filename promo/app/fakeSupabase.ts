/**
 * An in-memory stand-in for the Supabase client, so the promo video can record
 * the real app without an account, a network or the dev database.
 *
 * Only the slice of the query builder the app uses is implemented. The tables
 * live in localStorage and every write is broadcast to the other tabs of the
 * same origin, which is what lets two phones of one household tick the same
 * list "in real time" in the video.
 */
import { buildDemoDatabase } from './demoData'

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>
type Filter = { column: string; op: 'eq' | 'neq' | 'in' | 'is'; value: unknown }
type ChangeEvent = { table: string; eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Row; old: Row }

const STORAGE_KEY = 'nam-promo-db'
const bus = new BroadcastChannel('nam-promo-db')

function load(): Tables {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as Tables
  } catch {
    // A corrupt copy is replaced by a fresh demo household.
  }
  const fresh = buildDemoDatabase()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  return fresh
}

let tables = load()

/** Wipes the demo back to its starting state, in every open tab. */
export function resetDemo() {
  localStorage.removeItem(STORAGE_KEY)
  tables = load()
}

const listeners = new Set<(event: ChangeEvent) => void>()

function persist(events: ChangeEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tables))
  for (const event of events) {
    listeners.forEach((listener) => listener(event))
    bus.postMessage(event)
  }
}

bus.onmessage = (message: MessageEvent<ChangeEvent>) => {
  tables = load()
  listeners.forEach((listener) => listener(message.data))
}

const table = (name: string): Row[] => (tables[name] ??= [])

const matches = (row: Row, filters: Filter[]) =>
  filters.every(({ column, op, value }) => {
    const actual = row[column] ?? null
    if (op === 'eq') return actual === value
    if (op === 'neq') return actual !== value
    if (op === 'is') return actual === value
    return (value as unknown[]).includes(actual)
  })

const now = () => new Date().toISOString()

const withDefaults = (name: string, row: Row): Row => {
  const base: Row = { ...row }
  if (name !== 'dish_ingredients' && base.id === undefined) base.id = crypto.randomUUID()
  if (base.created_at === undefined) base.created_at = now()
  if (base.updated_at === undefined && name !== 'shopping_list_items' && name !== 'dish_ingredients') {
    base.updated_at = now()
  }
  if (name === 'shopping_list_items') {
    base.checked ??= false
    base.checked_by ??= null
    base.checked_at ??= null
    base.sources ??= []
    base.ingredient_id ??= null
  }
  if (name === 'dish_ideas') base.recipe_url ??= null
  return base
}

type Result = { data: unknown; error: null }

class Query implements PromiseLike<Result> {
  private filters: Filter[] = []
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Row[] = []
  private patch: Row = {}
  private conflict: string[] = []
  private ignoreDuplicates = false
  private returning = false
  private ordering: { column: string; ascending: boolean } | null = null
  private cardinality: 'many' | 'single' | 'maybe' = 'many'

  constructor(private readonly name: string) {}

  select() {
    if (this.action !== 'select') this.returning = true
    return this
  }
  insert(rows: Row | Row[]) {
    this.action = 'insert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    return this
  }
  upsert(rows: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.action = 'upsert'
    this.payload = Array.isArray(rows) ? rows : [rows]
    this.conflict = (options.onConflict ?? 'id').split(',').map((column) => column.trim())
    this.ignoreDuplicates = Boolean(options.ignoreDuplicates)
    return this
  }
  update(patch: Row) {
    this.action = 'update'
    this.patch = patch
    return this
  }
  delete() {
    this.action = 'delete'
    return this
  }
  eq(column: string, value: unknown) {
    this.filters.push({ column, op: 'eq', value })
    return this
  }
  neq(column: string, value: unknown) {
    this.filters.push({ column, op: 'neq', value })
    return this
  }
  in(column: string, value: unknown[]) {
    this.filters.push({ column, op: 'in', value })
    return this
  }
  is(column: string, value: unknown) {
    this.filters.push({ column, op: 'is', value })
    return this
  }
  order(column: string, options: { ascending?: boolean } = {}) {
    this.ordering = { column, ascending: options.ascending ?? true }
    return this
  }
  limit() {
    return this
  }
  single() {
    this.cardinality = 'single'
    return this
  }
  maybeSingle() {
    this.cardinality = 'maybe'
    return this
  }

  private run(): Result {
    const rows = table(this.name)
    const events: ChangeEvent[] = []
    let out: Row[] = []

    if (this.action === 'select') {
      out = rows.filter((row) => matches(row, this.filters))
    } else if (this.action === 'insert') {
      out = this.payload.map((row) => withDefaults(this.name, row))
      rows.push(...out)
      out.forEach((row) => events.push({ table: this.name, eventType: 'INSERT', new: row, old: {} }))
    } else if (this.action === 'upsert') {
      for (const row of this.payload) {
        const existing = rows.find((candidate) => this.conflict.every((column) => candidate[column] === row[column]))
        if (existing) {
          if (this.ignoreDuplicates) continue
          const old = { ...existing }
          Object.assign(existing, row)
          out.push(existing)
          events.push({ table: this.name, eventType: 'UPDATE', new: existing, old })
        } else {
          const fresh = withDefaults(this.name, row)
          rows.push(fresh)
          out.push(fresh)
          events.push({ table: this.name, eventType: 'INSERT', new: fresh, old: {} })
        }
      }
    } else if (this.action === 'update') {
      out = rows.filter((row) => matches(row, this.filters))
      for (const row of out) {
        const old = { ...row }
        Object.assign(row, this.patch)
        events.push({ table: this.name, eventType: 'UPDATE', new: row, old })
      }
    } else {
      out = rows.filter((row) => matches(row, this.filters))
      tables[this.name] = rows.filter((row) => !out.includes(row))
      out.forEach((row) => events.push({ table: this.name, eventType: 'DELETE', new: {}, old: row }))
    }

    if (events.length > 0) persist(events)

    if (this.ordering) {
      const { column, ascending } = this.ordering
      out = [...out].sort((a, b) => {
        const left = String(a[column] ?? '')
        const right = String(b[column] ?? '')
        return (ascending ? 1 : -1) * left.localeCompare(right, 'es')
      })
    }

    const copy = (row: Row) => JSON.parse(JSON.stringify(row)) as Row
    if (this.action !== 'select' && !this.returning) return { data: null, error: null }
    if (this.cardinality === 'many') return { data: out.map(copy), error: null }
    return { data: out[0] ? copy(out[0]) : null, error: null }
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    // A short wait, so loading states and optimistic ticks behave as they do on a phone.
    return new Promise<Result>((resolve) => setTimeout(() => resolve(this.run()), 40)).then(onFulfilled, onRejected)
  }
}

type Handler = { table: string; filter?: string; callback: (payload: ChangeEvent) => void }

class Channel {
  readonly handlers: Handler[] = []
  private readonly listener = (event: ChangeEvent) => {
    for (const handler of this.handlers) {
      if (handler.table !== event.table) continue
      if (handler.filter) {
        const [column, rest] = handler.filter.split('=')
        const value = rest.replace(/^eq\./, '')
        const row = event.eventType === 'DELETE' ? event.old : event.new
        if (String(row[column]) !== value) continue
      }
      handler.callback(event)
    }
  }

  on(_type: string, options: { table: string; filter?: string }, callback: (payload: ChangeEvent) => void) {
    this.handlers.push({ table: options.table, filter: options.filter, callback })
    return this
  }
  subscribe() {
    listeners.add(this.listener)
    return this
  }
  unsubscribe() {
    listeners.delete(this.listener)
  }
}

export const supabase = {
  from: (name: string) => new Query(name),
  channel: () => new Channel(),
  removeChannel: (channel: Channel) => {
    channel.unsubscribe()
    return Promise.resolve('ok')
  },
  rpc: () => Promise.resolve({ data: null, error: null }),
  auth: {
    getSession: () => Promise.resolve({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOtp: () => Promise.resolve({ error: null }),
    verifyOtp: () => Promise.resolve({ error: null }),
    signOut: () => Promise.resolve({ error: null }),
  },
}
