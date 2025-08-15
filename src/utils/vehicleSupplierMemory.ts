import { STORAGE_KEYS } from './storage';

export interface VehicleSupplierMapping {
  id: string;
  vehicleNo: string;
  supplierName: string;
  lastUsed: string;
  frequency: number;
}

const VEHICLE_SUPPLIER_KEY = 'vehicleSupplierMappings';

export const getVehicleSupplierMappings = (): VehicleSupplierMapping[] => {
  try {
    const stored = localStorage.getItem(VEHICLE_SUPPLIER_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading vehicle-supplier mappings:', error);
    return [];
  }
};

export const saveVehicleSupplierMapping = (vehicleNo: string, supplierName: string): void => {
  if (!vehicleNo.trim() || !supplierName.trim()) return;

  const mappings = getVehicleSupplierMappings();
  const existingIndex = mappings.findIndex(
    m => m.vehicleNo.toLowerCase() === vehicleNo.toLowerCase() && 
         m.supplierName.toLowerCase() === supplierName.toLowerCase()
  );

  if (existingIndex >= 0) {
    // Update existing mapping
    mappings[existingIndex] = {
      ...mappings[existingIndex],
      lastUsed: new Date().toISOString(),
      frequency: mappings[existingIndex].frequency + 1
    };
  } else {
    // Create new mapping
    const newMapping: VehicleSupplierMapping = {
      id: Date.now().toString(),
      vehicleNo: vehicleNo.trim(),
      supplierName: supplierName.trim(),
      lastUsed: new Date().toISOString(),
      frequency: 1
    };
    mappings.push(newMapping);
  }

  try {
    localStorage.setItem(VEHICLE_SUPPLIER_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.error('Error saving vehicle-supplier mapping:', error);
  }
};

export const getVehiclesForSupplier = (supplierName: string): string[] => {
  if (!supplierName.trim()) return [];

  const mappings = getVehicleSupplierMappings();
  const supplierMappings = mappings
    .filter(m => m.supplierName.toLowerCase().includes(supplierName.toLowerCase()))
    .sort((a, b) => {
      // Sort by frequency (descending) then by last used (descending)
      if (a.frequency !== b.frequency) {
        return b.frequency - a.frequency;
      }
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });

  return supplierMappings.map(m => m.vehicleNo);
};

export const getAllVehicles = (): string[] => {
  const mappings = getVehicleSupplierMappings();
  const uniqueVehicles = Array.from(new Set(mappings.map(m => m.vehicleNo)));
  
  // Sort by frequency and recency
  return uniqueVehicles.sort((a, b) => {
    const aMapping = mappings.find(m => m.vehicleNo === a);
    const bMapping = mappings.find(m => m.vehicleNo === b);
    
    if (!aMapping || !bMapping) return 0;
    
    if (aMapping.frequency !== bMapping.frequency) {
      return bMapping.frequency - aMapping.frequency;
    }
    return new Date(bMapping.lastUsed).getTime() - new Date(aMapping.lastUsed).getTime();
  });
};

export const initializeVehicleSupplierMappingsFromExistingData = (): void => {
  try {
    // Get existing loading slips to build initial mappings
    const loadingSlipsData = localStorage.getItem(STORAGE_KEYS.LOADING_SLIPS);
    if (!loadingSlipsData) return;

    const loadingSlips = JSON.parse(loadingSlipsData);
    const existingMappings = getVehicleSupplierMappings();

    loadingSlips.forEach((slip: any) => {
      if (slip.vehicleNo && slip.supplierDetail) {
        const exists = existingMappings.some(
          m => m.vehicleNo.toLowerCase() === slip.vehicleNo.toLowerCase() && 
               m.supplierName.toLowerCase() === slip.supplierDetail.toLowerCase()
        );

        if (!exists) {
          saveVehicleSupplierMapping(slip.vehicleNo, slip.supplierDetail);
        }
      }
    });
  } catch (error) {
    console.error('Error initializing vehicle-supplier mappings:', error);
  }
};
