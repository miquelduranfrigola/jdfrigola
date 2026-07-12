/* Front-end behavior for the jdfrigola portfolio:
   - Language toggle (CAT / ESP / ENG), persisted in localStorage.
   - Circular text for the commissions badge, re-rendered on language change.
   The infinite marquee + pause-on-hover are handled entirely in CSS (styles.css). */

(function () {
  "use strict";

  var data = { defaultLang: "ca", languages: ["ca", "es", "en"] };
  try {
    var el = document.getElementById("site-data");
    if (el) data = JSON.parse(el.textContent);
  } catch (e) { /* fall back to defaults */ }

  var STORAGE_KEY = "jdf-lang";

  // Lay the badge phrase out around a circle. Rebuilt on every language change.
  function renderRing(ringEl, text) {
    var phrase = (text || "").toUpperCase().trim();
    if (!phrase) { ringEl.innerHTML = ""; return; }
    // Repeat the phrase (with a separator) so it wraps the full circle.
    var full = (phrase + "  •  ").repeat(2);
    var chars = Array.prototype.slice.call(full);
    var n = chars.length;
    var radius = 50;
    ringEl.innerHTML = "";
    for (var i = 0; i < n; i++) {
      var span = document.createElement("span");
      span.textContent = chars[i];
      var deg = (360 / n) * i;
      span.style.transform =
        "translate(-50%, -50%) rotate(" + deg + "deg) translateY(-" + radius + "px)";
      ringEl.appendChild(span);
    }
  }

  function applyLang(lang) {
    if (data.languages.indexOf(lang) === -1) lang = data.defaultLang;

    // Swap every translatable node. data-ca is always present and is the fallback.
    var nodes = document.querySelectorAll("[data-ca]");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.classList.contains("ring")) continue; // badge handled separately
      var value = node.getAttribute("data-" + lang);
      if (value === null || value === "") value = node.getAttribute("data-ca") || "";
      node.textContent = value;
    }

    // Badge ring
    var ring = document.querySelector(".badge .ring");
    if (ring) {
      var t = ring.getAttribute("data-" + lang);
      if (t === null || t === "") t = ring.getAttribute("data-ca") || "";
      renderRing(ring, t);
    }

    // Toggle state on the switch buttons
    var buttons = document.querySelectorAll(".lang-switch button");
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].setAttribute(
        "aria-pressed",
        buttons[b].getAttribute("data-lang") === lang ? "true" : "false"
      );
    }

    document.documentElement.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function init() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    var initial = stored || data.defaultLang;

    var buttons = document.querySelectorAll(".lang-switch button");
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          applyLang(btn.getAttribute("data-lang"));
        });
      })(buttons[i]);
    }

    applyLang(initial);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
