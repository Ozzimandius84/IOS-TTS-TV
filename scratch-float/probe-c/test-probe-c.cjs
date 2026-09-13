/* test-probe-c.cjs -- everything about probe-c that can be true or false with
   no phone, no simulator and no browser. Run it before spending a press.

     node scratch-float/probe-c/test-probe-c.cjs <TTSTV repo>                */
const fs = require("fs"), path = require("path"), vm = require("vm");
const here = __dirname, repo = process.argv[2] || path.join(process.env.HOME, "mnt/TTSTV");
let pass = 0, fail = 0;
const ok = (n, c, extra) => { c ? pass++ : fail++;
  console.log((c ? "  ok   " : "  FAIL ") + n + (extra ? "   " + extra : "")); };

/* 1 · the two ends must share ONE rule for "which word is it" ------------- */
const a = fs.readFileSync(path.join(here, "wordclock.js"), "utf8");
const b = fs.readFileSync(path.join(here, "..", "wordclock.js"), "utf8");
ok("wordclock.js is the parent's, byte for byte", a === b,
   a === b ? "" : "probe-c would count a different word than probe-b");

const ctx = vm.createContext({}); vm.runInContext(a, ctx);
const WordClock = ctx.WordClock;

/* 2 · the timeline is the READER'S words, not a re-cut of the text -------- */
const TL = JSON.parse(fs.readFileSync(path.join(here, "timeline.json"), "utf8"));
const src = fs.readFileSync(path.join(repo, "reader/listen.js"), "utf8");
function lift(name) {
  const i = src.indexOf(`function ${name}(`); let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++;
    else if (src[k] === "}" && --d === 0) return src.slice(i, k + 1); }
}
const tokenise = eval(`(${lift("tokenise")})`);
const paraIndexOf = eval(`(${lift("paraIndexOf")})`);
const m = /^([a-z0-9+-]+)\/(c\d+)/.exec(TL.source) || [];
const slug = m[1], cid = m[2];
const paras = fs.readFileSync(`${repo}/books/${slug}/chapters/${cid}.txt`, "utf8")
  .split("\n\n").filter(s => s.trim() !== "");
const raw = JSON.parse(fs.readFileSync(`${repo}/books/${slug}/timings/${cid}.json`, "utf8"));
const sents = Object.entries(raw).map(([id, v]) => ({ id, start: +v.start || 0, words: v.words || [] }))
  .sort((x, y) => x.start - y.start);
let rebuilt = [];
const groups = new Map();
for (const s of sents) { const i = paraIndexOf(s.id); if (i < 0) continue;
  if (!groups.has(i)) groups.set(i, []); groups.get(i).push(s); }
for (const i of [...groups.keys()].sort((x, y) => x - y)) {
  const g = groups.get(i), text = paras[i]; if (text == null) continue;
  const toks = tokenise(text, 0, text.length);
  if (g.reduce((n, s) => n + s.words.length, 0) !== toks.length) continue;
  let k = 0; for (const s of g) for (const w of s.words) {
    const t = toks[k++]; rebuilt.push({ t: +(+w.start).toFixed(3), w: text.slice(t.s, t.e) }); }
}
rebuilt.sort((x, y) => x.t - y.t);
const same = rebuilt.length === TL.timeline.length &&
  rebuilt.every((r, i) => r.w === TL.timeline[i].w && Math.abs(r.t - TL.timeline[i].t) < 1e-6);
ok(`timeline.json is ${slug}/${cid} by listen.js's own tokenise`, same,
   `${TL.timeline.length} words vs ${rebuilt.length} rebuilt`);
ok("the chapter is really aligned, not the 350 ms divider", (() => {
  const g = TL.timeline.slice(1).map((w, i) => w.t - TL.timeline[i].t).filter(x => x > 0);
  return g.filter(x => Math.abs(x * 1000 - 350) < 1).length / g.length < 0.5;
})(), "a stub book flatters every road");

/* 3 · the claim the probe is being pressed to test ------------------------ */
const c = WordClock.make(TL.timeline);
for (const hz of [60, 30]) {
  const shown = new Set(c.sample(1 / hz, 0, TL.span));
  const missed = TL.timeline.filter((w, i) => !shown.has(i)).length;
  ok(`a PERIODIC ${hz} Hz painter never misses a word`, missed === 0, `missed ${missed}`);
}
for (const hz of [4, 1]) {
  const shown = new Set(c.sample(1 / hz, 0, TL.span));
  const missed = TL.timeline.filter((w, i) => !shown.has(i)).length;
  ok(`a ${hz} Hz painter DOES miss words (so the float is not a lock-screen write)`,
     missed > 0, `missed ${missed} of ${TL.timeline.length} (${(100 * missed / TL.timeline.length).toFixed(1)}%)`);
}

/* 4 · indexAt is "the last word whose start <= s", at the edges ----------- */
const t3 = TL.timeline[3].t;
ok("indexAt is inclusive at a word's own start", c.indexAt(t3) === 3, `${c.indexAt(t3)}`);
ok("indexAt is the PREVIOUS word an epsilon before", c.indexAt(t3 - 1e-6) === 2, `${c.indexAt(t3 - 1e-6)}`);
ok("indexAt is -1 before the first word", c.indexAt(TL.timeline[0].t - 0.001) === -1);
ok("indexAt is the last word past the end", c.indexAt(TL.span + 60) === TL.timeline.length - 1);

/* 5 · the page under test actually contains the four counters ------------- */
const html = fs.readFileSync(path.join(here, "float.html"), "utf8");
for (const k of ["raf", "timer", "tu", "worklet"])
  ok(`float.html counts the ${k} clock separately`, new RegExp(`AWAY\\.${k}|bump\\("${k}"\\)`).test(html));
ok("float.html closes its <script>", /<\/script>\s*$/.test(html),
   "an unterminated <script> is never executed — Chromium ran nothing, silently");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
