import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import KonversiDokterLayout from './KonversiDokterLayout';
import KonversiDokterConverter from './KonversiDokterConverter';

const KonversiDokterApp = () => {
  return (
    <KonversiDokterLayout>
      <Routes>
        <Route path="/" element={<KonversiDokterConverter />} />
        <Route path="*" element={<Navigate to="/konversi-dokter" replace />} />
      </Routes>
    </KonversiDokterLayout>
  );
};

export default KonversiDokterApp;
