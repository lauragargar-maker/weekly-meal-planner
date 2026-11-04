/**
 * Renders promo/video (the composer) frame by frame into the final MP4.
 *
 *   node promo/record/render.mjs                 → promo/out/video-sin-musica.mp4
 *   node promo/record/render.mjs --stills 3,9,20 → promo/out/stills/*.png
 *
 * Another composer: COMPOSER_URL picks it and OUT_NAME names the file. The
 * composer sets window.composerSize ({ width, height, duration }); without it
 * the video is the shopping list one, 1080×1920 and 45 s.
 *
 *   COMPOSER_URL='http://localhost:5199/video/nam.html?format=h' OUT_NAME=nam/video-h-sin-musica \
 *     node promo/record/render.mjs
 *
 * Needs the same PW_DIR and CHROME as record.mjs, and the demo server running.
 */
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(path.join(process.env.PW_DIR, 'package.json'))
const { chromium } = require('playwright-core')

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(here, '../out')
const URL = process.env.COMPOSER_URL ?? 'http://localhost:5199/video/'
const FPS = 30
const NAME = process.env.OUT_NAME ?? 'video-sin-musica'

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, proxy })
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
page.on('pageerror', (err) => console.error('page error:', err.message))
await page.goto(URL)
await page.waitForFunction(() => window.composerReady === true, null, { timeout: 60000 })
const { width, height, duration: DURATION } = await page.evaluate(() => window.composerSize ?? { width: 1080, height: 1920, duration: 45 })
await page.setViewportSize({ width, height })

const stills = process.argv.indexOf('--stills')
if (stills > 0) {
  const dir = path.join(OUT, path.dirname(NAME), 'stills')
  fs.mkdirSync(dir, { recursive: true })
  for (const t of process.argv[stills + 1].split(',').map(Number)) {
    await page.evaluate((time) => window.renderAt(time), t)
    await page.screenshot({ path: path.join(dir, `${width > height ? 'h' : 'v'}-t${String(t).padStart(5, '0')}.png`) })
  }
} else {
  const file = path.join(OUT, `${NAME}.mp4`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const total = DURATION * FPS
  for (let frame = 0; frame < total; frame++) {
    await page.evaluate((time) => window.renderAt(time), frame / FPS)
    const shot = await page.screenshot({ type: 'jpeg', quality: 95 })
    if (!ffmpeg.stdin.write(shot)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve))
    if (frame % 150 === 0) console.log(`${(frame / FPS).toFixed(0)} s`)
  }
  ffmpeg.stdin.end()
  await new Promise((resolve) => ffmpeg.on('close', resolve))
  console.log(`✔ ${file}`)
}
await browser.close()
