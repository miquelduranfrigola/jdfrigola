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
  };
  try {
    var el = document.getElementById("site-data");
    if (el) data = JSON.parse(el.textContent);
  } catch (e) { /* fall back to defaults */ }

  var STORAGE_KEY = "jdf-lang";
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------- Marquee ------------------------- */

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInCubic(t) { return t * t * t; }

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

    // Tween playbackRate smoothly so the carousel eases to a stop / back up to speed.
    var rafId = null;
    function tweenRate(target, ease) {
      if (rafId) cancelAnimationFrame(rafId);
      var from = anim.playbackRate;
      var duration = 500;
      var startTs = null;
      function step(ts) {
        if (startTs === null) startTs = ts;
        var t = Math.min(1, (ts - startTs) / duration);
        anim.playbackRate = from + (target - from) * ease(t);
        if (t < 1) rafId = requestAnimationFrame(step);
        else rafId = null;
      }
      rafId = requestAnimationFrame(step);
    }

    // Only ease to a stop while the pointer is over an IMAGE — not the caption text
    // above it nor the empty space / sold-dot below it. Delegated so it works for every
    // (duplicated) image in the moving track.
    function overImage(e) { return e.target && e.target.tagName === "IMG"; }
    carousel.addEventListener("mouseover", function (e) { if (overImage(e)) tweenRate(0, easeOutCubic); });
    carousel.addEventListener("mouseout", function (e) { if (overImage(e)) tweenRate(1, easeInCubic); });
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
    // Rebuild once the web font has loaded so character measurement is accurate.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(buildBadge);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
