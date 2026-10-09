import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { DESIGN_THEMES, DEFAULT_THEME_KEY } from '@/config/designThemes';

const ThemeContext = createContext(null);

export const useDesignTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useDesignTheme must be used within ThemeProvider');
  return ctx;
};

// ── Color helpers ────────────────────────────────────────────────────────────
// Tailwind tokens (`text-app-accent`, `bg-app-soft`, `bg-app-accent/10`, …) read
// space-separated RGB channels so opacity modifiers keep working, and a few
// shadcn variables (`--primary`, `--ring`) need HSL. Themes only declare hex.
const hexToRgb = (hex) => {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// Mix `hex` with white; `amount` is the share of white (0 = hex, 1 = white).
const tint = (hex, amount) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.map((v) => v + (255 - v) * amount));
};

const rgbChannels = (hex, fallback) => (hexToRgb(hex) || fallback).join(' ');

const hexToHslChannels = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d !== 0) {
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
};

// Readable text color for a solid accent background (WCAG relative luminance).
const readableOn = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '0 0% 100%';
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? '0 0% 9%' : '0 0% 100%';
};

// Inter and Poppins ship with index.html; the other theme fonts are fetched only when
// that theme is actually in use, so clinics on the default theme never download them.
const ON_DEMAND_FONTS = {
  Nunito: 'family=Nunito:wght@400;600;700;800',
  Manrope: 'family=Manrope:wght@400;600;700;800',
};

const ensureThemeFont = (fontStack) => {
  const name = Object.keys(ON_DEMAND_FONTS).find((n) => String(fontStack).includes(n));
  if (!name || typeof document === 'undefined') return;
  const id = `theme-font-${name.toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${ON_DEMAND_FONTS[name]}&display=swap`;
  document.head.appendChild(link);
};

const applyThemeVars = (themeKey) => {
  const theme = DESIGN_THEMES[themeKey] || DESIGN_THEMES[DEFAULT_THEME_KEY];
  const root = document.documentElement;
  const accentBright = theme.accentBright || theme.accent;
  // Themes without an explicit soft tint get one derived from their own accent,
  // instead of falling back to the default theme's light blue.
  const accentSoft = theme.accentSoft || tint(theme.accent, 0.9);

  ensureThemeFont(theme.font);
  root.style.setProperty('--app-font', theme.font);
  root.style.setProperty('--app-radius', theme.radius);
  root.style.setProperty('--app-sidebar-bg', theme.sidebarBg);
  root.style.setProperty('--app-accent', theme.accent);
  root.style.setProperty('--app-accent-hover', theme.accentHover);
  root.style.setProperty('--app-accent-bright', accentBright);
  root.style.setProperty('--app-accent-soft', accentSoft);
  root.style.setProperty('--app-card-bg', theme.cardBg);
  root.style.setProperty('--app-card-border', theme.cardBorder);
  root.style.setProperty('--app-text-main', theme.textMain);
  root.style.setProperty('--app-text-muted', theme.textMuted);
  root.style.setProperty('--app-shadow', theme.shadow);

  // RGB channels for the Tailwind `app-*` color tokens (see tailwind.config.js).
  root.style.setProperty('--app-accent-rgb', rgbChannels(theme.accent, [22, 119, 210]));
  root.style.setProperty('--app-accent-hover-rgb', rgbChannels(theme.accentHover, [18, 95, 172]));
  root.style.setProperty('--app-accent-bright-rgb', rgbChannels(accentBright, [47, 140, 255]));
  root.style.setProperty('--app-accent-soft-rgb', rgbChannels(accentSoft, [234, 244, 255]));
  root.style.setProperty('--app-border-rgb', rgbChannels(theme.cardBorder, [220, 232, 242]));
  root.style.setProperty('--app-ink-rgb', rgbChannels(theme.textMain, [16, 47, 82]));
  root.style.setProperty('--app-muted-rgb', rgbChannels(theme.textMuted, [91, 107, 125]));

  // shadcn components (Switch, Checkbox, Progress, focus rings…) follow the accent too.
  const primaryHsl = hexToHslChannels(theme.accent);
  if (primaryHsl) {
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--primary-foreground', readableOn(theme.accent));
    root.style.setProperty('--ring', primaryHsl);
  }
  root.setAttribute('data-design-theme', themeKey);
};

export const ThemeProvider = ({ children }) => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [themeKey, setThemeKey] = useState(DEFAULT_THEME_KEY);
  const [loading, setLoading] = useState(true);

  const fetchTheme = useCallback(async () => {
    if (!clinicId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('clinics')
      .select('design_style')
      .eq('id', clinicId)
      .single();
    if (!error && data?.design_style) {
      setThemeKey(data.design_style);
      applyThemeVars(data.design_style);
    } else {
      applyThemeVars(DEFAULT_THEME_KEY);
    }
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetchTheme(); }, [fetchTheme]);

  const updateTheme = async (newKey) => {
    if (!clinicId) return { error: 'No clinic' };
    const { error } = await supabase
      .from('clinics')
      .update({ design_style: newKey })
      .eq('id', clinicId);
    if (!error) {
      setThemeKey(newKey);
      applyThemeVars(newKey);
    }
    return { error };
  };

  return (
    <ThemeContext.Provider value={{ themeKey, updateTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};