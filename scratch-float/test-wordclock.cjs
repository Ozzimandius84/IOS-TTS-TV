/* node scratch-float/test-wordclock.cjs -- Cowork container or the bridge VM.
   No browser, no phone. Evals wordclock.js VERBATIM (never retyped) and runs it
   against the real timings in timeline.json (books/poems c002, MMS_FA aligned,
   0% uniform gaps). Prints the numbers §2 quotes. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "wordclock.js"), "utf8");
const ctx = { module: undefined }; vm.createContext(ctx); vm.runInContext(src, ctx);
const WordClock = ctx.WordClock;
const doc = JSON.parse(fs.readFileSync(path.join(__dirname, "timeline.json"), "utf8"));
const tl = doc.timeline, c = WordClock.make(tl);
let pass = 0, fail = 0;
const ok = (n, cond, saw) => { cond ? pass++ : (fail++, console.log("FAIL " + n + "  saw " + saw)); };

console.log(`timeline: ${doc.words} words, ${doc.span}s, ${(doc.words/doc.span).toFixed(3)} w/s`);
console.log(`source:   ${doc.source}\n`);
ok("before the first word is -1", c.indexAt(-0.001) === -1, c.indexAt(-0.001));
let bad = 0; for (let i = 0; i < tl.length; i++) if (c.indexAt(tl[i].t) !== i) bad++;
ok("every word's own start returns its index", bad === 0, bad + " wrong");
let rev = 0, prev = -2;
for (let s = 0; s <= doc.span; s += 0.001) { const i = c.indexAt(s); if (i < prev) rev++; prev = i; }
ok("never goes backwards over the whole span", rev === 0, rev + " reversals");

const span = tl[tl.length - 1].t;
console.log("what each road's update rate would actually show:");
for (const [name, hz] of [["60 Hz  CADisplayLink (b)", 60], ["30 Hz  captureStream (a)", 30],
                          ["10 Hz  timer", 10], [" 4 Hz  timer", 4], [" 1 Hz  Now Playing (c)", 1]]) {
  const seen = c.sample(1 / hz, 0, span), missed = tl.length - seen.length;
  console.log(`  ${name.padEnd(26)} ${String(seen.length).padStart(3)}/${tl.length} words drawn` +
              `   ${String(missed).padStart(3)} never drawn (${(100*missed/tl.length).toFixed(1)}%)`);
  if (hz >= 30) ok(name.trim() + " loses no word", missed === 0, missed);
}
const gaps = tl.slice(1).map((w, i) => (w.t - tl[i].t) * 1000).filter(g => g > 0).sort((a, b) => a - b);
const q = p => gaps[Math.floor(p * gaps.length)];
console.log(`\ngaps between consecutive words: n=${gaps.length}  min=${gaps[0].toFixed(0)}ms  ` +
            `p05=${q(.05).toFixed(0)}  median=${q(.5).toFixed(0)}  ` +
            `-> ${(1000/gaps[0]).toFixed(1)} words/s worst case, ${(1000/q(.5)).toFixed(2)} typical`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
