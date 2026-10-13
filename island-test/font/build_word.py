#!/usr/bin/env python3
"""Island Test, run 14 -- one word as a font.

Digits 1-9 all draw the SAME word (here "truth"), ink + Frank's red letter via
colour layers; 0, ':' and '.' draw nothing. A timer "0:00" shows nothing; from
"0:01" on, its first non-zero digit shows the word (a one-word-wide frame clips
any second copy). The word glyphs have ZERO advance (run 15), so a timer's
several copies stack on one spot and nothing overflows the one-word box.

    python3 build_word.py <base serif .ttf> <word> <out dir>
"""
import re
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

RED = (1.0, 0x6a / 255, 0x5e / 255, 1.0)
DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
LETTER = re.compile(r"[A-Za-zÀ-ɏ0-9']")


def orp(w):
    n = len(re.sub(r"[^A-Za-zÀ-ɏ0-9']", "", w)) or len(w)
    return 0 if n <= 1 else 1 if n <= 5 else 2 if n <= 9 else 3 if n <= 13 else 4


def pivot_index(w):
    k, seen = orp(w), -1
    for i, c in enumerate(w):
        if LETTER.match(c):
            seen += 1
            if seen == k:
                return i
    return min(k, len(w) - 1)


def main(base_path, word, out):
    base = TTFont(base_path)
    gs, cmap, hmtx = base.getGlyphSet(), base.getBestCmap(), base["hmtx"]
    upm = 1000
    sc = upm / base["head"].unitsPerEm
    piv = pivot_index(word)

    def draw(which):
        pen, x = TTGlyphPen(None), 0.0
        for i, ch in enumerate(word):
            g = cmap.get(ord(ch))
            if g is None:
                continue
            if which == "all" or (which == "red") == (i == piv):
                rec = DecomposingRecordingPen(gs)
                gs[g].draw(rec)
                rec.replay(TransformPen(pen, (sc, 0, 0, sc, int(round(x)), 0)))
            x += hmtx[g][0] * sc
        return pen.glyph(), int(round(x))

    names = [".notdef", "space", *DIGITS, "colon", "period", "w.ink", "w.red"]
    glyphs = {n: TTGlyphPen(None).glyph() for n in names}
    metrics = {n: (0, 0) for n in names}
    metrics[".notdef"] = (500, 0)
    all_g, adv = draw("all")
    # Run 15: ZERO advance on the word glyphs, so every copy a timer draws lands on
    # the same spot and the text is never wider than one word (run 14: two copies
    # overflowed the box and SwiftUI truncated them to an ellipsis).
    for d in DIGITS[1:]:
        glyphs[d], metrics[d] = draw("all")[0], (0, 0)
    glyphs["w.ink"], metrics["w.ink"] = draw("ink")[0], (0, 0)
    glyphs["w.red"], metrics["w.red"] = draw("red")[0], (0, 0)
    colr = {d: [("w.ink", 0xFFFF), ("w.red", 0)] for d in DIGITS[1:]}

    fb = FontBuilder(upm, isTTF=True)
    fb.setupGlyphOrder(names)
    cm = {32: "space", 58: "colon", 46: "period"}
    cm.update({48 + i: DIGITS[i] for i in range(10)})
    fb.setupCharacterMap(cm)
    fb.setupGlyf(glyphs)
    glyf = fb.font["glyf"]
    for n in names:
        glyf[n].recalcBounds(glyf)
        metrics[n] = (metrics[n][0], getattr(glyf[n], "xMin", 0))
    fb.setupHorizontalMetrics(metrics)
    hh, os2 = base["hhea"], base["OS/2"]
    fb.setupHorizontalHeader(ascent=int(hh.ascent * sc), descent=int(hh.descent * sc))
    fb.setupNameTable({"familyName": "IslandWord", "styleName": "Regular",
                       "psName": "IslandWord-Regular", "fullName": "IslandWord Regular"})
    fb.setupOS2(sTypoAscender=int(os2.sTypoAscender * sc), sTypoDescender=int(os2.sTypoDescender * sc),
                usWinAscent=int(os2.usWinAscent * sc), usWinDescent=int(os2.usWinDescent * sc))
    fb.setupPost()
    fb.setupCOLR(colr)
    fb.setupCPAL([[RED]])
    fb.save(f"{out}/IslandWord.ttf")
    print(f"IslandWord.ttf: digits 1-9 = {word!r}, red letter {word[piv]!r}, advance {adv}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
