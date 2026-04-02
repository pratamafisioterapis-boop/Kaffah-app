import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SearchableSelect = ({ 
  options = [], 
  value, 
  onChange, 
  onSearch,
  onCreateOption,
  placeholder = "Cari...", 
  className,
  disabled = false,
  allowCreate = false,
  notFoundText = "Tidak ditemukan.",
  isLoading = false,
  multiple = false
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Defensive check for options
  const safeOptions = useMemo(() => {
    return Array.isArray(options) ? options : [];
  }, [options]);

  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : (value ? [value] : []);
    }
    return value;
  }, [value, multiple]);

  const getLabel = (val) => {
    if (val === null || val === undefined) return "";
    const opt = safeOptions.find(o => o.value === val);
    return opt ? opt.label : val;
  };

  const selectedLabels = useMemo(() => {
    if (multiple) {
      return selectedValues.map(getLabel).filter(Boolean).join(", ");
    }
    const opt = safeOptions.find(o => o.value === value);
    return opt ? opt.label : (value ? String(value) : "");
  }, [selectedValues, value, safeOptions, multiple]);

  // Sync search term with selected value when dropdown closes
  useEffect(() => {
    if (!open) {
      if (multiple) {
        setSearchTerm("");
      } else {
        const label = selectedLabels;
        setSearchTerm(typeof label === 'string' ? label : "");
      }
    }
  }, [open, selectedLabels, multiple]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm || (searchTerm === selectedLabels && !multiple)) {
      return safeOptions;
    }
    
    const lowerTerm = searchTerm.toLowerCase().trim();
    
    // Debug logging as requested
    console.log(`[SearchableSelect] Filtering for: "${lowerTerm}"`);
    
    return safeOptions.filter(opt => {
      const labelMatch = String(opt.label || '').toLowerCase().includes(lowerTerm);
      const valueMatch = String(opt.value || '').toLowerCase().includes(lowerTerm);
      return labelMatch || valueMatch;
    });
  }, [safeOptions, searchTerm, selectedLabels, multiple]);

  const handleSelect = (optionValue) => {
    if (multiple) {
      const isSelected = selectedValues.includes(optionValue);
      let newValues;
      if (isSelected) {
        newValues = selectedValues.filter(v => v !== optionValue);
      } else {
        newValues = [...selectedValues, optionValue];
      }
      onChange(newValues);
      setSearchTerm("");
      inputRef.current?.focus();
    } else {
      onChange(optionValue);
      setSearchTerm(getLabel(optionValue));
      setOpen(false);
    }
  };

  const handleRemoveItem = (e, valToRemove) => {
    e.stopPropagation();
    if (multiple) {
      const newValues = selectedValues.filter(v => v !== valToRemove);
      onChange(newValues);
    } else {
      onChange("");
      setSearchTerm("");
    }
  };

  const handleCreate = async () => {
    if (!allowCreate || !searchTerm) return;

    if (onCreateOption) {
      const success = await onCreateOption(searchTerm);
      if (success) {
        setSearchTerm("");
        setOpen(false);
      }
      return;
    }

    // fallback
    if (multiple) {
      onChange([...selectedValues, searchTerm]);
      setSearchTerm("");
    } else {
      onChange(searchTerm);
      setOpen(false);
    }
  };

  const handleInputChange = (e) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    setOpen(true);
    if(onSearch) {
        onSearch(newSearchTerm);
    }
  };

  const handleInputFocus = () => {
    if (!multiple) {
      // Clear the input temporarily while focused so user can see all options and search easily
      setSearchTerm("");
    }
    setOpen(true);
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div 
        className={cn(
          "flex min-h-[40px] w-full flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white focus-within:ring-2 focus-visible:ring-blue-500 focus-within:ring-offset-2 transition-all hover:border-slate-400",
          disabled && "cursor-not-allowed opacity-50 bg-slate-50"
        )}
        onClick={() => !disabled && (setOpen(true), inputRef.current?.focus())}
      >
        {multiple && selectedValues.length > 0 && (
            <div className="flex flex-wrap gap-1 mr-1">
                {selectedValues.map(val => (
                <Badge key={val} variant="secondary" className="mr-1 mb-1 bg-slate-100 text-slate-700 hover:bg-slate-200">
                    {getLabel(val)}
                    <button
                      type="button"
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => handleRemoveItem(e, val)}
                    >
                    <X className="h-3 w-3 text-slate-500 hover:text-red-500" />
                    </button>
                </Badge>
                ))}
            </div>
        )}

        <div className="flex-1 min-w-[50px] relative">
           <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={multiple && selectedValues.length > 0 ? "" : placeholder}
            disabled={disabled}
            className="w-full bg-transparent outline-none placeholder:text-slate-400 text-slate-900"
            autoComplete="off"
          />
        </div>

        <div className="flex items-center gap-1 text-slate-400 shrink-0">
           {!multiple && value && !disabled && (
             <button
               type="button"
               onClick={(e) => handleRemoveItem(e, value)}
               className="hover:bg-slate-100 p-0.5 rounded text-slate-400 hover:text-slate-600 focus:outline-none"
             >
               <X className="h-4 w-4" />
             </button>
           )}
           <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
          {isLoading ? (
             <div className="p-4 flex items-center justify-center text-slate-500 text-sm">
               <Loader2 className="w-4 h-4 animate-spin mr-2 text-blue-500" />
               Memuat data...
             </div>
          ) : filteredOptions.length === 0 ? (
             <div className="p-2">
               {allowCreate && searchTerm ? (
                 <div
                    onClick={(e) => { e.stopPropagation(); handleCreate(); }}
                    className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer rounded flex items-center gap-2"
                 >
                   <Plus className="w-4 h-4" />
                   Buat "{searchTerm}"
                 </div>
               ) : (
                 <div className="px-3 py-2 text-sm text-slate-500 text-center">
                   {notFoundText}
                 </div>
               )}
             </div>
          ) : (
             <div className="p-1">
               {filteredOptions.map((option) => {
                 const isSelected = multiple 
                   ? selectedValues.includes(option.value)
                   : value === option.value;
                 return (
                   <div
                     key={option.value}
                     onClick={() => handleSelect(option.value)}
                     className={cn(
                       "px-3 py-2 text-sm rounded cursor-pointer flex items-center justify-between transition-colors",
                       isSelected 
                         ? "bg-blue-50 text-blue-900 font-medium" 
                         : "hover:bg-slate-100 text-slate-900"
                     )}
                   >
                     <span>{option.label}</span>
                     {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                   </div>
                 );
               })}
               {allowCreate && searchTerm && !safeOptions.some(o => o.label.toLowerCase() === searchTerm.toLowerCase()) && (
                 <div
                    onClick={(e) => { e.stopPropagation(); handleCreate(); }}
                    className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer rounded flex items-center gap-2 border-t border-slate-200 mt-1"
                 >
                   <Plus className="w-4 h-4" />
                   Buat "{searchTerm}"
                 </div>
               )}
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;