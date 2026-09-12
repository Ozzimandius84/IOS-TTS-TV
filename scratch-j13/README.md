# scratch-j13 — the search sheet, and how it was proved without a phone

Untracked, like `scratch-float/` and `scratch26b/`. Nothing here is loaded by
anything; it is the bench that produced §2's numbers, kept so they can be
re-run.

## 1. The JS half — `node scratch-j13/proof.mjs [path-to-TTSTV]`

Slices `SEARCH_JS` out of `src-tauri/src/search.rs` and the search control out of
TTSTV's `reader/lookup.js`, asserts both slices are verbatim, and runs them
against a fake `window`. **18 checks.** What it settles: the shim wraps one
command name and forwards every other with its arguments; it still installs when
`window.__TAURI__` appears *after* the plugin's init script (which is the real
Tauri order — `manager/webview.rs`, plugin scripts at line 202, the global API at
216); it is idempotent; and `lookup.js`'s own `search()` reports
`how = "frank_search"` and starts exactly one navigation, to door one, with the
mock's five `-site:` exclusions intact.

## 2. The Rust half — extraction into a dependency-free crate

`search.rs` is written so that everything but `use tauri::{…}` and
`pub fn init()` compiles with no dependencies. In a Cowork container:

```bash
python3 - <<'PY'
src = open("src-tauri/src/search.rs").read().splitlines(keepends=True)
f = lambda p, s=0: next(i for i in range(s, len(src)) if p(src[i]))
u0 = f(lambda l: l.startswith("use tauri::{")); u1 = f(lambda l: l.rstrip() == "};", u0)
i0 = f(lambda l: l.startswith("pub fn init<R: Runtime>()")); i1 = f(lambda l: l.rstrip() == "}", i0)
out = src[:u0] + src[u1+1:i0] + src[i1+1:]
open("src/lib.rs","w").writelines(out)
assert not [l for l in out if l not in set(src)]        # every line verbatim
PY
cargo test          # 12 pass
```

**525 of 554 lines, 0 not verbatim, 12 tests.** Two further runs on top of it:

* a sweep of the first 768 codepoints through `encode` against node's
  `encodeURIComponent` — **byte-identical**, which is what makes the two roads
  into the sheet (the shim, and `lookup.js`'s own `window.open`) the same URL;
* the whole path with the real `url` crate: the anchor's href survives
  `Url::parse(…).as_str()` unchanged, `sheet_url` turns it into
  `https://www.google.com/search?q=<the query>`, and `frank://…`,
  `youtube.com/results?…` and `http://<lan>:8000/state` all come back `None`.

## 3. The Objective-C half — `clang -fsyntax-only`

`ios/FrankSearch.m` against hand-written stub headers declaring only the API
surface it uses (`UIApplication`/`UIScene`/`UIWindowScene`/`UIViewController`,
`SFSafariViewController` + its configuration and delegate, `NSURL`, `NSThread`,
`dispatch_async`):

```bash
clang -fsyntax-only -fblocks -Wall -Wextra -x objective-c \
      -fobjc-arc -fobjc-runtime=gnustep-2.0 -I stubs ios/FrankSearch.m
```

**0 diagnostics.** What that is worth, said plainly: it proves the file's syntax,
its ARC legality and the SHAPE of every message it sends. It does NOT prove those
selectors are Apple's — only Xcode does, and only on the simulator does the sheet
actually come up over the reader.
