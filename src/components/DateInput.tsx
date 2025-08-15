import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}

const DateInput: React.FC<DateInputProps> = ({ 
  value, 
  onChange, 
  label, 
  required = false, 
  className = '' 
}) => {
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    if (value) {
      const date = new Date(value);
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      };
    }
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate()
    };
  });

  // Generate years from 2001 to current year
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2000 }, (_, i) => currentYear - i);

  useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      });
    }
  }, [value]);

  const handleYearChange = (year: number) => {
    const newDate = { ...selectedDate, year };
    setSelectedDate(newDate);
    
    // Ensure the day is valid for the selected month/year
    const daysInMonth = new Date(year, newDate.month, 0).getDate();
    const validDay = Math.min(newDate.day, daysInMonth);
    
    const dateString = `${year}-${String(newDate.month).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
    onChange(dateString);
    setShowYearDropdown(false);
  };

  const handleMonthChange = (month: number) => {
    const newDate = { ...selectedDate, month };
    setSelectedDate(newDate);
    
    // Ensure the day is valid for the selected month/year
    const daysInMonth = new Date(newDate.year, month, 0).getDate();
    const validDay = Math.min(newDate.day, daysInMonth);
    
    const dateString = `${newDate.year}-${String(month).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
    onChange(dateString);
  };

  const handleDayChange = (day: number) => {
    const newDate = { ...selectedDate, day };
    setSelectedDate(newDate);
    
    const dateString = `${newDate.year}-${String(newDate.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateString);
  };

  const handleDirectDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (newValue) {
      const date = new Date(newValue);
      setSelectedDate({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      });
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        {/* Standard HTML5 date input for mobile compatibility */}
        <input
          type="date"
          value={value}
          onChange={handleDirectDateChange}
          required={required}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {/* Custom year dropdown overlay for desktop */}
        <div className="hidden md:block absolute inset-0 bg-white border border-gray-300 rounded-md">
          <div className="flex items-center h-full px-3 space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            
            {/* Year Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowYearDropdown(!showYearDropdown)}
                className="flex items-center space-x-1 px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50"
              >
                <span>{selectedDate.year}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              
              {showYearDropdown && (
                <div className="absolute top-full left-0 mt-1 w-20 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  {years.map(year => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => handleYearChange(year)}
                      className={`w-full px-3 py-1 text-left text-sm hover:bg-blue-50 ${
                        year === selectedDate.year ? 'bg-blue-100 text-blue-700' : ''
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Month Dropdown */}
            <select
              value={selectedDate.month}
              onChange={(e) => handleMonthChange(parseInt(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {months.map((month, index) => (
                <option key={index + 1} value={index + 1}>
                  {month.substring(0, 3)}
                </option>
              ))}
            </select>
            
            {/* Day Dropdown */}
            <select
              value={selectedDate.day}
              onChange={(e) => handleDayChange(parseInt(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Array.from({ length: getDaysInMonth(selectedDate.year, selectedDate.month) }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateInput;
