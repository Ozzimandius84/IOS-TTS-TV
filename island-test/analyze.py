#!/usr/bin/env python3
"""Island Test: line the phone's log up with the Mac's recording of the
phone's screen and print the per-rate table.

    python3 analyze.py results/island-log.csv results/screen/screen.csv > results/summary.md

"changes seen" = moments the island strip of the screen visibly changed
(a burst of changing frames counts once; a new burst needs 0.15 s of
stillness before it). That is what a person would see as "the word moved".
"""
import csv
import os
import statistics
import sys

ORDER = ["sentence", "1/s", "2/s", "3/s", "4/s"]
NAMES = {"sentence": "1 per sentence (every 4 s)", "1/s": "1 per second", "2/s": "2 per second",
         "3/s": "3 per second", "4/s": "4 per second"}
QUIET = 0.15     # seconds of stillness that separate two changes
STILL = 2.0      # "froze" = no change for longer than this (or 2 intervals, if longer) while words were being sent
INTERVAL = {"sentence": 4.0, "1/s": 1.0, "2/s": 0.5, "3/s": 1 / 3, "4/s": 0.25}


def main(log_path, screen_path):
    rows = list(csv.DictReader(open(log_path, newline="")))
    wall0 = None
    sent, content, window, states, info = {}, {}, {}, [], []
    for r in rows:
        ms, ev, seq, ph, det = int(r["ms"]), r["event"], int(r["seq"]), r["phase"], r["detail"]
        t = ms / 1000
        if ev == "info" and det.startswith("wall "):
            wall0 = float(det.split()[1])
        if ev == "sent":
            sent[seq] = (t, ph)
        elif ev == "content":
            content.setdefault(seq, t)
        elif ev == "phase_start":
            window[ph] = [t, None]
        elif ev == "phase_end" and ph in window:
            window[ph][1] = t
        elif ev == "state":
            states.append((t, det))
        elif ev in ("info", "error", "run_start", "run_end"):
            info.append(f"{t:7.1f}s  {ev} {det}".rstrip())

    # screen: wall seconds -> seconds since the phone's launch
    changes, thr, nframes = [], None, 0
    if screen_path and os.path.exists(screen_path) and wall0 is not None:
        frames = [(float(r["wall"]) - wall0, float(r["diff"])) for r in csv.DictReader(open(screen_path))]
        nframes = len(frames)
        diffs = sorted(d for _, d in frames)
        if diffs:
            floor = diffs[len(diffs) // 2]
            thr = max(1.0, 4 * floor)
            last_change = -1e9
            for t, d in frames:
                if d > thr:
                    if t - last_change > QUIET:
                        changes.append(t)
                    last_change = t

    def in_front(a, b):
        front, since, tot = False, 0.0, 0.0
        for t, s in states + [(b, "_end")]:
            if front:
                tot += max(0.0, min(t, b) - max(since, a))
            if s == "foreground":
                front, since = True, t
            elif s == "background":
                front = False
        return tot

    out = []
    if not changes:
        out.append("**The screen recording gave no changes, so the island was not measured.** "
                   "See results/run.log for what the recorder said.\n")
    out.append("| rate | sent | changes seen in the island | median gap | longest gap | first froze (still > 2 s) | ActivityKit said updated | app open during it |")
    out.append("|---|---|---|---|---|---|---|---|")
    for ph in ORDER:
        if ph not in window or window[ph][1] is None:
            continue
        a, b = window[ph]
        n_sent = sum(1 for _, p in sent.values() if p == ph)
        seen = [t for t in changes if a <= t < b + 0.5]
        gaps = [y - x for x, y in zip(seen, seen[1:])]
        edges = [a] + seen + [b]
        longest = max(y - x for x, y in zip(edges, edges[1:]))
        froze = next((x - a for x, y in zip(edges, edges[1:]) if y - x > max(STILL, 2 * INTERVAL[ph])), None)
        n_content = sum(1 for s, t in content.items() if s in sent and sent[s][1] == ph)
        front = in_front(a, b)
        med = f"{statistics.median(gaps):.2f} s" if gaps else "–"
        fz = "never" if froze is None else f"after {froze:.0f} s"
        fr = f"{front:.0f} s" if front >= 0.5 else "no"
        out.append(f"| {NAMES[ph]} | {n_sent} | {len(seen)} ({100 * len(seen) // max(n_sent, 1)}%) | {med} | "
                   f"{longest:.1f} s | {fz} | {n_content} | {fr} |")
    out.append("")
    out.append(f"Screen frames recorded: {nframes}; change threshold {thr if thr is None else round(thr, 2)}. "
               "Gaps include about 0.1 s of cable-mirroring lag, the same for every word.")
    rests = []
    for p, q in zip(ORDER, ORDER[1:]):
        if p in window and q in window and window[p][1] is not None:
            n = sum(1 for t in changes if window[p][1] + 0.5 <= t < window[q][0])
            rests.append(f"after {p}: {n}")
    out.append("Changes seen during the 10 s rests (should be 0 or 1 -- a late catch-up shows here): " + ", ".join(rests))
    out.append("App state changes: " + (", ".join(f"{t:.1f}s {s}" for t, s in states) or "none"))
    out.append("")
    out.append("```")
    out.extend(info)
    out.append("```")
    print("\n".join(out))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
