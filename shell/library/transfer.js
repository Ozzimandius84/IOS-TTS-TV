// library/transfer.js -- ONE CLIENT for the door, and the Mac and the phone
// both hold it.
//
// The door is `cloud/endpoint.py` deployed on Modal, or `cloud/tools/
// serve_local.py` on the LAN, or Frank Studio itself. THIS FILE MUST NOT BE
// ABLE TO TELL THEM APART (job 23c). `url` is read for its bytes and for
// nothing else: there is no `if (url.includes("modal"))` here and there must
// never be one, because the moment a client branches on the address it has
// two behaviours to keep in step and only one of them is ever tested.
//
// The four calls, and the status codes are MEASURED -- against
// `cloud/tools/serve_local.py`, whose own rule is that every decision about a
// request is `endpoint.py`'s own function imported and called, so a code
// proved there is the code the deployed door gives. The table is
// `IOS-TTS-TV/STATUS.md` §6 (job 23d); each line below names what it draws.
//
//   POST /parse      the epub/pdf BYTES as the body   -> 200 zip of books/<slug>/
//   POST /render     a packed job folder, zipped      -> 202 the job row
//   GET  /job/<id>                                    -> 200 the state
//   GET  /job/<id>?audio=1                            -> 200 zip of the wavs
//
// THREE RULES THE SOURCE DOES NOT SAY, and each is written where it bites:
//
//   1. `GET /` NEEDS NO BEARER, and every other route does. `endpoint.py`'s
//      `@web.get("/")` is the one handler that does not call `guard(request)`
//      -- checked, not assumed. So `reach()` below is free, and it PROVES
//      NOTHING ABOUT THE PASS: the first 401 from a real route is the only
//      answer about the pass there is. A client that treats a reachable door
//      as a paired one will tell the person they are connected and then fail
//      on the first book.
//
//   2. NEVER RETRY A 500 FROM /render. The job row is written BEFORE the
//      render is attempted, so a retry does not repeat a failure -- it makes
//      a SECOND JOB, and the person pays for two. Nothing in this file
//      retries anything, and `render()` says so at the call site as well as
//      here, because this is the one where a helpful future session will add
//      a loop.
//
//   3. THE PULL IS THE POLL. There is one route, `GET /job/<id>`, and
//      `?audio=1` is a parameter on it. Asking for the audio before the job
//      is `done` is a **409**, not an empty zip and not a 404 -- so 409 is
//      "not yet", it is not a failure, and `pull()` returns it as a state
//      rather than throwing. That is what lets a caller poll the one route it
//      already knows instead of a second one it does not.
//
// THE PAIRING IS ONE KEY. `localStorage["transfer.pairing"]`, written by two
// hands: the phone's deep link (`frank-pair://v1?...`) and Settings ->
// Transfer's Pair field. This file NEVER writes it -- it reads it, and it
// redraws when the `ttstv:pairing` event says it changed, which is what makes
// a row correct when a link arrives while the tab is already open.

const TTSTVTransfer = (function () {
  "use strict";

  const KEY = "transfer.pairing";
  const EVENT = "ttstv:pairing";

  /* The record, in the order the phone lane writes it:
       {v:1, url, pass, workspace, app, fp, made}
     `fp` is sha256(pass) hex sliced to 8 -- a fingerprint to SHOW, never a
     credential to send. Nothing here reads it except `describe()`. */
  function pairing() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return null; }  // private mode
    if (!raw) return null;
    let p = null;
    try { p = JSON.parse(raw); } catch (e) { return null; }              // half-written
    if (!p || typeof p !== "object") return null;
    if (typeof p.url !== "string" || !p.url) return null;
    if (typeof p.pass !== "string" || !p.pass) return null;
    return p;
  }

  function paired() { return !!pairing(); }

  /* What a row may show. The pass never leaves this file except in a header. */
  function describe() {
    const p = pairing();
    if (!p) return null;
    return { url: p.url, workspace: p.workspace || null, app: p.app || null,
             fp: p.fp || null, made: p.made || null };
  }

  /* THE ADDRESS, AND NOTHING READ FROM IT. One trailing-slash rule, applied
     once, so `https://x/` and `https://x` are the same door. */
  function at(path) {
    const p = pairing();
    if (!p) throw new Fault(0, "no pairing", "this device is not paired");
    return p.url.replace(/\/+$/, "") + path;
  }

  function auth() {
    const p = pairing();
    if (!p) throw new Fault(0, "no pairing", "this device is not paired");
    return { Authorization: "Bearer " + p.pass };
  }

  /* ONE ERROR SHAPE for every call, so a caller can draw a door's answer
     without knowing which call produced it. `why` is the DOOR'S OWN SENTENCE
     wherever the door sent one -- the parser's refusal is the most useful
     text in this whole seam and it must not be replaced with a code. */
  function Fault(status, route, why) {
    const e = new Error(why || ("HTTP " + status));
    e.name = "TransferFault";
    e.status = status;
    e.route = route;
    e.why = why || null;
    return e;
  }

  /* The door's 422 is `{ok:false, why}`; everything else may or may not carry
     JSON. Never `.json()` a response without checking -- a 404 through a
     proxy is html, and parsing it throws a SyntaxError that hides the code. */
  async function whyOf(res) {
    const type = res.headers.get("content-type") || "";
    if (type.indexOf("json") < 0) return null;
    try {
      const d = await res.json();
      if (d && typeof d.why === "string") return d.why;
      if (d && typeof d.detail === "string") return d.detail;
      return null;
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------- reachable
  /* RULE 1. No bearer, and it proves only that something is listening. The
     answer is the door's own `{app, routes}` -- worth showing, because an
     `app` that is not Frank's is a person who has pasted the wrong address,
     which is otherwise indistinguishable from a wrong pass. */
  async function reach() {
    const res = await fetch(at("/"), { method: "GET" });
    if (!res.ok) throw Fault(res.status, "GET /", await whyOf(res));
    const d = await res.json().catch(function () { return {}; });
    return { app: d.app || null, routes: d.routes || [], authProved: false };
  }

  // ---------------------------------------------------------------- parse
  /* The BYTES are the body -- not multipart, not a field. 200 answers with a
     zip of the `books/<slug>/` tree and puts the two facts worth having in
     headers, because the zip is a stream you may not want to open twice. */
  async function parse(bytes, opts) {
    opts = opts || {};
    const h = auth();
    h["Content-Type"] = "application/octet-stream";
    h["X-Filename"] = opts.filename || "upload.epub";
    if (opts.lang) h["X-Lang"] = opts.lang;
    if (opts.slug) h["X-Slug"] = opts.slug;
    if (opts.maxChapters != null) h["X-Max-Chapters"] = String(opts.maxChapters);

    const res = await fetch(at("/parse"), { method: "POST", headers: h, body: bytes });
    if (res.status === 200) {
      return { zip: await res.blob(),
               slug: res.headers.get("X-Slug") || opts.slug || null,
               seconds: Number(res.headers.get("X-Parse-Seconds")) || null };
    }
    // 400 empty body · 413 over the cap · 422 the parser's own sentence · 401
    throw Fault(res.status, "POST /parse", await whyOf(res));
  }

  // --------------------------------------------------------------- render
  /* RULE 2 LIVES HERE. This awaits once and throws once. If you are reading
     this because a render failed and you want to try again: the job row was
     already written, so a second POST is a second job with a second cost.
     Ask `job(id)` what happened to the first one. */
  async function render(zipBytes, opts) {
    opts = opts || {};
    const h = auth();
    h["Content-Type"] = "application/zip";
    if (opts.engine) h["X-Engine"] = opts.engine;
    if (opts.jobId) h["X-Job-Id"] = opts.jobId;
    if (opts.where) h["X-Where"] = opts.where;      // the door's default is `modal`

    const res = await fetch(at("/render"), { method: "POST", headers: h, body: zipBytes });
    if (res.status === 202) return await res.json();   // {job_id, engine, where, call_id, state, started}
    /* 501 on `X-Where: kaggle` IS NOT AN ERROR to swallow: it is the door
       saying this person should use Studio's own Kaggle door, and its
       sentence is the instruction. It is a Fault like the others so that one
       `catch` draws it, and callers that care can test `.status === 501`. */
    throw Fault(res.status, "POST /render", await whyOf(res));
  }

  // ------------------------------------------------------------------ job
  async function job(id) {
    const res = await fetch(at("/job/" + encodeURIComponent(id)), { method: "GET", headers: auth() });
    if (res.status === 200) return await res.json();   // {state, ..., audio:[names]}
    throw Fault(res.status, "GET /job/<id>", await whyOf(res));   // 404 no such job
  }

  // ----------------------------------------------------------------- pull
  /* RULE 3. The same route, one parameter -- and a 409 is the job saying "not
     yet", which is why this ANSWERS rather than throws on it. A caller polls
     this and reads `ready`; there is no second endpoint to learn and no
     window in which a finished job returns an empty zip. */
  async function pull(id) {
    const url = at("/job/" + encodeURIComponent(id)) + "?audio=1";
    const res = await fetch(url, { method: "GET", headers: auth() });
    if (res.status === 200) return { ready: true, zip: await res.blob() };
    if (res.status === 409) return { ready: false, zip: null, why: await whyOf(res) };
    throw Fault(res.status, "GET /job/<id>?audio=1", await whyOf(res));   // 404
  }

  // ------------------------------------------------------------ the event
  /* Two writers and one key, so a page that is already open has to be told.
     `ttstv:pairing` is the in-page word; `storage` is the same news from
     another tab, which never fires in the tab that wrote it. Both are wired,
     and the handler is given the CURRENT record rather than the event, so a
     caller never parses the key itself. */
  function onPairing(fn) {
    if (typeof fn !== "function") return function () {};
    const hit = function () { fn(describe()); };
    const store = function (e) { if (!e || !e.key || e.key === KEY) hit(); };
    addEventListener(EVENT, hit);
    addEventListener("storage", store);
    return function () {
      removeEventListener(EVENT, hit);
      removeEventListener("storage", store);
    };
  }

  return { KEY, EVENT, pairing, paired, describe, at, auth, Fault,
           reach, parse, render, job, pull, onPairing };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TTSTVTransfer;
if (typeof self !== "undefined") self.TTSTVTransfer = TTSTVTransfer;
