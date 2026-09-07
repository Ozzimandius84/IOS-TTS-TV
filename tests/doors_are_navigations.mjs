/**
 * doors_are_navigations.mjs -- the three doors of `HOST_JS`, from the press to
 * the URL the webview is asked for.
 *
 *   node tests/doors_are_navigations.mjs                  # Chromium
 *   node tests/doors_are_navigations.mjs --engine webkit  # the phone's engine (Mac)
 *
 * `cargo test` can only read the strings. This serves `shell/` the way
 * `search_lands_once.mjs` does, injects `HOST_JS` read out of `lib.rs` --
 * never retyped -- over a stand-in `window.__TAURI__.core.invoke`, and presses
 * the shelf.
 *
 * What it asserts:
 *   1. HOST_JS absent (the phone before this commit): library.html falls
 *      through to `window.open`, which is the call a WKWebView ignores. The
 *      run records that it took the window.open path -- that IS the bug.
 *   2. HOST_JS present, double-click on a tile (Osca's "double-tap"): exactly
 *      ONE navigation is requested, and it is
 *      `/reader/reader.html?book=books/<slug>`; no second page is opened.
 *   3. the same tile, phone viewport, single tap (`isPhone()` -- "ON A PHONE A
 *      TAP OPENS", library.html): the same one URL.
 *   4. the doors called directly, against `tabs.rs::url_for`'s own table:
 *      openReader(slug), openReader(slug, unit), openLibrary(),
 *      openWindow(slug), openWindow("reader", slug), openWindow("library").
 *   5. `window.open` is never called by the host object, on any of them.
 *   6. from the reader, openLibrary() lands back on /library/library.html --
 *      the Library door returns.
 *
 * Exit 1 on any miss. No screenshot.
 */
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const SHELL = join(REPO, "shell");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ENGINE = arg("--engine", "chromium");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png",
  ".webmanifest": "application/manifest+json" };
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

/** `pub const NAME: &str = r#"..."#;` out of a Rust source, verbatim. */
async function rustConst(file, name) {
  const src = await readFile(join(REPO, "src-tauri", "src", file), "utf8");
  const m = src.match(new RegExp(`pub const ${name}: &str = r#"([\\s\\S]*?)"#;`));
  if (!m) throw new Error(`${file}: no ${name}`);
  return m[1];
}
const HOST_JS = await rustConst("lib.rs", "HOST_JS");

async function firstBook() {
  for (const slug of (await readdir(join(SHELL, "books"))).sort()) {
    try { await stat(join(SHELL, "books", slug, "book-data.js")); return slug; } catch {}
  }
  return null;
}

const server = await serve(SHELL);
const base = `http://127.0.0.1:${server.address().port}`;
const slug = await firstBook();
if (!slug) { console.log("no book under shell/books/ with a book-data.js -- tools/dev_books.py first"); process.exit(1); }
const LIB = `${base}/library/library.html`;
const WANT = `/reader/reader.html?book=books/${encodeURIComponent(slug)}`;
console.log(`serving ${SHELL}\n  -> ${LIB}\n  HOST_JS ${HOST_JS.length} bytes, book "${slug}", engine ${ENGINE}`);

const pw = await import("playwright");
const exe = process.env[`PLAYWRIGHT_${ENGINE.toUpperCase()}_PATH`];
const browser = await pw[ENGINE].launch(exe ? { executablePath: exe } : {});
let bad = 0;
const fail = (s) => { console.log("  FAIL " + s); bad++; };
const ok = (s) => console.log("  ok   " + s);
const eq = (got, want, what) => (got === want ? ok(`${what} = ${want}`) : fail(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

const PHONE = { width: 393, height: 852 };
const DESK = { width: 1100, height: 800 };

/** One page on the shelf, with or without the host, recording every
 *  navigation the frame asks for and every popup the context opens. */
async function shelf({ host, viewport, url = LIB }) {
  const ctx = await browser.newContext({ viewport, isMobile: ENGINE !== "firefox" && viewport === PHONE, hasTouch: viewport === PHONE });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  const navs = [];
  const popups = [];
  ctx.on("page", (p) => popups.push(p.url()));
  if (ENGINE === "chromium") {
    const cdp = await ctx.newCDPSession(page); await cdp.send("Page.enable");
    cdp.on("Page.frameRequestedNavigation", (e) => navs.push(e.url));
  }
  await page.addInitScript(() => {
    window.__TAURI__ = { core: { invoke(cmd, args) { (window.__calls = window.__calls || []).push({ cmd, args }); return Promise.resolve(null); } } };
    window.__opens = [];
    const real = window.open;
    window.open = function (u) { window.__opens.push(String(u)); return real ? null : null; };
  });
  if (host) await page.addInitScript(HOST_JS);
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  return { ctx, page, navs, popups, errors, path: (u) => (u || "").replace(base, "") };
}

// ---------------------------------------------------- 1. the bug, reproduced
{
  console.log(`\n1. HOST_JS absent -- library.html falls through to window.open`);
  const s = await shelf({ host: false, viewport: PHONE });
  const has = await s.page.evaluate(() => !!(window.TTSTVHost && window.TTSTVHost.openReader));
  eq(has, false, "TTSTVHost.openReader present");
  const took = await s.page.evaluate((sl) => {
    const row = document.querySelector(`.railrow[data-slug="${sl}"]`);
    if (!row) return "no-row";
    row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    return (window.__opens || []).length ? "window.open" : "nothing";
  }, slug);
  eq(took, "window.open", "what the shelf reached for");
  console.log("       (a WKWebView ignores that call -- which is why a tap did nothing)");
  await s.ctx.close();
}

// ------------------------------------------- 2. the double-tap, host present
{
  console.log(`\n2. HOST_JS present -- double-click a tile (desktop viewport)`);
  const s = await shelf({ host: true, viewport: DESK });
  const has = await s.page.evaluate(() => ["openReader", "openLibrary", "openWindow"].filter((k) => typeof (window.TTSTVHost || {})[k] === "function"));
  eq(has.join(","), "openReader,openLibrary,openWindow", "the three doors");
  await s.page.evaluate((sl) => {
    const row = document.querySelector(`.railrow[data-slug="${sl}"]`);
    if (!row) throw new Error("no row for " + sl);
    row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
  }, slug);
  await s.page.waitForTimeout(900);
  const opens = await s.page.evaluate(() => (window.__opens || []).length).catch(() => 0);
  if (ENGINE === "chromium") {
    const asked = s.navs.map(s.path).filter((u) => u.startsWith("/reader/"));
    eq(asked.length, 1, "navigations requested to the reader");
    eq(asked[0], WANT, "the URL");
  }
  eq(s.path(s.page.url()), WANT, "where the webview ended up");
  eq(s.popups.length, 0, "popups opened");
  eq(opens, 0, "window.open calls");
  eq(s.errors.length, 0, "page errors");
  await s.ctx.close();
}

// ------------------------------------------------- 3. one tap, phone viewport
{
  console.log(`\n3. HOST_JS present -- one tap, phone viewport (isPhone: a tap opens)`);
  const s = await shelf({ host: true, viewport: PHONE });
  await s.page.evaluate((sl) => {
    const row = document.querySelector(`.railrow[data-slug="${sl}"]`);
    if (!row) throw new Error("no row for " + sl);
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, slug);
  await s.page.waitForTimeout(900);
  eq(s.path(s.page.url()), WANT, "the URL");
  eq(s.popups.length, 0, "popups opened");
  await s.ctx.close();
}

// ------------------------------------------- 4 + 5. the doors, url_for's table
// No browser for this one. `window.location` cannot be redefined in a real
// page, so HOST_JS -- the very string, verbatim -- is run as a function of one
// argument named `window` against a stand-in that records what it is asked.
// The IIFE reads nothing else off the global.
{
  console.log(`\n4. the doors called directly, against tabs.rs::url_for's table`);
  const seen = [], opens = [];
  const stand = {
    __TAURI__: { core: { invoke() { return Promise.resolve(null); } } },
    location: { assign: (u) => seen.push(u) },
    open: (u) => { opens.push(String(u)); return null; },
  };
  new Function("window", HOST_JS)(stand);
  const h = stand.TTSTVHost;
  if (typeof h !== "object") fail("HOST_JS defined no TTSTVHost against a stand-in window");
  else {
    h.openReader("poems");
    h.openReader("poems", "c018");
    h.openReader("a b/c");
    h.openLibrary();
    h.openWindow("poems");
    h.openWindow("reader", "poems");
    h.openWindow("library");
    h.openWindow("studio", "poems");
    const want = [
      "/reader/reader.html?book=books/poems",
      "/reader/reader.html?book=books/poems&ch=c018",
      "/reader/reader.html?book=books/a%20b%2Fc",
      "/library/library.html",
      "/reader/reader.html?book=books/poems",
      "/reader/reader.html?book=books/poems",
      "/library/library.html",
      "/?slug=poems",
    ];
    want.forEach((w, i) => eq(seen[i], w, `door ${i + 1}`));
    eq(seen.length, want.length, "navigations asked for");
    // ...and the same object still asks the crate for its two commands only
    eq((HOST_JS.match(/invoke\(/g) || []).length, 2, "invoke() calls in HOST_JS");
  }
  console.log(`\n5. window.open`);
  eq(opens.length, 0, "window.open calls from the host object");
  eq(HOST_JS.includes("window.open"), false, "the string 'window.open' anywhere in HOST_JS");
}

// ---------------------------------------------- 6. the Library door returns
{
  console.log(`\n6. from the reader, the Library door returns`);
  const s = await shelf({ host: true, viewport: PHONE, url: base + WANT });
  const door = await s.page.evaluate(() => {
    const a = document.getElementById("librarydoor");
    return a ? a.getAttribute("href") : null;
  });
  eq(door, "../library/library.html", "the reader's #librarydoor href");
  await s.page.evaluate(() => window.TTSTVHost.openLibrary());
  await s.page.waitForTimeout(900);
  eq(s.path(s.page.url()), "/library/library.html", "where openLibrary() landed");
  eq(s.popups.length, 0, "popups opened");
  await s.ctx.close();
}

await browser.close();
server.close();
console.log(bad ? `\n${bad} FAILED` : `\nall passed`);
process.exit(bad ? 1 : 0);
