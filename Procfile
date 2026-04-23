web: bash -c 'export PATH=/root/.local/share/mise/shims:$PATH && cd backend && python3 init_db.py && gunicorn app:app --workers 4 --bind 0.0.0.0:$PORT'
