This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Copy `.env.example` to `.env.local` for development, or configure the same keys in your host (e.g. Vercel → Project → Settings → Environment Variables).

### Production: one Next.js app + one Supabase project (`havenring.me`)

Use a **single** deployment for the marketing site and the PWA shell (`/app`). Point **`havenring.me`** at that deployment (DNS → Vercel or your host). Run database migrations against the same Supabase project you use in production env vars.

**Supabase Dashboard → Authentication → URL configuration**

| Setting | Value |
|--------|--------|
| Site URL | `https://havenring.me` |
| Redirect URLs | `https://havenring.me/**` (or explicitly list `/app`, `/start`, `/bind-ring`, `/hub` paths if you restrict wildcards) |

OAuth and email magic links return to URLs under `havenring.me`; the app shell lives at **`/app`**, so ensure redirects include paths under your domain (the wildcard covers this).

**SEO:** Set `NEXT_PUBLIC_SITE_URL=https://havenring.me` so `metadataBase` and Open Graph URLs stay canonical.

Haven Ring hardware is a dynamic NFC ring. Production taps must resolve through
Secure Dynamic Messaging (SDM) verification; the SDM master key lives only in
the server/container environment and must never be committed.

Required for NFC cloud login path:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`

Required for dynamic NFC ring verification:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SDM_BACKEND_URL` (for local Docker on the same host: `http://127.0.0.1:5000`)
- `MASTER_KEY` (server/container environment only; consumed by `sdm-backend`)

Optional but recommended:

- `SUPABASE_JWT_ISS` (explicit JWT issuer claim; defaults to `<NEXT_PUBLIC_SUPABASE_URL>/auth/v1`)
- `NFC_ACCESS_TOKEN_SECONDS`
- `NFC_LONG_SESSION_MAX_SECONDS`
- `NEXT_PUBLIC_NFC_ACCESS_GRANT_TTL_DAYS`
- `NEXT_PUBLIC_NFC_LONG_ACCESS_GRANT_TTL_DAYS`
- `SDM_BACKEND_VERIFY_PATH` (defaults to `/api/tag` for encrypted `picc`, `/api/tagpt` for plaintext `uid` + `ctr`)
- `SDM_BACKEND_PORT` (Docker host port for `docker-compose.sdm.yml`, default `5000`)

Run the SDM verifier with Docker:

```bash
MASTER_KEY="$MASTER_KEY" docker compose -f docker-compose.sdm.yml up -d
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
