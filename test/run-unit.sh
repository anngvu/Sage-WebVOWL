#!/bin/bash
# Runs test/ontologyGroups.selftest.html against a built deploy/ in a headless
# browser and prints the assertion results.
#
#   npm run release && cp test/ontologyGroups.selftest.html deploy/ && test/run-unit.sh
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8232}"
BROWSER="${BROWSER:-chromium}"

cd "$ROOT" || exit 1

if [ ! -f deploy/js/webvowl.js ]; then
  echo "deploy/js/webvowl.js missing -- run 'npm run release' first" >&2
  exit 1
fi

cp test/ontologyGroups.selftest.html deploy/

# setsid + process-group kill: `npx serve` spawns a node child, so killing the
# npx pid alone orphans a server process on every run.
setsid npx --yes serve deploy -l "$PORT" >/tmp/unit-serve.log 2>&1 &
SERVER_PGID=$!
trap 'kill -- -$SERVER_PGID 2>/dev/null' EXIT

for _ in $(seq 1 30); do
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 1
done

timeout 120 "$BROWSER" --headless --disable-gpu --no-sandbox \
  --virtual-time-budget=15000 \
  --dump-dom "http://localhost:$PORT/ontologyGroups.selftest.html" \
  2>/tmp/unit-browser.log > /tmp/unit-dom.html

python3 <<'PY'
import re, html, sys
dom = open('/tmp/unit-dom.html').read()
m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
if not m:
    print("NO UNIT OUTPUT -- see /tmp/unit-dom.html and /tmp/unit-browser.log")
    sys.exit(1)
text = html.unescape(m.group(1))
failures = [l for l in text.splitlines() if l.startswith("FAIL")]
for line in failures:
    print(line)
print(text.splitlines()[-1])
sys.exit(1 if failures else 0)
PY
