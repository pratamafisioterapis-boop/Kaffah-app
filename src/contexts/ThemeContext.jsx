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

const applyThemeVars = (themeKey) => {
  const theme = DESIGN_THEMES[themeKey] || DESIGN_THEMES[DEFAULT_THEME_KEY];
  const root = document.documentElement;
  root.style.setProperty('--app-font', theme.font);
  root.style.setProperty('--app-radius', theme.radius);
  root.style.setProperty('--app-sidebar-bg', theme.sidebarBg);
  root.style.setProperty('--app-accent', theme.accent);
  root.style.setProperty('--app-accent-hover', theme.accentHover);
  root.style.setProperty('--app-card-bg', theme.cardBg);
  root.style.setProperty('--app-card-border', theme.cardBorder);
  root.style.setProperty('--app-text-main', theme.textMain);
  root.style.setProperty('--app-text-muted', theme.textMuted);
  root.style.setProperty('--app-shadow', theme.shadow);
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