#!/usr/bin/env node
/*
 * Build script for the Josep Duran Frigola portfolio.
 *
 * Reads:
 *   - site.config.json  (theme tokens + default UI text, in 3 languages)
 *   - the Google Sheet  (`artworks` tab: one row per painting; `settings` tab:
 *                        commissions switch + UI texts overriding the defaults;
 *                        `_files` tab: the Drive images folder's file list)
 *   - the Drive images  (matched by filename; see google.mjs)
 *
 * Writes a self-contained static site to dist/:
 *   - index.html, styles.css, carousel.js
 *   - images/*.jpg  (everything converted to optimized JPEG)
 *
 * The GitHub Actions workflow runs this on every push and on "Publicar web" from
 * the Sheet (workflow_dispatch), and deploys dist/.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { readSheet, downloadImage } from "./google.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache", "images");
const SRC_DIR = path.join(ROOT, "src");
const DIST_DIR = path.join(ROOT, "dist");
const IMAGES_OUT = path.join(DIST_DIR, "images");

/* ----------------------------- helpers ----------------------------- */

function log(msg) { console.log(msg); }
function warn(msg) { console.warn("  ! " + msg); }

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build data-ca / data-es / data-en attributes. data-ca is always emitted
// (it is the client-side fallback); es/en only when provided.
function i18nAttrs(ca, es, en) {
  let out = ` data-ca="${esc(ca || "")}"`;
  if (es) out += ` data-es="${esc(es)}"`;
  if (en) out += ` data-en="${esc(en)}"`;
  return out;
}

/* ----------------------------- images ----------------------------- */

async function processImage(srcPath, outName, opts) {
  const info = await sharp(srcPath)
    .rotate() // honor EXIF orientation
    .resize({ width: opts.maxWidth, withoutEnlargement: true })
    .jpeg({ quality: opts.quality, mozjpeg: true })
    .toFile(path.join(IMAGES_OUT, outName));
  return { width: info.width, height: info.height };
}

/* ----------------------------- render ----------------------------- */

// `root` is the path prefix from the page to the site root ("" or "../").
function renderArtwork(row, img, theme, root) {
  const ar = (img.width / img.height).toFixed(4);
  const width = row.width && row.width.trim() !== "" ? row.width.trim() : theme.defaultImageWidth;

  const lines = [];
  lines.push(`<span class="c-name"${i18nAttrs(row.name_ca, row.name_es, row.name_en)}>${esc(row.name_ca)}</span>`);
  if (row.year) lines.push(`<span class="c-year">${esc(row.year)}</span>`);
  if (row.technique_ca || row.technique_es || row.technique_en) {
    lines.push(`<span class="c-tech"${i18nAttrs(row.technique_ca, row.technique_es, row.technique_en)}>${esc(row.technique_ca)}</span>`);
  }
  if (row.size) lines.push(`<span class="c-size">${esc(row.size)}</span>`);

  const orientation = img.width > img.height ? "landscape" : "portrait";

  return `      <figure class="artwork ${orientation}" style="--w:${esc(width)}; --ar:${ar};">
        <figcaption class="caption">
          ${lines.join("\n          ")}
        </figcaption>
        <img src="${root}images/${esc(img.outName)}" alt="${esc(row.name_ca)}" loading="lazy" width="${img.width}" height="${img.height}">
      </figure>`;
}

function renderSection(key, cfg, itemsHTML) {
  const carousel = cfg.carousels[key];
  const labels = cfg.i18n.sections[key].label;
  const subtitle = cfg.i18n.sections[key].subtitle || {};
  const speed = carousel.scrollSpeed;

  let head = `    <div class="section-head">
      <div class="section-label"${i18nAttrs(labels.ca, labels.es, labels.en)}>${esc(labels.ca)}</div>`;
  if (subtitle.ca || subtitle.es || subtitle.en) {
    head += `
      <div class="section-subtitle"${i18nAttrs(subtitle.ca, subtitle.es, subtitle.en)}>${esc(subtitle.ca)}</div>`;
  }
  head += `
    </div>`;

  // The track holds the items twice for a seamless -50% loop; carousel.js reads
  // data-direction / data-speed to drive the marquee loop.
  return `  <section class="section" id="section-${key.toLowerCase()}">
${head}
    <div class="carousel" data-direction="${esc(carousel.direction)}" data-speed="${speed}">
      <div class="track">
${itemsHTML}
${itemsHTML}
      </div>
    </div>
  </section>`;
}

// Header identity block with blank "line jumps" between groups (no margins — each blank
// line is one real 18px line, matching the mockup).
function renderHeader(header) {
  const blank = `      <p>&nbsp;</p>`;
  const subject = encodeURIComponent(header.emailSubject || "Hola");
  const handle = header.instagram
    ? `<p><a href="${esc(header.instagram)}" target="_blank" rel="noopener">${esc(header.handle)}</a></p>`
    : `<p>${esc(header.handle)}</p>`;
  const groups = [
    [`<p>${esc(header.name)}</p>`],
    [
      handle,
      `<p><a href="mailto:${esc(header.email)}?subject=${subject}">${esc(header.email.toUpperCase())}</a></p>`,
    ],
    [`<p>Copyright ${esc(header.copyright)}</p>`],
  ];
  return groups
    .map(g => g.map(line => `      ${line}`).join("\n"))
    .join(`\n${blank}\n`);
}

function renderLangSwitch(languages) {
  return languages
    .map(l => `<button type="button" data-lang="${esc(l.code)}">${esc(l.label)}</button>`)
    .join('<span class="sep">•</span>');
}

// The badge always shows all three languages (built client-side from site-data), so the
// markup is just an empty ring plus the mailto link.
function renderBadge(cfg) {
  const b = cfg.i18n.badge;
  const subject = encodeURIComponent(cfg.header.emailSubject || "Hola");
  const aria = [b.ca, b.es, b.en].filter(Boolean).join(" · ");
  return `  <div class="badge">
    <a href="mailto:${esc(cfg.header.email)}?subject=${subject}" aria-label="${esc(aria)}">
      <span class="ring"></span>
    </a>
  </div>`;
}

// Overlay the Sheet's `settings` tab onto the config. A blank cell keeps the
// default from site.config.json.
const HEADER_KEYS = {
  name: "name", handle: "handle", email: "email", instagram: "instagram",
  email_subject: "emailSubject", copyright: "copyright",
};
const I18N_KEYS = {
  available_label: ["AVAILABLE", "label"], available_subtitle: ["AVAILABLE", "subtitle"],
  complete_label: ["COMPLETE", "label"], complete_subtitle: ["COMPLETE", "subtitle"],
  personal_label: ["PERSONAL", "label"], personal_subtitle: ["PERSONAL", "subtitle"],
  academic_label: ["ACADEMICA", "label"], academic_subtitle: ["ACADEMICA", "subtitle"],
};

function applySettings(cfg, settings) {
  for (const [key, field] of Object.entries(HEADER_KEYS)) {
    if (settings[key]?.ca) cfg.header[field] = settings[key].ca;
  }
  const merge = (target, v) => {
    for (const lang of ["ca", "es", "en"]) if (v[lang]) target[lang] = v[lang];
  };
  for (const [key, [section, field]] of Object.entries(I18N_KEYS)) {
    if (settings[key]) merge(cfg.i18n.sections[section][field], settings[key]);
  }
  if (settings.badge) merge(cfg.i18n.badge, settings.badge);
}

/* ------------------------------ main ------------------------------ */

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
  const { artworks: rows, settings, files: driveFiles } = await readSheet();
  log(`Read ${rows.length} artwork rows from the Sheet, ${driveFiles.size} files in the Drive folder`);
  applySettings(cfg, settings);

  // Fresh dist/
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(IMAGES_OUT, { recursive: true });

  // Track which Drive files are referenced, to warn about orphans.
  const used = new Set();

  // Shown pieces with processed images; carousels pick from these below.
  const pieces = [];
  const sections = new Set(Object.values(cfg.carousels).map(c => c.section));

  for (const row of rows) {
    const key = (row.section || "").toUpperCase();
    if (!sections.has(key)) { warn(`Unknown section "${row.section}" for ${row.filename} — skipped`); continue; }

    // `show` defaults to yes; an explicit no hides the piece (still "listed", so it
    // is not reported as an orphan, and its image is not downloaded).
    used.add(row.filename);
    const show = !/^\s*(n|0|false)/i.test(row.show || "");
    if (!show) {
      log(`  – ${key}  ${row.filename}  (hidden: show=no)`);
      continue;
    }

    const file = driveFiles.get(row.filename);
    if (!file) { warn(`File not found in the Drive folder: ${row.filename} — skipped`); continue; }

    const outName = row.filename.replace(/\.[^.]+$/, "") + ".jpg";
    let img;
    try {
      const srcPath = await downloadImage(row.filename, file, CACHE_DIR);
      const dims = await processImage(srcPath, outName, cfg.images);
      img = { outName, width: dims.width, height: dims.height };
    } catch (e) {
      warn(`Could not process ${row.filename}: ${e.message} — skipped`);
      continue;
    }

    const order = parseInt(row.order, 10);
    pieces.push({
      section: key,
      row,
      img,
      order: isNaN(order) ? -Infinity : order, // no order → last
      sold: /^\s*(y|s|1|true)/i.test(row.sold || ""),
    });
    log(`  ✓ ${key}  ${row.filename}  (${img.width}×${img.height})`);
  }

  // Warn about images in Drive that no row of the Sheet references.
  for (const name of driveFiles.keys()) {
    if (!used.has(name)) warn(`${name} is in the Drive folder but not listed in the Sheet — not shown`);
  }

  // Pieces of one carousel, highest `order` first.
  const carouselPieces = id => {
    const c = cfg.carousels[id];
    return pieces
      .filter(p => p.section === c.section && !(c.availableOnly && p.sold))
      .sort((x, y) => y.order - x.order);
  };

  // Inject theme tokens into the CSS template.
  const t = cfg.theme;
  let css = fs.readFileSync(path.join(SRC_DIR, "styles.css.template"), "utf8");
  const tokens = {
    backgroundColor: t.backgroundColor, textColor: t.textColor, fontFamily: t.fontFamily,
    fontWeight: t.fontWeight, fontSize: t.fontSize, lineHeight: t.lineHeight,
    imageBorder: t.imageBorder, itemSpacing: t.itemSpacing, siteMargin: t.siteMargin,
    bottomMargin: t.bottomMargin, sectionSpacing: t.sectionSpacing, sectionHeadGap: t.sectionHeadGap,
    captionImageGap: t.captionImageGap, mobileBreakpoint: t.mobileBreakpoint, mobileImageWidth: t.mobileImageWidth,
    mobileImageWidthLandscape: t.mobileImageWidthLandscape,
    badgeColor: t.badgeColor, badgeFontSize: t.badgeFontSize, linkHoverColor: t.linkHoverColor,
  };
  for (const [k, v] of Object.entries(tokens)) {
    css = css.replaceAll(`{{${k}}}`, String(v));
  }
  fs.writeFileSync(path.join(DIST_DIR, "styles.css"), css);

  // Render the HTML template.
  const siteData = JSON.stringify({
    defaultLang: cfg.i18n.defaultLang,
    languages: cfg.i18n.languages.map(l => l.code),
    badge: cfg.i18n.badge,
    hoverSlowFactor: cfg.theme.hoverSlowFactor,
    hoverEaseMs: cfg.theme.hoverEaseMs,
    dragSettleMs: cfg.theme.dragSettleMs,
  });
  // Commissions badge on/off switch: `commissions` row of the settings tab. Missing = on.
  const commissionsOn = !/^\s*(off|no|false|0|disable)/i.test(settings.commissions?.ca || "");
  log(`Commissions badge: ${commissionsOn ? "on" : "off"}`);

  // Cache-busting: append a short content hash to the CSS/JS URLs so browsers refetch
  // immediately after a deploy that changed them (GitHub Pages caches assets ~10 min),
  // while unchanged files keep their URL and stay cached.
  const template = fs.readFileSync(path.join(SRC_DIR, "template.html"), "utf8");
  const jsContent = fs.readFileSync(path.join(SRC_DIR, "carousel.js"), "utf8");
  const hash = s => crypto.createHash("md5").update(s).digest("hex").slice(0, 8);

  // One HTML page per entry in cfg.pages; images/CSS/JS are shared from the site root.
  for (const page of cfg.pages) {
    const root = page.path ? "../".repeat(page.path.split("/").length) : "";
    const counts = [];
    const sectionsHTML = page.carousels
      .map(id => {
        const items = carouselPieces(id);
        counts.push(`${id}: ${items.length}`);
        if (items.length === 0) return null; // empty carousel → left out
        const html = items.map(p => renderArtwork(p.row, p.img, cfg.theme, root)).join("\n");
        return renderSection(id, cfg, html);
      })
      .filter(Boolean)
      .join("\n\n");

    const repl = {
      LANG: cfg.i18n.defaultLang,
      ROBOTS: page.noindex ? '\n  <meta name="robots" content="noindex, nofollow">' : "",
      ROOT: root,
      HEADER: renderHeader(cfg.header),
      LANG_SWITCH: renderLangSwitch(cfg.i18n.languages),
      SECTIONS: sectionsHTML,
      BADGE: page.badge && commissionsOn ? renderBadge(cfg) : "",
      SITE_DATA: siteData,
    };
    let html = template;
    for (const [k, v] of Object.entries(repl)) {
      html = html.replaceAll(`{{${k}}}`, v);
    }
    html = html
      .replace(`href="${root}styles.css"`, `href="${root}styles.css?v=${hash(css)}"`)
      .replace(`src="${root}carousel.js"`, `src="${root}carousel.js?v=${hash(jsContent)}"`);

    const outDir = path.join(DIST_DIR, page.path);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html);
    log(`Page /${page.path}${page.noindex ? " (noindex)" : ""} — ${counts.join(", ")}`);
  }

  // Copy the (static) front-end script verbatim.
  fs.copyFileSync(path.join(SRC_DIR, "carousel.js"), path.join(DIST_DIR, "carousel.js"));

  // .nojekyll so GitHub Pages serves files/folders as-is.
  fs.writeFileSync(path.join(DIST_DIR, ".nojekyll"), "");

  // Custom domain: only emit a CNAME when configured. Doing so switches GitHub Pages
  // to that domain — set it ONLY after the domain's DNS points at Pages.
  const domain = (cfg.customDomain || "").trim();
  if (domain) {
    fs.writeFileSync(path.join(DIST_DIR, "CNAME"), domain + "\n");
    log(`Custom domain: ${domain} (wrote dist/CNAME)`);
  }

  log(`\nBuilt dist/ — ${pieces.length} images, ${cfg.pages.length} pages.`);
}

main().catch(err => { console.error(err); process.exit(1); });
