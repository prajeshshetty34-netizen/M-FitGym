# M-Fit Gym Website

This repository contains the M‑Fit Gym static frontend and a small Node.js backend (proxy) used for authentication and AI endpoints.

Contents
- `index.html`, `*.html` — Static frontend pages
- `css/` — Styles (main stylesheet: `css/style.css`)
- `js/` — Frontend scripts
- `assets/` — Images and media
- `components/` — Shared HTML fragments (header)
- `gemini-proxy/` — Node/Express backend (auth + AI proxy)

Quick purpose
- Securely host the static frontend (Firebase Hosting or Vercel)
- Run the backend as a container (Cloud Run) so secrets (Gemini API key, JWT secret) remain server-side

Deployment & Security Summary (short)

1) Prepare production secrets
- Generate a strong JWT secret and a production Gemini API key.
- Use Secret Manager (Google Cloud) or your host's secret store; never commit `.env`.

2) Backend (Cloud Run recommended)
- Use the provided `gemini-proxy/Dockerfile` to build a container.
- Use Cloud Build or `gcloud builds submit` to push the image to GCR.
- Deploy with `gcloud run deploy` and mount secrets via Secret Manager (or pass env vars).

3) Frontend (Firebase Hosting or Vercel)
- Update `js/config.js` production block with your backend Cloud Run URL and Firebase web config.
- Deploy the static site with `firebase deploy --only hosting` or `vercel --prod`.

Useful files
- `DEPLOYMENT_SECURITY_GUIDE.md` — Full step-by-step guide and hardening checklist (recommended reading)
- `gemini-proxy/cloudrun_deploy.sh` — helper script for Cloud Run deployment

Local development
- Frontend: open `index.html` in a browser (or run a local static server like `npx serve`)
- Backend: from `gemini-proxy/` run `npm install` then `node server.js` (ensure `.env` has required keys for local testing)

Quick test: CSS padding visual check
- A visible padding test has been added to the homepage. Open `index.html` in a browser and confirm the grey dashed box that says "CSS Padding Test" shows comfortable padding around its text. If you want to change the padding amount, edit `css/style.css` `.padding-test` rule.

If you want, I can add GitHub Actions to automate the build and deploy steps.

---
For detailed deployment steps, see `DEPLOYMENT_SECURITY_GUIDE.md`.
