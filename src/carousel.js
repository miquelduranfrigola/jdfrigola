/* Front-end behavior for the jdfrigola portfolio:
   - Infinite marquee carousels via the Web Animations API, with an EASED pause on hover
     (playbackRate tweened to 0, not stopped abruptly).
   - Language toggle (CAT / ESP / ENG) for captions and labels, persisted in localStorage.
   - Commissions badge: circular text showing ALL THREE languages at once (independent of
     the toggle), auto-sized so every character fits. */

(function () {
  "use strict";

  var data = {
    defaultLang: "ca",
    languages: ["ca", "es", "en"],
    badge: { ca: "", es: "", en: "" },
    hoverSlowFactor: 0.2,
    hoverEaseMs: 600,
  };
  try {
    var el = document.getElementById("site-data");
    if (el) data = JSON.parse(el.textContent);
  } catch (e) { /* fall back to defaults */ }

  var STORAGE_KEY = "jdf-lang";
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------- Marquee ------------------------- */

  // One symmetric easing for both slow-down and speed-up, so acceleration mirrors
  // deceleration.
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function setupMarquee(carousel) {
    var track = carousel.querySelector(".track");
    if (!track || reduceMotion) return;

    var dir = carousel.getAttribute("data-direction") || "left";
    var speed = parseFloat(carousel.getAttribute("data-speed")) || 45; // seconds per loop

    // The track holds the items twice; moving by 50% of its own width is one full,
    // seamless loop. Travel left: 0 -> -50%. Travel right: -50% -> 0.
    var frames = dir === "right"
      ? [{ transform: "translateX(-50%)" }, { transform: "translateX(0)" }]
      : [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }];

    var anim = track.animate(frames, {
      duration: speed * 1000,
      iterations: Infinity,
      easing: "linear",
    });

    // Tween playbackRate smoothly (same easing + duration both ways) so the carousel
    // slows down and speeds back up with a symmetric ramp.
    var slowFactor = typeof data.hoverSlowFactor === "number" ? data.hoverSlowFactor : 0.2;
    var easeMs = typeof data.hoverEaseMs === "number" ? data.hoverEaseMs : 600;
    var rafId = null;
    function tweenRate(target) {
      if (rafId) cancelAnimationFrame(rafId);
      var from = anim.playbackRate;
      var startTs = null;
      function step(ts) {
        if (startTs === null) startTs = ts;
        var t = easeMs > 0 ? Math.min(1, (ts - startTs) / easeMs) : 1;
        anim.playbackRate = from + (target - from) * easeInOutCubic(t);
        if (t < 1) rafId = requestAnimationFrame(step);
        else rafId = null;
      }
      rafId = requestAnimationFrame(step);
    }

    // While over an IMAGE (not the caption above nor the space/sold-dot below), slow the
    // carousel to `slowFactor` of full speed — it keeps moving, never a hard stop.
    // Delegated so it works for every (duplicated) image in the moving track.
    function overImage(e) { return e.target && e.target.tagName === "IMG"; }
    carousel.addEventListener("mouseover", function (e) { if (overImage(e)) tweenRate(slowFactor); });
    carousel.addEventListener("mouseout", function (e) { if (overImage(e)) tweenRate(1); });
  }

  /* ------------------------- Badge ------------------------- */

  function buildBadge() {
    var badge = document.querySelector(".badge");
    var ring = badge && badge.querySelector(".ring");
    if (!ring) return;

    // Always all three languages, in order, regardless of the selected UI language.
    var phrases = ["ca", "es", "en"]
      .map(function (l) { return (data.badge && data.badge[l]) || ""; })
      .filter(Boolean);
    if (!phrases.length) return;
    var text = (phrases.join(" • ") + " • ").toUpperCase();
    var chars = Array.prototype.slice.call(text);
    var n = chars.length;

    // Measure a single character (monospace → uniform advance) in the badge font.
    // The probe is a plain child span so it inherits the `.badge .ring span` font size;
    // it must NOT carry the `ring` class or it would size to the whole badge.
    ring.innerHTML = "";
    var probe = document.createElement("span");
    probe.style.visibility = "hidden";
    probe.style.whiteSpace = "pre";
    probe.style.transform = "none";
    probe.textContent = "M";
    ring.appendChild(probe);
    var charW = probe.getBoundingClientRect().width || 8.4;
    var fontPx = parseFloat(getComputedStyle(probe).fontSize) || 14;
    ring.removeChild(probe);

    // Radius so the ring's circumference fits every character.
    var radius = (n * charW) / (2 * Math.PI);
    var size = 2 * radius + 3 * fontPx; // padding for glyph height
    badge.style.width = size + "px";
    badge.style.height = size + "px";

    ring.innerHTML = "";
    for (var i = 0; i < n; i++) {
      var span = document.createElement("span");
      span.textContent = chars[i];
      var deg = (360 / n) * i;
      span.style.transform =
        "translate(-50%, -50%) rotate(" + deg + "deg) translateY(-" + radius + "px)";
      ring.appendChild(span);
    }
  }

  /* ------------------------- Language toggle ------------------------- */

  function applyLang(lang) {
    if (data.languages.indexOf(lang) === -1) lang = data.defaultLang;

    var nodes = document.querySelectorAll("[data-ca]");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var value = node.getAttribute("data-" + lang);
      if (value === null || value === "") value = node.getAttribute("data-ca") || "";
      node.textContent = value;
    }

    var buttons = document.querySelectorAll(".lang-switch button");
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].setAttribute(
        "aria-pressed",
        buttons[b].getAttribute("data-lang") === lang ? "true" : "false"
      );
    }

    document.documentElement.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}

    equalizeCaptions(); // title lengths differ per language → re-align image tops
  }

  /* ------------------------- Image top-alignment ------------------------- */

  // Make every image start at the same Y by giving all captions in a row the height of
  // the tallest one (so images align to the "lowest" top). Runs per carousel row.
  function equalizeCaptions() {
    var carousels = document.querySelectorAll(".carousel");
    for (var c = 0; c < carousels.length; c++) {
      var caps = carousels[c].querySelectorAll(".caption");
      var i, max = 0;
      for (i = 0; i < caps.length; i++) caps[i].style.height = "auto";
      for (i = 0; i < caps.length; i++) {
        var h = caps[i].getBoundingClientRect().height;
        if (h > max) max = h;
      }
      for (i = 0; i < caps.length; i++) caps[i].style.height = max + "px";
    }
  }

  /* ------------------------- Init ------------------------- */

  function init() {
    var carousels = document.querySelectorAll(".carousel");
    for (var i = 0; i < carousels.length; i++) setupMarquee(carousels[i]);

    var buttons = document.querySelectorAll(".lang-switch button");
    for (var j = 0; j < buttons.length; j++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          applyLang(btn.getAttribute("data-lang"));
        });
      })(buttons[j]);
    }

    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    applyLang(stored || data.defaultLang);

    buildBadge();
    equalizeCaptions();

    // Re-run once the web font has loaded (glyph metrics change measurement/wrapping).
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { buildBadge(); equalizeCaptions(); });
    }

    // Re-align on resize (wrapping changes with width; also covers the 600px breakpoint).
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(equalizeCaptions, 150);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
