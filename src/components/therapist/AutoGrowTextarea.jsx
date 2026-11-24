import React, { useLayoutEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';

/** Textarea yang tingginya mengikuti isi, jadi teks panjang tidak terpotong dan tidak perlu digulir. */
const AutoGrowTextarea = ({ value, ...props }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <Textarea ref={ref} value={value} {...props} />;
};

export default AutoGrowTextarea;
