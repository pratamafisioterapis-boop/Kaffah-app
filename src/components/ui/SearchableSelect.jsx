import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, Loader2, Plus, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SearchableSelect = ({ 
  options = [], 
  value, 
  onChange, 
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

  // Defensive check: Ensure options is always an array
  const safeOptions = useMemo(() => {
    return Array.isArray(options) ? options : [];
  }, [options]);

  // Defensive check: Ensure value is handled safely
  const selectedValues = useMemo(() => {
    if (multiple) {
      if (Array.isArray(value)) return value;
      if (value !== null && value !== undefined && value !== '') return [value];
      return [];
    }
    return value;
  }, [value, multiple]);

  const getLabel = (val) => {
    if (!val) return "";

    const opt = safeOptions.find(o => o.value === val);

    // Kalau UUID tapi belum ada di options, jangan tampilkan UUID
    if (!opt && /^[0-9a-f-]{36}$/i.test(val)) {
      return "Loading...";
    }

    return opt ? opt.label : val;
  };

  const selectedLabels = useMemo(() => {
    if (multiple) {
      return selectedValues.map(getLabel).join(", ");
    }
    return getLabel(value) || "";
  }, [selectedValues, value, safeOptions, multiple]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        // Reset search term when closing
        if (!multiple && value) {
          setSearchTerm("");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [multiple, value]);

  // Fixed filtering logic
  const filteredOptions = useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();

    if (!term) return safeOptions;

    return safeOptions.filter(option => {
      if (!option) return false;
      const label = (option.label || "").toString().toLowerCase();
      const val = (option.value || "").toString().toLowerCase();
      return label.includes(term) || val.includes(term);
    });
  }, [safeOptions, searchTerm]);

  const handleSelect = (optionValue) => {
    if (multiple) {
      const isSelected = selectedValues.includes(optionValue);
      let newValues;
      if (isSelected) {
        newValues = selectedValues.filter(v => v !== optionValue);
      } else {
        newValues = [...selectedValues, optionValue];
      }
      if (onChange) onChange(newValues);
      setSearchTerm("");
      inputRef.current?.focus();
    } else {
      if (onChange) onChange(optionValue);
      setSearchTerm("");
      setOpen(false);
    }
  };

  const handleRemoveItem = (e, valToRemove) => {
    e.stopPropagation();
    if (multiple) {
      const newValues = selectedValues.filter(v => v !== valToRemove);
      if (onChange) onChange(newValues);
    } else {
      if (onChange) onChange("");
      setSearchTerm("");
    }
  };

  const handleCreate = () => {
    if (allowCreate && searchTerm) {
      if (multiple) {
        if (onChange) onChange([...selectedValues, searchTerm]);
        setSearchTerm("");
      } else {
        if (onChange) onChange(searchTerm);
        setSearchTerm("");
        setOpen(false);
      }
    }
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div 
        className={cn(
          "flex min-h-[40px] w-full flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white focus-within:ring-2 focus-visible:ring-blue-500 focus-within:ring-offset-2 transition-all hover:border-slate-400",
          disabled && "cursor-not-allowed opacity-50 bg-slate-50"
        )}
        onClick={() => !disabled && setOpen(true)}
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
            value={open ? searchTerm : (multiple ? "" : selectedLabels)}
            onChange={(e) => {
  const val = e.target.value;
  setSearchTerm(val);
  setOpen(true);

  if (onSearch) {
    onSearch(val); // 🔥 INI YANG BIKIN SEARCH HIDUP
  }
}}
            onFocus={() => {
              setSearchTerm("");
              setOpen(true);
            }}
            placeholder={placeholder}
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
               className="hover:bg-slate-100 p-0.5 rounded text-slate-400 hover:text-slate-600"
             >
               <X className="h-4 w-4" />
             </button>
           )}
           <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
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
                    className="px-3 py-2 text-sm rounded-md cursor-pointer flex items-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100"
                 >
                   <Plus className="w-4 h-4" />
                   Buat "{searchTerm}"
                 </div>
               ) : (
                 <div className="px-3 py-4 text-center text-sm text-slate-500">
                   {notFoundText}
                 </div>
               )}
             </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option, index) => {
                const isSelected = multiple 
                  ? selectedValues.includes(option.value) 
                  : value === option.value;
                
                return (
                  <div
                    key={`${option.value}-${index}`}
                    onClick={(e) => { e.stopPropagation(); handleSelect(option.value); }}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-slate-100",
                      isSelected && "bg-blue-50 text-blue-700 font-medium"
                    )}
                  >
                    <div className="flex items-center justify-between w-full min-w-0">
                       <span className="truncate">{option.label}</span>
                       {isSelected && <Check className="h-4 w-4 text-blue-600 ml-2 flex-shrink-0" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;