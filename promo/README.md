# Promo videos

Two promos built from the real app, signed in to a demo household:

| Video | Script | Length | Formats | Final files |
|---|---|---|---|---|
| ¡Ñam! (the whole app) | `docs/promo/guion-video-nam.md` | 55 s | 1080×1920 and 1920×1080 | `docs/promo/nam-video-vertical.mp4`, `docs/promo/nam-video-horizontal.mp4` |
| Shopping list | `docs/promo/guion-video-lista-compra.md` | 45 s | 1080×1920 | `docs/promo/nam-lista-de-la-compra.mp4` |

## Pieces

- `app/`: the real `App`, signed in to a demo household. The Supabase client is
  swapped for an in-memory one (`fakeSupabase.ts`), so nothing reaches the dev or
  production database or Amplitude. "Today" is pinned to Monday 9 Nov 2026.
  `?onboarding` shows a new account with no household (the onboarding steps).
- `record/lib.mjs`: what both recorders share: the screencast, the clip encoder,
  the demo household's states and a 390×844 phone at 3x.
- `record/record-nam.mjs` and `record/record.mjs`: drive the demo with Playwright
  and record each scene (MP4 + taps JSON) for the ¡Ñam! and shopping list videos.
- `video/nam.html` and `video/index.html`: the composers (captions, phone frames,
  zooms, finger, chat, end card). `?play` previews in real time and `?t=12`
  freezes a moment. `nam.html?format=h` is the horizontal version.
- `record/render.mjs`: renders a composer frame by frame to MP4.
- `record/music.py`: synthesises the music bed, so there are no licensing issues.

## Setup

```bash
npx vite --config promo/vite.config.ts          # serves /app/ and /video/ on :5199
source promo/record/env.sh                      # PW_DIR and CHROME, adjust paths
```

Behind an HTTPS proxy (`HTTPS_PROXY` set), the browser sends Google Fonts through it
and reaches the demo server directly.

## ¡Ñam! video (55 s, vertical and horizontal)

```bash
node promo/record/record-nam.mjs                # all clips, or name some: reglas editar …
for c in semana reglas generar editar platos lista familia sync-0 sync-1; do
  rm -rf promo/out/nam/frames/$c && mkdir -p promo/out/nam/frames/$c
  ffmpeg -y -i promo/out/nam/clips/$c.mp4 -q:v 2 promo/out/nam/frames/$c/%05d.jpg
done
COMPOSER_URL='http://localhost:5199/video/nam.html' OUT_NAME=nam/video-v-sin-musica node promo/record/render.mjs
COMPOSER_URL='http://localhost:5199/video/nam.html?format=h' OUT_NAME=nam/video-h-sin-musica node promo/record/render.mjs
python3 promo/record/music.py promo/out/nam/musica.wav --length 55 --end 51.5
for f in v h; do
  ffmpeg -y -i promo/out/nam/video-$f-sin-musica.mp4 -i promo/out/nam/musica.wav -map 0:v -map 1:a \
    -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart promo/out/nam/video-$f.mp4
done
```

`--stills 3,9,20` on `render.mjs` saves PNGs of those moments to
`promo/out/nam/stills` instead of rendering the video.

The voice-over will be recorded later (ElevenLabs). The lines and their timings
are in the script, and `docs/promo/nam-musica.m4a` is the music bed on its own,
for mixing it under the voice.

## Shopping list video (45 s, vertical)

```bash
node promo/record/record.mjs                    # all clips, or name some: crear guia …
for c in crear guia ficha sync-0 sync-1 compartir extras; do
  mkdir -p promo/out/frames/$c && ffmpeg -y -i promo/out/clips/$c.mp4 -q:v 2 promo/out/frames/$c/%05d.jpg
done
node promo/record/render.mjs
python3 promo/record/music.py promo/out/musica.wav
ffmpeg -y -i promo/out/video-sin-musica.mp4 -i promo/out/musica.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart promo/out/nam-lista-de-la-compra.mp4
```

`out/` is not committed: copy the final renders to `docs/promo/` when they change.
