#!/bin/bash

echo "🚀 Setting up Transport Management System for LAN Access"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

print_status "Node.js found: $(node --version)"

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
npm install

if [ $? -eq 0 ]; then
    print_status "Frontend dependencies installed successfully"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd server
npm install

if [ $? -eq 0 ]; then
    print_status "Backend dependencies installed successfully"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

cd ..

# Get local IP address
echo ""
echo "🌐 Detecting network configuration..."

# Try different methods to get local IP
LOCAL_IP=""

# Method 1: Try ifconfig (macOS/Linux)
if command -v ifconfig &> /dev/null; then
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
fi

# Method 2: Try ip command (Linux)
if [ -z "$LOCAL_IP" ] && command -v ip &> /dev/null; then
    LOCAL_IP=$(ip route get 1 | awk '{print $7}' | head -1)
fi

# Method 3: Try hostname command (macOS)
if [ -z "$LOCAL_IP" ] && command -v hostname &> /dev/null; then
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

if [ -z "$LOCAL_IP" ]; then
    print_warning "Could not automatically detect local IP address"
    echo "Please find your local IP manually:"
    echo "  - macOS: System Preferences → Network → Advanced → TCP/IP"
    echo "  - Windows: ipconfig"
    echo "  - Linux: ip addr show"
    LOCAL_IP="YOUR_LOCAL_IP"
else
    print_status "Local IP detected: $LOCAL_IP"
fi

# Create start script
echo ""
echo "📝 Creating start script..."

cat > start-lan.sh << EOF
#!/bin/bash

echo "🚀 Starting Transport Management System"
echo "======================================"

# Start backend server
echo "Starting backend server..."
cd server
npm start &
BACKEND_PID=\$!

# Wait for backend to start
sleep 3

# Start frontend server
echo "Starting frontend server..."
cd ..
npm run dev &
FRONTEND_PID=\$!

echo ""
echo "✅ System started successfully!"
echo ""
echo "📱 Access URLs:"
echo "   Local:    http://localhost:5173"
echo "   Network:  http://$LOCAL_IP:5173"
echo ""
echo "🔧 Backend API: http://$LOCAL_IP:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill \$BACKEND_PID 2>/dev/null
    kill \$FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup INT TERM

# Wait for processes
wait
EOF

chmod +x start-lan.sh

print_status "Start script created: start-lan.sh"

# Create firewall instructions
echo ""
echo "📝 Creating firewall configuration guide..."

cat > FIREWALL_SETUP.md << EOF
# Firewall Configuration Guide

## macOS Firewall Setup

1. **Open System Preferences**
   - Go to Apple Menu → System Preferences → Security & Privacy
   - Click on "Firewall" tab
   - Click the lock icon and enter your password
   - Click "Turn On Firewall" if it's not already on

2. **Allow Node.js through firewall**
   - Click "Firewall Options"
   - Click the "+" button
   - Navigate to and select Node.js application
   - Set to "Allow incoming connections"
   - Click OK

3. **Alternative: Allow specific ports**
   - Open Terminal
   - Run: \`sudo pfctl -f /etc/pf.conf\`
   - Add rules for ports 3001 and 5173

## Windows Firewall Setup

1. **Open Windows Defender Firewall**
   - Search for "Windows Defender Firewall" in Start menu
   - Click "Allow an app or feature through Windows Defender Firewall"

2. **Allow Node.js**
   - Click "Change Settings"
   - Click "Allow another app..."
   - Browse and select Node.js
   - Check both "Private" and "Public" networks
   - Click OK

3. **Alternative: Allow specific ports**
   - Click "Advanced settings"
   - Right-click "Inbound Rules" → "New Rule"
   - Select "Port" → "TCP" → Specific ports: 3001, 5173
   - Allow the connection
   - Apply to all profiles

## Linux Firewall Setup (UFW)

\`\`\`bash
# Allow ports 3001 and 5173
sudo ufw allow 3001
sudo ufw allow 5173

# Or allow Node.js application
sudo ufw allow nodejs
\`\`\`

## Linux Firewall Setup (iptables)

\`\`\`bash
# Allow ports 3001 and 5173
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5173 -j ACCEPT

# Save rules (varies by distribution)
sudo iptables-save > /etc/iptables/rules.v4
\`\`\`

## Testing Firewall Configuration

1. Start the application: \`./start-lan.sh\`
2. From another device on the same network, try to access:
   - http://[SERVER_IP]:5173 (Frontend)
   - http://[SERVER_IP]:3001/api/health (Backend health check)

If you can't access from other devices, check:
- Firewall settings
- Network connectivity
- Router configuration (if using VPN or complex network setup)
EOF

print_status "Firewall setup guide created: FIREWALL_SETUP.md"

# Create network testing script
echo ""
echo "📝 Creating network testing script..."

cat > test-network.sh << EOF
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
echo "Local IP: $LOCAL_IP"
echo "Frontend URL: http://$LOCAL_IP:5173"
echo "Backend URL: http://$LOCAL_IP:3001"

echo ""
echo "📱 Test from another device:"
echo "1. Connect the other device to the same Wi-Fi network"
echo "2. Open a web browser on that device"
echo "3. Go to: http://$LOCAL_IP:5173"
echo "4. You should see the Transport Management System"

echo ""
echo "🔧 If connection fails, check:"
echo "- Firewall settings (see FIREWALL_SETUP.md)"
echo "- Both devices are on the same network"
echo "- Server is running (./start-lan.sh)"
EOF

chmod +x test-network.sh

print_status "Network testing script created: test-network.sh"

# Final instructions
echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Next Steps:"
echo "1. Configure firewall (see FIREWALL_SETUP.md)"
echo "2. Start the system: ./start-lan.sh"
echo "3. Test network access: ./test-network.sh"
echo ""
echo "📱 Access URLs:"
echo "   Local:    http://localhost:5173"
echo "   Network:  http://$LOCAL_IP:5173"
echo ""
echo "🔧 Backend API: http://$LOCAL_IP:3001"
echo ""
echo "💡 Tips:"
echo "- Keep this terminal window open while the system is running"
echo "- Use Ctrl+C to stop the servers"
echo "- Check FIREWALL_SETUP.md if other devices can't connect"
echo "- Run ./test-network.sh to verify connectivity"
