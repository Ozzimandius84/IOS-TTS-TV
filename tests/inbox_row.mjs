/**
 * inbox_row.mjs -- the inbox row on the shelf, from what is waiting to the
 * row going away. G-INBOX, 13 September.
 *
 *   node tests/inbox_row.mjs                  # Chromium
 *   node tests/inbox_row.mjs --engine webkit  # the phone's engine (Mac)
 *
 * `cargo test` can only read `INBOX_JS` as a string. This serves `shell/` the
 * way `doors_are_navigations.mjs` does, injects `INBOX_JS` read out of
 * `lib.rs` -- never retyped -- over a stand-in `window.__TAURI__.core.invoke`
 * that answers `inbox_list` and records `inbox_send` / `inbox_drop`, and
 * presses the row.
 *
 * What it asserts:
 *   1. the row draws on the Library page, ABOVE the shelf: its rectangle ends
 *      before `.shell`'s begins, and it is not a descendant of `#shelf`.
 *   2. it survives the shelf being re-rendered (the whole reason it is not in
 *      the rail): `#shelf.innerHTML = ""` and the row is still connected.
 *   3. unpaired: the sentence says what it needs, and NOTHING is sent.
 *   4. paired, Studio answers 404 (the state of the door today): the row is
 *      stuck with the sentence that names /upload, and nothing is dropped.
 *   5. paired, Studio answers 200: send got (id, via, base, token), the item
 *      is dropped, the row goes, and one line says where it went.
 *   6. two waiting and one sent: the other keeps its row and the caption
 *      counts what is left.
 *   7. a page outside Frank (no `__TAURI__`) gets no door and no row.
 *   8. no page errors, and no navigation, anywhere above.
 *
 * Exit 1 on any miss. No screenshot.
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
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
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
const INBOX_JS = await rustConst("lib.rs", "INBOX_JS");

const ROWS = [
  { id: "Walden.pdf", via: "open-in", title: "Walden.pdf", url: null, kind: null, at: null, file: "Walden.pdf", bytes: 1234567 },
  { id: "notes.txt", via: "open-in", title: "notes.txt", url: null, kind: null, at: null, file: "notes.txt", bytes: 88 },
];
const PAIR = { base: "http://192.168.1.8:8765", token: "tok-123", name: "Osca's Studio" };

const server = await serve(SHELL);
const base = `http://127.0.0.1:${server.address().port}`;
const LIB = `${base}/library/library.html`;
console.log(`serving ${SHELL}\n  -> ${LIB}\n  INBOX_JS ${INBOX_JS.length} bytes, engine ${ENGINE}`);

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

const PHONE = { width: 393, height: 852 };

/** The Library page, with the host stood in for and the inbox answering. */
async function page({ host = true, paired = false, answer = { ok: true }, rows = ROWS, sendMs = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: PHONE, isMobile: ENGINE !== "firefox", hasTouch: true });
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  const navs = []; ctx.on("page", (q) => navs.push(q.url()));
  await p.addInitScript(({ rows, answer, paired, PAIR, sendMs }) => {
    window.__calls = [];
    window.__TAURI__ = { core: { invoke(cmd, args) {
      window.__calls.push({ cmd, args });
      if (cmd === "inbox_list") return Promise.resolve(window.__rows);
      if (cmd === "inbox_send") {
        /* the real one is a file up a phone's Wi-Fi; a stub that answers in
           the same tick would make the middle state unobservable */
        return new Promise((go) => setTimeout(() => go(answer), sendMs));
      }
      if (cmd === "inbox_drop") {
        /* the real one takes the item OUT, so the stub does too -- otherwise
           the next list would hand back a row that is gone */
        window.__rows = window.__rows.filter((r) => r.id !== args.id);
        return Promise.resolve(true);
      }
      return Promise.resolve(null);
    } } };
    window.__rows = rows.slice();
    if (paired) { try { localStorage.setItem("ttstv.sync.pair", JSON.stringify(PAIR)); } catch (e) {} }
    else { try { localStorage.removeItem("ttstv.sync.pair"); } catch (e) {} }
  }, { rows, answer, paired, PAIR, sendMs });
  if (host) await p.addInitScript(INBOX_JS);
  await p.goto(LIB, { waitUntil: "load" });
  await p.waitForTimeout(900);
  return { ctx, p, errors, navs };
}

// ----------------------------------------------- 1 + 2. where the row hangs
{
  console.log("\n1. the row draws on the Library page, above the shelf");
  const s = await page();
  const box = await s.p.evaluate(() => {
    const b = document.getElementById("frankInbox");
    const shell = document.querySelector(".shell");
    const shelf = document.getElementById("shelf");
    if (!b) return { there: false };
    const r = b.getBoundingClientRect(), sh = shell.getBoundingClientRect();
    return { there: true, hidden: b.hidden, rows: b.querySelectorAll(".fi-row").length,
      top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height),
      shellTop: Math.round(sh.top), insideShelf: !!(shelf && shelf.contains(b)),
      before: b.compareDocumentPosition(shell) === Node.DOCUMENT_POSITION_FOLLOWING,
      cap: (b.querySelector(".fi-cap") || {}).textContent,
      says: [...b.querySelectorAll(".fi-says")].map((n) => n.textContent),
      states: [...b.querySelectorAll(".fi-row")].map((n) => n.getAttribute("data-state")) };
  });
  eq(box.there, true, "#frankInbox exists");
  eq(box.hidden, false, "hidden");
  eq(box.rows, 2, "rows drawn");
  eq(box.insideShelf, false, "inside #shelf");
  eq(box.before, true, "it comes before .shell in the document");
  console.log(`       rect: top ${box.top}, bottom ${box.bottom}, height ${box.height}; .shell top ${box.shellTop}`);
  (box.bottom <= box.shellTop + 1) ? ok(`the row ends (${box.bottom}) at or above the shelf's top (${box.shellTop})`)
    : fail(`the row overlaps the shelf: bottom ${box.bottom} vs shell top ${box.shellTop}`);
  (box.height > 0) ? ok(`the row has a height (${box.height}px), so it is not a hidden element`)
    : fail("the row has no height");
  eq(box.cap, "Inbox · 2 waiting", "the caption");
  eq(box.states.join(","), "waiting,waiting", "the states");
  has(box.says[0], "Awaiting a parse", "the first row");

  console.log("\n2. the shelf is re-rendered and the row survives it");
  const alive = await s.p.evaluate(() => {
    document.getElementById("shelf").innerHTML = "";
    const b = document.getElementById("frankInbox");
    return { connected: !!(b && b.isConnected), rows: b ? b.querySelectorAll(".fi-row").length : 0 };
  });
  eq(alive.connected, true, "still connected after #shelf.innerHTML = ''");
  eq(alive.rows, 2, "rows still there");
  eq(s.errors.length, 0, "page errors");
  await s.ctx.close();
}

// ------------------------------------------------------- 3. unpaired
{
  console.log("\n3. unpaired -- the sentence says what it needs, and nothing is sent");
  const s = await page({ paired: false });
  const before = await s.p.evaluate(() => window.__calls.filter((c) => c.cmd === "inbox_send").length);
  eq(before, 0, "sends before the tap");
  const after = await s.p.evaluate(() => {
    document.querySelector(".fi-row .fi-go").click();
    return null;
  });
  await s.p.waitForTimeout(400);
  const r = await s.p.evaluate(() => {
    const row = document.querySelector(".fi-row");
    return { state: row.getAttribute("data-state"), says: row.querySelector(".fi-says").textContent,
      sends: window.__calls.filter((c) => c.cmd === "inbox_send").length };
  });
  eq(r.state, "stuck", "the state");
  has(r.says, "Pair this phone in Settings", "the sentence");
  eq(r.sends, 0, "inbox_send calls");
  eq(s.errors.length, 0, "page errors");
  await s.ctx.close();
}

// ------------------------------------- 4. paired, and the door is still shut
{
  console.log("\n4. paired, Studio answers 404 -- the door is not open to a phone yet");
  const why = "this Studio has not opened /upload to a phone yet -- its door answers /search, /attach, /run, /state, /book and /stop, and a file off a phone is not one of them";
  const s = await page({ paired: true, answer: { ok: false, status: 404, why } });
  await s.p.evaluate(() => document.querySelector(".fi-row .fi-go").click());
  await s.p.waitForTimeout(500);
  const r = await s.p.evaluate(() => {
    const row = document.querySelector(".fi-row");
    return { state: row.getAttribute("data-state"), says: row.querySelector(".fi-says").textContent,
      rows: document.querySelectorAll(".fi-row").length,
      drops: window.__calls.filter((c) => c.cmd === "inbox_drop").length,
      send: (window.__calls.find((c) => c.cmd === "inbox_send") || {}).args };
  });
  eq(r.state, "stuck", "the state");
  has(r.says, "/upload", "the sentence");
  eq(r.rows, 2, "rows still on the shelf");
  eq(r.drops, 0, "nothing was dropped");
  eq(JSON.stringify(r.send), JSON.stringify({ id: "Walden.pdf", via: "open-in", base: PAIR.base, token: PAIR.token }),
    "what send was given");
  eq(s.errors.length, 0, "page errors");
  await s.ctx.close();
}

// ------------------------------------------------ 5. paired, and it goes
{
  console.log("\n5. paired, Studio answers 200 -- the item goes and one line says where");
  const s = await page({ paired: true, answer: { ok: true, status: 200, saved: "Walden.pdf",
    why: "Studio has it and is parsing it -- it will arrive with the next Sync" }, rows: [ROWS[0]], sendMs: 400 });
  const sending = [];
  await s.p.evaluate(() => document.querySelector(".fi-row .fi-go").click());
  await s.p.waitForTimeout(150);
  sending.push(await s.p.evaluate(() => {
    const row = document.querySelector(".fi-row");
    return row ? { state: row.getAttribute("data-state"), says: row.querySelector(".fi-says").textContent } : null;
  }));
  await s.p.waitForTimeout(1600);
  const r = await s.p.evaluate(() => ({
    rows: document.querySelectorAll(".fi-row").length,
    note: (document.querySelector("#frankInbox .fi-note") || {}).textContent || "",
    hidden: document.getElementById("frankInbox").hidden,
    drop: (window.__calls.find((c) => c.cmd === "inbox_drop") || {}).args,
  }));
  if (sending[0]) { eq(sending[0].state, "sending", "the middle state"); has(sending[0].says, "Osca's Studio", "while sending"); }
  else fail("the row was gone before the sending state could be read");
  eq(JSON.stringify(r.drop), JSON.stringify({ id: "Walden.pdf", via: "open-in" }), "what drop was given");
  eq(r.rows, 0, "rows left");
  has(r.note, "is with Osca's Studio", "the line that is left");
  eq(s.errors.length, 0, "page errors");
  eq(s.navs.length, 0, "pages opened");
  await s.ctx.close();
}

// ---------------------- 6. one of two goes, and the other is still waiting
{
  console.log("\n6. two waiting, one sent -- the other keeps its row and the count is right");
  const s = await page({ paired: true, answer: { ok: true, status: 200, saved: "Walden.pdf" }, sendMs: 50 });
  await s.p.evaluate(() => document.querySelector(".fi-row .fi-go").click());
  await s.p.waitForTimeout(700);
  const r = await s.p.evaluate(() => ({
    rows: [...document.querySelectorAll(".fi-row")].map((n) => n.getAttribute("data-id")),
    notes: document.querySelectorAll("#frankInbox .fi-note").length,
    cap: document.querySelector("#frankInbox .fi-cap").textContent,
    hidden: document.getElementById("frankInbox").hidden,
  }));
  eq(r.rows.join(","), "notes.txt", "what is still waiting");
  eq(r.notes, 1, "lines saying where one went");
  eq(r.cap, "Inbox \u00b7 1 waiting", "the caption");
  eq(r.hidden, false, "the box");
  eq(s.errors.length, 0, "page errors");
  await s.ctx.close();
}

// ------------------------------------- 7. a page that is not in Frank
{
  console.log("\n7. no __TAURI__ -- no door and no row (the PWA, the Mac's own pages)");
  const ctx = await browser.newContext({ viewport: PHONE });
  const p = await ctx.newPage();
  await p.addInitScript(INBOX_JS);
  await p.goto(LIB, { waitUntil: "load" });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({
    door: !!(window.TTSTVHost && window.TTSTVHost.inbox),
    box: !!document.getElementById("frankInbox"),
  }));
  eq(r.door, false, "TTSTVHost.inbox present");
  eq(r.box, false, "#frankInbox present");
  await ctx.close();
}

await browser.close();
server.close();
console.log(bad ? `\n${bad} FAILED` : `\nall passed`);
process.exit(bad ? 1 : 0);
