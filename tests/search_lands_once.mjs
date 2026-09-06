/**
 * search_lands_once.mjs -- the reader's Search, from the press to door one,
 * with the app's two injected scripts and the shell as it is in `shell/`.
 *
 *   node tests/search_lands_once.mjs                  # Chromium
 *   node tests/search_lands_once.mjs --engine webkit  # the phone's engine (Mac)
 *
 * `cargo test` cannot reach a press. This serves `shell/` exactly as
 * `webkit_smoke.mjs` does, opens `reader/reader.html` on the first dev book,
 * injects the two scripts `lib.rs` and `search.rs` inject -- read out of the
 * Rust sources, never retyped -- in the app's order (SEARCH_JS, then HOST_JS)
 * over a stand-in `window.__TAURI__.core.invoke` that records what it is
 * asked, and presses Search in the look-up panel through `lookup.search()`.
 *
 * What it asserts, four ways round:
 *   1. no __TAURI__ at all (a browser): the panel writes its one sentence,
 *      nothing moves;
 *   2. __TAURI__ + SEARCH_JS but no HOST_JS (the shell before 2b6582a): the
 *      sentence, never a blank, nothing moves;
 *   3. __TAURI__ + SEARCH_JS + HOST_JS (the phone): the press lands on the
 *      host, `search()` resolves "sheet", an empty query resolves null, and
 *      the page asks for exactly ONE navigation per press -- door one,
 *      `x-web-search://?` + the -site: form -- and the real invoke is never
 *      asked for `frank_search`;
 *   4. __TAURI__ + HOST_JS, no wrapper (the day frank_search is a real
 *      command): the command receives `{ query: <the -site: form> }`.
 *
 * Door one is an unknown scheme: no engine starts a request for it, so the
 * navigation is read off the protocol -- Chromium's CDP
 * `Page.frameRequestedNavigation`. WebKit exposes no such event to Playwright,
 * so under `--engine webkit` cases 1-4 run and the door-one URL is not
 * counted; the wrapper's path is one function and Chromium counts it.
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
const SEARCH_JS = await rustConst("search.rs", "SEARCH_JS");
const COVERED = ["gutenberg.org", "archive.org", "youtube.com", "wikipedia.org", "wiktionary.org"];
const WORD = "Tityre";
const WEB = WORD + COVERED.map((d) => " -site:" + d).join("");
const DOOR = "x-web-search://?" + encodeURIComponent(WEB);

async function firstBook() {
  try {
    for (const slug of await readdir(join(SHELL, "books"))) {
      try { await stat(join(SHELL, "books", slug, "book-data.js")); return slug; } catch {}
    }
  } catch {}
  return null;
}

const server = await serve(SHELL);
const base = `http://127.0.0.1:${server.address().port}`;
const slug = await firstBook();
if (!slug) { console.log("no book under shell/books/ with a book-data.js -- tools/dev_books.py first"); process.exit(1); }
const url = `${base}/reader/reader.html?book=books%2F${encodeURIComponent(slug)}`;
console.log(`serving ${SHELL}\n  -> ${url}\n  HOST_JS ${HOST_JS.length} bytes, SEARCH_JS ${SEARCH_JS.length} bytes, engine ${ENGINE}`);

const pw = await import("playwright");
const exe = process.env[`PLAYWRIGHT_${ENGINE.toUpperCase()}_PATH`];
const browser = await pw[ENGINE].launch(exe ? { executablePath: exe } : {});
let bad = 0; const fail = (s) => { console.log("FAIL " + s); bad++; };

async function run(label, { tauri, host, wrapper }) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: ENGINE !== "firefox", hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  const hrefs = [];
  if (ENGINE === "chromium") {
    const cdp = await ctx.newCDPSession(page); await cdp.send("Page.enable");
    cdp.on("Page.frameRequestedNavigation", (e) => hrefs.push(e.url));
  }
  if (tauri) await page.addInitScript(() => {
    window.__TAURI__ = { core: { invoke(cmd, args) { (window.__calls = window.__calls || []).push({ cmd, args }); return Promise.resolve(null); } } };
  });
  if (wrapper) await page.addInitScript(SEARCH_JS);
  if (host) await page.addInitScript(HOST_JS);
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async (WORD) => {
    const lk = window.lookup; if (!lk) return { error: "window.lookup is not mounted -- reader.html did not open the book" };
    const has = typeof (window.TTSTVHost && window.TTSTVHost.search) === "function";
    const took = lk.search(WORD);
    await new Promise((r) => setTimeout(r, 120));
    const note = document.querySelector("#lookuppanel #note");
    const direct = has ? await window.TTSTVHost.search(WORD) : "n/a";
    const empty = has ? await window.TTSTVHost.search("   ") : "n/a";
    return { has, took, last: lk.lastSearch, note: note ? note.textContent : null,
      calls: window.__calls || [], direct, empty };
  }, WORD);
  await page.waitForTimeout(200);
  r.hrefs = hrefs.filter((h) => h.startsWith("x-web-search:"));
  r.errors = errors;
  console.log(`\n== ${label}\n  method ${r.has}  press took ${r.took}  last ${JSON.stringify(r.last)}\n  note ${JSON.stringify(r.note)}\n  invoke ${JSON.stringify(r.calls)}\n  door one ${JSON.stringify(r.hrefs)}  direct ${JSON.stringify(r.direct)}  empty ${JSON.stringify(r.empty)}  errors ${r.errors.length}`);
  if (r.error) fail(label + ": " + r.error);
  await ctx.close();
  return r;
}

const SENTENCE = "Search needs Frank — this page has no host to open it.";
const a = await run("1. no __TAURI__, no host (a browser)", { tauri: false, host: false, wrapper: false });
if (a.has !== false || a.took !== false || !a.last || a.last.how !== "none") fail("1: the press must be a no-op with how=none");
if (a.note !== SENTENCE) fail("1: the one sentence is missing");
if (a.calls.length || a.hrefs.length) fail("1: nothing may move");

const b = await run("2. __TAURI__ + SEARCH_JS, HOST_JS absent (the shell before 2b6582a)", { tauri: true, host: false, wrapper: true });
if (b.has !== false || b.note !== SENTENCE) fail("2: without the method the panel must show the sentence, never a blank");
if (b.calls.length || b.hrefs.length) fail("2: without the method nothing may move");

const c = await run("3. __TAURI__ + SEARCH_JS + HOST_JS (the phone)", { tauri: true, host: true, wrapper: true });
if (c.has !== true || c.took !== true || !c.last || c.last.how !== "host" || c.last.why) fail("3: the press must land on the host: " + JSON.stringify(c.last));
if (c.note !== null) fail("3: with the method there must be no sentence");
if (c.direct !== "sheet") fail("3: search() must resolve 'sheet', got " + JSON.stringify(c.direct));
if (c.empty !== null) fail("3: an empty query must resolve null");
if (c.calls.some((x) => x.cmd === "frank_search")) fail("3: frank_search must be answered by the wrapper, never by the real invoke");
if (ENGINE === "chromium") {
  // two presses in this run: lookup.search() and the direct call -- one door each
  if (c.hrefs.length !== 2 || c.hrefs.some((h) => h !== DOOR)) fail("3: door one, once per press, on the -site: form; got " + JSON.stringify(c.hrefs));
  else console.log(`  ok  door one, once per press: ${DOOR}\n      decoded: ${WEB}`);
} else {
  console.log("  (door one is read off CDP; in " + ENGINE + " the navigation is not observable from outside -- the wrapper's path is the same code, proved under Chromium)");
}
if (c.errors.length) fail("3: page errors: " + c.errors.join(" | "));

const d = await run("4. __TAURI__ + HOST_JS, no wrapper (frank_search as a real command)", { tauri: true, host: true, wrapper: false });
const fs = d.calls.filter((x) => x.cmd === "frank_search");
if (fs.length !== 2 || fs.some((x) => !x.args || x.args.query !== WEB)) fail("4: the real command must get { query: <the -site: form> }: " + JSON.stringify(fs));
else console.log(`  ok  frank_search { query: ${JSON.stringify(WEB)} }, once per press`);
if (d.direct !== "sheet") fail("4: resolves 'sheet' over a real command too");

await browser.close(); server.close();
console.log(bad ? `\nsearch_lands_once: FAIL (${bad})` : "\nsearch_lands_once: OK");
process.exit(bad ? 1 : 0);
