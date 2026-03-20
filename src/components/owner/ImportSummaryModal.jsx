import React from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, FileText, Package, Info, Download } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { downloadCSV } from '@/lib/utils';

const ImportSummaryModal = ({ isOpen, onClose, summary }) => {
  if (!summary) return null;

  const { totalProcessed, successCount, warningCount, warnings, failedRows, packageTrackingStats } = summary;

  // Default empty stats if not provided
  const pkgStats = packageTrackingStats || { created: 0, skipped: 0, errors: 0, details: [] };
  
  const handleDownloadFailed = () => {
    if (!failedRows || failedRows.length === 0) return;
    const exportData = failedRows.map(row => ({
        ...row,
        candidates: undefined, // remove non-serializable fields
        matchedPatient: undefined,
        error_reason: row.packageError || row.matchStatus || 'Unknown Error'
    }));
    downloadCSV(exportData, `failed_import_rows_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />Hasil Import</DialogTitle><DialogDescription>Ringkasan proses import data CSV.</DialogDescription></DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center"><div className="text-sm text-slate-500 mb-1">Total Baris</div><div className="text-2xl font-bold text-slate-900">{totalProcessed}</div></div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center"><div className="text-sm text-green-600 mb-1 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> Berhasil</div><div className="text-2xl font-bold text-green-700">{successCount}</div></div>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-center"><div className="text-sm text-amber-600 mb-1 flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Skipped/Error</div><div className="text-2xl font-bold text-amber-700">{warningCount}</div></div>
            </div>

            {pkgStats && (pkgStats.created > 0 || pkgStats.errors > 0 || pkgStats.skipped > 0) && (
                <div className="border border-indigo-100 rounded-lg overflow-hidden bg-indigo-50/30">
                  <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center gap-2"><Package className="w-4 h-4 text-indigo-600" /><span className="font-semibold text-indigo-900 text-sm">Package Tracking Updates</span></div>
                  <div className="grid grid-cols-3 divide-x divide-indigo-100 border-b border-indigo-100 bg-white">
                    <div className="p-3 text-center"><div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Created</div><div className="text-lg font-bold text-indigo-600">{pkgStats.created}</div></div>
                    <div className="p-3 text-center"><div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Skipped</div><div className="text-lg font-bold text-slate-600">{pkgStats.skipped}</div></div>
                    <div className="p-3 text-center"><div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Errors</div><div className="text-lg font-bold text-red-600">{pkgStats.errors}</div></div>
                  </div>
                  {pkgStats.details && pkgStats.details.length > 0 && (
                    <div className="bg-white max-h-[150px] overflow-y-auto">
                       {pkgStats.details.map((detail, idx) => (
                          <div key={idx} className="px-4 py-2 border-b border-slate-50 text-xs flex justify-between items-center last:border-0 hover:bg-slate-50">
                              <div className="flex flex-col gap-0.5"><span className="font-medium text-slate-700">{detail.package}</span><span className="text-slate-500 text-[10px]">{detail.patient}</span></div>
                              <div className="flex items-center gap-2"><span className="text-slate-400 italic">{detail.reason}</span><Badge variant={detail.status === 'created' ? 'default' : detail.status === 'error' ? 'destructive' : 'secondary'} className="h-5 text-[10px]">{detail.status}</Badge></div>
                          </div>
                       ))}
                    </div>
                  )}
                </div>
            )}

            {warnings && warnings.length > 0 && (
              <div className="border border-red-100 rounded-md">
                <div className="bg-red-50 px-4 py-2 border-b border-red-100 text-sm font-medium text-red-800 flex justify-between items-center">
                    <span>Detail Warning / Error ({warnings.length})</span>
                    {failedRows && failedRows.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleDownloadFailed} className="h-6 text-[10px] px-2 text-red-700 hover:text-red-900 hover:bg-red-100">
                             <Download className="w-3 h-3 mr-1" /> Download Failed Rows
                        </Button>
                    )}
                </div>
                <div className="max-h-[150px] overflow-y-auto p-0">
                  <div className="divide-y divide-slate-100">
                    {warnings.map((warn, idx) => (
                      <div key={idx} className="p-3 flex items-start gap-3 text-sm hover:bg-slate-50">
                        <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div><span className="font-semibold text-slate-700 block text-xs">{warn.patientName || 'Data Tidak Diketahui'}</span><p className="text-slate-500 text-xs mt-0.5">{warn.message}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-4 pt-2 border-t border-slate-100"><Button onClick={onClose} className="w-full sm:w-auto">Tutup</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

ImportSummaryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  summary: PropTypes.shape({
    totalProcessed: PropTypes.number,
    successCount: PropTypes.number,
    warningCount: PropTypes.number,
    warnings: PropTypes.array,
    failedRows: PropTypes.array,
    packageTrackingStats: PropTypes.object
  })
};

export default ImportSummaryModal;