import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PemilihLayout from './PemilihLayout';
import PemilihDashboard from './PemilihDashboard';
import PemilihUploadKTP from './PemilihUploadKTP';
import PemilihData from './PemilihData';
import PemilihTimSukses from './PemilihTimSukses';
import PemilihKegiatan from './PemilihKegiatan';
import PemilihWilayah from './PemilihWilayah';
import PemilihKategoriProgram from './PemilihKategoriProgram';
import PemilihExtractPdf from './PemilihExtractPdf';

const PemilihApp = () => {
  return (
    <PemilihLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/pemilih/dashboard" replace />} />
        <Route path="/dashboard" element={<PemilihDashboard />} />
        <Route path="/upload-ktp" element={<PemilihUploadKTP />} />
        <Route path="/data" element={<PemilihData />} />
        <Route path="/tim-sukses" element={<PemilihTimSukses />} />
        <Route path="/kegiatan" element={<PemilihKegiatan />} />
        <Route path="/wilayah" element={<PemilihWilayah />} />
        <Route path="/kategori-program" element={<PemilihKategoriProgram />} />
        <Route path="/extract-pdf" element={<PemilihExtractPdf />} />
      </Routes>
    </PemilihLayout>
  );
};

export default PemilihApp;