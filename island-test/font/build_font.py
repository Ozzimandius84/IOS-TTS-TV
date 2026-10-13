#!/usr/bin/env python3
"""Island Test, run 4 -- the counting font.

Builds IslandCount.ttf: a font in which the island's own running clock is
drawn as ONE WORD AT A TIME (Osca 13 Oct 11:43: "one word at a time, that's
the whole point"). The test speaks at a steady 3 words a second, so at time t
the word is words[floor(3 t)].

  * the whole-second timer   "0:07" / "00:07"            -> the word at 7.0 s
  * the hundredths stopwatch "0:07.2" / "0:07.25" / ...  -> the word at 7.2 s / 7.25 s
    (whichever the island draws; if it redraws faster than once a second the
    word moves in time with speech)

Digits, ':' and '.' on their own are drawn as ordinary digits, so a clock
string the font does not recognise is still readable in the screen pictures
(that is how we learn the stopwatch's exact format if it does not match).
Each word's pivot letter (Frank's rule, reader/wordview.js) is red through a
colour layer (COLR/CPAL); without colour layers the plain word still draws.

    python3 build_font.py <base serif .ttf> <out dir>
"""
import json
import re
import sys

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.otlLib.builder import buildLigatureSubstSubtable
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

SECONDS = 240
WORDS_PER_SECOND = 3
TEXT = ("It is a truth universally acknowledged that a single man in possession of a good fortune "
        "must be in want of a wife. However little known the feelings or views of such a man may be "
        "on his first entering a neighbourhood this truth is so well fixed in the minds of the "
        "surrounding families that he is considered the rightful property of some one or other of "
        "their daughters.")
RED = (1.0, 0x6a / 255, 0x5e / 255, 1.0)   # the drafts' island red, #ff6a5e
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


def seq(s):
    return " ".join(DIGITS[int(c)] if c.isdigit() else {"": "", ":": "colon", ".": "period"}[c] for c in s)


def main(base_path, out_dir):
    base = TTFont(base_path)
    gs = base.getGlyphSet()
    cmap = base.getBestCmap()
    hmtx = base["hmtx"]
    upm = 1000
    sc = upm / base["head"].unitsPerEm

    words = TEXT.split()
    n_words = SECONDS * WORDS_PER_SECOND
    timeline = [words[i % len(words)] for i in range(n_words)]   # word i is spoken from i/3 s

    PIVOT_X = 1900     # every word's red letter is centred on this column (Frank's one-word view)
    WORD_ADVANCE = 4600

    def pivot_centre(text):
        x, piv = 0.0, pivot_index(text)
        for i, ch in enumerate(text):
            g = cmap.get(ord(ch))
            if g is None:
                continue
            if i == piv:
                return x + hmtx[g][0] * sc / 2
            x += hmtx[g][0] * sc
        return x

    def draw(text, which, centred=False):
        """which = 'all' | 'ink' (all but the pivot) | 'red' (the pivot only)."""
        pen = TTGlyphPen(None)
        x, piv = (PIVOT_X - pivot_centre(text)) if centred else 0.0, pivot_index(text)
        for i, ch in enumerate(text):
            g = cmap.get(ord(ch))
            if g is None:
                continue
            if which == "all" or (which == "red") == (i == piv):
                rec = DecomposingRecordingPen(gs)
                gs[g].draw(rec)
                rec.replay(TransformPen(pen, (sc, 0, 0, sc, int(round(x)), 0)))
            x += hmtx[g][0] * sc
        return pen.glyph(), int(round(x))

    order = [".notdef", "space", *DIGITS, "colon", "period"]
    glyphs, metrics = {".notdef": TTGlyphPen(None).glyph()}, {".notdef": (upm // 2, 0)}
    for name, ch in [("space", " "), ("colon", ":"), ("period", ".")] + [(DIGITS[d], str(d)) for d in range(10)]:
        glyphs[name], metrics[name] = draw(ch, "all") if ch != " " else (TTGlyphPen(None).glyph(), int(hmtx["space"][0] * sc))
        if ch != " ":
            metrics[name] = (metrics[name], 0)
        else:
            metrics[name] = (metrics[name], 0)

    # one glyph (three layers) per distinct word
    word_glyph, colr = {}, {}
    for w in dict.fromkeys(timeline):
        k = f"w{len(word_glyph)}"
        word_glyph[w] = k
        for suffix, which in (("", "all"), (".ink", "ink"), (".red", "red")):
            g, _ = draw(w, which, centred=True)
            glyphs[k + suffix], metrics[k + suffix] = g, (WORD_ADVANCE, 0)
            order.append(k + suffix)
        colr[k] = [(k + ".ink", 0xFFFF), (k + ".red", 0)]

    fb = FontBuilder(upm, isTTF=True)
    fb.setupGlyphOrder(order)
    cm = {32: "space", 58: "colon", 46: "period"}
    cm.update({48 + d: DIGITS[d] for d in range(10)})
    fb.setupCharacterMap(cm)
    fb.setupGlyf(glyphs)
    glyf = fb.font["glyf"]
    for n in order:   # left side bearing must be the glyph's own xMin
        g = glyf[n]
        g.recalcBounds(glyf)
        metrics[n] = (metrics[n][0], getattr(g, "xMin", 0))
    fb.setupHorizontalMetrics(metrics)
    hh, os2 = base["hhea"], base["OS/2"]
    fb.setupHorizontalHeader(ascent=int(hh.ascent * sc), descent=int(hh.descent * sc))
    fb.setupNameTable({"familyName": "IslandCount", "styleName": "Regular",
                       "psName": "IslandCount-Regular", "fullName": "IslandCount Regular"})
    fb.setupOS2(sTypoAscender=int(os2.sTypoAscender * sc), sTypoDescender=int(os2.sTypoDescender * sc),
                usWinAscent=int(os2.usWinAscent * sc), usWinDescent=int(os2.usWinDescent * sc))
    fb.setupPost()
    fb.setupCOLR(colr)
    fb.setupCPAL([[RED]])

    def word_at(t):
        return word_glyph[timeline[min(int(t * WORDS_PER_SECOND + 1e-9), n_words - 1)]]

    rules = {}
    for cs in range(SECONDS * 100):              # every hundredth of a second
        t = cs / 100
        m, s = divmod(cs // 100, 60)
        hund, tenth = cs % 100, (cs % 100) // 10
        for mm in (f"{m}", f"{m:02d}"):
            rules[f"{mm}:{s:02d}.{hund:02d}"] = word_at(t)           # hundredths stopwatch
            if hund % 10 == 0:
                rules[f"{mm}:{s:02d}.{tenth}"] = word_at(t)          # tenths stopwatch
            if hund == 0:
                rules[f"{mm}:{s:02d}"] = word_at(t)                  # whole-second timer
    # feaLib is far too slow for ~70,000 rules, so the feature file declares one
    # placeholder ligature lookup and its subtable is replaced by one built directly.
    fea = ("languagesystem DFLT dflt;\nlanguagesystem latn dflt;\n"
           "lookup COUNT {\n    sub zero zero zero zero zero zero zero zero by zero;\n} COUNT;\n"
           "feature rlig { lookup COUNT; } rlig;\n"
           "feature liga { lookup COUNT; } liga;\n"
           "feature calt { lookup COUNT; } calt;\n")
    addOpenTypeFeaturesFromString(fb.font, fea)
    # Many small subtables (each must fit 16-bit offsets). Subtables are tried in
    # order until one applies, so sorting longest-first keeps "0:07.25" ahead of "0:07".
    items = sorted(rules.items(), key=lambda kv: -len(kv[0]))
    lookup = fb.font["GSUB"].table.LookupList.Lookup[0]
    assert lookup.LookupType == 4
    lookup.SubTable = [buildLigatureSubstSubtable({tuple(seq(k).split()): v for k, v in items[i:i + 1500]})
                       for i in range(0, len(items), 1500)]
    lookup.SubTableCount = len(lookup.SubTable)
    fb.save(f"{out_dir}/IslandCount.ttf")
    json.dump({"words_per_second": WORDS_PER_SECOND, "timeline": timeline},
              open(f"{out_dir}/timeline.json", "w"))
    print(f"IslandCount.ttf: {SECONDS} s, {len(word_glyph)} distinct words, {len(rules)} clock strings")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
