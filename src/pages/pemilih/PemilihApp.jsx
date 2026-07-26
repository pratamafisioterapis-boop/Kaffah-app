import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PemilihLayout from './PemilihLayout';
import PemilihDashboard from './PemilihDashboard';
import PemilihUploadKTP from './PemilihUploadKTP';
import PemilihData from './PemilihData';
import PemilihTimSukses from './PemilihTimSukses';
import PemilihKegiatan from './PemilihKegiatan';
import PemilihSetup from './PemilihSetup';
import PemilihDataDpt from './PemilihDataDpt';
import PemilihExtractPdf from './PemilihExtractPdf';

const PemilihApp = () => {
  return (
    <PemilihLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/pemilih/dashboard" replace />} />
        <Route path="/dashboard" element={<PemilihDashboard />} />
        <Route path="/upload-ktp" element={<PemilihUploadKTP />} />
        <Route path="/data" element={<PemilihData />} />
        <Route path="/data-dpt" element={<PemilihDataDpt />} />
        <Route path="/data-2024" element={<Navigate to="/pemilih/data-dpt" replace />} />
        <Route path="/tim-sukses" element={<PemilihTimSukses />} />
        <Route path="/kegiatan" element={<PemilihKegiatan />} />
        <Route path="/setup" element={<PemilihSetup />} />
        <Route path="/wilayah" element={<Navigate to="/pemilih/setup?tab=wilayah" replace />} />
        <Route path="/kategori-program" element={<Navigate to="/pemilih/setup?tab=kategori" replace />} />
        <Route path="/extract-pdf" element={<PemilihExtractPdf />} />
      </Routes>
    </PemilihLayout>
  );
};

export default PemilihApp;