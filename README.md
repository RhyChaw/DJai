# DJAi - AI Auto-DJ (Monorepo)

AI-powered Auto-DJ that mixes Spotify tracks using audio analysis and ML/DSP.

## Apps

- apps/frontend — Next.js (TypeScript) UI
- apps/backend — Node.js/Express API (TypeScript)
- apps/ml — FastAPI ML/DSP service (Python)

## Quickstart

1. Env setup

```bash
# Create a root .env with these keys
cat > .env <<'ENV' 
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_ML_URL=http://localhost:8000

PORT=4000
CLIENT_ORIGIN=http://localhost:3000
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://localhost:4000/auth/callback

ML_PORT=8000
ENV
```

2. One‑command dev (starts frontend + backend + ML)

```bash
bash ./dev.sh
```

Alternatively run services manually:

3. Backend

```bash
cd apps/backend && npm install && npm run dev
```

4. Run ML service

```bash
cd apps/ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Open http://localhost:3000

## Spotify OAuth (dev)

- In the Spotify Developer Dashboard create an app and add this Redirect URI:
  - http://localhost:4000/auth/callback
- Put `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` into `.env`.

## Deployment (Vercel + external backend)

Frontend (Vercel):
- Project → Settings → General
  - Framework Preset: Next.js
  - Root Directory: `apps/frontend`
  - Leave Build/Install/Output as defaults
- Project → Settings → Environment Variables
  - `NEXT_PUBLIC_BACKEND_URL=https://YOUR_PROD_BACKEND`
  - `NEXT_PUBLIC_ML_URL=https://YOUR_PROD_ML` (or omit if unused)

Backend/ML (host on Render/Fly/EC2/etc.):
- Backend `.env` keys to set in your host:
  - `CLIENT_ORIGIN=https://YOUR_VERCEL_DOMAIN`
  - `SPOTIFY_CLIENT_ID=...`
  - `SPOTIFY_CLIENT_SECRET=...`
  - `SPOTIFY_REDIRECT_URI=https://YOUR_PROD_BACKEND/auth/callback`

Notes
- The backend sets auth cookies with `SameSite=None; Secure` when `CLIENT_ORIGIN` isn’t localhost, so cross‑site login works with Vercel.
- The frontend uses relative APIs with Next.js rewrites:
  - `/api/*` → `NEXT_PUBLIC_BACKEND_URL`
  - `/ml/*` → `NEXT_PUBLIC_ML_URL`

## Tunneling (optional)

If your backend runs locally but you want to test the deployed frontend, expose it with an HTTPS tunnel (e.g., ngrok) and set:
- `NEXT_PUBLIC_BACKEND_URL` in Vercel to the tunnel URL
- Add `https://<tunnel>/auth/callback` to Spotify Redirect URIs and set `SPOTIFY_REDIRECT_URI` accordingly on the backend host

## Milestones

- Milestone 1: Scaffold monorepo, health endpoints, envs and docs.

## License

MIT
