#!/bin/bash

# Transport Management Spring Boot Backend Startup Script
echo "🚀 Starting Spring Boot Transport Management Backend..."

cd /Users/balankaswan/Downloads/project/spring-backend

# Check if Java 17+ is available
java_version=$(java -version 2>&1 | head -1 | cut -d'"' -f2)
echo "☕ Java version: $java_version"

# Kill any existing process on port 8080
echo "🛑 Stopping any existing services on port 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
sleep 2

# Check if MongoDB is running
if ! mongosh --eval "db.runCommand({ping: 1})" --quiet > /dev/null 2>&1; then
    echo "❌ MongoDB is not running! Please start MongoDB first:"
    echo "   brew services start mongodb-community"
    exit 1
fi
echo "✅ MongoDB is running"

# Install dependencies if needed
if [ ! -d "target" ]; then
    echo "📦 Installing dependencies..."
    ./mvnw clean compile
fi

# Start Spring Boot application
echo "🌐 Starting Spring Boot server on 0.0.0.0:8080..."
echo "🔄 Real-time sync: WebSocket enabled"
echo "📊 Database: MongoDB (localhost:27017)"
echo ""

# Run in background with logging
nohup ./mvnw spring-boot:run > spring-backend.log 2>&1 &

# Wait a moment for startup
sleep 5

# Check if server started successfully
if curl -s http://localhost:8080/api/health > /dev/null; then
    echo "✅ Spring Boot server started successfully!"
    echo ""
    echo "🌐 Server URLs:"
    echo "   Local:  http://localhost:8080/api/"
    echo "   LAN:    http://192.168.1.3:8080/api/"
    echo ""
    echo "🔗 Frontend should use: http://192.168.1.3:8080/api/"
    echo "📱 Health check: curl http://192.168.1.3:8080/api/health"
    echo "📄 Logs: tail -f spring-backend.log"
else
    echo "❌ Failed to start Spring Boot server. Check logs:"
    echo "   tail -f spring-backend.log"
fi
