import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OwnerTherapistScheduleSettings from '@/components/owner/OwnerTherapistScheduleSettings';
import { getPhysiotherapistByUserId, getAllPhysiotherapists } from '@/lib/api';

const TherapistScheduleSettingsPage = () => {
    const { therapistId } = useParams();
    const navigate = useNavigate();
    const [therapistName, setTherapistName] = useState('Loading...');

    useEffect(() => {
        const fetchName = async () => {
            const { data } = await getAllPhysiotherapists();
            const therapist = data?.find(t => t.id === therapistId);
            if (therapist) {
                setTherapistName(therapist.name);
            }
        };
        fetchName();
    }, [therapistId]);

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate('/owner/physiotherapist-management')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Pengaturan Jadwal Tampilan</h1>
                    <p className="text-slate-500">
                        Mengatur jam praktek untuk <strong>{therapistName}</strong>
                    </p>
                </div>
            </div>

            <OwnerTherapistScheduleSettings therapistId={therapistId} />
        </div>
    );
};

export default TherapistScheduleSettingsPage;