# Kaffah Instagram reels

15-second Instagram Reels/Story video (1080×1920, 30 fps) announcing clinic
hours, with a synthesized soundtrack (120 BPM; every scene cut lands on a beat).
No samples or licensed music are used.

| Time | Scene |
|---|---|
| 0–1.5 s | Dots converge and pulse, then flood the screen |
| 1.5–3 s | KAPAN / KAMI / BUKA? kinetic type |
| 3–4.5 s | Ring becomes a clock, hands spin to 09.00 (bell) |
| 4.5–7.5 s | SENIN – JUMAT 09.00–21.00 + 24 h timeline |
| 7.5–10 s | SABTU – MINGGU 09.00–17.00 |
| 10–12 s | Rotating 3D dot spine, "Gerak Lebih Nyaman." |
| 12–13.5 s | Text ring, Booking via WhatsApp 0812-3333-9435 |
| 13.5–15 s | Logo, kaffahphysio.id, address |

Hours, phone and address match `src/lib/businessInfo.js`; update both if they change.

```bash
node tools/hours-video/render.cjs                # -> dist/kaffah-jam-buka.mp4 (+ silent version)
node tools/hours-video/render.cjs --stills 2,6   # review stills
python3 tools/hours-video/audio.py out.wav       # soundtrack only
```

## 25 s promo reel (`promo.html` + `promo_audio.py`)

| Time | Scene |
|---|---|
| 0–4 s | Hook: lockscreen notifications from "Tubuhmu", screen shatters, "Sudah berapa lama kamu abaikan?" |
| 4–6 s | JANGAN TUNGGU SAMPAI PARAH. |
| 6–12 s | Services on a glass card with a rim-lit figure: Nyeri Otot & Sendi, Cedera Olahraga, Pasca Operasi, Saraf Terjepit, Stroke, Recovery Pasca Olahraga |
| 12–14 s | Home Care route on a 3D map |
| 14–16.5 s | Why Kaffah: SIPF-certified therapists, evidence-based, transparent pricing |
| 16.5–17.5 s | Kapan bisa datang? |
| 17.5–21 s | BUKA SETIAP HARI, 7 day tiles, hours panel |
| 21–23 s | Karena sehat tidak mengenal libur. |
| 23–25 s | Logo, WhatsApp booking, kaffahphysio.id, address |

```bash
node tools/hours-video/render.cjs --reel promo   # -> dist/kaffah-promo-25s.mp4 (~5 min)
```

Both soundtracks share the instruments in `synth.py`.
