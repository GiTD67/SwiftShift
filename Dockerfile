# syntax=docker/dockerfile:1

# ---------- Stage 1: build the React/Vite frontend ----------
FROM node:20-slim AS frontend
WORKDIR /app/frontend
ENV NODE_OPTIONS=--max-old-space-size=4096
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Python backend that serves the built frontend ----------
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    WEB_CONCURRENCY=1
WORKDIR /app

# Build tools needed to compile a few Python wheels (e.g. ChromaDB deps)
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Backend source
COPY backend/ ./backend/

# Built frontend from stage 1 (Flask serves ../frontend/dist relative to backend/app.py)
COPY --from=frontend /app/frontend/dist ./frontend/dist

WORKDIR /app/backend
EXPOSE 8000

# Create DB tables if missing (idempotent), then start the server.
CMD ["sh", "-c", "python init_db.py && exec gunicorn app:app --workers ${WEB_CONCURRENCY:-1} --bind 0.0.0.0:${PORT:-8000} --timeout 120"]
