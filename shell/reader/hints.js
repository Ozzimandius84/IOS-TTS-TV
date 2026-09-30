/* design/reader/hints.js -- FIRST-TIME HINTS: a few small cards that show a new person how to move about, once, after
   they have signed in (or chosen "this device only") for the first time.

   Osca, 29 Sep: "MAYBE we will need like a tooltip for navigation. Like just in case, most apps have that rlly,
   something like that AFTER you sign in for the first time you know?" -- after two Strangers could not find the
   phone's way out of a book (a drag up on the title, which nothing on screen says).

   THE RULES (the whole of the design):
   · WHEN: only once first run is answered (`ttstv.sync.account` is written -- settings.js's own record), never over
     the first-run gate, never on a bench unless asked (`?hints` in the address shows them again, for Osca and the
     Strangers). Each page's set shows once; a set that was finished or skipped is remembered per device
     (`frank.hints.<set>`).
   · WHAT: at most three cards a set, each one sentence a person can act on, pointing at the thing it is about. A
     card whose thing is not on screen points from the edge the thing lives at (the phone's foot) instead.
   · HOW IT LOOKS: Frank's, not a system tooltip -- one small glass card in the head's glass, the sentence in the
     book serif, "1 of 3" and the two buttons in the shelf's tracked capitals, a soft ring on the thing it means.
     No dark scrim, no blocking: the page underneath still works, and a press anywhere else simply leaves the card.
   · ONE API: FrankHints.show(set, steps) -- steps = [{ at: selector | "foot" | "top", text, host? }], `host` ∈
     phone/web/app limits a step to one host. FrankHints.reset() clears every set (Settings will call it: "Show the
     hints again").
   Pages call it after they have drawn; the file draws nothing by itself. */
(function () {
  "use strict";
  var R = document.documentElement, KEY = "frank.hints.";
  var FORCE = /[?&]hints\b/.test(location.search) || /[?&]hints\b/.test((function () { try { return parent.location.search; } catch (e) { return ""; } })());
  function host() { return R.hasAttribute("data-phone") ? "phone" : R.hasAttribute("data-web") ? "web" : "app"; }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function signedIn() { var a = get("ttstv.sync.account"); try { return !!(a && JSON.parse(a)); } catch (e) { return false; } }
  function gateUp() { var g = document.querySelector(".fr-gate"); return !!(g && g.getBoundingClientRect().width); }

  var css = document.createElement("style");
  css.textContent = [
    ".fhint{ position:fixed; z-index:95; width:min(272px, calc(100vw - 24px)); box-sizing:border-box; padding:14px 16px 12px;",
    "  border-radius:16px; color:var(--fg, var(--ink, #111)); background:color-mix(in srgb, var(--bg, var(--ground, #fff)) 90%, transparent);",
    "  border:1px solid color-mix(in srgb, var(--fg, var(--ink, #111)) 12%, transparent);",
    "  -webkit-backdrop-filter:saturate(1.8) blur(20px); backdrop-filter:saturate(1.8) blur(20px); box-shadow:0 12px 36px rgba(0,0,0,.22); }",
    ".fhint p{ margin:0 0 12px; font:400 16px/1.4 var(--serif, 'Iowan Old Style', Palatino, Georgia, serif); }",
    ".fhint .fh-row{ display:flex; align-items:center; gap:8px; }",
    ".fhint .fh-n{ flex:1; font:600 10.5px/1 var(--ui-font, var(--chrome-ui-font, -apple-system, sans-serif)); letter-spacing:.13em; text-transform:uppercase; opacity:.62; }",
    ".fhint button{ -webkit-appearance:none; appearance:none; margin:0; cursor:pointer; height:30px; padding:0 12px; border-radius:15px;",
    "  font:600 10.5px/1 var(--ui-font, var(--chrome-ui-font, -apple-system, sans-serif)); letter-spacing:.13em; text-transform:uppercase; }",
    ".fhint .fh-skip{ border:0; background:transparent; color:inherit; opacity:.62; }",
    ".fhint .fh-next{ border:0; background:color-mix(in srgb, var(--fg, var(--ink, #111)) 90%, transparent); color:var(--bg, var(--ground, #fff)); }",
    ".fhint::after{ content:''; position:absolute; width:12px; height:12px; transform:rotate(45deg); background:inherit;",
    "  border:inherit; border-width:0; left:var(--fh-x, 50%); margin-left:-6px; }",
    ".fhint[data-side='below']::after{ top:-6px; border-top-width:1px; border-left-width:1px; border-style:solid; border-color:inherit; }",
    ".fhint[data-side='above']::after{ bottom:-6px; border-bottom-width:1px; border-right-width:1px; border-style:solid; border-color:inherit; }",
    ".fhint-ring{ position:fixed; z-index:94; pointer-events:none; border-radius:14px; box-shadow:0 0 0 2px var(--accent, var(--chrome-accent, #832f2b));",
    "  animation:fhring 1.6s ease-out infinite; }",
    "@keyframes fhring{ 0%{ box-shadow:0 0 0 2px var(--accent, var(--chrome-accent, #832f2b)); } 70%{ box-shadow:0 0 0 10px transparent; } 100%{ box-shadow:0 0 0 2px transparent; } }",
    "@media (prefers-reduced-motion: reduce){ .fhint-ring{ animation:none; } }"
  ].join("\n");

  var card = null, ring = null, live = null, tick = 0;
  function clear() { if (card) card.remove(); if (ring) ring.remove(); card = ring = null; }
  function stop() { clear(); live = null; clearTimeout(tick); }

  /* ================= A HINT IS ONLY FOR WHAT IS THERE (ASKS #187, 30 Sep) =================
     The web Stranger: "Press a cover..." shown AFTER a cover was pressed, its ring round an empty box (the tile was
     behind the book view); the shelf-pinch hint on the book view; a hint drawn over the search sheet. Three faults,
     one cause: a step was drawn on a timer, whatever was on screen. So a step now waits for its thing:
     · DONE ALREADY -- a press on the thing a step rings (since the page opened) is the person having done what
       it says: that step is passed over, and a step on screen moves on when its thing is pressed.
     · ON SCREEN -- the thing has a size, is inside the window, and is the element actually under its own centre
       (elementFromPoint), so a tile behind the book view or the search sheet is NOT on screen.
     · NOTHING OVER THE PAGE -- no sheet, dialog or card is up (the Surface, Tell Frank, the word card, a menu).
     A step that fails any of these is not drawn, and a drawn step whose thing goes (a sheet rises over it) is taken
     down; both come back when the page does. Nothing is written until a set is finished or skipped. */
  var pressed = [];
  document.addEventListener("pointerdown", function (e) { if (e.target && e.target.closest && !e.target.closest(".fhint")) { pressed.push(e.target); if (pressed.length > 40) pressed.shift(); } }, true);
  function sel(s) { return s.at !== "foot" && s.at !== "top" ? s.at : null; }
  function done(s) { var q = sel(s); if (!q || s.ring === false) return false;   /* a step about a REGION (no ring: the shelf to pinch) is not done by a press inside it */ for (var i = 0; i < pressed.length; i++) { try { if (pressed[i].isConnected !== false && pressed[i].closest(q)) return true; if (pressed[i].isConnected === false && pressed[i].matches && pressed[i].matches(q)) return true; } catch (e) {} } return false; }
  var OVER = ".sf, .tf, .tf-scrim, .lookupcard, .menu, [role='dialog'], [role='menu'], [aria-modal='true']";
  function shown(el) {
    if (!el || el.hidden || el.closest(".fhint")) return false;
    var r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false;
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) { var cs = getComputedStyle(n); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.1) return false; }
    return true;
  }
  function overUp() { var l = document.querySelectorAll(OVER); for (var i = 0; i < l.length; i++) if (shown(l[i])) return true; return false; }
  function onScreen(s) {
    if (overUp()) return false;
    var q = sel(s); if (!q) return true;
    var el = document.querySelector(q); if (!shown(el)) return false;
    var r = el.getBoundingClientRect();
    var x = (Math.max(0, r.left) + Math.min(innerWidth, r.right)) / 2, y = (Math.max(0, r.top) + Math.min(innerHeight, r.bottom)) / 2;
    var hit = document.elementFromPoint(x, y);
    return !!hit && (el === hit || el.contains(hit) || !!(hit.closest && hit.closest(".fhint")));
  }

  function place(step) {
    var W = innerWidth, H = innerHeight, r = null, el = null;
    if (step.at !== "foot" && step.at !== "top") { el = document.querySelector(step.at); r = el && el.getBoundingClientRect(); if (r && !r.width) r = null; }
    if (!r) r = step.at === "top" ? { left: W / 2 - 1, right: W / 2 + 1, top: 8, bottom: 56, width: 2, height: 48 }
                                   : { left: W / 2 - 1, right: W / 2 + 1, top: H - 64, bottom: H - 8, width: 2, height: 56 };
    else if (step.ring !== false) {
      r = { left: Math.max(4, r.left), right: Math.min(W - 4, r.right), top: r.top, bottom: r.bottom };   /* the ring stays on the screen */
      r.width = r.right - r.left; r.height = r.bottom - r.top;
      ring = document.createElement("div"); ring.className = "fhint-ring";
      ring.style.left = (r.left - 4) + "px"; ring.style.top = (r.top - 4) + "px"; ring.style.width = (r.width + 8) + "px"; ring.style.height = (r.height + 8) + "px";
      ring.style.borderRadius = getComputedStyle(el).borderRadius || "14px";
      document.body.appendChild(ring);
    }
    var cw = card.offsetWidth, ch = card.offsetHeight, below = r.bottom + 14 + ch < H - 8 && r.top < H / 2;
    var cx = Math.max(12, Math.min(W - cw - 12, (r.left + r.right) / 2 - cw / 2));
    card.style.left = cx + "px";
    card.style.top = (below ? r.bottom + 14 : Math.max(8, r.top - 14 - ch)) + "px";
    card.setAttribute("data-side", below ? "below" : "above");
    card.style.setProperty("--fh-x", Math.max(18, Math.min(cw - 18, (r.left + r.right) / 2 - cx)) + "px");
  }

  function draw(set, steps, i) {
    clear();
    var s = steps[i];
    card = document.createElement("div"); card.className = "fhint"; card.setAttribute("role", "status"); card.setAttribute("aria-live", "polite");
    card.innerHTML = '<p></p><div class="fh-row"><span class="fh-n"></span><button type="button" class="fh-skip">Skip</button><button type="button" class="fh-next"></button></div>';
    card.querySelector("p").textContent = s.text;
    card.querySelector(".fh-n").textContent = steps.length > 1 ? (i + 1) + " of " + steps.length : "";
    var last = i === steps.length - 1;
    card.querySelector(".fh-next").textContent = last ? "Got it" : "Next";
    card.querySelector(".fh-skip").hidden = last;
    card.querySelector(".fh-next").onclick = function (e) { e.stopPropagation(); run(set, steps, i + 1); };
    card.querySelector(".fh-skip").onclick = function (e) { e.stopPropagation(); stop(); put(KEY + set, "skipped"); };
    document.body.appendChild(card);
    place(s);
  }
  /* one watcher per page: every 400 ms it asks the three questions of the step in hand and draws or takes down */
  function run(set, steps, i) {
    clearTimeout(tick); clear();
    while (i < steps.length && done(steps[i])) i++;
    if (i >= steps.length) { put(KEY + set, "done"); live = null; return; }
    live = { set: set, steps: steps, i: i, drawnAt: null };
    watch();
  }
  function watch() {
    clearTimeout(tick);
    if (!live) return;
    var s = live.steps[live.i];
    if (done(s)) { run(live.set, live.steps, live.i + 1); return; }
    var ok = !gateUp() && onScreen(s);
    if (ok && !card) draw(live.set, live.steps, live.i);
    else if (!ok && card) clear();
    tick = setTimeout(watch, 400);
  }

  function show(set, steps) {
    if (!css.isConnected) document.head.appendChild(css);
    var h = host();
    steps = (steps || []).filter(function (s) { return !s.host || s.host === h || (s.host.indexOf && s.host.indexOf(h) >= 0); });
    if (!steps.length) return false;
    if (!FORCE && (get(KEY + set) || !signedIn())) return false;
    run(set, steps, 0);
    return true;
  }
  addEventListener("resize", function () { if (card && live) { clear(); watch(); } });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && card) stop(); }, true);
  window.FrankHints = { show: show, clear: stop,
    /* for a proof: the step in hand and whether it is drawn */
    state: function () { return live ? { set: live.set, step: live.i, of: live.steps.length, drawn: !!card, text: card ? card.querySelector("p").textContent : null } : null; },
    reset: function () { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(KEY) === 0) localStorage.removeItem(k); }); } catch (e) {} } };
})();
