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
| Redirect URLs | `https://havenring.me/**` and `https://www.havenring.me/**` (www allowed only so misconfigured links still work; OAuth `redirectTo` in app code uses **apex** so tokens land on `havenring.me` and URL fragments are preserved) |

**`www` → apex:** The app ships a **`beforeInteractive`** inline script that runs before React and moves `www.havenring.me` → `https://havenring.me` **while copying `pathname`, `query`, and `hash`** (so `#access_token=…` survives). A **CDN/host HTTP 301** from `www` → apex runs **before** any HTML or script: the browser follows the redirect **without** sending the fragment to the server, so **the hash is dropped** and OAuth cannot complete — avoid edge 301 for document navigations to `www`, or ensure Supabase only redirects to **`https://havenring.me/...`** (this repo’s OAuth `redirectTo` already uses the apex origin).

Root layout also mounts **`SupabaseUrlSessionBootstrap`**, which calls `supabase.auth.initialize()` on every page so the marketing home **`/`** still parses Supabase auth fragments into storage (the landing page previously never imported the browser client).

**Hosting check (Vercel / Cloudflare)** — align with OAuth fragments:

1. **Prefer apex as the only “real” host for OAuth**  
   Supabase **Site URL** and in-app `redirectTo` should stay `https://havenring.me/...` (already true in this repo).

2. **Avoid edge / DNS HTTP redirects from `www` → apex for HTML**  
   Browsers do not send `#...` to the server; a **301/302/307** response with `Location: https://havenring.me/...` drops the fragment, so `#access_token=...` never reaches your app. That breaks login even if the app script would have fixed `www` later.

3. **Vercel (Domains)**  
   - Add **`havenring.me`** and set it as the **primary** production domain.  
   - If you add **`www.havenring.me`**: either **do not** turn on Vercel’s automatic “redirect to primary domain” for `www` while debugging OAuth, **or** ensure users never open OAuth return URLs on `www` (point 1). Safer pattern: **`www` CNAME → same deployment as apex** and rely on the shipped **`beforeInteractive`** script to move users to apex **in the browser** (hash preserved).  
   - There is **no** `vercel.json` redirect in this repo; any www redirect you see comes from the Vercel/Cloudflare UI or DNS provider.

4. **Cloudflare**  
   - If you use **Bulk Redirects** or **Redirect Rules** (`www` → `https://havenring.me/$1`), treat them like point 2: they run at the edge and **strip hash** on the first hop. Prefer **no** such rule for `www`, or only use rules that do not apply to your app’s HTML responses until OAuth is verified on apex-only links.

5. **Smoke test**  
   From an incognito window, start Google sign-in and confirm the address bar after IdP is **`https://havenring.me/...`** (optionally with `#access_token=`), not `www`.

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
