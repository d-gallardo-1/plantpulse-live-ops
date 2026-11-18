#!/usr/bin/env bash
# Starts PlantPulse without Docker (Linux, macOS, WSL).
# Requires Python 3.11+ and Node.js 20.19+ on PATH.
# Backend: http://127.0.0.1:8000   UI: http://127.0.0.1:5173
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend="$root/backend"
frontend="$root/frontend"

python_bin="$(command -v python3 || command -v python || true)"
if [ -z "$python_bin" ]; then
  echo "Python 3.11+ was not found on PATH." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found on PATH. Install Node.js 20.19+ and try again." >&2
  exit 1
fi

if [ ! -d "$backend/.venv" ]; then
  echo "Creating Python virtual environment..."
  "$python_bin" -m venv "$backend/.venv"
fi

echo "Installing backend dependencies..."
"$backend/.venv/bin/python" -m pip install --quiet --disable-pip-version-check \
  -r "$backend/requirements.txt"

echo "Starting backend on http://127.0.0.1:8000 ..."
(
  cd "$backend"
  exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 \
    --workers 1 --timeout-graceful-shutdown 3
) &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT INT TERM

cd "$frontend"
if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies..."
  npm ci --no-fund --no-audit
fi

echo
echo "Open http://127.0.0.1:5173 in your browser. Press Ctrl+C to stop."
echo
npm run dev
