/**
 * "Publicar web" menu for the jdfrigola_content Sheet.
 *
 * Paste this into the Sheet (Extensions → Apps Script) and add a Script Property
 * GITHUB_TOKEN (Project Settings → Script Properties) holding a fine-grained GitHub
 * token limited to the miquelduranfrigola/jdfrigola repo with "Actions: Read and write".
 *
 * Clicking Web → Publicar web:
 *   1. rewrites the hidden `_files` tab with the images folder's contents
 *      (filename | id | modified), which is how the build finds each image;
 *   2. starts the deploy workflow, which rebuilds the site from this Sheet.
 * Nothing goes live until it is clicked.
 */

const REPO = "miquelduranfrigola/jdfrigola";
const WORKFLOW = "deploy.yml";
const IMAGES_FOLDER_ID = "1PRlikhkD0Y85aLVPufbW78r-76ntbBkZ";
const FILES_TAB = "_files";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Web")
    .addItem("Publicar web", "publish")
    .addToUi();
}

function publish() {
  const ui = SpreadsheetApp.getUi();
  const count = writeFileList();

  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) {
    ui.alert(`${count} imatges llistades, però falta configurar GITHUB_TOKEN a les propietats de l'script.`);
    return;
  }

  const res = UrlFetchApp.fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      payload: JSON.stringify({ ref: "main" }),
      muteHttpExceptions: true,
    },
  );
  if (res.getResponseCode() === 204) {
    ui.alert(
      "Publicant…",
      `${count} imatges trobades. La web s'actualitzarà en uns 2 minuts.\n\n` +
        `Progrés: https://github.com/${REPO}/actions`,
      ui.ButtonSet.OK,
    );
  } else {
    ui.alert(`No s'ha pogut publicar (error ${res.getResponseCode()}):\n${res.getContentText()}`);
  }
}

// List every file under the images folder (subfolders included) into the hidden
// `_files` tab. If a filename appears twice, the most recently modified copy wins.
function writeFileList() {
  const byName = {};
  const walk = folder => {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      const prev = byName[f.getName()];
      if (!prev || f.getLastUpdated() > prev.getLastUpdated()) byName[f.getName()] = f;
    }
    const subs = folder.getFolders();
    while (subs.hasNext()) walk(subs.next());
  };
  walk(DriveApp.getFolderById(IMAGES_FOLDER_ID));

  const rows = Object.keys(byName).sort().map(name => {
    const f = byName[name];
    return [name, f.getId(), f.getLastUpdated().toISOString()];
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(FILES_TAB) || ss.insertSheet(FILES_TAB);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length + 1, 3)
    .setNumberFormat("@")
    .setValues([["filename", "id", "modified"], ...rows]);
  sheet.hideSheet();
  SpreadsheetApp.flush();
  return rows.length;
}
