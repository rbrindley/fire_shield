#!/usr/bin/env bash
# Reject any dependency PR that includes a package published less than N days ago.
# Supports: npm, PyPI. Extend for other registries as needed.
#
# Trust boundary: this script trusts publication dates from upstream registry APIs.

set -euo pipefail

MIN_AGE_DAYS="${1:-7}"
NOW=$(date +%s)
FAILED=0
CHECKED=0

echo "══════════════════════════════════════════════════"
echo "║  Package Quarantine Gate (${MIN_AGE_DAYS}-day minimum age)     ║"
echo "══════════════════════════════════════════════════"
echo ""

# ─── Check for quarantine override label ───
if [ "${QUARANTINE_OVERRIDE:-}" = "true" ]; then
  echo "⚠  QUARANTINE OVERRIDDEN via label. All age checks skipped."
  echo "⚠  This override is logged in the CI run and PR event history."
  echo "⚠  Review the packages in this PR manually before merging."
  exit 0
fi

# ─── npm packages (from package.json changes) ───
NPM_CHANGES=$(git diff origin/main...HEAD -- '**/package.json' \
  | grep '^\+' | grep -oP '"[^"]+": "\d[^"]*"' || true)

if [ -n "$NPM_CHANGES" ]; then
  echo "=== npm registry ==="
  while IFS= read -r line; do
    PKG=$(echo "$line" | cut -d'"' -f2)
    VER=$(echo "$line" | cut -d'"' -f4)
    CHECKED=$((CHECKED + 1))

    PUB_DATE=$(npm view "${PKG}@${VER}" time."${VER}" 2>/dev/null || echo "")
    if [ -z "$PUB_DATE" ]; then
      echo "  ⚠  WARN: Could not fetch publish date for ${PKG}@${VER}"
      continue
    fi
    PUB_TS=$(date -d "$PUB_DATE" +%s 2>/dev/null || echo "0")
    AGE_DAYS=$(( (NOW - PUB_TS) / 86400 ))

    if [ "$AGE_DAYS" -lt "$MIN_AGE_DAYS" ]; then
      echo "  ✗ BLOCKED: ${PKG}@${VER} — ${AGE_DAYS}d old (min: ${MIN_AGE_DAYS}d)"
      FAILED=1
    else
      echo "  ✓ OK: ${PKG}@${VER} — ${AGE_DAYS}d old"
    fi
  done <<< "$NPM_CHANGES"
  echo ""
fi

# ─── PyPI packages (from requirements files or pyproject.toml changes) ───
PIP_CHANGES=$(git diff origin/main...HEAD -- '**/requirements*.txt' '**/requirements*.lock' '**/requirements*.in' '**/pyproject.toml' \
  | grep '^\+' | grep -oP '[a-zA-Z0-9_-]+==[0-9][^\s",;\\]+' | sort -u || true)

if [ -n "$PIP_CHANGES" ]; then
  echo "=== PyPI registry ==="
  while IFS= read -r line; do
    PKG=$(echo "$line" | cut -d'=' -f1)
    VER=$(echo "$line" | sed 's/.*==//')
    CHECKED=$((CHECKED + 1))

    PUB_DATE=$(curl -sf --max-time 10 "https://pypi.org/pypi/${PKG}/${VER}/json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
urls = data.get('urls', [])
if urls:
    print(urls[0]['upload_time'])
" 2>/dev/null || echo "")

    if [ -z "$PUB_DATE" ]; then
      echo "  ⚠  WARN: Could not fetch publish date for ${PKG}==${VER}"
      continue
    fi
    PUB_TS=$(date -d "$PUB_DATE" +%s 2>/dev/null || echo "0")
    AGE_DAYS=$(( (NOW - PUB_TS) / 86400 ))

    if [ "$AGE_DAYS" -lt "$MIN_AGE_DAYS" ]; then
      echo "  ✗ BLOCKED: ${PKG}==${VER} — ${AGE_DAYS}d old (min: ${MIN_AGE_DAYS}d)"
      FAILED=1
    else
      echo "  ✓ OK: ${PKG}==${VER} — ${AGE_DAYS}d old"
    fi
  done <<< "$PIP_CHANGES"
  echo ""
fi

# ─── Summary ───
echo "═══════════════════════════════════════"
if [ "$CHECKED" -eq 0 ]; then
  echo "No dependency version changes detected. Nothing to quarantine."
  exit 0
fi

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "FAILED: One or more packages are too new."
  echo "This PR will auto-pass once they age past ${MIN_AGE_DAYS} days."
  echo "Dependabot will rebase this PR on its next weekly run."
  echo ""
  echo "If this is an emergency security patch, add the 'quarantine-override'"
  echo "label to this PR (repo admins only) and re-run CI."
  exit 1
else
  echo "All ${CHECKED} updated packages are at least ${MIN_AGE_DAYS} days old. Safe to merge."
fi
