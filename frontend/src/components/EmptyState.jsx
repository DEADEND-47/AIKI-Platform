import React from 'react';
import { FileText, Brain, Search, ShieldAlert, Database, AlertCircle, Upload, Zap } from 'lucide-react';

const ICON_MAP = {
  file: FileText,
  brain: Brain,
  search: Search,
  shield: ShieldAlert,
  database: Database,
  info: AlertCircle,
  upload: Upload,
  zap: Zap,
};

/**
 * Illustrated SVG backgrounds for each state type
 */
const IllustrationBg = ({ type }) => {
  const patterns = {
    file: (
      <svg viewBox="0 0 200 140" className="w-full h-full opacity-40" aria-hidden="true">
        <rect x="40" y="20" width="55" height="70" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
        <rect x="55" y="30" width="70" height="80" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
        <line x1="65" y1="52" x2="110" y2="52" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="65" y1="62" x2="105" y2="62" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="65" y1="72" x2="95" y2="72" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="155" cy="40" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
        <circle cx="155" cy="40" r="8" fill="currentColor" fillOpacity="0.15"/>
        <line x1="155" y1="28" x2="155" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="155" y1="52" x2="155" y2="58" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    search: (
      <svg viewBox="0 0 200 140" className="w-full h-full opacity-40" aria-hidden="true">
        <circle cx="85" cy="65" r="35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3"/>
        <line x1="111" y1="91" x2="140" y2="120" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="85" cy="65" r="18" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="75" y1="65" x2="95" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="85" y1="55" x2="85" y2="75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    brain: (
      <svg viewBox="0 0 200 140" className="w-full h-full opacity-40" aria-hidden="true">
        <ellipse cx="100" cy="65" rx="45" ry="35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
        <path d="M80 55 Q100 45 120 55" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M75 70 Q100 80 125 70" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="100" cy="65" r="6" fill="currentColor" fillOpacity="0.2"/>
        <line x1="50" y1="50" x2="35" y2="40" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        <line x1="50" y1="65" x2="30" y2="65" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        <line x1="150" y1="50" x2="165" y2="40" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        <line x1="150" y1="65" x2="170" y2="65" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 200 140" className="w-full h-full opacity-40" aria-hidden="true">
        <path d="M100 20 L145 38 L145 75 Q145 105 100 120 Q55 105 55 75 L55 38 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
        <path d="M100 30 L135 45 L135 75 Q135 100 100 112 Q65 100 65 75 L65 45 Z" fill="currentColor" fillOpacity="0.06"/>
        <path d="M82 70 L92 80 L118 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    default: (
      <svg viewBox="0 0 200 140" className="w-full h-full opacity-40" aria-hidden="true">
        <rect x="55" y="30" width="90" height="80" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3"/>
        <line x1="70" y1="55" x2="130" y2="55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="70" y1="70" x2="120" y2="70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="70" y1="85" x2="105" y2="85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="100" cy="110" r="0" fill="currentColor"/>
      </svg>
    ),
  };
  return patterns[type] || patterns.default;
};

export function EmptyState({ icon = 'info', title, subtitle, action, onAction }) {
  const IconComponent = ICON_MAP[icon] || ICON_MAP.info;
  const illustrationType = icon;

  return (
    <div className="flex flex-col items-center justify-center p-10 text-center bg-surface-card border border-surface-border rounded-xl min-h-[280px] relative overflow-hidden select-none">
      {/* Illustrated background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-text-muted">
        <div className="w-48 h-36">
          <IllustrationBg type={illustrationType} />
        </div>
      </div>

      {/* Icon */}
      <div className="relative z-10 p-3.5 bg-surface border border-surface-border rounded-2xl mb-4 shadow-sm">
        <IconComponent className="w-7 h-7 text-text-secondary" strokeWidth={1.5} />
      </div>

      {/* Text */}
      <h3 className="relative z-10 text-base font-semibold text-text-primary mb-1.5 text-balance">
        {title}
      </h3>
      {subtitle && (
        <p className="relative z-10 text-sm text-text-secondary mb-5 max-w-xs leading-relaxed text-balance">
          {subtitle}
        </p>
      )}

      {/* Action button */}
      {action && (
        <button
          onClick={onAction}
          className="relative z-10 btn-primary text-sm flex items-center gap-2 px-4 py-2 mt-1"
        >
          <Upload className="w-3.5 h-3.5" />
          {action}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
