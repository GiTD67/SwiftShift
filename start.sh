#!/bin/bash
set -e
export PATH=/root/.local/share/mise/shims:$PATH
cd backend
python3 init_db.py
exec gunicorn app:app --workers 4 --bind 0.0.0.0:$PORT
