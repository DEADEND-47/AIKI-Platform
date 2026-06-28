import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Lightbulb, AlertTriangle, ShieldAlert, CheckCircle, RefreshCw, BarChart2, Calendar, FileText, ArrowRight
} from 'lucide-react';
import { getInsights, getEquipmentRiskScores } from '../api/client';
import { useToast } from '../hooks/useToast';

const SEVERITY_STYLES = {
  critical: { border: 'border-red-500', text: 'text-red-500', bg: 'bg-red-500/5', badgeBg: 'bg-red-500/10', icon: ShieldAlert },
  high:     { border: 'border-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/5', badgeBg: 'bg-amber-500/10', icon: AlertTriangle },
  moderate: { border: 'border-accent-blue', text: 'text-accent-blue', bg: 'bg-accent-blue/5', badgeBg: 'bg-accent-blue/10', icon: Lightbulb },
  low:      { border: 'border-text-secondary', text: 'text-text-secondary', bg: 'bg-[#21262D]/20', badgeBg: 'bg-[#21262D]/50', icon: CheckCircle }
};

const RISK_LEVEL_COLORS = {
  critical: 'bg-red-500',
  high:     'bg-amber-500',
  moderate: 'bg-accent-blue',
  low:      'bg-accent-green'
};

const RISK_TEXT_COLORS = {
  critical: 'text-red-500',
  high:     'text-amber-500',
  moderate: 'text-accent-blue',
  low:      'text-accent-green'
};

export function Insights() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const activePlantId = localStorage.getItem('plantId') || 'p1-ohio-1111-1111-111111111111';
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Query insights from backend
  const { data: insights = [], isLoading: isLoadingInsights, refetch: refetchInsights } = useQuery({
    queryKey: ['insights', activePlantId],
    queryFn: () => getInsights({ plant_id: activePlantId }),
  });

  // Query risk scores from backend
  const { data: riskScores = [], isLoading: isLoadingRisk, refetch: refetchRisk } = useQuery({
    queryKey: ['riskScores'],
    queryFn: () => getEquipmentRiskScores(),
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchInsights(), refetchRisk()]);
      success('Briefing data re-analyzed successfully.');
    } catch (e) {
      toastError('Failed to refresh insights.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header Row */}
      <div className="flex justify-between items-center border-b border-surface-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Daily Intelligence Briefing</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Proactive operational alerts, compliance anomalies, and lifecycle risk analytics
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 bg-[#21262D] hover:bg-[#30363D] text-text-primary text-xs font-semibold py-2 px-4 rounded border border-surface-border transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Re-Analyze
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT & CENTER PANEL: PROACTIVE ALERTS BRIEF */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-accent-blue" />
            Platform Detected Insights
          </h3>

          {isLoadingInsights ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-28 bg-surface border border-surface-border rounded-lg animate-pulse" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            <div className="bg-surface border border-surface-border p-8 rounded-lg text-center text-xs text-text-muted italic">
              All quiet. No anomalies or safety gaps detected in the ingested knowledge graph.
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((insight, idx) => {
                const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.low;
                const Icon = style.icon;
                
                return (
                  <div 
                    key={idx}
                    className={`bg-surface border-l-4 ${style.border} border-y border-r border-surface-border rounded-r-lg p-4 space-y-3 shadow-sm select-text`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className={`inline-flex px-2 py-0.5 text-[9px] font-mono font-bold rounded uppercase tracking-wider ${style.badgeBg} ${style.text}`}>
                          {insight.type.replace(/_/g, ' ')} • {insight.severity}
                        </span>
                        <h4 className="font-bold text-sm text-text-primary">{insight.title}</h4>
                      </div>
                      <Icon className={`w-5 h-5 ${style.text} flex-shrink-0`} />
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed">
                      {insight.detail}
                    </p>

                    {insight.queries && (
                      <div className="bg-[#1C2128] border border-surface-border p-2.5 rounded text-[11px] space-y-1 select-none">
                        <span className="font-bold text-text-muted block text-[9px] uppercase tracking-wider">Unanswered Queries:</span>
                        {insight.queries.map((q, qIdx) => (
                          <div key={qIdx} className="text-text-secondary font-mono italic">"{q}"</div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs bg-[#1C2128]/40 border border-surface-border/40 p-2.5 rounded text-accent-blue font-semibold mt-2 select-none">
                      <span className="flex items-center gap-1">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Recommended Action: {insight.action}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: EQUIPMENT RISK HEATMAP */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-accent-blue" />
            Asset Failure Risk Heatmap
          </h3>

          <div className="bg-surface border border-surface-border rounded-lg p-5 space-y-4 shadow-sm">
            <div className="space-y-1 pb-2 border-b border-surface-border">
              <span className="text-[10px] text-text-muted block font-mono uppercase tracking-wider">Predictive Modeling</span>
              <p className="text-xs text-text-secondary">
                Calculated failure hazard ratings based on maintenance logs, compliance checklists, and operating procedure updates.
              </p>
            </div>

            {isLoadingRisk ? (
              <div className="space-y-4 py-4 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-6 bg-[#30363D] rounded w-full" />
                ))}
              </div>
            ) : riskScores.length === 0 ? (
              <p className="text-xs text-text-muted italic text-center py-6">No equipment records available.</p>
            ) : (
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                {riskScores.map((scoreCard, idx) => {
                  const barColor = RISK_LEVEL_COLORS[scoreCard.risk_level] || 'bg-text-secondary';
                  const textColor = RISK_TEXT_COLORS[scoreCard.risk_level] || 'text-text-secondary';
                  
                  return (
                    <div key={idx} className="space-y-1.5 select-text">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono font-bold text-accent-blue">{scoreCard.equipment_tag}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-semibold ${textColor}`}>{scoreCard.risk_score}</span>
                          <span className={`text-[10px] uppercase font-bold tracking-wider capitalize ${textColor}`}>
                            ({scoreCard.risk_level})
                          </span>
                        </div>
                      </div>
                      
                      <div className="w-full bg-[#21262D] h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                          style={{ width: `${scoreCard.risk_score}%` }} 
                        />
                      </div>

                      {scoreCard.factors && scoreCard.factors.length > 0 && (
                        <div className="text-[10px] text-text-muted flex flex-wrap gap-1.5 pt-1 select-none">
                          {scoreCard.factors.map((f, fIdx) => (
                            <span 
                              key={fIdx} 
                              className="bg-[#21262D] border border-surface-border px-1.5 py-0.2 rounded font-mono text-[9px]"
                            >
                              • {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Insights;
