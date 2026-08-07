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
# repository root has `fjs/` but its `functionalscript` submodule is not
# checked out, and `npm ci` puts that package under `node_modules/` instead.
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

# `functionalscript` resolves from node_modules, which is where the 492 proofs
# resolve it from too — the submodule at the repository root is deliberately
# left alone, because entering it is a documented foot-gun in this project.
if [ ! -d "$repo/node_modules/functionalscript" ]; then
    echo "error: $repo/node_modules/functionalscript is missing." >&2
    echo "       run 'npm ci' in $repo first." >&2
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

cd "$site"
exec python3 -m http.server "$port"
