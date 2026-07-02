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
  // via the "crying" class, then settles back to plain text on its own
  (function logoCryingFace() {
    var logoEl = document.getElementById("logo");
    if (!logoEl) return;
    var CRY_DURATION = 3600; // must match the CSS animation durations
    function triggerCry() {
      logoEl.classList.add("crying");
      window.setTimeout(function () {
        logoEl.classList.remove("crying");
      }, CRY_DURATION);
    }
    window.setInterval(triggerCry, 10000);
  })();

  /* ---------------- scroll reveal (site-wide) ---------------- */
  // any element with [data-reveal] gets an "is-visible" class added the
  // first time it scrolls into view - used for the Film page collage and
  // the About page's script-text writing animation
  (function scrollReveal() {
    var revealTargets = document.querySelectorAll("[data-reveal]");
    if (!revealTargets.length) return;
    if ("IntersectionObserver" in window) {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      revealTargets.forEach(function (el) {
        revealObserver.observe(el);
      });
    } else {
      revealTargets.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
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
  var validTargets = ["music", "film", "about"];
  var previousTarget = null;

  function showRoute() {
    var hash = (location.hash || "").replace("#", "").toLowerCase();
    var target = validTargets.indexOf(hash) !== -1 ? hash : "home";

    // each page is its own, independent view - never carry scroll
    // position over from one page to the next (Film in particular runs
    // many viewports tall, so without this About/Music would open
    // wherever Film happened to leave off)
    if (target !== previousTarget) {
      window.scrollTo(0, 0);
    }
    previousTarget = target;

    pages.forEach(function (p) {
      p.classList.toggle("active", p.id === "page-" + target);
    });

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
    } else {
      document.title =
        target.charAt(0).toUpperCase() + target.slice(1) + " — moretti incorporated";
    }
  }

  window.addEventListener("hashchange", showRoute);
  showRoute();

  /* ---------------- channel switching (background video) ---------------- */

  var staticVideo = document.getElementById("static-video");
  var channelAudioEl = document.getElementById("channel-audio");
  var channelButtonEl = document.getElementById("channel-button");
  var currentChannel = "title";
  var channelData = {
    "title": { file: "https://media.morettiincorporated.com/video/title.mp4", aspect: "landscape" },
    "intermission": { file: "https://media.morettiincorporated.com/video/intermission.mp4", aspect: "square" },
    "night": { file: "https://media.morettiincorporated.com/video/night.mp4", aspect: "square" },
    "episode-1": { file: "https://media.morettiincorporated.com/video/episode-1.mp4", aspect: "landscape" },
    "cant-catch-up-intro-2": { file: "https://media.morettiincorporated.com/video/cant-catch-up-intro-2.mp4", aspect: "square" },
    "julien": { file: "https://media.morettiincorporated.com/video/julien.mp4", aspect: "square" },
    "postcard": { file: "https://media.morettiincorporated.com/video/postcard.mp4", aspect: "square" },
    "discipline-to-remember": { file: "https://media.morettiincorporated.com/video/discipline-to-remember.mp4", aspect: "square" },
    // these two have their own long-form soundtrack (audioFile) that plays
    // independently of the video - the video loops silently, the audio
    // just keeps playing through and does NOT restart on each loop
    "tale-of-the-white-serpent": { file: "https://media.morettiincorporated.com/video/tale-of-the-white-serpent.mp4", aspect: "landscape", audioFile: "https://media.morettiincorporated.com/audio/TALES.wav" },
    "thief-and-cobbler-1": { file: "https://media.morettiincorporated.com/video/thief-and-cobbler-1.mp4", aspect: "landscape", audioFile: "https://media.morettiincorporated.com/audio/FAFAFA.wav" },
    "thief-and-cobbler-2": { file: "https://media.morettiincorporated.com/video/thief-and-cobbler-2.mp4", aspect: "landscape", audioFile: "https://media.morettiincorporated.com/audio/MERRY.wav" },
    "serpent-2": { file: "https://media.morettiincorporated.com/video/serpent-2.mp4", aspect: "landscape", audioFile: "https://media.morettiincorporated.com/audio/KEYSHIA-LOVE-LIVE.wav" }
  };
  // only these channels are in rotation for the button right now - the
  // rest of channelData above is left intact so it's easy to re-enable later
  var ALLOWED_CHANNEL_IDS = ["cant-catch-up-intro-2", "tale-of-the-white-serpent", "thief-and-cobbler-1", "thief-and-cobbler-2", "serpent-2"];
  var STATIC_DURATION = 2.6; // seconds, approx length of static-effect.mp4
  var switching = false;

  /* ---------------- shuffle-bag channel picker ---------------- */
  // guarantees every allowed channel plays once before any of them repeat -
  // so the same video can never come back around within fewer than
  // ALLOWED_CHANNEL_IDS.length - 1 other channels having played first
  var shuffleBag = [];

  function refillShuffleBag(avoidFirst) {
    var ids = ALLOWED_CHANNEL_IDS.slice();
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    // don't let a fresh bag start with the same channel that just finished
    // the previous bag - that would be a back-to-back repeat
    if (avoidFirst && ids.length > 1 && ids[0] === avoidFirst) {
      var swapAt = 1 + Math.floor(Math.random() * (ids.length - 1));
      var t = ids[0];
      ids[0] = ids[swapAt];
      ids[swapAt] = t;
    }
    shuffleBag = ids;
  }

  function nextChannelFromBag() {
    if (!shuffleBag.length) {
      refillShuffleBag(currentChannel);
    }
    return shuffleBag.shift();
  }

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

  function switchChannel(channelId) {
    if (switching || channelId === currentChannel || !channelData[channelId]) return;
    switching = true;

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
    // "switching" swaps in a fast opacity transition so the button text
    // actually disappears for the static screen instead of just barely
    // starting to fade (the default transition is a slow, one-time
    // page-load reveal)
    if (channelButtonEl) channelButtonEl.classList.add("hidden-for-static", "switching");

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
      if (channelButtonEl) channelButtonEl.classList.remove("hidden-for-static");
      switching = false;
    }, 620);

    // drop back to the slow transition once the fast reveal has finished,
    // so it doesn't affect unrelated opacity changes later
    window.setTimeout(function () {
      if (channelButtonEl) channelButtonEl.classList.remove("switching");
    }, 760);
  }

  /* ---------------- "Change the channel" button ---------------- */

  function changeChannel() {
    var pick = nextChannelFromBag();
    if (!pick) return;
    // changing the channel always turns sound on, regardless of the
    // current mute state - no reason to make someone hunt for the mute
    // button right after they've asked for a new channel
    setMuted(false);
    switchChannel(pick);
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    if (channelAudioEl) {
      var ap = channelAudioEl.play();
      if (ap && ap.catch) ap.catch(function () {});
    }
  }

  // Up/Down arrow keys do the same thing as clicking the channel button -
  // ignore them while focus is inside a text field or the Bandcamp
  // iframe's controls so the browser's own scroll/player behavior isn't
  // stomped on
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    var active = document.activeElement;
    var tag = active && active.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (active && active.isContentEditable)) {
      return;
    }
    e.preventDefault();
    changeChannel();
  });

  if (channelButtonEl) {
    channelButtonEl.addEventListener("click", changeChannel);

    window.setTimeout(function () {
      channelButtonEl.classList.add("visible");
      // one-time pulse + hint text, synced to when it actually becomes
      // visible rather than page load (it'd otherwise finish playing
      // out while still invisible)
      channelButtonEl.classList.add("attention-cue");
    }, 3000);
  }

  /* ---------------- logo: back to landing page / TITLE channel ---------------- */

  var logo = document.getElementById("logo");
  logo.addEventListener("click", function (e) {
    e.preventDefault();
    if (location.hash && location.hash !== "#") {
      location.hash = "";
    }
    switchChannel("title");
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

  /* ---------------- film page: sticky title swap ---------------- */

  (function filmPageScroll() {
    var filmPage = document.getElementById("page-film");
    if (!filmPage) return;

    // crossfade the sticky title between "Gatorville" and
    // "like little earthquakes" depending on which collage section
    // currently sits at the vertical center of the viewport
    var collageSections = Array.prototype.slice.call(
      filmPage.querySelectorAll("[data-collage]")
    );
    var stickyWords = filmPage.querySelectorAll(".film-sticky-word");
    if (collageSections.length && stickyWords.length) {
      var ticking = false;

      function updateStickyWord() {
        ticking = false;
        var centerY = window.innerHeight * 0.44;
        var activeWord = collageSections[0].dataset.collage;

        collageSections.forEach(function (section) {
          var rect = section.getBoundingClientRect();
          if (rect.top <= centerY && rect.bottom >= centerY) {
            activeWord = section.dataset.collage;
          }
        });

        stickyWords.forEach(function (word) {
          word.classList.toggle("active", word.dataset.word === activeWord);
        });
      }

      window.addEventListener("scroll", function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateStickyWord);
        }
      });
      window.addEventListener("hashchange", updateStickyWord);
      updateStickyWord();
    }
  })();
})();
