/**
 * Records the clips of the promo video from the demo app (promo/app), on a
 * 390×844 phone at 3x, and writes them to promo/out/clips as MP4 plus a JSON
 * with each clip's taps so the composer can draw the finger.
 *
 *   PW_DIR=<folder with playwright-core installed> CHROME=<chromium binary> \
 *     node promo/record/record.mjs [clip …]
 *
 * The demo server must be running (npx vite --config promo/vite.config.ts).
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(path.join(process.env.PW_DIR, 'package.json'))
const { chromium } = require('playwright-core')

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(here, '../out/clips')
const BASE = process.env.BASE_URL ?? 'http://localhost:5199/app/'
const VIEWPORT = { width: 390, height: 844 }
const SCALE = 3
const FPS = 30

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------- recording

/** Captures a page through the DevTools screencast, frame by frame. */
async function startCapture(page, label) {
  const cdp = await page.context().newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
    frames.push({ data, at: metadata.timestamp })
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 95,
    maxWidth: VIEWPORT.width * SCALE,
    maxHeight: VIEWPORT.height * SCALE,
    everyNthFrame: 1,
  })
  return {
    label,
    async stop(from, to) {
      await cdp.send('Page.stopScreencast')
      return { frames, from, to }
    },
  }
}

/** Turns timestamped frames into a constant-frame-rate MP4. */
function encode({ frames, from, to }, file) {
  const dir = fs.mkdtempSync(path.join(OUT, '.frames-'))
  const lines = []
  const kept = frames.filter((frame) => frame.at <= to)
  kept.forEach((frame, index) => {
    const name = `${String(index).padStart(5, '0')}.jpg`
    fs.writeFileSync(path.join(dir, name), Buffer.from(frame.data, 'base64'))
    const start = Math.max(frame.at, from)
    const end = index + 1 < kept.length ? Math.max(kept[index + 1].at, from) : to
    lines.push(`file '${name}'`, `duration ${Math.max(end - start, 0.001).toFixed(4)}`)
  })
  // The concat demuxer drops the last entry's duration unless the file is listed once more; -t trims the extra.
  lines.push(`file '${String(kept.length - 1).padStart(5, '0')}.jpg'`)
  fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'))
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-vf', `fps=${FPS},scale=${VIEWPORT.width * SCALE}:${VIEWPORT.height * SCALE}:flags=lanczos,format=yuv420p`,
    '-t', (to - from).toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', file,
  ])
  fs.rmSync(dir, { recursive: true })
}

/**
 * Records one clip. `script` gets a `act` helper bound to the clock of the
 * clip, so every tap lands in the JSON with its time and place.
 */
async function recordClip(name, pages, script) {
  const captures = await Promise.all(pages.map((page, index) => startCapture(page, index)))
  await sleep(300)
  const start = Date.now() / 1000
  const taps = []
  const marks = {}
  const now = () => Date.now() / 1000 - start

  const act = {
    /** Shows the finger on an element, then taps it. */
    async tap(locator, { page = 0, hold = 380 } = {}) {
      await locator.scrollIntoViewIfNeeded()
      const box = await locator.boundingBox()
      taps.push({ t: now(), x: box.x + box.width / 2, y: box.y + box.height / 2, page })
      await sleep(hold)
      await locator.click()
    },
    async type(locator, text, delay = 85) {
      await locator.pressSequentially(text, { delay })
    },
    mark(key) {
      marks[key] = now()
    },
    async scroll(page, dy, ms = 1200) {
      const steps = Math.round(ms / 16)
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy / steps)
        await sleep(16)
      }
    },
    sleep,
    now,
  }

  await script(act)
  const end = Date.now() / 1000
  const results = await Promise.all(captures.map((capture) => capture.stop(start, end)))
  const files = results.map((result, index) => {
    const file = pages.length === 1 ? `${name}.mp4` : `${name}-${index}.mp4`
    encode(result, path.join(OUT, file))
    return file
  })
  const meta = { name, duration: end - start, files, taps, marks, viewport: VIEWPORT }
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(meta, null, 2))
  console.log(`✔ ${name}: ${meta.duration.toFixed(1)} s, ${taps.length} taps`)
  return meta
}

// ---------------------------------------------------------------- demo states

const DB_KEY = 'nam-promo-db'
const readDb = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DB_KEY)
const writeDb = (page, db) => page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [DB_KEY, db])

async function open(page, query = '') {
  await page.goto(`${BASE}${query}`)
  await page.getByRole('button', { name: 'Lista de la compra' }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await sleep(500)
}

/** A fresh household: starter ingredients seeded, own dishes still empty. */
async function fresh(page) {
  await open(page, '?reset')
  for (let i = 0; i < 50; i++) {
    const db = await readDb(page)
    if (db.households[0].ingredients_seeded_at && db.dish_ingredients.length > 0) break
    await sleep(100)
  }
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Lista de la compra' }).waitFor()
}

const OWN_INGREDIENTS = {
  'Pollo al curry': ['Pechuga de pollo', 'Leche de coco', 'Curry', 'Arroz basmati', 'Cebolla'],
  'Quiche de puerros': ['Puerro', 'Masa quebrada', 'Huevos', 'Nata para cocinar', 'Queso rallado'],
  'Tortilla de la abuela': ['Patata', 'Huevos', 'Pimiento verde', 'Cebolla'],
}

const OWN_SECTIONS = {
  'Pechuga de pollo': 'meat',
  'Leche de coco': 'grocery',
  Curry: 'grocery',
  'Arroz basmati': 'grocery',
  'Masa quebrada': 'dairy_eggs',
}

async function addIngredients(page, names) {
  const field = page.getByPlaceholder('Escribe un ingrediente…')
  for (const name of names) {
    await field.fill(name)
    await field.press('Enter')
  }
}

/** The household after going through the guide once: every dish has ingredients, no list yet. */
async function ready(page) {
  await fresh(page)
  await page.getByRole('button', { name: 'Lista de la compra' }).click()
  await page.getByRole('button', { name: 'Generar lista' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  for (const dish of Object.keys(OWN_INGREDIENTS)) {
    await page.getByRole('heading', { name: dish }).waitFor()
    await addIngredients(page, OWN_INGREDIENTS[dish])
    await page.getByRole('button', { name: /^(Siguiente|Guardar y hacer la lista)$/ }).click()
  }
  await page.getByText(/por comprar/).waitFor()
  // What the family would set from each chip's menu: the aisle of their own ingredients.
  const db = await readDb(page)
  for (const row of db.ingredients) {
    const section = OWN_SECTIONS[row.name]
    if (section) row.section = section
  }
  await writeDb(page, db)
  await dropList(page)
}

async function dropList(page) {
  const db = await readDb(page)
  db.shopping_lists = []
  db.shopping_list_items = []
  await writeDb(page, db)
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Lista de la compra' }).waitFor()
}

/** `ready`, plus a list for Tuesday to Sunday open on screen. */
async function withList(page) {
  await ready(page)
  await page.getByRole('button', { name: 'Lista de la compra' }).click()
  await page.getByRole('dialog').getByText('Domingo 15').click()
  await page.getByRole('button', { name: 'Generar lista' }).click()
  await page.getByText(/por comprar/).waitFor()
}

async function openList(page) {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Lista de la compra' }).click()
  await page.getByRole('button', { name: 'Compartir' }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await sleep(600)
}

const item = (page, name) => page.locator('label').filter({ has: page.getByText(name, { exact: true }) }).first()

// ---------------------------------------------------------------- clips

const CLIPS = {
  /** Semana → day picker → list, sorted by aisle. */
  async crear(browser) {
    const { page } = await phone(browser)
    await ready(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    await sleep(800)
    return recordClip('crear', [page], async (act) => {
      await act.sleep(1600)
      act.mark('tapLista')
      await act.tap(page.getByRole('button', { name: 'Lista de la compra' }))
      await page.getByRole('dialog').getByText('Domingo 15').waitFor()
      act.mark('picker')
      await act.sleep(1300)
      await act.tap(page.getByRole('dialog').getByText('Domingo 15'))
      await act.sleep(700)
      act.mark('tapGenerar')
      await act.tap(page.getByRole('button', { name: 'Generar lista' }))
      await page.getByRole('heading', { name: 'Lista de la compra' }).waitFor()
      act.mark('list')
      await act.sleep(1500)
      await act.scroll(page, 900, 2600)
      await act.sleep(800)
    })
  },

  /** The guided flow for the household's own dishes. */
  async guia(browser) {
    const { page } = await phone(browser)
    await fresh(page)
    await page.getByRole('button', { name: 'Lista de la compra' }).click()
    await page.getByRole('button', { name: 'Generar lista' }).waitFor()
    await sleep(600)
    return recordClip('guia', [page], async (act) => {
      await act.sleep(500)
      await act.tap(page.getByRole('button', { name: 'Generar lista' }))
      await page.getByRole('button', { name: 'Empezar' }).waitFor()
      act.mark('intro')
      await act.sleep(2200)
      await act.tap(page.getByRole('button', { name: 'Empezar' }))
      const field = page.getByPlaceholder('Escribe un ingrediente…')
      await field.waitFor()
      act.mark('step')
      await act.sleep(600)
      await act.tap(field, { hold: 250 })
      for (const name of ['Pechuga de pollo', 'Leche de coco', 'Curry']) {
        await act.type(field, name, 70)
        await act.sleep(150)
        await field.press('Enter')
        await act.sleep(300)
      }
      // Autocomplete: the catalogue already knows "Cebolla", a staple.
      await act.type(field, 'Ceb', 110)
      await act.sleep(500)
      const suggestion = page.getByRole('button', { name: /Cebolla/ }).first()
      if (await suggestion.count()) await act.tap(suggestion, { hold: 300 })
      else await field.press('Enter')
      await act.sleep(500)
      act.mark('recipe')
      const recipe = page.getByPlaceholder('Enlace a una web de recetas o a tu Drive')
      await act.tap(recipe, { hold: 250 })
      await recipe.fill('https://drive.google.com/file/d/receta-pollo-al-curry')
      await act.sleep(900)
      act.mark('next')
      await act.tap(page.getByRole('button', { name: 'Siguiente', exact: true }))
      await page.getByRole('heading', { name: 'Quiche de puerros' }).waitFor()
      await act.sleep(1200)
    })
  },

  /** A starter dish's sheet: ingredients, staples and the recipe. */
  async ficha(browser) {
    const { page } = await phone(browser)
    await ready(page)
    await page.getByRole('button', { name: 'Platos' }).click()
    await page.getByLabel('Buscar platos').fill('lentejas')
    await sleep(600)
    return recordClip('ficha', [page], async (act) => {
      await act.sleep(700)
      await act.tap(page.getByRole('button', { name: 'Ver Lentejas con verduras' }))
      await page.getByText(/Ver receta en/).waitFor()
      act.mark('sheet')
      await act.sleep(1400)
      await act.scroll(page, 500, 1200)
      await act.sleep(1500)
    })
  },

  /** Two phones of the household ticking the same list. */
  async sync(browser) {
    const ana = await phone(browser)
    await withList(ana.page)
    const pablo = await ana.context.newPage()
    await pablo.goto(`${BASE}?user=pablo`)
    await openList(pablo)
    await openList(ana.page)
    // The last of the fruit and veg: ticked, they stay where they are instead of dropping out of sight.
    for (const page of [ana.page, pablo]) {
      await page.getByText('Zanahoria', { exact: true }).evaluate((el) => el.scrollIntoView({ block: 'center' }))
    }
    await sleep(400)
    return recordClip('sync', [ana.page, pablo], async (act) => {
      await act.sleep(1000)
      for (const name of ['Zanahoria', 'Tomate', 'Repollo']) {
        act.mark(name)
        await act.tap(item(ana.page, name))
        await act.sleep(1100)
      }
      await act.sleep(600)
    })
  },

  /** "Compartir": the text the phone's share sheet receives. */
  async compartir(browser) {
    const { page } = await phone(browser)
    await withList(page)
    await openList(page)
    const meta = await recordClip('compartir', [page], async (act) => {
      await act.sleep(800)
      act.mark('tapShare')
      await act.tap(page.getByRole('button', { name: 'Compartir' }))
      await act.sleep(1200)
    })
    const shared = await page.evaluate(() => window.__namShared)
    meta.shared = shared?.text ?? ''
    fs.writeFileSync(path.join(OUT, 'compartir.json'), JSON.stringify(meta, null, 2))
    return meta
  },

  /** Add by hand, "Siempre lo tengo en casa" and "¡Todo comprado!". */
  async extras(browser) {
    const { page } = await phone(browser)
    await withList(page)
    // Everything but the fruit and veg is already in the trolley.
    const db = await readDb(page)
    const keep = new Set(['Tomate', 'Zanahoria', 'Puerro'])
    for (const row of db.shopping_list_items) {
      if (!keep.has(row.name)) Object.assign(row, { checked: true, checked_by: 'user-pablo', checked_at: new Date().toISOString() })
    }
    db.shopping_list_items = db.shopping_list_items.filter((row) => row.section !== 'produce' || keep.has(row.name))
    await writeDb(page, db)
    await openList(page)
    return recordClip('extras', [page], async (act) => {
      await act.sleep(700)
      act.mark('add')
      const field = page.getByPlaceholder('Añadir artículo…')
      await act.tap(field, { hold: 250 })
      await act.type(field, 'Plátano', 90)
      await act.sleep(250)
      await act.tap(page.getByRole('button', { name: 'Añadir', exact: true }), { hold: 250 })
      await act.sleep(900)
      act.mark('staple')
      await act.tap(page.getByRole('button', { name: 'Más opciones para Zanahoria' }), { hold: 300 })
      await act.sleep(500)
      await act.tap(page.getByRole('button', { name: 'Siempre lo tengo en casa' }), { hold: 300 })
      await act.sleep(1500)
      act.mark('ticks')
      for (const name of ['Tomate', 'Puerro', 'Plátano']) {
        await act.tap(item(page, name), { hold: 260 })
        await act.sleep(350)
      }
      await page.getByText('¡Todo comprado!').waitFor()
      await page.evaluate(() => document.querySelector('.fixed.inset-0.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' }))
      act.mark('done')
      await act.sleep(2400)
    })
  },

  /** The Semana screen on its own, for the opening and the close. */
  async semana(browser) {
    const { page } = await phone(browser)
    await ready(page)
    await sleep(600)
    return recordClip('semana', [page], async (act) => {
      await act.sleep(4000)
    })
  },
}

async function phone(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: false,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    colorScheme: 'light',
  })
  const page = await context.newPage()
  return { context, page }
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true })
const wanted = process.argv.slice(2)
for (const [name, clip] of Object.entries(CLIPS)) {
  if (wanted.length && !wanted.includes(name)) continue
  await clip(browser)
}
await browser.close()
