/*
 * Google Sheet + Drive inputs for the build — no credentials needed.
 *
 * The content of the site lives in Google, not in the repo:
 *   - the Google Sheet (GOOGLE_SHEET_ID), shared as "Anyone with the link – Viewer":
 *       `artworks` tab  one row per painting
 *       `settings` tab  key | ca | es | en — commissions switch and UI texts
 *       `_files` tab    filename | id | modified — the Drive image folder's contents,
 *                       rewritten by the Sheet's "Publicar web" menu (google/publish.gs)
 *   - the Drive images folder, also shared as "Anyone with the link – Viewer"
 *
 * The Sheet is fetched as a public .xlsx export (all tabs, cell values untouched by
 * type inference); images are fetched from their public Drive download URLs.
 */

import fs from "node:fs";
import path from "node:path";
import readExcelFile from "read-excel-file/node";

const SHARING_HINT = 'is it shared as "Anyone with the link – Viewer"? (see README)';

function requireEnv(name) {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing env ${name} (see README → "One-time setup")`);
  return v;
}

function cellText(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

// Rows of a tab as objects keyed by its (trimmed) header row.
function toObjects(data) {
  const rows = (data || []).map(r => r.map(cellText)).filter(r => r.some(v => v !== ""));
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map(r => {
    const obj = {};
    header.forEach((h, i) => { if (h) obj[h] = r[i] ?? ""; });
    return obj;
  });
}

// Download the whole Sheet once and return its three tabs:
//   artworks: [{section, filename, ...}]   (same columns the old artworks.csv had)
//   settings: { key: { ca, es, en } }
//   files:    Map(filename → { id, modified })
export async function readSheet() {
  const id = requireEnv("GOOGLE_SHEET_ID");
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.includes("spreadsheetml")) {
    throw new Error(`Could not download the Google Sheet (HTTP ${res.status}) — ${SHARING_HINT}`);
  }
  const tabs = new Map();
  for (const { sheet, data } of await readExcelFile(Buffer.from(await res.arrayBuffer()))) {
    tabs.set(sheet.trim().toLowerCase(), toObjects(data));
  }

  if (!tabs.has("artworks")) throw new Error('The Sheet has no "artworks" tab');
  if (!tabs.has("_files")) throw new Error('The Sheet has no "_files" tab — click "Web → Publicar web" once to create it');

  const settings = {};
  for (const row of tabs.get("settings") || []) {
    if (row.key) settings[row.key.toLowerCase()] = { ca: row.ca || "", es: row.es || "", en: row.en || "" };
  }

  const files = new Map();
  for (const row of tabs.get("_files")) {
    if (row.filename && row.id) files.set(row.filename, { id: row.id, modified: row.modified || "" });
  }

  return { artworks: tabs.get("artworks"), settings, files };
}

// Download a Drive image into cacheDir, skipping it when the cached copy is from the
// same Drive revision (file id + modified time). Returns the local path.
export async function downloadImage(name, file, cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const localPath = path.join(cacheDir, `${file.id}-${name}`);
  const stampPath = localPath + ".modified";
  if (fs.existsSync(localPath) && fs.existsSync(stampPath)
      && fs.readFileSync(stampPath, "utf8") === file.modified) {
    return localPath;
  }
  const res = await fetch(`https://drive.usercontent.google.com/download?id=${file.id}&export=download&confirm=t`);
  const type = res.headers.get("content-type") || "";
  if (!res.ok || type.startsWith("text/html")) {
    throw new Error(`Drive download failed (HTTP ${res.status}) — ${SHARING_HINT}`);
  }
  fs.writeFileSync(localPath, Buffer.from(await res.arrayBuffer()));
  fs.writeFileSync(stampPath, file.modified);
  return localPath;
}
