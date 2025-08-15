import React, { useState, useEffect, useRef } from 'react';
import { User, Building2, X, Plus } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { Party, Supplier } from '../types';

interface DragDropInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  type: 'party' | 'supplier';
  onAddNew?: (name: string, type: 'party' | 'supplier') => void;
}

const DragDropInput: React.FC<DragDropInputProps> = ({
  label,
  value,
  onChange,
  placeholder = '',
  required = false,
  className = '',
  type,
  onAddNew
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState(value);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get data from localStorage based on type
  const [parties, setParties] = useLocalStorage<Party[]>(STORAGE_KEYS.PARTIES, []);
  const [suppliers, setSuppliers] = useLocalStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);

  const data = type === 'party' ? parties : suppliers;
  const Icon = type === 'party' ? User : Building2;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    // Close suggestions when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // Filter suggestions based on input
    if (newValue.trim()) {
      const filtered = data.filter((item: any) =>
        item.name.toLowerCase().includes(newValue.toLowerCase())
      ).slice(0, 8);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions(data.slice(0, 8));
      setShowSuggestions(data.length > 0);
    }
  };

  const handleInputFocus = () => {
    const filtered = inputValue.trim() 
      ? data.filter((item: any) =>
          item.name.toLowerCase().includes(inputValue.toLowerCase())
        ).slice(0, 8)
      : data.slice(0, 8);
    
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const handleSuggestionClick = (suggestion: any) => {
    setInputValue(suggestion.name);
    onChange(suggestion.name);
    setShowSuggestions(false);
  };

  const handleAddNew = () => {
    if (!inputValue.trim()) return;
    
    if (type === 'party') {
      const newParty: Party = {
        id: Date.now().toString(),
        name: inputValue.trim(),
        mobile: '',
        balance: 0,
        activeTrips: 0,
        createdAt: new Date().toISOString()
      };
      setParties(prev => [...prev, newParty]);
    } else {
      const newSupplier: Supplier = {
        id: Date.now().toString(),
        name: inputValue.trim(),
        mobile: '',
        balance: 0,
        activeTrips: 0,
        createdAt: new Date().toISOString()
      };
      setSuppliers(prev => [...prev, newSupplier]);
    }
    
    // Call the optional callback
    if (onAddNew) {
      onAddNew(inputValue.trim(), type);
    }
    
    setShowSuggestions(false);
  };

  // Check if current input value exists in data
  const isNewItem = inputValue.trim() && !data.some((item: any) => 
    item.name.toLowerCase() === inputValue.toLowerCase()
  );

  const clearInput = () => {
    setInputValue('');
    onChange('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedText = e.dataTransfer.getData('text/plain');
    if (droppedText.trim()) {
      setInputValue(droppedText.trim());
      onChange(droppedText.trim());
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          placeholder={placeholder}
          required={required}
          className={`block w-full pl-10 pr-10 py-2 border rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${
            isDragOver 
              ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400' 
              : 'border-gray-300'
          }`}
        />
        
        {inputValue && (
          <button
            type="button"
            onClick={clearInput}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Auto-complete suggestions dropdown */}
      {showSuggestions && (suggestions.length > 0 || isNewItem) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none flex items-center justify-between"
            >
              <div className="flex items-center">
                <Icon className="h-3 w-3 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">{suggestion.name}</span>
              </div>
              {suggestion.mobile && (
                <span className="text-xs text-gray-500">{suggestion.mobile}</span>
              )}
            </button>
          ))}
          
          {/* Add New option when input doesn't match existing items */}
          {isNewItem && (
            <button
              type="button"
              onClick={handleAddNew}
              className="w-full px-4 py-2 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none flex items-center border-t border-gray-200"
            >
              <div className="flex items-center">
                <Plus className="h-3 w-3 text-green-600 mr-2" />
                <span className="text-sm text-green-700 font-medium">
                  Add new {type}: "{inputValue.trim()}"
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Drag & Drop visual feedback */}
      {isDragOver && (
        <div className="mt-1 text-xs text-blue-600 font-medium">
          Drop here!
        </div>
      )}
    </div>
  );
};

export default DragDropInput;
