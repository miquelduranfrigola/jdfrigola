# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal portfolio website for the artist **Josep Duran Frigola** (`jdfrigola`), a painter. It is a single static page with two infinite, opposite-direction image carousels (*Obra Personal*, *Obra Acadèmica*), built from a data file + images and deployed to **GitHub Pages** via GitHub Actions. Live at https://miquelduranfrigola.github.io/jdfrigola/.

## Architecture

A Node build (`scripts/build.mjs`, using `sharp`) reads three inputs and emits a self-contained static site into `dist/`:

- **`artworks.csv`** — one row per painting; the **artist edits only this**. Columns: `section` (`PERSONAL`/`ACADEMICA`), `filename`, `show` (`no` hides the piece; defaults to yes), `order`, `width` (% of viewport; height derived from the image's real aspect ratio), `sold` (`yes`→red dot), `year`, `size`, and trilingual `name_{ca,es,en}` / `technique_{ca,es,en}`. Blank ES/EN fields fall back to CA at runtime.
- **`site.config.json`** — all theme tokens (colours, font, sizes, spacing, badge) and fixed UI text in CA/ES/EN (header, section labels, academic subtitle, commissions badge). Everything visual is parametrized here.
- **`content/OBRA PERSONAL/` and `content/OBRA ACADEMICA/`** — the source images (all JPEG), the source of truth for what displays.

The template lives in `src/` (`template.html`, `styles.css.template` with `{{token}}` placeholders, `carousel.js`). The build injects tokens into the CSS, renders the HTML (each translatable node carries `data-ca/-es/-en` for the client-side language toggle), converts/optimizes images, and copies `carousel.js`. `carousel.js` drives the marquee via the **Web Animations API** (eased pause on hover through `playbackRate` tweening), the CAT/ESP/ENG toggle, and the circular commissions badge.

## Design rules (strict — from the artist)

- **Typography: Geist Mono, weight 400 (Regular), 14px, line-height 18px.** Never add margins or padding between lines of text — vertical spacing between text lines comes **only** from `line-height`. To create a gap (e.g. the header groups), insert a real blank line (an empty `<p>&nbsp;</p>`), not a margin.
- **Page margin is 20px**, but **carousels are full-bleed** (they slide edge-to-edge, ignoring the margin — forma.co style). The 20px side margin is applied to text blocks only, not the carousel.
- Images: 1px black border; separated by exactly 5px; sold dot is 20px, right-aligned, 10px above the image.
- *Obra Personal* scrolls right→left; *Obra Acadèmica* left→right.

## Conventions

- **Language is Catalan-first** (CA/ES/EN toggle; CA is the fallback). Titles/labels come from `artworks.csv` and `site.config.json`.
- **New/replacement images must be JPEG**, placed in the matching `content/` folder; add or edit the CSV row (same filename = drop-in replace, no CSV change).
- **`docs/` is NOT the site source** — it holds the InDesign/PDF design mockups (`web_jdf_02.pdf` is the authoritative visual spec). GitHub Pages is configured with source = **GitHub Actions**, so `docs/` is never published; do not put built output there.

## Commands

- `npm run build` — regenerate `dist/` from the CSV + config + images.
- `npm run dev` — build and serve `dist/` locally.
- Pushing to `main` triggers `.github/workflows/deploy.yml` (build + deploy to Pages).
