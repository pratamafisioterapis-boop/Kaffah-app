import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';

// Banner at the top of the owner/admin pages. One component instead of a copy per
// page, so spacing, type and theme colors change in one place. Colors come from the
// clinic design style (`app-*` tokens); the illustration is decorative.
const PageHero = ({
  image,
  objectPosition = '38% center',
  kicker,
  title,
  highlight,
  description,
  wide = false,
  className,
}) => {
  const { clinicName } = useAuth();

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-app-border shadow-sm h-44 sm:h-52 md:h-60 lg:h-72',
        className
      )}
    >
      <img
        src={image}
        alt=""
        decoding="async"
        style={{ objectPosition }}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-white via-white/85 via-50% to-transparent to-80% pointer-events-none"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
        <div
          className={cn(
            'max-w-[74%] sm:max-w-[62%]',
            wide ? 'md:max-w-md lg:max-w-xl' : 'md:max-w-sm'
          )}
        >
          <p className="text-app-muted text-xs sm:text-sm font-medium mb-1">
            {kicker !== undefined ? kicker : clinicName || ''}
          </p>
          <h1
            style={{ fontFamily: "'Caveat', cursive" }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-app-ink leading-[0.85]"
          >
            {title}
            <br />
            <span
              className={cn(
                'text-app-accent-bright underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8',
                wide && 'block md:whitespace-nowrap md:text-[1.75rem] lg:text-[2.35rem]'
              )}
            >
              {highlight}
            </span>
          </h1>
          {description ? (
            <p className="text-app-muted text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PageHero;
