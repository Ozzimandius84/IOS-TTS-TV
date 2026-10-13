#!/usr/bin/env python3
"""Island Test, run 16 -- the cover font. Digits 1-9 = a solid block 4.6 em wide
with ZERO advance (as the word glyphs, run 15); 0, ':' and '.' = nothing. Drawn
in black on its own timer it hides whatever is stacked below it from that moment.
    python3 build_cover.py <out dir>
"""
import sys
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]

def block():
    p = TTGlyphPen(None)
    p.moveTo((0, -300)); p.lineTo((0, 1000)); p.lineTo((4600, 1000)); p.lineTo((4600, -300)); p.closePath()
    return p.glyph()

names = [".notdef", "space", *DIGITS, "colon", "period"]
glyphs = {n: TTGlyphPen(None).glyph() for n in names}
for d in DIGITS[1:]:
    glyphs[d] = block()
fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(names)
cm = {32: "space", 58: "colon", 46: "period"}
cm.update({48 + i: DIGITS[i] for i in range(10)})
fb.setupCharacterMap(cm)
fb.setupGlyf(glyphs)
glyf = fb.font["glyf"]
metrics = {}
for n in names:
    glyf[n].recalcBounds(glyf)
    metrics[n] = (500 if n == ".notdef" else 0, getattr(glyf[n], "xMin", 0))
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=900, descent=-250)
fb.setupNameTable({"familyName": "IslandCover", "styleName": "Regular", "psName": "IslandCover-Regular", "fullName": "IslandCover Regular"})
fb.setupOS2(sTypoAscender=900, sTypoDescender=-250, usWinAscent=1100, usWinDescent=400)
fb.setupPost()
fb.save(f"{sys.argv[1]}/IslandCover.ttf")
print("IslandCover.ttf")
