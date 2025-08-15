import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Truck } from 'lucide-react';
import { getVehiclesForSupplier, getAllVehicles, saveVehicleSupplierMapping } from '../utils/vehicleSupplierMemory';

interface VehicleAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  supplierName?: string;
  onVehicleSelected?: (vehicleNo: string, supplierName: string) => void;
}

const VehicleAutocomplete: React.FC<VehicleAutocompleteProps> = ({
  label,
  value,
  onChange,
  placeholder = "Enter vehicle number",
  required = false,
  supplierName = '',
  onVehicleSelected
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredVehicles, setFilteredVehicles] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get vehicles based on supplier selection
    let vehicles: string[] = [];
    
    if (supplierName.trim()) {
      // Get vehicles previously used with this supplier
      vehicles = getVehiclesForSupplier(supplierName);
    } else {
      // Get all vehicles if no supplier selected
      vehicles = getAllVehicles();
    }

    // Filter based on current input
    if (value.trim()) {
      vehicles = vehicles.filter(vehicle => 
        vehicle.toLowerCase().includes(value.toLowerCase())
      );
    }

    setFilteredVehicles(vehicles.slice(0, 10)); // Limit to 10 suggestions
  }, [value, supplierName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
  };

  const handleVehicleSelect = (vehicleNo: string) => {
    onChange(vehicleNo);
    setIsOpen(false);
    
    // Save the mapping if supplier is selected
    if (supplierName.trim()) {
      saveVehicleSupplierMapping(vehicleNo, supplierName);
      onVehicleSelected?.(vehicleNo, supplierName);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          placeholder={placeholder}
          required={required}
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <Truck className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && filteredVehicles.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {supplierName && (
            <div className="px-3 py-2 text-xs text-gray-500 bg-blue-50 border-b">
              Vehicles for: {supplierName}
            </div>
          )}
          
          {filteredVehicles.map((vehicle, index) => (
            <div
              key={index}
              onClick={() => handleVehicleSelect(vehicle)}
              className="px-3 py-2 cursor-pointer hover:bg-blue-50 flex items-center space-x-2 border-b border-gray-100 last:border-b-0"
            >
              <Truck className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">{vehicle}</span>
              {supplierName && (
                <span className="text-xs text-green-600 ml-auto">Previously used</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Helper text */}
      {supplierName && (
        <p className="mt-1 text-xs text-gray-500">
          💡 Showing vehicles previously used with this supplier
        </p>
      )}
    </div>
  );
};

export default VehicleAutocomplete;
