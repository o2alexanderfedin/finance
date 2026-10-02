#!/bin/sh
# Serves the showcase locally. One command, no build, no install.
#
#     ./demo/serve.sh            # then open the URL it prints
#     ./demo/serve.sh 9000       # on a different port
#
# ## Why this needs a staging directory at all
#
# The demo imports the engine directly: `demo/index.html` resolves `../fjs/...`
# and, through its import map, `../functionalscript/...`. Both must sit BESIDE
# `demo/` for those to resolve, and in this working tree neither does — the
# repository root has `fjs/`, and `functionalscript` is an npm dependency that
# `npm ci` puts under `node_modules/`. It WAS a git submodule at the root until
# 2026-08-18; both comments here said so long after it was removed.
#
# So this stages the three side by side, using SYMLINKS rather than copies:
# editing a step module and reloading the page shows the change immediately,
# with nothing to re-run and nothing to keep in sync.
#
# Nothing is written inside the repository. The staging directory lives under
# the system temp directory and is rebuilt on every run.

set -eu

port="${1:-8000}"
repo="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
site="${TMPDIR:-/tmp}/finance-showcase-site"

# `functionalscript` resolves from node_modules, which is where the 2220 proofs
# resolve it from too. There is no longer a submodule to resolve it from: the
# one at the repository root was removed on 2026-08-18, so node_modules is not
# a preference between two sources but the only source.
if [ ! -d "$repo/node_modules/functionalscript" ]; then
    echo "error: $repo/node_modules/functionalscript is missing." >&2
    echo "       run 'npm ci' in $repo first." >&2
    exit 1
fi

# Check the INSTALLED version against the lockfile, not merely that a directory
# exists.
#
# This is not defensive padding. Two of this repository's three checkouts were
# found serving `functionalscript@0.41.0` while the lockfile pinned `0.43.0` —
# `npm ci` had been run in one of them and not the others, and nothing said so.
# In that state `tsc` reports sixteen errors in `fjs/**` that are not defects in
# `fjs/**`, and the demo would load a different engine dependency than the one
# every proof ran against. The failure is silent and it arrives at the worst
# possible moment, so it is worth six lines to make it loud and to say exactly
# what fixes it.
installed=$(node -p "require('$repo/node_modules/functionalscript/package.json').version" 2>/dev/null || echo unknown)
expected=$(node -p "require('$repo/package-lock.json').packages['node_modules/functionalscript'].version" 2>/dev/null || echo unknown)
if [ "$installed" != "$expected" ]; then
    echo "error: functionalscript is $installed but the lockfile pins $expected." >&2
    echo "       this checkout's node_modules is stale — run 'npm ci' in $repo." >&2
    exit 1
fi

rm -rf "$site"
mkdir -p "$site"
ln -s "$repo/demo" "$site/demo"
ln -s "$repo/fjs" "$site/fjs"
ln -s "$repo/node_modules/functionalscript" "$site/functionalscript"

echo
echo "  finance showcase"
echo "  ────────────────────────────────────────────────"
echo "  open   http://localhost:$port/demo/"
echo "  all    http://localhost:$port/demo/#/all"
echo
echo "  ← / →  move between steps"
echo "  stop   Ctrl-C"
echo

# STILL `python3 -m http.server`, and MAINT-11 has wanted this line to be
# `fjs web` since 2026-08-31. The reason changed on 2026-10-02; the answer did
# not.
#
# **The size ceiling that used to block it is gone.** `fjs web` answered `413`
# to any file over one `Vec` — 131072 bytes — and eleven of the files this page
# imports are over that. `functionalscript@0.52.0` made the response body a lazy
# list of chunks, so `fjs web` now serves `fjs/form1040/core/module.f.js` whole,
# all 1022499 bytes of it, byte for byte. `fjs-web-size-ceiling.test.js` is that
# measurement, kept as a test.
#
# **What blocks the swap now is speed, and it is not close.** Measured on
# 2026-10-02 against 0.53.0, same file, same disk, same machine:
#
#     fjs web                   565 ms   (1.73 MB/s)
#     python3 -m http.server      1 ms
#
# The page imports about 3.2 MB of engine, so a cold load is 4.4 s against
# `fjs web` and 0.17 s against python3. A reload costs the same 4.4 s again,
# because `fjs web` sends no `Last-Modified` and no `ETag`, so nothing can be
# revalidated — python3 sends one and answers `304`, which is why its reload is
# 37 ms. The swap was made and the UI suite failed **7 of 47** cases, every one
# of them a `page.reload()` that ran past the 30-second budget.
#
# The cost is not the file read. Reading those bytes takes under a millisecond;
# turning them into `Vec` chunks takes 195 ms and turning those chunks back into
# bytes for the socket takes 322 ms, which is the 517 ms the response takes. A
# `Vec` is a bigint that carries its length, so a 131072-byte chunk is a
# million-bit integer and every byte crosses that boundary twice per response.
# Lifting the ceiling removed the limit on how big one of those may be; it did
# not change the cost per byte.
#
# Recorded in `fjs/todo/upstream-web-vec-throughput.md`, which replaced the
# ceiling note. When `fjs web` can serve this page at a speed a person would
# accept, this becomes:
#
#     exec "$repo/node_modules/.bin/fjs" web "$site" "$port"
#
# and the dependency rule holds everywhere.
cd "$site"
exec python3 -m http.server "$port"
