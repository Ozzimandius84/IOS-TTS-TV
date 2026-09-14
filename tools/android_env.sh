#!/usr/bin/env bash
# tools/android_env.sh -- the four Android triples, and the NDK clang each one
# needs, exported. Source it; do not run it.
#
#     source tools/android_env.sh          # NDK_HOME must already be set
#
# **Why a file and not four lines in the workflow.** `cargo check --target
# aarch64-linux-android` does not link the app, but it DOES run every build
# script, and two of this crate's dependencies compile C: `ring` (through
# ureq's rustls) and `libsqlite3-sys` (`rusqlite`'s `bundled`, the language
# packs). `cc` picks its compiler from `CC_<triple>` and falls back to the
# host's, so without these the check fails inside ring's assembler with an
# error that names neither Android nor the NDK. `tauri android build` sets the
# same variables itself; a bare `cargo check` is on its own, and this is what
# it is on its own with.
#
# API 24 because that is Tauri 2's `minSdkVersion` in the `build.gradle.kts`
# `tauri android init` generates -- the clang wrapper's number IS the minimum
# API the object is built for, so a higher one here would silently raise the
# floor of the app.
#
# `armv7a-linux-androideabi24-clang`, not `armv7-…`: the triple Rust spells
# `armv7-linux-androideabi` the NDK spells `armv7a-linux-androideabi`, and that
# one letter is the whole of why the 32-bit arm check fails when the other
# three pass.
set -u

: "${NDK_HOME:?source tools/android_env.sh with NDK_HOME set (the runner has ANDROID_NDK_LATEST_HOME)}"
ANDROID_API="${ANDROID_API:-24}"

case "$(uname -s)" in
  Darwin) _host=darwin-x86_64 ;;   # the NDK ships one prebuilt for macOS and it is named x86_64 on arm64 too
  *)      _host=linux-x86_64 ;;
esac
_bin="$NDK_HOME/toolchains/llvm/prebuilt/$_host/bin"
[ -d "$_bin" ] || { echo "android_env.sh: no $_bin -- is NDK_HOME an NDK?" >&2; return 1 2>/dev/null || exit 1; }

_upper() { printf '%s' "$1" | tr 'a-z-' 'A-Z_'; }

# triple:clang-prefix
for _pair in \
  aarch64-linux-android:aarch64-linux-android \
  armv7-linux-androideabi:armv7a-linux-androideabi \
  i686-linux-android:i686-linux-android \
  x86_64-linux-android:x86_64-linux-android
do
  _triple="${_pair%%:*}"; _prefix="${_pair##*:}"
  _cc="$_bin/${_prefix}${ANDROID_API}-clang"
  _u="$(_upper "$_triple")"
  export "CC_${_triple//-/_}=$_cc"
  export "CXX_${_triple//-/_}=${_cc}++"
  export "AR_${_triple//-/_}=$_bin/llvm-ar"
  export "CARGO_TARGET_${_u}_LINKER=$_cc"
done
export PATH="$_bin:$PATH"
unset _pair _triple _prefix _cc _u _bin _host
