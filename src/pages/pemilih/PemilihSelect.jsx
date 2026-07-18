import React, { useState } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

// Dropdown yang dipakai menggantikan <select> native — supaya popup-nya ikut
// gaya bottom-sheet/PWA yang sama dengan modal lain di modul ini, bukan
// picker bawaan OS yang tidak bisa di-styling.
const PemilihSelect = ({ value, onChange, options, title, placeholder = 'Pilih...', allLabel, disabled, style }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const closeSheet = () => { setOpen(false); setQuery(''); };
  const handlePick = (val) => { onChange(val); closeSheet(); };

  return (
    <>
      <button
        type="button"
        className="p-select"
        disabled={disabled}
        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: disabled ? 'not-allowed' : 'pointer', gap: 8, ...style }}
        onClick={() => !disabled && setOpen(true)}
      >
        <span style={{ color: selected ? '#1a1d29' : '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : (allLabel || placeholder)}
        </span>
        <ChevronDown size={15} color="#9ca3af" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div className="p-modal-overlay" onClick={closeSheet}>
          <div className="p-modal" style={{ width: 380, maxWidth: '92vw', maxHeight: '72vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #f1f1f3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{title || placeholder}</h3>
              <button onClick={closeSheet} style={{ color: '#9ca3af' }}><X size={18} /></button>
            </div>
            {options.length > 6 && (
              <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: '#9ca3af' }} />
                  <input
                    className="p-input"
                    autoFocus
                    style={{ paddingLeft: 32 }}
                    placeholder="Cari..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="p-scrollbar" style={{ overflowY: 'auto', padding: '10px 12px 16px' }}>
              {allLabel && !query.trim() && (
                <button
                  type="button"
                  onClick={() => handlePick('')}
                  style={{
                    width: '100%', textAlign: 'left', padding: '11px 13px', borderRadius: 10, border: 'none',
                    background: !value ? '#fef2f2' : 'transparent', color: !value ? '#dc2626' : '#1a1d29',
                    fontWeight: !value ? 700 : 500, fontSize: 13.5, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  {allLabel}
                  {!value && <Check size={15} />}
                </button>
              )}
              {filtered.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '22px 0' }}>Tidak ditemukan.</p>
              ) : filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handlePick(o.value)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '11px 13px', borderRadius: 10, border: 'none',
                    background: value === o.value ? '#fef2f2' : 'transparent', color: value === o.value ? '#dc2626' : '#1a1d29',
                    fontWeight: value === o.value ? 700 : 500, fontSize: 13.5, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  {o.label}
                  {value === o.value && <Check size={15} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PemilihSelect;
