import React, { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useDesignTheme } from '@/contexts/ThemeContext';
import { DESIGN_THEMES } from '@/config/designThemes';
import { cn } from '@/lib/utils';

const DesignStyleManager = () => {
  const { themeKey, updateTheme } = useDesignTheme();
  const { toast } = useToast();
  const [saving, setSaving] = useState(null);

  const handleSelect = async (key) => {
    setSaving(key);
    const { error } = await updateTheme(key);
    setSaving(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan tema', description: String(error) });
    } else {
      toast({ title: 'Tampilan klinik diperbarui' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Palette className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-slate-800">Pilih Design Style Klinik</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(DESIGN_THEMES).map(([key, theme]) => (
          <button
            key={key}
            onClick={() => handleSelect(key)}
            disabled={saving === key}
            className={cn(
              "relative text-left rounded-2xl border-2 p-4 transition-all hover:shadow-md",
              themeKey === key ? "border-indigo-600 shadow-md" : "border-slate-200"
            )}
          >
            {themeKey === key && (
              <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </span>
            )}
            <div
              className="w-full h-16 mb-3 flex items-center px-3"
              style={{ background: theme.sidebarBg, borderRadius: theme.radius }}
            >
              <span
                className="text-[11px] px-2.5 py-1 inline-block"
                style={{
                  background: theme.navActive.background,
                  color: theme.navActive.color,
                  border: theme.navActive.border,
                  borderRadius: theme.navActive.radius,
                  boxShadow: theme.navActive.shadow,
                  fontWeight: theme.navActive.weight,
                  fontFamily: theme.font,
                }}
              >
                Menu
              </span>
            </div>
            <p className="text-sm font-semibold" style={{ fontFamily: theme.font }}>
              {theme.label}
            </p>
            <div className="flex gap-1.5 mt-2">
              <span className="w-4 h-4 rounded-full" style={{ background: theme.accent }} />
              <span className="w-4 h-4 rounded-full border" style={{ background: theme.cardBg, borderColor: theme.cardBorder }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DesignStyleManager;