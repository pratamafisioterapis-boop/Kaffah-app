import React, { useState, useRef, useEffect } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  startOfWeek, 
  endOfWeek,
  setYear,
  getYear
} from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';


const DatePicker = ({ value, onChange, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00`);
    }
    return new Date();
  });

  const [selectedYear, setSelectedYear] = useState(() => getYear(currentMonth));
  const calendarRef = useRef(null);

  // Generate year options (current year +/- 50 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 101 }, (_, i) => currentYear - 50 + i);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handlePreviousMonth = () => {
    const newDate = subMonths(currentMonth, 1);
    setCurrentMonth(newDate);
    setSelectedYear(getYear(newDate));
  };

  const handleNextMonth = () => {
    const newDate = addMonths(currentMonth, 1);
    setCurrentMonth(newDate);
    setSelectedYear(getYear(newDate));
  };

  

  const handleDateClick = (date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    onChange(formattedDate);
    onClose(); 
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { locale: id }); 
  const endDate = endOfWeek(monthEnd, { locale: id });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDaysHeader = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;

  return (
    <div 
      ref={calendarRef}
      className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-80 p-4 animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={handlePreviousMonth}
          className="p-1 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
          type="button"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
              <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 capitalize">
                      {format(currentMonth, 'MMMM', { locale: id })}
                  </span>

          <input
            type="number"
            value={selectedYear}
            onChange={(e) => {
              const year = parseInt(e.target.value, 10);
              if (!isNaN(year)) {
                setSelectedYear(year);
                setCurrentMonth(prev => setYear(prev, year));
              }
            }}
            className="w-20 text-center text-sm font-semibold border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
              </div>

        <button 
          onClick={handleNextMonth}
          className="p-1 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
          type="button"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {weekDaysHeader.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-400 py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(day)}
              type="button"
              className={cn(
                "h-9 w-9 text-xs rounded-full flex items-center justify-center transition-all",
                !isCurrentMonth && "text-slate-300",
                isCurrentMonth && "text-slate-700 hover:bg-slate-100",
                isSelected && "bg-blue-600 text-white hover:bg-blue-700 shadow-md font-medium",
                !isSelected && isToday && "border border-blue-600 text-blue-600 font-medium"
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end pt-3 border-t border-slate-100">
        <button
          onClick={onClose}
          type="button"
          className="text-xs text-slate-500 hover:text-slate-800 font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};

export default DatePicker;