# jdfrigola

Portfolio website for the artist **Josep Duran Frigola**.

A single static page with two infinite carousels — *Obra Personal* and *Obra Acadèmica* —
built from the images in `content/` and the data in `artworks.csv`, and deployed
automatically to GitHub Pages on every push.

**Live site:** https://miquelduranfrigola.github.io/jdfrigola/

---

## Editing the artworks (no coding needed)

Everything about the paintings lives in **`artworks.csv`** — open it in Excel,
Numbers or Google Sheets. One row per image:

| Column | What it is |
| --- | --- |
| `section` | `PERSONAL` or `ACADEMICA` — which carousel it goes in |
| `filename` | exact image file name inside `content/OBRA PERSONAL/` or `content/OBRA ACADEMICA/` |
| `show` | `yes` shows the piece on the site; `no` hides it (keeps the row but leaves it out) |
| `order` | position within the carousel (1, 2, 3 …) |
| `width` | how wide the image is, as a % of the screen (e.g. `16`). Height adjusts automatically |
| `sold` | `yes` shows the red "sold" dot under the image; `no` hides it |
| `year` | e.g. `2024` |
| `size` | e.g. `60X90 CM` |
| `name_ca` / `name_es` / `name_en` | title in Catalan / Spanish / English |
| `technique_ca` / `technique_es` / `technique_en` | technique in each language |

If a Spanish or English field is left blank, the site falls back to the Catalan text.

### Adding or replacing an image

1. Put the **JPEG** file in `content/OBRA PERSONAL/` or `content/OBRA ACADEMICA/`.
2. Add a row to `artworks.csv` (or, to replace, keep the same filename and no CSV change is needed).
3. Commit the change — the site rebuilds and redeploys on its own.

---

## Look & feel

Colours, font, sizes and the fixed text (header, language labels, the "commissions"
badge, the academic subtitle) are all in **`site.config.json`**.

---

## Developing locally

```bash
npm install      # once
npm run build    # generates dist/
npm run dev      # builds and serves dist/
```

The build (`scripts/build.mjs`) reads `site.config.json` + `artworks.csv`, optimizes
the images from `content/`, and writes a self-contained site to `dist/`.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs the build and
publishes `dist/` to GitHub Pages. In **Settings → Pages**, the source must be set to
**GitHub Actions** (not the `docs/` folder — `docs/` holds the original design mockups).

## License

© 2026 Josep Duran Frigola. All artwork and code in this repository are licensed under
[**CC BY-NC-ND 4.0**](https://creativecommons.org/licenses/by-nc-nd/4.0/) — you may share
them with attribution, but **not** use them commercially or distribute modified versions
without permission. See [`LICENSE`](./LICENSE).
