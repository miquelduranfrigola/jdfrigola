# jdfrigola

Portfolio website for the artist **Josep Duran Frigola**.

A single static page with two infinite carousels — *Obra Personal* and *Obra Acadèmica* —
built from a **Google Sheet** (the texts) and a **Google Drive folder** (the images), and
published to GitHub Pages from a menu in the Sheet.

**Live site:** https://jdfrigola.com

---

## Editing the site (no coding needed)

Everything lives in the shared Drive folder **Josep Duran Frigola Web**:

- the Google Sheet **jdfrigola_content** — the texts
- the **images** folder — the pictures (subfolders are fine; files are matched by name)

When you're done editing, open the Sheet and click **Web → Publicar web**. The site
updates in about 2 minutes. Nothing goes live until you click it.

### The `artworks` tab — one row per image

| Column | What it is |
| --- | --- |
| `section` | `PERSONAL` or `ACADEMICA` — which carousel it goes in |
| `filename` | exact file name of the picture in the **images** folder (e.g. `Jdfrigola_Obra_X.jpg`) |
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

1. Drop the **JPEG** (or PNG) into the **images** folder.
2. Add a row in the `artworks` tab with its exact file name. To replace a picture, upload the
   new one with the same name and delete the old one; there's no need to change the Sheet.
3. **Web → Publicar web**.

### The `settings` tab

One row per setting: `key | ca | es | en`. A blank cell keeps the default from `site.config.json`.

| key | What it is |
| --- | --- |
| `commissions` | `on` / `off` — the rotating "open for commissions" badge |
| `name`, `handle`, `email`, `instagram`, `email_subject`, `copyright` | header (`ca` column only) |
| `personal_label`, `personal_subtitle`, `academic_label`, `academic_subtitle` | carousel titles, per language |
| `badge` | text of the commissions badge, per language |

---

## One-time setup

The build needs no Google credentials: it reads the Sheet and the images through their
view-only links.

1. **Share by link**: in Drive, set the Sheet **jdfrigola_content** and the **images** folder to
   *General access → Anyone with the link → Viewer*. Nobody can find them without the link, and
   nobody can edit them. Share the whole **Josep Duran Frigola Web** folder with the contributor
   as **Editor**.
2. **GitHub** → repo *Settings → Secrets and variables → Actions → Variables*: add
   `GOOGLE_SHEET_ID` = the long id in the Sheet's URL (`/spreadsheets/d/<id>/edit`).
3. **Publish button**: create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new)
   with access to this repository only, permission **Actions: Read and write**. In the Sheet:
   *Extensions → Apps Script*, paste [`google/publish.gs`](google/publish.gs), save. Then go to
   *Project Settings → Script Properties* and add `GITHUB_TOKEN` = the token. Reload the Sheet:
   the **Web** menu appears. The first click asks for authorization. It also creates a hidden
   `_files` tab listing the images folder; the build uses it to find each picture. If the
   images folder is ever replaced, update `IMAGES_FOLDER_ID` at the top of the script.

Anyone who can edit the Sheet can see the token. It can only trigger builds of this repo, and
it expires, so when it does, create a new one and update the Script Property.

## Look & feel

Colours, font and sizes are in **`site.config.json`**. Its header and text values are
defaults; the Sheet's `settings` tab overrides them.

---

## Developing locally

Create a `.env` file (gitignored) with `GOOGLE_SHEET_ID=...`; no credentials are needed.

```bash
npm install      # once
npm run build    # generates dist/
npm run dev      # builds and serves dist/
```

The build (`scripts/build.mjs`) reads `site.config.json` + the Sheet, downloads the images
from Drive (cached in `.cache/`, re-downloaded only when changed in Drive), optimizes them,
and writes a self-contained site to `dist/`.

## Deployment

`.github/workflows/deploy.yml` runs the build and publishes `dist/` to GitHub Pages. It runs
on every push to `main` and when someone clicks **Web → Publicar web** in the Sheet. If the
build fails, for example because Google can't be reached, the current site stays online. In **Settings → Pages**, the source must be set to
**GitHub Actions** (not the `docs/` folder — `docs/` holds the original design mockups).

## Custom domain (jdfrigola.com)

The site is served at **https://jdfrigola.com**. `customDomain` in `site.config.json` makes
the build write `dist/CNAME`. DNS is in Cloudflare (DNS only, not proxied):

- `A  @` → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`
- `AAAA  @` → `2606:50c0:8000::153`, `:8001::153`, `:8002::153`, `:8003::153`
- `CNAME  www` → `miquelduranfrigola.github.io`

Emptying `customDomain` would switch the site back to the `github.io` URL.

## License

© 2026 Josep Duran Frigola. All artwork and code in this repository are licensed under
[**CC BY-NC-ND 4.0**](https://creativecommons.org/licenses/by-nc-nd/4.0/) — you may share
them with attribution, but **not** use them commercially or distribute modified versions
without permission. See [`LICENSE`](./LICENSE).
