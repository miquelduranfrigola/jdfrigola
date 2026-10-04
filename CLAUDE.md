# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal portfolio website for the artist **Josep Duran Frigola** (`jdfrigola`), a painter. The main page has two infinite, opposite-direction carousels of PERSONAL work: *Obra disponible* (unsold pieces) and *Obra* (all). An **unlisted page `/portfolio/`** keeps the older view (*Obra Personal* + *Obra Acadèmica*, no commissions badge) and carries `noindex, nofollow`; the artist shares that link privately, so never link to it from the site, a sitemap, robots.txt or the README. Built from a Google Sheet + a Google Drive image folder and deployed to **GitHub Pages** via GitHub Actions. Live at https://jdfrigola.com.

## Architecture

A Node build (`scripts/build.mjs`, using `sharp`) reads its inputs and emits a self-contained static site into `dist/`. **Content lives in Google, not in the repo**; `scripts/google.mjs` fetches it with no credentials: the Sheet and the images folder are shared "Anyone with the link – Viewer", the Sheet is downloaded as a public `.xlsx` export (all tabs at once) and images through public Drive download URLs:

- **Google Sheet, `artworks` tab**: one row per painting; the **artist/contributor edits only this**. Columns: `section` (`PERSONAL`/`ACADEMICA`), `filename`, `show` (`no` hides the piece; defaults to yes), `order`, `width` (% of viewport; height derived from the image's real aspect ratio), `sold` (`yes` = sold; unsold pieces form the *Obra disponible* carousel; no visual marker), `year`, `size`, and trilingual `name_{ca,es,en}` / `technique_{ca,es,en}`. Blank ES/EN fields fall back to CA at runtime.
- **Google Sheet, `settings` tab** (`key | ca | es | en`): `commissions` on/off (missing = on), header fields, section labels/subtitles, badge text. `applySettings` in `build.mjs` overlays these onto `site.config.json`; blank cells keep the config default.
- **Google Sheet, hidden `_files` tab** (`filename | id | modified`): the Drive images folder's contents, recursive. It is rewritten by the Sheet's *Publicar web* menu (`google/publish.gs`, which holds the folder id), since a public folder can't be listed without the Drive API. Images match rows by filename only. Downloads are cached in `.cache/images/`, keyed by file id + modified time.
- **Pages and carousels** (`site.config.json` `pages` / `carousels`): each page lists carousel ids; each carousel takes one Sheet `section`, optionally `availableOnly` (sold ≠ yes). Images are shared from the root; pages in subfolders reference them via a `../` prefix (`root` in `build.mjs`). Empty carousels are left out. The settings keys `available_*`, `complete_*`, `personal_*`, `academic_*` override the carousel titles.
- **`site.config.json`**: theme tokens (colours, font, sizes, spacing, badge) plus *default* UI text in CA/ES/EN. Everything visual is parametrized here.

Env: `GOOGLE_SHEET_ID` only (a GitHub repo variable in CI; a gitignored `.env` locally, loaded by `npm run build`).

The template lives in `src/` (`template.html`, `styles.css.template` with `{{token}}` placeholders, `carousel.js`). The build injects tokens into the CSS, renders the HTML (each translatable node carries `data-ca/-es/-en` for the client-side language toggle), converts/optimizes images, and copies `carousel.js`. `carousel.js` drives the marquee (see the draggable-carousel rule below), the CAT/ESP/ENG toggle, and the circular commissions badge.

## Design rules (strict — from the artist)

- **Typography: Geist Mono, weight 400 (Regular), 12px, line-height 14px.** Never add margins or padding between lines of text — vertical spacing between text lines comes **only** from `line-height`. To create a gap (e.g. the header groups), insert a real blank line (an empty `<p>&nbsp;</p>`), not a margin.
- **Below 600px (mobile):** portrait images are 70vw, landscape (horizontal) images 120vw (the build tags each `.artwork` with a `portrait`/`landscape` class from its aspect ratio). Image tops are equalized in JS (`equalizeCaptions` in `src/carousel.js` normalizes each row's caption heights to the tallest), so all images in a carousel start at the same Y regardless of caption wrapping.
- **Carousels are draggable/swipeable.** `setupMarquee` in `src/carousel.js` is a single rAF position loop (not CSS/WAAPI): auto-scroll + drag (touch/mouse/trackpad wheel) share one velocity that always relaxes toward the auto speed, so a fling's momentum decays back into normal motion. Hover-to-slow (mouse, over image) is preserved. Reduced-motion falls back to native horizontal scroll.
- **Background** is one solid color: the bilinear mix of four corner colors (settings keys `upper_left`, `upper_right`, `bottom_right`, `bottom_left` = `R, G, B`), passed as `bgCorners` in site-data. `setupBackground` in `src/carousel.js` eases it toward the mouse position, remapped so each pure color sits `theme.bgCornerPadding` (5%) in from the edges and stays pure in the outer band; without a fine pointer (touch), it follows the scroll position (top → bottom, left/right mixed equally). The CSS starts at the centre mix. If any corner is missing or invalid, `theme.backgroundColor` is used.
- **Page margin is 20px**, but **carousels are full-bleed** (they slide edge-to-edge, ignoring the margin — forma.co style). The 20px side margin is applied to text blocks only, not the carousel.
- Images: 1px black border; separated by exactly 5px. No sold dot.
- Within each carousel, pieces run by `order` **descending** (highest first; blank order last).
- The top carousel scrolls right→left, the bottom one left→right (on both pages).

## Conventions

- **Language is Catalan-first** (CA/ES/EN toggle; CA is the fallback).
- **Titles/labels come from the Sheet** (`artworks` and `settings` tabs), with `site.config.json` as the fallback. New images go into the Drive folder (JPEG/PNG); same filename = drop-in replace.
- **Publishing**: the Sheet's *Web → Publicar web* menu (`google/publish.gs`, Apps Script) fires `workflow_dispatch` on `deploy.yml` using a fine-grained token stored in Script Properties.
- **`docs/` is NOT the site source** — it holds the InDesign/PDF design mockups (`web_jdf_02.pdf` is the authoritative visual spec). GitHub Pages is configured with source = **GitHub Actions**, so `docs/` is never published; do not put built output there.

## Commands

- `npm run build` — regenerate `dist/` from the Sheet + Drive + config (needs `GOOGLE_SHEET_ID` in `.env`).
- `npm run dev` — build and serve `dist/` locally.
- Pushing to `main` or *Publicar web* in the Sheet triggers `.github/workflows/deploy.yml` (build + deploy to Pages).
