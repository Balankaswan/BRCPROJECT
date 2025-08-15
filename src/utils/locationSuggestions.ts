import { getFromStorage, saveToStorage, STORAGE_KEYS } from './storage';

export interface LocationSuggestion {
  id: string;
  name: string;
  frequency: number; // How often this location is used
  lastUsed: string;
}

/**
 * Get all location suggestions from storage
 */
export const getLocationSuggestions = (): LocationSuggestion[] => {
  return getFromStorage(STORAGE_KEYS.LOCATION_SUGGESTIONS, []);
};

/**
 * Add or update a location suggestion
 */
export const addLocationSuggestion = (locationName: string): void => {
  if (!locationName.trim()) return;
  
  const suggestions = getLocationSuggestions();
  const existingSuggestion = suggestions.find(
    s => s.name.toLowerCase() === locationName.toLowerCase()
  );
  
  if (existingSuggestion) {
    // Update existing suggestion
    existingSuggestion.frequency += 1;
    existingSuggestion.lastUsed = new Date().toISOString();
  } else {
    // Add new suggestion
    const newSuggestion: LocationSuggestion = {
      id: Date.now().toString(),
      name: locationName.trim(),
      frequency: 1,
      lastUsed: new Date().toISOString()
    };
    suggestions.push(newSuggestion);
  }
  
  // Sort by frequency and recency
  suggestions.sort((a, b) => {
    if (a.frequency !== b.frequency) {
      return b.frequency - a.frequency; // Higher frequency first
    }
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(); // More recent first
  });
  
  saveToStorage(STORAGE_KEYS.LOCATION_SUGGESTIONS, suggestions);
};

/**
 * Get filtered location suggestions based on input
 */
export const getFilteredLocationSuggestions = (input: string, limit: number = 10): LocationSuggestion[] => {
  if (!input.trim()) {
    return getLocationSuggestions().slice(0, limit);
  }
  
  const suggestions = getLocationSuggestions();
  const filtered = suggestions.filter(suggestion =>
    suggestion.name.toLowerCase().includes(input.toLowerCase())
  );
  
  return filtered.slice(0, limit);
};

/**
 * Initialize location suggestions from existing data
 */
export const initializeLocationSuggestionsFromExistingData = (): void => {
  const loadingSlips = getFromStorage(STORAGE_KEYS.LOADING_SLIPS, []);
  const memos = getFromStorage(STORAGE_KEYS.MEMOS, []);
  const bills = getFromStorage(STORAGE_KEYS.BILLS, []);
  
  // Collect all locations
  const locations = new Set<string>();
  
  // From loading slips
  loadingSlips.forEach((slip: any) => {
    if (slip.from) locations.add(slip.from);
    if (slip.to) locations.add(slip.to);
  });
  
  // From memos
  memos.forEach((memo: any) => {
    if (memo.from) locations.add(memo.from);
    if (memo.to) locations.add(memo.to);
  });
  
  // From bills (trips)
  bills.forEach((bill: any) => {
    if (bill.trips) {
      bill.trips.forEach((trip: any) => {
        if (trip.from) locations.add(trip.from);
        if (trip.to) locations.add(trip.to);
      });
    }
  });
  
  // Add all unique locations
  locations.forEach(location => {
    if (location.trim()) {
      addLocationSuggestion(location);
    }
  });
};
