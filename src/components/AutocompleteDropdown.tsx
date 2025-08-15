import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

interface AutocompleteDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  label?: string;
  onCreateNew?: (value: string) => void;
  allowCreate?: boolean;
  required?: boolean;
  className?: string;
}

const AutocompleteDropdown: React.FC<AutocompleteDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "Type to search or select...",
  label,
  onCreateNew,
  allowCreate = false,
  required = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<string[]>(options);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update filtered options when value or options change
  useEffect(() => {
    if (!value) {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(option =>
        option.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
    setHighlightedIndex(-1);
  }, [value, options]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleOptionClick = (option: string) => {
    onChange(option);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleOptionClick(filteredOptions[highlightedIndex]);
        } else if (value && filteredOptions.length === 0 && onCreateNew) {
          onCreateNew(value);
          setIsOpen(false);
        }
        break;
      
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
      
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const handleCreateNew = () => {
    if (onCreateNew && value) {
      onCreateNew(value);
      setIsOpen(false);
    }
  };

  const shouldShowCreateOption = value && 
    filteredOptions.length === 0 && 
    !options.some(opt => opt.toLowerCase() === value.toLowerCase()) &&
    onCreateNew &&
    allowCreate;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          autoComplete="off"
        />
        
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown 
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>
      </div>

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-sm border border-gray-300 overflow-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <button
                key={option}
                type="button"
                onClick={() => handleOptionClick(option)}
                className={`w-full text-left px-3 py-2 hover:bg-blue-50 ${
                  index === highlightedIndex ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                } transition-colors duration-150`}
              >
                {option}
              </button>
            ))
          ) : value ? (
            shouldShowCreateOption ? (
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full text-left px-3 py-2 hover:bg-green-50 text-green-700 flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create "{value}"
              </button>
            ) : (
              <div className="px-3 py-2 text-gray-500">
                No matches found
              </div>
            )
          ) : (
            <div className="px-3 py-2 text-gray-500">
              Start typing to search...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AutocompleteDropdown;
