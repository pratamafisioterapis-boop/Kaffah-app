#!/usr/bin/env python3
"""
Synthesized soundtrack for the Kaffah opening-hours reel (15 s, 120 BPM).
Everything is generated here (no samples, no licensed music), and every hit is
placed on the same timeline as scene.html.

    python3 tools/hours-video/audio.py out.wav
"""
import sys
import wave
import numpy as np

SR = 44100
DUR = 15.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)

drums = np.zeros((2, N))
music = np.zeros((2, N))
fx = np.zeros((2, N))
send = np.zeros((2, N))   # reverb send


def tt(d):
    return np.arange(int(SR * d)) / SR


def place(bus, sig, t, gain=1.0, pan=0.0, rev=0.0):
    """Mix mono (or per-sample pan array) signal into a stereo bus."""
    i = int(round(t * SR))
    if i >= N:
        return
    n = min(len(sig), N - i)
    s = sig[:n] * gain
    p = pan[:n] if isinstance(pan, np.ndarray) else pan
    gl, gr = np.cos((p + 1) * np.pi / 4) * np.sqrt(2), np.sin((p + 1) * np.pi / 4) * np.sqrt(2)
    bus[0, i:i + n] += s * gl
    bus[1, i:i + n] += s * gr
    if rev:
        send[0, i:i + n] += s * gl * rev
        send[1, i:i + n] += s * gr * rev


def onepole(x, cutoff):
    """One-pole low-pass; cutoff may be an array (Hz) for sweeps."""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    z = 0.0
    for i in range(len(x)):
        z += a[i] * (x[i] - z)
        y[i] = z
    return y


def fft_lp(x, fc, order=4):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / fc) ** order), len(x))


def fft_hp(x, fc, order=4):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-9
    return np.fft.irfft(X / (1 + (fc / f) ** order), len(x))


def noise(d):
    return rng.uniform(-1, 1, int(SR * d))


def adsr(n, a=0.005, r=0.05):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


# ---------- instruments ----------
def kick(deep=False):
    t = tt(0.9 if deep else 0.45)
    f = (38 if deep else 46) + (130 if deep else 115) * np.exp(-t * 26)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (3.2 if deep else 7.5))
    s += 0.35 * noise(len(t) / SR) * np.exp(-t * 320)
    return np.tanh(1.8 * s)


def clap():
    t = tt(0.35)
    n = fft_hp(fft_lp(noise(0.35), 3800), 900)
    env = np.zeros_like(t)
    for d in (0, 0.009, 0.018):
        env += np.where(t >= d, np.exp(-(t - d) * 90), 0)
    env += 0.6 * np.exp(-t * 14)
    body = 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 35)
    return (n * env + body) * 0.9


def hat(open_=False):
    d = 0.22 if open_ else 0.045
    t = tt(d)
    return fft_hp(noise(d), 7000) * np.exp(-t * (14 if open_ else 90)) * 0.9


def tick(f=2400):
    t = tt(0.04)
    return (np.sin(2 * np.pi * f * t) + 0.3 * noise(0.04)) * np.exp(-t * 160)


def pluck(f, d=0.5):
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 12)
    return s * np.exp(-t * 7) * adsr(len(t), 0.002, 0.02)


def bell(f):
    t = tt(2.2)
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * dcy)
            for m, a, dcy in ((1, 1, 2.2), (2.0, .45, 3.5), (2.76, .3, 5), (5.4, .12, 9), (8.9, .05, 14)))
    return s * adsr(len(t), 0.001, 0.05)


def saw(f, t):
    return 2 * ((f * t) % 1.0) - 1


def bass(f, d):
    t = tt(d)
    s = 0.6 * saw(f, t) + 0.5 * np.sin(2 * np.pi * f * t)
    cut = 180 + 1400 * np.exp(-t * 18)
    return onepole(s, cut) * adsr(len(t), 0.004, 0.03) * 1.4


def pad(freqs, d, cutoff=1400):
    t = tt(d)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.006, 0, 0.0055):
            s += saw(f * (1 + det), t + rng.uniform(0, 1))
    s = fft_lp(s / (len(freqs) * 3), cutoff)
    return s * adsr(len(t), 0.25, 0.6)


def whoosh(d=0.45, up=True):
    t = tt(d)
    k = t / d
    shape = np.sin(np.pi * k) ** 2
    cut = 300 + 5200 * (k if up else 1 - k) ** 1.5
    return onepole(noise(d), cut) * shape * 2.2, np.linspace(-0.8, 0.8, len(t))


def riser(d):
    t = tt(d)
    k = t / d
    n = onepole(noise(d), 200 + 7000 * k ** 2) * 1.6
    tone = 0.25 * np.sin(2 * np.pi * np.cumsum(220 + 1100 * k ** 2) / SR)
    return (n + tone) * k ** 2.2


def impact():
    t = tt(1.6)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 70 * np.exp(-t * 14)) / SR) * np.exp(-t * 2.4)
    crash = fft_hp(noise(1.6), 3000) * np.exp(-t * 3.2) * 0.45
    return np.tanh(1.5 * sub) + crash


def glitch(d=0.2):
    out = []
    while sum(len(x) for x in out) < SR * d:
        seg = int(SR * rng.choice([0.008, 0.015, 0.025]))
        src = saw(rng.choice([110, 220, 440, 880]), tt(seg / SR)) * 0.6 + noise(seg / SR) * 0.4
        src = np.round(src * 6) / 6  # bitcrush
        for _ in range(rng.integers(1, 4)):
            out.append(src)
    return np.concatenate(out)[:int(SR * d)]


# ---------- arrangement ----------
A1, F1, C2, G1 = 55.0, 43.65, 65.41, 49.0
CHORDS = [(A1, (220.0, 261.63, 329.63)), (F1, (174.61, 220.0, 261.63)),
          (C2, (196.0, 261.63, 329.63)), (G1, (196.0, 246.94, 293.66))]


def chord_at(t):
    return CHORDS[int(t // 2) % 4]


# intro 0–1.5: dark pad, sub swell, dots, pulses, riser into the flood
place(music, pad(CHORDS[0][1], 1.7, 600), 0.0, 0.35)
sub = np.sin(2 * np.pi * 55 * tt(1.5)) * np.linspace(0, 1, int(SR * 1.5)) ** 2
place(music, sub, 0.0, 0.35)
for i, f in enumerate((880, 1046.5, 1318.5)):
    place(fx, pluck(f, 0.3), 0.05 + i * 0.12, 0.25, pan=(-0.5, 0, 0.5)[i], rev=0.4)
place(fx, pluck(1760, 0.4), 0.4, 0.35, rev=0.5)
for tp in (0.5, 1.0):
    place(drums, kick(), tp, 0.45)
    place(fx, tick(1800), tp, 0.25, rev=0.3)
place(fx, riser(0.5), 1.0, 0.55)
w, p = whoosh(0.35)
place(fx, w, 1.2, 0.5, pan=p)

# 1.5–3: KAPAN / KAMI / BUKA? hits
for i, tp in enumerate((1.5, 2.0, 2.5)):
    place(drums, kick(), tp, 1.0)
    place(drums, clap(), tp, 0.35, rev=0.25)
    place(music, bass((A1, F1, C2)[i] * 2, 0.4), tp, 0.55)
    w, p = whoosh(0.3)
    place(fx, w, tp - 0.15, 0.45, pan=p if i % 2 == 0 else -p)
place(music, pad(CHORDS[1][1], 1.4, 900), 1.5, 0.25)
w, p = whoosh(0.3, up=False)
place(fx, w, 2.8, 0.5, pan=-p)

# 3–4.5: clock — a click each time the minute hand passes 12 (decelerating), then a bell at 09.00
spin0, spin1 = 3.1, 4.15
for k in range(1, 9):
    pk = 1 - (1 - k / 9) ** (1 / 3)        # inverse of easeOutCubic
    place(fx, tick(2400 if k % 2 else 1800), spin0 + pk * (spin1 - spin0), 0.75, pan=(-0.3 if k % 2 else 0.3))
for i in range(12):                         # tick marks drawing on
    place(fx, tick(3200), 3.1 + i * 0.025, 0.08)
place(fx, riser(0.9), 3.25, 0.55)
place(fx, bell(1318.5), spin1, 0.75, rev=0.6)
place(fx, bell(659.25), spin1, 0.4, rev=0.6)
place(music, pad((220.0, 329.63, 440.0), 1.3, 1800), 3.0, 0.2)
w, p = whoosh(0.3)
place(fx, w, 4.22, 0.6, pan=p)


def groove(t0, t1, fills=()):
    t = t0
    while t < t1 - 1e-6:
        place(drums, kick(), t, 1.0)
        if abs((t % 1.0) - 0.5) < 1e-6:
            place(drums, clap(), t, 0.55, rev=0.2)
        place(drums, hat(), t + 0.25, 0.32, pan=0.3)
        place(drums, hat(), t + 0.125, 0.12, pan=-0.3)
        root, _ = chord_at(t)
        place(music, bass(root * 2, 0.22), t, 0.5)
        place(music, bass(root * 4, 0.2), t + 0.25, 0.32)
        t += BEAT
    b = t0
    while b < t1 - 1e-6:
        _, ch = chord_at(b)
        place(music, pad(ch, min(2.0, t1 - b) + 0.3, 2200), b, 0.22, rev=0.3)
        b = (np.floor(b / 2) + 1) * 2


# 4.5–10: main groove (weekday, then weekend)
place(drums, kick(deep=True), 4.5, 0.9)
place(fx, impact(), 4.5, 0.5, rev=0.3)
groove(4.5, 10.0)
for t0, d in ((5.45, 0.8), (8.45, 0.75)):   # timeline bar fill "zip"
    t = tt(d)
    zip_ = np.sin(2 * np.pi * np.cumsum(300 + 900 * (t / d) ** 1.4) / SR) * np.sin(np.pi * t / d) * 0.5
    place(fx, zip_, t0, 0.3, pan=np.linspace(-0.6, 0.6, len(t)))
for tp in (6.3, 9.25):                       # badge pop
    place(fx, pluck(1318.5, 0.35), tp, 0.35, rev=0.4)
    place(fx, pluck(1760, 0.35), tp + 0.06, 0.25, rev=0.4)
w, p = whoosh(0.35)
place(fx, w, 7.2, 0.6, pan=p)
place(drums, hat(open_=True), 7.5, 0.6)
place(fx, impact(), 7.5, 0.25)
for i in range(8):                           # clap roll into the breakdown
    place(drums, clap(), 9.5 + i * 0.0625, 0.15 + 0.05 * i)
w, p = whoosh(0.4, up=False)
place(fx, w, 9.75, 0.55, pan=-p)

# 10–12: breakdown — airy pad, sub, sparkling arp, then glitch
place(fx, impact(), 10.0, 0.35, rev=0.4)
place(music, pad((220.0, 329.63, 493.88, 659.25), 2.3, 3200), 10.0, 0.3, rev=0.5)
place(music, np.sin(2 * np.pi * 55 * tt(1.9)) * adsr(int(SR * 1.9), 0.05, 0.4), 10.0, 0.35)
arp = (880, 1318.5, 1046.5, 1318.5, 987.77, 1318.5, 1174.66, 1567.98)
for i in range(14):
    place(fx, pluck(arp[i % 8], 0.3), 10.0 + i * 0.125, 0.16, pan=(-0.6 if i % 2 else 0.6), rev=0.55)
place(fx, riser(0.6), 11.25, 0.4)
place(fx, glitch(0.2), 11.82, 0.55)

# 12–13.5: groove back, snare roll + riser into the logo
groove(12.0, 13.0)
for i in range(16):
    place(drums, clap(), 13.0 + i * 0.03125, 0.12 + 0.03 * i)
place(fx, riser(1.0), 12.5, 0.5)
w, p = whoosh(0.3)
place(fx, w, 13.22, 0.6, pan=p)

# 13.5–15: logo — big impact, bright final chord, chimes on each logo piece
place(drums, kick(deep=True), 13.5, 1.0)
place(fx, impact(), 13.5, 0.7, rev=0.5)
place(music, pad((220.0, 277.18, 329.63, 440.0, 659.25), 1.5, 3000), 13.5, 0.35, rev=0.5)
for tp, f in ((13.6, 1760), (13.9, 2093), (14.05, 2637), (14.25, 3520)):
    place(fx, pluck(f, 0.6), tp, 0.18, rev=0.6)
place(fx, bell(880), 14.25, 0.25, rev=0.6)

# ---------- mix ----------
tgrid = np.arange(N) / SR
duck = np.ones(N)
kick_times = [x for x in np.arange(4.5, 10.0, BEAT)] + [x for x in np.arange(12.0, 13.0, BEAT)] + [1.5, 2.0, 2.5, 13.5]
for tk in kick_times:
    i = int(tk * SR)
    seg = tgrid[i:] - tk
    duck[i:] = np.minimum(duck[i:], 1 - 0.55 * np.exp(-seg / 0.11))

ir_t = tt(1.8)
ir = np.stack([rng.uniform(-1, 1, len(ir_t)), rng.uniform(-1, 1, len(ir_t))]) * np.exp(-ir_t / 0.45)
ir[:, :int(0.012 * SR)] = 0
ir = fft_lp(ir[0], 6000), fft_lp(ir[1], 6000)
wet = np.zeros((2, N))
for c in range(2):
    L = N + len(ir[c])
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], L) * np.fft.rfft(ir[c], L), L)[:N] * 0.06

mix = drums + music * duck + fx + wet
mix[:, :] = np.stack([fft_hp(mix[0], 28, 2), fft_hp(mix[1], 28, 2)])
mix = np.tanh(mix * 0.9)
fade = np.ones(N)
fade[-int(0.35 * SR):] = np.linspace(1, 0, int(0.35 * SR)) ** 2
mix *= fade
mix /= np.max(np.abs(mix)) / 0.89

out = sys.argv[1] if len(sys.argv) > 1 else 'hours-audio.wav'
pcm = (mix.T * 32767).astype('<i2')
with wave.open(out, 'wb') as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes(pcm.tobytes())
print(f'audio -> {out}')
