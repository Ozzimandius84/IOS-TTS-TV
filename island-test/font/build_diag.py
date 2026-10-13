#!/usr/bin/env python3
"""Island Test, run 10 -- the diagnostic fonts.

Runs 5-9 drew nothing from every font whose digits were not ordinary
digit-shaped, digit-wide glyphs; run 4's font (ordinary digits) drew fine.
This finds the island's actual rule. In each font 1-9 draw a solid block and
0 draws nothing; they differ in ONE thing:

  IslandDiagC  block INSIDE the digit's own width        (advance 600, ink    0..600)
  IslandDiagD  same block, digit given ZERO width        (advance   0, ink    0..600)
  IslandDiagE  block to the RIGHT, outside its own width (advance 600, ink  600..1200)
  IslandDiagF  block to the LEFT, outside its own width  (advance 600, ink -600..0)

':' and '.' are ordinary-width blanks in all four.
    python3 build_diag.py <out dir>
"""
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPM = 1000
DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
VARIANTS = {"C": (600, 0, 600), "D": (0, 0, 600), "E": (600, 600, 1200), "F": (600, -600, 0)}


def block(x0, x1):
    p = TTGlyphPen(None)
    p.moveTo((x0, -100)); p.lineTo((x0, 750)); p.lineTo((x1, 750)); p.lineTo((x1, -100)); p.closePath()
    return p.glyph()


def build(out, tag, adv, x0, x1):
    names = [".notdef", "space", *DIGITS, "colon", "period", "hyphen"]
    glyphs = {n: TTGlyphPen(None).glyph() for n in names}
    for d in DIGITS[1:]:
        glyphs[d] = block(x0, x1)
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    cm = {32: "space", 58: "colon", 46: "period", 45: "hyphen"}
    cm.update({48 + i: DIGITS[i] for i in range(10)})
    fb.setupCharacterMap(cm)
    fb.setupGlyf(glyphs)
    glyf = fb.font["glyf"]
    metrics = {}
    for n in names:
        glyf[n].recalcBounds(glyf)
        w = adv if n in DIGITS else (300 if n in ("colon", "period") else 600 if n != ".notdef" else 500)
        metrics[n] = (w, getattr(glyf[n], "xMin", 0))
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=900, descent=-200)
    fam = f"IslandDiag{tag}"
    fb.setupNameTable({"familyName": fam, "styleName": "Regular", "psName": fam + "-Regular", "fullName": fam + " Regular"})
    fb.setupOS2(sTypoAscender=900, sTypoDescender=-200, usWinAscent=1000, usWinDescent=300)
    fb.setupPost()
    fb.save(f"{out}/{fam}.ttf")


if __name__ == "__main__":
    for tag, (adv, x0, x1) in VARIANTS.items():
        build(sys.argv[1], tag, adv, x0, x1)
    print("diag fonts:", ", ".join("IslandDiag" + t for t in VARIANTS))
