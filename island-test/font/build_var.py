#!/usr/bin/env python3
"""Island Test, run V -- ONE font for many words (run B: the widget's 60 MB was 100 font
files, not 100 layers).

All the words are stacked in one glyph, LINE units apart vertically (3 em: at 14 pt the
neighbours sit 42 pt above and below, outside the 36 pt pill, which clips them). A
variation axis WORD (0..n-1) slides the stack so that word k sits on the baseline.
Each layer is the same font at a different axis value -- no font per word.

    python3 build_var.py <base serif .ttf> <out dir> word1 word2 ...
"""
import os
import sys
import tempfile

from fontTools.designspaceLib import AxisDescriptor, DesignSpaceDocument, SourceDescriptor
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import build as build_var

sys.path.insert(0, os.path.dirname(__file__))
from build_word import BLACK, INK, RED, pivot_index  # noqa: E402

LINE = 3000
FAMILY = "IslandVar"


def master(base, words, shift, out_path):
    """One master: the word stack, moved up by `shift` units (word k at y = shift - k*LINE)."""
    gs, cmap, hmtx = base.getGlyphSet(), base.getBestCmap(), base["hmtx"]
    sc = 1000 / base["head"].unitsPerEm

    def strip(which):
        pen = TTGlyphPen(None)
        for k, word in enumerate(words):
            piv, x = pivot_index(word), 0.0
            y = shift - k * LINE
            for i, ch in enumerate(word):
                g = cmap.get(ord(ch))
                if g is None:
                    continue
                if which == "all" or (which == "red") == (i == piv):
                    rec = DecomposingRecordingPen(gs)
                    gs[g].draw(rec)
                    rec.replay(TransformPen(pen, (sc, 0, 0, sc, int(round(x)), int(round(y)))))
                x += hmtx[g][0] * sc
        return pen.glyph()

    def boxes():
        pen = TTGlyphPen(None)
        widths = [sum(hmtx[cmap[ord(c)]][0] * sc for c in w if ord(c) in cmap) for w in words]
        for k, w in enumerate(words):
            cover = max(widths[k], widths[k - 1] if k else 0) + 120
            y = shift - k * LINE
            pen.moveTo((-60, y - 280)); pen.lineTo((-60, y + 980)); pen.lineTo((int(cover), y + 980)); pen.lineTo((int(cover), y - 280)); pen.closePath()
        return pen.glyph()

    names = [".notdef", "space", "zero", "colon", "period", "w", "w.box", "w.ink", "w.red"]
    glyphs = {n: TTGlyphPen(None).glyph() for n in names}
    glyphs["w"], glyphs["w.ink"], glyphs["w.red"], glyphs["w.box"] = strip("all"), strip("ink"), strip("red"), boxes()
    metrics = {n: (0, 0) for n in names}
    metrics[".notdef"] = (500, 0)
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(names)
    cm = {32: "space", 58: "colon", 46: "period", 48: "zero"}
    cm.update({48 + i: "w" for i in range(1, 10)})
    fb.setupCharacterMap(cm)
    fb.setupGlyf(glyphs)
    glyf = fb.font["glyf"]
    for n in names:
        glyf[n].recalcBounds(glyf)
        metrics[n] = (metrics[n][0], getattr(glyf[n], "xMin", 0))
    fb.setupHorizontalMetrics(metrics)
    hh, os2 = base["hhea"], base["OS/2"]
    fb.setupHorizontalHeader(ascent=int(hh.ascent * sc), descent=int(hh.descent * sc))
    fb.setupNameTable({"familyName": FAMILY, "styleName": "Regular", "psName": FAMILY + "-Regular", "fullName": FAMILY + " Regular"})
    fb.setupOS2(sTypoAscender=int(os2.sTypoAscender * sc), sTypoDescender=int(os2.sTypoDescender * sc),
                usWinAscent=int(os2.usWinAscent * sc), usWinDescent=int(os2.usWinDescent * sc))
    fb.setupPost()
    fb.setupCOLR({"w": [("w.box", 2), ("w.ink", 1), ("w.red", 0)]})
    fb.setupCPAL([[RED, INK, BLACK]])
    fb.save(out_path)


def main(base_path, out, words):
    base = TTFont(base_path)
    n = len(words)
    tmp = tempfile.mkdtemp()
    a, b = os.path.join(tmp, "a.ttf"), os.path.join(tmp, "b.ttf")
    master(base, words, 0, a)                 # axis 0: word 0 on the baseline
    master(base, words, (n - 1) * LINE, b)    # axis n-1: word n-1 on the baseline
    ds = DesignSpaceDocument()
    ds.addAxis(AxisDescriptor(tag="WORD", name="word", minimum=0, default=0, maximum=n - 1))
    for path, loc in ((a, 0), (b, n - 1)):
        s = SourceDescriptor(); s.path = path; s.location = {"word": loc}; ds.addSource(s)
    vf, _, _ = build_var(ds)
    vf.save(f"{out}/{FAMILY}.ttf")
    print(f"{FAMILY}.ttf: {n} words on axis WORD 0..{n-1}: {' '.join(words)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
