/* proof.mjs -- job 13, the search sheet. Untracked scratch; re-runnable.
 *
 *   node scratch-j13/proof.mjs [path-to-TTSTV]
 *
 * It reads two files off disk and RUNS them. Nothing here is a copy:
 *   src-tauri/src/search.rs   -- SEARCH_JS is sliced out between its raw-string
 *                                delimiters and evaluated as it ships.
 *   <TTSTV>/reader/lookup.js  -- the two regions that carry the search control
 *                                (`SEARCH`/`searchUrl`/`tauriInvoke`/
 *                                `tauriWebviewWindow`, and `last`/`openTab`/
 *                                `sheet`/`search`) are located by their own
 *                                first and last lines and evaluated verbatim; a
 *                                substring check asserts each slice is in the
 *                                file before it is run.
 *
 * The Rust half is proved separately, by extraction into a dependency-free
 * crate -- see README.md beside this file.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
/* the Mac's layout first, then the Cowork bridge's mount, then $TTSTV */
const ttstv = process.argv[2] || process.env.TTSTV || [
  join(repo, "..", "..", "TTSTV", "TTSTV"),
  join(process.env.HOME || "", "mnt", "TTSTV"),
].find(p => { try { readFileSync(join(p, "reader/lookup.js")); return true; } catch { return false; } });
if (!ttstv) throw new Error("no TTSTV checkout found -- pass one as argv[2]");

/* ---------------------------------------------------------------- the files */
const rs = readFileSync(join(repo, "src-tauri/src/search.rs"), "utf8");
const open = 'pub const SEARCH_JS: &str = r#"';
const a = rs.indexOf(open) + open.length;
const SHIM = rs.slice(a, rs.indexOf('"#;', a));
if (!SHIM.includes("frank_search")) throw new Error("SEARCH_JS not found in search.rs");

const lk = readFileSync(join(ttstv, "reader/lookup.js"), "utf8");
function slice(firstLine, lastLine) {
  const i = lk.indexOf(firstLine);
  const j = lk.indexOf(lastLine, i);
  if (i < 0 || j < 0) throw new Error("lookup.js has moved: " + firstLine.trim());
  const out = lk.slice(i, j + lastLine.length);
  if (!lk.includes(out)) throw new Error("slice is not verbatim");
  return out;
}
const LK_HEAD = slice('const SEARCH = "https://www.google.com/search?q=";',
                      "  return typeof W === \"function\" ? W : null;\n}");
const LK_BODY = slice("  let last = null;", "    return sheet(url);\n  }");

const CONSUMER = `
  return (function () {
    "use strict";
${LK_HEAD}
${LK_BODY}
    return { search, last: () => last };
  })();
`;

/* ---------------------------------------------------------------- the world */
function world(withHost) {
  const nav = [], calls = [], opened = [], on = { doc: [], win: [] };
  const real = (cmd, args) => { calls.push([cmd, args]); return Promise.resolve(null); };
  const win = {
    location: { set href(v) { nav.push(v); } },
    open: (u) => { opened.push(u); return {}; },
    addEventListener: (t, f) => on.win.push([t, f]),
  };
  if (withHost) win.__TAURI__ = { core: { invoke: real } };
  const doc = { addEventListener: (t, f) => on.doc.push([t, f]) };
  const runShim = () => new Function("window", "document", SHIM)(win, doc);
  const fire = (w, t) => on[w].filter(([k]) => k === t).forEach(([, f]) => f());
  return { win, doc, nav, calls, opened, real, runShim, fire,
           consumer: () => new Function("window", "document", CONSUMER)(win, doc) };
}
let ok = 0, bad = 0;
const check = (n, c) => { c ? (ok++, console.log("  ok   " + n)) : (bad++, console.log("  FAIL " + n)); };
const MOCK_Q = "Spinoza Ethics -site:gutenberg.org -site:archive.org -site:youtube.com"
             + " -site:wikipedia.org -site:wiktionary.org";

console.log("A. the shim, with __TAURI__ already there");
{
  const w = world(true); w.runShim();
  check("invoke wrapped", w.win.__TAURI__.core.invoke !== w.real);
  const p = w.win.__TAURI__.core.invoke("frank_search", { query: MOCK_Q });
  check("resolves", p && typeof p.then === "function");
  check("one navigation, to door one",
        w.nav.length === 1 && w.nav[0] === "x-web-search://?" + encodeURIComponent(MOCK_Q));
  check("five -site: exclusions survive",
        (decodeURIComponent(w.nav[0].slice(16)).match(/ -site:/g) || []).length === 5);
  check("the real invoke was not called", w.calls.length === 0);
  w.win.__TAURI__.core.invoke("sync_discover", { ms: 2500 });
  w.win.__TAURI__.core.invoke("audio_session_start");
  w.win.__TAURI__.core.invoke("google_sign_in", { url: "x" });
  check("every other command passes through with its arguments",
        w.calls.length === 3 && JSON.stringify(w.calls[0][1]) === '{"ms":2500}');
  check("and starts no navigation", w.nav.length === 1);
}
console.log("B. __TAURI__ arrives after the plugin script (tauri's real order)");
{
  const w = world(false); w.runShim();
  check("nothing to patch yet", w.win.__TAURI__ === undefined);
  w.win.__TAURI__ = { core: { invoke: w.real } };
  w.fire("doc", "DOMContentLoaded");
  check("patched at DOMContentLoaded", w.win.__TAURI__.core.invoke !== w.real);
  w.win.__TAURI__.core.invoke("frank_search", { query: "Gerontion" });
  check("the sheet still opens", w.nav[0] === "x-web-search://?Gerontion");
}
console.log("C. idempotent");
{
  const w = world(true); w.runShim();
  const once = w.win.__TAURI__.core.invoke;
  w.fire("doc", "DOMContentLoaded"); w.fire("win", "load"); w.runShim();
  check("one wrapper, never two", w.win.__TAURI__.core.invoke === once);
}
console.log("D. reader/lookup.js's own search(), verbatim");
{
  const w = world(true); w.runShim(); const api = w.consumer();
  const landed = api.search("Gerontion"); const last = api.last();
  check("the press lands", landed === true);
  check('how = "frank_search"', last.how === "frank_search");
  check("door one, not window.open, not WebviewWindow",
        w.nav.length === 1 && w.opened.length === 0);
  check("lookup.js still records google.com/search?q=",
        last.url === "https://www.google.com/search?q=Gerontion");
}
console.log("E. outside Frank (a browser, the design bench)");
{
  const w = world(false); w.runShim(); w.fire("doc", "DOMContentLoaded"); w.fire("win", "load");
  const api = w.consumer(); api.search("Gerontion");
  check("lookup.js's third landing, untouched",
        w.opened.length === 1 && w.opened[0] === "https://www.google.com/search?q=Gerontion");
  check("nothing went to door one", w.nav.length === 0);
}
console.log("F. an empty query opens nothing");
{
  const w = world(true); w.runShim();
  w.win.__TAURI__.core.invoke("frank_search", { query: "" }).catch(() => {});
  check("no navigation", w.nav.length === 0);
}
console.log(`\n${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
