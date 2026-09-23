/* THE LANE STRIP -- one thin band per thing the machine is doing.
 *
 * Osca, 5 Sep: *"one colour strip per book being parsed / audio being given ...
 * different colours, different books/processes."* It lives with the bar because
 * the bar is on every surface: a parse you start from the search should still
 * be visible when you have gone off to read something, which the Library's own
 * `note()` banner never was.
 *
 * NO NEW BACKEND. `/state` already carries the lanes, and has since the day
 * five parses could run at once:
 *
 *   importing[]   {mode:"ingest",  name, slug, step, started, phase}
 *   reparsing[]   {mode:"reparse", slug, lang, step, started, phase}
 *   job           the OLDEST of everything, which is also where a render
 *                 lives: {mode:"queue", slug, chapter, ran, skipped, failed}
 *
 * `/state.job` carrying only the oldest is the whole reason a single banner
 * could not tell the truth -- see `library.html`'s own note above `laneJobs`.
 *
 * IT ASKS FOR ITSELF, AND ONLY WHERE THERE IS SOMETHING TO ASK. No studio
 * behind the page (the phone's bundle, a static host, a `file://` open) and it
 * never polls at all and never draws. Two seconds while anything runs, five
 * when nothing does -- a readout nobody is watching should not cost a request
 * a second.
 */
(function () {
  "use strict";

  var BUSY_MS = 2000, IDLE_MS = 5000;
  var strip = null, timer = null, drawn = "";
  /* HANDED ITS LANES RATHER THAN ASKING FOR THEM. The editor page shows made-up
     jobs so the strip can be looked at with nothing running; once it has been
     told what to draw, the poll must stop for good, or the next tick answers
     404 and wipes them a heartbeat later. */
  var manual = false;

  function api(path) {
    // W1 SHELL-WEB: the kind is the gate, not the protocol.
    if (TTSTVHost.isWeb) return null;
    return location.origin + path;
  }

  /* EIGHT HUES, AND WHICH ONE IS THE BOOK'S OWN. A hash of the identity rather
     than the position in the list, so a lane does not change colour when the
     one before it finishes -- the same book is the same colour for as long as
     it runs. They are spaced far enough apart to be told apart at three pixels
     and they sit on both grounds. */
  var HUES = ["#8c2f2f", "#2f6b8c", "#7a5c1e", "#3f7a4a", "#6b3f7a",
              "#2f7a76", "#a8532a", "#4a4a8c"];
  function hueIndex(key) {
    var h = 0, s = String(key || "");
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h) % HUES.length;
  }
  /* AND NO TWO ON SCREEN ARE EVER THE SAME. The hash alone collides -- eight
     hues and four lanes is a birthday problem, and the first pair it drew were
     two parses in one colour, which is the one thing the strip exists to tell
     apart. So the hash only PROPOSES: a colour already taken steps to the next
     free one. Preference is still by identity, so a lane keeps its colour while
     the ones beside it come and go; it only moves when it must. */
  function hues(list) {
    var taken = {}, out = [];
    list.forEach(function (j) {
      var i = hueIndex(j.slug || j.name || j.source || j.mode), n = 0;
      while (taken[i] && n < HUES.length) { i = (i + 1) % HUES.length; n++; }
      taken[i] = true;
      out.push(HUES[i]);
    });
    return out;
  }

  /* WHAT IS RUNNING, as one list. `job` is folded in only when it is not
     already one of the lanes -- the oldest lane IS `job`, and drawing it twice
     would make one parse look like two. Same rule `library.html::laneJobs`
     uses, and for the same reason. */
  function lanesOf(st) {
    if (!st) return [];
    var out = [];
    (st.importing || []).forEach(function (j) { out.push(j); });
    (st.reparsing || []).forEach(function (j) { out.push(j); });
    var j = st.job;
    if (j && j.phase === "running" && !out.some(function (o) {
      return o.mode === j.mode && o.slug === j.slug && o.started === j.started;
    })) out.push(j);
    return out.filter(function (o) { return o && o.phase !== "done"; });
  }

  /* A LANE'S OWN NAME, and never an id where there is a title. `ingest` has no
     slug until the parse lands, so it is named by the file it came from. */
  function label(j) {
    var who = j.title || j.slug || j.name || j.source || "something";
    if (j.mode === "ingest")  return 'Parsing "' + who + '"';
    if (j.mode === "reparse") return 'Re-parsing "' + who + '"';
    if (j.mode === "queue")   return 'Voicing "' + who + '"'
      + (j.current_chapter ? " — " + j.current_chapter : "");
    if (j.mode === "single" || j.mode === "sample") return 'Voicing "' + who + '"';
    return (j.step || j.mode || "working") + ' — "' + who + '"';
  }

  /* HOW FAR THROUGH, when the job can say. Most cannot: a parse knows its step,
     not its share of the whole, and `null` here is what draws the sweep. A
     render can say, because it counts chapters. */
  function fraction(j) {
    if (typeof j.fraction === "number") return Math.max(0, Math.min(1, j.fraction));
    if (j.mode === "queue") {
      var done = (j.ran || 0) + (j.skipped || 0) + (j.failed || 0);
      var all = j.total || j.chapters_n;
      if (all) return Math.max(0, Math.min(1, done / all));
    }
    return null;
  }

  function mount() {
    if (strip) return strip;
    strip = document.createElement("div");
    strip.id = "barLanes";
    (document.body || document.documentElement).appendChild(strip);
    return strip;
  }

  function paint(list) {
    mount();
    /* A REPAINT THAT CHANGES NOTHING RESTARTS EVERY SWEEP. The strip is redrawn
       on a timer, so it is compared before it is written -- otherwise the
       animation stutters back to its start twice a second and reads as a fault
       rather than as work. */
    var key = list.map(function (j) {
      return [j.mode, j.slug || j.name, j.started, Math.round((fraction(j) || 0) * 100)].join("|");
    }).join(";");
    if (key === drawn) return;
    drawn = key;

    strip.classList.toggle("on", list.length > 0);
    if (!list.length) { strip.textContent = ""; return; }
    strip.textContent = "";
    var colours = hues(list);
    list.forEach(function (j, n) {
      var el = document.createElement("div");
      el.className = "lane"
        + ((j.mode === "queue" || j.mode === "single" || j.mode === "sample") ? " render" : "")
        + (j.failed && !j.ran ? " failed" : "");
      el.style.setProperty("--lane", colours[n]);
      el.title = label(j);
      var fill = document.createElement("i");
      var f = fraction(j);
      if (f == null) el.classList.add("sweep");
      else fill.style.width = (f * 100) + "%";
      el.appendChild(fill);
      strip.appendChild(el);
    });
  }

  function tick() {
    if (manual) return;
    var url = api("/state");
    if (!url) return;                       // no studio behind this page: nothing to ask
    fetch(url, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (st) {
        var list = lanesOf(st);
        paint(list);
        schedule(list.length ? BUSY_MS : IDLE_MS);
      })
      .catch(function () { paint([]); schedule(IDLE_MS); });
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(tick, ms); }

  /* THE PAGE CAN SAY SO IMMEDIATELY. `library.html` knows a parse started the
     moment it asks for one -- a whole poll before `/state` does -- so it says
     so and the strip is there at once rather than a second and a half later. */
  function nudge() {
    window.TTSTVLanes.nudges++;
    clearTimeout(timer);
    timer = setTimeout(tick, 150);
  }

  window.TTSTVLanes = {
    /* how many times a page has said "something started" -- readable, because
       a strip that is never told is a strip that is always a poll behind, and
       that is worth being able to see rather than infer */
    nudges: 0,
    nudge: nudge,
    /* the editor's door: hand it lanes and it draws them, polling nothing */
    show: function (list) { manual = true; clearTimeout(timer); paint(list || []); },
    stop: function () { clearTimeout(timer); }
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () { schedule(0); });
  else schedule(0);
})();
