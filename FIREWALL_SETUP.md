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
   - Run: `sudo pfctl -f /etc/pf.conf`
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

```bash
# Allow ports 3001 and 5173
sudo ufw allow 3001
sudo ufw allow 5173

# Or allow Node.js application
sudo ufw allow nodejs
```

## Linux Firewall Setup (iptables)

```bash
# Allow ports 3001 and 5173
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5173 -j ACCEPT

# Save rules (varies by distribution)
sudo iptables-save > /etc/iptables/rules.v4
```

## Testing Firewall Configuration

1. Start the application: `./start-lan.sh`
2. From another device on the same network, try to access:
   - http://[SERVER_IP]:5173 (Frontend)
   - http://[SERVER_IP]:3001/api/health (Backend health check)

If you can't access from other devices, check:
- Firewall settings
- Network connectivity
- Router configuration (if using VPN or complex network setup)
