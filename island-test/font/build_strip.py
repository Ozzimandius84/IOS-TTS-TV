#!/usr/bin/env python3
"""Island Test, run 8 -- the strip fonts.

Runs 5-7 showed the island will not let a live clock hide anything (a timer
mask draws nothing; a timer drawn over with destination-out erases nothing).
What it DOES do (run 4) is draw a live clock in our own font, one character
at a time, ~50 times a second, for minutes. So run 8 only DRAWS clocks.

Each word is three clocks, all starting at that word's moment and stacked in
one place (the newest on top). A clock reading all zeros draws nothing, so
nothing of a word exists before its moment; after it, every digit 1-9 draws:

  IslandGate.ttf      a black block    -> covers the word before it
  IslandStrip.ttf     the ink of ALL the test's words in one row
  IslandStripRed.ttf  just their red letters (Frank's rule)

The strip is shifted left by word_index x slot inside a slot-wide window that
clips it, so each word's clock shows only its own word. Every glyph has zero
width, so all the clock's characters land on the same spot.

    python3 build_strip.py <base serif .ttf> <words.json> <out dir>
"""
import json
import re
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

UPM = 200          # small units so a row of 30 word slots fits 16-bit coordinates
SLOT = 4.6         # em per word slot (the island's word width, as in run 4)
PIVOT = 1.9        # em from the slot's left edge to the centre of the red letter
DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
LETTER = re.compile(r"[A-Za-zÀ-ɏ0-9']")


def orp(w):  # Frank's rule, reader/wordview.js
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


def build(base_path, words, out_path, family, which):
    base = TTFont(base_path)
    gs, cmap, hmtx = base.getGlyphSet(), base.getBestCmap(), base["hmtx"]
    sc = UPM / base["head"].unitsPerEm
    # The period's width ("lead") is longer than the whole strip, so the digits
    # BEFORE the period (minutes, seconds) draw their copy of the strip entirely
    # out of the window, and only the hundredths digits after it count.
    lead = (len(words) + 1) * SLOT * UPM
    pen = TTGlyphPen(None)
    for i, w in enumerate(words):
        piv = pivot_index(w)
        # x of the pivot's centre within the word
        x, pc = 0.0, 0.0
        for j, ch in enumerate(w):
            g = cmap.get(ord(ch))
            if g is None:
                continue
            if j == piv:
                pc = x + hmtx[g][0] * sc / 2
            x += hmtx[g][0] * sc
        x = i * SLOT * UPM + PIVOT * UPM - pc
        for j, ch in enumerate(w):
            g = cmap.get(ord(ch))
            if g is None:
                continue
            if (which == "red") == (j == piv):
                rec = DecomposingRecordingPen(gs)
                gs[g].draw(rec)
                rec.replay(TransformPen(pen, (sc, 0, 0, sc, int(round(x - lead)), 0)))
            x += hmtx[g][0] * sc
    strip = pen.glyph()

    names = [".notdef", "space", *DIGITS, "colon", "period", "hyphen", "comma", "strip"]
    glyphs = {n: TTGlyphPen(None).glyph() for n in names}
    glyphs["strip"] = strip
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    cm = {32: "space", 58: "colon", 46: "period", 45: "hyphen", 44: "comma", 0x2212: "hyphen"}
    cm.update({48 + d: DIGITS[d] for d in range(10)})
    fb.setupCharacterMap(cm)
    # every digit 1-9 draws the strip: make them components of it
    from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
    fb.setupGlyf(glyphs)
    glyf = fb.font["glyf"]
    for d in DIGITS[1:]:
        g = Glyph()
        c = GlyphComponent()
        c.glyphName, c.x, c.y, c.flags = "strip", 0, 0, 0x4   # ROUND_XY_TO_GRID
        g.numberOfContours, g.components = -1, [c]
        glyf[d] = g
    metrics = {}
    for n in names:
        glyf[n].recalcBounds(glyf)
        # only the period has width (longer than the strip); see build_gate.py -- run 8 found
        # zero-width text is not drawn. The strip is drawn that far to the LEFT of
        # its origin so, after the period, word 0 lands at the text's left edge.
        metrics[n] = (int(round((len(words) + 1) * SLOT * UPM)) if n == "period" else 0, getattr(glyf[n], "xMin", 0))
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=int(0.95 * UPM), descent=int(-0.3 * UPM))
    fb.setupNameTable({"familyName": family, "styleName": "Regular",
                       "psName": family + "-Regular", "fullName": family + " Regular"})
    fb.setupOS2(sTypoAscender=int(0.95 * UPM), sTypoDescender=int(-0.3 * UPM),
                usWinAscent=int(1.2 * UPM), usWinDescent=int(0.4 * UPM))
    fb.setupPost()
    fb.save(out_path)


if __name__ == "__main__":
    base, words_json, out = sys.argv[1:4]
    words = json.load(open(words_json))
    build(base, words, f"{out}/IslandStrip.ttf", "IslandStrip", "ink")
    build(base, words, f"{out}/IslandStripRed.ttf", "IslandStripRed", "red")
    print(f"strip fonts: {len(words)} words, row {len(words) * SLOT:.0f} em")
