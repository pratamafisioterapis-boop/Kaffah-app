# Kaffah opening-hours reel

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
