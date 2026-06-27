import React from 'react';

export function ConfidenceBadge({ score, label, confidence }) {
  // If explicit label is provided, use it directly
  // Otherwise derive from score or fallback to legacy confidence prop
  const level = (label || confidence || (typeof score === 'number' ? (score >= 0.8 ? 'HIGH' : score >= 0.5 ? 'MEDIUM' : 'LOW') : (score || 'LOW'))).toUpperCase();
  
  let dotColor = '#F85149'; // red for LOW
  let textColor = 'text-[#F85149]';
  let bgColor = 'rgba(248,81,73,0.1)';
  
  if (level === 'HIGH') {
    dotColor = '#3FB950'; // green
    textColor = 'text-[#3FB950]';
    bgColor = 'rgba(63,185,80,0.1)';
  } else if (level === 'MEDIUM') {
    dotColor = '#D29922'; // amber
    textColor = 'text-[#D29922]';
    bgColor = 'rgba(210,153,34,0.1)';
  }
  
  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider ${textColor}`}
      style={{ background: bgColor }}
    >
      <span 
        className="w-1.5 h-1.5 rounded-full" 
        style={{ backgroundColor: dotColor }}
      />
      {level}
    </span>
  );
}

export default ConfidenceBadge;
