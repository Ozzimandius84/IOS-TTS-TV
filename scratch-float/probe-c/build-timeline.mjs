/* build-timeline.mjs -- the probe's timeline, built by the READER'S OWN rule.

   `tokenise` and `paraIndexOf` are lifted VERBATIM out of reader/listen.js at
   run time (never re-typed here): the probe must agree with the page about
   which word is word N, or every drop count it prints is about a different
   book. Writes timeline.json in the shape probe-b and probe-web already read:
   { source, words, span, timeline:[{t,e,w}] }.

   node build-timeline.mjs <TTSTV repo> <slug> <cid>            */
import { readFileSync, writeFileSync } from "node:fs";

const [repo, slug, cid] = process.argv.slice(2);
if (!cid) { console.error("usage: node build-timeline.mjs <repo> <slug> <cid>"); process.exit(2); }

/* ---- the two functions, verbatim, out of the shipping file --------------- */
const src = readFileSync(`${repo}/reader/listen.js`, "utf8");
function lift(name) {
  const i = src.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`listen.js has no ${name}`);
  let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}" && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error(`unbalanced ${name}`);
}
const tokenise   = eval(`(${lift("tokenise")})`);
const paraIndexOf = eval(`(${lift("paraIndexOf")})`);

/* ---- the same two small files the page fetches --------------------------- */
const paras = readFileSync(`${repo}/books/${slug}/chapters/${cid}.txt`, "utf8")
  .split("\n\n").filter(s => s.trim() !== "");
const raw = JSON.parse(readFileSync(`${repo}/books/${slug}/timings/${cid}.json`, "utf8"));
const sentences = Object.entries(raw)
  .map(([id, v]) => ({ id, start: +v.start || 0, end: +v.end || 0,
                       words: (v.words || []).map(w => ({ id: w.id, start: +w.start || 0, end: +w.end || 0 })) }))
  .sort((a, b) => a.start - b.start);

/* ---- listen.js's grouping and its COUNT CHECK, same refusal rule --------- */
const groups = new Map();
for (const s of sentences) {
  const i = paraIndexOf(s.id);
  if (i < 0) continue;
  if (!groups.has(i)) groups.set(i, []);
  groups.get(i).push(s);
}
const out = [];
let exact = 0, refused = 0;
for (const i of [...groups.keys()].sort((a, b) => a - b)) {
  const sents = groups.get(i), text = paras[i];
  if (text == null) { refused += sents.length; continue; }
  const toks = tokenise(text, 0, text.length);
  const total = sents.reduce((n, s) => n + s.words.length, 0);
  if (total !== toks.length) { refused += sents.length; continue; }
  let k = 0;
  for (const s of sents) for (const w of s.words) {
    const tk = toks[k++];
    out.push({ t: +w.start.toFixed(3), e: +w.end.toFixed(3), w: text.slice(tk.s, tk.e) });
  }
  exact++;
}
out.sort((a, b) => a.t - b.t);
const span = out.length ? +(out[out.length - 1].e - out[0].t).toFixed(3) : 0;
writeFileSync(new URL("./timeline.json", import.meta.url),
  JSON.stringify({ source: `${slug}/${cid} — reader/listen.js tokenise, ${exact} paragraphs exact, ${refused} refused`,
                   words: out.length, span, timeline: out }, null, 1));
console.log(`${slug}/${cid}: ${out.length} words, ${span}s, paragraphs ${exact} exact / ${refused} refused`);
