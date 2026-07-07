import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RotasiLayout from './RotasiLayout';
import RotasiDailySchedule from './RotasiDailySchedule';
import RotasiHistory from './RotasiHistory';
import RotasiPatients from './RotasiPatients';
import RotasiTherapists from './RotasiTherapists';
import RotasiSetup from './RotasiSetup';

const RotasiApp = () => {
  return (
    <RotasiLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/rotasi/jadwal" replace />} />
        <Route path="/jadwal" element={<RotasiDailySchedule />} />
        <Route path="/riwayat" element={<RotasiHistory />} />
        <Route path="/pasien" element={<RotasiPatients />} />
        <Route path="/terapis" element={<RotasiTherapists />} />
        <Route path="/setup" element={<RotasiSetup />} />
      </Routes>
    </RotasiLayout>
  );
};

export default RotasiApp;