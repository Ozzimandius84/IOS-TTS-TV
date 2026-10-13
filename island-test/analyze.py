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


def clock(log_path, screen_path):
    """Run 4: the app sends nothing; does the island's own clock keep drawing words?
    Left of the camera = the hundredths stopwatch, right = the whole-second timer,
    both in the counting font."""
    rows = list(csv.DictReader(open(log_path, newline="")))
    wall0, states, info, window, sent, word_window = None, [], [], None, 0, None
    for r in rows:
        t, ev, det = int(r["ms"]) / 1000, r["event"], r["detail"]
        if ev == "info" and det.startswith("wall "):
            wall0 = float(det.split()[1])
        if ev == "info" and det.startswith("word_window "):
            word_window = tuple(float(x) for x in det.split()[1:3])
        if ev == "phase_start" and r["phase"] in ("clock", "words"):
            window = [t, None]
        if ev == "phase_end" and r["phase"] in ("clock", "words") and window:
            window[1] = t
        if ev == "state":
            states.append((t, det))
        if ev == "sent":
            sent += 1
        if ev in ("info", "error", "run_start", "run_end"):
            info.append(f"{t:7.1f}s  {ev} {det}".rstrip())
    frames = [(float(r["wall"]) - wall0, float(r["left"]), float(r["right"]))
              for r in csv.DictReader(open(screen_path))]
    # the stretches the app was away (the island is only shown then)
    away, since = [], None
    for t, st in states:
        if st == "background" and since is None:
            since = t
        elif st == "foreground" and since is not None:
            away.append((since, t)); since = None
    if since is not None:
        away.append((since, window[1] if window and window[1] else frames[-1][0]))
    away = [(a + 1.0, b) for a, b in away if b - a > 3]   # skip the island's own opening animation

    alive = [r["detail"] for r in rows if r["event"] == "alive"]
    out = ["| side of the camera | what is there | seconds away | changes seen | changes a second | median gap | longest gap |",
           "|---|---|---|---|---|---|---|"]
    sides = (((1, "left", "check: truth at 15 s"), (2, "right", "the words")) if word_window else
             ((1, "left", "hundredths stopwatch"), (2, "right", "whole-second timer")))
    for col, label, clk in sides:
        thr = 0.2   # fixed: a clock changing every frame lifts a self-set threshold above itself (run 4)
        changes, last = [], -1e9
        for f in frames:
            if f[col] > thr:
                if f[0] - last > 0.05:
                    changes.append(f[0])
                last = f[0]
        seen, gaps, secs = 0, [], 0.0
        longest = 0.0
        for a, b in away:
            c = [t for t in changes if a <= t < b]
            seen += len(c)
            secs += b - a
            gaps += [y - x for x, y in zip(c, c[1:])]
            edges = [a] + c + [b]
            longest = max([longest] + [y - x for x, y in zip(edges, edges[1:])])
        med = f"{statistics.median(gaps):.2f} s" if gaps else "–"
        out.append(f"| {label} | {clk} | {secs:.0f} | {seen} | {seen / max(secs, 1):.2f} | {med} | {longest:.1f} s |")
    if word_window:
        a, b = word_window
        frames_in = [f for f in frames if a <= f[0] < b]
        ch, last = [], -1e9
        for f in frames_in:
            if f[2] > 0.2:
                if f[0] - last > 0.1:
                    ch.append(f[0])
                last = f[0]
        gaps = [y - x for x, y in zip(ch, ch[1:])]
        n_words = round((b - a) * 3)   # run 18: 3 a second
        out.append("")
        out.append(f"**Words window {a:.0f}-{b:.0f} s ({n_words} words at 3 a second), right of the camera:** "
                   f"{len(ch)} changes seen"
                   + (f", median gap {statistics.median(gaps):.2f} s, longest {max(gaps):.2f} s." if gaps else "."))
    out.append("")
    out.append(f"Updates the app sent during the run: {sent} (should be 0). Away: "
               + ", ".join(f"{a:.0f}-{b:.0f} s" for a, b in away))
    out.append("App state changes: " + (", ".join(f"{t:.1f}s {s}" for t, s in states) or "none"))
    if alive:
        out.append(f"App heartbeats: {len(alive)} (every 5 s); last: {alive[-1]}")
    out.append("Look at results/screen/frames/ to see WHAT was drawn: words in Frank's red-letter "
               "style mean the font worked; digits mean it did not match the clock's format.")
    out.append("")
    out.append("```")
    out.extend(info)
    out.append("```")
    print("\n".join(out))


if __name__ == "__main__":
    lp = sys.argv[1]
    if any(r["phase"] in ("clock", "words") for r in csv.DictReader(open(lp, newline=""))):
        clock(lp, sys.argv[2])
    else:
        main(lp, sys.argv[2] if len(sys.argv) > 2 else None)
