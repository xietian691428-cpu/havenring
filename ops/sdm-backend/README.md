# Haven SDM Backend (production)

Haven verifies NTAG 424 DNA ring taps via [icedevml/sdm-backend](https://github.com/icedevml/sdm-backend).
The Next.js app on Vercel calls this service through `SDM_BACKEND_URL`.

## Architecture

```
Ring tap → havenring.me/start?picc_data=…&cmac=…
         → POST /api/rings/sdm/resolve (Vercel)
         → GET  {SDM_BACKEND_URL}/api/tag?picc_data=…&cmac=…
         → JSON { uid, read_ctr } → bind / daily / seal
```

- **`MASTER_KEY`** — only on the SDM backend container (Fly.io secret). Must match factory provisioning.
- **`SDM_BACKEND_URL`** — only on Vercel (Next.js server). Public HTTPS URL of the Fly app.

## One-command deploy

```bash
export MASTER_KEY=a53082d97e19a11329ef2e3f7e0d092c   # same as factory work order
flyctl auth login                                      # once, browser
chmod +x scripts/deploy-sdm-backend.sh
./scripts/deploy-sdm-backend.sh
```

## Manual steps (if script fails)

### 1. Fly.io — run sdm-backend

```bash
cd ops/sdm-backend
flyctl auth login
flyctl apps create haven-sdm-backend --yes
flyctl secrets set MASTER_KEY=a53082d97e19a11329ef2e3f7e0d092c --app haven-sdm-backend
flyctl deploy --app haven-sdm-backend --image icedevml/sdm-backend:latest
```

Note URL: `https://haven-sdm-backend.fly.dev`

### 2. Vercel — point Next.js at SDM backend

Project: **havenring** → Settings → Environment Variables

| Name | Value | Environments |
|------|-------|--------------|
| `SDM_BACKEND_URL` | `https://haven-sdm-backend.fly.dev` | Production, Preview |

Do **not** put `MASTER_KEY` on Vercel — it belongs only on Fly.

Redeploy production after saving.

### 3. Smoke test

After factory programs a ring, tap it and copy `picc_data` + `cmac` from the URL:

```bash
curl "https://haven-sdm-backend.fly.dev/api/tag?picc_data=PASTE&cmac=PASTE"
```

Expect: `{"uid":"04…","read_ctr":…}`

Then:

```bash
curl -X POST https://havenring.me/api/rings/sdm/resolve \
  -H "Content-Type: application/json" \
  -d '{"picc_data":"PASTE","cmac":"PASTE"}'
```

Expect: `"valid": true`, `"scene": "new_ring_binding"` (first bind).
