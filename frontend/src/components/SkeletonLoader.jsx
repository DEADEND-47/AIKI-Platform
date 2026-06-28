import React from 'react';

/**
 * Individual skeleton line — uses CSS shimmer animation
 */
function SkeletonLine({ className = '' }) {
  return (
    <div className={`shimmer-bg rounded ${className}`} />
  );
}

/**
 * Table row skeleton with shimmer cells
 */
export function SkeletonRow() {
  return (
    <div className="flex gap-4 p-4 border-b border-surface-border">
      <SkeletonLine className="h-3.5 flex-[3]" />
      <SkeletonLine className="h-3.5 flex-[1.5]" />
      <SkeletonLine className="h-3.5 flex-1" />
      <SkeletonLine className="h-3.5 flex-[1.5]" />
      <SkeletonLine className="h-3.5 flex-[2]" />
    </div>
  );
}

/**
 * Card skeleton with heading + body lines
 */
export function SkeletonCard() {
  return (
    <div className="p-5 bg-surface-card border border-surface-border rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-4 w-1/4" />
        <SkeletonLine className="h-4 w-8 rounded-full" />
      </div>
      <div className="space-y-2.5">
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-3 w-5/6" />
        <SkeletonLine className="h-3 w-3/4" />
      </div>
    </div>
  );
}

/**
 * Stat card skeleton — mimics metric number + label
 */
export function SkeletonStat() {
  return (
    <div className="p-4 bg-surface-card border border-surface-border rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-2.5 w-16" />
        <SkeletonLine className="h-3.5 w-3.5 rounded" />
      </div>
      <SkeletonLine className="h-7 w-14 mt-2" />
      <SkeletonLine className="h-2 w-20" />
    </div>
  );
}

/**
 * Full table with header + rows
 */
export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="border border-surface-border rounded-xl bg-surface-card overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-surface border-b border-surface-border">
        {[3, 1.5, 1, 1.5, 2].map((flex, i) => (
          <SkeletonLine key={i} className={`h-3 flex-[${flex}]`} style={{ flex }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <SkeletonRow key={idx} />
      ))}
    </div>
  );
}

export default SkeletonTable;
