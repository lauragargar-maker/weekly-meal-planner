# Promo video: shopping list

Builds the 45-second vertical (1080×1920) promo of the shopping list from the real
app. Script: `docs/promo/guion-video-lista-compra.md`.

- `app/`: the real `App`, signed in to a demo household. The Supabase client is
  swapped for an in-memory one (`fakeSupabase.ts`), so nothing reaches the dev or
  production database or Amplitude. "Today" is pinned to Monday 9 Nov 2026.
- `record/record.mjs`: drives the demo with Playwright on a 390×844 phone at 3x and
  records each scene to `out/clips` (MP4 + taps JSON).
- `video/index.html`: the composer (captions, phone frames, zooms, finger, chat,
  end card). `?play` previews it in real time and `?t=12` freezes a moment.
- `record/render.mjs`: renders the composer frame by frame to `out/video-sin-musica.mp4`.
- `record/music.py`: synthesises the music bed (`out/musica.wav`), so there are no
  licensing issues.

```bash
npx vite --config promo/vite.config.ts          # serves /app/ and /video/ on :5199
source promo/record/env.sh                      # PW_DIR and CHROME, adjust paths
node promo/record/record.mjs                    # all clips, or name some: crear guia …
for c in crear guia ficha sync-0 sync-1 compartir extras; do
  mkdir -p promo/out/frames/$c && ffmpeg -y -i promo/out/clips/$c.mp4 -q:v 2 promo/out/frames/$c/%05d.jpg
done
node promo/record/render.mjs
python3 promo/record/music.py promo/out/musica.wav
ffmpeg -y -i promo/out/video-sin-musica.mp4 -i promo/out/musica.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart promo/out/nam-lista-de-la-compra.mp4
```

`out/` is not committed. The final video is kept at
`docs/promo/nam-lista-de-la-compra.mp4`: copy the new render there when it changes.
