import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserCircle, Phone, Info, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

const DetailItem = ({ label, value, valueClassName = "" }) => (
    <div className="flex flex-col space-y-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
        <span className={cn("text-[15px] font-semibold text-slate-900 break-words tracking-tight", valueClassName)}>
            {value || '-'}
        </span>
    </div>
);

const Section = ({ icon: Icon, title, children }) => (
    <div className="space-y-4 p-5 rounded-app-lg border border-slate-200/60 bg-white shadow-sm">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/60">
            <Icon className="w-4 h-4 text-app-accent" />
            <h4 className="text-sm font-semibold text-slate-700 tracking-tight">{title}</h4>
        </div>
        {children}
    </div>
);

const PatientPreviewModal = ({ isOpen, onClose, patient, onEdit }) => {
    if (!patient) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-app-lg p-0 shadow-xl border border-slate-200/60">
                <DialogHeader className="px-6 py-5 border-b border-slate-200/60 bg-white rounded-t-app-lg">
                    <div className="flex justify-between items-start gap-3 pr-6">
                        <div>
                            <DialogTitle className="text-xl font-semibold text-slate-900 tracking-tight">{patient.full_name}</DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 mt-1 font-mono">
                                {patient.medical_record_number || '-'}
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className={cn("font-normal text-xs px-2 py-0.5 border-0", patient.statusClass)}>
                                {patient.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                            <Badge variant="outline" className={cn("font-normal text-xs px-2 py-0.5 border-0", patient.completenessClass)}>
                                {patient.isComplete ? 'Lengkap' : 'Belum Lengkap'}
                            </Badge>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-5">
                    <Section icon={UserCircle} title="Identitas Pasien">
                        <DetailItem label="Nama Lengkap" value={patient.full_name} valueClassName="text-base font-bold" />
                        <DetailItem label="Nama Panggilan" value={patient.nickname} />
                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem label="Jenis Kelamin" value={patient.genderLabel} />
                            <DetailItem label="Usia" value={patient.formattedAge} />
                        </div>
                        <DetailItem label="Tanggal Lahir" value={patient.formattedBirthDate} valueClassName="capitalize" />
                        <DetailItem label="NIK" value={patient.nik} valueClassName="font-mono" />
                    </Section>

                    <Section icon={Phone} title="Kontak & Alamat">
                        <DetailItem label="Nomor HP" value={patient.formattedPhone} valueClassName="font-mono" />
                        <DetailItem label="Alamat" value={patient.address} />
                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem label="Pekerjaan" value={patient.occupation} />
                            <DetailItem label="Agama" value={patient.religion} />
                        </div>
                    </Section>

                    <div className="md:col-span-2">
                        <Section icon={Info} title="Info Tambahan">
                            <DetailItem label="Info Tambahan" value={patient.additionalInfoLabel} />
                        </Section>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-200/60 flex justify-end gap-2 bg-white rounded-b-app-lg">
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                    <Button onClick={() => onEdit(patient)} className="bg-[#1683F4] hover:bg-app-accent-hover text-white">
                        <Edit className="w-4 h-4 mr-1.5" /> Edit
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PatientPreviewModal;
