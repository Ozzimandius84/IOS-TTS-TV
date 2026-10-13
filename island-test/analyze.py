#!/usr/bin/env python3
"""Island Test: turn the phone's island-log.csv into the per-rate table.

    python3 analyze.py results/island-log.csv  > results/summary.md

"shown" = the widget drew that word in the island's compact region (the
word beside the camera). The lock-screen column is the same for the lock
screen / banner view. A word counts once, at the first time it was drawn.
"""
import csv
import statistics
import sys
from collections import defaultdict

ORDER = ["1/s", "2/s", "3/s", "4/s", "sentence"]


def main(path):
    rows = list(csv.DictReader(open(path, newline="")))
    sent = {}                       # seq -> (ms, phase)
    acked = {}                      # seq -> ms
    first = defaultdict(dict)       # region -> seq -> ms
    draws = defaultdict(int)        # region -> total draw calls
    darwin = defaultdict(int)       # region -> Darwin notifications heard (cross-check)
    window = {}                     # phase -> [start, end]
    states, info = [], []
    for r in rows:
        ms, ev, seq, ph = int(r["ms"]), r["event"], int(r["seq"]), r["phase"]
        if ev == "sent":
            sent[seq] = (ms, ph)
        elif ev == "acked":
            acked[seq] = ms
        elif ev.startswith("darwin_"):
            darwin[ev[7:]] += 1
        elif ev.startswith("drawn_"):
            reg = ev[6:]
            draws[reg] += 1
            first[reg].setdefault(seq, ms)
        elif ev == "phase_start":
            window[ph] = [ms, None]
        elif ev == "phase_end" and ph in window:
            window[ph][1] = ms
        elif ev == "state":
            states.append((ms, r["detail"]))
        elif ev in ("info", "error", "run_start", "run_end"):
            info.append(f"{ms/1000:7.1f}s  {ev} {r['detail']}".rstrip())

    # seconds the app was in front during each phase (tapping the island opens the app)
    def in_front(phase):
        w = window.get(phase)
        if not w or w[1] is None:
            return 0.0
        front, last, tot = False, 0, 0
        for ms, st in states + [(w[1], "_end")]:
            if front:
                a, b = max(last, w[0]), min(ms, w[1])
                tot += max(0, b - a)
            if st == "foreground":
                front, last = True, ms
            elif st == "background":
                front = False
            if ms >= w[1]:
                break
        return tot / 1000

    def ms_s(v):
        return "–" if v is None else f"{v/1000:.2f} s"

    def stats_for(region, phase):
        seqs = sorted(s for s, (_, p) in sent.items() if p == phase)
        shown = sorted(first[region][s] for s in seqs if s in first[region])
        gaps = [b - a for a, b in zip(shown, shown[1:])]
        # longest gap also counts phase start -> first shown and last shown -> phase end,
        # so a word that froze for the rest of the phase is not hidden
        w = window.get(phase, [None, None])
        edges = ([w[0]] if w[0] is not None else []) + shown + ([w[1]] if w[1] is not None else [])
        all_gaps = [b - a for a, b in zip(edges, edges[1:])]
        lat = [first[region][s] - sent[s][0] for s in seqs if s in first[region]]
        return dict(sent=len(seqs), shown=len(shown),
                    med_gap=statistics.median(gaps) if gaps else None,
                    max_gap=max(all_gaps) if all_gaps else None,
                    med_lat=statistics.median(lat) if lat else None)

    out = []
    if not any(draws.values()):
        out.append("**No widget draws were recorded, so this run measured nothing about the island.** "
                   "The info lines at the bottom say whether the widget could not write its file or never drew at all.\n")
    for region, label in (("c", "Dynamic Island (word beside the camera)"),
                          ("l", "Lock screen / banner view")):
        out.append(f"### {label}\n")
        out.append("| rate | sent | shown | median gap between shown words | longest gap | median delay sent → shown | app open during it |")
        out.append("|---|---|---|---|---|---|---|")
        for ph in ORDER:
            st = stats_for(region, ph)
            if not st["sent"]:
                continue
            name = "1 per sentence (every 4 s)" if ph == "sentence" else f"{ph[0]} per second"
            out.append(f"| {name} | {st['sent']} | {st['shown']} ({100*st['shown']//max(st['sent'],1)}%) | "
                       f"{ms_s(st['med_gap'])} | {ms_s(st['max_gap'])} | {ms_s(st['med_lat'])} | "
                       f"{'%.0f s' % in_front(ph) if in_front(ph) >= 0.5 else 'no'} |")
        out.append("")

    lat_ack = [acked[s] - sent[s][0] for s in sent if s in acked]
    out.append(f"Update calls returned: {len(lat_ack)} of {len(sent)}"
               + (f", median {statistics.median(lat_ack)} ms, slowest {max(lat_ack)} ms." if lat_ack else "."))
    out.append(f"Draw calls by region: " + ", ".join(f"{k}={v}" for k, v in sorted(draws.items()))
               + "  (c island compact, m island minimal, e island expanded, l lock screen)")
    out.append("Darwin notifications heard (cross-check): " + (", ".join(f"{k}={v}" for k, v in sorted(darwin.items())) or "none"))
    out.append("")
    out.append("Phase windows (s since launch): " + ", ".join(
        f"{p} {w[0]/1000:.1f}–{(w[1] or 0)/1000:.1f}" for p, w in window.items()))
    out.append("App state changes: " + (", ".join(f"{ms/1000:.1f}s {s}" for ms, s in states) or "none"))
    out.append("")
    out.append("```")
    out.extend(info)
    out.append("```")
    print("\n".join(out))


if __name__ == "__main__":
    main(sys.argv[1])
