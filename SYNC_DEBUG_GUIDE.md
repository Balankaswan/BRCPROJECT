# Synchronization Debug Guide

## Overview

This guide helps you debug and fix data synchronization issues across multiple devices in the Transport Management System. The system now includes comprehensive real-time synchronization with automatic error detection and repair capabilities.

## Common Synchronization Issues

### 1. Memo Creation and Linking Issues
**Problem**: When creating a loading slip and then creating a memo using shortcuts, the memo is not properly created or linked.

**Symptoms**:
- Memo appears as "no linked memo" in the loading slip
- Memo is not visible on other devices
- Data inconsistencies between devices

**Root Causes**:
- Network connectivity issues during memo creation
- Backend API failures during the linking process
- Real-time sync not properly propagating changes

### 2. Cross-Device Data Inconsistencies
**Problem**: Data created on one device doesn't appear on other devices.

**Symptoms**:
- Different data counts on different devices
- Missing records on some devices
- Outdated information

**Root Causes**:
- Socket.io connection failures
- Backend database sync issues
- Local storage vs backend data mismatches

## Debug Tools

### 1. Synchronization Debug Panel

Access the debug panel by navigating to the "Debug Ledger" section in your application.

#### Features:
- **Real-time Connection Status**: Shows if your device is connected to the backend
- **Data Count Comparison**: Compares local storage vs backend database counts
- **Synchronization Logs**: Real-time logs of all sync activities
- **Issue Detection**: Automatically detects common sync problems
- **Auto-Fix Capabilities**: Automatically repairs detected issues

#### How to Use:

1. **Check Connection Status**
   - Look for the green WiFi icon indicating connection
   - If disconnected (red WiFi icon), check your network connection

2. **Refresh Data**
   - Click "Refresh Data" to manually sync with the backend
   - This fetches the latest data from all connected devices

3. **Check for Issues**
   - Click "Check Sync Issues" to scan for problems
   - Review detected issues and their severity levels

4. **Fix Issues Automatically**
   - Click "Fix X Issues" to automatically repair detected problems
   - The system will attempt to resolve all issues in order of severity

5. **Force Sync**
   - Use "Force Sync" to push all local data to the backend
   - Useful when you suspect data is stuck in local storage

### 2. Real-time Monitoring

The system now includes enhanced real-time monitoring:

- **Automatic Retry Mechanism**: Failed sync operations are retried up to 3 times
- **Enhanced Logging**: Detailed logs of all sync activities
- **Connection Recovery**: Automatic reconnection when network issues are resolved

## Troubleshooting Steps

### Step 1: Check Network Connectivity
1. Open the Debug Ledger panel
2. Verify the connection status shows "Connected" (green WiFi icon)
3. If disconnected, check your internet connection and try refreshing

### Step 2: Refresh Data
1. Click "Refresh Data" in the debug panel
2. Wait for the operation to complete
3. Check if data counts match between local and backend

### Step 3: Detect and Fix Issues
1. Click "Check Sync Issues" to scan for problems
2. Review the detected issues and their descriptions
3. Click "Fix X Issues" to automatically repair problems
4. Monitor the logs for successful fixes

### Step 4: Verify Synchronization
1. Create a test loading slip on one device
2. Check if it appears on other devices within 30 seconds
3. Create a memo from the loading slip
4. Verify the memo is properly linked and visible on all devices

## Advanced Debugging

### Manual Data Inspection

You can manually inspect data using browser developer tools:

```javascript
// Check local storage data
console.log('Loading Slips:', JSON.parse(localStorage.getItem('loadingSlips')));
console.log('Memos:', JSON.parse(localStorage.getItem('memos')));

// Check for unlinked items
const loadingSlips = JSON.parse(localStorage.getItem('loadingSlips') || '[]');
const memos = JSON.parse(localStorage.getItem('memos') || '[]');

const unlinkedSlips = loadingSlips.filter(slip => !slip.linkedMemoNo);
const unlinkedMemos = memos.filter(memo => !memo.linkedLoadingSlipId);

console.log('Unlinked Loading Slips:', unlinkedSlips);
console.log('Unlinked Memos:', unlinkedMemos);
```

### Network Debugging

Check network requests in browser developer tools:

1. Open Developer Tools (F12)
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Perform actions and monitor API calls
5. Look for failed requests (red entries)

### Socket.io Debugging

Monitor WebSocket connections:

```javascript
// Check socket connection status
const socket = io();
console.log('Socket connected:', socket.connected);
console.log('Socket ID:', socket.id);

// Listen for connection events
socket.on('connect', () => console.log('Connected to server'));
socket.on('disconnect', () => console.log('Disconnected from server'));
socket.on('connect_error', (error) => console.error('Connection error:', error));
```

## Prevention Best Practices

### 1. Stable Network Connection
- Ensure stable internet connectivity before performing critical operations
- Avoid switching networks during data entry
- Use wired connections when possible for better stability

### 2. Regular Sync Checks
- Use the debug panel regularly to check sync status
- Run "Check Sync Issues" periodically
- Monitor the sync logs for any recurring problems

### 3. Proper Workflow
- Always wait for operations to complete before proceeding
- Don't close the browser during data entry
- Use the "Refresh Data" button if you suspect sync issues

### 4. Backup Strategy
- Export important data regularly
- Keep local backups of critical information
- Use the debug panel to verify data integrity

## Emergency Recovery

If you encounter severe synchronization issues:

1. **Stop all operations** on all devices
2. **Check network connectivity** on all devices
3. **Use the debug panel** to identify the scope of the problem
4. **Run "Fix All Issues"** to attempt automatic recovery
5. **If automatic fix fails**, contact support with the debug logs

## Support Information

When reporting synchronization issues, please include:

1. **Debug Panel Screenshots**: Show connection status and detected issues
2. **Sync Logs**: Copy the logs from the debug panel
3. **Network Information**: Describe your network setup
4. **Steps to Reproduce**: Detailed steps that led to the issue
5. **Affected Devices**: List all devices involved

## Technical Details

### Real-time Sync Architecture

The system uses a hybrid approach:
- **Socket.io**: For real-time updates across devices
- **REST API**: For reliable data persistence
- **Local Storage**: For offline capability and performance
- **Automatic Retry**: For handling temporary network issues

### Data Flow

1. **Create/Update**: Data is saved to backend API
2. **Broadcast**: Server broadcasts changes to all connected devices
3. **Receive**: Other devices receive updates via Socket.io
4. **Update**: Local storage is updated with new data
5. **UI Refresh**: Components automatically refresh to show new data

### Error Handling

- **Network Failures**: Automatic retry with exponential backoff
- **API Errors**: Fallback to local storage with sync queue
- **Data Conflicts**: Server-side conflict resolution
- **Connection Loss**: Automatic reconnection and data sync

This comprehensive debugging system ensures that your data remains synchronized across all devices, even in challenging network conditions.
