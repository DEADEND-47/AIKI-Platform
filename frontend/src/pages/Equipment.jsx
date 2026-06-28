import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Lightbulb, AlertTriangle, ShieldAlert, CheckCircle, RefreshCw, BarChart2, Calendar, FileText, ArrowRight, Search
} from 'lucide-react';
import { getInsights, getEquipmentRiskScores } from '../api/client';
import { useToast } from '../hooks/useToast';
import EquipmentTimelineModal from '../components/EquipmentTimelineModal';

const SEVERITY_STYLES = {
  critical: { border: 'border-accent-red', text: 'text-accent-red', bg: 'bg-accent-red/5', badgeBg: 'bg-accent-red/10', icon: ShieldAlert },
  high:     { border: 'border-accent-amber', text: 'text-accent-amber', bg: 'bg-accent-amber/5', badgeBg: 'bg-accent-amber/10', icon: AlertTriangle },
  moderate: { border: 'border-accent-blue', text: 'text-accent-blue', bg: 'bg-accent-blue/5', badgeBg: 'bg-accent-blue/10', icon: Lightbulb },
  low:      { border: 'border-text-secondary', text: 'text-text-secondary', bg: 'bg-surface-card/20', badgeBg: 'bg-surface-card/50', icon: CheckCircle }
};

const RISK_LEVEL_COLORS = {
  critical: 'bg-accent-red',
  high:     'bg-accent-amber',
  moderate: 'bg-accent-blue',
  low:      'bg-accent-green'
};

const RISK_TEXT_COLORS = {
  critical: 'text-accent-red',
  high:     'text-accent-amber',
  moderate: 'text-accent-blue',
  low:      'text-accent-green'
};

export function Equipment() {
  const { success, error: toastError } = useToast();
  const activePlantId = localStorage.getItem('plantId') || 'p1-ohio-1111-1111-111111111111';
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTag, setSearchTag] = useState('');
  const [selectedTimelineTag, setSelectedTimelineTag] = useState(null);

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
      success('Re-analyzed equipment risk metrics.');
    } catch (e) {
      toastError('Failed to refresh equipment telemetry.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter risk scores based on search query
  const filteredRiskScores = riskScores.filter(card => 
    card.equipment_tag.toLowerCase().includes(searchTag.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-border pb-5">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Equipment & Risk Briefing</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Operational anomalies, compliance failures, and predictive lifecycle asset risk scores
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 bg-surface-card hover:bg-surface border border-surface-border text-text-primary text-xs font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Re-Analyze Risks
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT & CENTER PANEL: PROACTIVE ALERTS BRIEF */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-medium text-text-secondary flex items-center gap-1.5 select-none">
            <Lightbulb className="w-4 h-4 text-accent-blue" />
            Detected operational gaps
          </h3>

          {isLoadingInsights ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-28 bg-surface-card border border-surface-border rounded-lg animate-pulse" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            <div className="bg-surface-card border border-surface-border p-8 rounded-lg text-center text-xs text-text-muted italic">
              No anomalies or safety gaps detected in the active facility knowledge graph.
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((insight, idx) => {
                const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.low;
                const Icon = style.icon;
                
                return (
                  <div 
                    key={idx}
                    className={`bg-surface-card border-l-4 ${style.border} border-y border-r border-surface-border rounded-r-lg p-4 space-y-3 shadow-sm select-text`}
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
                      <div className="bg-surface border border-surface-border p-2.5 rounded text-[11px] space-y-1 select-none">
                        <span className="font-medium text-text-muted block text-[10px]">Unanswered queries:</span>
                        {insight.queries.map((q, qIdx) => (
                          <div key={qIdx} className="text-text-secondary font-mono italic">"{q}"</div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs bg-surface border border-surface-border/40 p-2.5 rounded text-accent-blue font-semibold mt-2 select-none">
                      <span className="flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Action Plan: {insight.action}
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
          <h3 className="text-xs font-medium text-text-secondary flex items-center gap-1.5 select-none">
            <BarChart2 className="w-4 h-4 text-accent-blue" />
            Asset failure risk
          </h3>

          <div className="bg-surface-card border border-surface-border rounded-lg p-5 space-y-4 shadow-sm">
            <div className="space-y-1.5 pb-3 border-b border-surface-border select-none">
              <span className="text-[11px] text-text-muted block font-medium">Asset filter</span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search equipment tag..."
                  value={searchTag}
                  onChange={(e) => setSearchTag(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-blue"
                />
                <Search className="w-3.5 h-3.5 text-text-secondary absolute right-2.5 top-2.5" />
              </div>
            </div>

            {isLoadingRisk ? (
              <div className="space-y-4 py-4 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-10 bg-surface rounded w-full" />
                ))}
              </div>
            ) : filteredRiskScores.length === 0 ? (
              <p className="text-xs text-text-muted italic text-center py-6 select-none">
                No matching equipment tags.
              </p>
            ) : (
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                {filteredRiskScores.map((scoreCard, idx) => {
                  const barColor = RISK_LEVEL_COLORS[scoreCard.risk_level] || 'bg-text-secondary';
                  const textColor = RISK_TEXT_COLORS[scoreCard.risk_level] || 'text-text-secondary';
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedTimelineTag(scoreCard.equipment_tag)}
                      className="space-y-1.5 select-text hover:bg-surface/30 p-2 rounded-md border border-transparent hover:border-surface-border transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono font-bold text-accent-blue group-hover:underline">
                          {scoreCard.equipment_tag}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-semibold ${textColor}`}>{scoreCard.risk_score}</span>
                          <span className={`text-[10px] font-medium capitalize ${textColor}`}>
                            ({scoreCard.risk_level})
                          </span>
                        </div>
                      </div>
                      
                      <div className="w-full bg-surface h-2 rounded-full overflow-hidden">
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
                              className="bg-surface border border-surface-border px-1.5 py-0.2 rounded font-mono text-[9px]"
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

      {/* Equipment Lifecycle Timeline Modal Overlay */}
      {selectedTimelineTag && (
        <EquipmentTimelineModal 
          tag={selectedTimelineTag} 
          onClose={() => setSelectedTimelineTag(null)} 
        />
      )}
    </div>
  );
}

export default Equipment;
