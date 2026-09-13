/* drops.mjs -- what a float repainted at R Hz actually shows.

   Two numbers, not one. `never` is the count of words the reader never sees at
   all (the 6 Sep table). `late` is the one the 6 Sep table did not print: how
   long the WRONG word stands on the float after the audio has moved on. A road
   can score 0 never and still be a bad float, because the eye is on it.

   Uses the SAME wordclock.js the page and probe-b use -- indexAt is the rule.
   node drops.mjs <TTSTV repo>                                              */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const repo = process.argv[2] || ".";
const ctx = { };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("./wordclock.js", import.meta.url), "utf8"), ctx);
const WordClock = ctx.WordClock;

const REAL = [                    /* the only alignments that are not the 350 ms divider */
  ["eclogues-en", "c001"], ["poems", "c002"], ["poems", "c003"],
  ["poems", "c018"], ["poems", "c021"],
];
const RATES = [60, 30, 10, 4, 2, 1];

function timelineOf(slug, cid) {
  const raw = JSON.parse(readFileSync(`${repo}/books/${slug}/timings/${cid}.json`, "utf8"));
  const ws = [];
  for (const v of Object.values(raw)) for (const w of (v.words || []))
    ws.push({ t: +w.start || 0, e: +w.end || 0, w: w.id });
  ws.sort((a, b) => a.t - b.t);
  return ws;
}

/* staleness: at a sampler of period p, a word that starts at t is first drawn
   at the next tick, so it is late by (ceil(t/p)*p - t) -- and the PREVIOUS word
   is what stands there meanwhile. max is p by construction; what matters is how
   much of the word's own life that eats. */
function measure(tl, hz) {
  const c = WordClock.make(tl);
  const p = 1 / hz;
  const shown = new Set(c.sample(p, 0, tl[tl.length - 1].t + 0.001));
  let never = 0, eaten = [], lates = [];
  for (let i = 0; i < tl.length; i++) {
    if (!shown.has(i)) { never++; continue; }
    const late = Math.ceil(tl[i].t / p) * p - tl[i].t;
    const life = (i + 1 < tl.length ? tl[i + 1].t : tl[i].e) - tl[i].t;
    lates.push(late);
    if (life > 0) eaten.push(late / life);
  }
  const q = (a, x) => { a = a.slice().sort((u, v) => u - v); return a[Math.min(a.length - 1, Math.floor(x * a.length))] || 0; };
  return { never, pct: 100 * never / tl.length,
           lateP95: q(lates, .95) * 1000, lateMax: Math.max(0, ...lates) * 1000,
           eatenP95: 100 * q(eaten, .95) };
}

let corpus = [];
console.log(`${"chapter".padEnd(20)} ${"words".padStart(6)} ${"Hz".padStart(4)} ${"never".padStart(6)} ${"%".padStart(6)} ${"late p95".padStart(9)} ${"late max".padStart(9)} ${"life eaten p95".padStart(15)}`);
for (const [slug, cid] of REAL) {
  const tl = timelineOf(slug, cid);
  corpus = corpus.concat(tl.map((w, i) => i ? w.t - tl[i - 1].t : null).filter(g => g && g > 0 && g < 5));
  for (const hz of RATES) {
    const m = measure(tl, hz);
    console.log(`${(slug + "/" + cid).padEnd(20)} ${String(tl.length).padStart(6)} ${String(hz).padStart(4)} ${String(m.never).padStart(6)} ${m.pct.toFixed(1).padStart(6)} ${m.lateP95.toFixed(1).padStart(9)} ${m.lateMax.toFixed(1).padStart(9)} ${(m.eatenP95.toFixed(1) + "%").padStart(15)}`);
  }
}
corpus.sort((a, b) => a - b);
const q = x => corpus[Math.min(corpus.length - 1, Math.floor(x * corpus.length))] * 1000;
console.log(`\nreal-aligned gaps n=${corpus.length}  min=${(corpus[0] * 1000).toFixed(0)}ms  p01=${q(.01).toFixed(0)}  p05=${q(.05).toFixed(0)}  median=${q(.5).toFixed(0)}  -> ${(1 / q(.5) * 1000).toFixed(2)} words/s median, ${(1 / q(.01) * 1000).toFixed(1)}/s at p01`);
