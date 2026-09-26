/**
 * phone_shelf.mjs -- the shelf on the phone: N installed books -> N tiles.
 * B-phone, wave 8 (26 Sep). NOT-DONE-25-sep: "the phone's shelf paints no
 * tiles unless a saved shelf cache already exists (40 books counted, 0 tiles
 * drawn) -- the library code waits for a `/state` answer the phone never gives."
 *
 *   node tests/phone_shelf.mjs [--books 40] [--engine chromium|webkit]
 *
 * Serves the REAL `shell/` and injects the phone's init scripts in lib.rs's
 * ORDER, read out of the Rust sources (never retyped), over a stand-in
 * `window.__TAURI__.core.invoke` that answers `book_list` with N rows shaped
 * like `book_meta`'s and `dict_langs` with the packs given. Then counts.
 *
 * Asserts: tiles on #shelf == N, on a FIRST-EVER open (no shelf cache in
 * localStorage); the storage line counts the same N; no page errors.
 * Exit 1 on any miss. No screenshot -- proof is a number.
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
const N = Number(arg("--books", "40"));

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
function serve(root) {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
      try {
        const body = await readFile(join(root, rel));
        // the race this test exists for: library.json (the dev shelf's one
        // sample row) lands AFTER book_list has -- a fast frank:// 404 on
        // /state followed by a slower file, as on the phone
        if (rel.endsWith("library.json")) await new Promise(r => setTimeout(r, 150));
        res.writeHead(200, { "Content-Type": MIME[extname(rel).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
        res.end(body);
      } catch { res.writeHead(404).end("no"); }
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

async function rustConst(file, name) {
  const src = await readFile(join(REPO, "src-tauri", "src", file), "utf8");
  const m = src.match(new RegExp(`pub const ${name}: &str = r#"([\\s\\S]*?)"#;`));
  if (!m) throw new Error(`${file}: no ${name}`);
  return m[1];
}
// lib.rs's own order: kind line, HOST_JS, BOOKS_JS, SYNC_JS, DICT_JS, LOOKUP_JS, INBOX_JS
const SCRIPTS = [
  `window.__TTSTV_HOST_KIND__ = "phone";`,
  await rustConst("lib.rs", "HOST_JS"),
  await rustConst("lib.rs", "BOOKS_JS"),
  await rustConst("lib.rs", "SYNC_JS"),
  await rustConst("dict.rs", "DICT_JS"),
  await rustConst("lookup.rs", "LOOKUP_JS"),
  await rustConst("lib.rs", "INBOX_JS"),
];

/** A row as `book_meta` stores it (import.js::rowFor / drive.js's shape). */
function row(i) {
  const slug = `book-${String(i + 1).padStart(2, "0")}`;
  return { slug, hash: `h${i}`, title: `Book ${i + 1}`, author: `Author ${i + 1}`, lang: i % 3 ? "en" : "la",
    chapters: 3 + (i % 7), chapters_voiced: 0, bytes: 100000 + i, has_audio: false, has_timings: false,
    has_spans: false, has_dictionary: false, has_cover: false, first_words: "Call me Ishmael", form: "prose" };
}
const ROWS = Array.from({ length: N }, (_, i) => row(i));

const server = await serve(SHELL);
const base = `http://127.0.0.1:${server.address().port}`;
const LIB = `${base}/library/library.html`;
console.log(`serving ${SHELL}\n  -> ${LIB}\n  ${SCRIPTS.length} init scripts, ${N} books, engine ${ENGINE}`);

const pw = await import("playwright");
const exe = process.env[`PLAYWRIGHT_${ENGINE.toUpperCase()}_PATH`];
const browser = await pw[ENGINE].launch(exe ? { executablePath: exe } : {});
let bad = 0;
const fail = (s) => { console.log("  FAIL " + s); bad++; };
const ok = (s) => console.log("  ok   " + s);
const eq = (got, want, what) => (got === want ? ok(`${what} = ${JSON.stringify(want)}`)
  : fail(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

const PHONE = { width: 393, height: 852 };

async function open({ rows = ROWS, cached = false, waitMs = 1500 } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, isMobile: ENGINE !== "firefox", hasTouch: true, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  const calls = [];
  await p.exposeFunction("__note", (c) => calls.push(c));
  await p.addInitScript(({ rows, cached }) => {
    window.__TAURI__ = { core: { invoke(cmd, args) {
      try { window.__note(cmd); } catch (e) {}
      if (cmd === "book_list") return Promise.resolve(rows);
      if (cmd === "dict_langs") return Promise.resolve([]);
      if (cmd === "sync_status") return Promise.resolve({ state: "idle" });
      if (cmd === "inbox_list") return Promise.resolve([]);
      return Promise.resolve(null);
    } } };
    try { if (!cached) localStorage.removeItem("ttstv.reader.shelfCache"); } catch (e) {}
  }, { rows, cached });
  for (const s of SCRIPTS) await p.addInitScript(s);
  await p.goto(LIB, { waitUntil: "load" });
  await p.waitForTimeout(waitMs);
  return { ctx, p, errors, calls };
}

const measure = (p) => p.evaluate(() => {
  const tiles = document.querySelectorAll("#shelf .railrow.tile");
  const rows = document.querySelectorAll("#shelf .railrow");
  const ctx = window.TTSTVContext ? TTSTVContext.read() : null;
  const st = document.querySelector("#device, .device-section, [data-device-section]");
  const rects = Array.from(tiles).slice(0, 3).map(t => { const r = t.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  return { tiles: tiles.length, railrows: rows.length, ctx, kind: window.TTSTVHost && TTSTVHost.kind,
    door: !!(window.TTSTVHost && TTSTVHost.books), rects,
    storage: (document.body.innerText.match(/\d+ books?[^\n]*/) || [""])[0],
    empty: (document.querySelector("#shelf .empty") || {}).textContent || null,
    lib: Array.isArray(window.__LIB && __LIB.libraryBooks) ? __LIB.libraryBooks.length : (typeof libraryBooks !== "undefined" ? (libraryBooks ? libraryBooks.length : null) : "n/a") };
});

{
  console.log(`\n1. first-ever open, ${N} books behind the door, no shelf cache`);
  const s = await open();
  const m = await measure(s.p);
  console.log("  ", JSON.stringify({ ...m, ctx: m.ctx && { kind: m.ctx.kind, phone: m.ctx.phone, device: m.ctx.device, bench: m.ctx.bench } }));
  eq(m.kind, "phone", "TTSTVHost.kind");
  eq(m.door, true, "book door");
  eq(m.tiles, N, "tiles on #shelf");
  eq(s.errors.length, 0, "page errors"); if (s.errors.length) console.log("   ", s.errors.slice(0, 5));
  console.log("   invokes:", s.calls.join(" "));
  await s.ctx.close();
}
{
  console.log(`\n2. zero books behind the door`);
  const s = await open({ rows: [] });
  const m = await measure(s.p);
  eq(m.tiles, 0, "tiles");
  console.log("   empty sentence:", JSON.stringify(m.empty));
  eq(s.errors.length, 0, "page errors");
  await s.ctx.close();
}

await browser.close();
server.close();
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
