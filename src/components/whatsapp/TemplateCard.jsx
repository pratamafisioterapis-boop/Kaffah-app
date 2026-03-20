import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TemplateCard = ({ template, onEdit, onPreview }) => {
  const { category, template_name, template_content, is_active } = template;
  
  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'booking_confirmation': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'post_treatment_follow_up': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'expiry_package': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'appointment_reminder': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'birthday_greeting': return 'bg-pink-100 text-pink-800 border-pink-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.2 }}>
      <Card className="h-full flex flex-col overflow-hidden border shadow-sm hover:shadow-md transition-all">
        <CardHeader className="pb-3 bg-slate-50/50">
          <div className="flex justify-between items-start">
            <Badge className={`mb-2 hover:bg-opacity-80 ${getCategoryColor(category)}`}>
               {template_name}
            </Badge>
            {is_active ? (
               <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
               <XCircle className="w-5 h-5 text-slate-300" />
            )}
          </div>
        </CardHeader>
        
        <CardContent className="flex-grow pt-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[100px]">
            <p className="text-sm text-slate-600 line-clamp-4 font-mono whitespace-pre-wrap">
              {template_content}
            </p>
          </div>
        </CardContent>

        <CardFooter className="pt-2 pb-4 px-4 flex gap-2">
          <Button 
             variant="outline" 
             size="sm" 
             className="flex-1 text-slate-600"
             onClick={() => onPreview(template)}
          >
            <Eye className="w-4 h-4 mr-2" /> Preview
          </Button>
          <Button 
             size="sm" 
             className="flex-1 bg-[#1e3a8a] hover:bg-[#172554]"
             onClick={() => onEdit(template)}
          >
            <Edit2 className="w-4 h-4 mr-2" /> Edit
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default TemplateCard;