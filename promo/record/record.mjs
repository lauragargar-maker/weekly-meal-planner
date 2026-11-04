/**
 * Records the clips of the shopping list promo video from the demo app
 * (promo/app), on a 390×844 phone at 3x, and writes them to promo/out/clips as
 * MP4 plus a JSON with each clip's taps so the composer can draw the finger.
 *
 *   PW_DIR=<folder with playwright-core installed> CHROME=<chromium binary> \
 *     node promo/record/record.mjs [clip …]
 *
 * The demo server must be running (npx vite --config promo/vite.config.ts).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE, fresh, item, launch, openList, phone, readDb, ready, recordClip, sleep, useOutDir, withList, writeDb } from './lib.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(here, '../out/clips')

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

useOutDir(OUT)
const browser = await launch()
const wanted = process.argv.slice(2)
for (const [name, clip] of Object.entries(CLIPS)) {
  if (wanted.length && !wanted.includes(name)) continue
  await clip(browser)
}
await browser.close()
