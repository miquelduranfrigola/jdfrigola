# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal portfolio website for the artist **Josep Duran Frigola** (`jdfrigola`), a painter/sculptor. The site showcases his artwork and is deployed via **GitHub Pages**.

As of this writing the repository is at an early stage: it contains the artwork assets (`content/`) and the design mockups (`docs/`), but the site code itself has not been built yet. When scaffolding the site, keep it a static site so it can be served directly by GitHub Pages.

## Repository layout

- `content/` — the artwork, the source of truth for what the gallery displays. Organized into two collections that map to site sections:
  - `OBRA ACADEMICA/` — academic work from art school (casts, long-pose figure studies, still lifes, self-portrait). Filenames are prefixed `Jdfrigola_BAA_`.
  - `OBRA PERSONAL/` — personal/original work. Filenames are prefixed `Jdfrigola_Obra_`.
  - Image titles are encoded in the filename in **Catalan** (e.g. `El_Menjador_De_Casa` → "El menjador de casa"). Derive human-readable, accented titles from these when generating captions.
- `docs/` — design references, **not** the GitHub Pages source. `web_jdf_02.pdf` is the visual mockup of the intended site; `*.indd` are the Adobe InDesign source files for those mockups. Treat these as the authoritative design spec for layout, typography, and page structure.

## Important conventions

- **Language is Catalan.** Section names, artwork titles, and site copy should be in Catalan, matching the content folders and filenames.
- **HEIC images must be converted** before use on the web — several source files are `.heic`/`.HEIC` (e.g. `Jdfrigola_BAA_Longpose_Mariana.heic`), which browsers do not display reliably. Convert to web-friendly formats (JPEG/WebP) and keep the originals untouched in `content/`; do not overwrite source assets with converted versions.
- **`docs/` collides with the common GitHub Pages source directory.** GitHub Pages can be configured to serve from `/docs` on the main branch — but here `docs/` holds design files, not the site. Configure Pages to publish from the site root or a `gh-pages` branch / GitHub Actions build instead, and do not put the built site into `docs/`.

## Deployment

Target is GitHub Pages. Whatever build approach is chosen, the published output must be plain static files (HTML/CSS/JS/assets). Confirm the Pages source setting matches the actual build output location (see the `docs/` caveat above).
