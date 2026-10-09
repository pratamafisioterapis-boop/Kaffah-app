import React from 'react';
import { cn } from '@/lib/utils';

// Compact page header for the therapist area. Therapists work mostly on a phone, so
// instead of the tall illustrated banner used for owner/admin it is a quiet plate:
// the title, one line of context, optional actions and key numbers, plus today's
// date as a small calendar leaf (their work is organised by day). Colors, radius and
// font follow the clinic design style through the `app-*` tokens.

const TodayLeaf = () => {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(now);
  const day = now.getDate();
  const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(now);
  const full = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(now);

  return (
    <time
      dateTime={now.toISOString().slice(0, 10)}
      aria-label={full}
      className="flex w-12 shrink-0 flex-col overflow-hidden rounded-app border border-app-border bg-white text-center shadow-sm sm:w-14"
    >
      <span className="bg-app-accent px-1 py-0.5 text-xs font-semibold leading-4 text-white">{weekday}</span>
      <span className="pt-1 text-lg font-semibold leading-6 tabular-nums text-app-ink sm:text-xl">{day}</span>
      <span className="pb-1 text-xs leading-4 text-app-muted">{month}</span>
    </time>
  );
};

const TherapistPageHeader = ({
  title,
  description,
  actions,
  meta = [],
  showDate = true,
  className,
}) => (
  <header
    className={cn(
      'rounded-app-lg bg-app-soft px-4 py-4 ring-1 ring-inset ring-app-border/60 sm:px-6 sm:py-5',
      className
    )}
  >
    {/* Mobile: title + date on the first row, actions wrap onto their own row. */}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.375rem] font-semibold leading-tight tracking-tight text-app-ink text-balance sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[60ch] text-sm leading-snug text-app-muted text-pretty">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="order-last flex basis-full items-center gap-2 sm:order-none sm:basis-auto">{actions}</div>
      ) : null}
      {showDate ? <TodayLeaf /> : null}
    </div>

    {meta.length > 0 && (
      <dl className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 border-t border-app-border pt-3">
        {meta.map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-app-muted">{label}</dt>
            <dd className="truncate text-base font-semibold tabular-nums text-app-ink">{value}</dd>
          </div>
        ))}
      </dl>
    )}
  </header>
);

export default TherapistPageHeader;
