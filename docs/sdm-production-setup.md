# SDM production setup (Fly + Vercel)

## Current production endpoints

| Service | URL |
|---------|-----|
| SDM backend (Fly) | `https://haven-sdm-backend.fly.dev` |
| Haven API | `https://www.havenring.me/api/rings/sdm/resolve` |

## Vercel (havenring project)

Required server env:

```
SDM_BACKEND_URL=https://haven-sdm-backend.fly.dev
```

Set in Vercel → Project **havenring** → Settings → Environment Variables → **Production**.

Do **not** put `MASTER_KEY` on Vercel.

## Fly.io (haven-sdm-backend)

```bash
export PATH="$HOME/.fly/bin:$PATH"
flyctl auth login
cd ops/sdm-backend
flyctl secrets set MASTER_KEY=a53082d97e19a11329ef2e3f7e0d092c --app haven-sdm-backend
flyctl deploy --app haven-sdm-backend --image icedevml/sdm-backend:latest
```

Or: `./scripts/deploy-sdm-backend.sh`

## Smoke test

```bash
curl https://haven-sdm-backend.fly.dev/
curl -X POST https://www.havenring.me/api/rings/sdm/resolve \
  -H "Content-Type: application/json" \
  -d '{"picc_data":"<from ring tap>","cmac":"<from ring tap>"}'
```

Expect: `"valid": true`

## Factory keys

Per-ring keys: `factory-keys.csv` (generated from UIDs + MASTER_KEY).
