#!/bin/bash

# Transport Management Frontend Server Startup Script
echo "🌐 Starting Transport Management Frontend Server..."

cd /Users/balankaswan/Downloads/project

# Kill any existing server on port 5173
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start the frontend development server in background
nohup npm run dev > frontend.log 2>&1 &

echo "✅ Frontend Server started on http://0.0.0.0:5173"
echo "🎨 React + TypeScript + Vite"
echo "📄 Logs: frontend.log"
echo ""
echo "🔗 Main App URL: http://192.168.1.47:5173/"
echo "📱 Share this URL with your team!"
