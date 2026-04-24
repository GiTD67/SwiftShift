#!/bin/bash
set -e
export PATH=/mise/shims:$PATH
cd backend
/app/venv/bin/python3 init_db.py
exec /app/venv/bin/gunicorn app:app --workers 4 --bind 0.0.0.0:$PORT
