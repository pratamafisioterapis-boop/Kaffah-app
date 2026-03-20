import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Edit2, Wallet } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const AdminExpenseList = ({ expenses = [], onRefresh, onEdit, onDelete, canEdit: propCanEdit, canDelete: propCanDelete }) => {
  const { role } = useAuth();
  
  // Use props if provided, otherwise default to role check
  const hasRoleAccess = ['admin', 'super_admin', 'owner'].includes(role);
  const canEdit = propCanEdit !== undefined ? propCanEdit : hasRoleAccess;
  const canDelete = propCanDelete !== undefined ? propCanDelete : hasRoleAccess;
  
  const dataToRender = Array.isArray(expenses) ? expenses : [];
  
  const totalAmount = dataToRender.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    try {
      if (timeStr.includes('T')) {
          const date = new Date(timeStr);
          return isValid(date) ? format(date, 'HH:mm') : '-';
      }
      return timeStr.substring(0, 5); 
    } catch (e) {
      return '-';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return isValid(date) ? format(date, 'dd/MM/yyyy') : '-';
    } catch (e) {
      return '-';
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
        {dataToRender.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
            <div className="bg-slate-100 p-4 rounded-full mb-3">
              <Wallet className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">Belum ada data pengeluaran</h3>
            <p className="text-slate-500 max-w-sm mt-1">
              Silakan tambahkan data pengeluaran baru melalui formulir di samping.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Tanggal</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Waktu</th>
                <th className="px-6 py-4 font-semibold">Kategori</th>
                <th className="px-6 py-4 font-semibold">Sub Kategori</th>
                <th className="px-6 py-4 font-semibold">Akun Bank</th>
                <th className="px-6 py-4 font-semibold">Deskripsi</th>
                <th className="px-6 py-4 font-semibold text-right">Jumlah</th>
                {(canEdit || canDelete) && <th className="px-6 py-4 font-semibold text-center w-[120px]">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataToRender.map((ex, index) => (
                <tr key={ex.id || index} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700 font-medium">
                    {formatDate(ex.transaction_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                    {formatTime(ex.input_time)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wide">
                        {ex.category || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs uppercase font-medium tracking-wide">
                    {ex.sub_category || '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {ex.bank_account ? (
                        <div className="flex items-center gap-2">
                           <span className="font-medium text-slate-900">{ex.bank_account.bank_name}</span>
                        </div>
                    ) : (
                        <span className="text-slate-400 italic text-xs">Tunai/Lain</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-[250px] truncate" title={ex.description}>
                    {ex.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-rose-600 whitespace-nowrap font-mono">
                    Rp {parseFloat(ex.amount || 0).toLocaleString('id-ID')}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all hover:scale-105"
                            onClick={() => onEdit && onEdit(ex)}
                            title="Edit Pengeluaran"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all hover:scale-105"
                            onClick={() => onDelete && onDelete(ex)}
                            title="Hapus Pengeluaran"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-900">
                <tr>
                    <td colSpan={6} className="px-6 py-4 text-right text-sm uppercase tracking-wider text-slate-500">Total Pengeluaran</td>
                    <td className="px-6 py-4 text-right text-rose-700 text-base font-bold font-mono">Rp {totalAmount.toLocaleString('id-ID')}</td>
                    {(canEdit || canDelete) && <td></td>}
                </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminExpenseList;