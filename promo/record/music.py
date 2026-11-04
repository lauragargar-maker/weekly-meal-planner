"""
A 45-second, royalty-free music bed for the promo, synthesised from scratch:
plucked-string arpeggios, a bass, soft drums and a final chord. Bars are two
seconds long (120 bpm) and laid out so the beat drops at 5.5 s, when "NUEVO EN
¡ÑAM!" appears, and the last chord lands at 41.5 s with the end card.

    python3 promo/record/music.py promo/out/musica.wav

The ¡Ñam! promo (55 s, end card at 51.3 s) uses the same bed, longer:

    python3 promo/record/music.py promo/out/nam/musica.wav --length 55 --end 51.5
"""
import argparse
import wave

import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("out")
parser.add_argument("--length", type=float, default=45.0, help="seconds")
parser.add_argument("--end", type=float, default=41.5, help="when the final chord lands")
args = parser.parse_args()

SR = 44100
LENGTH = args.length
BEAT = 0.5
ORIGIN = -0.5  # bar lines at -0.5, 1.5, 3.5, 5.5 …
DROP = 5.5
END_CHORD = args.end

rng = np.random.default_rng(7)
out = np.zeros((int(SR * LENGTH) + SR, 2))


def midi(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def add(signal, start, gain=1.0, pan=0.0):
    if start < 0:
        signal = signal[int(-start * SR):]
        start = 0
    i = int(start * SR)
    j = min(i + len(signal), len(out))
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:j, 0] += signal[: j - i] * gain * left
    out[i:j, 1] += signal[: j - i] * gain * right


def pluck(freq, dur, bright=0.5):
    """Karplus-Strong string, computed one delay-line period at a time."""
    n = int(SR * dur)
    period = max(2, int(SR / freq))
    burst = rng.uniform(-1, 1, period)
    burst = np.convolve(burst, np.ones(5) / 5, mode="same") * (1 - bright) + burst * bright
    y = np.zeros(n + period + 1)
    y[:period] = burst
    decay = 0.996
    for start in range(period, n + period, period):
        prev = y[start - period: start]
        shifted = np.concatenate(([y[start - period - 1] if start - period - 1 >= 0 else 0.0], prev[:-1]))
        block = decay * 0.5 * (prev + shifted)
        end = min(start + period, len(y))
        y[start:end] = block[: end - start]
    y = y[:n]
    fade = np.ones(n)
    attack = min(n, int(0.004 * SR))
    fade[:attack] = np.linspace(0, 1, attack)
    tail = min(n, int(0.03 * SR))
    fade[-tail:] = np.linspace(1, 0, tail)
    return y * fade


def bass(freq, dur):
    t = np.arange(int(SR * dur)) / SR
    env = np.minimum(1, t / 0.01) * np.exp(-t * 3.2)
    tone = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t) + 0.1 * np.sin(6 * np.pi * freq * t)
    return tone * env


def kick():
    t = np.arange(int(SR * 0.3)) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)


def noise_hit(dur, decay, lo, hi):
    n = int(SR * dur)
    spectrum = np.fft.rfft(rng.uniform(-1, 1, n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    spectrum[(freqs < lo) | (freqs > hi)] = 0
    t = np.arange(n) / SR
    return np.fft.irfft(spectrum, n) * np.exp(-t * decay)


def clap():
    hit = np.zeros(int(SR * 0.25))
    for k, delay in enumerate((0, 0.011, 0.022)):
        burst = noise_hit(0.2, 28 if k == 2 else 90, 900, 5000)
        i = int(delay * SR)
        hit[i: i + len(burst)] += burst[: len(hit) - i]
    return hit


def glock(freq, dur=1.2):
    t = np.arange(int(SR * dur)) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 9)
    return tone * np.exp(-t * 4.5) * np.minimum(1, t / 0.003)


# C – G – Am – F, the arpeggio pattern per bar (8 eighth notes).
CHORDS = [(48, [60, 64, 67, 72]), (43, [59, 62, 67, 71]), (45, [60, 64, 69, 72]), (41, [60, 65, 69, 72])]
PATTERN = [0, 2, 1, 3, 2, 1, 3, 2]
MELODY = {  # bar index (from the drop) → (beat, midi) pairs, a short hook every 4 bars
    0: [(0, 76), (1, 79), (2, 84)],
    4: [(0, 76), (1, 79), (2.5, 81), (3, 79)],
    8: [(0, 76), (1, 79), (2, 84)],
    12: [(0, 84), (1, 83), (2, 79), (3, 76)],
    16: [(0, 76), (1, 79), (2.5, 81), (3, 84)],
}

bar = 0
while True:
    start = ORIGIN + bar * 4 * BEAT
    if start >= END_CHORD:
        break
    root, notes = CHORDS[bar % 4]
    after_drop = start >= DROP - 1e-6
    for step, idx in enumerate(PATTERN):
        t = start + step * BEAT / 2
        if t >= END_CHORD:
            break
        gain = 0.32 if after_drop else 0.22
        add(pluck(midi(notes[idx]), 0.9, bright=0.3), t, gain, pan=-0.35 if step % 2 else 0.35)
        # Shaker on the off-beats once the beat is in.
        if after_drop:
            add(noise_hit(0.08, 60, 6000, 14000), t + BEAT / 4, 0.05, pan=0.2)
    if after_drop:
        for beat in range(4):
            t = start + beat * BEAT
            if beat in (0, 2):
                add(kick(), t, 0.75)
                add(bass(midi(root), BEAT * 1.6), t, 0.42)
            else:
                add(clap(), t, 0.22, pan=-0.1)
                add(bass(midi(root + 12), BEAT * 0.8), t + BEAT / 2, 0.22)
        drop_bar = round((start - DROP) / (4 * BEAT))
        for beat, note in MELODY.get(drop_bar % 20, []):
            add(glock(midi(note)), start + beat * BEAT, 0.16, pan=0.15)
    bar += 1

# Before the drop: a soft riser and a "pop" on it.
riser_len = 1.0
t = np.arange(int(SR * riser_len)) / SR
riser = noise_hit(riser_len, 0, 2000, 9000) * (t / riser_len) ** 2
add(riser, DROP - riser_len, 0.12)
add(glock(midi(84), 1.0), DROP, 0.2)

# The end card: one C major chord left ringing.
for k, note in enumerate([48, 60, 64, 67, 72, 76]):
    add(pluck(midi(note), 3.5, bright=0.4), END_CHORD + k * 0.03, 0.3, pan=(k - 2.5) / 4)
add(kick(), END_CHORD, 0.7)
add(bass(midi(36), 3.0), END_CHORD, 0.45)
add(glock(midi(84), 2.5), END_CHORD + 0.5, 0.18)

out = out[: int(SR * LENGTH)]
# Gentle fade-in and fade-out, then normalise to -1 dBFS.
n = len(out)
env = np.ones(n)
env[: int(0.15 * SR)] = np.linspace(0, 1, int(0.15 * SR))
fade_from = int((LENGTH - 1.7) * SR)
env[fade_from:] = np.linspace(1, 0, n - fade_from) ** 1.5
out *= env[:, None]
out = np.tanh(out * 1.2)
out *= 10 ** (-1 / 20) / np.max(np.abs(out))

pcm = (out * 32767).astype(np.int16)
with wave.open(args.out, "wb") as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes(pcm.tobytes())
print("✔", args.out)
