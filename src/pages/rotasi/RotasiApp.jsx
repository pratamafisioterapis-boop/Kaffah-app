import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RotasiLayout from './RotasiLayout';
import RotasiDailySchedule from './RotasiDailySchedule';
import RotasiHistory from './RotasiHistory';
import RotasiPatients from './RotasiPatients';
import RotasiTherapists from './RotasiTherapists';

const RotasiApp = () => {
  return (
    <RotasiLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/rotasi/jadwal" replace />} />
        <Route path="/jadwal" element={<RotasiDailySchedule />} />
        <Route path="/riwayat" element={<RotasiHistory />} />
        <Route path="/pasien" element={<RotasiPatients />} />
        <Route path="/terapis" element={<RotasiTherapists />} />
      </Routes>
    </RotasiLayout>
  );
};

export default RotasiApp;