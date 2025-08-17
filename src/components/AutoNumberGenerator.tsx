import React from 'react';
import { useCounters } from '../hooks/useCounters';

interface AutoNumberGeneratorProps {
  type: 'loadingSlip' | 'memo' | 'bill';
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  className?: string;
  disabled?: boolean;
}

const AutoNumberGenerator: React.FC<AutoNumberGeneratorProps> = ({
  type,
  value,
  onChange,
  prefix = '',
  className = '',
  disabled = false
}) => {
  const { getNextNumber, getNextNumberPreview, updateCounterIfHigher } = useCounters();

  const handleAutoGenerate = () => {
    const nextNumber = getNextNumber(type);
    const formattedNumber = prefix + nextNumber;
    onChange(formattedNumber);
  };

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Update counter if manual number is higher
    if (newValue) {
      updateCounterIfHigher(type, newValue);
    }
  };

  const nextPreview = prefix + getNextNumberPreview(type);

  return (
    <div className="flex items-center space-x-2">
      <input
        type="text"
        value={value}
        onChange={handleManualChange}
        placeholder={`Enter ${type} number or click Auto`}
        className={`flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleAutoGenerate}
        disabled={disabled}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Auto ({nextPreview})
      </button>
    </div>
  );
};

export default AutoNumberGenerator;
