# Deploy solupair.co.za from GitHub (no Lovable)

Every push to `master` that touches `landing-page-solupair-check/` builds and deploys via GitHub Actions (`.github/workflows/deploy-landing-page.yml` in the marineflow repo) to **Cloudflare Workers**. Edit in Cursor, push to GitHub, live site updates.

## One-time setup

### 1. Cloudflare API token

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com).
2. **My Profile → API Tokens → Create Token**.
3. Use the **Edit Cloudflare Workers** template (or custom token with Workers Scripts + Account read).
4. Copy the token.

### 2. Cloudflare account ID

Dashboard → any zone or **Workers & Pages** → right sidebar **Account ID**.

### 3. GitHub repository secrets

Repo: `HMalepe/marineflow` (folder `landing-page-solupair-check`) → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | Token from step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from step 2 |

### 4. First deploy

Push to `master` (or **Actions → Deploy Landing Page → Run workflow**).

Check **Actions** tab for a green run. Worker name: `hmalepe-landing-page-solupair` (from build output).

### 5. Custom domain (solupair.co.za)

**Remove from Lovable first** (Lovable → Project → Domains → remove `solupair.co.za`).

Then in Cloudflare:

1. **Workers & Pages** → your worker → **Settings → Domains & Routes**.
2. **Add Custom Domain** → `solupair.co.za` (and `www` if needed).
3. If the zone is already on Cloudflare, DNS updates automatically. Otherwise point nameservers to Cloudflare.

### 6. Optional — stop using Lovable

- Disconnect GitHub in Lovable project settings (so Lovable stops overwriting sync).
- Keep editing in Cursor → push to `master` on `marineflow`.

## Local commands

```bash
npm ci
npm run dev          # local preview
npm run build        # production build
npm run deploy       # build + deploy (needs wrangler login or API token env)
```

## Troubleshooting

- **Actions fail on build**: run `npm ci && npm run build` locally in `landing-page-solupair-check`.
- **Deploy fails (auth)**: re-check `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
- **Old Lovable site still shows**: DNS still points at Lovable until custom domain is moved to the Cloudflare worker (step 5).
