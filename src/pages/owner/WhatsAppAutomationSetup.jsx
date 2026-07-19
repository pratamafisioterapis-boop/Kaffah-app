import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getWhatsAppTemplates } from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import DashboardLayout from '@/components/DashboardLayout';
import TemplateCard from '@/components/whatsapp/TemplateCard';
import TemplateEditModal from '@/components/whatsapp/TemplateEditModal';
import PreviewModal from '@/components/whatsapp/PreviewModal';
import { runDailyWhatsAppAutomation } from '@/lib/whatsappScheduler';
import { OWNER_NAV_ITEMS } from '@/lib/navItems';

const WhatsAppAutomationSetup = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await getWhatsAppTemplates();
      if (data) setTemplates(data);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load templates" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setEditModalOpen(true);
  };

  const handlePreview = (template) => {
    setSelectedTemplate(template);
    setPreviewModalOpen(true);
  };

  const handleSave = async (id, updates) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('follow_up_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      setEditModalOpen(false);
      toast({ title: "Success", description: "Template updated successfully" });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update template" });
    } finally {
      setSaving(false);
    }
  };

  const handleManualTrigger = async () => {
    setGenerating(true);
    try {
      await runDailyWhatsAppAutomation();
      toast({ title: "Automation Triggered", description: "Generated queue items for today." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to run automation" });
    } finally {
      setGenerating(false);
    }
  };

  const navItems = OWNER_NAV_ITEMS;

  return (
    <DashboardLayout role="owner" navItems={navItems}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">WhatsApp Automation</h1>
            <p className="text-slate-500">Manage templates and automation rules for patient follow-ups.</p>
          </div>
          <Button onClick={handleManualTrigger} disabled={generating} className="bg-purple-600 hover:bg-purple-700">
            {generating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            Run Manual Automation
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5].map(i => <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onEdit={handleEdit} 
                onPreview={handlePreview} 
              />
            ))}
          </div>
        )}

        <TemplateEditModal 
          isOpen={editModalOpen} 
          onClose={() => setEditModalOpen(false)} 
          template={selectedTemplate}
          onSave={handleSave}
          saving={saving}
        />

        <PreviewModal 
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          template={selectedTemplate}
        />
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppAutomationSetup;