/**
 * phone_signin_again.mjs -- the dead grant: Settings ▸ Sync offers "Sign in
 * again" when Drive's refresh answers invalid_grant. B-phone, wave 8 (26 Sep).
 *
 *   node tests/phone_signin_again.mjs [--engine chromium|webkit]
 *
 * Osca's phone, 26 Sep 15:00: "Connected as …@gmail.com", and every Sync
 * refused with `invalid_grant -- Token has been expired or revoked` -- the
 * grant of 11 Sep died with the reinstall, and the row offered Sign out and
 * nothing else. The road built here: the refusal marks the stored grant
 * `revoked` (library/drive.js::googleRefresh), the row says so and its
 * account button becomes SIGN IN AGAIN (settings.js::paint via grantDead),
 * which runs the ONE existing sign-in flow (`signIn` -> googleSignInPhone),
 * whose success writes a fresh grant over the dead one and presses Sync.
 *
 * Headless, over the REAL `shell/settings/settings.html?phone` served off
 * disk, with every Google host routed to a fake in this file: the token
 * endpoint answers the refresh 400 invalid_grant, then the code exchange
 * 200; userinfo answers the email; Drive v3 answers an empty Frank folder.
 * The host is a stand-in `TTSTVHost` whose `googleSignIn(url)` writes the
 * redirect back the way the crate does (GOOGLE_REDIRECT_KEY) and whose
 * `sync.start(job)` records the job the page planned.
 *
 * Asserts, in order: (1) on opening, the page's own first Drive ask (the
 * Languages tab's catalogue) refreshes -> 400 invalid_grant -> the stored
 * token carries `revoked` and the row ALREADY reads "Sign in again"; (2)
 * press Sync -> refused at once with no round trip, the line names the
 * dead grant, the button reads "Sign in again"; (3) press it -> the
 * sign-in flow ran (auth URL opened once, PKCE S256), the exchange was asked
 * with the code, the stored grant is the NEW one with no `revoked`; (4) Sync
 * ran on its own after the sign-in: sync.start got a drive job whose
 * auth.access is the NEW access token, and the button is "Sign out" again;
 * (5) 0 page errors; the token endpoint was asked exactly twice (refresh,
 * exchange) -- the revoked token never went back over the wire. Exit 1 on
 * any miss.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const SHELL = join(REPO, "shell");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ENGINE = arg("--engine", "chromium");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json" };
function serve(root) {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
      try {
        const body = await readFile(join(root, rel));
        res.writeHead(200, { "Content-Type": MIME[extname(rel).toLowerCase()] || "application/octet-stream" });
        res.end(body);
      } catch { res.writeHead(404).end("no"); }
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

const CLIENT = "123-ios.apps.googleusercontent.com";
const REDIRECT = "com.googleusercontent.apps.123-ios:/oauth2redirect";
const DEAD = { access: "ya29.dead", refresh: "1//dead-11-sep", expires: 1, clientId: CLIENT };   // expired: a press must refresh
const FRESH = { access_token: "ya29.fresh", refresh_token: "1//fresh-26-sep", expires_in: 3599, token_type: "Bearer" };

const server = await serve(SHELL);
const base = `http://127.0.0.1:${server.address().port}`;
const pw = await import("playwright");
const exe = process.env[`PLAYWRIGHT_${ENGINE.toUpperCase()}_PATH`];
const browser = await pw[ENGINE].launch(exe ? { executablePath: exe } : {});
let bad = 0;
const fail = (s) => { console.log("  FAIL " + s); bad++; };
const ok = (s) => console.log("  ok   " + s);
const eq = (got, want, what) => (got === want ? ok(`${what} = ${JSON.stringify(want)}`)
  : fail(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const has = (got, needle, what) => (String(got).includes(needle) ? ok(`${what} says "${needle}"`)
  : fail(`${what}: ${JSON.stringify(got)} does not say ${JSON.stringify(needle)}`));

const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: ENGINE !== "firefox", hasTouch: true });
const p = await ctx.newPage();
const errors = []; p.on("pageerror", (e) => errors.push(e.message));

/* ---- the fake Google: token endpoint, userinfo, Drive v3 ---- */
const wire = { token: [], drive: [] };
// Playwright tries the LAST route first, so the catch-all goes in first: nothing else leaves
await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 404, body: "no" }));   // nothing else leaves
let grantDead = true;       // the first refresh is refused; after the exchange the fresh one works
await p.route("https://oauth2.googleapis.com/**", async (route) => {
  const req = route.request();
  const body = Object.fromEntries(new URLSearchParams(req.postData() || ""));
  wire.token.push(body);
  if (body.grant_type === "refresh_token") {
    if (body.refresh_token === DEAD.refresh) {
      return route.fulfill({ status: 400, contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "ya29.fresh2", expires_in: 3599 }) });
  }
  if (body.grant_type === "authorization_code") {
    if (body.code !== "CODE-26-SEP" || body.client_id !== CLIENT || !body.code_verifier) {
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "invalid_request" }) });
    }
    grantDead = false;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FRESH) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });   // revoke
});
await p.route("https://openidconnect.googleapis.com/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ email: "osca@example.com" }) }));
await p.route("https://www.googleapis.com/**", async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const auth = req.headers()["authorization"] || "";
  wire.drive.push({ m: req.method(), path: url.pathname, q: url.searchParams.get("q"), auth });
  if (auth !== "Bearer ya29.fresh") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "Invalid Credentials" } }) });
  if (req.method() === "GET" && url.pathname === "/drive/v3/files") {
    const q = url.searchParams.get("q") || "";
    if (/name\s*=\s*'Frank'/.test(q)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ files: [{ id: "frank-folder", name: "Frank" }] }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ files: [] }) });
  }
  if (req.method() === "GET") return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { message: "File not found" } }) });
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "new-" + wire.drive.length }) });
});

/* ---- the stand-in host, and the page's own store before it boots ---- */
await p.addInitScript(({ CLIENT, REDIRECT, DEAD }) => {
  window.__TTSTV_HOST_KIND__ = "phone";
  localStorage.setItem("ttstv.sync.google", JSON.stringify(DEAD));
  localStorage.setItem("ttstv.sync.account", JSON.stringify({ kind: "google", who: "osca@example.com", at: 1757600000000 }));
  localStorage.setItem("ttstv.sync.through", JSON.stringify("gdrive"));
  window.__opened = [];
  window.__jobs = [];
  let st = null;
  window.TTSTVHost = {
    kind: "phone", isStudio: false,
    google: { clientId: CLIENT, redirect: REDIRECT },
    googleSignIn(url) {
      window.__opened.push(url);
      const state = new URL(url).searchParams.get("state");
      setTimeout(() => localStorage.setItem("ttstv.sync.googleRedirect", REDIRECT + "?code=CODE-26-SEP&state=" + encodeURIComponent(state)), 40);
      return Promise.resolve(true);
    },
    sync: {
      start(job) { window.__jobs.push(job); st = { running: false, since: Date.now(), ended: Date.now(), transport: job.transport, trigger: job.trigger, n: job.books.length, pulled: 0, total: 0, done: 0 }; return Promise.resolve(st); },
      status() { return Promise.resolve(st); },
      stop() { return Promise.resolve(); },
    },
    books: { list() { return Promise.resolve([]); } },
  };
  // the form handle the page keeps in a const: caught as mount is defined
  let obj, m;
  Object.defineProperty(window, "TTSTVSettings", { configurable: true, get() { return obj; }, set(v) {
    obj = v;
    Object.defineProperty(v, "mount", { configurable: true, enumerable: true, get() { return m; },
      set(f) { m = function () { const h = f.apply(this, arguments); window.__form = h; return h; }; } });
  } });
}, { CLIENT, REDIRECT, DEAD });

await p.goto(`${base}/settings/settings.html?phone`, { waitUntil: "load" });
await p.evaluate(() => window.__form.showTab("transfer"));
await p.waitForTimeout(100);

const row = () => p.evaluate(() => {
  const f = window.__form;
  const el = f.el.querySelector('.set-panel[data-tab="transfer"]');
  const btn = [...el.querySelectorAll("button")].find(b => /^(Sign out|Sign in again|Sign in with Google)$/.test(b.textContent.trim()));
  const who = el.querySelector(".kag-who");
  const r = btn ? btn.getBoundingClientRect() : null;
  return {
    button: btn ? btn.textContent.trim() : null, state: btn ? btn.dataset.state : null,
    primary: btn ? btn.classList.contains("kag-primary") : null, danger: btn ? btn.classList.contains("danger") : null,
    rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
    who: who ? who.textContent.trim() : null, whoWhy: who && who.nextElementSibling ? who.nextElementSibling.textContent.trim() : null,
    line: (el.querySelector(".tr-line") || el.querySelector(".tr-state") || {}).textContent || null,
    text: el.innerText.replace(/\s+/g, " ").trim(),
    token: JSON.parse(localStorage.getItem("ttstv.sync.google")),
    pull: f.panels.transfer && f.panels.transfer.pull,
  };
});
const press = (label) => p.evaluate((label) => {
  const el = window.__form.el.querySelector('.set-panel[data-tab="transfer"]');
  const btn = [...el.querySelectorAll("button")].find(b => b.textContent.trim() === label);
  if (!btn) throw new Error("no button " + label);
  btn.click();
}, label);

console.log("\n1. on opening: the page's own first ask (the Languages tab's catalogue) refreshes -> 400 invalid_grant -> the row already says so");
{
  const r = await row();
  eq(wire.token.length, 1, "token endpoint asked at open");
  eq(wire.token[0].grant_type, "refresh_token", "the ask");
  eq(wire.token[0].refresh_token, DEAD.refresh, "with the dead grant");
  has(r.who, "Connected as osca@example.com", "who");
  eq(typeof r.token.revoked, "number", "stored token marked revoked by that ask");
  eq(r.button, "Sign in again", "account button, before any press here");
}

console.log("\n2. Sync -> refused at once (no round trip on a marked grant) -> the row says so and offers Sign in again");
{
  await p.evaluate(() => window.__form.panels.transfer.press());
  await p.waitForTimeout(150);
  const r = await row();
  eq(wire.token.length, 1, "token endpoint asked, total (the press sent nothing)");
  has(r.text, "Drive refused the saved sign-in for osca@example.com", "row line");
  has(r.text, "expired or was revoked. Sign in again to sync.", "row line");
  has(r.who, "Connected as osca@example.com", "who (the account is still the account)");
  has(r.whoWhy, "sign in again", "who's line");
  eq(r.button, "Sign in again", "account button");
  eq(r.state, "signin-again", "button data-state");
  eq(r.primary, true, "button is primary");
  eq(r.danger, false, "button is not the red Sign out");
  eq(typeof r.token.revoked, "number", "stored token marked revoked");
  eq(r.token.refresh, DEAD.refresh, "the dead grant is kept, not dropped");
  eq(wire.drive.length, 0, "Drive asked with a dead token");
  console.log("   button rect", r.rect);
}

console.log("\n3. Sign in again -> the existing flow -> a fresh grant replaces the dead one");
{
  await press("Sign in again");
  // the redirect is polled every 500 ms (GOOGLE_POLL_MS); the Sync after it is one round of fake Drive
  await p.waitForFunction(() => window.__jobs.length > 0, null, { timeout: 8000 }).catch(() => console.log("  (no sync.start within 8 s)"));
  await p.waitForTimeout(200);
  const r = await row();
  eq(p.url().startsWith(base), true, "page still the settings page");
  const opened = await p.evaluate(() => window.__opened);
  eq(opened.length, 1, "Google auth URL opened");
  const u = opened[0] ? new URL(opened[0]) : null;
  eq(u && u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth", "auth URL");
  eq(u && u.searchParams.get("client_id"), CLIENT, "auth client_id");
  eq(u && u.searchParams.get("code_challenge_method"), "S256", "PKCE");
  eq(u && u.searchParams.get("prompt"), "consent", "prompt=consent (a refresh token comes back)");
  eq(wire.token.length, 2, "token endpoint asked, total");
  eq(wire.token[1].grant_type, "authorization_code", "the second ask is the exchange");
  eq(wire.token[1].code, "CODE-26-SEP", "with the code");
  eq(wire.token.filter(t => t.refresh_token === DEAD.refresh).length, 1, "the dead grant went over the wire once only (at open)");
  eq(r.token.refresh, FRESH.refresh_token, "stored refresh is the new grant");
  eq(r.token.access, FRESH.access_token, "stored access is the new token");
  eq(r.token.revoked, undefined, "revoked mark gone");
}

console.log("\n4. Sync ran on its own after the sign-in: planned over Drive with the new token");
{
  const jobs = await p.evaluate(() => window.__jobs);
  eq(jobs.length >= 1, true, "sync.start called");
  const j = jobs[0] || {};
  eq(j.transport, "drive", "job transport");
  eq(j.auth && j.auth.access, FRESH.access_token, "job auth.access");
  eq(j.auth && j.auth.refresh, FRESH.refresh_token, "job auth.refresh");
  eq(Array.isArray(j.books) && j.books.length, 0, "books planned (empty Frank folder)");
  eq(wire.drive.length > 0, true, "Drive asked");
  eq(wire.drive.every(d => d.auth === "Bearer ya29.fresh"), true, "every Drive ask carried the new bearer");
  const r = await row();
  eq(r.button, "Sign out", "account button back to Sign out");
  eq(r.state, "signout", "button data-state");
  eq(String(r.text).includes("Drive refused the saved sign-in"), false, "the dead-grant line is gone");
  has(r.text, "Drive", "row line");
  console.log("   line:", await p.evaluate(() => { const el = window.__form.el.querySelector('.set-panel[data-tab="transfer"]'); const l = el.querySelector(".tr-line, .tr-state"); return l ? l.textContent : "(no .tr-line)"; }));
}

console.log("\n5. the pure halves, direct");
{
  const r = await p.evaluate(() => ({
    a: TTSTVSettings.syncNeedsSignIn("the refresh was refused: invalid_grant -- Token has been expired or revoked."),
    b: TTSTVSettings.syncNeedsSignIn("the refresh was refused: HTTP 400 (invalid_grant)"),
    c: TTSTVSettings.syncNeedsSignIn("Google not reachable (Load failed)"),
    d: TTSTVSettings.syncNeedsSignIn(null),
    e: TTSTVDrive.googleGrantDead(new Error("x invalid_grant y")),
    f: TTSTVSettings.syncSignInAgainLine({ who: "a@b" }),
  }));
  eq(r.a, true, "drive.js's sentence");
  eq(r.b, true, "pull.rs's sentence");
  eq(r.c, false, "an unreachable Google is not a dead grant");
  eq(r.d, false, "null");
  eq(r.e, true, "googleGrantDead(Error)");
  eq(r.f, "Drive refused the saved sign-in for a@b — it expired or was revoked. Sign in again to sync.", "the line");
}

eq(errors.length, 0, "page errors"); if (errors.length) console.log("   ", errors);
await browser.close(); server.close();
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
