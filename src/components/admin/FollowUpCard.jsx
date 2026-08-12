import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  MessageCircle,
  Clock,
  CheckCircle,
  Trash2,
  Phone,
  Send,
  Loader2,
  CalendarCheck,
  Copy,
  Check
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { interpolateTemplate } from '@/lib/api';

const FollowUpCard = ({
  item,
  onSend,
  onComplete,
  onDelete
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayMessage = interpolateTemplate(item.message_content, item);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(displayMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Gagal menyalin pesan:', err);
    }
  };

  // ==============================
  // Guest Detection
  // ==============================
  const isGuest = !item.patient_id;

  const therapistName =
  item.follow_up_type === 'reminder_therapist_h10'
    ? (
        item.message_content?.match(/Physio\s([A-Za-z]+)/)?.[1] || 'Terapis'
      )
    : null;

const patientName =
  item.follow_up_type === 'reminder_therapist_h10'
    ? `Physio ${therapistName}`
    : (
        isGuest
          ? item.guest_name ||
            item.message_content?.match(/pagi\s+(?:ka|kak|mas|mba|ibu|pak)\s+([A-Za-z]+)/i)?.[1] ||
            item.message_content?.match(/pagi\s+([A-Za-z]+)/i)?.[1] ||
            item.message_content?.match(/Jadwal\s+(?:ka|kak|mas|mba|ibu|pak|bapak|an\.?)\s+([A-Za-z]+)/i)?.[1] ||
            item.phone_number ||
            'Tamu'
          : item.patient?.full_name || 'Pasien'
      );

  const patientPhone =
  item.follow_up_type === 'reminder_therapist_h10'
    ? item.phone_number || '-'
    : (
        isGuest
          ? item.guest_phone || item.phone_number || '-'
          : item.phone_number || item.patient?.phone || '-'
      );

  const medicalRecordNumber = isGuest
    ? ''
    : item.patient?.medical_record_number || '';

  // ==============================
  // Type Styling
  // ==============================
  const getTypeConfig = (type) => {
  switch (type) {
    case 'booking_appointment':
      return {
        label: 'Konfirmasi Booking',
        icon: <CalendarCheck className="w-3 h-3" />,
        header: 'from-blue-50 to-white',
        avatar: 'bg-blue-100 text-blue-700',
        badge: 'bg-blue-100 text-blue-700 border-blue-200'
      };

    case 'therapy_reminder':
    case 'appointment_reminder':
      return {
        label: 'Reminder Terapi',
        icon: <Clock className="w-3 h-3" />,
        header: 'from-emerald-50 to-white',
        avatar: 'bg-emerald-100 text-emerald-700',
        badge: 'bg-emerald-100 text-emerald-700 border-emerald-200'
      };

    case 'follow_up':
      return {
        label: 'Follow Up Rutin',
        icon: <MessageCircle className="w-3 h-3" />,
        header: 'from-purple-50 to-white',
        avatar: 'bg-purple-100 text-purple-700',
        badge: 'bg-purple-100 text-purple-700 border-purple-200'
      };

    // 🔶 PAKET EXPIRED
    case 'expiry_package':
      return {
        label: 'Paket Expired',
        icon: <Calendar className="w-3 h-3" />,
        header: 'from-amber-50 to-white',
        avatar: 'bg-amber-100 text-amber-700',
        badge: 'bg-amber-100 text-amber-700 border-amber-200'
      };

    // 🎉 ULANG TAHUN
    case 'birthday':
    case 'birthday_greeting':
      return {
        label: 'Ulang Tahun',
        icon: <MessageCircle className="w-3 h-3" />,
        header: 'from-pink-50 to-white',
        avatar: 'bg-pink-100 text-pink-700',
        badge: 'bg-pink-100 text-pink-700 border-pink-200'
      };

    default:
      return {
        label: type?.replace(/_/g, ' ') || 'General',
        icon: <MessageCircle className="w-3 h-3" />,
        header: 'from-slate-50 to-white',
        avatar: 'bg-slate-200 text-slate-700',
        badge: 'bg-slate-100 text-slate-700 border-slate-200'
      };
  }
};

  const typeConfig = getTypeConfig(item.follow_up_type);

  const handleAction = async (fn) => {
    if (!fn) return;
    setIsProcessing(true);
    try {
      await fn(item.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const isPending = item.status === 'pending';

  const handleSendWhatsApp = () => {
    onSend && onSend(item);
  };

  const formatDateDisplay = () => {
    if (!item.scheduled_date) return '-';
    try {
      return format(parseISO(item.scheduled_date), 'd MMM yyyy', {
        locale: idLocale
      });
    } catch {
      return item.scheduled_date;
    }
  };

  const formattedTime = item.scheduled_time
    ? item.scheduled_time.substring(0, 5)
    : '00:00';

  const initials = patientName
    ? patientName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'PS';

  const shouldShowToggle = displayMessage && displayMessage.length > 140;
const daysLeft =
  displayMessage.match(/(\d+)\s*hari/i)?.[1] ?? '-';

const sessionsRemaining =
  displayMessage.match(/(\d+)\s*sesi/i)?.[1] ?? '-';

const getPackageRisk = () => {

  if (item.follow_up_type !== 'package_expiry') {
    return null;
  }

  if (
    daysLeft !== null &&
    daysLeft <= 7 &&
    sessionsRemaining >= 3
  ) {
    return {
      label: 'PRIORITAS TINGGI',
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: '🔥'
    };
  }

  if (
    daysLeft !== null &&
    daysLeft <= 14
  ) {
    return {
      label: 'PERLU DIJADWALKAN',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: '⚠️'
    };
  }

  return {
    label: 'MASIH AMAN',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    icon: '✅'
  };
};

const packageRisk = getPackageRisk();
  return (
    <Card className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg sm:hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col">

      {/* ===== Premium Header ===== */}
      <div className={`bg-gradient-to-r ${typeConfig.header} p-3 sm:p-5`}>

        <div className="flex items-start gap-3 sm:gap-4">

          <Avatar className="h-9 w-9 sm:h-12 sm:w-12 shadow-sm shrink-0">
            <AvatarFallback className={`${typeConfig.avatar} font-semibold text-xs sm:text-sm`}>
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3
                className="font-semibold text-sm sm:text-base text-slate-900 truncate max-w-full"
                title={patientName}
              >
                {patientName}
              </h3>
              {isGuest && item.follow_up_type !== 'reminder_therapist_h10' && (
                <span className="shrink-0 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200">
                  Pasien Baru
                </span>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-1.5 mt-1.5">

  <Badge
    variant="outline"
    className={`flex items-center gap-1 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full ${typeConfig.badge}`}
  >
    {typeConfig.icon}
    {typeConfig.label}
  </Badge>

  <Badge
    variant="outline"
    className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-semibold
      ${
        item.status === 'failed'
          ? 'bg-red-100 text-red-700 border-red-200'
          : item.status === 'completed' || item.status === 'sent'
          ? 'bg-green-100 text-green-700 border-green-200'
          : item.status === 'cancelled'
          ? 'bg-slate-100 text-slate-500 border-slate-200'
          : 'bg-yellow-100 text-yellow-700 border-yellow-200'
      }
    `}
  >
    <div className="flex items-center gap-1">
      <div
        className={`w-1.5 h-1.5 rounded-full
          ${
            item.status === 'failed'
              ? 'bg-red-500'
              : item.status === 'completed' || item.status === 'sent'
              ? 'bg-green-500'
              : item.status === 'cancelled'
              ? 'bg-slate-400'
              : 'bg-yellow-500'
          }
        `}
      />

      {item.status === 'failed'
        ? 'Failed'
        : item.status === 'completed'
        ? 'Completed'
        : item.status === 'sent'
        ? 'Sent'
        : item.status === 'cancelled'
        ? 'Cancelled'
        : 'Pending'}
    </div>
  </Badge>

</div>

            <div className="flex items-center flex-wrap text-[11px] sm:text-xs text-slate-600 mt-2 gap-x-3 gap-y-1">
              <span className="flex items-center gap-1 min-w-0 shrink-0">
                <Phone className="w-3 h-3 shrink-0" />
                <span className="truncate">{patientPhone}</span>
              </span>

              {medicalRecordNumber && (
                <span className="border-l pl-3 border-slate-300 shrink-0">
                  {medicalRecordNumber}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-500 mt-1.5 sm:mt-2">
              <Calendar className="w-3 h-3" />
              Jadwal kirim: {formatDateDisplay()} • {formattedTime}
            </div>
            {item.follow_up_type === 'package_expiry' && (() => {

  const days = Number(daysLeft);

  const colorConfig =
    days <= 7
      ? {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          value: 'text-red-900',
          label: '🔥 Prioritas Tinggi'
        }
      : days <= 14
      ? {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          value: 'text-amber-900',
          label: '⚠️ Perlu Dijadwalkan'
        }
      : {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          value: 'text-emerald-900',
          label: '✅ Masih Aman'
        };

  return (

    <div className="mt-2.5 sm:mt-3">

      <div
        className={`
          text-[9px] sm:text-[10px]
          font-semibold
          px-2
          py-1
          rounded-lg
          inline-flex
          mb-1.5 sm:mb-2
          ${colorConfig.bg}
          ${colorConfig.text}
        `}
      >
        {colorConfig.label}
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">

        <div
          className={`
            rounded-lg sm:rounded-xl
            border
            px-2.5 sm:px-3
            py-1.5 sm:py-2
            ${colorConfig.bg}
            ${colorConfig.border}
          `}
        >
          <div className={`text-[9px] sm:text-[10px] uppercase ${colorConfig.text}`}>
            Masa Berlaku
          </div>

          <div
            className={`text-lg sm:text-xl font-bold mt-0.5 sm:mt-1 ${colorConfig.value}`}
          >
            {daysLeft}
          </div>

          <div className="text-[9px] sm:text-[10px] text-slate-500">
            Hari
          </div>
        </div>

        <div
          className="
            rounded-lg sm:rounded-xl
            border
            border-slate-200
            bg-slate-50
            px-2.5 sm:px-3
            py-1.5 sm:py-2
          "
        >
          <div className="text-[9px] sm:text-[10px] uppercase text-slate-600">
            Sesi Tersisa
          </div>

          <div className="text-lg sm:text-xl font-bold mt-0.5 sm:mt-1 text-slate-900">
            {sessionsRemaining}
          </div>

          <div className="text-[9px] sm:text-[10px] text-slate-500">
            Sesi
          </div>
        </div>

      </div>

    </div>

  );

})()}
          </div>
        </div>
      </div>

      {/* ===== Message Section ===== */}
      <div className="p-3 sm:p-5 flex-grow">

        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-4 text-xs sm:text-sm text-slate-700 leading-relaxed shadow-sm">

          <div className={expanded ? '' : 'line-clamp-4'}>
            {displayMessage || 'No message content'}
          </div>

          {shouldShowToggle && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-600 hover:text-blue-700 mt-2 font-medium"
            >
              {expanded ? 'Tutup Pesan' : 'Lihat Selengkapnya'}
            </button>
          )}
        </div>

      </div>

      {/* ===== Actions ===== */}
      <div className="px-3 pb-3 sm:px-5 sm:pb-5 flex flex-wrap items-center gap-1.5 sm:gap-2">

  <Button
    size="sm"
    className="flex-1 min-w-[90px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg sm:rounded-xl gap-1 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3 disabled:opacity-50"
    onClick={handleSendWhatsApp}
    disabled={isProcessing || !isPending}
  >
    {isProcessing
      ? <Loader2 className="w-3 h-3 animate-spin" />
      : <Send className="w-3 h-3" />}
    Kirim
  </Button>

  <Button
    size="sm"
    variant="outline"
    className="flex-1 min-w-[90px] rounded-lg sm:rounded-xl h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3 disabled:opacity-50"
    onClick={() => handleAction(onComplete)}
    disabled={isProcessing || !isPending}
  >
    <CheckCircle className="w-3 h-3" />
    Selesai
  </Button>


  <Button
    size="sm"
    variant="ghost"
    className="rounded-lg sm:rounded-xl h-8 w-8 sm:h-9 sm:w-9 p-0 shrink-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
    onClick={handleCopyMessage}
    title="Salin pesan"
  >
    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
  </Button>

  <Button
    size="sm"
    variant="ghost"
    className="rounded-lg sm:rounded-xl h-8 w-8 sm:h-9 sm:w-9 p-0 shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
    onClick={() => handleAction(onDelete)}
    disabled={isProcessing}
  >
    <Trash2 className="w-4 h-4" />
  </Button>

</div>
    </Card>
  );
};

export default FollowUpCard;