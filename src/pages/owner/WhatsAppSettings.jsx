import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Save, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, MessageSquare, Clock, Calendar, Gift } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const WhatsAppSettings = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
    const textareaRef = useRef(null);

    
    // Config state
    const [config, setConfig] = useState({
        follow_up: { timing_type: 'immediate', timing_value: {}, is_enabled: true },
        appointment_reminder: { timing_type: 'custom_days', timing_value: { days_before: 1 }, is_enabled: true },
        expiry_package: { timing_type: 'custom_days', timing_value: { days_before: [7, 3, 1] }, is_enabled: true },
        birthday_greeting: { timing_type: 'custom_time', timing_value: { time: '09:00' }, is_enabled: true },
    });

    useEffect(() => {
        fetchTemplates();
        fetchConfig();
    }, []);

    const fetchTemplates = async () => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData?.session?.user?.id;
            const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

            const { data, error } = await supabase.from('wa_templates').select('*').eq('clinic_id', userRow?.clinic_id).order('category');
            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    };

    const fetchConfig = async () => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData?.session?.user?.id;
            const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

            const { data, error } = await supabase.from('wa_schedule_config').select('*').eq('clinic_id', userRow?.clinic_id);
            if (error) throw error;
            
            const newConfig = { ...config };
            if (data) {
                data.forEach(item => {
                    if (newConfig[item.category]) {
                        newConfig[item.category] = item;
                    }
                });
            }
            setConfig(newConfig);
        } catch (error) {
            console.error('Error fetching config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTemplate = async () => {
        try {
            if (editingTemplate.id) {
                const { error } = await supabase
                    .from('wa_templates')
                    .update({ 
                        template_text: editingTemplate.template_text,
                        is_enabled: editingTemplate.is_enabled
                    })
                    .eq('id', editingTemplate.id);
                if (error) throw error;
            } else {
                 const { error } = await supabase
                    .from('wa_templates')
                    .insert([editingTemplate]);
                 if (error) throw error;
            }
            
            toast({ title: 'Success', description: 'Template saved successfully' });
            setIsDialogOpen(false);
            fetchTemplates();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    const openEditDialog = (template) => {
        setEditingTemplate({ ...template });
        setIsDialogOpen(true);
    };

    const handleConfigChange = (category, field, value) => {
        setConfig(prev => ({
            ...prev,
            [category]: { ...prev[category], [field]: value }
        }));
    };
    
    const handleSaveConfig = async (category) => {
        const item = config[category];
        try {
            // Check if exists
            const { data: existing } = await supabase.from('wa_schedule_config').select('id').eq('category', category).single();
            
            let error;
            if (existing) {
                ({ error } = await supabase.from('wa_schedule_config').update({
                    timing_type: item.timing_type,
                    timing_value: item.timing_value,
                    is_enabled: item.is_enabled
                }).eq('id', existing.id));
            } else {
                ({ error } = await supabase.from('wa_schedule_config').insert([{
                    category,
                    timing_type: item.timing_type,
                    timing_value: item.timing_value,
                    is_enabled: item.is_enabled
                }]));
            }

            if (error) throw error;
            toast({ title: 'Success', description: `Configuration for ${category} saved.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };
    
    // Task 8: Variable List & Insertion
    const insertVariable = (variable) => {
    if (!editingTemplate) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = editingTemplate.template_text || '';

    const newText =
        currentText.substring(0, start) +
        variable +
        currentText.substring(end);

    setEditingTemplate(prev => ({
        ...prev,
        template_text: newText
    }));

    setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd =
            start + variable.length;
    }, 0);
};

    const AVAILABLE_VARS = [
        { label: 'Nama Pasien', value: '[nama_pasien]', desc: 'Nama lengkap pasien' },
        { label: 'Nickname', value: '[nickname]', desc: 'Nama panggilan (jika ada)' },
        { label: 'Sapaan', value: '[sapaan]', desc: 'Bapak/Ibu/Kak sesuai gender' },
        { label: 'Hari', value: '[hari_booking]', desc: 'Nama hari (Senin, Selasa, dll)' },
        { label: 'Tanggal', value: '[tanggal]', desc: 'Tanggal lengkap (DD MMMM YYYY)' },
        { label: 'Jam', value: '[jam]', desc: 'Jam (HH:MM)' },
        { label: 'Nomor HP', value: '[nomor_telepon]', desc: 'Nomor WhatsApp pasien' }
    ];

    const getCategoryIcon = (cat) => {
        switch(cat) {
            case 'follow_up': return <MessageSquare className="w-4 h-4" />;
            case 'appointment_reminder': return <Clock className="w-4 h-4" />;
            case 'expiry_package': return <Calendar className="w-4 h-4" />;
            case 'birthday_greeting': return <Gift className="w-4 h-4" />;
            default: return <MessageSquare className="w-4 h-4" />;
        }
    };

    return (
        <div className="space-y-6 p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">WhatsApp Automation</h2>
                    <p className="text-slate-500">Manage templates and scheduling rules for automated messages.</p>
                </div>
            </div>

            <Tabs defaultValue="templates" className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="templates">Message Templates</TabsTrigger>
                    <TabsTrigger value="schedules">Scheduling Rules</TabsTrigger>
                </TabsList>
                
                <TabsContent value="templates" className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map(template => (
                            <Card key={template.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="flex items-center gap-2">
                                        {getCategoryIcon(template.category)}
                                        <CardTitle className="text-base font-semibold capitalize">
                                            {template.category.replace(/_/g, ' ')}
                                        </CardTitle>
                                    </div>
                                    <Switch checked={template.is_enabled} disabled />
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-600 mb-4 min-h-[80px]">
                                        {template.template_text}
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => openEditDialog(template)}>
                                        <Edit2 className="w-4 h-4 mr-2" /> Edit Template
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
                
                <TabsContent value="schedules" className="space-y-4 mt-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.keys(config).map(key => (
                            <Card key={key}>
                                <CardHeader>
                                    <CardTitle className="text-base font-semibold capitalize flex items-center gap-2">
                                        {getCategoryIcon(key)}
                                        {key.replace(/_/g, ' ')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label>Enable Automation</Label>
                                        <Switch 
                                            checked={config[key].is_enabled} 
                                            onCheckedChange={(val) => handleConfigChange(key, 'is_enabled', val)}
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label>Timing Type</Label>
                                        <select 
                                            className="w-full p-2 border rounded-md text-sm"
                                            value={config[key].timing_type}
                                            onChange={(e) => handleConfigChange(key, 'timing_type', e.target.value)}
                                        >
                                            <option value="immediate">Immediate (Recap/Booking)</option>
                                            <option value="custom_time">Specific Time (e.g., 09:00)</option>
                                            <option value="custom_days">Days Before/After</option>
                                        </select>
                                    </div>

                                    <Button size="sm" onClick={() => handleSaveConfig(key)} className="w-full">
                                        <Save className="w-4 h-4 mr-2" /> Save Configuration
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                     </div>
                </TabsContent>
            </Tabs>

            {/* Edit Template Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Template</DialogTitle>
                        <DialogDescription>
                            Customize the message content. Use variables to insert dynamic data.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="flex items-center justify-between">
                             <Label>Status</Label>
                             <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-500">{editingTemplate?.is_enabled ? 'Active' : 'Disabled'}</span>
                                <Switch 
                                    checked={editingTemplate?.is_enabled || false}
                                    onCheckedChange={(val) => setEditingTemplate({...editingTemplate, is_enabled: val})}
                                />
                             </div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Message Content</Label>
                <Textarea 
                            ref={textareaRef}
                                rows={6}
                                value={editingTemplate?.template_text || ''}
                                onChange={(e) => setEditingTemplate({...editingTemplate, template_text: e.target.value})}
                                placeholder="Enter your message template here..."
                            />
                        </div>

                        {/* Task 8: Variable Insertion UI */}
                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Available Variables</Label>
                            <div className="flex flex-wrap gap-2">
                                {AVAILABLE_VARS.map(v => (
                                    <Badge 
                                        key={v.value} 
                                        variant="secondary" 
                                        className="cursor-pointer hover:bg-slate-200 active:scale-95 transition-all"
                                        onClick={() => insertVariable(v.value)}
                                        title={v.desc}
                                    >
                                        {v.label} <span className="text-slate-400 ml-1 text-[10px]">{v.value}</span>
                                    </Badge>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Click a variable to insert it into the template.</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTemplate}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default WhatsAppSettings;