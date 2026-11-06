import React, { Suspense, useState } from 'react';
import { CASE_OPTIONS } from '@/lib/hnp3d/cases';
import './anatomy3dCases.css';

// Menu "Anatomi 3D" di akun terapis: peraga 3D per kasus. Pilih kasus di dropdown pada viewer.
// Kasus baru: tambah entri di lib/hnp3d/cases.js (CASE_OPTIONS) dan buat view + mesin 3D-nya.

const SpineCaseView = React.lazy(() => import('./SpineCaseView'));
const ShoulderCaseView = React.lazy(() => import('./ShoulderCaseView'));

const Anatomy3DExplorer = () => {
  const [caseKey, setCaseKey] = useState(CASE_OPTIONS[0].value);
  const kind = CASE_OPTIONS.find((o) => o.value === caseKey)?.kind;
  const View = kind === 'shoulder' ? ShoulderCaseView : SpineCaseView;
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-extrabold text-app-ink">Anatomi 3D</h1>
        <p className="text-sm text-app-muted">Peraga 3D per kasus untuk menjelaskan ke pasien lokasi dan penyebab keluhan.</p>
      </div>
      <Suspense fallback={<div className="h3d" style={{ placeItems: 'center' }}>Memuat…</div>}>
        <View key={kind} caseKey={caseKey} onCase={setCaseKey} options={CASE_OPTIONS} />
      </Suspense>
    </div>
  );
};

export default Anatomy3DExplorer;
