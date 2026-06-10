#!/bin/bash
echo "==================================================="
echo "    Trace - Academic Narrative Analysis Tool"
echo "==================================================="
echo ""
echo "Starting Trace... please wait..."

if [ ! -d "app/node_modules" ]; then
    echo "First time setup detected! Installing dependencies..."
    cd app
    npm install
    cd ..
elif [ ! -d "app/node_modules/express" ]; then
    echo "Updating local proxy dependencies..."
    cd app
    npm install
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
