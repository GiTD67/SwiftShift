#!/bin/bash
set -e

echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Installing backend dependencies..."
python3 -m venv /app/venv
/app/venv/bin/pip install --no-cache-dir -r backend/requirements.txt

echo "Done!"
