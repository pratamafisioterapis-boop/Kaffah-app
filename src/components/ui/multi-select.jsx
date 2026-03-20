import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const MultiSelect = ({ 
  options = [], 
  value = [], 
  onChange, 
  placeholder = "Select...", 
  className,
  creatable = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    if (!value.includes(optionValue)) {
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter((v) => v !== optionValue));
    }
    setSearchTerm("");
    inputRef.current?.focus();
  };

  const handleCreate = () => {
    if (searchTerm && !value.includes(searchTerm)) {
      onChange([...value, searchTerm]);
      setSearchTerm("");
      inputRef.current?.focus();
    }
  };

  const handleRemove = (optionValue, e) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  // Filter options based on search term
  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div
        className={cn(
          "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-within:ring-2 focus-within:ring-slate-950 focus-within:ring-offset-2",
          isOpen && "ring-2 ring-slate-950 ring-offset-2"
        )}
        onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
        }}
      >
        {value.map((val) => (
          <Badge key={val} variant="secondary" className="gap-1 pr-1 font-normal bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100">
            {val}
            <div
              className="ml-1 rounded-full p-0.5 outline-none hover:bg-blue-200 cursor-pointer"
              onClick={(e) => handleRemove(val, e)}
            >
              <X className="h-3 w-3" />
            </div>
          </Badge>
        ))}
        
        <input
          ref={inputRef}
          className="flex-1 bg-transparent outline-none placeholder:text-slate-500 min-w-[80px]"
          placeholder={value.length === 0 ? placeholder : ""}
          value={searchTerm}
          onChange={(e) => {
             setSearchTerm(e.target.value);
             if(!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && creatable && searchTerm) {
               e.preventDefault();
               handleCreate();
            }
            if (e.key === 'Backspace' && !searchTerm && value.length > 0) {
               onChange(value.slice(0, -1));
            }
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="p-1 max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 && !searchTerm && (
                <div className="py-2.5 px-2 text-center text-sm text-slate-500">
                   No options found.
                </div>
            )}
            
            {filteredOptions.length === 0 && searchTerm && creatable && (
                 <div 
                   className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none bg-slate-50 text-slate-900 hover:bg-slate-100 font-medium"
                   onClick={handleCreate}
                 >
                    <Plus className="mr-2 h-4 w-4" />
                    Create "{searchTerm}"
                 </div>
            )}

            {filteredOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100",
                  value.includes(option.value) && "bg-slate-50 font-medium"
                )}
                onClick={() => handleSelect(option.value)}
              >
                <div className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded border border-slate-300",
                    value.includes(option.value) ? "bg-slate-900 border-slate-900 text-white" : "opacity-50"
                )}>
                   {value.includes(option.value) && <Check className="h-3 w-3" />}
                </div>
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;