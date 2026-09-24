import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import KonversiDokterLayout from './KonversiDokterLayout';
import KonversiDokterConverter from './KonversiDokterConverter';
import InsentifBulananPage from './InsentifBulananPage';

const KonversiDokterApp = () => {
  return (
    <KonversiDokterLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/konversi-dokter/pdf" replace />} />
        <Route path="/pdf" element={<KonversiDokterConverter />} />
        <Route path="/insentif-bulanan" element={<InsentifBulananPage />} />
        <Route path="*" element={<Navigate to="/konversi-dokter/pdf" replace />} />
      </Routes>
    </KonversiDokterLayout>
  );
};

export default KonversiDokterApp;
