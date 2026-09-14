/* ENGINE · THE FLOAT'S DOOR, the READER's half  ·  design: design/reader/FLOAT.md §4
   · mounted by: reader/reader.html, one <script src>, after listen.js and the
     transport, beside cursor.js
   · the other half is reader/float.js, in the panel's own webview
   · node test: reader/tests/test_float.py

   TWO WEBVIEWS CANNOT SHARE A VARIABLE, AND THIS IS WHERE A FLOAT GOES WRONG.
   The rule from 6 September holds and is the reason there is a door at all:
   **never one message per word.** 3.56 words/s typically, 16.4/s at p01,
   forever, over a JSON bridge (`the_float_needs_a_background_mode`). So:

     kind "chapter"   once, when the chapter opens or changes
                      { label, slug, chapter, words:[...], starts:[...],
                        sentEnds:[...] }
     kind "tick"      4 Hz while playing, and on every seek, pause and play
                      { label, t, playing }        a drift correction
     kind "say"       a quiet answer, when there is one, for the caption line

   The panel runs `reader/wordclock.js` at 60 Hz between the ticks -- the same
   file probe-b and probe-c use, byte for byte -- so the word is exact and the
   traffic is four messages a second instead of two and a half thousand a
   chapter, because `indexAt` is one rule in one file.

   ★ WHERE `words` AND `starts` COME FROM IS THE SEAM THAT MUST NOT BE RE-CUT.
   `listen.js`'s per-chapter map is already built from `chapters/<cid>.txt` +
   `timings/<cid>.json` with its own count check. The chapter payload is READ
   OFF THAT MAP and never re-derived: a door that re-cut the chapter would be a
   second word index disagreeing with the page's, which is exactly the failure
   `build-timeline.mjs` avoids by lifting `tokenise` out of `listen.js`
   verbatim. So `chapterPayload` walks `timings.sentences` in reading order and
   takes each word's TEXT from `map.byWordId` -- the characters actually on the
   page -- and its START from the timings. A word the map refused (a paragraph
   whose token count did not agree with its sentences) is DROPPED rather than
   guessed at, and the count of those is returned with the payload so a caller
   can say the number out loud instead of feeling it.

   ★ AND `sentEnds` IS THE CAPTION, FROM THE SAME WALK. FLOAT.md §3: the
   caption line is `wordpane.css`'s `.wordsub`, unchanged, *"so the sentence
   around the word reads in the float exactly as it reads in the one-word
   view"*. A sentence is where the caption's two ends come from, so the payload
   carries one integer per sentence -- the index one PAST its last word, after
   the drops -- built inside the very loop that drops them, so the two can
   never disagree. It is one field FLOAT.md's five did not name, and it is here
   rather than in the panel because a panel that re-cut the chapter into
   sentences would be the second cut this whole file exists to prevent.

   ★ THE MASTERLESS CHAPTER HAS NO CLOCK AND NEEDS NONE. `sysvoice.js` speaks
   off `speechSynthesis`, one utterance per sentence, and its `onboundary`
   already moves the one cursor; `state()` returns `{chapter, word, sentence,
   span}`. So on that path the float gets ONE EVENT PER WORD BOUNDARY -- 3.56/s,
   FEWER messages than the 4 Hz tick -- and no interpolation at all. Same event
   name, `kind:"tick"` with `word` instead of `t`.

   ★ NOTHING NEW IS STORED. FLOAT.md §5 sketched the float writing the word id
   back to `wordcursor:<slug>` on close; that was written for the iOS road,
   where the app is in the background and may be killed. On the Mac the reader
   window is never unloaded and the float's transport comes back HERE, so it is
   the reader's own clock that moves and the reader's own cursor that follows
   -- the cursor `cursor.js` coalesces and `openBook` seats on (K24). Closing
   the panel leaves the reader on the word the float was showing, and this file
   writes nothing anywhere. Osca, 13 Sep: *the float is another view of the
   SAME record, no second store.* POSITION IS SACRED, by not touching it.

   ★ THE STRIP IS ROUTED, NOT INTERPRETED. Four of the panel's seven presses
   are `voiceui/QUIET.md`'s ring, entering voiceui at exactly the point a heard
   utterance does (`handleUtterance`, through `VoiceUI.quiet(direction)`), and
   three are the transport, which is `window.Transport` and nothing else. This
   file knows which door each name goes through and nothing about what any of
   them MEAN; a float that decided what "Explain" meant would be a second
   command brain. `ROUTES` is that table, pure, so it is an assertion rather
   than an application.

   It names `window.TTSTVHost` and no Tauri global (reader/README.md's rule and
   the search re-wire's, 6 Sep). With no host -- a plain browser, the phone
   shell, the design bench -- every call here is a no-op and the reader is
   exactly the reader it was. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FloatDoor = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* THE TWO EVENT NAMES. `desktop/src-tauri/src/floatwin.rs` holds the same
     two strings and a Rust test reads them out of this file and out of
     float.js, so the seam cannot drift -- the shape `ttstv:tab-drop` already
     has (`mirror-routes-and-seam-tests`). */
  var FEED_EVENT = "ttstv:float";
  var CMD_EVENT = "ttstv:float-cmd";

  /* 4 Hz, and the number is the design's: a drift correction, never a word.
     The 60 Hz painting happens in the panel, off the clock, between these. */
  var TICK_MS = 250;

  /* THE STRIP'S SEVEN, AND THE DOOR EACH ONE GOES THROUGH (FLOAT.md §3).

       the float says   the ring's      what routes it today
       Ask              `what` (up)     grammar.js -> resolve.js -> answers.js
       Explain          `ground` (right) the same, and the second face replaces
                                        the four labels while a ground stop is
                                        standing -- exactly the ring's two
                                        faces, drawn instead of flicked
       Define           --              lookup.js's getDictionaryEntry
       Translate        --              the paired sentence, align/'s map

     Three are transport, and they are the ONE place QUIET.md's rule *"controls
     need no voice and need no ring"* is deliberately reversed. The reason is
     stated so it cannot spread: **on a float there is no transport to be a
     copy of** -- the capsule is in the reader window, behind whatever the user
     is working in. On the float, back/play/forward are the originals.

     `Explain` = `ground` is FLOAT.md §6.1, Osca's to confirm; it is written
     here in ONE place so one word from him is one line. */
  var ROUTES = {
    ask:       { via: "quiet",     arg: "up" },
    explain:   { via: "quiet",     arg: "right" },
    define:    { via: "lookup",    arg: null },
    translate: { via: "translate", arg: null },
    play:      { via: "transport", arg: "toggle" },
    back:      { via: "transport", arg: "prev" },
    fwd:       { via: "transport", arg: "next" },
    close:     { via: "close",     arg: null },
  };

  function host() {
    var H = typeof window !== "undefined" ? window.TTSTVHost : null;
    return H && typeof H.floatFeed === "function" ? H : null;
  }

  /* ------------------------------------------------------------- the payload

     PURE, and it takes the map and the timings rather than the page, so the
     test drives it with the real shapes and no DOM at all. Returns
     `{payload, dropped}`: `dropped` is the words the map refused, which is the
     number a report has to carry rather than a feeling. */
  function chapterPayload(o) {
    o = o || {};
    var timings = o.timings, map = o.map;
    var words = [], starts = [], sentEnds = [], dropped = 0;
    var sents = (timings && timings.sentences) || [];
    for (var i = 0; i < sents.length; i++) {
      var ws = sents[i].words || [];
      for (var j = 0; j < ws.length; j++) {
        var hit = map && map.byWordId ? map.byWordId.get(ws[j].id) : null;
        /* THE TEXT IS THE PAGE'S OWN CHARACTERS, sliced out of the very text
           node the highlight measures -- not `book-data.js`, not a re-tokenise,
           not the timings' own idea of a word. One word index, one source. */
        var text = hit && hit.node ? String(hit.node.nodeValue).slice(hit.s, hit.e) : null;
        if (text == null || text === "") { dropped++; continue; }
        words.push(text);
        starts.push(+ws[j].start || 0);
      }
      /* one per sentence that put a word on the page; a sentence the map
         refused entirely leaves no mark, because a caption cannot be drawn
         round words that are not there */
      if (!sentEnds.length || sentEnds[sentEnds.length - 1] !== words.length) {
        if (words.length) sentEnds.push(words.length);
      }
    }
    return {
      dropped: dropped,
      payload: {
        label: o.label || "float",
        kind: "chapter",
        slug: o.slug || "",
        chapter: (map && map.id) || (o.chapterId || ""),
        words: words,
        starts: starts,
        sentEnds: sentEnds,
      },
    };
  }

  function tickPayload(o) {
    o = o || {};
    var p = { label: o.label || "float", kind: "tick", playing: !!o.playing };
    /* ONE OF TWO CLOCKS AND NEVER BOTH: a rendered master answers in SECONDS
       and the system voice answers in WORDS. A payload carrying both would be
       two positions for one cursor, which is the thing this whole file is
       written to avoid. */
    if (o.word != null) p.word = o.word | 0;
    else p.t = +o.t || 0;
    return p;
  }

  function sayPayload(text, label) {
    return { label: label || "float", kind: "say", text: String(text == null ? "" : text) };
  }

  /* ------------------------------------------------------------- the routing

     Pure: a command name and the doors available, in, and what was done, out.
     `null` means the name is not one of the seven, or its door is not on this
     page -- a book with no second language has no Translate, and saying so is
     better than translating nothing. */
  function route(cmd, doors) {
    var r = ROUTES[String(cmd || "").toLowerCase()];
    if (!r) return null;
    doors = doors || {};
    switch (r.via) {
      case "quiet":
        if (!doors.voiceui || typeof doors.voiceui.quiet !== "function") return null;
        if (typeof doors.voiceui.isArmed === "function" && !doors.voiceui.isArmed()) return null;
        doors.voiceui.quiet(r.arg);
        return { via: "quiet", arg: r.arg };
      case "transport":
        if (!doors.transport) return null;
        if (r.arg === "toggle") { doors.transport.toggle(); return { via: "transport", arg: "toggle" }; }
        if (typeof doors.transport.stepSentence !== "function") return null;
        doors.transport.stepSentence(r.arg === "prev" ? -1 : 1);
        return { via: "transport", arg: r.arg };
      case "lookup":
        if (typeof doors.define !== "function") return null;
        doors.define();
        return { via: "lookup", arg: null };
      case "translate":
        if (typeof doors.translate !== "function") return null;
        doors.translate();
        return { via: "translate", arg: null };
      case "close":
        if (typeof doors.close !== "function") return null;
        doors.close();
        return { via: "close", arg: null };
      default:
        return null;
    }
  }

  /* -------------------------------------------------------------- the mount

     Everything above is pure and everything below is wiring. `mount` is a
     no-op that says so when there is no host: the reader page loads this file
     on every platform and only Frank Studio on the Mac has a panel to feed. */
  function mount(o) {
    o = o || {};
    var H = host();
    if (!H) return { ok: false, why: "no host", open: function () { return Promise.resolve(false); } };

    /* THE DOORS ARE ASKED FOR, NEVER HELD. The play bar is built before a
       book is open and `window.ReaderControl` is published after one is, so a
       mount that held a handle would hold null for ever -- follow.js's own
       reason, and its own shape. Anything here may be a function. */
    var pick = function (v) { return typeof v === "function" ? v() : v; };
    var controlIn = o.control || function () { return window.ReaderControl; };
    var sysIn = o.sysvoice || null;           /* the system voice's engine */
    var slug = o.slug || "";
    var doors = o.doors || {};
    var setT = o.setIntervalFn || setInterval;
    var clearT = o.clearIntervalFn || clearInterval;

    var open = false, timer = null, sentChapter = null, lastWord = null;

    function feed(payload) {
      return H.floatFeed(payload).then(function (ok) {
        /* THE READER STOPS ITS OWN CLOCK. Rust answers false when there is no
           panel, or when this webview is not the one feeding it -- two books
           open in two tabs, and the float follows the one whose button was
           pressed. Either way there is nothing to feed and nothing to pay. */
        if (ok === false) stop();
        return ok !== false;
      }, function () { stop(); return false; });
    }

    function chapterNow() {
      var control = pick(controlIn);
      if (!control) return null;
      var built = chapterPayload({
        timings: control.timings, map: control.map, slug: slug, label: "float",
      });
      return built.payload.words.length ? built : null;
    }

    function pushChapter(force) {
      var built = chapterNow();
      if (!built) return false;
      if (!force && built.payload.chapter === sentChapter) return false;
      sentChapter = built.payload.chapter;
      feed(built.payload);
      return true;
    }

    function tick() {
      if (!open) return;
      pushChapter(false);
      /* THE SYSTEM VOICE'S PATH IS THE CHEAPER ONE and is taken first: it
         already knows the word, so there is nothing to interpolate and nothing
         to correct. Only a rendered master needs a clock. */
      var sys = pick(sysIn);
      if (sys && typeof sys.state === "function") {
        var s = sys.state();
        if (s && s.speaking) {
          if (s.word !== lastWord) { lastWord = s.word; feed(tickPayload({ word: s.word, playing: true })); }
          return;
        }
      }
      var control = pick(controlIn);
      if (!control || !control.clock) return;
      feed(tickPayload({ t: control.clock.currentTime, playing: !control.clock.paused }));
    }

    function start() {
      if (timer) return;
      timer = setT(tick, TICK_MS);
    }
    function stop() {
      open = false;
      if (timer) { clearT(timer); timer = null; }
      sentChapter = null; lastWord = null;
    }

    /* THE PANEL ANSWERS ON ITS OWN EVENT, and it is routed to this webview
       alone in Rust -- never a global emit, because Tauri v2's `listen`
       registers with target Any and every strip would hear it
       (`desktop-two-windows`). The label guard here is the belt under that
       brace: either one rots alone. */
    /* the same rule for the strip's four: `VoiceUI.instance` does not exist
       until the first book has opened and the pill has booted. */
    function resolveDoors(d) {
      d = d || {};
      return {
        voiceui: pick(d.voiceui), transport: pick(d.transport),
        define: d.define, translate: d.translate, close: d.close, said: d.said,
      };
    }

    var stopListen = null;
    function listen() {
      if (typeof H.floatListen !== "function") return;
      H.floatListen(CMD_EVENT, function (d) {
        if (!d || d.from !== "float") return;
        var did = route(d.cmd, resolveDoors(doors));
        /* A QUIET ANSWER IS WRITTEN, NOT SPOKEN (QUIET.md), and on the float
           it is written in the PANEL's caption line -- the same `.wordsub`
           rect it lands in on this page. One element, every surface. */
        if (did && did.via === "quiet" && typeof doors.said === "function") {
          setTimeout(function () { feed(sayPayload(doors.said(), "float")); }, 0);
        }
      }).then(function (un) { stopListen = un; }, function () { stopListen = null; });
    }
    listen();

    return {
      ok: true,
      /* THE BUTTON. Resolves to what the panel IS after the press, which is
         what a latching button has to paint. */
      toggle: function () {
        return H.float().then(function (isOpen) {
          open = !!isOpen;
          if (open) { sentChapter = null; lastWord = null; pushChapter(true); tick(); start(); }
          else stop();
          return open;
        });
      },
      isOpen: function () { return open; },
      /* the three things that change the answer without changing the clock:
         a play, a pause and a seek. The bar calls this; nothing polls. */
      sync: tick,
      stop: stop,
      destroy: function () { stop(); if (stopListen) { try { stopListen(); } catch (e) {} } },
    };
  }

  return {
    mount: mount,
    chapterPayload: chapterPayload,
    tickPayload: tickPayload,
    sayPayload: sayPayload,
    route: route,
    ROUTES: ROUTES,
    FEED_EVENT: FEED_EVENT,
    CMD_EVENT: CMD_EVENT,
    TICK_MS: TICK_MS,
  };
});
