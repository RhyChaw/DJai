# DJAi - AI Auto-DJ (Monorepo)

AI-powered Auto-DJ that mixes Spotify tracks using audio analysis and ML/DSP.

## Apps

- apps/frontend — Next.js (TypeScript) UI
- apps/backend — Node.js/Express API (TypeScript)
- apps/ml — FastAPI ML/DSP service (Python)

## Quickstart

1. Copy envs

```bash
cp .env.example .env
```

2. Install frontend deps and run

```bash
cd apps/frontend && npm install && npm run dev
```

3. Run backend

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

## Milestones

- Milestone 1: Scaffold monorepo, health endpoints, envs and docs.

## License

MIT
