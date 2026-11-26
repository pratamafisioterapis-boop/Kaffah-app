// Jawaban kuesioner disimpan sebagai satu teks di patient_feedback_responses.comment dengan format
// "<pertanyaan>: <jawaban>" per pertanyaan (lihat handlePraxisSubmit di PatientFeedbackPage).
// Fungsi di bawah memecahnya kembali menjadi pasangan pertanyaan -> jawaban berdasarkan daftar
// pertanyaan klinik. Pencocokan memakai label (bukan pemisah baris) agar jawaban teks panjang yang
// berisi baris baru atau tanda ":" tetap utuh.

const labelFor = (q, clinicName) => String(q.label || '').replace('{clinic}', clinicName || '');

// Mengembalikan { items: [{ id, label, type, answer }], matched }.
// matched=false bila tidak ada satu pun pertanyaan yang cocok (mis. respons lama sebelum pertanyaan diubah);
// pemanggil sebaiknya menampilkan teks mentah.
export const parseAnswers = (comment, questions, clinicName) => {
  const text = String(comment || '');
  const found = [];
  let cursor = 0;
  (questions || []).forEach((q) => {
    const marker = `${labelFor(q, clinicName)}: `;
    const at = text.indexOf(marker, cursor);
    if (at >= 0) {
      found.push({ q, start: at, valueStart: at + marker.length });
      cursor = at + marker.length;
    }
  });
  const items = found.map((f, i) => {
    const end = i + 1 < found.length ? found[i + 1].start : text.length;
    return {
      id: f.q.id,
      label: labelFor(f.q, clinicName),
      type: f.q.type,
      answer: text.slice(f.valueStart, end).replace(/\n$/, '').trim(),
    };
  });
  return { items, matched: items.length > 0 };
};

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// rows: [{ date, name, nickname, phone, rm, rating, answers: Map-like object id->answer, raw }]
export const buildResponsesCsv = (rows, questions, clinicName) => {
  const head = [
    'Tanggal', 'Nama', 'Nama Panggilan', 'No. HP', 'No. RM', 'Rating (1-5)',
    ...questions.map((q) => labelFor(q, clinicName)),
    'Teks Mentah',
  ];
  const lines = [head.map(csvCell).join(',')];
  rows.forEach((r) => {
    lines.push([
      r.date, r.name, r.nickname, r.phone, r.rm, r.rating,
      ...questions.map((q) => r.answers?.[q.id] ?? ''),
      r.answers && Object.keys(r.answers).length ? '' : r.raw,
    ].map(csvCell).join(','));
  });
  // BOM agar Excel membaca UTF-8 (emoji/huruf non-Latin) dengan benar.
  return `﻿${lines.join('\r\n')}`;
};

export const downloadTextFile = (filename, content, mime = 'text/csv;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
