/* Front-end behavior for the jdfrigola portfolio:
   - Infinite marquee carousels driven by a requestAnimationFrame position loop: auto-scroll
     plus drag/swipe (touch, mouse, trackpad) with momentum that settles back into the
     auto-scroll; hovering an image eases it to a slow crawl.
   - Image top-alignment: caption heights normalized per row so all image tops line up.
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

  // A single rAF position loop per carousel drives the auto-scroll AND lets the visitor
  // drag/swipe (touch, mouse, trackpad). Velocity always relaxes toward the auto-scroll
  // speed, so a fling's momentum decays smoothly back into the normal motion.
  function setupMarquee(carousel) {
    var track = carousel.querySelector(".track");
    if (!track || reduceMotion) return; // reduced motion → native horizontal scroll

    var dir = carousel.getAttribute("data-direction") || "left";
    var speed = parseFloat(carousel.getAttribute("data-speed")) || 45; // s per half-loop
    var dirSign = dir === "right" ? -1 : 1;

    var slowFactor = typeof data.hoverSlowFactor === "number" ? data.hoverSlowFactor : 0.2;
    var easeMs = typeof data.hoverEaseMs === "number" ? data.hoverEaseMs : 600;
    var tau = typeof data.dragSettleMs === "number" ? data.dragSettleMs : 350;

    // half = width of one copy of the item list (the track holds two); wrapping pos at
    // `half` gives a seamless loop.
    var half = 1;
    function measure() { half = (track.scrollWidth / 2) || 1; }
    measure();
    window.addEventListener("resize", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    var pos = 0;                                  // transform = translateX(-pos)
    var vel = dirSign * (half / (speed * 1000));  // px/ms, starts at auto speed
    var dragging = false;

    // Hover slow-down: rate multiplier eased 1 <-> slowFactor (symmetric, same as before).
    var rm = 1, rmFrom = 1, rmTo = 1, rmStart = -1;
    function setRate(target) { if (target !== rmTo) { rmFrom = rm; rmTo = target; rmStart = -1; } }

    var lastTs = -1;
    function frame(ts) {
      if (lastTs < 0) lastTs = ts;
      var dt = Math.min(50, ts - lastTs); // clamp so a backgrounded tab doesn't jump
      lastTs = ts;

      if (rmStart < 0 && rm !== rmTo) rmStart = ts;
      if (rmStart >= 0) {
        var te = easeMs > 0 ? Math.min(1, (ts - rmStart) / easeMs) : 1;
        rm = rmFrom + (rmTo - rmFrom) * easeInOutCubic(te);
        if (te >= 1) { rm = rmTo; rmStart = -1; }
      }

      var autoV = dirSign * (half / (speed * 1000)) * rm;
      if (!dragging) {
        vel += (autoV - vel) * (1 - Math.exp(-dt / tau)); // momentum → settle to auto
        pos += vel * dt;
      }
      pos = ((pos % half) + half) % half;
      track.style.transform = "translateX(" + (-pos) + "px)";
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // Hover to slow (mouse only; touch has no hover), image area only.
    function overImage(e) { return e.target && e.target.tagName === "IMG"; }
    carousel.addEventListener("mouseover", function (e) { if (overImage(e)) setRate(slowFactor); });
    carousel.addEventListener("mouseout", function (e) { if (overImage(e)) setRate(1); });

    // Drag / swipe via Pointer Events (touch, pen, mouse unified). We do NOT capture on
    // pointerdown — capturing only after a horizontal drag is confirmed keeps native
    // vertical page scrolling working when a touch starts on a carousel.
    var THRESH = 4, startX = 0, startY = 0, startPos = 0, pending = false, lastX = 0, lastT = 0;
    carousel.addEventListener("pointerdown", function (e) {
      if (e.button && e.button !== 0) return; // primary button / touch only
      pending = true;
      startX = e.clientX; startY = e.clientY; startPos = pos;
      lastX = e.clientX; lastT = e.timeStamp;
    });
    carousel.addEventListener("pointermove", function (e) {
      if (!pending) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) return; // still a tap
        if (Math.abs(dy) > Math.abs(dx)) { pending = false; return; } // vertical → let page scroll
        dragging = true;
        carousel.classList.add("dragging");
        try { carousel.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
      pos = startPos - dx;
      var dtp = e.timeStamp - lastT;
      if (dtp > 0) vel = -((e.clientX - lastX) / dtp); // fling velocity in pos units
      lastX = e.clientX; lastT = e.timeStamp;
    });
    function endDrag(e) {
      if (!pending) return;
      pending = false;
      if (dragging) { dragging = false; carousel.classList.remove("dragging"); }
      try { carousel.releasePointerCapture(e.pointerId); } catch (err) {}
      // vel holds the fling; the relax term settles it back into the auto-scroll.
    }
    carousel.addEventListener("pointerup", endDrag);
    carousel.addEventListener("pointercancel", endDrag);

    // Trackpad / horizontal wheel: nudge position, small glide.
    carousel.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // leave vertical scroll alone
      e.preventDefault();
      pos += e.deltaX;
      vel = e.deltaX / 12;
    }, { passive: false });
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
