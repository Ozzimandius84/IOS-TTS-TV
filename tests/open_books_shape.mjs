/**
 * open_books_shape.mjs -- WHAT AN OPEN BOOK COSTS ON THE PHONE.
 *
 *   node tests/open_books_shape.mjs [--books <dir>] [--n 10]
 *
 * The Mac asked this question first. `desktop/src-tauri/src/tabs.rs` gave one
 * WKWebView per open tab, so thirty Eclogues were thirty renderers and 5.4 GB;
 * K25 fix (b) (TTSTV `949833b`) made a book that is not in front a RECORD --
 * `{slug, title}` in `localStorage["ttstv.openBooks"]` plus the reader's own
 * `wordcursor:<slug>` -- and its renderer is closed. 615 MB at thirty.
 *
 * This asks whether the phone has the same shape. It cannot press the
 * simulator (that is one command on Osca's Mac, and no lane claims a phone
 * result it did not see), so it counts and it RUNS, on the two currencies the
 * phone actually spends:
 *
 *   1. SURFACES -- every construct in the crate and in the Objective-C that
 *      could make a webview, counted, with the window labels they name.
 *   2. DOORS -- `HOST_JS`, read verbatim out of `lib.rs` and executed against
 *      a stand-in window that records every navigation and every attempt to
 *      make a surface. Opened N times, with N real slugs.
 *   3. RECORDS -- the open-books block of the SHIPPED `shell/reader/pbar.js`,
 *      lifted by brace-matched line range and never retyped, run over the same
 *      N slugs with stub storage. Its list length and its bytes at 1 / 3 / N.
 *   4. NATIVE -- `src-tauri/ios/*.m`, allocations of a webview class.
 *
 * Exit 1 on any miss. One JSON line last. No screenshot, no pixel, no PNG.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const N = +arg("--n", 10);
/* Osca's Mac has the two repos as siblings; through the Cowork bridge they are
   two mounts. Both spellings are tried, in order, and the one that exists wins. */
const CANDIDATES = [
  resolve(REPO, "..", "..", "TTSTV", "TTSTV", "books"),
  resolve(REPO, "..", "..", "TTSTV", "books"),
  join(process.env.HOME || "", "mnt", "TTSTV", "books"),
];

let bad = 0;
const say = (s) => console.log(s);
const eq = (got, want, what) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  say(`   ${ok ? "ok  " : "MISS"} ${what}: ${JSON.stringify(got)}${ok ? "" : ` (wanted ${JSON.stringify(want)})`}`);
};

async function rustConst(file, name) {
  const src = await readFile(join(REPO, "src-tauri", "src", file), "utf8");
  const m = src.match(new RegExp(`pub const ${name}: &str = r#"([\\s\\S]*?)"#;`));
  if (!m) throw new Error(`${file}: no ${name}`);
  return m[1];
}

/* real slugs, off the disk -- a book folder is one with a book.json in it */
let BOOKS = arg("--books", null);
async function slugs(n) {
  let names = [];
  for (const c of BOOKS ? [BOOKS] : CANDIDATES) {
    try { names = (await readdir(c)).sort(); BOOKS = c; break; } catch (_) {}
  }
  if (!names.length) return [];
  const out = [];
  for (const s of names) {
    if (out.length >= n) break;
    try { if ((await stat(join(BOOKS, s))).isDirectory()) out.push(s); } catch (_) {}
  }
  return out;
}

const SLUGS = await slugs(N);
if (SLUGS.length < 2) {
  say(`no books at ${BOOKS} -- pass --books <dir>. The census below still runs.`);
}
say(`open_books_shape -- ${REPO}\n  books ${BOOKS}, ${SLUGS.length} slugs, N=${N}\n`);

/* ------------------------------------------------------ 1. SURFACES, counted */
say("1. surfaces the crate can make");
const rs = {};
for (const f of await readdir(join(REPO, "src-tauri", "src")))
  if (f.endsWith(".rs")) rs[f] = await readFile(join(REPO, "src-tauri", "src", f), "utf8");
const allRs = Object.values(rs).join("\n");
const count = (hay, re) => (hay.match(re) || []).length;

const builders = count(allRs, /WebviewWindowBuilder::new|WebviewWindow::builder|WebviewBuilder::new/g);
const children = count(allRs, /\badd_child\s*\(|\badd_content\s*\(|\bcreate_webview\s*\(/g);
const labels = [...new Set([...allRs.matchAll(/get_webview_window\(\s*"([^"]+)"\s*\)/g)].map(m => m[1]))].sort();
eq(builders, 1, "webview builders in the whole crate");
eq(children, 0, "add_child / add_content / create_webview");
eq(labels, ["main"], "every window label the crate names");

/* ------------------------------------------------------------- 2. THE DOORS */
say("\n2. the doors, run (HOST_JS verbatim out of lib.rs)");
const HOST_JS = await rustConst("lib.rs", "HOST_JS");
const nav = [];
const surfaces = [];
const invokes = [];
const stand = {
  location: {
    href: "frank://localhost/library/library.html",
    assign: (u) => nav.push(["assign", u]),
    replace: (u) => nav.push(["replace", u]),
  },
  open: (...a) => { surfaces.push(["window.open", ...a]); return null; },
  __TAURI__: { core: { invoke: (c, a) => { invokes.push([c, a]); return Promise.resolve(null); } } },
};
stand.window = stand;
new Function("window", HOST_JS)(stand);
const H = stand.TTSTVHost;
if (typeof H !== "object") { say("   MISS HOST_JS defined no TTSTVHost"); bad++; }
for (const s of SLUGS) H.openReader(s);
H.openLibrary();
eq(nav.length, SLUGS.length + 1, `navigations for ${SLUGS.length} book opens + one library`);
eq(surfaces.length, 0, "surfaces the doors asked for");
eq(invokes.length, 0, "commands the doors sent");
eq([...new Set(nav.map(n => n[0]))], ["assign"], "the kind of every door navigation");
/* a door that made no navigation at all is a MISS above, not a crash here */
if (SLUGS.length) eq(nav[0] ? nav[0][1] : null,
                     `/reader/reader.html?book=books/${encodeURIComponent(SLUGS[0])}`,
                     "the first door's URL");
eq(nav.length ? nav[nav.length - 1][1] : null, "/library/library.html", "the library door's URL");

/* ------------------------------------------------ 3. THE RECORDS, run, N deep */
say("\n3. the records (shell/reader/pbar.js, lifted by line range, not retyped)");
const PBAR = join(REPO, "shell", "reader", "pbar.js");
const pbar = (await readFile(PBAR, "utf8")).split("\n");
/* the block runs from the line that declares OPEN_KEY to the close of
   switchTo() -- found, never numbered by hand */
const first = pbar.findIndex(l => l.includes('var OPEN_KEY = "ttstv.openBooks"'));
if (first < 0) { say("   MISS pbar.js has no OPEN_KEY"); bad++; }
let last = pbar.findIndex((l, i) => i > first && /^\s*function switchTo\(/.test(l));
if (last < 0) { say("   MISS pbar.js has no switchTo"); bad++; }
while (last < pbar.length && pbar[last] !== "  }") last++;
const BLOCK = pbar.slice(first, last + 1).join("\n");
say(`   lifted lines ${first + 1}-${last + 1} of ${pbar.length} (${BLOCK.length} bytes), verbatim`);

function freshStore() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
           removeItem: k => m.delete(k), _map: m };
}
const LS = freshStore(), SS = freshStore();
const replaced = [];
const env = {
  localStorage: LS, sessionStorage: SS,
  location: { replace: (u) => replaced.push(u) },
};
const api = new Function("localStorage", "sessionStorage", "location",
  BLOCK + "\n return { readOpen, noteOpen, noteTitle, neighbour, switchTo, at };"
)(env.localStorage, env.sessionStorage, env.location);

const bytesAt = {};
const listAt = {};
SLUGS.forEach((s, i) => {
  api.noteOpen(s);
  api.noteTitle(s.replace(/-/g, " "));
  const n = i + 1;
  if (n === 1 || n === 3 || n === SLUGS.length) {
    bytesAt[n] = (LS.getItem("ttstv.openBooks") || "").length;
    listAt[n] = api.readOpen().length;
  }
});
eq(listAt, Object.fromEntries(Object.keys(listAt).map(k => [k, +k])), "records held at 1 / 3 / N");
/* an empty list is a MISS above; read it defensively so the control reports */
const front = api.readOpen()[0];
if (SLUGS.length) eq(front ? front.slug : null, SLUGS[SLUGS.length - 1],
                     "front of the list is the newest open");
/* re-opening a book already in the list MOVES it; it does not add one */
api.noteOpen(SLUGS[0]);
eq(api.readOpen().length, SLUGS.length, "records after re-opening a book already open");
/* the slide: a neighbour, and a REPLACE -- never a second surface */
api.noteOpen(SLUGS[SLUGS.length - 1]);   /* stand on the newest, so +1 exists */
const nb = api.neighbour(1);
eq(typeof nb === "object" && nb !== null, true, "there is a next open book to slide to");
if (nb) api.switchTo(nb);
eq(replaced.length, 1, "navigations the slide made");
/* URLSearchParams percent-encodes the separator, so the slide's spelling is
   `?book=books%2F<slug>` where the door's is `?book=books/<slug>`. Both decode
   to the one value `book`, which is what reader.html reads -- asserted here as
   the DECODED value, so neither spelling can drift into meaning something
   else. */
eq(replaced.length && nb ? new URLSearchParams(replaced[0].slice(1)).get("book") : null,
   nb ? "books/" + nb.slug : null,
   `the slide's ?book= decodes to the neighbour (raw ${JSON.stringify(replaced[0] || null)})`);
eq(SS.getItem("ttstv.openBooks.slid"), nb ? nb.slug : null,
   "the slide marks itself so the order stands");
say(`   bytes of the whole open-books record: ${JSON.stringify(bytesAt)}`);

/* ------------------------------------------------------------- 4. THE NATIVE */
say("\n4. webviews the Objective-C makes");
let objc = "";
for (const f of await readdir(join(REPO, "src-tauri", "ios")))
  if (f.endsWith(".m")) objc += "\n" + await readFile(join(REPO, "src-tauri", "ios", f), "utf8");
const allocs = [...objc.matchAll(/\[\[\s*(WKWebView|WKWebViewConfiguration|UIWebView)\s+alloc\]/g)].map(m => m[1]);
eq(allocs, [], "webview allocations in src-tauri/ios/*.m");

/* ------------------------------------------------------------------ the line */
const verdict = builders === 1 && children === 0 && labels.length === 1 && surfaces.length === 0
  && allocs.length === 0 ? "one-webview" : "one-webview-per-book";
say(`\n${bad ? `${bad} MISS` : "all ok"} -- the phone is ${verdict}`);
console.log(JSON.stringify({
  builders, children, labels, doorNavigations: nav.length, doorSurfaces: surfaces.length,
  doorCommands: invokes.length, slideReplaces: replaced.length, recordsAt: listAt,
  recordBytesAt: bytesAt, objcWebviewAllocs: allocs.length, n: SLUGS.length, verdict, miss: bad,
}));
process.exit(bad ? 1 : 0);
