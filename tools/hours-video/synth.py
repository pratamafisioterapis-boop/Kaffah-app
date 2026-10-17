"""
Tiny procedural synth shared by the Kaffah reel soundtracks: instruments,
a stereo bus mixer with reverb send, kick side-chain and WAV export.
No samples are used.
"""
import wave
import numpy as np

SR = 44100
BEAT = 0.5
rng = np.random.default_rng(7)
N = 0
send = None


def setup(dur):
    """Allocate buses for a track of `dur` seconds; returns (drums, music, fx)."""
    global N, send
    N = int(SR * dur)
    send = np.zeros((2, N))
    return np.zeros((2, N)), np.zeros((2, N)), np.zeros((2, N))


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


def mixdown(out, drums, music, fx, kick_times, duck_depth=0.55, fade_s=0.35):
    tgrid = np.arange(N) / SR
    duck = np.ones(N)
    for tk in kick_times:
        i = int(tk * SR)
        seg = tgrid[i:] - tk
        duck[i:] = np.minimum(duck[i:], 1 - duck_depth * np.exp(-seg / 0.11))

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
    fade[-int(fade_s * SR):] = np.linspace(1, 0, int(fade_s * SR)) ** 2
    mix *= fade
    mix /= np.max(np.abs(mix)) / 0.89

    pcm = (mix.T * 32767).astype('<i2')
    with wave.open(out, 'wb') as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    print(f'audio -> {out}')
