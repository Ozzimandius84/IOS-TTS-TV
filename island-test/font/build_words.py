#!/usr/bin/env python3
"""Island Test, run 18 -- one font per word for a run of words.

Builds font/words/IslandW01.ttf ... (each by build_word.py: digits draw that
word over a black box, red letter by Frank's rule), writes the Swift list the
widget stacks (Widget/WordList.swift: when each word starts and its font), and
fills the block between "# words-begin" and "# words-end" in project.yml.

    python3 font/build_words.py <base serif .ttf> [words per second] [count] [lead seconds]
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import build_word  # noqa: E402

TEXT = ("It is a truth universally acknowledged that a single man in possession of a good fortune must be "
        "in want of a wife. However little known the feelings or views of such a man may be on his first "
        "entering a neighbourhood this truth is so well fixed in the minds of the surrounding families that "
        "he is considered the rightful property of some one or other of their daughters.")
MAX_PIECE = 6


def pieces(word):
    """Same as IslandWord.pieces in Shared/IslandAttributes.swift."""
    if len(word) <= MAX_PIECE + 1:
        return [word]
    n = -(-len(word) // MAX_PIECE)
    size = -(-len(word) // n)
    out = [word[i:i + size] for i in range(0, len(word), size)]
    return [p + "-" for p in out[:-1]] + [out[-1]]


def main(base, wps=3.0, count=30, lead=15.0):
    here = os.path.dirname(os.path.abspath(__file__))
    base_words = [p for w in TEXT.split() for p in pieces(w)]
    words = (base_words * (count // len(base_words) + 1))[:count]   # run 19: the text repeats to reach the count
    os.makedirs(f"{here}/words", exist_ok=True)
    rows, res, fonts = [], [], []
    for i, w in enumerate(words, 1):
        fam = f"IslandW{i:02d}"
        build_word.main(base, w, f"{here}/words", fam, words[i - 2] if i > 1 else None)   # run 27: cover = this word + the last
        rows.append(f'    ({lead + (i - 1) / wps:.4f}, "{fam}"),  // {w}')
        res.append(f"      - path: font/words/{fam}.ttf\n        buildPhase: resources")
        fonts.append(f"{fam}.ttf")  # xcodegen copies each file flat into the bundle
    swift = ("// Built by font/build_words.py -- do not edit. Run 18: %d words at %g a second from %g s.\n"
             "let runWords: [(at: Double, font: String)] = [\n%s\n]\n"
             "let runWordsPerSecond = %g\nlet runWordLead = %g\nlet runWordCount = %d\n"
             % (len(words), wps, lead, "\n".join(rows), wps, lead, len(words)))
    open(f"{here}/../Widget/WordList.swift", "w").write(swift)
    open(f"{here}/../Shared/WordListMeta.swift", "w").write(
        "// Built by font/build_words.py -- do not edit.\n"
        "enum RunWords { static let perSecond: Double = %g; static let lead: Double = %g; static let count = %d }\n"
        % (wps, lead, len(words)))
    p = f"{here}/../project.yml"
    s = open(p).read()
    s = re.sub(r"(      # words-begin\n).*?(      # words-end\n)", lambda m: m.group(1) + "\n".join(res) + "\n" + m.group(2), s, flags=re.S)
    s = re.sub(r"(UIAppFonts: \[)([^\]]*)\]", lambda m: m.group(1) + ", ".join([x.strip() for x in m.group(2).split(",") if x.strip() and not re.match(r"IslandW\d+\.ttf", x.strip())] + fonts) + "]", s)
    open(p, "w").write(s)
    print(f"{len(words)} words: {' '.join(words)}")


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], float(a[1]) if len(a) > 1 else 3.0, int(a[2]) if len(a) > 2 else 30, float(a[3]) if len(a) > 3 else 15.0)
