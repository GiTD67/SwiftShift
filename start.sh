#!/bin/bash
set -e
export PATH=/mise/shims:$PATH
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd backend
"${SCRIPT_DIR}/venv/bin/python3" init_db.py
exec "${SCRIPT_DIR}/venv/bin/gunicorn" app:app --workers 4 --bind 0.0.0.0:$PORT
