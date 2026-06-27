import React from 'react';
import { FileText, Brain, Search, ShieldAlert, Database, AlertCircle } from 'lucide-react';

const ICONS = {
  file: FileText,
  brain: Brain,
  search: Search,
  shield: ShieldAlert,
  database: Database,
  info: AlertCircle
};

export function EmptyState({ icon, title, action, subtitle }) {
  const IconComponent = ICONS[icon] || ICONS.info;
  
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-surface-card border border-surface-border rounded-md min-h-[300px]">
      <div className="p-4 bg-[#1C2128] rounded-full border border-surface-border mb-4">
        <IconComponent className="w-8 h-8 text-text-secondary" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-1 select-none">
        {title}
      </h3>
      {subtitle && (
        <p className="text-sm text-text-secondary mb-4 max-w-sm select-none">
          {subtitle}
        </p>
      )}
      {action && (
        <div className="text-sm text-accent-blue font-medium hover:underline cursor-pointer select-none">
          {action}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
