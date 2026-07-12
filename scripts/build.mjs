#!/usr/bin/env node
/*
 * Build script for the Josep Duran Frigola portfolio.
 *
 * Reads:
 *   - site.config.json  (theme tokens + fixed UI text, in 3 languages)
 *   - artworks.csv      (one row per painting — the artist edits this)
 *   - content/          (the source images, incl. HEIC)
 *
 * Writes a self-contained static site to dist/:
 *   - index.html, styles.css, carousel.js
 *   - images/*.jpg  (HEIC converted, everything optimized)
 *
 * The GitHub Actions workflow runs this on every push and deploys dist/.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const SRC_DIR = path.join(ROOT, "src");
const DIST_DIR = path.join(ROOT, "dist");
const IMAGES_OUT = path.join(DIST_DIR, "images");

const SECTION_ORDER = ["PERSONAL", "ACADEMICA"];

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

// Minimal but correct CSV parser: handles quoted fields, embedded delimiters,
// escaped double-quotes ("") and quoted newlines. The delimiter is auto-detected
// from the header row (comma or semicolon — Excel exports semicolons in many
// European locales). Returns array of objects keyed by the header row.
function parseCSV(text) {
  text = text.replace(/^﻿/, ""); // strip BOM (Excel)
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const DELIM = (firstLine.split(";").length - 1) > (firstLine.split(",").length - 1) ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === DELIM) {
      row.push(field); field = "";
    } else if (c === "\r") {
      // ignore; handled by \n
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter(r => r.some(v => v.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0].map(h => h.trim());
  return nonEmpty.slice(1).map(r => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
    return obj;
  });
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

function renderArtwork(row, img, theme) {
  const ar = (img.width / img.height).toFixed(4);
  const width = row.width && row.width.trim() !== "" ? row.width.trim() : theme.defaultImageWidth;
  const sold = /^\s*(y|s|1|true)/i.test(row.sold || "");

  const lines = [];
  lines.push(`<span class="c-name"${i18nAttrs(row.name_ca, row.name_es, row.name_en)}>${esc(row.name_ca)}</span>`);
  if (row.year) lines.push(`<span class="c-year">${esc(row.year)}</span>`);
  if (row.technique_ca || row.technique_es || row.technique_en) {
    lines.push(`<span class="c-tech"${i18nAttrs(row.technique_ca, row.technique_es, row.technique_en)}>${esc(row.technique_ca)}</span>`);
  }
  if (row.size) lines.push(`<span class="c-size">${esc(row.size)}</span>`);

  return `      <figure class="artwork" style="--w:${esc(width)}; --ar:${ar};">
        <figcaption class="caption">
          ${lines.join("\n          ")}
        </figcaption>
        <img src="images/${esc(img.outName)}" alt="${esc(row.name_ca)}" loading="lazy" width="${img.width}" height="${img.height}">
        ${sold ? '<span class="sold-dot" title="Venut / Vendido / Sold"></span>' : ""}
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
  // data-direction / data-speed to drive the Web Animations marquee.
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
  const handle = header.instagram
    ? `<p><a href="${esc(header.instagram)}" target="_blank" rel="noopener">${esc(header.handle)}</a></p>`
    : `<p>${esc(header.handle)}</p>`;
  const groups = [
    [`<p>${esc(header.name)}</p>`],
    [
      handle,
      `<p><a href="mailto:${esc(header.email)}">${esc(header.email.toUpperCase())}</a></p>`,
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
  const subject = encodeURIComponent(b.ca || "Encàrrec");
  const aria = [b.ca, b.es, b.en].filter(Boolean).join(" · ");
  return `  <div class="badge">
    <a href="mailto:${esc(cfg.header.email)}?subject=${subject}" aria-label="${esc(aria)}">
      <span class="ring"></span>
    </a>
  </div>`;
}

/* ------------------------------ main ------------------------------ */

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
  const rows = parseCSV(fs.readFileSync(path.join(ROOT, "artworks.csv"), "utf8"));
  log(`Read ${rows.length} artwork rows from artworks.csv`);

  // Fresh dist/
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(IMAGES_OUT, { recursive: true });

  // Track which files on disk get used, to warn about orphans.
  const usedByFolder = {};
  for (const key of SECTION_ORDER) usedByFolder[cfg.carousels[key].folder] = new Set();

  const bySection = { PERSONAL: [], ACADEMICA: [] };

  for (const row of rows) {
    const key = (row.section || "").toUpperCase();
    if (!cfg.carousels[key]) { warn(`Unknown section "${row.section}" for ${row.filename} — skipped`); continue; }
    const folder = cfg.carousels[key].folder;

    // `show` defaults to yes; an explicit no hides the piece (still "listed", so it
    // is not reported as an orphan, and its image is not processed).
    const show = !/^\s*(n|0|false)/i.test(row.show || "");
    if (!show) {
      usedByFolder[folder].add(row.filename);
      log(`  – ${key}  ${row.filename}  (hidden: show=no)`);
      continue;
    }

    const srcPath = path.join(CONTENT_DIR, folder, row.filename);
    if (!fs.existsSync(srcPath)) { warn(`File not found: content/${folder}/${row.filename} — skipped`); continue; }

    const outName = row.filename.replace(/\.[^.]+$/, "") + ".jpg";
    let img;
    try {
      const dims = await processImage(srcPath, outName, cfg.images);
      img = { outName, width: dims.width, height: dims.height };
    } catch (e) {
      warn(`Could not process ${row.filename}: ${e.message} — skipped`);
      continue;
    }
    usedByFolder[folder].add(row.filename);

    const order = parseInt(row.order, 10);
    bySection[key].push({ order: isNaN(order) ? 9999 : order, html: renderArtwork(row, img, cfg.theme) });
    log(`  ✓ ${key}  ${row.filename}  (${img.width}×${img.height})`);
  }

  // Warn about images present on disk but not listed in the CSV.
  for (const key of SECTION_ORDER) {
    const folder = cfg.carousels[key].folder;
    const dir = path.join(CONTENT_DIR, folder);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(".")) continue;
      if (!usedByFolder[folder].has(f)) warn(`content/${folder}/${f} is not listed in artworks.csv — not shown`);
    }
  }

  // Assemble sections (sorted by order), skipping empty ones.
  const sectionsHTML = SECTION_ORDER
    .filter(key => bySection[key].length > 0)
    .map(key => {
      const items = bySection[key].sort((a, b) => a.order - b.order).map(x => x.html).join("\n");
      return renderSection(key, cfg, items);
    })
    .join("\n\n");

  // Inject theme tokens into the CSS template.
  const t = cfg.theme;
  let css = fs.readFileSync(path.join(SRC_DIR, "styles.css.template"), "utf8");
  const tokens = {
    backgroundColor: t.backgroundColor, textColor: t.textColor, fontFamily: t.fontFamily,
    fontWeight: t.fontWeight, fontSize: t.fontSize, lineHeight: t.lineHeight,
    imageBorder: t.imageBorder, soldDotColor: t.soldDotColor, soldDotSize: t.soldDotSize,
    soldDotGap: t.soldDotGap, itemSpacing: t.itemSpacing, siteMargin: t.siteMargin,
    bottomMargin: t.bottomMargin, sectionSpacing: t.sectionSpacing,
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
  });
  // Commissions badge on/off switch: edit commissions.txt (on/off). Missing file = on.
  let commissionsOn = true;
  const cxPath = path.join(ROOT, "commissions.txt");
  if (fs.existsSync(cxPath)) {
    commissionsOn = !/^\s*(off|no|false|0|disable)/i.test(fs.readFileSync(cxPath, "utf8"));
  }
  log(`Commissions badge: ${commissionsOn ? "on" : "off"}`);

  let html = fs.readFileSync(path.join(SRC_DIR, "template.html"), "utf8");
  const repl = {
    LANG: cfg.i18n.defaultLang,
    HEADER: renderHeader(cfg.header),
    LANG_SWITCH: renderLangSwitch(cfg.i18n.languages),
    SECTIONS: sectionsHTML,
    BADGE: commissionsOn ? renderBadge(cfg) : "",
    SITE_DATA: siteData,
  };
  for (const [k, v] of Object.entries(repl)) {
    html = html.replaceAll(`{{${k}}}`, v);
  }
  fs.writeFileSync(path.join(DIST_DIR, "index.html"), html);

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

  const total = bySection.PERSONAL.length + bySection.ACADEMICA.length;
  log(`\nBuilt dist/ — ${total} images (PERSONAL: ${bySection.PERSONAL.length}, ACADEMICA: ${bySection.ACADEMICA.length}).`);
}

main().catch(err => { console.error(err); process.exit(1); });
