import React from 'react';
import { cn } from '@/lib/utils';

const Skeleton = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200 dark:bg-slate-800", className)}
      {...props}
    />
  );
};

export { Skeleton };