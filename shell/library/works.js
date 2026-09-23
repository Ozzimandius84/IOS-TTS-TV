// library/works.js -- THE WORKS WITH NO MAC (W2 PHONE-STUDIO, 23 Sep)
//
// The state a studio would have answered, built from this phone's own Kaggle
// courier rows, so `?studio=` has a source on a phone with no Mac and no
// Studio. THIS FILE IS INERT ON EVERY OTHER HOST: `available()` is
// `TTSTVHost.kind === "phone" && !TTSTVTransfer.paired()`, so a website, a
// Mac, and a phone that has paired all bypass it and reach Studio or the door
// exactly as before.
//
// It is the LOCAL DOOR for exactly four routes the works column presses:
//   /state       the state object, /state-shaped where surface.js reads it
//   /run         enqueue a parse (Kaggle key present) or refuse in words
//   /book?slug=  the shelf's row for that slug, from TTSTVHost.books
//   everything else -> { error: "<path> — this phone has no Studio; see Settings ▸ Kaggle" }
//
// It is NOT a `GET /state` server: it never answers /search, /book (without
// slug), /log, /stop, /hold, /queue-row, or anything that needs a machine.

const TTSTVWorks = (function () {
  "use strict";

  const KEY = "ttstv.works.jobs";
  const VERSION = 1;
  const EVENT = "ttstv:works";

  // ----------------------------------------------------------------- state

  /** Who is on this page. The predicate is W1's, and it is ONE line. */
  function available() {
    return typeof TTSTVHost !== "undefined" && TTSTVHost.kind === "phone" &&
           typeof TTSTVTransfer !== "undefined" && !TTSTVTransfer.paired();
  }

  /** Does works.js own this route on this page? Pure; no I/O. */
  function handles(path) {
    if (!available()) return false;
    if (path === "/state" || path === "/run") return true;
    if (typeof path === "string" && path.indexOf("/book?") === 0) return true;
    return false;
  }

  // ------------------------------------------------------------ persistence

  function _load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var d = JSON.parse(raw);
      if (!d || !Array.isArray(d.rows)) return [];
      return d.rows;
    } catch (e) { return []; }
  }

  function _save(rows) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: VERSION, rows: rows }));
    } catch (e) { /* private mode / quota */ }
  }

  var _rows = _load();
  var _n = 0;

  // ------------------------------------------------------------------- ids

  function _id() {
    _n += 1;
    return "k-" + Date.now().toString(36) + "-" + _n;
  }

  // ----------------------------------------------------------------- events

  var _subs = [];

  function _emit(detail) {
    try {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: detail }));
    } catch (e) { /* node / test harness */ }
    for (var i = 0; i < _subs.length; i++) {
      try { _subs[i](detail); } catch (e) { /* subscriber threw */ }
    }
  }

  function on(fn) {
    if (typeof fn !== "function") return function () {};
    _subs.push(fn);
    try { fn({ reason: "init" }); } catch (e) { /* */ }
    return function () {
      _subs = _subs.filter(function (f) { return f !== fn; });
    };
  }

  // ------------------------------------------------------------------ rows

  function rows() { return _rows.slice(); }

  function _running() {
    for (var i = 0; i < _rows.length; i++) {
      if (_rows[i].state === "queued" || _rows[i].state === "running") return _rows[i];
    }
    return null;
  }

  function _elapsed(row) {
    if (!row || !row._ts) return "0:00";
    var s = Math.floor((Date.now() - row._ts) / 1000);
    var m = Math.floor(s / 60);
    s = s - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function _finish(row, st, why) {
    row.state = st;
    row.started = _elapsed(row);
    row.ended = new Date().toISOString();
    row.why = why || null;
    _save(_rows);
    _emit({ reason: st === "done" ? "done" : "failed", id: row.id, state: st, why: why || null });
  }

  // ------------------------------------------------------------------ poll

  var _lastPoll = 0;
  var _polling = false;

  function poll() {
    var now = Date.now();
    if (_polling || now - _lastPoll < 3500) return Promise.resolve();
    _lastPoll = now;
    _polling = true;

    var todo = [];
    for (var i = 0; i < _rows.length; i++) {
      var r = _rows[i];
      if (r.state === "queued" || r.state === "running") todo.push(r);
    }

    var chain = Promise.resolve();
    for (var j = 0; j < todo.length; j++) {
      (function (row) {
        chain = chain.then(function () {
          return _pollOne(row);
        });
      })(todo[j]);
    }

    return chain.then(function () { _polling = false; },
                      function () { _polling = false; });
  }

  function _pollOne(row) {
    // Only Kaggle rows can be polled in W2 (no door render from no-Mac phone)
    if (!row.kaggle) return Promise.resolve();
    var kag = typeof TTSTVHost !== "undefined" && TTSTVHost.kaggle;
    if (!kag) return Promise.resolve();

    return kag.status(row.kaggle.kernel).then(function (word) {
      word = (word || "").toLowerCase();
      row.started = _elapsed(row);

      if (!row.kaggle.moved) {
        // Watch: has the word moved from `before`?
        if (word !== row.kaggle.before) {
          row.kaggle.moved = true;
        } else if (Date.now() - row.kaggle.pushed_at > 600000) {
          // TOOK_GRACE_MS (600 s)
          _finish(row, "failed", "Kaggle never started this job — open the kernel on kaggle.com");
          return;
        }
      }

      if (word === "complete") {
        row.state = "running";
        row.stage = "Downloading output…";
        _save(_rows);
        _emit({ reason: "stage", id: row.id, stage: row.stage, state: "running" });

        return kag.output(row.kaggle.kernel).then(function (out) {
          row.files = (out && out.files) || null;
          _finish(row, "done", null);
        }, function (e) {
          _finish(row, "failed", (e && e.why) || String(e));
        });
      } else if (word === "error") {
        _finish(row, "failed", "Kaggle kernel failed — read the log on kaggle.com");
        return;
      } else {
        row.state = "running";
        row.stage = word || "waiting…";
        _save(_rows);
        _emit({ reason: "progress", id: row.id });
      }
    }, function (e) {
      var why = (e && e.why) || String(e);
      if (e && e.kind === "no-key") {
        row.stage = "no Kaggle key on this phone — paste your kaggle.json in Settings ▸ Kaggle";
        row.state = "failed";
        _save(_rows);
        _emit({ reason: "failed", id: row.id, state: "failed", why: row.stage });
      }
      // other transient faults: leave the row in its current state, next poll will retry
    });
  }

  // --------------------------------------------------------------- clear

  function clear() {
    _rows = _rows.filter(function (r) { return r.state !== "done" && r.state !== "failed"; });
    _save(_rows);
    _emit({ reason: "clear" });
  }

  // ----------------------------------------------------------------- state

  function state() {
    var books = [];
    try {
      if (typeof TTSTVHost !== "undefined" && TTSTVHost.books && typeof TTSTVHost.books.list === "function") {
        books = TTSTVHost.books.list();
      }
    } catch (e) { /* */ }

    var job = _running();
    var importing = [];

    // running parses are importing rows
    for (var i = 0; i < _rows.length; i++) {
      var r = _rows[i];
      if (r.kind === "parse" && (r.state === "queued" || r.state === "running")) {
        importing.push({ name: r.title, step: r.stage || "queued", slug: r.slug || "" });
      }
    }

    return {
      generated:  new Date().toISOString().slice(0, 10),
      books:      books,
      job:        job ? {
        id: job.id, mode: job.kind, slug: job.slug,
        state: job.state, elapsed: job.started || "0:00",
        stage: job.stage || null, why: job.why || null
      } : null,
      pending:    [],
      ingests:    [],
      importing:  importing,
      reparsing:  [],
      reparses:   [],
      settings:   { render: { where: "kaggle" }, persisted: false, save_error: null },
      voice:      null,
      hold:       null,
      sources:    [],
      voices:     [],
      local:      true
    };
  }

  // --------------------------------------------------------------- get/post

  function get(path, ms) {
    if (path === "/state") {
      return poll().then(function () { return state(); });
    }
    if (typeof path === "string" && path.indexOf("/book?") === 0) {
      // extract slug from query string
      var m = path.match(/[?&]slug=([^&]*)/);
      var slug = m ? decodeURIComponent(m[1]) : null;
      if (!slug) return Promise.reject(new Error("/book? needs a slug query"));
      var books = [];
      try {
        if (typeof TTSTVHost !== "undefined" && TTSTVHost.books && typeof TTSTVHost.books.list === "function") {
          books = TTSTVHost.books.list();
        }
      } catch (e) { /* */ }
      for (var i = 0; i < books.length; i++) {
        if (books[i].slug === slug) {
          return Promise.resolve({ slug: slug, chapters: books[i].chapters || [] });
        }
      }
      return Promise.reject(new Error("no book " + slug + " on this phone"));
    }
    return Promise.reject(new Error(path + " — this phone has no Studio; see Settings ▸ Kaggle"));
  }

  function post(path, body) {
    if (path === "/run") {
      return _enqueueRun(body);
    }
    return Promise.reject(new Error(path + " — this phone has no Studio; see Settings ▸ Kaggle"));
  }

  // -------------------------------------------------------------- enqueue

  function _enqueueRun(body) {
    // In W2, only parse is supported on a no-Mac phone (N-4)
    var row = {
      id:      _id(),
      kind:    "parse",
      lane:    "import",
      slug:    (body && body.slug) || null,
      title:   (body && body.title) || "Untitled",
      where:   "kaggle",
      stage:   "queued",
      state:   "queued",
      started: "0:00",
      ended:   null,
      why:     null,
      files:   null,
      kaggle:  {
        dataset: "ttstv-studio-job",
        kernel:  "ttstv-studio",
        version: null,
        before:  null,
        moved:   false,
        pushed_at: 0
      },
      _ts:     Date.now()
    };

    _rows.push(row);
    _save(_rows);
    _emit({ reason: "added", id: row.id, state: "queued" });

    return Promise.resolve({ ok: true, id: row.id });
  }

  return {
    KEY: KEY, VERSION: VERSION, EVENT: EVENT,
    available: available, handles: handles,
    get: get, post: post,
    state: state, on: on, rows: rows,
    poll: poll, clear: clear
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TTSTVWorks;
if (typeof self !== "undefined") self.TTSTVWorks = TTSTVWorks;
