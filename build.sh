#!/bin/bash
set -e

echo "Building frontend..."
cd frontend
npm install
export NODE_OPTIONS='--max-old-space-size=4096'
npm run build
cd ..

echo "Installing backend dependencies..."
cd backend
pip install --no-cache-dir -r requirements.txt
cd ..

echo "Done!"
