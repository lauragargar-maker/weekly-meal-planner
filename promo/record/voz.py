"""
The voice-over of the ¡Ñam! promo, with ElevenLabs: one take per line of
promo/video/nam-voz.json, each placed at its start time, mixed over the music
bed with the music ducking under the voice.

    ELEVENLABS_API_KEY=… python3 promo/record/voz.py promo/out/nam/voz [--voice ID] [--only 03-reglas,05-editar]

Writes, in the output folder:
- lineas/<id>.mp3: each line, as ElevenLabs returned it. A line is not asked
  for again while its text, voice and settings are unchanged, so trying a new
  wording only spends the characters of that line.
- lineas/<id>.wav: the same take with the silence at both ends trimmed and,
  if it ran a little long, sped up to fit its slot.
- voz.wav: the voice track alone, 55 s, every line at its time.
- mezcla.wav: voice and music together, ready to go under the video.

A line longer than its slot (start → end) is sped up here, without asking
ElevenLabs again (that would spend its characters twice), up to 12 % faster.
If it still does not fit, the script says so: shorten that text in nam-voz.json.

Then, for each format:

    ffmpeg -y -i promo/out/nam/video-v-sin-musica.mp4 -i promo/out/nam/voz/mezcla.wav -map 0:v -map 1:a \
      -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart promo/out/nam/video-v-voz.mp4
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG = HERE.parent / "video" / "nam-voz.json"
MUSIC = HERE.parent / "out" / "nam" / "musica.wav"
LENGTH = 55.0
MAX_TEMPO = 1.12

parser = argparse.ArgumentParser()
parser.add_argument("out", type=Path)
parser.add_argument("--voice", help="voice id; overrides nam-voz.json")
parser.add_argument("--only", help="comma-separated line ids to (re)generate; the mix still uses every line")
parser.add_argument("--music", type=Path, default=MUSIC)
parser.add_argument("--music-gain", type=float, default=0.55, help="music level under the voice, before ducking")
args = parser.parse_args()

config = json.loads(CONFIG.read_text())
voice = args.voice or config["voice_id"]
if not voice:
    sys.exit("No voice: set voice_id in nam-voz.json or pass --voice.")
key = os.environ.get("ELEVENLABS_API_KEY")
if not key:
    sys.exit("Set ELEVENLABS_API_KEY.")

lines_dir = args.out / "lineas"
lines_dir.mkdir(parents=True, exist_ok=True)
only = set(args.only.split(",")) if args.only else None
lines = config["lines"]


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    )
    value = out.stdout.strip()
    if value in ("", "N/A"):
        sys.exit(f"{path}: no audio left after trimming the silence; listen to the take and ask for it again.")
    return float(value)


def speak(index, speed):
    line = lines[index]
    body = {
        "text": line["text"],
        "model_id": config["model_id"],
        "language_code": config.get("language_code"),
        "voice_settings": {**config["voice_settings"], "speed": speed},
        # The neighbouring lines, so each take keeps the intonation of a single read.
        "previous_text": lines[index - 1]["text"] if index > 0 else None,
        "next_text": lines[index + 1]["text"] if index + 1 < len(lines) else None,
    }
    request = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
        data=json.dumps({k: v for k, v in body.items() if v is not None}).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError as err:
        sys.exit(f"{line['id']}: ElevenLabs answered {err.code}: {err.read().decode(errors='replace')[:400]}")


def fit(line, mp3, wav):
    """Trims the silence at both ends and, if the take is a little long, speeds it up."""
    trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-af", trim, str(wav)], check=True)
    slot = line["end"] - line["start"]
    took = duration(wav)
    tempo = 1.0
    if took > slot:
        tempo = min(MAX_TEMPO, took / slot)
        tmp = wav.with_suffix(".tmp.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", f"atempo={tempo:.4f}", str(tmp)], check=True)
        tmp.replace(wav)
    fitted = duration(wav)
    verdict = "ok" if fitted <= slot + 0.02 else f"NO CABE: {fitted - slot:.2f} s de más, acorta el texto"
    print(f"{line['id']}: {took:.2f} s de {slot:.2f} s, tempo {tempo:.2f} → {fitted:.2f} s {verdict}")


for index, line in enumerate(lines):
    mp3 = lines_dir / f"{line['id']}.mp3"
    stamp = lines_dir / f"{line['id']}.json"
    signature = hashlib.sha1(
        json.dumps([line["text"], voice, config["model_id"], config["voice_settings"]], sort_keys=True).encode()
    ).hexdigest()
    cached = mp3.exists() and stamp.exists() and json.loads(stamp.read_text()).get("signature") == signature
    # Asked for again when the text, voice or settings changed, or when --only names it.
    if not cached or (only is not None and line["id"] in only):
        mp3.write_bytes(speak(index, config["voice_settings"].get("speed", 1.0)))
        stamp.write_text(json.dumps({"signature": signature}, indent=2))
    fit(line, mp3, lines_dir / f"{line['id']}.wav")

# The voice track: every line at its start time.
voice_wav = args.out / "voz.wav"
inputs, chains = [], []
for n, line in enumerate(lines):
    inputs += ["-i", str(lines_dir / f"{line['id']}.wav")]
    ms = int(line["start"] * 1000)
    chains.append(f"[{n}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms}[l{n}]")
mix = "".join(f"[l{n}]" for n in range(len(lines)))
graph = ";".join(chains) + f";{mix}amix=inputs={len(lines)}:normalize=0,apad,atrim=0:{LENGTH}[v]"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", graph, "-map", "[v]", str(voice_wav)], check=True)

# Voice over music: the music dips while somebody speaks, then comes back.
mix_wav = args.out / "mezcla.wav"
graph = (
    f"[0:a]volume={args.music_gain}[m];"
    "[1:a]asplit=2[key][vo];"
    "[m][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck];"
    "[duck][vo]amix=inputs=2:normalize=0,alimiter=limit=0.89[out]"
)
subprocess.run(
    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(args.music), "-i", str(voice_wav),
     "-filter_complex", graph, "-map", "[out]", "-t", str(LENGTH), str(mix_wav)],
    check=True,
)
print("✔", voice_wav)
print("✔", mix_wav)
