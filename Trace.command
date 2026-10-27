#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Auto-detect Node.js; try Homebrew install when missing
if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found. Trying Homebrew install..."
    if command -v brew >/dev/null 2>&1; then
        brew install node || { echo "Homebrew install failed. Install Node.js LTS from https://nodejs.org and re-run."; exit 1; }
    else
        echo "Node.js is required. Install the LTS from https://nodejs.org (or install Homebrew first), then re-run."
        exit 1
    fi
fi

echo "==================================================="
echo "    Trace - Academic Narrative Analysis Tool"
echo "==================================================="
echo ""
echo "Starting Trace... please wait..."

if [ ! -d "app/node_modules" ]; then
    echo "First time setup detected! Installing dependencies..."
    cd app
    npm install || npm install --registry=https://registry.npmmirror.com
    cd ..
elif [ ! -d "app/node_modules/express" ]; then
    echo "Updating local proxy dependencies..."
    cd app
    npm install || npm install --registry=https://registry.npmmirror.com
    cd ..
fi

cd app

echo ""
echo "Launching the application in your browser..."
# Try to open browser
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:5173" &
elif command -v open &> /dev/null; then
    open "http://localhost:5173" &
fi

npm run dev
