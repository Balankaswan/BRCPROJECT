#!/bin/bash

echo "🚀 Starting Transport Management System"
echo "======================================"

# Start backend server
echo "Starting backend server..."
cd server
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend server
echo "Starting frontend server..."
cd ..
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ System started successfully!"
echo ""
echo "📱 Access URLs:"
echo "   Local:    http://localhost:5173"
echo "   Network:  http://192.168.1.47:5173"
echo ""
echo "🔧 Backend API: http://192.168.1.47:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup INT TERM

# Wait for processes
wait
