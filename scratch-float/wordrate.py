#!/usr/bin/env python3
"""wordrate.py -- the number every float road has to sustain.

Reads the REAL timings the reader plays (books/<slug>/timings/*.json) and
prints, per book and overall: words, seconds, words/second, and the
percentiles of the gap between one word's start and the next's. That gap is
the update period a float has to hit: (a) a canvas repaint, (b) a
CMSampleBuffer enqueue, (c) an MPNowPlayingInfoCenter write.

Run:  python3 scratch-float/wordrate.py <path-to-TTSTV>
"""
import json, sys, statistics as st
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
books = root / "books"
rows, all_gaps = [], []
for tdir in sorted(books.glob("*/timings")):
    gaps, words, span = [], 0, 0.0
    for f in sorted(tdir.glob("*.json")):
        try:
            d = json.loads(f.read_text())
        except Exception:
            continue
        starts = []
        for sent in d.values():
            for w in sent.get("words", []):
                if w.get("start") is not None:
                    starts.append(float(w["start"]))
        starts.sort()
        words += len(starts)
        if len(starts) > 1:
            span += starts[-1] - starts[0]
            gaps += [b - a for a, b in zip(starts, starts[1:]) if 0 < b - a < 5]
    if not gaps:
        continue
    all_gaps += gaps
    gaps.sort()
    q = lambda p: gaps[min(len(gaps) - 1, int(p * len(gaps)))]
    rows.append((tdir.parent.name, words, round(span, 1), round(words / span, 3) if span else 0,
                 round(st.median(gaps) * 1000, 1), round(q(.10) * 1000, 1), round(q(.01) * 1000, 1),
                 round(min(gaps) * 1000, 1)))

w = max([len(r[0]) for r in rows] + [4])
print(f"{'book':<{w}}  {'words':>7} {'sec':>9} {'w/s':>7} {'median':>8} {'p10':>7} {'p01':>7} {'min':>7}")
for r in rows:
    print(f"{r[0]:<{w}}  {r[1]:>7} {r[2]:>9} {r[3]:>7} {r[4]:>8} {r[5]:>7} {r[6]:>7} {r[7]:>7}")
if all_gaps:
    all_gaps.sort()
    q = lambda p: all_gaps[min(len(all_gaps) - 1, int(p * len(all_gaps)))] * 1000
    print(f"\ncorpus  n={len(all_gaps)} gaps  median={st.median(all_gaps)*1000:.1f} ms"
          f"  p10={q(.10):.1f}  p01={q(.01):.1f}  min={min(all_gaps)*1000:.1f}"
          f"  -> {1/st.median(all_gaps):.2f} words/s median, {1/q(.01)*1000:.2f} words/s at p01")
    for wpm in (150, 184.615, 300, 900):
        print(f"  pace {wpm:g} wpm -> {60000/wpm:.1f} ms a word -> {wpm/60:.2f} updates/s")
