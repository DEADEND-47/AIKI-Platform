import React from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useToast } from '../hooks/useToast';

export function ToastContainer() {
  const { toasts, remove } = useToast();
  
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full p-4 pointer-events-none">
      {toasts.map((t) => {
        let borderColor = 'border-accent-blue';
        let bgStyle = 'bg-surface-card';
        let icon = <Info className="w-5 h-5 text-accent-blue flex-shrink-0" />;
        
        if (t.type === 'success') {
          borderColor = 'border-accent-green';
          icon = <CheckCircle className="w-5 h-5 text-accent-green flex-shrink-0" />;
        } else if (t.type === 'error') {
          borderColor = 'border-accent-red';
          icon = <XCircle className="w-5 h-5 text-accent-red flex-shrink-0" />;
        }
        
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-md border ${borderColor} ${bgStyle} shadow-lg transition-all duration-300 transform translate-y-0 opacity-100`}
            role="alert"
          >
            {icon}
            <div className="flex-1 text-sm font-medium text-text-primary">
              {t.message}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="text-text-muted hover:text-text-primary p-0.5 rounded transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastContainer;
