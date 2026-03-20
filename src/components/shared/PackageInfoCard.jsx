import React from 'react';
import { Package, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateDisplay } from '@/lib/dailyRecapHelpers';

const PackageInfoCard = ({ packageData, isExpired, onExtend }) => {
    if (!packageData) return null;

    const endDate = packageData.extended_until || packageData.end_date;
    const formattedDate = formatDateDisplay(endDate);

    if (isExpired) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <h4 className="font-bold text-red-700">🔴 Paket Expired</h4>
                    </div>
                    <Badge variant="destructive">Expired</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                    <div className="text-red-700/70">Nama Paket</div>
                    <div className="font-medium text-red-900">{packageData.package_name}</div>
                    
                    <div className="text-red-700/70">Masa Berakhir</div>
                    <div className="font-medium text-red-900">{formattedDate}</div>
                    
                    <div className="text-red-700/70">Sesi Terpakai</div>
                    <div className="font-medium text-red-900">{packageData.sessions_used} / {packageData.total_sessions}</div>
                    
                    <div className="text-red-700/70">Sisa Sesi</div>
                    <div className="font-bold text-red-900">{packageData.sessions_remaining}</div>
                </div>

                <Button 
                    onClick={onExtend}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    size="sm"
                >
                    Perpanjang Paket
                </Button>
            </div>
        );
    }

    // Active State
    return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h4 className="font-bold text-green-700">🟢 Paket Aktif</h4>
                </div>
                <Badge className="bg-green-600 hover:bg-green-700">Aktif</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="text-green-700/70">Nama Paket</div>
                <div className="font-medium text-green-900">{packageData.package_name}</div>
                
                <div className="text-green-700/70">Total Sesi</div>
                <div className="font-medium text-green-900">{packageData.total_sessions}</div>
                
                <div className="text-green-700/70">Sesi Terpakai</div>
                <div className="font-medium text-green-900">{packageData.sessions_used}</div>
                
                <div className="text-green-700/70">Sisa Sesi</div>
                <div className="font-bold text-green-900">{packageData.sessions_remaining}</div>
            </div>
        </div>
    );
};

export default PackageInfoCard;