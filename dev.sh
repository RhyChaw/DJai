#!/usr/bin/env bash
set -euo pipefail

# Absolute paths
ROOT="/Users/rhychaw/projects/DJAi"
FRONTEND="$ROOT/apps/frontend"
BACKEND="$ROOT/apps/backend"
ML="$ROOT/apps/ml"

# Export env from root .env if present so all apps see the same config
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
fi

# Kill all children on exit
cleanup() {
  pkill -P $$ || true
}
trap cleanup EXIT

run() {
  local name="$1"; shift
  ( "$@" ) 2>&1 | sed -e "s/^/[$name] /" &
}

echo "Starting DJAi dev stack..."

# Backend (Node/TypeScript)
if [ ! -d "$BACKEND/node_modules" ]; then
  (cd "$BACKEND" && npm install)
fi
run backend bash -lc "cd '$BACKEND' && npm run dev"

# ML Service (Python/FastAPI)
if [ ! -d "$ML/.venv" ]; then
  python3 -m venv "$ML/.venv"
fi
run ml bash -lc "source '$ML/.venv/bin/activate' && pip install -q -U pip && pip install -q -r '$ML/requirements.txt' && cd '$ML' && uvicorn main:app --reload --port \
  ${ML_PORT:-8000}"

# Frontend (Next.js)
if [ ! -d "$FRONTEND/node_modules" ]; then
  (cd "$FRONTEND" && npm install)
fi
run frontend bash -lc "cd '$FRONTEND' && npm run dev -- --turbopack"

wait

