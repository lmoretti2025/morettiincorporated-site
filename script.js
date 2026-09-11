(function () {
  "use strict";

  var body = document.body;
  var video = document.getElementById("bg-video");

  /* ---------------- delayed glitch-shake (font-safe) ---------------- */
  // Some browsers won't apply a newly-loaded custom @font-face to text
  // that's already inside a transformed/animated element - the text gets
  // stuck on the fallback font. These elements use custom fonts, so they
  // start with no shake animation and only get it added once the page's
  // fonts have fully resolved, guaranteeing the right font is already
  // painted before any transform/animation layer is created.
  (function delayedGlitchShake() {
    var targets = [
      { el: document.querySelector(".about-name-mono"), extra: "glitch-shake-b" }
    ];
    function applyShake() {
      targets.forEach(function (t) {
        if (t.el) t.el.classList.add("glitch-shake", t.extra);
      });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(applyShake).catch(applyShake);
    } else {
      applyShake();
    }
  })();

  /* ---------------- logo easter egg: crying face in "i i" ---------------- */
  // every ~10s, the "i i" in "moretti incorporated" briefly becomes a
  // tiny crying face (blinking eyes, a "_" mouth, tinted tear trails)
  // via the "crying" class, then settles back to plain text on its own.
  // The returned trigger lets other things set it off too - switchChannel
  // fires it on every channel change, on top of the idle timer below.
  var triggerLogoCry = (function logoCryingFace() {
    var logoEl = document.getElementById("logo");
    if (!logoEl) return function () {};
    // purely decorative - skipped for visitors who've asked for less motion
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return function () {};

    var CRY_DURATION = 3600; // must match the CSS animation durations
    var cryTimer = null;

    function triggerCry() {
      // If a cry is already running, restart it from the top rather than
      // letting the new one inherit the old one's remaining time. The CSS
      // animations run once, so re-adding an already-present class would
      // do nothing - the class has to come off, force a reflow, go back
      // on. The pending timeout is cleared too, otherwise it would fire
      // mid-cry and cut the restarted animation short.
      if (cryTimer !== null) {
        window.clearTimeout(cryTimer);
        cryTimer = null;
        logoEl.classList.remove("crying");
        // eslint-disable-next-line no-unused-expressions
        void logoEl.offsetWidth; // force reflow so the animations restart
      }
      logoEl.classList.add("crying");
      cryTimer = window.setTimeout(function () {
        cryTimer = null;
        logoEl.classList.remove("crying");
      }, CRY_DURATION);
    }

    window.setInterval(triggerCry, 10000);
    return triggerCry;
  })();

  /* ---------------- scroll reveal (site-wide) ---------------- */
  // any element with [data-reveal] gets an "is-visible" class added the
  // first time it scrolls into view - used for the Scores page stills
  // and credits, and the Music page release items.
  //
  // The IntersectionObserver alone isn't enough here: every page but the
  // active one is display:none at load, so their targets register as
  // "not intersecting" and the observer won't necessarily re-fire when
  // hash routing makes that page visible. Anything already in view when
  // a page opens would then sit at opacity 0 forever. refreshReveal()
  // does a plain geometric check and is called on every route change.
  var refreshReveal = (function scrollReveal() {
    var revealTargets = Array.prototype.slice.call(
      document.querySelectorAll("[data-reveal]")
    );
    if (!revealTargets.length) return function () {};

    function reveal(el) {
      el.classList.add("is-visible");
    }

    if (!("IntersectionObserver" in window)) {
      revealTargets.forEach(reveal);
      return function () {};
    }

    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            reveal(entry.target);
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealTargets.forEach(function (el) {
      revealObserver.observe(el);
    });

    return function refresh() {
      revealTargets.forEach(function (el) {
        if (el.classList.contains("is-visible")) return;
        // offsetParent is null while the element (or an ancestor) is
        // display:none - nothing to measure on a page that isn't showing
        if (!el.offsetParent) return;
        var rect = el.getBoundingClientRect();
        if (rect.height === 0) return;
        var visible =
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        if (visible >= rect.height * 0.15 || visible >= window.innerHeight * 0.15) {
          reveal(el);
          revealObserver.unobserve(el);
        }
      });
    };
  })();

  /* ---------------- scribble setup ---------------- */

  var scribbleTargets = document.querySelectorAll(".scribble-target");

  scribbleTargets.forEach(function (el) {
    var path = el.querySelector(".scribble-path");
    if (!path) return;
    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    el.__scribbleLen = len;
  });

  function scribbleOn(el) {
    if (!el || el.classList.contains("scribbled")) return;
    var path = el.querySelector(".scribble-path");
    el.classList.add("scribbling");
    el.classList.add("scribbled");
    if (path) {
      // force reflow so the transition from full-length offset animates
      // eslint-disable-next-line no-unused-expressions
      path.getBoundingClientRect();
      requestAnimationFrame(function () {
        path.style.strokeDashoffset = "0";
      });
    }
    window.setTimeout(function () {
      el.classList.remove("scribbling");
    }, 650);
  }

  function scribbleOff(el) {
    if (!el || !el.classList.contains("scribbled")) return;
    el.classList.remove("scribbled", "scribbling");
    var path = el.querySelector(".scribble-path");
    if (path) {
      // same stroke-dashoffset transition as the draw-on animation, just
      // running in reverse, so the mark "un-draws" itself
      path.style.strokeDashoffset = el.__scribbleLen != null ? el.__scribbleLen : path.getTotalLength();
    }
  }

  scribbleTargets.forEach(function (el) {
    el.addEventListener("click", function () {
      scribbleOn(el);
    });
  });

  /* ---------------- routing ---------------- */

  var pages = document.querySelectorAll(".page");
  var navItems = document.querySelectorAll(".nav-item[data-target]");
  var validTargets = ["scores", "music", "about"];
  var previousRoute = null;

  // Scores has a second level: #scores is the poster shelf, and
  // #scores/<slug> is one project's page. The slugs come straight from
  // the articles' data-project attributes, so adding a project in the
  // HTML is all it takes.
  var scoresPage = document.getElementById("page-scores");
  var scoreProjects = scoresPage
    ? Array.prototype.slice.call(scoresPage.querySelectorAll(".score-project[data-project]"))
    : [];

  function findScoreProject(slug) {
    for (var i = 0; i < scoreProjects.length; i++) {
      if (scoreProjects[i].dataset.project === slug) return scoreProjects[i];
    }
    return null;
  }

  function showRoute() {
    var hash = (location.hash || "").replace("#", "").toLowerCase();
    var parts = hash.split("/");
    var target = validTargets.indexOf(parts[0]) !== -1 ? parts[0] : "home";
    // an unknown slug just falls back to the shelf
    var project = target === "scores" && parts[1] ? findScoreProject(parts[1]) : null;
    var routeKey = target + (project ? "/" + project.dataset.project : "");

    // each view is independent - never carry scroll position over from
    // one to the next (project pages run many viewports tall, so without
    // this the shelf or another page would open wherever the last one
    // happened to leave off)
    if (routeKey !== previousRoute) {
      window.scrollTo(0, 0);
    }
    previousRoute = routeKey;

    pages.forEach(function (p) {
      p.classList.toggle("active", p.id === "page-" + target);
    });

    if (scoresPage) {
      scoresPage.classList.toggle("is-detail", !!project);
      scoreProjects.forEach(function (a) {
        a.classList.toggle("is-current", a === project);
      });
    }

    body.classList.toggle("subpage", target !== "home");

    navItems.forEach(function (item) {
      // only the nav item for the page you're currently on stays
      // scribbled - every other one un-draws itself
      if (item.dataset.target === target) {
        scribbleOn(item);
      } else {
        scribbleOff(item);
      }
    });

    if (target === "home") {
      document.title = "moretti incorporated";
    } else if (project) {
      var nameEl = project.querySelector(".score-sticky-word");
      document.title =
        (nameEl ? nameEl.textContent.trim() : "Scores") + " — moretti incorporated";
    } else {
      document.title =
        target.charAt(0).toUpperCase() + target.slice(1) + " — moretti incorporated";
    }

    // the page that just became visible may already have content sitting
    // in the viewport - reveal it now rather than waiting for a scroll
    // that may never come (see refreshReveal above). Called synchronously
    // so it still runs if rAF is throttled, then again on the next frame
    // in case layout hadn't settled yet.
    refreshReveal();
    window.requestAnimationFrame(refreshReveal);

    // anything that cares which page is showing listens for this rather
    // than hashchange: with the film open/close animation the DOM only
    // switches a frame after the hash does
    window.dispatchEvent(new Event("routechange"));
  }

  function routeKeyFromHash() {
    var parts = (location.hash || "").replace("#", "").toLowerCase().split("/");
    var target = validTargets.indexOf(parts[0]) !== -1 ? parts[0] : "home";
    var project = target === "scores" && parts[1] ? findScoreProject(parts[1]) : null;
    return target + (project ? "/" + project.dataset.project : "");
  }

  /* ---------------- film open / close (app-style) ---------------- */
  // Going from the poster shelf into a film, the film's page grows out of
  // its poster like an app opening on a phone: the page scales up from
  // the poster's spot inside a rounded window that widens to the full
  // screen, the poster zooms and dissolves into it, and the shelf behind
  // zooms in slightly and dims. Built on the View Transitions API - the
  // browser snapshots the before and after states and these animate the
  // snapshots. The header and mute button are lifted out of the
  // snapshots so they stay perfectly still.
  //
  // Going back is deliberately NOT the reverse, and doesn't use snapshots
  // at all: a page shrinking into its poster spends most of the shrink
  // wider than the poster, cutting across its neighbours, and any
  // crossfade of the two snapshots double-exposes the page over the shelf
  // (both carry the page background). Instead it's done on the live page:
  // the film goes the instant you click, leaving the background (a fixed
  // layer outside both pages, so nothing doubles up), then the shelf fades
  // in and the film's poster settles into place a beat after the others.
  //
  // Browsers without the API, and visitors who've asked for reduced
  // motion, get the instant switch.

  var FILM_OPEN_MS = 640;
  var FILM_SHELF_IN_MS = 360;
  var FILM_EASE = "cubic-bezier(0.32, 0.72, 0, 1)"; // iOS-style: fast out, long settle
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

  function posterFor(slug) {
    var link = scoresPage && scoresPage.querySelector('.poster-link[href="#scores/' + slug + '"]');
    return link ? link.querySelector(".poster-img") : null;
  }

  function animateFilmOpen(r) {
    var html = document.documentElement;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var pcx = r.left + r.width / 2;
    var pcy = r.top + r.height / 2;

    // the page, scaled down to cover the poster and centred on it. The
    // clip is in the page's own (unscaled) coordinates, so the poster's
    // rect is divided back out by the scale
    var s = Math.max(r.width / vw, r.height / vh);
    var pageSmall = "translate(" + (pcx - vw / 2) + "px, " + (pcy - vh / 2) + "px) scale(" + s + ")";
    var ix = (vw - r.width / s) / 2;
    var iy = (vh - r.height / s) / 2;
    var clipSmall = "inset(" + iy + "px " + ix + "px " + iy + "px " + ix + "px round " + (10 / s) + "px)";
    var clipFull = "inset(0px 0px 0px 0px round 0px)";

    // the poster, scaled up to cover the screen and centred
    var S = Math.max(vw / r.width, vh / r.height);
    var posterSmall = "translate(" + r.left + "px, " + r.top + "px) scale(1)";
    var posterBig = "translate(" + (vw / 2 - (r.width * S) / 2) + "px, " + (vh / 2 - (r.height * S) / 2) + "px) scale(" + S + ")";

    var opts = { duration: FILM_OPEN_MS, easing: FILM_EASE, fill: "both" };
    function on(pseudo, keyframes, o) {
      html.animate(keyframes, Object.assign({ pseudoElement: pseudo }, opts, o || {}));
    }

    // the film's page grows out of the poster's spot to the full screen
    on("::view-transition-new(root)", {
      transform: [pageSmall, "none"],
      clipPath: [clipSmall, clipFull]
    });
    // the shelf behind zooms in slightly and dims
    on("::view-transition-old(root)", {
      transform: ["scale(1)", "scale(1.04)"],
      filter: ["brightness(1)", "brightness(0.45)"]
    });
    // the poster zooms with it and hands over to the page early, so it
    // reads as the page emerging from it rather than a picture sliding
    // over it (the easing covers most of the distance early, so the fade
    // sits early too)
    on("::view-transition-group(film-poster)", { transform: [posterSmall, posterBig] });
    on("::view-transition-old(film-poster)",
      [{ opacity: 1 }, { opacity: 0, offset: 0.35 }, { opacity: 0 }],
      { easing: "linear" });
  }

  function runFilmOpen(slug) {
    var poster = posterFor(slug);
    if (!document.startViewTransition || (reduceMotion && reduceMotion.matches) || !poster) {
      showRoute();
      return;
    }
    var html = document.documentElement;
    var rect = poster.getBoundingClientRect();
    poster.style.viewTransitionName = "film-poster";   // named in the before-state only
    html.classList.add("vt-film");

    var switched = false;
    function switchPage() {
      if (switched) return;
      switched = true;
      poster.style.viewTransitionName = "";
      showRoute();
    }
    var vt = document.startViewTransition(switchPage);
    // safety net: the browser only switches the page once it has captured
    // the "before" frame. If that frame never comes, never leave the
    // visitor stuck on the old page - drop the animation and switch.
    window.setTimeout(function () {
      if (switched) return;
      try { vt.skipTransition(); } catch (err) { /* already over */ }
      switchPage();
    }, 500);
    vt.ready.then(function () {
      try { animateFilmOpen(rect); } catch (err) { vt.skipTransition(); }
    }).catch(function () {});
    vt.finished.catch(function () {}).then(function () {
      poster.style.viewTransitionName = "";
      html.classList.remove("vt-film");
    });
  }

  function runFilmClose(slug) {
    var shelf = scoresPage && scoresPage.querySelector(".score-shelf");
    var poster = posterFor(slug);
    // the film goes the instant you click - no fade-out to wait through
    showRoute();
    if ((reduceMotion && reduceMotion.matches) || !shelf || !shelf.animate) return;
    var ease = "cubic-bezier(0.2, 0, 0, 1)";
    shelf.animate([{ opacity: 0, transform: "scale(1.015)" }, { opacity: 1, transform: "none" }],
      { duration: FILM_SHELF_IN_MS, easing: ease });
    // the film you came from arrives a beat after the others, settling in
    if (poster) {
      poster.animate([
        { opacity: 0, transform: "scale(1.06)" },
        { opacity: 0, transform: "scale(1.06)", offset: 0.15 },
        { opacity: 1, transform: "none" }
      ], { duration: FILM_SHELF_IN_MS + 80, easing: ease });
    }
  }

  window.addEventListener("hashchange", function () {
    var from = previousRoute;
    var to = routeKeyFromHash();
    // shelf -> film opens it, film -> shelf closes it; anything else
    // (other pages, film to film) just switches
    if (from === "scores" && to.indexOf("scores/") === 0) {
      runFilmOpen(to.slice(7));
    } else if (to === "scores" && from && from.indexOf("scores/") === 0) {
      runFilmClose(from.slice(7));
    } else {
      showRoute();
    }
  });
  showRoute();

  /* ---------------- channel switching (background video) ---------------- */

  var staticVideo = document.getElementById("static-video");
  var channelAudioEl = document.getElementById("channel-audio");
  var channelButtonEl = document.getElementById("channel-button");
  var currentChannel = "title";
  // ch is the channel's number on the dial (old VHF 2-13; the title screen
  // is channel 3, like a VCR)
  var channelData = {
    "title": { ch: 3, file: "https://media.morettiincorporated.com/video/title.mp4", aspect: "landscape" },
    // each of these pairs a silent, looping video with its own long-form
    // soundtrack (audioFile) that plays independently of the video's loop -
    // the audio keeps playing straight through and does NOT restart every
    // time the (much shorter) video loops back to its start
    "tale-of-the-white-serpent": { ch: 5, file: "https://media.morettiincorporated.com/video/tale-of-the-white-serpent.mp4", aspect: "landscape", audioFile: "https://media.morettiincorporated.com/audio/TALES.m4a" },
    "thief-and-cobbler-1": { ch: 8, file: "https://media.morettiincorporated.com/video/thief-and-cobbler-1.mp4", aspect: "landscape", audioFile: "https://media.morettiincorporated.com/audio/FAFAFA.m4a" },
    // Still Waiting (the song) over the Renaissance Media video
    "still-waiting": { ch: 11, file: "https://media.morettiincorporated.com/video/renaissance-media.mp4", aspect: "landscape", audioFile: "https://media.morettiincorporated.com/audio/STILL-WAITING.m4a" },
    // FEEL plays its own sound, from the video itself (no audioFile), like
    // the title channel; square, so it's shown whole rather than cropped
    "feel": { ch: 6, file: "https://media.morettiincorporated.com/video/feel.mp4", aspect: "square" },
    // Solid Fall (the song) over the CAN'T CATCH UP video
    "solid-fall": { ch: 13, file: "https://media.morettiincorporated.com/video/solid-fall.mp4", aspect: "landscape", audioFile: "https://media.morettiincorporated.com/audio/SOLID-FALL.m4a" }
  };
  // the channels on air (the title screen is always on air too, as ch 3)
  var ALLOWED_CHANNEL_IDS = ["tale-of-the-white-serpent", "thief-and-cobbler-1", "still-waiting", "feel", "solid-fall"];
  var STATIC_DURATION = 2.6; // seconds, approx length of static-effect.mp4
  var switching = false;

  function applyAspect(channelId) {
    var aspect = (channelData[channelId] || {}).aspect || "landscape";
    // disable the transform transition for an instant beat so the aspect
    // scale change never animates/crossfades into view - it's fully
    // hidden under the static overlay, but this keeps it a true hard cut
    var prevTransition = video.style.transition;
    video.style.transition = "none";
    video.classList.toggle("aspect-square", aspect === "square");
    // force reflow so the "none" transition actually takes effect
    void video.offsetHeight;
    video.style.transition = prevTransition;
  }

  applyAspect("title");

  /* ---------------- channel dial ---------------- */
  // The channel button is an old TV tuning knob. Twelve detents around it
  // stand for channels 2-13; the live channels' ticks are drawn longer and
  // brighter. Its outline "boils" - three slightly different hand-drawn
  // circles swapped a few times a second, like an animation cel redrawn
  // each frame. Changing channel clacks the knob round one detent at a
  // time to the new channel's number (always turning forward, the way a
  // real dial goes), counting the CH readout up as it goes, then the
  // readout flickers like a tube settling.
  var dial = (function channelDial() {
    var svg = channelButtonEl && channelButtonEl.querySelector(".dial");
    if (!svg) return { turnTo: function () {}, angle: function () { return 0; }, setRaw: function () {}, settle: function () {} };
    var NS = "http://www.w3.org/2000/svg";
    var readout = channelButtonEl.querySelector(".dial-readout");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var angle = 0;      // accumulated, so the knob only ever turns forward
    var ch = 3;
    var timer = null;

    function el(name, attrs, parent) {
      var n = document.createElementNS(NS, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      parent.appendChild(n);
      return n;
    }
    function polar(r, deg) {
      var a = (deg - 90) * Math.PI / 180;
      return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
    }
    function tick(parent, r1, r2, deg, cls) {
      var p = polar(r1, deg), q = polar(r2, deg);
      var line = el("line", { x1: p[0].toFixed(2), y1: p[1].toFixed(2), x2: q[0].toFixed(2), y2: q[1].toFixed(2) }, parent);
      if (cls) line.setAttribute("class", cls);
    }

    // tick ring: channels 2-13, 30deg apart, 2 at the top
    var live = {};
    Object.keys(channelData).forEach(function (id) {
      if (id === "title" || ALLOWED_CHANNEL_IDS.indexOf(id) !== -1) live[channelData[id].ch] = true;
    });
    var ticks = svg.querySelector(".dial-ticks");
    for (var n = 2; n <= 13; n++) {
      if (live[n]) tick(ticks, 39.5, 46.5, (n - 2) * 30, "is-live");
      else tick(ticks, 42, 45.5, (n - 2) * 30);
    }

    // the boiling rim: the softly ridged edge you grip on an old channel
    // knob (24 rounded bumps), drawn three times with a little hand wobble
    // from a fixed seed - so it's the same drawing on every visit
    var seed = 7;
    function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function wobblyCircle() {
      var pts = [];
      for (var i = 0; i < 120; i++) {
        var deg = i * 3;
        var r = 30.5 + 1.1 * Math.cos(deg * 24 * Math.PI / 180) + (rand() - 0.5) * 0.4;
        var p = polar(r, deg);
        pts.push(p[0].toFixed(2) + " " + p[1].toFixed(2));
      }
      return "M" + pts.join(" L") + " Z";
    }
    var rim = svg.querySelector(".dial-rim");
    var frames = [wobblyCircle(), wobblyCircle(), wobblyCircle()];
    rim.setAttribute("d", frames[0]);
    if (!reduce) {
      el("animate", { attributeName: "d", dur: "0.42s", repeatCount: "indefinite", calcMode: "discrete", values: frames.join(";") }, rim);
    }

    function show() {
      svg.style.setProperty("--dial-angle", angle + "deg");
      channelButtonEl.setAttribute("aria-label", "Change channel, now on channel " + ch);
    }
    function flicker() {
      readout.classList.remove("flicker");
      void readout.offsetWidth;          // restart the animation
      readout.classList.add("flicker");
    }

    // start on the title channel, no animation
    ch = channelData.title.ch;
    angle = (ch - 2) * 30;
    show();

    // dir: 1 turns forward (clockwise), -1 turns back - the "<" and ">" of
    // the label, i.e. the left and right arrow keys
    function turnTo(channelId, dir) {
      var target = (channelData[channelId] || {}).ch;
      if (!target) return;
      dir = dir === -1 ? -1 : 1;
      if (timer) { window.clearTimeout(timer); timer = null; }
      var steps = ((dir * (target - ch)) % 12 + 12) % 12;
      if (!steps) return;
      if (reduce) {
        angle += dir * steps * 30; ch = target; show(); return;
      }
      // quick clacks - the whole turn fits inside the static burst
      var stepMs = Math.min(85, Math.round(460 / steps));
      (function clack() {
        angle += dir * 30;
        ch = dir === 1 ? (ch === 13 ? 2 : ch + 1) : (ch === 2 ? 13 : ch - 1);
        show();
        if (--steps > 0) timer = window.setTimeout(clack, stepMs);
        else { timer = null; flicker(); }
      })();
    }

    return {
      turnTo: turnTo,
      angle: function () { return angle; },
      // while it's being dragged: put the knob at a given angle
      setRaw: function (deg) { svg.style.setProperty("--dial-angle", deg + "deg"); },
      // let go: come to rest on a channel, at its detent nearest where the
      // knob was released (so it never spins the long way round)
      settle: function (targetCh, nearAngle) {
        if (timer) { window.clearTimeout(timer); timer = null; }
        var base = (targetCh - 2) * 30;
        angle = base + 360 * Math.round((nearAngle - base) / 360);
        ch = targetCh;
        show();
        flicker();
      }
    };
  })();

  function switchChannel(channelId, dir) {
    if (switching || channelId === currentChannel || !channelData[channelId]) return;
    switching = true;
    dial.turnTo(channelId, dir);

    // the logo sits above the static overlay (z-index 10 vs 2), so the
    // face is visible reacting to the flip while the noise is on screen
    triggerLogoCry();

    // randomize which slice of the static clip's noise plays, so every
    // channel change sounds/looks a little different
    var randomStart = Math.random() * Math.max(0, STATIC_DURATION - 1.1);
    try {
      staticVideo.currentTime = randomStart;
    } catch (err) {
      /* ignore - metadata may not be loaded yet */
    }

    // hard cut: kill all outgoing audio the instant static starts, no crossfade
    video.muted = true;
    if (channelAudioEl) channelAudioEl.muted = true;
    staticVideo.muted = !body.classList.contains("unmuted");

    var playPromise = staticVideo.play();
    if (playPromise && playPromise.catch) playPromise.catch(function () {});
    staticVideo.classList.add("showing");

    window.setTimeout(function () {
      currentChannel = channelId;
      var entry = channelData[channelId];
      applyAspect(channelId);
      video.src = entry.file;
      video.loop = true; // the video always loops visually
      video.load();
      var p = video.play();
      if (p && p.catch) p.catch(function () {});

      if (entry.audioFile) {
        // separate long-form soundtrack, decoupled from the video's loop -
        // it plays straight through once and does NOT restart every time
        // the (much shorter) video loops back to its start. if the audio
        // itself reaches its own end, it loops back to its own start too.
        if (channelAudioEl) {
          channelAudioEl.loop = true;
          channelAudioEl.src = entry.audioFile;
          channelAudioEl.currentTime = 0;
          channelAudioEl.load();
          var ap = channelAudioEl.play();
          if (ap && ap.catch) ap.catch(function () {});
        }
      } else if (channelAudioEl) {
        channelAudioEl.pause();
        channelAudioEl.removeAttribute("src");
        channelAudioEl.load();
      }
    }, 260);

    window.setTimeout(function () {
      // hard cut back: kill static noise the instant the new channel's
      // audio takes over, no fade
      staticVideo.classList.remove("showing");
      staticVideo.pause();
      staticVideo.muted = true;
      var unmuted = body.classList.contains("unmuted");
      var enteringEntry = channelData[currentChannel];
      if (enteringEntry && enteringEntry.audioFile) {
        // audio comes from the separate <audio> element - keep the video
        // element itself silent so it doesn't double up
        video.muted = true;
        if (channelAudioEl) channelAudioEl.muted = !unmuted;
      } else {
        video.muted = !unmuted;
        if (channelAudioEl) channelAudioEl.muted = true;
      }
      switching = false;
    }, 620);
  }

  /* ---------------- "Change the channel" button ---------------- */

  // the channels on air, in the order they sit round the dial
  function liveChannels() {
    return Object.keys(channelData)
      .filter(function (id) { return id === "title" || ALLOWED_CHANNEL_IDS.indexOf(id) !== -1; })
      .sort(function (a, b) { return channelData[a].ch - channelData[b].ch; });
  }

  // Tap / click / arrow keys: a random channel. Off the title screen the
  // first one is always Still Waiting (the RENAISSANCE MEDIA video); after
  // that it deals from a shuffled bag, so every channel comes up once before
  // any repeats, and never the same one twice in a row. The arrow's
  // direction only decides which way the dial turns to get there. Turning
  // the dial by hand still goes to the exact channel you land on.
  var FIRST_CHANNEL = "still-waiting";
  var channelBag = [];
  function nextRandomChannel() {
    if (currentChannel === "title" && !channelBag.dealt) {
      channelBag.dealt = true;
      if (ALLOWED_CHANNEL_IDS.indexOf(FIRST_CHANNEL) !== -1) return FIRST_CHANNEL;
    }
    var pick;
    do {
      if (!channelBag.length) {
        channelBag = ALLOWED_CHANNEL_IDS.slice();
        for (var i = channelBag.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1)), t = channelBag[i];
          channelBag[i] = channelBag[j]; channelBag[j] = t;
        }
        channelBag.dealt = true;
      }
      pick = channelBag.pop();
    } while (pick === currentChannel && ALLOWED_CHANNEL_IDS.length > 1);
    return pick;
  }

  function changeChannel(dir) {
    tuneTo(nextRandomChannel(), dir === -1 ? -1 : 1);
  }

  // tune straight to a channel. Changing the channel always turns sound on,
  // regardless of the current mute state - no reason to make someone hunt
  // for the mute button right after they've asked for a new channel.
  function tuneTo(channelId, dir) {
    if (!channelId || channelId === currentChannel) return;
    // mid-switch (the static lasts ~0.6s)? catch it on the way out
    if (switching) { window.setTimeout(function () { tuneTo(channelId, dir); }, 120); return; }
    if (scrubPlayers) scrubPlayers.siteMusicTakeover();
    setMuted(false);
    switchChannel(channelId, dir);
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    if (channelAudioEl) {
      var ap = channelAudioEl.play();
      if (ap && ap.catch) ap.catch(function () {});
    }
  }

  // Arrow keys change the channel, as the "Tap < >" label says: right/up
  // turn the dial forward to get there, left/down turn it back. Home page only - that's where the dial
  // is; everywhere else the arrows scroll as normal. Also ignored while
  // focus is inside a text field or the Bandcamp iframe's controls.
  document.addEventListener("keydown", function (e) {
    var dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir || body.classList.contains("subpage")) return;
    var active = document.activeElement;
    var tag = active && active.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (active && active.isContentEditable)) {
      return;
    }
    e.preventDefault();
    changeChannel(dir);
  });

  // Turning the dial by hand: grab it (mouse or finger) and turn - it
  // clacks from detent to detent as you go, and when you let go it tunes to
  // the live channel nearest where you left it. A tap without turning is
  // the same as the button: a random channel.
  var suppressClickUntil = 0;
  (function dialDragging() {
    var wrap = channelButtonEl && channelButtonEl.querySelector(".dial-wrap");
    if (!wrap) return;
    var dragging = false, moved = false, startX = 0, startY = 0, lastA = 0, raw = 0, startRaw = 0;

    function pointerAngle(e) {           // 0 at the top, clockwise, in degrees
      var r = wrap.getBoundingClientRect();
      return Math.atan2(e.clientX - (r.left + r.width / 2), (r.top + r.height / 2) - e.clientY) * 180 / Math.PI;
    }

    wrap.addEventListener("pointerdown", function (e) {
      if (e.button) return;              // left button / touch / pen only
      e.preventDefault();
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      lastA = pointerAngle(e);
      raw = startRaw = dial.angle();
      channelButtonEl.classList.add("is-dragging");
      try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    });

    wrap.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var a = pointerAngle(e);
      raw += ((a - lastA + 540) % 360) - 180;   // unwrapped, so it can go round and round
      lastA = a;
      if (!moved && Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 6) moved = true;
      if (moved) dial.setRaw(Math.round(raw / 30) * 30);
    });

    function release() {
      if (!dragging) return;
      dragging = false;
      channelButtonEl.classList.remove("is-dragging");
      suppressClickUntil = Date.now() + 400;   // the click that follows is this gesture's
      if (!moved) { changeChannel(1); return; }
      // the channel number at the detent it was let go on...
      var detent = ((Math.round(raw / 30) % 12) + 12) % 12;
      var landed = 2 + detent;
      var turnedBack = raw < startRaw;
      // ...and the live channel nearest it (ties go the way it was turned)
      var best = null, bestD = 99;
      liveChannels().forEach(function (id) {
        var n = channelData[id].ch;
        var fwd = ((n - landed) % 12 + 12) % 12, back = ((landed - n) % 12 + 12) % 12;
        var d = Math.min(fwd, back) + ((turnedBack ? fwd < back : back < fwd) ? 0.1 : 0);
        if (d < bestD) { bestD = d; best = id; }
      });
      dial.settle(channelData[best].ch, raw);
      tuneTo(best, turnedBack ? -1 : 1);
    }
    wrap.addEventListener("pointerup", release);
    wrap.addEventListener("pointercancel", release);
  })();

  if (channelButtonEl) {
    // keyboard Enter/Space and clicks outside the knob itself; a click that
    // just ended a tap or turn on the knob is already handled above
    channelButtonEl.addEventListener("click", function () {
      if (Date.now() < suppressClickUntil) return;
      changeChannel(1);
    });

    window.setTimeout(function () {
      channelButtonEl.classList.add("visible");
      // one-time pulse + hint text, synced to when it actually becomes
      // visible rather than page load (it'd otherwise finish playing
      // out while still invisible)
      channelButtonEl.classList.add("attention-cue");
    }, 3000);
  }

  /* ---------------- logo: back to the landing page (channel stays put) ---------------- */

  var logo = document.getElementById("logo");
  logo.addEventListener("click", function (e) {
    e.preventDefault();
    if (location.hash && location.hash !== "#") {
      location.hash = "";
    }
  });

  /* ---------------- mute / unmute ---------------- */

  var muteBtn = document.getElementById("mute-toggle");

  function setMuted(muted) {
    body.classList.toggle("unmuted", !muted);
    var entry = channelData[currentChannel];
    if (entry && entry.audioFile) {
      // this channel's sound comes from the separate <audio> track -
      // keep the video itself silent so it never doubles up
      video.muted = true;
      if (channelAudioEl) channelAudioEl.muted = muted;
    } else {
      video.muted = muted;
      if (channelAudioEl) channelAudioEl.muted = true;
    }
    if (staticVideo.classList.contains("showing")) {
      staticVideo.muted = muted;
    }
  }

  // starts muted - this is the only way to guarantee the background
  // video actually autoplays in every browser. Starting unmuted causes
  // browsers to block/pause autoplay until the visitor interacts with
  // the page, which is worse than just starting muted and letting them
  // opt in via the mute button.
  setMuted(true);

  muteBtn.addEventListener("click", function () {
    setMuted(body.classList.contains("unmuted"));
    // turning the site's sound on while a score track has it? the track
    // steps aside (see waveformScrubs)
    if (body.classList.contains("unmuted") && scrubPlayers) scrubPlayers.siteMusicTakeover();
    scribbleOn(muteBtn);
    // try to (re)start playback now that we have a user gesture
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    if (channelAudioEl) {
      var ap = channelAudioEl.play();
      if (ap && ap.catch) ap.catch(function () {});
    }
  });

  // Ensure video attempts to play as soon as possible.
  document.addEventListener(
    "click",
    function tryPlayOnce() {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      document.removeEventListener("click", tryPlayOnce);
    },
    { once: true }
  );

  /* ---------------- bandcamp player: mute site audio while it's in use ---------------- */
  // Cross-origin iframes don't expose their play/pause state to the parent
  // page, so this uses the standard "focus moved into the iframe" trick:
  // when the user clicks into the Bandcamp embed (e.g. to hit play), the
  // parent window blurs and document.activeElement becomes the iframe.
  // We mute the site's own audio for as long as that focus stays there,
  // and restore it when focus comes back to the main window.
  (function bandcampMuting() {
    var frame = document.getElementById("bandcamp-frame");
    if (!frame) return;
    var mutedForBandcamp = false;

    window.addEventListener("blur", function () {
      if (document.activeElement === frame && !video.muted) {
        mutedForBandcamp = true;
        setMuted(true);
      }
    });

    window.addEventListener("focus", function () {
      if (mutedForBandcamp) {
        mutedForBandcamp = false;
        setMuted(false);
      }
    });

    window.addEventListener("hashchange", function () {
      var hash = (location.hash || "").replace("#", "").toLowerCase();
      if (hash !== "music" && mutedForBandcamp) {
        mutedForBandcamp = false;
        setMuted(false);
      }
    });
  })();

  /* ---------------- waveform scrub players ---------------- */
  // A plain-JS port of the WaveformScrub component: a card with a
  // play / pause / replay button, a seconds countdown, and a bar waveform
  // you scrub by dragging the pin. The original only simulated playback
  // with a timer; each of these drives a real <audio> element, and its
  // bars are the track's real loudness (measured ahead of time, stored in
  // data-peaks on the .scrub element).
  //
  // One sound at a time: starting a track pauses the site's own music
  // (the background channel), and when the track finishes, the site's
  // music comes back. A manual pause keeps the site quiet, so resuming
  // the track doesn't flip the background music on and off. Leaving the
  // project page stops the track and brings the site's music back. And
  // if the visitor turns the site's sound on themselves mid-track - the
  // mute button, or changing channel - the track steps aside instead.
  var scrubPlayers = (function waveformScrubs() {
    var roots = document.querySelectorAll(".scrub[data-src]");
    var active = null;           // the player holding the audio (playing or paused mid-track)
    var pausedSiteMusic = false; // true while we're the reason the site's music is off

    var ICONS =
      '<svg class="scrub-icon scrub-icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z"/></svg>' +
      '<svg class="scrub-icon scrub-icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z"/><path d="M17 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z"/></svg>' +
      '<svg class="scrub-icon scrub-icon-replay" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5"/><path d="M5.63 7.16l0 .01"/><path d="M4.06 11l0 .01"/><path d="M4.63 15.1l0 .01"/><path d="M7.16 18.37l0 .01"/><path d="M11 19.94l0 .01"/></svg>';

    function pauseSiteMusic() {
      // nothing to pause if the visitor never turned the site's sound on
      if (pausedSiteMusic || !body.classList.contains("unmuted")) return;
      pausedSiteMusic = true;
      video.muted = true;
      // the separate soundtrack is paused rather than muted, so it picks up
      // where it left off instead of carrying on unheard
      if (channelAudioEl) channelAudioEl.pause();
    }

    function resumeSiteMusic() {
      if (!pausedSiteMusic) return;
      pausedSiteMusic = false;
      // the visitor may have muted the site in the meantime - respect that
      if (!body.classList.contains("unmuted")) return;
      setMuted(false);
      if (channelAudioEl && channelAudioEl.getAttribute("src")) {
        var ap = channelAudioEl.play();
        if (ap && ap.catch) ap.catch(function () {});
      }
    }

    function barsHTML(peaks) {
      return peaks.map(function (h) {
        // h * 1.6px in the component; 0.1em = 1.6px at its 16px scale
        return '<span class="scrub-bar" style="height:' + (h * 0.1).toFixed(2) + 'em"></span>';
      }).join("");
    }

    function createPlayer(root) {
      // score cues are unnamed on screen; data-name shows a title if one
      // is ever wanted. Screen readers always get a label - the name, or
      // "<film title>, cue N" worked out from the page.
      var name = root.dataset.name || "";
      var project = root.closest(".score-project");
      var titleEl = project && project.querySelector(".score-sticky-word");
      var cues = project ? project.querySelectorAll(".scrub[data-src]") : [root];
      var label = name ||
        ((titleEl ? titleEl.textContent.trim() + ", " : "") +
         "cue " + (Array.prototype.indexOf.call(cues, root) + 1));
      var duration = parseFloat(root.dataset.duration) || 0;
      var peaks = (root.dataset.peaks || "").split(",").map(Number).filter(function (n) { return n > 0; });
      var bars = barsHTML(peaks);

      root.innerHTML =
        '<div class="scrub-card">' +
          '<div class="scrub-head">' +
            '<div class="scrub-head-left">' +
              '<button class="scrub-btn" type="button">' + ICONS + '</button>' +
              (name ? '<span class="scrub-name"></span>' : '') +
            '</div>' +
            '<span class="scrub-time"></span>' +
          '</div>' +
          '<div class="scrub-track">' +
            '<div class="scrub-stripes"></div>' +
            '<div class="scrub-wave">' +
              '<div class="scrub-bars">' + bars + '</div>' +
              '<div class="scrub-bars scrub-bars-active" aria-hidden="true">' + bars + '</div>' +
              '<div class="scrub-handle" role="slider" tabindex="0" aria-valuemin="0">' +
                '<div class="scrub-handle-head"></div>' +
                '<div class="scrub-handle-stem"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      var btn = root.querySelector(".scrub-btn");
      var nameEl = root.querySelector(".scrub-name");
      var timeEl = root.querySelector(".scrub-time");
      var wave = root.querySelector(".scrub-wave");
      var handle = root.querySelector(".scrub-handle");
      if (nameEl) nameEl.textContent = name;
      handle.setAttribute("aria-label", "Seek " + label);

      var audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = root.dataset.src;
      root.appendChild(audio);

      var current = 0;
      var playing = false;
      var dragging = false;
      var raf = null;
      var player;

      function isFinished() {
        return duration > 0 && current >= duration - 0.05;
      }

      function render() {
        var p = duration ? Math.min(current / duration, 1) : 0;
        root.style.setProperty("--p", p);
        timeEl.textContent = Math.max(0, Math.round(duration - current)) + "s";
        var state = playing ? "playing" : isFinished() ? "finished" : "paused";
        root.dataset.state = state;
        btn.setAttribute("aria-label",
          (state === "playing" ? "Pause " : state === "finished" ? "Replay " : "Play ") + label);
        handle.setAttribute("aria-valuemax", Math.round(duration));
        handle.setAttribute("aria-valuenow", Math.round(current));
        handle.setAttribute("aria-valuetext", Math.round(current) + " of " + Math.round(duration) + " seconds");
      }

      function tick() {
        if (!playing) { raf = null; return; }
        if (!dragging) current = audio.currentTime;
        render();
        raf = requestAnimationFrame(tick);
      }

      function seekAudio() {
        try { audio.currentTime = current; } catch (err) { /* not loaded yet - play() re-applies it */ }
      }

      function play() {
        if (isFinished()) current = 0;
        // another track mid-way? it steps aside, and the site's music stays paused
        if (active && active !== player) active.pause();
        active = player;
        pauseSiteMusic();
        if (Math.abs(audio.currentTime - current) > 0.05) seekAudio();
        playing = true;
        var pr = audio.play();
        if (pr && pr.catch) {
          pr.catch(function () {
            // couldn't play (file missing, blocked...) - hand the sound back
            playing = false;
            if (active === player) { active = null; resumeSiteMusic(); }
            render();
          });
        }
        render();
        if (!raf) raf = requestAnimationFrame(tick);
      }

      function pause() {
        if (playing) current = audio.currentTime;
        playing = false;
        audio.pause();
        render();
      }

      audio.addEventListener("loadedmetadata", function () {
        // the real length beats the stored one if they differ at all
        if (isFinite(audio.duration) && audio.duration > 0) {
          duration = audio.duration;
          render();
        }
      });
      // keeps the display moving where requestAnimationFrame is throttled
      audio.addEventListener("timeupdate", function () {
        if (playing && !dragging) { current = audio.currentTime; render(); }
      });
      audio.addEventListener("ended", function () {
        playing = false;
        current = duration;
        render();
        if (active === player) { active = null; resumeSiteMusic(); }
      });

      btn.addEventListener("click", function () {
        if (playing) pause();
        else play();
      });

      // dragging the pin: relative to where it was grabbed (like framer's
      // drag), so it doesn't jump to centre under the pointer. Grabbing it
      // pauses playback, as in the original.
      var dragStartX = 0;
      var dragStartTime = 0;
      handle.addEventListener("pointerdown", function (e) {
        if (!duration) return;
        e.preventDefault();
        if (playing) pause();
        dragging = true;
        dragStartX = e.clientX;
        dragStartTime = current;
        root.classList.add("is-dragging");
        // keeps the drag alive when the pointer leaves the pin
        try { handle.setPointerCapture(e.pointerId); } catch (err) { /* e.g. pointer already gone */ }
      });
      handle.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        var width = wave.getBoundingClientRect().width || 1;
        current = Math.min(Math.max(dragStartTime + ((e.clientX - dragStartX) / width) * duration, 0), duration);
        render();
      });
      function endDrag() {
        if (!dragging) return;
        dragging = false;
        root.classList.remove("is-dragging");
        seekAudio();
      }
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);

      // keyboard: arrows nudge 5s, Home / End jump. Up/Down are stopped
      // here so they don't also reach the page's change-channel shortcut.
      handle.addEventListener("keydown", function (e) {
        var step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[e.key];
        if (step === undefined && e.key !== "Home" && e.key !== "End") return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Home") current = 0;
        else if (e.key === "End") current = duration;
        else current = Math.min(Math.max(current + step, 0), duration);
        seekAudio();
        render();
      });

      render();
      player = { root: root, pause: pause };
      return player;
    }

    Array.prototype.forEach.call(roots, createPlayer);

    // leaving the project page stops its track and gives the site's music back
    window.addEventListener("routechange", function () {
      if (!active) return;
      var article = active.root.closest(".score-project");
      if (article && article.classList.contains("is-current")) return;
      active.pause();
      active = null;
      resumeSiteMusic();
    });

    return {
      // called when the visitor turns the site's own sound on (mute button,
      // changing channel): any track steps aside, and there's nothing to
      // resume later because the site's music is already back
      siteMusicTakeover: function () {
        if (active) { active.pause(); active = null; }
        pausedSiteMusic = false;
      }
    };
  })();
})();
