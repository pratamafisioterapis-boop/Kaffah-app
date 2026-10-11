#!/usr/bin/env python3
"""
Synthesized soundtrack for the 25 s Kaffah promo reel (promo.html), 120 BPM.
Every hit lines up with a timestamp in promo.html.

    python3 tools/hours-video/promo_audio.py out.wav
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import *  # noqa: E402,F401,F403

DUR = 25.0
drums, music, fx = setup(DUR)

A1, F1, C2, G1 = 55.0, 43.65, 65.41, 49.0
CHORDS = [(A1, (220.0, 261.63, 329.63)), (F1, (174.61, 220.0, 261.63)),
          (C2, (196.0, 261.63, 329.63)), (G1, (196.0, 246.94, 293.66))]
kick_times = []


def chord_at(t):
    return CHORDS[int(t // 2) % 4]


def hit(t, gain=1.0, deep=False):
    place(drums, kick(deep), t, gain)
    kick_times.append(t)


def groove(t0, t1, half=False):
    t = t0
    while t < t1 - 1e-6:
        on_bar = abs(t % 1.0) < 1e-6
        if not half or on_bar:
            hit(t)
        clap_beat = abs((t % 1.0) - 0.5) < 1e-6 if not half else abs(t % 2.0 - 1.0) < 1e-6
        if clap_beat:
            place(drums, clap(), t, 0.55, rev=0.2)
        place(drums, hat(), t + 0.25, 0.3, pan=0.3)
        place(drums, hat(), t + 0.125, 0.11, pan=-0.3)
        root, _ = chord_at(t)
        place(music, bass(root * 2, 0.22), t, 0.5)
        if not half:
            place(music, bass(root * 4, 0.2), t + 0.25, 0.3)
        t += BEAT
    b = t0
    while b < t1 - 1e-6:
        _, ch = chord_at(b)
        nb = (np.floor(b / 2) + 1) * 2
        place(music, pad(ch, min(nb, t1) - b + 0.3, 2200), b, 0.22, rev=0.3)
        b = nb


def ting(t, gain=0.5, pan=0.0):
    place(fx, pluck(1318.5, 0.35), t, gain, pan=pan, rev=0.35)
    place(fx, pluck(1975.5, 0.45), t + 0.06, gain * 0.8, pan=pan, rev=0.35)


def buzz(t, gain=0.3):
    x = tt(0.18)
    s = np.sign(np.sin(2 * np.pi * 150 * x)) * (0.5 + 0.5 * np.sin(2 * np.pi * 38 * x)) * adsr(len(x), 0.005, 0.03)
    place(fx, fft_lp(s, 900), t, gain)


def wh(t, d=0.3, gain=0.5, up=True, flip=False):
    w, p = whoosh(d, up)
    place(fx, w, t - d / 2, gain, pan=-p if flip else p)


# ---------- 0–4: hook (lockscreen notifications → shatter → question) ----------
place(music, pad(CHORDS[0][1], 2.9, 700), 0.0, 0.3)
place(music, np.sin(2 * np.pi * 55 * tt(2.8)) * np.linspace(0, 1, int(SR * 2.8)) ** 2, 0.0, 0.25)
NOTIF = [.35, .95, 1.5, 1.95, 2.15, 2.3, 2.42, 2.52, 2.6, 2.67]
for i, tn in enumerate(NOTIF):
    ting(tn, 0.55 if i < 3 else 0.38, pan=(-0.4, 0.4)[i % 2])
    if i >= 3:
        buzz(tn, 0.2 + 0.05 * (i - 3))
place(fx, riser(1.05), 1.7, 0.55)
# glass shatter
hit(2.75, 1.0, deep=True)
place(fx, impact(), 2.75, 0.6, rev=0.4)
x = tt(0.7)
place(fx, fft_hp(noise(0.7), 2500) * np.exp(-x * 6), 2.75, 0.5, rev=0.5)
for _ in range(30):
    place(fx, pluck(rng.uniform(2500, 6000), 0.15), 2.75 + rng.uniform(0, 0.6), rng.uniform(0.04, 0.12), pan=rng.uniform(-0.9, 0.9), rev=0.4)
# tension: drone + heartbeat, reverse swell into the drop
place(music, np.sin(2 * np.pi * 41.2 * tt(1.25)) * adsr(int(SR * 1.25), 0.1, 0.2), 2.85, 0.45)
for tb in (3.0, 3.5):
    place(drums, kick(), tb, 0.55)
    place(drums, kick(), tb + 0.17, 0.35)
place(fx, riser(0.6), 3.4, 0.6)
for i, tw in enumerate((2.95, 3.15, 3.35)):
    wh(tw, 0.25, 0.25, flip=i % 2)

# ---------- 4–6: "Jangan tunggu sampai parah." ----------
hit(4.0, 1.0, deep=True)
place(fx, impact(), 4.0, 0.55, rev=0.3)
for i, tl in enumerate((4.0, 4.25, 4.5, 4.75)):
    wh(tl + 0.05, 0.28, 0.45, flip=i % 2)
groove(4.0, 6.0)
place(fx, pluck(2637, 0.5), 5.05, 0.2, rev=0.6)   # glint
wh(5.9, 0.3, 0.5)

# ---------- 6–12: services ----------
hit(6.0, 0.9, deep=True)
groove(6.0, 12.0)
arp = (1318.5, 1567.98, 1760.0, 1975.5, 2093.0, 2637.0)
for i in range(6):
    ts = 6.0 + i
    wh(ts, 0.3, 0.4, flip=i % 2)
    place(fx, pluck(arp[i], 0.45), ts + 0.02, 0.22, pan=(-0.3, 0.3)[i % 2], rev=0.5)
# 9.0 saraf terjepit: electric zap down the nerve
x = tt(0.6)
zap = np.round(np.sin(2 * np.pi * np.cumsum(90 + 60 * np.sin(2 * np.pi * 23 * x)) / SR) * 4) / 4
zap = (zap * 0.6 + 0.4 * noise(0.6) * (rng.uniform(0, 1, len(x)) > 0.85)) * np.exp(-x * 3) * adsr(len(x), 0.01, 0.1)
place(fx, fft_lp(zap, 5000), 9.05, 0.35, pan=np.linspace(-0.2, 0.2, len(x)))
# 10.0 stroke: neurons sparkle, then the impulse travels down the arm
for _ in range(14):
    place(fx, pluck(rng.uniform(2000, 4200), 0.2), 10.05 + rng.uniform(0, 0.55), 0.09, pan=rng.uniform(-0.6, 0.6), rev=0.5)
place(fx, fft_lp(zap, 4000), 10.3, 0.22)
# 11.0 recovery: soft rising shimmer
place(fx, riser(0.8), 11.0, 0.25)
wh(11.9, 0.3, 0.55)

# ---------- 12–14: home care ----------
hit(12.0, 0.9, deep=True)
groove(12.0, 14.0, half=True)
for tp in (12.2, 13.05):           # pin drops
    x = tt(0.3)
    boop = np.sin(2 * np.pi * np.cumsum(950 * np.exp(-x * 9) + 280) / SR) * np.exp(-x * 9)
    place(fx, boop, tp + 0.15, 0.35, rev=0.4)
x = tt(0.7)
route = np.sin(2 * np.pi * np.cumsum(400 + 900 * (x / 0.7) ** 1.3) / SR) * np.sin(np.pi * x / 0.7) * 0.5
place(fx, route, 12.35, 0.25, pan=np.linspace(-0.5, 0.5, len(x)))
wh(13.9, 0.3, 0.5)

# ---------- 14–16.5: why Kaffah ----------
hit(14.0, 0.9, deep=True)
groove(14.0, 16.5)
for i, tb in enumerate((14.3, 14.8, 15.3)):
    place(fx, pluck((1318.5, 1567.98, 1975.5)[i], 0.4), tb + 0.05, 0.25, rev=0.5)
    place(fx, pluck((1975.5, 2349.3, 2637.0)[i], 0.4), tb + 0.11, 0.18, rev=0.5)
    wh(tb + 0.05, 0.25, 0.3, flip=i % 2)
wh(16.4, 0.3, 0.5, up=False)

# ---------- 16.5–17.5: "Kapan bisa datang?" — break with punches ----------
for i, tp in enumerate((16.5, 16.75, 17.0)):
    hit(tp, 0.9)
    place(drums, clap(), tp, 0.4, rev=0.4)
    place(music, bass((A1, C2, G1)[i] * 2, 0.24), tp, 0.5)
place(fx, riser(0.9), 16.6, 0.6)
for i in range(8):
    place(drums, clap(), 17.25 + i * 0.03125, 0.1 + 0.04 * i)

# ---------- 17.5–21: open every day ----------
hit(17.5, 1.0, deep=True)
place(fx, impact(), 17.5, 0.6, rev=0.4)
groove(17.5, 21.0)
scale_up = (880.0, 987.77, 1108.73, 1318.5, 1479.98, 1760.0, 1975.5)   # A major pentatonic, rising
for i, f in enumerate(scale_up):
    place(fx, pluck(f, 0.5), 18.25 + i * 0.25, 0.3, pan=(i - 3) / 4, rev=0.45)
for tp in (18.6, 18.75, 19.0):
    wh(tp, 0.25, 0.25)
place(fx, pluck(2637.0, 0.8), 20.0, 0.22, rev=0.6)
wh(20.85, 0.3, 0.55, up=False)

# ---------- 21–23: tagline — warm, open, no drums ----------
place(fx, impact(), 21.0, 0.3, rev=0.6)
place(music, pad((174.61, 220.0, 261.63, 329.63), 1.2, 2600), 21.0, 0.32, rev=0.6)
place(music, pad((196.0, 261.63, 293.66, 392.0), 1.2, 2800), 22.0, 0.32, rev=0.6)
place(music, np.sin(2 * np.pi * 43.65 * tt(1.0)) * adsr(int(SR * 1.0), 0.05, 0.3), 21.0, 0.3)
place(music, np.sin(2 * np.pi * 49.0 * tt(1.0)) * adsr(int(SR * 1.0), 0.05, 0.3), 22.0, 0.3)
melody = ((21.05, 1318.5), (21.35, 1174.66), (21.65, 1046.5), (22.0, 1174.66), (22.25, 1318.5), (22.5, 1567.98))
for tm, f in melody:
    place(fx, pluck(f, 0.9), tm, 0.22, rev=0.7)
place(fx, riser(0.6), 22.4, 0.55)

# ---------- 23–25: logo + booking ----------
hit(23.0, 1.0, deep=True)
place(fx, impact(), 23.0, 0.75, rev=0.5)
place(music, pad((220.0, 277.18, 329.63, 493.88, 659.25), 2.0, 3200), 23.0, 0.32, rev=0.5)
place(music, np.sin(2 * np.pi * 55 * tt(1.8)) * adsr(int(SR * 1.8), 0.02, 0.6), 23.0, 0.35)
for tp, f in ((23.05, 1760), (23.4, 2217.46), (23.55, 2637), (23.7, 3520)):
    place(fx, pluck(f, 0.7), tp, 0.18, rev=0.6)
place(fx, bell(880), 24.0, 0.3, rev=0.6)
for i in range(4):
    place(drums, kick(), 23.5 + i * 0.5, 0.35)

mixdown(sys.argv[1] if len(sys.argv) > 1 else 'promo-audio.wav', drums, music, fx, kick_times, fade_s=0.45)
