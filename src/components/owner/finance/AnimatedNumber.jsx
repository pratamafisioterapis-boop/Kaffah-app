import React from 'react';
import useCountUp from '@/hooks/useCountUp';

// Angka yang naik dari nol (atau dari nilai sebelumnya) saat muncul/berubah.
const AnimatedNumber = ({ value, format, className }) => {
  const v = useCountUp(Number(value) || 0);
  return <span className={className}>{format(v)}</span>;
};

export default AnimatedNumber;
