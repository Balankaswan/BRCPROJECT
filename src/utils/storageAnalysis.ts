// Storage capacity analysis for BRC Logistics Management System

export interface StorageEstimate {
  entityType: string;
  avgSizeBytes: number;
  estimatedCapacity: number;
  description: string;
}

// Average size estimates for each entity (in bytes)
export const ENTITY_SIZE_ESTIMATES: StorageEstimate[] = [
  {
    entityType: 'Party',
    avgSizeBytes: 200, // name, mobile, address, gst, balance, etc.
    estimatedCapacity: 50000, // ~50K parties max
    description: 'Basic party information with contact details'
  },
  {
    entityType: 'Supplier', 
    avgSizeBytes: 180,
    estimatedCapacity: 55000, // ~55K suppliers max
    description: 'Supplier information similar to parties'
  },
  {
    entityType: 'Bill',
    avgSizeBytes: 800, // multiple trips, advances, detailed info
    estimatedCapacity: 12500, // ~12.5K bills max
    description: 'Complete bill with trips, advances, and details'
  },
  {
    entityType: 'Memo',
    avgSizeBytes: 400, // memo details with advances
    estimatedCapacity: 25000, // ~25K memos max
    description: 'Memo with supplier and advance information'
  },
  {
    entityType: 'Loading Slip',
    avgSizeBytes: 300, // vehicle, route, weight details
    estimatedCapacity: 33000, // ~33K loading slips max
    description: 'Loading slip with vehicle and cargo details'
  },
  {
    entityType: 'Bank Entry',
    avgSizeBytes: 150, // date, amount, narration
    estimatedCapacity: 66000, // ~66K bank entries max
    description: 'Bank transaction records'
  },
  {
    entityType: 'POD',
    avgSizeBytes: 250, // file references, not actual files
    estimatedCapacity: 40000, // ~40K POD records max
    description: 'POD metadata (files stored separately)'
  }
];

// Calculate realistic business capacity
export const calculateBusinessCapacity = () => {
  const realistic = {
    parties: 1000, // 1K parties
    suppliers: 500, // 500 suppliers  
    billsPerYear: 2400, // 200 bills/month
    memosPerYear: 6000, // 500 memos/month
    loadingSlipsPerYear: 12000, // 1000 slips/month
    bankEntriesPerYear: 3600, // 300 entries/month
    podsPerYear: 2400 // 200 PODs/month
  };

  const yearlyDataSize = 
    (realistic.parties * 200) +
    (realistic.suppliers * 180) +
    (realistic.billsPerYear * 800) +
    (realistic.memosPerYear * 400) +
    (realistic.loadingSlipsPerYear * 300) +
    (realistic.bankEntriesPerYear * 150) +
    (realistic.podsPerYear * 250);

  return {
    realistic,
    yearlyDataSizeMB: (yearlyDataSize / (1024 * 1024)).toFixed(2),
    yearsOfDataStorage: Math.floor((10 * 1024 * 1024) / yearlyDataSize),
    maxStorageUtilization: ((yearlyDataSize / (10 * 1024 * 1024)) * 100).toFixed(1)
  };
};

// Check current storage usage
export const getCurrentStorageUsage = (): {
  usedBytes: number;
  usedMB: string;
  availableBytes: number;
  availableMB: string;
  usagePercentage: string;
} => {
  let totalSize = 0;
  
  // Calculate size of all localStorage data
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key) && key.startsWith('brc_')) {
      totalSize += localStorage[key].length * 2; // 2 bytes per character (UTF-16)
    }
  }

  const maxStorage = 10 * 1024 * 1024; // 10MB limit
  const availableBytes = maxStorage - totalSize;
  
  return {
    usedBytes: totalSize,
    usedMB: (totalSize / (1024 * 1024)).toFixed(2),
    availableBytes,
    availableMB: (availableBytes / (1024 * 1024)).toFixed(2),
    usagePercentage: ((totalSize / maxStorage) * 100).toFixed(1)
  };
};

// Storage optimization tips
export const STORAGE_OPTIMIZATION_TIPS = [
  'Archive old data (bills/memos older than 2-3 years)',
  'Use data compression for large text fields',
  'Implement data export/backup functionality',
  'Consider migrating to IndexedDB for larger storage needs',
  'Store POD files externally (cloud storage) with references only',
  'Implement data pagination for large lists',
  'Use efficient data structures (avoid redundant fields)',
  'Implement automatic cleanup of temporary data'
];

// Warning thresholds
export const STORAGE_THRESHOLDS = {
  WARNING: 70, // 70% usage
  CRITICAL: 85, // 85% usage
  MAXIMUM: 95  // 95% usage
};
