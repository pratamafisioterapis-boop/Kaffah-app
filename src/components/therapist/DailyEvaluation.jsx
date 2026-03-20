import React from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const DailyEvaluation = () => {
  const handleCreateEvaluation = () => {
    toast({
      title: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀"
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Daily Evaluation</h1>
        <p className="text-slate-600 mt-1">Record patient evaluations and progress</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Daily Evaluation Form</h3>
        <p className="text-slate-600 mb-6">
          Create SOAP notes and track patient progress
        </p>
        <Button onClick={handleCreateEvaluation} className="bg-blue-600 hover:bg-blue-700">
          Start New Evaluation
        </Button>
      </div>
    </div>
  );
};

export default DailyEvaluation;