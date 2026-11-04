/**
 * What both promo recorders share: the DevTools screencast, the clip encoder,
 * the demo household's states and a phone-sized browser context.
 *
 *   PW_DIR=<folder with playwright-core installed> CHROME=<chromium binary>
 *
 * The demo server must be running (npx vite --config promo/vite.config.ts).
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(path.join(process.env.PW_DIR, 'package.json'))
const { chromium } = require('playwright-core')

export const BASE = process.env.BASE_URL ?? 'http://localhost:5199/app/'
export const VIEWPORT = { width: 390, height: 844 }
export const SCALE = 3
export const FPS = 30

let outDir = null

/** Where the clips go: created if missing. */
export function useOutDir(dir) {
  outDir = dir
  fs.mkdirSync(dir, { recursive: true })
}

/** Headless Chromium; behind an HTTPS proxy, Google Fonts go through it and the demo server does not. */
export function launch() {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined
  return chromium.launch({ executablePath: process.env.CHROME, headless: true, proxy })
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------- recording

/** Captures a page through the DevTools screencast, frame by frame. */
export async function startCapture(page, label) {
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
export function encode({ frames, from, to }, file) {
  const dir = fs.mkdtempSync(path.join(outDir, '.frames-'))
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
export async function recordClip(name, pages, script) {
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
    encode(result, path.join(outDir, file))
    return file
  })
  const meta = { name, duration: end - start, files, taps, marks, viewport: VIEWPORT }
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(meta, null, 2))
  console.log(`✔ ${name}: ${meta.duration.toFixed(1)} s, ${taps.length} taps`)
  return meta
}

// ---------------------------------------------------------------- demo states

export const DB_KEY = 'nam-promo-db'
export const readDb = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DB_KEY)
export const writeDb = (page, db) => page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [DB_KEY, db])

export async function open(page, query = '') {
  await page.goto(`${BASE}${query}`)
  await page.getByRole('button', { name: 'Lista de la compra' }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await sleep(500)
}

/** A fresh household: starter ingredients seeded, own dishes still empty. */
export async function fresh(page) {
  await open(page, '?reset')
  for (let i = 0; i < 50; i++) {
    const db = await readDb(page)
    if (db.households[0].ingredients_seeded_at && db.dish_ingredients.length > 0) break
    await sleep(100)
  }
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Lista de la compra' }).waitFor()
}

export const OWN_INGREDIENTS = {
  'Pollo al curry': ['Pechuga de pollo', 'Leche de coco', 'Curry', 'Arroz basmati', 'Cebolla'],
  'Quiche de puerros': ['Puerro', 'Masa quebrada', 'Huevos', 'Nata para cocinar', 'Queso rallado'],
  'Tortilla de la abuela': ['Patata', 'Huevos', 'Pimiento verde', 'Cebolla'],
}

export const OWN_SECTIONS = {
  'Pechuga de pollo': 'meat',
  'Leche de coco': 'grocery',
  Curry: 'grocery',
  'Arroz basmati': 'grocery',
  'Masa quebrada': 'dairy_eggs',
}

export async function addIngredients(page, names) {
  const field = page.getByPlaceholder('Escribe un ingrediente…')
  for (const name of names) {
    await field.fill(name)
    await field.press('Enter')
  }
}

/** The household after going through the guide once: every dish has ingredients, no list yet. */
export async function ready(page) {
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

export async function dropList(page) {
  const db = await readDb(page)
  db.shopping_lists = []
  db.shopping_list_items = []
  await writeDb(page, db)
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Lista de la compra' }).waitFor()
}

/** `ready`, plus a list for Tuesday to Sunday open on screen. */
export async function withList(page) {
  await ready(page)
  await page.getByRole('button', { name: 'Lista de la compra' }).click()
  await page.getByRole('dialog').getByText('Domingo 15').click()
  await page.getByRole('button', { name: 'Generar lista' }).click()
  await page.getByText(/por comprar/).waitFor()
}

export async function openList(page) {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Lista de la compra' }).click()
  await page.getByRole('button', { name: 'Compartir' }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await sleep(600)
}

export const item = (page, name) => page.locator('label').filter({ has: page.getByText(name, { exact: true }) }).first()


export async function phone(browser) {
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
