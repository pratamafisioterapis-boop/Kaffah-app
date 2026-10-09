import React, { useEffect, useState } from 'react';

// Date + HH:mm shown in the dashboard banner. It only displays minutes, so it
// ticks once per minute (aligned to the minute change) and only this component
// re-renders, instead of the whole dashboard re-rendering every second.
const HeroClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const schedule = () => {
      const d = new Date();
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, (60 - d.getSeconds()) * 1000 - d.getMilliseconds() + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const todayLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {todayLabel} <span className="text-app-border">•</span>{' '}
      <span className="font-mono tabular-nums">{time}</span>
    </>
  );
};

export default HeroClock;
