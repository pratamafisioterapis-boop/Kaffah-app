#!/usr/bin/env python3
"""
Synthesized soundtrack for the Kaffah opening-hours reel (15 s, 120 BPM).
Everything is generated here (no samples, no licensed music), and every hit is
placed on the same timeline as scene.html.

    python3 tools/hours-video/audio.py out.wav
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import *  # noqa: E402,F401,F403

DUR = 15.0
drums, music, fx = setup(DUR)

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

kick_times = [x for x in np.arange(4.5, 10.0, BEAT)] + [x for x in np.arange(12.0, 13.0, BEAT)] + [1.5, 2.0, 2.5, 13.5]
mixdown(sys.argv[1] if len(sys.argv) > 1 else 'hours-audio.wav', drums, music, fx, kick_times)
