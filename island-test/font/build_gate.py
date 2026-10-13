#!/usr/bin/env python3
"""Island Test, run 5 -- the gate font.

Run 4 proved the island redraws its own clock ~50 times a second with no
updates, but draws it one character at a time (no ligatures). So the clock is
never SHOWN here: it is used as an invisible switch.

In IslandGate.ttf every digit 1-9 is one solid block covering a whole word
slot, and 0, ':' and '.' draw nothing. Only the period has width (one word slot); the hundredths digits after it draw
their block back across the text's own box. A clock drawn in this font is
therefore a solid block while ANY of its digits is non-zero, and nothing once
it reads all zeros. Used as a mask over a word:

    count-up timer starting at the word's start  -> solid only AFTER the start
    countdown timer ending at the word's end      -> solid only BEFORE the end

and the word shows exactly between the two. The clock itself is never seen.

    python3 build_gate.py <out dir>
"""
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPM = 1000
# the block: 6 em wide (wider than any word slot) and from below the descender to above the ascender
SLOT = 4600   # the word slot, 4.6 em -- the period carries this width
X0, X1, Y0, Y1 = -SLOT, 0, -450, 1250
DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]


def block():
    p = TTGlyphPen(None)
    p.moveTo((X0, Y0)); p.lineTo((X0, Y1)); p.lineTo((X1, Y1)); p.lineTo((X1, Y0)); p.closePath()
    return p.glyph()


def empty():
    return TTGlyphPen(None).glyph()


def main(out):
    names = [".notdef", "space", *DIGITS, "colon", "period", "hyphen", "comma"]
    glyphs = {n: empty() for n in names}
    for d in DIGITS[1:]:
        glyphs[d] = block()
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    cm = {32: "space", 58: "colon", 46: "period", 45: "hyphen", 44: "comma", 0x2212: "hyphen"}
    cm.update({48 + i: DIGITS[i] for i in range(10)})
    fb.setupCharacterMap(cm)
    fb.setupGlyf(glyphs)
    glyf = fb.font["glyf"]
    metrics = {}
    for n in names:
        g = glyf[n]
        g.recalcBounds(glyf)
        # Run 8 found zero-width text is not drawn at all. So only the PERIOD has width
        # (one slot); every other character has none. In "00:12.34" the two digits
        # after the period then sit at x = slot, and their blocks, drawn from -slot
        # to 0 about their own origin, fill exactly the text's own box [0, slot].
        metrics[n] = (SLOT if n == "period" else 0, getattr(g, "xMin", 0))
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=1000, descent=-250)
    fb.setupNameTable({"familyName": "IslandGate", "styleName": "Regular",
                       "psName": "IslandGate-Regular", "fullName": "IslandGate Regular"})
    fb.setupOS2(sTypoAscender=1000, sTypoDescender=-250, usWinAscent=1300, usWinDescent=500)
    fb.setupPost()
    fb.save(f"{out}/IslandGate.ttf")
    print("IslandGate.ttf written")


if __name__ == "__main__":
    main(sys.argv[1])
