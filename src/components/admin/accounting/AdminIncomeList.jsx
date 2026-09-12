import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Edit2, TrendingUp } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

const AdminIncomeList = ({ income = [], onRefresh, onEdit, onDelete, canEdit: propCanEdit, canDelete: propCanDelete }) => {
  const { role } = useAuth();
  
  const hasRoleAccess = ['admin', 'super_admin', 'owner'].includes(role);
  const canEdit = propCanEdit !== undefined ? propCanEdit : hasRoleAccess;
  const canDelete = propCanDelete !== undefined ? propCanDelete : hasRoleAccess;
  
  const dataToRender = Array.isArray(income) ? income : [];
  
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
      <div className="w-full rounded-xl border border-slate-200 shadow-sm bg-white overflow-hidden">
        {dataToRender.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
            <div className="bg-slate-100 p-4 rounded-full mb-3">
              <TrendingUp className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">Belum ada data pemasukan</h3>
            <p className="text-slate-500 max-w-sm mt-1">
              Silakan tambahkan data pemasukan baru melalui formulir di samping.
            </p>
          </div>
        ) : (
          <>
          {/* Mobile / PWA: kartu, tanpa geser horizontal */}
          <div className="sm:hidden divide-y divide-slate-100">
            {dataToRender.map((inc, index) => (
              <div key={inc.id || index} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-700 font-medium text-sm">{formatDate(inc.date)}</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide mt-1.5">
                      {inc.category || 'General'}
                    </span>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all hover:scale-105"
                          onClick={() => onEdit && onEdit(inc)}
                          title="Edit Pemasukan"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all hover:scale-105"
                          onClick={() => onDelete && onDelete(inc)}
                          title="Hapus Pemasukan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Sub Kategori</p>
                    <p className="text-slate-600 uppercase font-medium tracking-wide">{inc.sub_category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Akun Bank</p>
                    <p className="text-slate-600">
                      {inc.bank_account ? (
                        <span className="font-medium text-slate-900">{inc.bank_account.bank_name}</span>
                      ) : (
                        <span className="text-slate-400 italic">Tunai/Lain</span>
                      )}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Deskripsi</p>
                    <p className="text-slate-600">{inc.description || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Jumlah</p>
                    <p className="font-bold text-emerald-600 font-mono">Rp {parseFloat(inc.amount || 0).toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="p-4 flex items-center justify-between bg-slate-50 border-t border-slate-200">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Total Pemasukan</span>
              <span className="text-emerald-700 text-base font-bold font-mono">Rp {totalAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Desktop: tabel, kolom menyesuaikan lebar layar tanpa perlu geser */}
          <div className="hidden sm:block">
          <table className="w-full table-fixed text-sm text-left">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[14%]" />
              <col className="w-[13%]" />
              <col className="w-[24%]" />
              <col className="w-[16%]" />
              {(canEdit || canDelete) && <col className="w-[10%]" />}
            </colgroup>
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 font-semibold">Tanggal</th>
                <th className="px-3 py-3 font-semibold">Sumber</th>
                <th className="px-3 py-3 font-semibold">Sub Kategori</th>
                <th className="px-3 py-3 font-semibold">Akun Bank</th>
                <th className="px-3 py-3 font-semibold">Deskripsi</th>
                <th className="px-3 py-3 font-semibold text-right">Jumlah</th>
                {(canEdit || canDelete) && <th className="px-3 py-3 font-semibold text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataToRender.map((inc, index) => (
                <tr key={inc.id || index} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-3 py-3 text-slate-700 font-medium break-words">
                    {formatDate(inc.date)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide break-words">
                        {inc.category || 'General'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600 text-xs uppercase font-medium tracking-wide break-words">
                    {inc.sub_category || '-'}
                  </td>
                  <td className="px-3 py-3 text-slate-600 break-words">
                    {inc.bank_account ? (
                        <span className="font-medium text-slate-900">{inc.bank_account.bank_name}</span>
                    ) : (
                        <span className="text-slate-400 italic text-xs">Tunai/Lain</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600 break-words" title={inc.description}>
                    {inc.description || '-'}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-600 whitespace-nowrap font-mono">
                    Rp {parseFloat(inc.amount || 0).toLocaleString('id-ID')}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all hover:scale-105"
                            onClick={() => onEdit && onEdit(inc)}
                            title="Edit Pemasukan"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all hover:scale-105"
                            onClick={() => onDelete && onDelete(inc)}
                            title="Hapus Pemasukan"
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
                    <td colSpan={5} className="px-3 py-3 text-right text-sm uppercase tracking-wider text-slate-500">Total Pemasukan</td>
                    <td className="px-3 py-3 text-right text-emerald-700 text-base font-bold font-mono">Rp {totalAmount.toLocaleString('id-ID')}</td>
                    {(canEdit || canDelete) && <td></td>}
                </tr>
            </tfoot>
          </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminIncomeList;