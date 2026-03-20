import React from 'react';
import DailyEvaluationAdmin from '@/components/admin/DailyEvaluationAdmin';

/**
 * DailyEvaluationAdminTab
 * 
 * Wrapper component for the DailyEvaluationAdmin specifically for the Tabs implementation.
 * Provides the consistent container styling used in the MedicalRecordsPage tabs.
 * This ensures the content has the same look and feel (white bg, rounded corners, shadow)
 * as other admin tabs.
 */
const DailyEvaluationAdminTab = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <DailyEvaluationAdmin />
    </div>
  );
};

export default DailyEvaluationAdminTab;