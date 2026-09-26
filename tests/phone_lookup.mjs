/**
 * phone_lookup.mjs -- one word looked up on the phone: the card draws the
 * pack's entry. B-phone, wave 8 (26 Sep).
 *
 *   node tests/phone_lookup.mjs [--engine chromium|webkit]
 *
 * NOT-DONE-25-sep said "`has_dictionary` is false on all 40 books, so the
 * lookup card can only ever say No entry". Since G-LANG (11 Sep) a book
 * carries no dictionary.json: the dictionary on the phone is its LANGUAGE's
 * pack, answered by dict.rs through `TTSTVHost.dict.lookup`, so
 * `has_dictionary: false` x40 is the designed state, not the fault. What the
 * card needs is a pack on the phone. This test is the PAGE half of that: the
 * real `shell/reader/lookup.js`, the real `DICT_JS` out of dict.rs over a
 * stand-in invoke that answers `dict_lookup` with the la pack's REAL entry
 * for "arma" (dictionary/pack.py::entry on TTS_DATA/dictionary/packs/la.sqlite,
 * 26 Sep, 1.7 ms), and a second word the pack does not have.
 *
 * Asserts: the card for "arma" shows the lemma, "noun" and the first gloss;
 * the card for "zzzz" says No entry and not "Looking it up…"; the door was
 * asked exactly once per word; no page errors. Exit 1 on any miss.
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
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
function serve(root) {
  return new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
      if (rel === "/reader/_lookup_bench.html") {
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>lookup bench</title><body><div class="wordview on"></div><script src="lookup.js"></script></body>`);
      }
      try {
        const body = await readFile(join(root, rel));
        res.writeHead(200, { "Content-Type": MIME[extname(rel).toLowerCase()] || "application/octet-stream" });
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
const DICT_JS = await rustConst("dict.rs", "DICT_JS");
const LOOKUP_JS = await rustConst("lookup.rs", "LOOKUP_JS");

/** pack.py::entry(la, "arma") on the Mac's la.sqlite, 26 Sep -- verbatim. */
const ARMA = { lemma: "arma", pos: "noun",
  gloss: ["arms, weapons of war, weaponry, instruments (implements of warfare)", "defensive arms: armour, shields (etc.)",
    "close-quarter weapons (offensive or defensive)", "missile weapons"],
  phon: "[ˈar.ma]", etymology: "From Proto-Indo-European *h₂(e)rmos (“fitting”), from the root *h₂er- (“to join”).",
  related: ["armāmenta", "armārium", "armō"], matched_form: { form: "arma", tags: ["nominative", "plural"] } };

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
const calls = []; await p.exposeFunction("__note", (c) => calls.push(c));
await p.addInitScript(({ ARMA }) => {
  window.__TAURI__ = { core: { invoke(cmd, args) {
    try { window.__note(cmd + " " + JSON.stringify(args || {})); } catch (e) {}
    if (cmd === "dict_lookup") {
      const t = String(args.term).toLowerCase();
      return new Promise(go => setTimeout(() => go({ lang: args.lang, term: args.term, entries: t === "arma" ? [ARMA] : [], us: 1700 }), 30));
    }
    if (cmd === "dict_langs") return Promise.resolve([{ code: "la", name: "Latin", installed_bytes: 266000000 }]);
    if (cmd === "lookup_apple_offered") return Promise.resolve(false);   // iOS has no Latin
    return Promise.resolve(null);
  } } };
}, { ARMA });
await p.addInitScript(`window.__TTSTV_HOST_KIND__ = "phone";`);
await p.addInitScript(DICT_JS);
await p.addInitScript(LOOKUP_JS);
await p.goto(`${base}/reader/_lookup_bench.html`, { waitUntil: "load" });

const cardText = () => p.evaluate(() => {
  const c = document.querySelector(".lookupcard");
  if (!c) return null;
  const q = (s) => { const el = c.querySelector(s); return el ? el.textContent.trim() : null; };
  return { hidden: c.hidden, text: c.innerText.replace(/\s+/g, " ").trim(), glosses: c.querySelectorAll("li").length,
    rect: (() => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() };
});

console.log("\n1. the pack has the word: arma (la)");
{
  const r = await p.evaluate(() => {
    const h = window.Lookup.mount({ slug: "aeneid", book: { lang: "la", langs: ["la"] } });
    return h.open("Arma,", "la");
  });
  eq(r, "Arma", "open() bared the token (case is the pack's to fold)");
  await p.waitForTimeout(250);
  const c = await cardText();
  eq(!!c && !c.hidden, true, "card is up");
  has(c && c.text, "arma", "card");
  has(c && c.text, "noun", "card");
  has(c && c.text, "arms, weapons of war", "card");
  eq(c && c.glosses, 4, "glosses drawn");
  const asked = calls.filter(x => x.startsWith("dict_lookup"));
  eq(asked.length, 1, "dict_lookup asked");
  has(asked[0], '"lang":"la"', "the ask");
  console.log("   card rect", c && c.rect);
}
console.log("\n2. a word the pack has not: zzzz");
{
  await p.evaluate(() => { window.Lookup.current.close(); return window.Lookup.current.open("zzzz", "la"); });
  await p.waitForTimeout(250);
  const c = await cardText();
  has(c && c.text, "No entry for “zzzz”", "card");
  eq(String(c && c.text).includes("Looking it up"), false, "still looking");
  eq(calls.filter(x => x.startsWith("dict_lookup")).length, 2, "dict_lookup asked, total");
}
eq(errors.length, 0, "page errors"); if (errors.length) console.log("   ", errors);

await browser.close(); server.close();
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
