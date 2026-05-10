# AMUST Kids Protein — Landing site

Public marketing landing page for AMUST Kids (chocolate protein product) with enquiry and order flows. The site is static HTML with small backend routes for handing off enquiries (email handoff active; WhatsApp optional when configured).

## Repository

[Renuka-Pharma / amust-kids-protein](https://github.com/Renuka-Pharma/amust-kids-protein)

## What ships in this repo

| Piece | Purpose |
| --- | --- |
| `index.html` | Landing page UI, modal forms, CTAs |
| `assets/` | Imagery (hero, icons, illustrations) |
| `api/email-handoff.js` | Validates submissions and builds an email-client handoff (`mailto`). |
| `api/whatsapp.js` | Optional wa.me redirect when WhatsApp business number env is configured. |
| `dev-server.js` | Local Node server for static assets and API routes |
| `serve-local.sh` | Runs `dev-server.js` (default port `8081`) |

## Prerequisites

- Node.js LTS recommended (local dev server and optional Vercel CLI)

## Environment variables

Use **`.env.local`** locally (gitignored). Use your host’s dashboard for hosted environments.

Never commit secrets, tokens, `.env*` files meant for production, or real inbox addresses into the repo.

| Variable | Used for |
| --- | --- |
| `SITE_CONTACT_EMAIL` | Where customer drafts should be addressed once they send mail. |
| `API_ALLOWED_ORIGINS` | Host-configured allowed browser origins for the email-handoff route in production deployments. |
| `WHATSAPP_E164` | WhatsApp routing when enabled. Leave unset until that flow is intentionally turned on. |
| `WHATSAPP_ALLOWED_ORIGINS` | Separate allowlist for the WhatsApp route when used. |

For exact behavior and precedence, rely on **`api/email-handoff.js`** and **`api/whatsapp.js`** in this repo rather than copying values into docs.

## Local development

1. Create **`.env.local`** with **`SITE_CONTACT_EMAIL`** and whatever else you need per the files above.
2. From the repo root:

   ```bash
   ./serve-local.sh
   ```

   Or:

   ```bash
   node dev-server.js 8081
   ```

3. Open the printed localhost URL/port in your browser.

---

## Deploy and go live (Vercel + GitHub)

Hosted as static files plus **`api/*`** handlers on **[Vercel](https://vercel.com)** (no dedicated build pipeline required).

### 1. Connect GitHub

1. Open Vercel and create/link a team as needed so it can reach the GitHub repo.
2. **New Project** → import this repository.
3. Defaults (root `.`, no build command) are usually sufficient for the first deploy.

### 2. Production configuration

Under **Project → Settings**, set environment variables privately (especially contact email and origin policy). Prefer **Production** (and Preview if desired) scopes from the dashboard; rotate if anything leaks.

Redeploy after changing variables so deployments pick them up.

### 3. Custom domain (optional)

Attach your domain under **Domains** and complete DNS/TLS steps your provider shows. Align any origin allowlisting with whatever exact URLs visitors use once live.

### 4. Smoke test before promotion

Confirm over HTTPS that the homepage loads and end-to-end handoff behaves as expected from a real browser session on your final URL(s).

### CLI alternative

After authenticating locally:

```bash
cd path-to-checkout
npx vercel link
npx vercel deploy --prod
```

Keep secrets in Vercel or your secret manager—not in readme text or committed files.

## License / ownership

Content and deployment are intended for **Renuka Pharma** marketing; adjust per legal if needed.
