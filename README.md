# AMUST Kids Protein — Landing site

Public marketing landing page for AMUST Kids (chocolate protein product) with enquiry and order flows. The site loads as static HTML and uses small serverless APIs for handing off conversations (email today; WhatsApp ready when configured).

## Repository

[Github Organization Renuka-Pharma: amust-kids-protein](https://github.com/Renuka-Pharma/amust-kids-protein)

## What ships in this repo

| Piece | Purpose |
| --- | --- |
| `index.html` | Landing page UI, modal forms, CTAs |
| `assets/` | Imagery (hero, icons, illustrations) |
| `api/email-handoff.js` | **Production path today:** validates form payload, builds a `mailto:` draft, returns JSON `{ mailtoUrl }`. The browser opens the user’s email client instead of exposing your inbox in the frontend. |
| `api/whatsapp.js` | Validates the same shapes and returns `{ url }` for `wa.me` when **WhatsApp business number is configured** (optional for later). |
| `dev-server.js` | Local Node server: static files + `POST` routes for `/api/email-handoff` and `/api/whatsapp` |
| `serve-local.sh` | Runs `dev-server.js` on a port (default `8081`) |

## Prerequisites

- Node.js LTS recommended (for local `dev-server.js` and optional Vercel CLI)

## Environment variables

Create **`.env.local`** in the project root for local runs (already gitignored).

| Variable | Required for email handoff | Description |
| --- | :---: | --- |
| `SITE_CONTACT_EMAIL` | Yes | Recipient address for drafts from the site (validated server-side). |
| `API_ALLOWED_ORIGINS` | Strongly recommended in production | Comma-separated list of allowed **`Origin`** values (HTTPS), e.g. `https://www.yoursite.com,https://yoursite.com`. If empty, origins are **not** checked (fine for localhost; **set this before go-live**). |
| `WHATSAPP_E164` | Only for WhatsApp | E.164 digits only (digits after `+`, no spaces). Leave empty/unset until WhatsApp is live; **`/api/whatsapp`** then responds with **503**. |
| `WHATSAPP_ALLOWED_ORIGINS` | Optional | Fallback allowlist used by **`/api/email-handoff`** only if **`API_ALLOWED_ORIGINS`** is unset. WhatsApp-only route uses **`WHATSAPP_ALLOWED_ORIGINS`**. Prefer **`API_ALLOWED_ORIGINS`** with your full HTTPS site URLs when both endpoints are deployed. |

**Example `.env.local`:**

```bash
SITE_CONTACT_EMAIL=your-inbox@example.com
WHATSAPP_E164=
API_ALLOWED_ORIGINS=http://localhost:8081
```

Adjust `API_ALLOWED_ORIGINS` after you know your production domain(s).

## Local development

1. Copy or create `.env.local` with **`SITE_CONTACT_EMAIL`** (see above).
2. From the repo root:

   ```bash
   ./serve-local.sh
   ```

   Or:

   ```bash
   node dev-server.js 8081
   ```

3. Open `http://localhost:8081` (or whatever port you pass).

Forms call **`POST /api/email-handoff`**; responses include **`mailtoUrl`** used to open the user’s mail app.

---

## Deploy and go live (Vercel + GitHub)

This project is wired for **[Vercel](https://vercel.com)** with no build step: static root + **`/api/*.js`** as serverless Edge/Node-compatible handlers.

### 1. Connect GitHub to Vercel

1. Log in at [vercel.com](https://vercel.com) with an account that can access **`Renuka-Pharma/amust-kids-protein`** (or invite that account to the GitHub org if needed).
2. **Add New Project** → **Import** the **`Renuka-Pharma/amust-kids-protein`** repo.
3. Defaults are usually fine: **Framework preset** empty / Other, root `.`, no custom build command.
4. Click **Deploy** for the first deployment.

Preview URLs work immediately after import; **`vercel.app`** domains are HTTPS by default.

### 2. Set production environment variables

In **Vercel → Project → Settings → Environment Variables**, add (at least for **Production**):

| Key | Production value notes |
| --- | --- |
| `SITE_CONTACT_EMAIL` | The team inbox customers’ drafts address. |
| `API_ALLOWED_ORIGINS` | Exactly your live origins, comma-separated HTTPS URLs, **no trailing slash quirks** — match how users open the site (e.g. `https://kids.amust.example` and `https://www.kids.amust.example` if both exist). |

Optionally **`WHATSAPP_E164`** when you enable **`/api/whatsapp`** in the UI again.

Then **Redeploy** (Deployments → ⋮ on latest → Redeploy) so new env vars apply.

### 3. Custom domain (optional)

In **Project → Settings → Domains**, add your domain (e.g. **`www`** or apex). Follow Vercel’s DNS instructions. After HTTPS is green, extend **`API_ALLOWED_ORIGINS`** to include that exact **`https://...`** origin and redeploy once more.

### 4. Verification checklist before sharing the link

- [ ] Homepage loads over **HTTPS**.
- [ ] Submit a **test order / enquiry**: email client opens with the right subject/body (**`SITE_CONTACT_EMAIL`** receives when the user sends).
- [ ] If **`API_ALLOWED_ORIGINS`** is set, test from production URL only (**403** from wrong origin or Postman without browser `Origin` is expected when misconfigured).

### Alternative: CLI deploy

If you prefer the CLI (after **`npx vercel login`**):

```bash
cd /path/to/amust-kids-protein
npx vercel link
npx vercel env pull .env.vercel.preview   # optional: sync env for local previews
npx vercel deploy --prod
```

Use the Dashboard for env vars or `npx vercel env add` for each secret.

---

## API reference (handlers)

Both accept **`POST`** with JSON body roughly:

- **`purpose`:** `"order"` | `"enquiry"`
- **`name`, `mobile`, `city`, `detail`**, plus order fields **`qty`, `pack`, `whenNeed`, `deliveryPin`** as applicable

**`/api/email-handoff`** → **200:** `{ mailtoUrl }`  
**`/api/whatsapp`** → **200:** `{ url }` (`wa.me/...`), or **503** if **`WHATSAPP_E164`** is missing.

Errors return JSON **`{ error: string }`** and appropriate HTTP status codes.

## License / ownership

Content and deployment are intended for **Renuka Pharma** product marketing; adjust this section if legal requires a formal license statement.
