import React from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { 
    generateMessageFromTemplate, 
    getSalutation, 
    calculateAge, 
    calculatePromoValidity,
    calculateBirthdayDayName,
    calculateDayNameIndonesia
} from '@/lib/whatsappService';

// Two-letter avatar initials from a clinic name, e.g. "Klinik Sehat Mandiri"
// -> "KS". Falls back to "KC" (this preview's original hardcoded brand,
// "Kaffah Care") only while the clinic's own name hasn't loaded yet.
const getClinicInitials = (name) => {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'KC';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const WhatsAppMessagePreview = ({ template, placeholders, patient, clinicName }) => {
  // If patient data provided, recalculate specific values to show realistic preview
  const previewPlaceholders = { ...placeholders };
  
  if (patient) {
    previewPlaceholders.sapaan = getSalutation(patient);

    // ✅ TAMBAHKAN INI
    previewPlaceholders.nickname = patient.nickname || '';
    previewPlaceholders.nama = patient.full_name || '';
      
      // If date_of_birth is available in the mock patient object, calculate age and promo
      if (patient.date_of_birth) {
          previewPlaceholders.usia = calculateAge(patient.date_of_birth);
          previewPlaceholders.masa_berlaku = calculatePromoValidity(patient.date_of_birth);
          previewPlaceholders.hari = calculateBirthdayDayName(patient.date_of_birth);
          previewPlaceholders.tanggal_lahir = format(new Date(patient.date_of_birth), 'dd MMMM yyyy', { locale: idLocale });
          previewPlaceholders.umur_baru = calculateAge(patient.date_of_birth); 
      }
      
      // Ensure specific placeholders from task description are covered if passed via props
      // Since SAMPLE_DATA already provides 'hari_booking', 'hari_expiry', 'tanggal_expiry', they will be used.
      // If patient object has properties that could dynamically calculate these, we would do it here.
      // For preview, we mostly rely on the passed `placeholders` which contains static sample data for these.
  }

  // NOTE: For preview purposes, we rely on placeholders providing 'jam', 'hari_booking', etc. or other static data
  const message = generateMessageFromTemplate(template, previewPlaceholders);
  const currentTime = format(new Date(), 'HH:mm');

  return (
    <div className="w-full max-w-sm mx-auto bg-[#e5ddd5] rounded-lg overflow-hidden shadow-md border border-slate-200">
      {/* Header */}
      <div className="bg-[#075e54] p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[#075e54] font-bold text-xs">
           {getClinicInitials(clinicName)}
        </div>
        <div className="text-white">
          <p className="font-bold text-sm leading-none">{clinicName || 'Kaffah Care'}</p>
          <p className="text-[10px] opacity-80">Online</p>
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="p-4 min-h-[200px] flex flex-col justify-end">
        <div className="self-start bg-white rounded-tr-lg rounded-br-lg rounded-bl-lg p-2 max-w-[90%] shadow-sm relative mb-2">
            <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {message || <span className="text-slate-400 italic">Preview pesan akan muncul di sini...</span>}
            </p>
            <div className="text-[10px] text-slate-400 text-right mt-1 flex justify-end gap-1">
               {currentTime}
            </div>
        </div>
      </div>
      
      {/* Footer info */}
      <div className="bg-[#f0f2f5] px-3 py-2 text-[10px] text-slate-500 text-center border-t border-slate-200">
         Karakter: {message.length}
      </div>
    </div>
  );
};

export default WhatsAppMessagePreview;