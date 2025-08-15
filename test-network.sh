#!/bin/bash

echo "🔍 Network Connectivity Test"
echo "============================"

# Test if ports are open
echo "Testing if ports are accessible..."

# Test backend port
if nc -z localhost 3001 2>/dev/null; then
    echo "✅ Backend port 3001 is accessible locally"
else
    echo "❌ Backend port 3001 is not accessible locally"
fi

# Test frontend port
if nc -z localhost 5173 2>/dev/null; then
    echo "✅ Frontend port 5173 is accessible locally"
else
    echo "❌ Frontend port 5173 is not accessible locally"
fi

echo ""
echo "🌐 Network Information:"
echo "Local IP: 192.168.1.47"
echo "Frontend URL: http://192.168.1.47:5173"
echo "Backend URL: http://192.168.1.47:3001"

echo ""
echo "📱 Test from another device:"
echo "1. Connect the other device to the same Wi-Fi network"
echo "2. Open a web browser on that device"
echo "3. Go to: http://192.168.1.47:5173"
echo "4. You should see the Transport Management System"

echo ""
echo "🔧 If connection fails, check:"
echo "- Firewall settings (see FIREWALL_SETUP.md)"
echo "- Both devices are on the same network"
echo "- Server is running (./start-lan.sh)"
