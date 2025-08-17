import React, { useState, useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';
import { getFilteredLocationSuggestions, addLocationSuggestion } from '../utils/locationSuggestions';

interface AutoCompleteLocationInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const AutoCompleteLocationInput: React.FC<AutoCompleteLocationInputProps> = ({
  label,
  value,
  onChange,
  placeholder = '',
  required = false,
  className = ''
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    // Get filtered suggestions
    const filteredSuggestions = getFilteredLocationSuggestions(newValue, 8);
    setSuggestions(filteredSuggestions);
    setShowSuggestions(filteredSuggestions.length > 0);
  };

  const handleInputFocus = () => {
    const filteredSuggestions = getFilteredLocationSuggestions(inputValue, 8);
    setSuggestions(filteredSuggestions);
    setShowSuggestions(filteredSuggestions.length > 0);
  };

  const handleSuggestionClick = (suggestion: any) => {
    setInputValue(suggestion.name);
    onChange(suggestion.name);
    setShowSuggestions(false);
    addLocationSuggestion(suggestion.name); // Update frequency
  };

  const handleInputBlur = () => {
    // Add location to suggestions if it's new
    if (inputValue.trim()) {
      addLocationSuggestion(inputValue.trim());
    }
  };

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
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedText = e.dataTransfer.getData('text/plain');
    if (droppedText.trim()) {
      setInputValue(droppedText.trim());
      onChange(droppedText.trim());
      addLocationSuggestion(droppedText.trim());
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin className="h-4 w-4 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          placeholder={placeholder}
          required={required}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
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
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id || `suggestion-${index}-${suggestion.name}`}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none flex items-center justify-between"
            >
              <div className="flex items-center">
                <MapPin className="h-3 w-3 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">{suggestion.name}</span>
              </div>
              <span className="text-xs text-gray-500">
                {suggestion.frequency > 1 && `${suggestion.frequency}x`}
              </span>
            </button>
          ))}
        </div>
      )}


    </div>
  );
};

export default AutoCompleteLocationInput;
