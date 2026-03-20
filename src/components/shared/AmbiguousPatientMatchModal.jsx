import React from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { UserPlus, User } from 'lucide-react';

const AmbiguousPatientMatchModal = ({ 
  isOpen, 
  onClose, 
  csvName, 
  row,
  candidates, 
  onSelect, 
  onResolve,
  onSkip 
}) => {
  const [selectedId, setSelectedId] = React.useState('new');

  // Determine the effective callback (support both onSelect and onResolve)
  // This prevents the crash if one is missing but the other is provided
  const handleResolution = onSelect || onResolve || (() => console.warn('AmbiguousPatientMatchModal: No onSelect or onResolve handler provided'));
  
  // Determine display name from csvName or row object
  const nameToDisplay = csvName || row?.patient_name || 'Unknown';

  if (!isOpen) return null;

  const handleConfirm = () => {
      if (selectedId === 'new') {
          handleResolution(null, 'NEW'); 
      } else if (selectedId === 'skip') {
          if (onSkip) onSkip();
      } else {
          const patient = candidates.find(c => c.id === selectedId);
          handleResolution(patient, 'MATCHED');
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Konfirmasi Pencocokan Pasien</DialogTitle>
          <DialogDescription>
             Nama di CSV: <span className="font-bold text-slate-900">"{nameToDisplay}"</span> memiliki kemiripan dengan pasien di database. Silakan pilih pasien yang benar.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
            <RadioGroup value={selectedId} onValueChange={setSelectedId} className="space-y-3">
                {candidates && candidates.map((patient) => (
                    <div key={patient.id} className="flex items-center space-x-3 space-y-0 border rounded-lg p-3 hover:bg-slate-50 cursor-pointer">
                        <RadioGroupItem value={patient.id} id={patient.id} />
                        <Label htmlFor={patient.id} className="flex-1 cursor-pointer">
                            <div className="font-semibold text-slate-900">{patient.full_name}</div>
                            <div className="text-xs text-slate-500">RM: {patient.rm_number || '-'}</div>
                        </Label>
                        <User className="w-4 h-4 text-blue-500" />
                    </div>
                ))}
                
                <div className="flex items-center space-x-3 space-y-0 border rounded-lg p-3 hover:bg-slate-50 cursor-pointer border-blue-200 bg-blue-50/50">
                    <RadioGroupItem value="new" id="option-new" />
                    <Label htmlFor="option-new" className="flex-1 cursor-pointer">
                        <div className="font-semibold text-blue-900">Buat Pasien Baru</div>
                        <div className="text-xs text-blue-600">"{nameToDisplay}" akan didaftarkan sebagai pasien baru.</div>
                    </Label>
                    <UserPlus className="w-4 h-4 text-blue-600" />
                </div>
                 
                 <div className="flex items-center space-x-3 space-y-0 border rounded-lg p-3 hover:bg-slate-50 cursor-pointer border-red-100 bg-red-50/50">
                    <RadioGroupItem value="skip" id="option-skip" />
                    <Label htmlFor="option-skip" className="flex-1 cursor-pointer">
                        <div className="font-semibold text-red-900">Lewati Baris Ini</div>
                        <div className="text-xs text-red-600">Data ini tidak akan diimport.</div>
                    </Label>
                </div>
            </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleConfirm}>Konfirmasi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

AmbiguousPatientMatchModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  csvName: PropTypes.string,
  row: PropTypes.object,
  candidates: PropTypes.array,
  onSelect: PropTypes.func,
  onResolve: PropTypes.func,
  onSkip: PropTypes.func
};

AmbiguousPatientMatchModal.defaultProps = {
  candidates: [],
  onSkip: () => {},
  onClose: () => {},
  onSelect: null,
  onResolve: null
};

export default AmbiguousPatientMatchModal;