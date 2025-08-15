#!/bin/bash

# Transport Management Backend Server Startup Script
echo "🚀 Starting Transport Management Backend Server..."

cd /Users/balankaswan/Downloads/project/server

# Kill any existing server on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Start the server in background with logging
nohup npm start > backend.log 2>&1 &

echo "✅ Backend Server started on http://0.0.0.0:3001"
echo "📊 Database: SQLite (transport_management.db)"
echo "🔄 Real-time sync: Socket.io enabled"
echo "📄 Logs: server/backend.log"
echo ""
echo "🌐 Access API: http://192.168.1.47:3001/api/"
echo "❤️  Health Check: curl http://192.168.1.47:3001/api/health"
