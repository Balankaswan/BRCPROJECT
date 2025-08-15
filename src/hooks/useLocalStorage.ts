import { useState, useEffect } from 'react';
import { getFromStorage, saveToStorage } from '../utils/storage';

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(() => getFromStorage(key, defaultValue));

  useEffect(() => {
    saveToStorage(key, value);
  }, [key, value]);

  return [value, setValue] as const;
};