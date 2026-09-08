import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse rounded bg-ink-800/80 motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="p-3.5 rounded-md surface-inset space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-sm" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="space-y-1 pt-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-sm" />
      </div>
    </div>
  );
};

export const SkeletonRow: React.FC = () => {
  return (
    <div className="p-3 border-b border-line-subtle flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 flex-1">
        <Skeleton className="w-5 h-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-5 w-16 rounded-sm" />
    </div>
  );
};

