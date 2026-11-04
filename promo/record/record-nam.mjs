/**
 * Records the clips of the ¡Ñam! promo video (the whole app, 55 s) from the
 * demo app (promo/app), on a 390×844 phone at 3x, into promo/out/nam/clips.
 * Script: docs/promo/guion-video-nam.md.
 *
 *   PW_DIR=<folder with playwright-core installed> CHROME=<chromium binary> \
 *     node promo/record/record-nam.mjs [clip …]
 *
 * The demo server must be running (npx vite --config promo/vite.config.ts).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE, item, launch, openList, phone, readDb, ready, recordClip, sleep, useOutDir, withList, writeDb } from './lib.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(here, '../out/nam/clips')

/** Reloads the app on the Semana screen, fonts in, scrolled to the top. */
async function reload(page) {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Lista de la compra' }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(700)
}

/** `ready`, with a recipe of the family's own on "Tortilla de la abuela". */
async function readyWithRecipe(page) {
  await ready(page)
  const db = await readDb(page)
  const dish = db.dish_ideas.find((row) => row.name === 'Tortilla de la abuela')
  dish.recipe_url = 'https://drive.google.com/file/d/receta-tortilla-de-la-abuela'
  await writeDb(page, db)
  await reload(page)
}

const CLIPS = {
  /** Semana, this week: the promise and the close. */
  async semana(browser) {
    const { page } = await phone(browser)
    await readyWithRecipe(page)
    return recordClip('semana', [page], async (act) => {
      await act.sleep(1500)
      act.mark('scroll')
      await act.scroll(page, 520, 2200)
      await act.sleep(600)
      await act.scroll(page, -520, 1400)
      await act.sleep(1200)
    })
  },

  /** A new household's rules: steps 1 and 2 of the onboarding. */
  async reglas(browser) {
    const { page } = await phone(browser)
    await page.goto(`${BASE}?onboarding`)
    await page.getByRole('button', { name: 'Crear un hogar' }).click()
    await page.locator('#household-name').fill('Casa Martín')
    await page.getByRole('button', { name: 'Seguir', exact: true }).click()
    await page.getByText('¿Cómo son tus comidas?').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await sleep(700)
    return recordClip('reglas', [page], async (act) => {
      await act.sleep(900)
      act.mark('comida')
      await act.tap(page.getByRole('radio', { name: /Primero y segundo/ }))
      await act.sleep(700)
      act.mark('cena')
      await act.tap(page.getByRole('radio', { name: /Un plato/ }))
      await act.sleep(600)
      act.mark('seguir')
      await act.tap(page.getByRole('button', { name: 'Seguir a las reglas' }))
      await page.getByText('¿Qué comes cada semana?').waitFor()
      act.mark('step2')
      await act.sleep(700)
      await act.tap(page.getByRole('button', { name: 'Añadir uno: Pescado al menos…' }), { hold: 260 })
      await act.sleep(350)
      act.mark('legumbre')
      await act.tap(page.getByRole('button', { name: 'Añadir uno: Legumbre al menos…' }), { hold: 260 })
      await act.sleep(350)
      act.mark('chips')
      await act.tap(page.getByRole('button', { name: /^Patata$/ }), { hold: 260 })
      await act.sleep(1200)
    })
  },

  /** The next week: opening it builds its menu on the spot. */
  async generar(browser) {
    const { page } = await phone(browser)
    await readyWithRecipe(page)
    const db = await readDb(page)
    db.weekly_menus = db.weekly_menus.filter((menu) => menu.id !== 'menu-next')
    await writeDb(page, db)
    await reload(page)
    return recordClip('generar', [page], async (act) => {
      await act.sleep(900)
      act.mark('tap')
      await act.tap(page.getByRole('button', { name: /siguiente/i }).first())
      await page.waitForFunction(() => /22 de noviembre/.test(document.body.innerText) && !/Montando/.test(document.body.innerText))
      act.mark('week')
      await act.sleep(2600)
      await act.scroll(page, 380, 1600)
      await act.sleep(1200)
    })
  },

  /** Tap the day: another dish, then swap it with another day. */
  async editar(browser) {
    const { page } = await phone(browser)
    await readyWithRecipe(page)
    await page.evaluate(() => window.scrollTo(0, 260))
    await sleep(500)
    return recordClip('editar', [page], async (act) => {
      await act.sleep(700)
      act.mark('day')
      await act.tap(page.getByRole('button', { name: /Editar el menú del jueves/ }))
      await page.getByText('Toca el plato que quieras cambiar.').waitFor()
      act.mark('sheet')
      await act.sleep(900)
      await act.tap(page.getByRole('button', { name: /Tortilla de la abuela/ }))
      await page.getByPlaceholder('Buscar un plato…').waitFor()
      act.mark('picker')
      await act.sleep(700)
      await act.tap(page.getByRole('button', { name: 'Pescado', exact: true }))
      await act.sleep(700)
      act.mark('pick')
      await act.tap(page.getByRole('button', { name: /Bacalao con tomate/ }).first())
      await page.getByRole('button', { name: /Intercambiar con otro día/ }).waitFor()
      act.mark('picked')
      await act.sleep(1000)
      act.mark('swap')
      await act.tap(page.getByRole('button', { name: /Intercambiar con otro día/ }))
      await page.getByText(/¿Con qué día cambias/).waitFor()
      await act.sleep(800)
      act.mark('friday')
      await act.tap(page.getByRole('button', { name: /Intercambiar con el viernes/i }).first())
      act.mark('swapped')
      await act.sleep(1400)
      const done = page.getByRole('button', { name: /Hecho/ })
      if (await done.isVisible().catch(() => false)) {
        act.mark('done')
        await act.tap(done)
      }
      await act.sleep(1600)
    })
  },

  /** Nuestros platos, the filters, and a dish of the family's own with its recipe. */
  async platos(browser) {
    const { page } = await phone(browser)
    await readyWithRecipe(page)
    await page.getByRole('button', { name: 'Platos' }).click()
    await page.getByLabel('Buscar platos').waitFor()
    await sleep(600)
    return recordClip('platos', [page], async (act) => {
      await act.sleep(700)
      await act.scroll(page, 700, 1300)
      await act.sleep(300)
      await act.scroll(page, -700, 600)
      act.mark('filter')
      await act.tap(page.getByRole('button', { name: 'Únicos', exact: true }))
      await act.sleep(1000)
      await act.tap(page.getByRole('button', { name: 'Todos', exact: true }))
      act.mark('search')
      const search = page.getByLabel('Buscar platos')
      await act.tap(search, { hold: 250 })
      await act.type(search, 'tortilla', 70)
      await act.sleep(500)
      act.mark('open')
      await act.tap(page.getByRole('button', { name: 'Ver Tortilla de la abuela' }))
      await page.getByRole('heading', { name: 'Tortilla de la abuela' }).waitFor()
      act.mark('sheet')
      await act.sleep(1400)
      await act.scroll(page, 300, 900)
      await act.sleep(1400)
    })
  },

  /** Semana → day picker → list by aisle, two ticks. */
  async lista(browser) {
    const { page } = await phone(browser)
    await readyWithRecipe(page)
    return recordClip('lista', [page], async (act) => {
      await act.sleep(700)
      act.mark('tapLista')
      await act.tap(page.getByRole('button', { name: 'Lista de la compra' }))
      await page.getByRole('dialog').getByText('Domingo 15').waitFor()
      act.mark('picker')
      await act.sleep(900)
      act.mark('tapGenerar')
      await act.tap(page.getByRole('button', { name: 'Generar lista' }))
      await page.getByRole('heading', { name: 'Lista de la compra' }).waitFor()
      act.mark('list')
      await act.sleep(1200)
      // Down to the end of the fruit and veg, so the ticks land mid-screen.
      const box = await page.getByText('Zanahoria', { exact: true }).boundingBox()
      await act.scroll(page, box.y - 470, 1300)
      await act.sleep(300)
      act.mark('ticks')
      // A ticked item drops to the end of its aisle, so the second waits for the first to settle.
      for (const name of ['Repollo', 'Tomate']) {
        await act.tap(item(page, name), { hold: 260 })
        await act.sleep(1000)
      }
      await act.sleep(900)
    })
  },

  /** Familia: the house code, and "Compartir". */
  async familia(browser) {
    const { page } = await phone(browser)
    await readyWithRecipe(page)
    const meta = await recordClip('familia', [page], async (act) => {
      await act.sleep(600)
      act.mark('tab')
      await act.tap(page.getByRole('button', { name: 'Familia' }))
      await page.getByText('Código de la casa').waitFor()
      act.mark('code')
      await act.sleep(1300)
      act.mark('share')
      await act.tap(page.getByRole('button', { name: 'Compartir' }))
      await act.sleep(1200)
    })
    meta.shared = (await page.evaluate(() => window.__namShared))?.text ?? ''
    fs.writeFileSync(path.join(OUT, 'familia.json'), JSON.stringify(meta, null, 2))
    return meta
  },

  /** Two phones of the household: what one ticks, the other sees. */
  async sync(browser) {
    const ana = await phone(browser)
    await withList(ana.page)
    const pablo = await ana.context.newPage()
    await pablo.goto(`${BASE}?user=pablo`)
    await openList(pablo)
    await openList(ana.page)
    for (const page of [ana.page, pablo]) {
      await page.getByText('Zanahoria', { exact: true }).evaluate((el) => el.scrollIntoView({ block: 'center' }))
    }
    await sleep(400)
    return recordClip('sync', [ana.page, pablo], async (act) => {
      await act.sleep(800)
      for (const name of ['Zanahoria', 'Tomate', 'Repollo']) {
        act.mark(name)
        await act.tap(item(ana.page, name))
        await act.sleep(900)
      }
      await act.sleep(500)
    })
  },
}

useOutDir(OUT)
const browser = await launch()
const wanted = process.argv.slice(2)
for (const [name, clip] of Object.entries(CLIPS)) {
  if (wanted.length && !wanted.includes(name)) continue
  await clip(browser)
}
await browser.close()
