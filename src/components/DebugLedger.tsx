import React, { useState, useEffect } from 'react';
import { RefreshCw, Wifi, WifiOff, AlertCircle, CheckCircle, Clock, Database, Server } from 'lucide-react';
import { useSyncStatus } from '../services/apiService';
import { apiService } from '../services/apiService';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { syncFixer, SyncIssue } from '../utils/syncFixer';

const DebugLedger: React.FC = () => {
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [dataCounts, setDataCounts] = useState<{[key: string]: number}>({});
  const [detectedIssues, setDetectedIssues] = useState<SyncIssue[]>([]);
  const [isFixingIssues, setIsFixingIssues] = useState(false);
  const { isConnected, lastSyncTime } = useSyncStatus();
  
  // Get localStorage data counts
  const [loadingSlips] = useLocalStorage(STORAGE_KEYS.LOADING_SLIPS, []);
  const [memos] = useLocalStorage(STORAGE_KEYS.MEMOS, []);
  const [bills] = useLocalStorage(STORAGE_KEYS.BILLS, []);
  const [parties] = useLocalStorage(STORAGE_KEYS.PARTIES, []);
  const [suppliers] = useLocalStorage(STORAGE_KEYS.SUPPLIERS, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSyncLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]); // Keep last 50 logs
  };

  const refreshAllData = async () => {
    setIsRefreshing(true);
    addLog('🔄 Starting comprehensive data refresh...');
    
    try {
      const startTime = Date.now();
      
      // Refresh all data from backend
      const [loadingSlipsData, memosData, billsData, partiesData, suppliersData] = await Promise.all([
        apiService.getLoadingSlips().catch(e => {
          addLog(`❌ Failed to fetch loading slips: ${e.message}`);
          return [];
        }),
        apiService.getMemos().catch(e => {
          addLog(`❌ Failed to fetch memos: ${e.message}`);
          return [];
        }),
        apiService.getBills().catch(e => {
          addLog(`❌ Failed to fetch bills: ${e.message}`);
          return [];
        }),
        apiService.getParties().catch(e => {
          addLog(`❌ Failed to fetch parties: ${e.message}`);
          return [];
        }),
        apiService.getSuppliers().catch(e => {
          addLog(`❌ Failed to fetch suppliers: ${e.message}`);
          return [];
        })
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Update data counts
      setDataCounts({
        loadingSlips: loadingSlipsData.length,
        memos: memosData.length,
        bills: billsData.length,
        parties: partiesData.length,
        suppliers: suppliersData.length
      });
      
      addLog(`✅ Data refresh completed in ${duration}ms`);
      addLog(`📊 Data counts: Loading Slips: ${loadingSlipsData.length}, Memos: ${memosData.length}, Bills: ${billsData.length}, Parties: ${partiesData.length}, Suppliers: ${suppliersData.length}`);
      
      setLastRefresh(new Date());
    } catch (error) {
      addLog(`❌ Comprehensive refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const checkSyncIssues = async () => {
    addLog('🔍 Checking for synchronization issues...');
    
    try {
      const issues = await syncFixer.detectIssues();
      setDetectedIssues(issues);
      
      if (issues.length === 0) {
        addLog('✅ No synchronization issues detected');
      } else {
        addLog(`⚠️ Found ${issues.length} synchronization issues:`);
        issues.forEach(issue => {
          addLog(`  - ${issue.description} (${issue.severity} severity)`);
        });
      }
    } catch (error) {
      addLog(`❌ Failed to check sync issues: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const fixAllIssues = async () => {
    setIsFixingIssues(true);
    addLog('🔧 Starting to fix all detected issues...');
    
    try {
      await syncFixer.fixAllIssues();
      const fixerLogs = syncFixer.getLogs();
      fixerLogs.forEach(log => addLog(log));
      
      // Refresh data after fixing
      await refreshAllData();
      await checkSyncIssues();
      
      addLog('✅ All issues have been addressed');
    } catch (error) {
      addLog(`❌ Failed to fix issues: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFixingIssues(false);
    }
  };

  const forceSync = async () => {
    addLog('🚀 Force syncing all data to backend...');
    
    try {
      // Force sync all data to backend
      await Promise.all([
        apiService.syncToBackend('loadingSlips', loadingSlips),
        apiService.syncToBackend('memos', memos),
        apiService.syncToBackend('bills', bills),
        apiService.syncToBackend('parties', parties),
        apiService.syncToBackend('suppliers', suppliers)
      ]);
      
      addLog('✅ Force sync completed successfully');
    } catch (error) {
      addLog(`❌ Force sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  useEffect(() => {
    // Initial data load
    refreshAllData();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(() => {
      if (isConnected) {
        refreshAllData();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <div className="space-y-6 p-6 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Synchronization Debug Panel</h2>
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
          <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Database className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Loading Slips</p>
              <p className="text-lg font-semibold text-gray-900">{dataCounts.loadingSlips || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Server className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Memos</p>
              <p className="text-lg font-semibold text-gray-900">{dataCounts.memos || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Bills</p>
              <p className="text-lg font-semibold text-gray-900">{dataCounts.bills || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-orange-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Last Sync</p>
              <p className="text-sm font-semibold text-gray-900">
                {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={refreshAllData}
          disabled={isRefreshing}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
        
        <button
          onClick={checkSyncIssues}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Check Sync Issues
        </button>
        
        <button
          onClick={fixAllIssues}
          disabled={isFixingIssues || detectedIssues.length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          {isFixingIssues ? 'Fixing Issues...' : `Fix ${detectedIssues.length} Issues`}
        </button>
        
        <button
          onClick={forceSync}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <Server className="h-4 w-4 mr-2" />
          Force Sync
        </button>
      </div>

      {/* Sync Logs */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Synchronization Logs</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {syncLogs.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No sync logs yet. Click "Refresh Data" to start monitoring.
            </div>
          ) : (
            <div className="p-4 space-y-1">
              {syncLogs.map((log, index) => (
                <div key={index} className="text-sm font-mono text-gray-700">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

             {/* Detected Issues */}
       {detectedIssues.length > 0 && (
         <div className="bg-white rounded-lg shadow">
           <div className="px-4 py-3 border-b border-gray-200">
             <h3 className="text-lg font-medium text-gray-900">Detected Issues ({detectedIssues.length})</h3>
           </div>
           <div className="p-4">
             <div className="space-y-3">
               {detectedIssues.map((issue, index) => (
                 <div key={index} className="border-l-4 border-yellow-400 pl-4 py-2">
                   <div className="flex items-center justify-between">
                     <div>
                       <h4 className="font-medium text-gray-900">{issue.description}</h4>
                       <p className="text-sm text-gray-600">Type: {issue.type}</p>
                       <p className="text-sm text-gray-600">Severity: {issue.severity}</p>
                       <p className="text-sm text-gray-600">Affected items: {issue.affectedItems.length}</p>
                     </div>
                     <div className={`px-2 py-1 rounded text-xs font-medium ${
                       issue.severity === 'high' ? 'bg-red-100 text-red-800' :
                       issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                       'bg-blue-100 text-blue-800'
                     }`}>
                       {issue.severity.toUpperCase()}
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         </div>
       )}

       {/* Data Comparison */}
       <div className="bg-white rounded-lg shadow">
         <div className="px-4 py-3 border-b border-gray-200">
           <h3 className="text-lg font-medium text-gray-900">Data Comparison</h3>
         </div>
         <div className="p-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <h4 className="font-medium text-gray-700 mb-2">Local Storage</h4>
               <div className="space-y-1 text-sm">
                 <div>Loading Slips: {loadingSlips.length}</div>
                 <div>Memos: {memos.length}</div>
                 <div>Bills: {bills.length}</div>
                 <div>Parties: {parties.length}</div>
                 <div>Suppliers: {suppliers.length}</div>
               </div>
             </div>
             <div>
               <h4 className="font-medium text-gray-700 mb-2">Backend Database</h4>
               <div className="space-y-1 text-sm">
                 <div>Loading Slips: {dataCounts.loadingSlips || 0}</div>
                 <div>Memos: {dataCounts.memos || 0}</div>
                 <div>Bills: {dataCounts.bills || 0}</div>
                 <div>Parties: {dataCounts.parties || 0}</div>
                 <div>Suppliers: {dataCounts.suppliers || 0}</div>
               </div>
             </div>
           </div>
         </div>
       </div>
    </div>
  );
};

export default DebugLedger;
