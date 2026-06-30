# Deploy Solupair landing page (Cloudflare Workers)

**Live preview:** https://solupair-landing.holiday-malepe.workers.dev  
**Target domain:** `solupair.co.za`

**Repos**

| Repo | Branch | Use |
|------|--------|-----|
| [HMalepe/landing-page-solupair](https://github.com/HMalepe/landing-page-solupair) | `main` | Mirror — connect this to Cloudflare Git |
| [HMalepe/marineflow](https://github.com/HMalepe/marineflow) | `master` | Monorepo — code lives in `landing-page-solupair-check/` |

Use **one** deploy path (Cloudflare Git **or** GitHub Actions), not both.

---

## Option A — Cloudflare Git (recommended if you linked Git in the dashboard)

1. **Workers & Pages** → open worker **`solupair-landing`** (name must match exactly).
2. **Settings → Builds** → connect **HMalepe/landing-page-solupair**, branch **`main`**.
3. Set build settings:

| Setting | Value |
|---------|--------|
| Root directory | `/` (repo root) |
| Production branch | `main` |
| Build command | `npm install && npm run cf:build` |
| Deploy command | `npm run cf:deploy` |
| Node.js version | `22` (if shown) |

4. Save, then **Retry deployment** or push a commit to `main`.

If the build fails with a **worker name mismatch**, the Cloudflare worker name and `name` in `.output/server/wrangler.json` (patched to `solupair-landing`) must match. Rename or recreate the worker in the dashboard if needed.

5. **Disable duplicate deploys:** in GitHub → **landing-page-solupair** → Actions → disable workflow **Deploy to Cloudflare** (or delete `.github/workflows/deploy.yml` in that repo).

---

## Option B — GitHub Actions (already working)

Secrets on **landing-page-solupair** (Repository secrets, not Environment):

- `CLOUDFLARE_API_TOKEN` — Workers edit permission
- `CLOUDFLARE_ACCOUNT_ID` — `d82c8a30db93eb68bcf679a1f5610517`

Workflow: `.github/workflows/deploy.yml` on push to `main`.

If you use this, **do not** also connect the same repo in Cloudflare Builds.

Monorepo deploy: `marineflow/.github/workflows/deploy-landing-page.yml` syncs
`landing-page-solupair-check/` → this repo (`main`), then this repo's workflow deploys
to Cloudflare. Requires `LANDING_SYNC_TOKEN` on **marineflow** (PAT with `contents:write`
on `landing-page-solupair`). Cloudflare secrets stay on **this** repo only.

---

## Point solupair.co.za at the worker

1. Add **solupair.co.za** to Cloudflare (DNS zone). Move nameservers from Lovable/your registrar to Cloudflare.
2. Worker **`solupair-landing`** → **Settings → Domains & Routes** → **Add custom domain** → `solupair.co.za` and `www.solupair.co.za`.
3. Remove the domain from Lovable so only Cloudflare serves traffic.
4. Wait for DNS (often 5–30 minutes). Test https://solupair.co.za

Until the zone is on Cloudflare, the site stays on **workers.dev** only.

---

## Local commands

```bash
npm install
npm run cf:build    # build + patch wrangler config
npm run cf:deploy   # deploy (requires wrangler login or API token)
```
