#!/usr/bin/env bash
# Deploy icedevml/sdm-backend to Fly.io and wire SDM_BACKEND_URL on Vercel (havenring).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLY_APP="${FLY_APP:-haven-sdm-backend}"
VERCEL_PROJECT="${VERCEL_PROJECT:-havenring}"
VERCEL_SCOPE="${VERCEL_SCOPE:-xietian691428-3167s-projects}"

export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

if ! command -v flyctl >/dev/null 2>&1; then
  echo "Installing flyctl..."
  curl -L https://fly.io/install.sh | sh
  export PATH="$FLYCTL_INSTALL/bin:$PATH"
fi

if [[ -z "${MASTER_KEY:-}" ]]; then
  echo "ERROR: Set MASTER_KEY first (32 hex chars, same as factory work order)."
  echo "  export MASTER_KEY=a53082d97e19a11329ef2e3f7e0d092c"
  exit 1
fi

if ! flyctl auth whoami >/dev/null 2>&1; then
  echo "Run: flyctl auth login"
  exit 1
fi

cd "$ROOT/ops/sdm-backend"

if ! flyctl apps list 2>/dev/null | grep -q "$FLY_APP"; then
  echo "Creating Fly app $FLY_APP ..."
  flyctl apps create "$FLY_APP" --yes || true
fi

echo "Setting MASTER_KEY secret on Fly..."
flyctl secrets set "MASTER_KEY=$MASTER_KEY" --app "$FLY_APP"

echo "Deploying sdm-backend..."
flyctl deploy --app "$FLY_APP" --image icedevml/sdm-backend:latest --ha=false

SDM_URL="https://${FLY_APP}.fly.dev"
echo "SDM backend URL: $SDM_URL"

echo "Smoke test (expect JSON with uid on a real tap; empty params may 400)..."
curl -sS "${SDM_URL}/" | head -c 200 || true
echo ""

cd "$ROOT"
if command -v vercel >/dev/null 2>&1; then
  echo "Setting SDM_BACKEND_URL on Vercel project $VERCEL_PROJECT ..."
  printf '%s' "$SDM_URL" | vercel env add SDM_BACKEND_URL production \
    --scope "$VERCEL_SCOPE" --force 2>/dev/null \
    || printf '%s' "$SDM_URL" | vercel env rm SDM_BACKEND_URL production --scope "$VERCEL_SCOPE" -y 2>/dev/null; \
       printf '%s' "$SDM_URL" | vercel env add SDM_BACKEND_URL production --scope "$VERCEL_SCOPE"

  for env in preview development; do
    printf '%s' "$SDM_URL" | vercel env add SDM_BACKEND_URL "$env" \
      --scope "$VERCEL_SCOPE" --force 2>/dev/null || true
  done

  echo "Redeploying Vercel production..."
  vercel deploy --prod --scope "$VERCEL_SCOPE" --yes
else
  echo "vercel CLI not found — set SDM_BACKEND_URL=$SDM_URL manually in Vercel dashboard."
fi

echo ""
echo "Done."
echo "  SDM backend: $SDM_URL"
echo "  Vercel env:  SDM_BACKEND_URL=$SDM_URL"
echo "  Verify:      POST https://havenring.me/api/rings/sdm/resolve (after factory ring tap)"
