// Terapis yang tidak ikut review video latihan: tidak melihat menunya dan tidak dihitung dalam pembagian antrean.
export const isReviewExempt = (name) => /^\s*adi\s+pratama\b/i.test(name || '');
