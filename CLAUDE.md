# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Site Locally

There is no build step. Serve the static files directly:

```powershell
npx serve .
# or
npx http-server .
```

To test serverless functions locally (requires Vercel CLI):

```powershell
npx vercel dev
```

## Deploying

Push to the `main` branch on GitHub — Vercel auto-deploys. Environment variables are configured in the Vercel dashboard (not in this repo). See `SETUP_GUIDE.md` for the full list of required env vars.

## Architecture

**Hybrid static + serverless.** The frontend is a single `index.html` with no framework or bundler. The backend is five Vercel serverless functions in `/api/`, each a standalone Node.js ES module.

**Booking flow:**
1. Page load → `GET /api/get-availability` → next free 30-min slot shown on button
2. User submits form → `POST /api/submit-request` → approval email sent to Scott with action links
3. Scott clicks Approve/Decline/Suggest Alternate in email → hits `/api/approve.js`, `/api/decline.js`, or `/api/suggest-alternate.js`
4. Approve creates a Google Calendar event and emails the prospect confirmation

**Stateless by design:** No database. All booking data is base64-encoded into URL query parameters passed between email action links and API handlers.

**Google Calendar auth** uses a service account (`GOOGLE_SERVICE_ACCOUNT_KEY` env var, full JSON). Business hours are hardcoded as 9:30 AM–12:00 PM and 1:30 PM–3:00 PM Pacific (America/Vancouver).

**Email** is sent via Gmail SMTP through Nodemailer using an App Password (`SMTP_PASS`). All email HTML uses inline styles.

## Key Files

- `index.html` — entire frontend: landing page, booking modal, canvas animation, and all JS
- `api/get-availability.js` — queries Google Calendar free/busy for next available slot
- `api/submit-request.js` — validates form, generates request ID, emails Scott
- `api/approve.js` — creates calendar event, emails prospect confirmation
- `api/suggest-alternate.js` — lets Scott propose a different time via a small web form
- `api/decline.js` — sends rejection email to prospect
- `vercel.json` — URL rewrite: `/privacy` → `/privacy.html`
- `SETUP_GUIDE.md` — full API key, Gmail, and Vercel setup instructions
