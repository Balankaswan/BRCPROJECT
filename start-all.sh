#!/bin/bash

# Transport Management System - Complete Startup Script
echo "🚀 Starting Transport Management System..."
echo "=================================================="

# Make scripts executable
chmod +x start-backend.sh
chmod +x start-frontend.sh

# Start backend server
echo "1️⃣ Starting Backend Server..."
./start-backend.sh

sleep 2

# Start frontend server  
echo ""
echo "2️⃣ Starting Frontend Server..."
./start-frontend.sh

sleep 3

# Verify both servers are running
echo ""
echo "🔍 Verifying Services..."
echo "=================================================="

# Check backend
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend Server: RUNNING on port 3001"
else
    echo "❌ Backend Server: NOT RESPONDING"
fi

# Check frontend
if curl -s -I http://localhost:5173 | head -1 | grep -q "200\|HTTP"; then
    echo "✅ Frontend Server: RUNNING on port 5173"
else
    echo "❌ Frontend Server: NOT RESPONDING"
fi

echo ""
echo "🎉 Transport Management System is LIVE!"
echo "=================================================="
echo "🔗 Main Application: http://192.168.1.47:5173/"
echo "🔧 API Backend: http://192.168.1.47:3001/api/"
echo ""
echo "📱 Share http://192.168.1.47:5173/ with your team!"
echo "🔄 Real-time multi-device sync enabled"
echo "💾 Data stored in SQLite database"
echo ""
echo "📄 View logs:"
echo "   Backend: tail -f server/backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop servers: pkill -f 'node.*server.js' && pkill -f vite"
