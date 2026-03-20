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
  CalendarCheck
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

  const displayMessage = interpolateTemplate(item.message_content, item);

  // ==============================
  // Guest Detection
  // ==============================
  const isGuest = !item.patient_id;

  const patientName = isGuest
    ? item.guest_name || 'Guest'
    : item.patient?.full_name || 'Pasien';

  const patientPhone = isGuest
    ? item.guest_phone || '-'
    : item.phone_number || item.patient?.phone || '-';

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

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col">

      {/* ===== Premium Header ===== */}
      <div className={`bg-gradient-to-r ${typeConfig.header} p-5`}>

        <div className="flex items-start gap-4">

          <Avatar className="h-12 w-12 shadow-sm">
            <AvatarFallback className={`${typeConfig.avatar} font-semibold text-sm`}>
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3
                className="font-semibold text-slate-900 truncate"
                title={patientName}
              >
                {patientName}
              </h3>

              <Badge
                variant="outline"
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${typeConfig.badge}`}
              >
                {typeConfig.icon}
                {typeConfig.label}
              </Badge>
            </div>

            <div className="flex items-center text-xs text-slate-600 mt-1 gap-3">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {patientPhone}
              </span>

              {medicalRecordNumber && (
                <span className="border-l pl-3 border-slate-300">
                  {medicalRecordNumber}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-500 mt-2">
              <Calendar className="w-3 h-3" />
              {formatDateDisplay()} • {formattedTime}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Message Section ===== */}
      <div className="p-5 flex-grow">

        <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed shadow-sm">

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
      <div className="px-5 pb-5 flex gap-2">

        <Button
          size="sm"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1"
          onClick={handleSendWhatsApp}
          disabled={isProcessing}
        >
          {isProcessing
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Send className="w-3 h-3" />}
          Kirim
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-xl"
          onClick={() => handleAction(onComplete)}
          disabled={isProcessing}
        >
          <CheckCircle className="w-3 h-3" />
          Selesai
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
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