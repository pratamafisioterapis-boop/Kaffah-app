# Kaffah hero motion video

15-second seamless-loop motion graphics for the kaffahphysio.id hero section.
Fully procedural (canvas 2D), rendered frame by frame in headless Chromium and
encoded with ffmpeg. No footage, no clinic imagery.

| Time | Act | What happens |
|---|---|---|
| 0–3 s | Ignite | Light streaks, orbit curves, rib/fibre arcs, joint rings and bones construct the skeleton |
| 3–6 s | Movement | Particles morph into a human silhouette; vertebrae, muscle lines, ROM arcs, kinetic trails |
| 6–10 s | Transformation | Camera push-in, 3D gyroscope rings, silk ribbons, MOBILITY / RECOVERY / STRENGTH / FREEDOM, particle burst |
| 10–13 s | Identity | Particles stream into the underline; KAFFAH / PHYSIOTHERAPY / Move Better. Recover Stronger. |
| 13–15 s | Signature | Logo (K + spine) assembles, kaffahphysio.id, dissolves back into the opening frame |

## Output (`public/hero/kaffah/`)

- `kaffah-hero-landscape.mp4` / `.webm`: 1920×1080, desktop
- `kaffah-hero-landscape-720p.mp4`: 1280×720 fallback
- `kaffah-hero-portrait.mp4` / `.webm`: 720×1280, mobile (subject in the upper part, lower part calm for copy)
- `*-poster.webp`: frame 0, so the swap from poster to video is invisible

The desktop composition keeps the left ~40 % calm for the HTML headline and CTA.

## Embed

```jsx
<video
  className="absolute inset-0 w-full h-full object-cover"
  autoPlay muted loop playsInline preload="auto"
  poster="/hero/kaffah/kaffah-hero-landscape-poster.webp"
>
  <source media="(max-width: 767px)" src="/hero/kaffah/kaffah-hero-portrait.webm" type="video/webm" />
  <source media="(max-width: 767px)" src="/hero/kaffah/kaffah-hero-portrait.mp4" type="video/mp4" />
  <source src="/hero/kaffah/kaffah-hero-landscape.webm" type="video/webm" />
  <source src="/hero/kaffah/kaffah-hero-landscape.mp4" type="video/mp4" />
</video>
```

Respect `prefers-reduced-motion` by showing only the poster.

## Re-render

```bash
node tools/hero-video/render.cjs                       # both variants (~8 min)
node tools/hero-video/render.cjs --only landscape
node tools/hero-video/render.cjs --stills 2,6.5,12     # PNG stills to $HERO_WORK_DIR
```

To preview live, serve this folder over http and open `scene.html?preview=1`
(add `&w=1080&h=1920` for portrait).

Logo layers in `assets/` were extracted from the official logo as white alpha
masks and are tinted at render time for the navy background.
