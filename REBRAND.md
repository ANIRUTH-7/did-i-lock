# 🎨 REBRAND.md — make it yours in ~45 minutes

Everything that says "Did I Lock?" and every piece of branded art, with exact locations.
Search for **`Did I Lock`** (and the non-breaking-space variant `Did&nbsp;I&nbsp;Lock?`) in these files:

| # | File | What's there | Change |
|---|---|---|---|
| 1 | `public/index.html` | `<title>`, sidebar brand name, login headline + tagline | Replace text |
| 2 | `public/app.js` | share text, toast copy, streak-card wordmark, demo chips, comments | Find & replace `Did I Lock?` |
| 3 | `public/manifest.webmanifest` | `name`, `short_name`, `description` — **this is the installed app's name on the phone** | Replace text |
| 4 | `public/sw.js` | cache name `dil-v7-calm` (rename prefix to your product slug — bump the value to force clients to update) | Optional |
| 5 | `public/handoff.html` | Google sign-in handoff page title | Replace text |
| 6 | `README.md`, `DEPLOY.md`, `HOW-IT-WORKS.md` | docs (rename or rewrite — they're yours) | Optional |

## Artwork (all AI-generated originals included in the sale)

| Asset | File | Used for |
|---|---|---|
| Login hero (aurora over house) | `public/img/auth-hero.png` | Full-bleed login background |
| Success render (glass padlock) | `public/img/success.png` | Checklist completion screen |
| Empty state (night clouds) | `public/img/empty-history.png` | Empty history/activity |
| Home dashboard backdrop | `public/img/bg-home.jpg` | Dashboard page background |
| Login backdrop (city light-trails) | `public/img/bg-auth.jpg` | Alternate auth background |
| Checks backdrop (interior) | `public/img/bg-checks.jpg` | My checks page background |
| History backdrop (rainy window) | `public/img/bg-history.jpg` | Departures page background |
| Activity backdrop (aurora lake) | `public/img/bg-activity.jpg` | Activity page background |
| Settings backdrop (misty mountains) | `public/img/bg-settings.jpg` | Settings page background |
| Tasks backdrop (sunrise forest) | `public/img/bg-tasks.jpg` | Tasks page background |
| Icon master | `public/icon-master.png` | Source art |
| App icons | `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` | PWA install + home screen |
| Favicon / any-size icon | `public/icon.svg` | Browser tab, editable vector |

To swap: replace the PNGs at the same sizes/paths (or regenerate with any AI image tool using the style description in `README.md`), and edit the gradient colors inside `icon.svg`. The whole UI palette lives in CSS variables at the top of `public/styles.css` (`--accent`, `--aurora-grad`, `--hero-grad`, …) — **change ~15 lines and the entire app re-colors**, light and dark themes included.

## Colors & motion (single-file design system)

`public/styles.css` section `:root` / `[data-theme="dark"]` — all colors, radii, shadows, easings.
Motion intensity knobs: `--ease-spring`, the `@keyframes` block, and the calm-profile notes in `README.md → Design system`.

## After rebranding — verify in 10 minutes

1. `npm install` → `npm start` → open http://localhost:3000
2. `node --test test/api.js` → 12/12, `node test/ui.js` → 60/60 (the tests are brand-agnostic)
3. Deploy (see `DEPLOY.md`), install on a phone, confirm the new name + icon appear on the home screen
4. Checklist sheet → success screen → Settings → Streak card — the four surfaces buyers always look at
