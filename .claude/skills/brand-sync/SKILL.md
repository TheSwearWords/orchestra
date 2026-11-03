---
name: brand-sync
description: Compare everything front-facing in Orchestra (the app UI, the product site, app icons) with the Figma brand kit and bring the Foundations up to date. Use for /brand-sync, "sync the brand kit", "are the foundations up to date".
---

# Brand sync

The Figma file **AqpBpdKicUBczcUwdiDEnk** is the brand kit. Code that drifts from it is either a new
decision (add it to Figma) or a mistake (fix the code). This command finds the drift, asks which is
which, then applies it.

## 1. Read the front-facing sources

| Source | What to pull out |
|---|---|
| `app/src/renderer/src/assets/tokens.css` | Generated from Figma. Use it as the baseline for what Figma had at the last export |
| `app/src/renderer/src/assets/main.css` | Hand-written additions: fonts, radius, easing, `type-current-*`, stagger, focus ring |
| `app/src/renderer/src/components/*.tsx` | Tailwind classes and inline values that aren't tokens (raw hex, px sizes, durations) |
| `app/src/renderer/src/assets/icons/*.svg`, `assets/ascii/*.txt` | Icon set and ASCII art in use |
| `app/build/icon.png`, `app/resources/icon.png` | App icon |
| `Site/Deployments/*/index.html` (unzip the newest `.zip` into its own folder if needed) | `:root` variables, `@font-face`, dark-mode blocks, component classes, keyframes |

## 2. Read the Figma kit

Load the figma-use skill first (`skill://figma/figma-use/SKILL.md`), then `create_session`. Run one
read-only `use_figma` per inventory (Rule 20): variable collections + values, text styles, effect
styles, components on the Components page, top-level frames on Foundations and Brand.

## 3. Report the drift

One table per area (color, type, spacing/radius, motion, components, icons, imagery, logo). Each
row: the element, where it lives in code, what Figma has, and one of:
- **New**: in code, not in Figma
- **Changed**: in both, values differ
- **Unused**: in Figma, nowhere in code (don't propose deleting it, just list it)
- **Bug**: looks unintended (e.g. several font weights pointing at one font file)

Flag where the site and the app disagree. The site may diverge on purpose, so ask, don't assume.

## 4. Ask, then apply

Ask the user with AskUserQuestion which rows to adopt into the kit, which to fix in code and which
are site-only. Then:
- **Figma**: add what's approved to the matching Foundations/Components section, in that section's
  existing layout and naming (`Orchestration/...` collections). Site-only additions go in a
  separate "Site" section so they never leak into the app's tokens.
- **Code**: re-export `Orchestra/projects/orchestra-brand/prereqs/tokens.json` and run
  `npm run tokens` in `app/`. Never hand-edit `tokens.css`.
- **Log**: add dated lines for each decision to `Orchestra/projects/orchestra-brand/concept.md`.

Finish with a screenshot of each Figma section you changed.
