import { useState, useEffect } from 'react';
import { getFromStorage, saveToStorage, STORAGE_KEYS } from '../utils/storage';

interface Counters {
  loadingSlip: number;
  memo: number;
  bill: number;
}

const defaultCounters: Counters = {
  loadingSlip: 5804, // Will return 5805 when getNextNumber() is called
  memo: 6020, // Will return 6021 when getNextNumber() is called
  bill: 5908  // Will return 5909 when getNextNumber() is called
};

export const useCounters = () => {
  const [counters, setCounters] = useState<Counters>(() => 
    getFromStorage(STORAGE_KEYS.COUNTERS, defaultCounters)
  );

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.COUNTERS, counters);
  }, [counters]);

  const getNextNumber = (type: keyof Counters): string => {
    const nextNumber = counters[type] + 1;
    
    setCounters(prev => ({
      ...prev,
      [type]: nextNumber
    }));
    
    return nextNumber.toString();
  };

  const updateCounterIfHigher = (type: keyof Counters, manualNumber: string): void => {
    // Extract numeric part from manual number (e.g., "M1005" -> 1005, "5525" -> 5525)
    const numericPart = parseInt(manualNumber.replace(/[^0-9]/g, ''), 10);
    
    if (!isNaN(numericPart) && numericPart >= counters[type]) {
      setCounters(prev => ({
        ...prev,
        [type]: numericPart + 1 // Set counter to manual number + 1
      }));
    }
  };

  const getNextNumberPreview = (type: keyof Counters): string => {
    // Returns what the next number would be without incrementing the counter
    return (counters[type] + 1).toString();
  };

  const resetCountersToDefaults = () => {
    setCounters(defaultCounters);
  };

  return {
    counters,
    getNextNumber,
    getNextNumberPreview,
    updateCounterIfHigher,
    resetCountersToDefaults
  };
};