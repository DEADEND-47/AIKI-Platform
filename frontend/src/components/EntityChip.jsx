import React from 'react';

const TYPE_COLORS = {
  equipment_tag:    { border: '#2F81F7', bg: 'rgba(47,129,247,0.1)' },
  process_parameter:{ border: '#D29922', bg: 'rgba(210,153,34,0.1)' },
  regulatory_ref:   { border: '#A371F7', bg: 'rgba(163,113,247,0.1)' },
  personnel:        { border: '#7D8590', bg: 'rgba(125,133,144,0.1)' },
  failure_mode:     { border: '#F85149', bg: 'rgba(248,81,73,0.1)'  },
  date:             { border: '#3FB950', bg: 'rgba(63,185,80,0.1)'  },
  location:         { border: '#58A6FF', bg: 'rgba(88,166,255,0.1)' },
};

export function EntityChip({ type, value, page, confidence }) {
  const colors = TYPE_COLORS[type] || TYPE_COLORS.personnel;
  return (
    <span 
      className="inline-flex items-center gap-1 select-none font-mono"
      style={{
        fontSize: '12px',
        padding: '2px 8px',
        borderRadius: '4px',
        borderLeft: `3px solid ${colors.border}`,
        background: colors.bg,
        color: '#E6EDF3',
      }}
      title={`${type}${page ? `, Page ${page}` : ''}${confidence ? `, Confidence: ${Math.round(confidence * 100)}%` : ''}`}
    >
      {value}
    </span>
  );
}

export default EntityChip;
