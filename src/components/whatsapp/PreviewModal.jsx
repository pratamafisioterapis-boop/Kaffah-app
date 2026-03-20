import React, { useState, useEffect } from 'react';
import { Copy, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { getDummyDataForCategory, renderTemplate } from '@/lib/whatsappRenderEngine';

const PreviewModal = ({ isOpen, onClose, template }) => {
  const [renderedMessage, setRenderedMessage] = useState('');
  
  useEffect(() => {
    if (template && isOpen) {
      const dummyData = getDummyDataForCategory(template.category);
      const rendered = renderTemplate(template.template_content, dummyData);
      setRenderedMessage(rendered);
    }
  }, [template, isOpen]);

  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-[#E5DDD5]">
        <div className="bg-[#075E54] p-4 text-white flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-slate-200/20 flex items-center justify-center">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png" className="w-5 h-5" alt="WA" />
             </div>
             <div>
                <h3 className="font-bold text-sm">WhatsApp Preview</h3>
                <p className="text-xs text-green-100">Simulasi Pesan</p>
             </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5"/></button>
        </div>
        
        <div className="p-4 min-h-[300px] flex flex-col bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-opacity-10">
           <div className="bg-white p-3 rounded-lg shadow-sm rounded-tr-none self-end max-w-[90%] mb-2 relative">
               <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {renderedMessage}
               </p>
               <div className="flex justify-end mt-1 gap-1 items-center">
                  <span className="text-[10px] text-slate-400">14:05</span>
                  <span className="text-blue-500 text-[10px]">✓✓</span>
               </div>
           </div>
        </div>

        <div className="bg-white p-4 border-t flex justify-between items-center">
            <div className="text-xs text-slate-500">
               <span className="font-bold block text-slate-700 mb-1">Variables Used:</span>
               {template.variables_used?.join(', ') || '-'}
            </div>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(renderedMessage)}>
               <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PreviewModal;