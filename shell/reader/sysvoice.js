/* ENGINE · THE SYSTEM VOICE -- speechSynthesis reading the BOOK, not an answer
   · master: design/reader/sysvoice.js · copied byte-identical to reader/sysvoice.js
   · mounted by: reader/reader.html, one <script src>, after book-nav.js and
     before the transport is handed its engine
   · node test: design/reader/test-sysvoice.mjs

   TWO SYNTHESISERS, ONE ENGINE (D1(b), 13 Sep). Everything in this file is
   written against an INTERFACE -- `speak`, `cancel`, `getVoices`, `speaking`,
   `pending`, and an utterance carrying `onboundary`/`onend` -- and not
   against `window.speechSynthesis`. `createNativeSynth` at the foot presents
   the phone's own `AVSpeechSynthesizer` (`src-tauri/src/speech.rs`, Frank's
   iOS crate) in exactly that shape, and `pickSynth(window)` chooses: the
   native door where Frank injected one, the page's own everywhere else. The
   engine cannot tell which it has, and the boundary -> word-id proof below
   is therefore a proof about both. The ONE structural difference is
   `synth.queues` -- see its note in `create()`.

   WHY IT EXISTS. `plan-12-sep-cd.md` D1(a): *"I haven't even heard the apple
   voice on my mac yet."* `voiceui/tts.js` has had `window.speechSynthesis` in
   the building since the voice UI shipped and has only ever spoken ONE
   SENTENCE of template answer with it; `studio/engines.py` knows `moss` and
   `qwen3` and has no system engine at all. So the capability has never been
   pointed at a chapter. This points it at one.

   WHAT IT IS NOT. Not a render. Nothing is produced, cached, written or
   uploaded; there is no audio file and there is no `timings/` file. A neural
   voice is a render pipeline -- make a file, cache it, play it, carry the
   timings so the highlight can follow. This is a LIVE SYNTHESISER: it starts
   speaking, and it REPORTS ITS OWN WORD BOUNDARIES as it goes, which is
   exactly what the highlight wanted the timings for. That is the whole of
   D2's cheap good thing, and Q-D2 is whether it holds.

   THE HIGHLIGHT IS NOT A SECOND HIGHLIGHT. `onboundary` gives a character
   index into the utterance; this turns that into a FLAT WORD INDEX and hands
   it to `nav.goTo`, which is book-nav.js's ONE cursor -- the same door
   listen.js's paint uses, and the same door the pace uses (Osca, 4 Sep: *"the
   one word view AND the voice highlight/cursor is the same thing"*). Nothing
   here wraps a word in a span, adds an element or touches a class: the
   project memory `the_word_map_is_rebuilt_not_stored` is the rule and this
   obeys it by never drawing anything at all.

   ONE UTTERANCE PER SENTENCE, SO THE PAUSES ARE THE PARSE'S. Handed a whole
   chapter, every engine runs the sentences together at its own cadence and a
   paragraph break disappears. Handed one sentence at a time, the silence
   between two utterances is the gap the TEXT has -- and a paragraph boundary
   is a hard boundary here, so a sentence never runs across one. It also means
   `cancel()` costs at most the sentence in hand, which is what makes the next
   rule affordable.

   ★ POSITION IS SACRED (`plan-12-sep.md` A2c.32, D7's rule). Change the rate,
   change the voice, pause, come back -- THE WORD IS STILL THE WORD. There is
   no `utterance.rate = x` on a speaking utterance that any engine honours, so
   a rate change is: read the word we are standing on, `cancel()`, and speak
   AGAIN FROM THAT WORD -- `sliceUtterance` builds the utterance from the
   middle of a sentence exactly as it builds it from the start, so resuming
   mid-sentence is the ordinary path and not a special case. Pause is the same
   move without the restart. `synth.pause()`/`resume()` are deliberately NOT
   used: they are the pair that silently fails on iOS and in a backgrounded
   tab, and a resume that lands somewhere else is F1 arriving through the
   front door.

   THE GUARD SHAPE IS `voiceui/tts.js`'S, and it is reused rather than
   imported (that module speaks one string and resolves; this one runs a
   chapter). Its finding stands and is the reason for the watchdog below:
   **speechSynthesis is allowed never to call `onend`, and does** -- a headless
   Chrome has the whole API and no voices, and iOS Safari drops `onend` when
   the page goes to the background, which for a phone in a pocket is the
   normal case. So nothing here ever awaits `onend` alone: a tick asks the
   synth whether it is still speaking, and a synth that says no without having
   said `onend` ends the utterance anyway. The chapter goes on rather than
   wedging on a sentence that finished in silence.

   RATE. `wpm` is the Settings row the pace already reads (`prefs/prefs.js`,
   default 300) and it maps straight onto `utterance.rate`, which is a
   MULTIPLE of the voice's own normal speed. BASE_WPM below is the words a
   minute a system voice speaks at rate 1 -- 180 is the stated reference, NOT
   a measurement of these voices, so `stats().wpm` reports the rate actually
   achieved (words boundaried / seconds elapsed) and the reference can be
   corrected by a number rather than by taste.

   VOICE. Chosen by the BOOK's language (`book.lang`, the same field lookup.js
   reads), then by quality. The enhanced and premium voices are downloads most
   people never turn on and are dramatically better than the stock ones
   (macOS: System Settings > Accessibility > Spoken Content > Manage Voices) --
   so `pickVoice` ranks Premium over Enhanced over stock, and `voice().quality`
   says which one was found, because judging the system voice on the default
   voice is judging the wrong thing (Q-D1).

   UMD, like every other file the page loads by <script src>: no ES modules,
   no bundler, `reader.html` stays file://-capable. `module.exports` under
   Node for the test. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SysVoice = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Words a minute at rate 1. A REFERENCE, not a measurement -- see the
     header. `stats().wpm` is the measurement. */
  var BASE_WPM = 180;
  var RATE_MIN = 0.1, RATE_MAX = 10;     /* the Web Speech spec's own range */
  var TICK_MS = 250;                     /* the watchdog's beat */
  var DEAD_TICKS = 2;                    /* ticks of "not speaking" before we call it */

  /* ------------------------------------------------------- the sentence cut

     A sentence ends at a word carrying terminal punctuation, and a paragraph
     ALWAYS ends one. Closing quotes and brackets are stripped before the test
     so `end."` and `end.)` close as `end.` does.

     THE ABBREVIATIONS ARE A LIST AND THE LIST IS SHORT, on purpose. A wrong
     cut costs a pause in the wrong place and NOTHING ELSE -- the word ids are
     unaffected, because they are counted off the flat list, not off the
     sentences. So this is tuned for the common English and Latin ones in the
     shelf's front matter and left alone; it is not a sentence splitter for
     the parser to use, and nothing else reads it. */
  var CLOSERS = /[)\]}"'»”’›]+$/;
  var TERMINAL = /[.!?…]$/;
  var ABBREV = /^(?:Mr|Mrs|Ms|Dr|St|Sts|Prof|Rev|Hon|Sr|Jr|Capt|Gen|Lt|Col|Messrs|vs|etc|cf|ca|viz|No|Nos|Fig|Figs|Ch|Vol|Vols|Ed|Eds|Op|Bk|pp|p|al|Ibid|ibid|e\.g|i\.e|A\.D|B\.C|A\.M|P\.M)\.$/;
  /* an initial ("J.") or a numbered item ("1.") is not the end of anything */
  var INITIAL = /^[A-ZΑ-Ω]\.$/;
  var NUMBERED = /^[0-9]+\.$/;

  function closes(word) {
    var w = String(word || "").replace(CLOSERS, "");
    if (!TERMINAL.test(w)) return false;
    if (ABBREV.test(w) || INITIAL.test(w) || NUMBERED.test(w)) return false;
    return true;
  }

  /* Character offsets of each word in `words.join(" ")`. The join is a single
     space and nothing else, so this is arithmetic and not a search -- and it
     has to be arithmetic, because `onboundary` hands back an index into
     exactly that string. */
  function offsetsOf(words) {
    var starts = [], pos = 0;
    for (var i = 0; i < words.length; i++) {
      starts.push(pos);
      pos += String(words[i]).length + 1;       /* the joining space */
    }
    return starts;
  }

  /* `paras` is the chapter as the PAGE has it: one array of word strings per
     `p.line`, in document order -- the same order and the same split
     `book-nav.js::buildWordDomIndex` uses, so `from + k` is the index
     `nav.goTo` wants and no second numbering exists.

     Returns [{from, words, text, starts}], `from` being the flat index of the
     sentence's first word. */
  function sentencesOf(paras) {
    var out = [], flat = 0;
    (paras || []).forEach(function (para) {
      var buf = [], from = flat;
      (para || []).forEach(function (w) {
        if (!buf.length) from = flat;
        buf.push(w);
        flat++;
        if (closes(w)) { out.push(seal(from, buf)); buf = []; }
      });
      if (buf.length) out.push(seal(from, buf));   /* a paragraph always closes */
    });
    return out;
  }
  function seal(from, buf) {
    var words = buf.slice();
    return { from: from, words: words, text: words.join(" "), starts: offsetsOf(words) };
  }

  /* THE UTTERANCE, WHICH MAY START IN THE MIDDLE. Speaking a sentence from
     word `k` is the same build as speaking it from word 0 -- that is what
     makes a rate change, a voice change and a resume all one mechanism. */
  function sliceUtterance(sent, k) {
    var i = Math.max(0, Math.min(sent.words.length - 1, k | 0));
    var words = sent.words.slice(i);
    return { at: i, words: words, text: words.join(" "), starts: offsetsOf(words) };
  }

  /* charIndex -> which word of this utterance. The LAST word starting at or
     before the index: an engine that reports the index of the word it is
     about to say lands exactly, and one that reports somewhere inside the
     word lands on the same word rather than the next. */
  function wordAtChar(starts, charIndex) {
    var c = +charIndex;
    if (!isFinite(c) || c < 0) c = 0;
    var lo = 0, hi = starts.length - 1, k = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (starts[mid] <= c) { k = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return k;
  }

  /* --------------------------------------------------------- the rate & the voice */

  function rateFor(wpm, base) {
    var b = +base > 0 ? +base : BASE_WPM;
    var w = +wpm;
    if (!isFinite(w) || w <= 0) return 1;
    return Math.max(RATE_MIN, Math.min(RATE_MAX, w / b));
  }

  /* Premium > Enhanced > stock, within the book's language. The language test
     is the BCP-47 primary subtag, so a book tagged `el` takes `el-GR` and a
     book tagged `en-GB` prefers `en-GB` over `en-US` but takes either.
     `quality` is reported rather than assumed: a report that says "default"
     is a report Osca should not judge the system voice from (Q-D1). */
  var QRANK = { premium: 3, enhanced: 2, "default": 1 };
  function qualityOf(v) {
    /* A FIELD BEFORE A SUBSTRING (D1(b), 13 Sep). On the Mac,
       `speechSynthesis.getVoices()` puts the quality in the NAME -- "Daniel
       (Enhanced)" -- which is the only place it is, and why this function
       ever read a string. AVFoundation does not: `name` is "Daniel" whatever
       was downloaded and the quality is an enum, so the native door
       (`speech.rs::Voice`) carries it as a word. Reading the field first is
       therefore not a fallback, it is the accurate half; the substring stays
       for the engine that has nothing else. */
    var q = v && v.quality;
    if (typeof q === "string" && QRANK[q.toLowerCase()]) return QRANK[q.toLowerCase()];
    var n = ((v && v.name) || "") + " " + ((v && v.voiceURI) || "");
    if (/premium/i.test(n)) return 3;
    if (/enhanced/i.test(n)) return 2;
    /* AND MICROSOFT'S WORDS, WHICH ARE NOT APPLE'S (G-WINDOWS, chat 66 ->
       chat 70). Everything above is Apple's vocabulary, so on Windows every
       voice scored 1 and the whole free tier reported `quality: "default"` --
       which is precisely the report Q-D1 says not to judge the system voice
       from. Windows names its own three tiers in the name too:
         `Microsoft Aria Online (Natural) - English (United States)`  neural
         `Microsoft David - English (United States)`                  OneCore
         `Microsoft David Desktop - English (United States)`          SAPI5
       so the map is the same three ranks, read off the same string. `natural`
       (or `online`, the same voices under Edge's other spelling) is the
       premium rung; a Microsoft voice that is not one of the legacy `Desktop`
       voices is the middle one; the `Desktop` voices stay stock. This changes
       the PICK as well as the report, and only where it should: with every
       voice scoring 1 the next key was `localService`, which ranked a local
       SAPI voice ABOVE an online Natural one. */
    if (/natural|online/i.test(n)) return 3;
    if (/\bmicrosoft\b/i.test(n)) return /desktop/i.test(n) ? 1 : 2;
    return 1;
  }
  var QNAME = { 3: "premium", 2: "enhanced", 1: "default" };
  function base(tag) { return String(tag || "").toLowerCase().split(/[-_]/)[0]; }

  function pickVoice(voices, lang) {
    var list = (voices || []).filter(function (v) { return v && v.lang; });
    if (!list.length) return null;
    var want = String(lang || "en").toLowerCase(), wb = base(want);
    var inLang = list.filter(function (v) { return base(v.lang) === wb; });
    if (!inLang.length) return null;
    var best = null, bestKey = null;
    inLang.forEach(function (v) {
      var key = [qualityOf(v),
                 String(v.lang).toLowerCase() === want ? 1 : 0,
                 v.localService ? 1 : 0,
                 v["default"] ? 1 : 0];
      if (!best || cmp(key, bestKey) > 0) { best = v; bestKey = key; }
    });
    return best;
  }
  function cmp(a, b) {
    for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] - b[i]; }
    return 0;
  }

  /* =========================================================== THE ENGINE ===

     Every door into the page is a function passed in, so this file mounts in
     Node with no DOM and no synth of its own -- which is the only way the
     boundary -> word-id mapping can be PROVED rather than looked at.

       synth          window.speechSynthesis, createNativeSynth(host), or
                      createFakeSynth(). `synth.queues === true` means it
                      holds a queue that outlives this page's own liveness.
       Utterance      SpeechSynthesisUtterance, or a plain-object stand-in
       chapterWords   (ch) -> [[word,...], ...] one array per p.line, or null
       chapterCount   () -> how many chapters the book has
       onWord         (ch, flat) -> the ONE cursor moves. `nav.goTo`.
       lang           () -> the book's language tag
       wpm            () -> the Settings row
       startAt        () -> {chapter, word} -- the ONE cursor, for a cold start
       onState        (state) -> told on every change worth repainting
  */
  function create(opts) {
    var o = opts || {};
    if (!o.synth || typeof o.synth.speak !== "function") {
      throw new Error("SysVoice.create() requires opts.synth -- window.speechSynthesis " +
                      "in the browser, or SysVoice.createFakeSynth() in tests.");
    }
    var synth = o.synth;
    var Utter = o.Utterance ||
      (typeof SpeechSynthesisUtterance !== "undefined" ? SpeechSynthesisUtterance : null);
    var setT = o.setTimeoutFn || (typeof setTimeout !== "undefined" ? setTimeout : null);
    var clearT = o.clearTimeoutFn || (typeof clearTimeout !== "undefined" ? clearTimeout : null);
    var now = o.now || (typeof Date !== "undefined" ? function () { return Date.now(); }
                                                    : function () { return 0; });
    var baseWpm = +o.baseWpm > 0 ? +o.baseWpm : BASE_WPM;

    var ch = -1, sents = [], si = -1, flat = 0;
    var live = null;          /* the utterance in flight: {u, at, starts, sent} */
    var on = false;           /* the engine has been asked to speak */
    var ticker = null, dead = 0;
    var t0 = 0, spokenWords = 0, spokenMs = 0;   /* the measurement */
    var lastVoice = null, generation = 0;

    function fn(name, dflt) {
      var f = o[name];
      if (typeof f !== "function") return dflt;
      try { return f(); } catch (e) { return dflt; }
    }
    function words(i) {
      if (typeof o.chapterWords !== "function") return null;
      try { return o.chapterWords(i) || null; } catch (e) { return null; }
    }
    function tellWord(c, f) {
      if (typeof o.onWord !== "function") return;
      try { o.onWord(c, f); } catch (e) { /* a cursor that throws is not ours to fix */ }
    }
    function tellState() {
      if (typeof o.onState !== "function") return;
      try { o.onState(state()); } catch (e) {}
    }

    /* ------------------------------------------------------------ the load */

    function load(chapter) {
      var paras = words(chapter);
      if (!paras || !paras.length) { ch = -1; sents = []; return false; }
      ch = chapter; sents = sentencesOf(paras); si = -1;
      return sents.length > 0;
    }
    /* which sentence holds a flat word index, and where in it */
    function seat(f) {
      for (var i = 0; i < sents.length; i++) {
        var s = sents[i];
        if (f < s.from + s.words.length) return { si: i, k: Math.max(0, f - s.from) };
      }
      return sents.length ? { si: sents.length - 1, k: sents[sents.length - 1].words.length - 1 }
                          : null;
    }

    /* ------------------------------------------------------ the voice list

       An empty list is not proof of silence: real browsers populate voices
       asynchronously and fire `voiceschanged` afterwards. So this is asked
       every time rather than cached, and `available()` never says no on the
       strength of a list that has not arrived. */
    function voices() {
      if (typeof synth.getVoices !== "function") return [];
      try { return synth.getVoices() || []; } catch (e) { return []; }
    }
    function voice() {
      var v = pickVoice(voices(), fn("lang", "en"));
      lastVoice = v;
      return v ? { name: v.name, lang: v.lang, quality: QNAME[qualityOf(v)] } : null;
    }

    /* --------------------------------------------------------- the speaking */

    function speakFrom(chapter, f) {
      if (chapter !== ch && !load(chapter)) return false;
      if (!sents.length) return false;
      var st = seat(Math.max(0, f | 0));
      if (!st) return false;
      si = st.si; flat = sents[si].from + st.k;
      on = true;
      /* SEAT THE CURSOR BEFORE THE FIRST SOUND. The first word's own
         `onboundary` is deduped against `flat` (a boundary that reports the
         word we are already on moves nothing), so without this the chapter's
         first word would be the one word the cursor never visited. */
      tellWord(ch, flat);
      utter(st.k);
      return true;
    }

    /* ★ DOES THIS SYNTH HOLD A QUEUE THAT OUTLIVES US? (D1(b), 13 Sep.)

       The web engine and the native one differ in exactly one structural way
       and this flag is it. `speechSynthesis` lives in the page, so a chapter
       read through it is a JavaScript loop -- speak a sentence, be told it
       ended, speak the next -- and iOS SUSPENDS a backgrounded WKWebView's
       JavaScript. The loop stops at whichever sentence the lock button
       interrupted, which is the exact moment "listen along while doing
       something else" begins. `AVSpeechSynthesizer` is the APP's, not the
       page's: utterances handed to it go on being spoken with nothing of ours
       running at all.

       So a synth that says `queues` is handed THE REST OF THE CHAPTER in one
       go and is left to it; the boundaries still come back one word at a time
       and the cursor still moves on them, but only while there is a page
       awake to move. Everything else on both paths is the same code. */
    function queues() { try { return !!synth.queues; } catch (e) { return false; } }

    /* ONE UTTERANCE, for sentence `j` starting at its word `k`. Split out of
       `utter` when the batch path landed: the handlers have to close over
       THEIR OWN sentence and cut, which is what makes a queue of them
       self-describing -- no utterance needs to ask which one it is. */
    function build(j, k, mine) {
      var sent = sents[j];
      if (!sent) return null;
      var cut = sliceUtterance(sent, k);
      var u = Utter ? new Utter(cut.text) : { text: cut.text };
      u.rate = rateFor(fn("wpm", 300), baseWpm);
      if (o.pitch !== undefined) u.pitch = o.pitch;
      if (o.volume !== undefined) u.volume = o.volume;
      var v = pickVoice(voices(), fn("lang", "en"));
      lastVoice = v;
      if (v) { u.voice = v; u.lang = v.lang; }
      else { var l = fn("lang", null); if (l) u.lang = l; }

      var mounted = { u: u, at: cut.at, starts: cut.starts, sent: sent, gen: mine, si: j };

      /* THE UTTERANCE THAT IS ACTUALLY SPEAKING, in a queue of them. `si` is
         what `state().span` and FOLLOW read, so it has to name the sentence in
         the mouth rather than the last one enqueued. A synth with no `onstart`
         loses nothing: the first boundary sets `si` too. */
      u.onstart = function () {
        if (mine !== generation) return;
        si = j; live = mounted; dead = 0;
        /* Deduped against `flat` exactly as a boundary is, and for the same
           reason: `speakFrom` seats the cursor BEFORE the first sound, so the
           first utterance's own start would otherwise re-announce a word the
           page is already showing. For every later utterance in a queue this
           IS the move to its first word. */
        var f0 = sent.from + cut.at;
        if (f0 !== flat) { flat = f0; tellWord(ch, flat); }
        tellState();
      };
      u.onboundary = function (e) {
        if (mine !== generation) return;                 /* a cancelled utterance still talking */
        var name = e && e.name;
        if (name && name !== "word") return;             /* "sentence" is not a word */
        var k2 = wordAtChar(cut.starts, e && e.charIndex);
        var f2 = sent.from + cut.at + k2;
        si = j; live = mounted; dead = 0;
        if (f2 === flat) return;
        flat = f2; spokenWords++;
        tellWord(ch, flat);
        tellState();
      };
      /* IN A QUEUE, ONLY THE LAST END IS AN END. The others are handled by
         the next utterance's own start; advancing on each of them would run
         the chapter at the speed of the queue rather than of the voice. */
      u.onend = function () {
        if (mine !== generation) return;
        if (queues() && j + 1 < sents.length) return;
        ended();
      };
      u.onerror = function () { if (mine === generation) { on = false; stopTick(); tellState(); } };
      return mounted;
    }

    function utter(k) {
      if (!sents[si]) { finish(); return; }
      var mine = ++generation;
      var first = build(si, k, mine);
      if (!first) { finish(); return; }

      /* THE BATCH. From the word in hand to the end of the chapter, because a
         queue that stops early stops at the lock screen. On the web path this
         loop runs once and the behaviour is exactly what it was. */
      var made = [first];
      if (queues()) {
        for (var j = si + 1; j < sents.length; j++) {
          var nxt = build(j, 0, mine);
          if (nxt) made.push(nxt);
        }
      }

      live = first;
      if (!t0) t0 = now();
      dead = 0;
      for (var i = 0; i < made.length; i++) {
        try { synth.speak(made[i].u); }
        catch (e) { on = false; live = null; stopTick(); tellState(); return; }
      }
      startTick();
      tellState();
    }

    /* A SENTENCE ENDED -- by `onend`, or by the watchdog saying the synth has
       gone quiet without one. Either way the next sentence is the next
       sentence; the chapter's last one falls through to `finish`. */
    function ended() {
      live = null;
      if (!on) { stopTick(); return; }
      /* A QUEUE HAS NO NEXT SENTENCE TO SPEAK -- it is already holding them.
         Reaching here on that path means the last utterance ended, or the
         watchdog found the synth silent with the queue still nominally in it;
         either way the chapter is over and the next one is `finish`'s job. */
      if (queues()) { finish(); return; }
      if (si + 1 < sents.length) { si++; flat = sents[si].from; tellWord(ch, flat); utter(0); return; }
      finish();
    }
    /* THE CHAPTER RAN OUT. The next one is opened and spoken from its first
       word when the book has one, which is the same thing the transport does
       when a rendered chapter ends (`transport.js`, THE CHAPTER TURN) -- and
       here it costs no HEAD request, because there is no master to look for:
       the text is the whole of what this engine needs. */
    function finish() {
      var n = fn("chapterCount", 0);
      if (ch + 1 < n && load(ch + 1)) { si = 0; flat = sents[0].from; tellWord(ch, flat); utter(0); return; }
      on = false; stopTick(); if (t0) { spokenMs += now() - t0; t0 = 0; }
      tellState();
    }

    /* ------------------------------------------------------- the watchdog

       `voiceui/tts.js`'s finding, run as a loop instead of a deadline: the
       synth is ASKED whether it is still speaking, and two consecutive nos
       with an utterance still in flight end that utterance. Two rather than
       one because `speaking` is false for a beat between `speak()` and the
       audio actually starting on more than one engine, and ending a sentence
       that had not begun would run the whole chapter in a blur. */
    function startTick() {
      if (ticker !== null || !setT) return;
      ticker = setT(tick, TICK_MS);
    }
    function stopTick() { if (ticker !== null && clearT) clearT(ticker); ticker = null; }
    function tick() {
      ticker = null;
      if (!on || !live) return;
      var busy = true;
      try { busy = !!(synth.speaking || synth.pending); } catch (e) { busy = true; }
      if (busy) { dead = 0; startTick(); return; }
      if (++dead < DEAD_TICKS) { startTick(); return; }
      dead = 0;
      ended();                                  /* it finished, in silence */
    }

    /* ------------------------------------------------------------ the doors */

    function cancel() {
      generation++;                             /* orphan the utterance in flight */
      live = null;
      stopTick();
      try { synth.cancel(); } catch (e) {}
      if (t0) { spokenMs += now() - t0; t0 = 0; }
    }

    /* WHERE A COLD START STARTS, and it is not "the top of the chapter".
       `startAt()` is the page's ONE cursor -- book-nav.js's `nav.cursor`, the
       same position `listen.js`'s highlight and the pace both move -- so
       pressing play speaks from the word you are looking at, and a book
       reopened at yesterday's word carries on from it. Nothing here has a
       position of its own to disagree with it. */
    function play() {
      if (on && live) return true;
      if (ch < 0 || !sents.length) {
        var s = fn("startAt", null);
        if (!s || !(s.chapter >= 0)) return false;
        return speakFrom(s.chapter, s.word | 0);
      }
      return speakFrom(ch, flat);
    }
    function pause() {
      if (!on) return false;
      on = false; cancel(); tellState(); return true;
    }
    function toggle() { return on ? (pause(), false) : (play(), true); }
    function stop() { on = false; cancel(); ch = -1; sents = []; si = -1; flat = 0; tellState(); }

    /* ★ THE RATE, MID-SPEECH. No engine honours a write to a speaking
       utterance's `rate`, so the word is read, the utterance is cancelled and
       the SAME word is spoken again at the new rate. `flat` is never
       recomputed here and never rounded to a sentence: it is the word the
       last boundary reported, which is the word being said. */
    function rebase() {
      if (!on || !live) { tellState(); return false; }
      var at = flat;
      cancel();
      on = true;
      var st = seat(at);
      if (!st) { on = false; tellState(); return false; }
      si = st.si; flat = sents[si].from + st.k;
      utter(st.k);
      return true;
    }

    function state() {
      return {
        speaking: !!(on && live), armed: on, chapter: ch, word: flat,
        sentence: si, sentences: sents.length,
        /* THE SENTENCE AS A FLAT SPAN, inclusive, for FOLLOW (13 Sep). The
           engine has always known it -- `sents[si]` is `{from, words}` and
           `from + words.length - 1` is its last word -- and `state()` said only
           which sentence it was. `follow.js` needs the two ends to measure the
           sentence on the page, and a caller that re-cut the chapter to find
           them would be a second sentence cut disagreeing with this one. Null
           when nothing is loaded. */
        span: (si >= 0 && sents[si])
              ? { from: sents[si].from, to: sents[si].from + sents[si].words.length - 1 }
              : null,
        rate: rateFor(fn("wpm", 300), baseWpm),
        voice: lastVoice ? lastVoice.name : null,
        quality: lastVoice ? QNAME[qualityOf(lastVoice)] : null,
      };
    }
    /* words a minute ACTUALLY achieved -- the correction to BASE_WPM, if one
       is ever wanted, is this number and not a taste */
    function stats() {
      var ms = spokenMs + (t0 ? now() - t0 : 0);
      var cap = false;
      try { cap = !!synth.capped; } catch (e) {}
      /* `wpm` IS THE CORRECTION TO EVERY REFERENCE IN THIS FILE, on both
         paths: `BASE_WPM` here, and `speech.rs::av_rate`'s straight line
         through Apple's one published point on the phone. Read it off a
         device and both stop being guesses. `capped` is the phone saying it
         will not go as fast as the Settings row asked (Apple's rate maxes out
         at twice normal); false on the web path, which has no such ceiling. */
      return { words: spokenWords, ms: ms, wpm: ms > 0 ? (spokenWords / (ms / 60000)) : 0,
               base: baseWpm, native: queues(), capped: cap };
    }

    /* Is there anything to speak with, and anything to speak? A voice list
       that has not arrived is NOT a no (see `voices`): the answer is about the
       API being present and the chapter having words. */
    function available(chapter) {
      if (typeof synth.speak !== "function") return false;
      var at = fn("startAt", null);
      var c = chapter === undefined ? (ch >= 0 ? ch : (at && at.chapter >= 0 ? at.chapter : -1))
                                    : chapter;
      if (!(c >= 0)) return false;
      if (c === ch && sents.length) return true;
      var paras = words(c);
      return !!(paras && paras.length && paras.some(function (p) { return p && p.length; }));
    }

    return {
      play: play, pause: pause, toggle: toggle, stop: stop,
      speakFrom: speakFrom, rebase: rebase,
      available: available, state: state, stats: stats, voice: voice, voices: voices,
      get speaking() { return !!(on && live); },
      get chapter() { return ch; },
      get word() { return flat; },
      /* for the test and a console only; nothing in the page reads these */
      get sentences() { return sents.slice(); },
      get generation() { return generation; },
      _tick: tick,
    };
  }

  /* ------------------------------------------------------- THE FAKE SYNTH

     `voiceui/tts.js::createFakeSynth`'s shape, plus the one thing it has no
     use for: WORD BOUNDARIES. Its fake speaks synchronously and calls `onend`;
     a chapter spoken that way would recurse a sentence deep per sentence and
     could never be interrupted mid-utterance, which is exactly the moment
     ★ A2c.32 is about. So this one QUEUES, and the test pumps it: `tick()`
     fires the next boundary, or ends the utterance and starts the next.

     It reports `charIndex` at the start of each word, which is the honest
     case; `wordAtChar` is written for engines that report inside a word too,
     and the test drives that separately. */
  function createFakeSynth(list) {
    return {
      spoken: [], boundaries: [], cancels: 0,
      speaking: false, pending: false,
      queue: [], cur: null,
      speak: function (u) {
        this.queue.push(u);
        if (!this.cur) this._begin();
        else this.pending = true;
      },
      _begin: function () {
        var u = this.queue.shift();
        if (!u) { this.cur = null; this.speaking = false; this.pending = false; return; }
        this.cur = { u: u, i: 0, starts: offsetsOf(String(u.text).split(" ")) };
        this.spoken.push(u.text);
        this.speaking = true;
        this.pending = this.queue.length > 0;
      },
      /* one beat: the next word's boundary, or the end of this utterance */
      tick: function () {
        if (!this.cur) return false;
        var c = this.cur;
        if (c.i < c.starts.length) {
          var idx = c.starts[c.i++];
          this.boundaries.push(idx);
          if (c.u.onboundary) c.u.onboundary({ name: "word", charIndex: idx });
          return true;
        }
        this.cur = null; this.speaking = false; this.pending = this.queue.length > 0;
        if (c.u.onend) c.u.onend();
        if (!this.cur && this.queue.length) this._begin();
        return true;
      },
      /* Run to the end. The cap is a guard against a hang, not a budget: one
         tick is one WORD, and the longest chapter on the shelf is 113,229 of
         them (les-miserables c015), so a cap in the hundred-thousands silently
         truncates a real book. */
      drain: function (limit) {
        var n = 0, cap = limit || 10000000;
        while ((this.cur || this.queue.length) && n++ < cap) this.tick();
        return n;
      },
      cancel: function () {
        this.cancels++;
        this.queue.length = 0; this.cur = null;
        this.speaking = false; this.pending = false;
      },
      getVoices: function () { return list || []; },
    };
  }

  /* A plain-object stand-in for SpeechSynthesisUtterance, for Node -- and for
     the native path, which needs no browser class either. */
  function FakeUtterance(text) { this.text = text; }

  /* ================== THE NATIVE SYNTH, IN THE WEB SYNTH'S SHAPE ===========

     D1(b), `plan-12-sep-cd.md`. THE POINT OF THIS FUNCTION IS THAT THERE IS NO
     SECOND ENGINE. Everything above -- the sentence cut, the boundary -> flat
     word id, the rebase that keeps the word when the rate changes, the
     watchdog, the chapter turn -- is written against an INTERFACE (`speak`,
     `cancel`, `getVoices`, `speaking`, `pending`, and an utterance carrying
     `onboundary`/`onend`), not against `window.speechSynthesis`. So the phone's
     `AVSpeechSynthesizer` is not a new engine to be kept in step with this
     one; it is an object of that shape, and `create()` cannot tell which it
     was handed. `design/reader/test-sysvoice.mjs` §2's 25,551 word ids are
     therefore a proof about both.

     ★ THE CHAR INDEX IS THE SAME NUMBER ON BOTH, and that is the load-bearing
     coincidence. `willSpeakRangeOfSpeechString:` hands back an NSRange into
     the utterance's string, NSString is UTF-16, and a JavaScript string is
     UTF-16 -- so `range.location` IS the `charIndex` a web `onboundary` would
     carry for the same word. `wordAtChar` maps both with no re-indexing.

     WHAT IT ADDS: `queues`, and it is true. See the flag's own note above --
     a queued utterance goes on speaking with this webview suspended, which is
     the whole of the lock screen and the whole of why the native door exists.

     ONE INVOKE PER BATCH, NOT PER SENTENCE. `create()` calls `speak(u)` once
     per sentence, in a synchronous loop -- a thousand of them for a long
     chapter. Each is a Tauri `invoke`, so they are coalesced here: a
     microtask collects whatever arrived in this turn and sends it as ONE
     `speech.speak({lines})`. The engine above is untouched and does not know.

     `host` is `window.TTSTVHost.speech` (`src/speech.rs::SPEECH_JS`). */
  function createNativeSynth(host, opts) {
    var o = opts || {};
    var tick = o.microtask ||
      (typeof Promise !== "undefined"
        ? function (f) { Promise.resolve().then(f); }
        : function (f) { setTimeout(f, 0); });
    var setT = o.setTimeoutFn || (typeof setTimeout !== "undefined" ? setTimeout : null);
    var nowFn = o.now || (typeof Date !== "undefined" ? function () { return Date.now(); }
                                                      : function () { return 0; });

    var uid = 0;                 /* NEVER RE-USED -- see below */
    var mounted = {};            /* uid -> the utterance object */
    var waiting = [];            /* this turn's speak() calls, not yet sent */
    var flushing = false;
    var outstanding = 0;         /* queued and not yet ended or cancelled */
    var voiceList = [];
    var lastAsk = 0;
    var offEvent = null;

    /*  WHY THE ID IS NEVER RE-USED. A cancelled utterance may still deliver a
        boundary or two before the phone lets go of it; an id that came round
        again would land that boundary on a live sentence. `FrankSpeech.m` and
        `speech.rs` both say the same thing from their side, and neither of
        them interprets the number -- this is the only place that can, because
        this is the place that minted it. */
    function nextUid() { uid = (uid + 1) | 0; return uid; }

    /* THE SYNTH IS ALLOWED TO GO QUIET WITHOUT TELLING US, and does -- the
       finding `voiceui/tts.js` made about `speechSynthesis` and the reason
       `create()` has a watchdog at all. It is true of a native queue too: an
       event can be missed while the app is suspended, and `outstanding` would
       then never reach 0 and the chapter would wedge with the phone silent.
       So while there is anything outstanding, the phone is ASKED -- at most
       once a second, and never when nothing is queued. Its answer only ever
       CLEARS: a phone that says it is silent is right, and a phone that says
       it is speaking tells us nothing we did not already believe. */
    function refresh() {
      if (outstanding <= 0 || typeof host.speaking !== "function") return;
      var t = nowFn();
      if (t - lastAsk < 1000) return;
      lastAsk = t;
      try {
        host.speaking().then(function (st) {
          if (st && !st.speaking && !st.paused && outstanding > 0 && !waiting.length) {
            outstanding = 0;
            mounted = {};
          }
        }, function () {});
      } catch (e) {}
    }

    function on(kind, id, location) {
      var u = mounted[id];
      if (!u) return;                      /* cancelled, or never ours */
      if (kind === 1) { try { u.onstart && u.onstart(); } catch (e) {} return; }
      if (kind === 2) {
        try { u.onboundary && u.onboundary({ name: "word", charIndex: location }); } catch (e) {}
        return;
      }
      if (kind === 3) {                    /* end */
        delete mounted[id];
        if (outstanding > 0) outstanding--;
        try { u.onend && u.onend(); } catch (e) {}
        return;
      }
      if (kind === 4) {                    /* CANCEL IS NOT AN END */
        delete mounted[id];
        if (outstanding > 0) outstanding--;
        return;
      }
      /* 5 pause, 6 continue: the engine's pause is cancel-and-remember, so
         these can only come from a caller outside it. Nothing to do here. */
    }
    if (typeof host.onEvent === "function") offEvent = host.onEvent(on);

    function flush() {
      flushing = false;
      var batch = waiting;
      waiting = [];
      if (!batch.length) return;
      var head = batch[0];
      var lines = [];
      for (var i = 0; i < batch.length; i++) {
        lines.push({ id: batch[i].__uid, text: String(batch[i].text == null ? "" : batch[i].text) });
      }
      var say = {
        lines: lines,
        lang: (head.voice && head.voice.lang) || head.lang || null,
        voice: (head.voice && head.voice.voiceURI) || null,
        rate: +head.rate > 0 ? +head.rate : 1,
        pitch: +head.pitch > 0 ? +head.pitch : 1,
        volume: head.volume === undefined ? 1 : +head.volume,
        ssml: false,
      };
      try {
        host.speak(say).then(function (r) {
          /* `capped` is the phone saying it will speak SLOWER than the
             Settings row asked (Apple's rate maxes out at twice normal). It is
             reported and not hidden -- `stats().capped` -- because a reader
             that silently disobeys a number a person typed is the worse bug. */
          if (r && r.capped) lastCapped = true;
        }, function (e) {
          for (var j = 0; j < batch.length; j++) {
            var u = batch[j];
            delete mounted[u.__uid];
            if (outstanding > 0) outstanding--;
            try { u.onerror && u.onerror({ error: e }); } catch (x) {}
          }
        });
      } catch (e) {
        for (var k = 0; k < batch.length; k++) {
          try { batch[k].onerror && batch[k].onerror({ error: e }); } catch (x) {}
        }
      }
    }
    var lastCapped = false;

    /* The voice list arrives asynchronously and `create()` is written for
       that: "an empty list is not proof of silence". Asked once at mount and
       again only when a caller asks for it and it is still empty -- a voice is
       downloaded in Settings, which is a trip out of the app and back. */
    function ask() {
      if (typeof host.voices !== "function") return;
      try {
        host.voices().then(function (list) {
          if (list && list.length) voiceList = list;
        }, function () {});
      } catch (e) {}
    }
    ask();
    if (setT) setT(function () { if (!voiceList.length) ask(); }, 1500);

    return {
      /* the flag the engine reads, and the only structural difference */
      queues: true,
      native: true,
      speak: function (u) {
        if (u.__uid === undefined) u.__uid = nextUid();
        mounted[u.__uid] = u;
        outstanding++;
        waiting.push(u);
        if (!flushing) { flushing = true; tick(flush); }
      },
      cancel: function () {
        waiting = [];
        mounted = {};
        outstanding = 0;
        try { host.stop(); } catch (e) {}
      },
      getVoices: function () { if (!voiceList.length) ask(); return voiceList; },
      get speaking() { refresh(); return outstanding > 0; },
      get pending() { return waiting.length > 0; },
      /* read-only, for the report and a console */
      get capped() { return lastCapped; },
      get outstanding() { return outstanding; },
      dispose: function () { if (offEvent) { try { offEvent(); } catch (e) {} offEvent = null; } },
    };
  }

  /* ============================ WHICH SYNTH THIS PAGE HAS ==================

     ONE ENGINE, TWO SYNTHESISERS, AND THE PAGE ASKS ONCE. The native door is
     `window.TTSTVHost.speech`, injected by Frank on the phone and by nothing
     else -- so a browser, the PWA and the Mac's own desktop app all fall
     through to `window.speechSynthesis`, which on a Mac speaks with the same
     system voices and has no lock screen to survive. That is not a fallback
     with a worse story; it is the right engine there.

     Returns `{kind, synth, Utterance}` for `SysVoice.create()`, or null when
     this page has no synthesiser at all -- which is a real case (a headless
     Chrome has the API and no voices; some embedded views have neither) and
     the caller's cue to change nothing. */
  function pickSynth(win) {
    var w = win || (typeof self !== "undefined" ? self : null);
    if (!w) return null;
    var host = null;
    try { host = w.TTSTVHost && w.TTSTVHost.speech; } catch (e) { host = null; }
    if (host && typeof host.speak === "function") {
      return { kind: "native", synth: createNativeSynth(host), Utterance: FakeUtterance };
    }
    var s = null;
    try { s = w.speechSynthesis; } catch (e) { s = null; }
    if (s && typeof s.speak === "function") {
      return { kind: "web", synth: s,
               Utterance: (typeof w.SpeechSynthesisUtterance !== "undefined")
                          ? w.SpeechSynthesisUtterance : null };
    }
    return null;
  }

  /* ====================== THE SYSTEM VOICE, AS AN ENGINE ===================

     `studio/engines.py` knows `qwen3`, `moss`, `orpheus` and Breeze, and it
     is a forwarder: the authority is `voice/port.py`, the RENDER port. This
     engine renders nothing -- there is no file, no cache and no `timings/` --
     so it does not belong on that list and putting it there would make every
     consumer of it wrong about what a render is. It is a LIVE engine, and this
     is its card, in the shape the reader already draws one from
     (`reader/surface.js`'s `{id, limits}` and the Model row's own fields).

     The report's §6 carries the Request that would give `voice/port.py` a
     `live` axis so the Library's Model row can show this beside the four; it
     is two modules on the Mac and this lane owns neither. */
  var ENGINE = {
    id: "system",
    title: "The system voice",
    live: true,                 /* speaks; never writes a file */
    renders: false,
    cost: 0,                    /* no account, no key, no GPU, no network */
    offline: true,
    where: "device",
  };

  return {
    create: create,
    createFakeSynth: createFakeSynth, FakeUtterance: FakeUtterance,
    createNativeSynth: createNativeSynth, pickSynth: pickSynth,
    ENGINE: ENGINE,
    sentencesOf: sentencesOf, sliceUtterance: sliceUtterance, wordAtChar: wordAtChar,
    offsetsOf: offsetsOf, closes: closes, pickVoice: pickVoice, rateFor: rateFor,
    qualityOf: qualityOf,
    BASE_WPM: BASE_WPM,
  };
});
