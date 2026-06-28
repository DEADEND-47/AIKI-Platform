import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Calendar, FileText, RefreshCw } from 'lucide-react';
import { getEquipmentTimeline } from '../api/client';

export function EquipmentTimelineModal({ tag, onClose }) {
  const activePlantId = localStorage.getItem('plantId') || 'p1-ohio-1111-1111-111111111111';

  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['equipmentTimeline', tag, activePlantId],
    queryFn: () => getEquipmentTimeline(tag, { plant_id: activePlantId }),
    enabled: !!tag,
  });

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 select-none">
      <div className="bg-surface-card border border-surface-border rounded-lg shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col justify-between overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-surface-border p-4">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase font-mono tracking-widest text-text-muted font-bold block">
              Asset Lifecycle Timeline
            </span>
            <h3 className="text-base font-bold font-mono text-accent-blue">
              {tag}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text-primary rounded hover:bg-surface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center gap-2 text-xs text-text-muted italic">
              <RefreshCw className="w-6 h-6 animate-spin text-accent-blue" />
              Reconstructing asset timeline...
            </div>
          ) : timeline.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted italic">
              No historical work orders or inspections recorded for this asset.
            </div>
          ) : (
            <div className="relative border-l border-surface-border ml-2 pl-6 space-y-6 select-text">
              {timeline.map((item, idx) => {
                const isProcedure = item.doc_type.includes('procedure') || item.doc_type.includes('instruction');
                const isWorkOrder = item.doc_type.includes('record');
                const dotColor = isProcedure ? 'bg-accent-blue border-accent-blue/40' : isWorkOrder ? 'bg-accent-green border-accent-green/40' : 'bg-accent-purple border-accent-purple/40';
                
                return (
                  <div key={idx} className="relative group">
                    {/* Timeline Node Dot */}
                    <span className={`absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border-4 ${dotColor}`} />
                    
                    {/* Card */}
                    <div className="bg-surface border border-surface-border rounded-md p-3.5 space-y-2 hover:border-text-muted transition-colors">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-text-muted flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(item.upload_timestamp)}
                        </span>
                        <span className="bg-surface border border-surface-border px-1.5 py-0.2 rounded font-mono capitalize text-text-secondary">
                          {item.doc_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-text-primary leading-relaxed pl-1.5 border-l-2 border-accent-blue/30 italic">
                        "{item.context}"
                      </p>
                      <div className="flex items-center gap-1.5 text-[9px] text-text-muted select-none">
                        <FileText className="w-3.5 h-3.5 text-text-muted" />
                        Source: <span className="font-mono text-text-secondary">{item.filename} (Page {item.page})</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-surface-border p-4 text-center">
          <button 
            onClick={onClose}
            className="bg-surface-card hover:bg-surface text-text-primary font-semibold text-xs py-2 px-6 rounded border border-surface-border transition-colors w-full"
          >
            Close Timeline
          </button>
        </div>

      </div>
    </div>
  );
}

export default EquipmentTimelineModal;
