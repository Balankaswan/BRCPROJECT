import { useState, useEffect } from 'react';
import { backendDataService } from '../services/backendDataService';

// Generic hook for backend data
export function useBackendData<T>(tableName: string, fetchFunction: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const result = await fetchFunction();
        if (mounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'An error occurred');
          console.error(`Error loading ${tableName}:`, err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    // Subscribe to real-time updates
    const unsubscribe = backendDataService.subscribe(tableName, (newData) => {
      if (mounted) {
        setData(newData);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [tableName]);

  return { data, loading, error, setData };
}

// Specific hooks for each entity
export function useLoadingSlips() {
  return useBackendData('loading_slips', () => backendDataService.getLoadingSlips());
}

export function useMemos() {
  return useBackendData('memos', () => backendDataService.getMemos());
}

export function useBills() {
  return useBackendData('bills', () => backendDataService.getBills());
}

export function useBankEntries() {
  return useBackendData('bank_entries', () => backendDataService.getBankEntries());
}

export function useParties() {
  return useBackendData('parties', () => backendDataService.getParties());
}

export function useSuppliers() {
  return useBackendData('suppliers', () => backendDataService.getSuppliers());
}

// Counter hook
export function useCounters() {
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCounters = async () => {
      try {
        const result = await backendDataService.getCounters();
        setCounters(result);
      } catch (error) {
        console.error('Error loading counters:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCounters();
  }, []);

  const updateCounter = async (id: string, value: number) => {
    try {
      await backendDataService.updateCounter(id, value);
      setCounters(prev => ({ ...prev, [id]: value }));
    } catch (error) {
      console.error('Error updating counter:', error);
    }
  };

  const updateCounterIfHigher = async (id: string, value: number) => {
    const currentValue = counters[id] || 0;
    if (value > currentValue) {
      await updateCounter(id, value + 1);
    }
  };

  return { counters, loading, updateCounter, updateCounterIfHigher };
}
