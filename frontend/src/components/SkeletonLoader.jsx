import React from 'react';

export function SkeletonRow() {
  return (
    <div className="flex gap-4 p-4 border-b border-[#30363D] animate-pulse">
      <div className="h-4 bg-[#30363D] rounded w-1/3" />
      <div className="h-4 bg-[#30363D] rounded w-1/6" />
      <div className="h-4 bg-[#30363D] rounded w-1/12" />
      <div className="h-4 bg-[#30363D] rounded w-1/6" />
      <div className="h-4 bg-[#30363D] rounded w-1/4" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="p-5 bg-surface-card border border-surface-border rounded-md space-y-4 animate-pulse">
      <div className="h-5 bg-[#30363D] rounded w-1/4" />
      <div className="space-y-2">
        <div className="h-3 bg-[#30363D] rounded w-full" />
        <div className="h-3 bg-[#30363D] rounded w-5/6" />
        <div className="h-3 bg-[#30363D] rounded w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="border border-surface-border rounded-md bg-surface-card overflow-hidden">
      <div className="h-10 bg-[#161B22] border-b border-surface-border" />
      {Array.from({ length: rows }).map((_, idx) => (
        <SkeletonRow key={idx} />
      ))}
    </div>
  );
}

export default SkeletonTable;
