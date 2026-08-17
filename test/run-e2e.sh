#!/bin/bash
# Drives the Ontologies menu in a headless browser against a built deploy/.
#
#   npm run release && test/run-e2e.sh
#
# Serves deploy/ on a scratch port, injects test/e2e-driver.js into a copy of
# index.html, renders it, and prints the assertions the driver collected.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8231}"
BROWSER="${BROWSER:-chromium}"

cd "$ROOT" || exit 1

if [ ! -f deploy/index.html ]; then
  echo "deploy/index.html missing -- run 'npm run release' first" >&2
  exit 1
fi

# The driver asserts on the real graph, so the bundled ontology has to be there
# -- without it every assertion fails on an empty graph instead of naming the
# cause. The ontology is built by the parent repo, not here. The name is read
# from the source so it cannot drift from DEFAULT_JSON_NAME.
DEFAULT_JSON="$(sed -n 's/.*DEFAULT_JSON_NAME = "\([^"]*\)".*/\1/p' src/app/js/loadingModule.js)"
if [ -n "$DEFAULT_JSON" ] && [ ! -f "deploy/data/$DEFAULT_JSON.json" ]; then
  echo "deploy/data/$DEFAULT_JSON.json missing -- build the ontology from the" >&2
  echo "parent repo: 'make viz' in sagebrain-model" >&2
  exit 1
fi

python3 - "$PORT" <<'PY'
driver = open('test/e2e-driver.js').read()
page = open('deploy/index.html').read()
inject = ('\n<pre id="e2eOut" style="position:fixed;bottom:0;left:0;z-index:9999;'
          'background:#fff">e2e: waiting</pre>\n<script>\n' + driver + '\n</script>\n')
open('deploy/_e2e.html', 'w').write(page.replace('</body>', inject + '</body>'))
PY

# setsid + process-group kill: `npx serve` spawns a node child, so killing the
# npx pid alone orphans a server process on every run.
setsid npx --yes serve deploy -l "$PORT" >/tmp/e2e-serve.log 2>&1 &
SERVER_PGID=$!
trap 'kill -- -$SERVER_PGID 2>/dev/null; rm -f "$ROOT/deploy/_e2e.html"' EXIT

for _ in $(seq 1 30); do
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 1
done

timeout 200 "$BROWSER" --headless --disable-gpu --no-sandbox \
  --virtual-time-budget=60000 \
  --dump-dom "http://localhost:$PORT/_e2e.html" 2>/tmp/e2e-browser.log > /tmp/e2e-dom.html

python3 <<'PY'
import re, html, sys
dom = open('/tmp/e2e-dom.html').read()
m = re.search(r'<pre id="e2eOut"[^>]*>(.*?)</pre>', dom, re.S)
if not m:
    print("NO E2E OUTPUT -- see /tmp/e2e-dom.html and /tmp/e2e-browser.log")
    sys.exit(1)
text = html.unescape(m.group(1))
print(text)
sys.exit(0 if 'E2E OK' in text else 1)
PY
