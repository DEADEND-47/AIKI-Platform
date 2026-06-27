import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend 
} from 'recharts';
import { 
  ShieldAlert, CheckCircle, AlertTriangle, AlertCircle, Play, Download, ChevronDown, ChevronUp, Wrench, RefreshCw, FileText
} from 'lucide-react';
import { startScan, getScanResults, exportScan } from '../api/client';
import { useToast } from '../hooks/useToast';
import SkeletonTable from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';

const REGULATIONS = ['OISD-118', 'Factory Act', 'PESO', 'ISO-9001'];

const SEVERITY_COLORS = {
  critical: '#F85149',
  high: '#D29922',
  moderate: '#58A6FF',
};

function useAnimatedCount(target, duration = 1200) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (target === undefined || target === null) return;
    let start = 0;
    const end = parseInt(target, 10);
    if (isNaN(end) || start === end) {
      setCount(end || 0);
      return;
    }
    
    const startTime = performance.now();
    let animationFrameId;
    
    const updateCount = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const easeProgress = progress * (2 - progress);
      const current = Math.floor(start + easeProgress * (end - start));
      setCount(current);
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      } else {
        setCount(end);
      }
    };
    
    animationFrameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);
  
  return count;
}

function AnimatedCount({ target, suffix = "" }) {
  const count = useAnimatedCount(target);
  return <span>{count}{suffix}</span>;
}

export function Compliance() {
  const queryClient = useQueryClient();
  const { success, error: toastError, info } = useToast();
  
  // Selection States
  const [selectedRegs, setSelectedRegs] = useState(['OISD-118', 'Factory Act']);
  const [activeScanId, setActiveScanId] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedGaps, setExpandedGaps] = useState({});

  const pollIntervalRef = useRef(null);

  // Toggle regulation selection
  const toggleRegulation = (reg) => {
    if (selectedRegs.includes(reg)) {
      setSelectedRegs(selectedRegs.filter((r) => r !== reg));
    } else {
      setSelectedRegs([...selectedRegs, reg]);
    }
  };

  // Start Scan Mutation
  const scanMutation = useMutation({
    mutationFn: (payload) => startScan(payload),
    onSuccess: (data) => {
      success('Compliance scan triggered! Running audit checklist...');
      setActiveScanId(data.scan_id);
      setIsScanning(true);
      setScanResult(null);
    },
    onError: (err) => {
      toastError(`Scan initialization failed: ${err.message || 'Server error'}`);
    }
  });

  const handleRunScan = () => {
    if (selectedRegs.length === 0) return;
    scanMutation.mutate({
      regulations: selectedRegs
    });
  };

  // Scan Polling
  useEffect(() => {
    if (!activeScanId) return;

    const pollScan = async () => {
      try {
        const data = await getScanResults(activeScanId);
        
        if (data.status === 'completed') {
          success('Compliance scan complete!');
          setScanResult(data);
          setIsScanning(false);
          setActiveScanId(null);
          clearInterval(pollIntervalRef.current);
        } else if (data.status === 'failed') {
          toastError('Compliance scan pipeline failed.');
          setIsScanning(false);
          setActiveScanId(null);
          clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        console.error('Error polling scan status:', err);
      }
    };

    pollIntervalRef.current = setInterval(pollScan, 2000);
    return () => clearInterval(pollIntervalRef.current);
  }, [activeScanId]);

  // Export Results
  const handleExportResults = async () => {
    if (!scanResult) return;
    try {
      info('Generating audit package...');
      const data = await exportScan(scanResult.scan_id);
      
      // Trigger JSON Download
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data.package, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `aiki_compliance_report_${scanResult.scan_id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      success('Audit package downloaded!');
    } catch (err) {
      toastError(`Export failed: ${err.message || 'Error downloading file'}`);
    }
  };

  const toggleGapExpanded = (id) => {
    setExpandedGaps(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Recharts Chart Data mapping
  const getChartData = () => {
    if (!scanResult || !scanResult.summary) return [];
    
    return [
      { name: 'Compliant', value: scanResult.summary.compliant, color: '#3FB950' },
      { name: 'Gaps Found', value: scanResult.summary.gaps_found - scanResult.summary.critical_gaps, color: '#D29922' },
      { name: 'Critical Gaps', value: scanResult.summary.critical_gaps, color: '#F85149' }
    ].filter(item => item.value > 0);
  };

  const chartData = getChartData();
  const sortedGaps = scanResult?.gaps ? [...scanResult.gaps].sort((a, b) => {
    const priority = { critical: 3, high: 2, moderate: 1 };
    return (priority[b.severity] || 0) - (priority[a.severity] || 0);
  }) : [];

  return (
    <div className="space-y-6">
      {/* Scan Control Panel */}
      <div className="bg-surface-card border border-surface-border rounded-md p-5 space-y-4 select-none">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-text-primary">
            Run Automated Regulatory Scan
          </h2>
          <span className="text-xs text-text-muted">Est. Duration: ~40s</span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {REGULATIONS.map((reg) => {
              const isSelected = selectedRegs.includes(reg);
              return (
                <button
                  key={reg}
                  onClick={() => toggleRegulation(reg)}
                  disabled={isScanning}
                  className={`text-xs px-3.5 py-1.5 rounded-full border transition-all duration-150 ${
                    isSelected
                      ? 'bg-accent-blue/15 border-accent-blue text-accent-blue font-semibold shadow-sm'
                      : 'border-surface-border text-text-secondary hover:text-text-primary hover:bg-[#1C2128]'
                  }`}
                >
                  {reg}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunScan}
            disabled={selectedRegs.length === 0 || isScanning}
            className="flex items-center justify-center gap-2 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-[#21262D] disabled:text-text-muted text-white text-sm font-semibold py-2 px-4 rounded transition-colors"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning Plant Documents...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Initiate Compliance Audit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Audit Scanning Active Placeholder */}
      {isScanning && (
        <div className="bg-surface-card border border-surface-border rounded-md p-8 text-center space-y-4">
          <div className="flex justify-center">
            <ShieldAlert className="w-12 h-12 text-accent-amber animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-text-primary">Analyzing Plant Documentation</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Scanning vectors and running LLM checks on regulations for {selectedRegs.join(', ')}...
            </p>
          </div>
          <div className="w-48 bg-[#21262D] h-2 rounded-full overflow-hidden mx-auto">
            <div className="bg-accent-amber h-full rounded-full animate-[shimmer-anim_2s_infinite]" style={{ width: '40%' }} />
          </div>
        </div>
      )}

      {/* Scan results summary & details */}
      {scanResult && !isScanning && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Checked', value: scanResult.summary.total_requirements_checked, suffix: '', border: 'border-surface-border' },
              { label: 'Compliant', value: scanResult.summary.compliant, suffix: ' ✓', border: 'border-accent-green/30 text-accent-green' },
              { label: 'Gaps Found', value: scanResult.summary.gaps_found, suffix: ' ⚠', border: 'border-accent-amber/30 text-accent-amber' },
              { label: 'Critical Gaps', value: scanResult.summary.critical_gaps, suffix: ' ✗', border: 'border-accent-red/30 text-accent-red' },
            ].map((card, idx) => (
              <div key={idx} className={`bg-surface-card border rounded-md p-4 space-y-1.5 text-center ${card.border}`}>
                <div className="text-xs text-text-secondary select-none">{card.label}</div>
                <div className="text-2xl font-black tracking-tight">
                  <AnimatedCount target={card.value} suffix={card.suffix} />
                </div>
              </div>
            ))}
          </div>

          {/* Compliance Chart & Legend row */}
          <div className="flex flex-col md:flex-row gap-6 bg-surface-card border border-surface-border rounded-md p-5 items-center">
            
            {/* Pie Chart */}
            <div className="w-[180px] h-[180px] flex-shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none">
                <span className="text-2xl font-bold font-mono text-text-primary">
                  {scanResult.summary.total_requirements_checked}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-text-muted font-semibold">
                  Rules Checked
                </span>
              </div>
            </div>

            {/* Legend & Details */}
            <div className="flex-1 space-y-3 select-none">
              <h3 className="text-sm font-semibold text-text-primary">Audit Score Breakdowns</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { name: 'Compliant', count: scanResult.summary.compliant, pct: Math.round(scanResult.summary.compliant/scanResult.summary.total_requirements_checked * 100) || 0, color: 'bg-accent-green', border: 'border-accent-green' },
                  { name: 'Partial / Gaps', count: scanResult.summary.gaps_found - scanResult.summary.critical_gaps, pct: Math.round((scanResult.summary.gaps_found - scanResult.summary.critical_gaps)/scanResult.summary.total_requirements_checked * 100) || 0, color: 'bg-accent-amber', border: 'border-accent-amber' },
                  { name: 'Critical Failure', count: scanResult.summary.critical_gaps, pct: Math.round(scanResult.summary.critical_gaps/scanResult.summary.total_requirements_checked * 100) || 0, color: 'bg-accent-red', border: 'border-accent-red' },
                ].map((item, index) => (
                  <div key={index} className="p-3 bg-surface rounded border border-surface-border">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span className="text-xs font-semibold text-text-primary">{item.name}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-lg font-bold font-mono text-text-primary">{item.count}</span>
                      <span className="text-xs text-text-secondary">({item.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gap List Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-text-primary">Compliance Gaps Found</h3>
                <span className="px-2 py-0.5 bg-accent-red/10 text-accent-red border border-accent-red/20 rounded-full text-xs font-bold font-mono">
                  {scanResult.summary.gaps_found}
                </span>
              </div>
              
              {/* Desktop Export Button */}
              <button
                onClick={handleExportResults}
                className="hidden lg:flex items-center gap-2 text-xs border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 py-1.5 px-3 rounded font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export Evidence Package
              </button>
            </div>

            {/* List */}
            {sortedGaps.length === 0 ? (
              <div className="bg-surface-card border border-surface-border p-6 rounded-md text-center">
                <CheckCircle className="w-10 h-10 text-accent-green mx-auto mb-3" />
                <p className="text-sm font-semibold text-text-primary">All Checked Rules Compliant!</p>
                <p className="text-xs text-text-secondary mt-1">No regulatory gaps were detected in the analyzed files.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedGaps.map((gap) => {
                  const isExpanded = !!expandedGaps[gap.gap_id];
                  const sevColor = SEVERITY_COLORS[gap.severity] || SEVERITY_COLORS.moderate;
                  
                  return (
                    <div
                      key={gap.gap_id}
                      className="bg-surface-card border border-surface-border rounded-md overflow-hidden transition-all duration-150 hover:border-text-muted cursor-pointer"
                      onClick={() => toggleGapExpanded(gap.gap_id)}
                      style={{ borderLeft: `4px solid ${sevColor}` }}
                    >
                      {/* Top collapsed header */}
                      <div className="p-4 flex items-center justify-between select-none">
                        <div className="flex items-center gap-3">
                          <span 
                            className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider text-white"
                            style={{ backgroundColor: sevColor }}
                          >
                            {gap.severity}
                          </span>
                          <span className="text-xs font-bold text-accent-blue bg-accent-blue/5 border border-accent-blue/20 px-2 py-0.5 rounded font-mono">
                            {gap.regulation} {gap.clause}
                          </span>
                          <span className="text-sm font-medium text-text-primary truncate max-w-[280px] hidden sm:inline">
                            {gap.finding}
                          </span>
                        </div>
                        
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
                      </div>

                      {/* Expanded detail with smooth max-height transitions */}
                      <div
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${
                          isExpanded ? 'max-h-[800px] border-t border-surface-border opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-4 pb-4 pt-4 space-y-4 bg-surface select-text cursor-default">
                          {/* Requirement */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Requirement Definition</span>
                            <p className="text-xs text-text-secondary leading-relaxed pl-2 border-l border-[#30363D]">
                              {gap.requirement}
                            </p>
                          </div>

                          {/* Audit Finding */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Audit Finding</span>
                            <p className="text-sm text-text-primary leading-relaxed font-medium">
                              {gap.finding}
                            </p>
                          </div>

                          {/* Recommended Action */}
                          <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-md p-3 space-y-1.5 flex items-start gap-2.5">
                            <Wrench className="w-4.5 h-4.5 text-accent-amber flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-bold text-accent-amber uppercase tracking-wider block">Recommended Remediation Action</span>
                              <p className="text-xs text-text-primary leading-normal mt-0.5 font-medium">
                                {gap.recommended_action}
                              </p>
                            </div>
                          </div>

                          {/* Evidence Documents */}
                          {gap.evidence_documents && gap.evidence_documents.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Analyzed Evidence Documents</span>
                              <div className="flex flex-wrap gap-2">
                                {gap.evidence_documents.map((doc, dIdx) => (
                                  <div key={dIdx} className="flex items-center gap-1.5 bg-[#1C2128] border border-surface-border px-2.5 py-1 rounded text-xs font-mono text-text-primary select-none">
                                    <FileText className="w-3.5 h-3.5 text-accent-blue" />
                                    {doc.filename}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Default/Empty View */}
      {!scanResult && !isScanning && (
        <EmptyState 
          icon="shield" 
          title="Regulatory Compliance Dashboard" 
          subtitle="Trigger a compliance scan using plant records to detect calibration delays, safety officer status, or missing training procedures."
          action="Select regulation rules and click 'Initiate Compliance Audit' above to run the scan."
        />
      )}

      {/* MOBILE EXPORT STICKY BOTTOM BUTTON */}
      {scanResult && !isScanning && (
        <div className="lg:hidden fixed bottom-[64px] left-0 right-0 p-3 bg-surface-sidebar border-t border-surface-border z-40 flex select-none">
          <button
            onClick={handleExportResults}
            className="w-full flex items-center justify-center gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white text-sm font-semibold py-2 px-4 rounded shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Evidence Package
          </button>
        </div>
      )}
    </div>
  );
}

export default Compliance;
