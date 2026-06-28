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
      info('Downloading PDF compliance report...');
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${baseUrl}/compliance/scans/${scanResult.scan_id}/export`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.setAttribute("download", `aiki_compliance_report_${scanResult.scan_id.slice(0, 8)}.pdf`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      window.URL.revokeObjectURL(url);
      success('Compliance PDF downloaded successfully!');
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
      {/* Unified Scan Panel Card */}
      {!scanResult && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-5 select-none shadow-sm">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-text-primary">
                Run automated regulatory scan
              </h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                Trigger a compliance scan using plant records to detect calibration delays, safety officer status, or missing training procedures.
              </p>
            </div>
            <span className="text-xs text-text-muted">Est. duration: ~40s</span>
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
                    className={`text-xs px-3.5 py-1.5 rounded-full border transition-all duration-150 active:scale-95 ${
                      isSelected
                        ? 'bg-accent-blue/15 border-accent-blue text-accent-blue font-semibold shadow-sm'
                        : 'border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-card'
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
              className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Scanning plant documents...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Initiate compliance audit
                </>
              )}
            </button>
          </div>

          {/* Audit Scanning Active Placeholder */}
          {isScanning && (
            <div className="pt-5 border-t border-surface-border text-center space-y-4 animate-pulse">
              <div className="flex justify-center">
                <ShieldAlert className="w-12 h-12 text-accent-amber animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-primary">Analyzing plant documentation</h3>
                <p className="text-xs text-text-secondary max-w-sm mx-auto">
                  Scanning vectors and running LLM checks on regulations for {selectedRegs.join(', ')}...
                </p>
              </div>
              <div className="w-48 bg-surface h-2 rounded-full overflow-hidden mx-auto border border-surface-border">
                <div className="bg-accent-amber h-full rounded-full" style={{ width: '45%' }} />
              </div>
            </div>
          )}

          {/* Past Scan History table (placeholder data) */}
          {!isScanning && (
            <div className="pt-5 border-t border-surface-border space-y-3">
              <h3 className="text-xs font-medium text-text-secondary">Past scan history</h3>
              <div className="border border-surface-border rounded-lg overflow-hidden bg-surface">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-surface-border text-text-muted font-mono text-[9px] uppercase bg-surface-card/50">
                      <th className="p-3 font-semibold">Scan Date</th>
                      <th className="p-3 font-semibold">Regulations</th>
                      <th className="p-3 font-semibold">Gaps Found</th>
                      <th className="p-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/50">
                    <tr className="hover:bg-surface-card/30">
                      <td className="p-3 font-medium text-text-primary">2026-06-25 14:32</td>
                      <td className="p-3 text-text-secondary">OISD-118, Factory Act</td>
                      <td className="p-3"><span className="inline-flex px-2 py-0.5 text-[9px] font-semibold border rounded badge-success bg-accent-green/10 text-accent-green border-accent-green/20">0 Gaps</span></td>
                      <td className="p-3 text-right text-accent-green font-semibold">Passed</td>
                    </tr>
                    <tr className="hover:bg-surface-card/30">
                      <td className="p-3 font-medium text-text-primary">2026-06-18 09:15</td>
                      <td className="p-3 text-text-secondary">PESO, ISO-9001</td>
                      <td className="p-3"><span className="inline-flex px-2 py-0.5 text-[9px] font-semibold border rounded badge-warning bg-accent-amber/10 text-accent-amber border-accent-amber/20">2 Gaps</span></td>
                      <td className="p-3 text-right text-accent-amber font-semibold">Gaps Found</td>
                    </tr>
                    <tr className="hover:bg-surface-card/30">
                      <td className="p-3 font-medium text-text-primary">2026-06-10 11:04</td>
                      <td className="p-3 text-text-secondary">OISD-118, PESO</td>
                      <td className="p-3"><span className="inline-flex px-2 py-0.5 text-[9px] font-semibold border rounded badge-danger bg-accent-red/10 text-accent-red border-accent-red/20">5 Gaps</span></td>
                      <td className="p-3 text-right text-accent-red font-semibold">Action Required</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scan results summary & details */}
      {scanResult && !isScanning && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total checked', value: scanResult.summary.total_requirements_checked, suffix: '', border: 'border-surface-border' },
              { label: 'Compliant', value: scanResult.summary.compliant, suffix: ' ✓', border: 'border-accent-green/30 text-accent-green' },
              { label: 'Gaps found', value: scanResult.summary.gaps_found, suffix: ' ⚠', border: 'border-accent-amber/30 text-accent-amber' },
              { label: 'Critical gaps', value: scanResult.summary.critical_gaps, suffix: ' ✗', border: 'border-accent-red/30 text-accent-red' },
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
                <span className="text-[10px] font-medium text-text-muted">
                  Rules checked
                </span>
              </div>
            </div>

            {/* Legend & Details */}
            <div className="flex-1 space-y-3 select-none">
              <h3 className="text-xs font-medium text-text-secondary">Audit score breakdowns</h3>
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
                <h3 className="text-base font-semibold text-text-primary">Compliance gaps found</h3>
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
                Export evidence package
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
                            <span className="text-[11px] font-medium text-text-secondary block">Requirement definition</span>
                            <p className="text-xs text-text-secondary leading-relaxed pl-2 border-l-2 border-surface-border">
                              {gap.requirement}
                            </p>
                          </div>

                          {/* Audit Finding */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-medium text-text-secondary block">Audit finding</span>
                            <p className="text-sm text-text-primary leading-relaxed font-medium">
                              {gap.finding}
                            </p>
                          </div>

                          {/* Recommended Action */}
                          <div className="bg-accent-amber/5 border border-accent-amber/20 rounded-md p-3 space-y-1.5 flex items-start gap-2.5">
                            <Wrench className="w-4.5 h-4.5 text-accent-amber flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[11px] font-medium text-accent-amber block">Recommended remediation action</span>
                              <p className="text-xs text-text-primary leading-normal mt-0.5 font-medium">
                                {gap.recommended_action}
                              </p>
                            </div>
                          </div>

                          {/* Evidence Documents */}
                          {gap.evidence_documents && gap.evidence_documents.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-medium text-text-secondary block">Analyzed evidence documents</span>
                              <div className="flex flex-wrap gap-2">
                                {gap.evidence_documents.map((doc, dIdx) => (
                                  <div key={dIdx} className="flex items-center gap-1.5 bg-surface border border-surface-border px-2.5 py-1 rounded-lg text-xs font-mono text-text-primary select-none hover:bg-surface-card transition-colors">
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

      {/* MOBILE EXPORT STICKY BOTTOM BUTTON */}
      {scanResult && !isScanning && (
        <div className="lg:hidden fixed bottom-[64px] left-0 right-0 p-3 bg-surface-sidebar border-t border-surface-border z-40 flex select-none">
          <button
            onClick={handleExportResults}
            className="w-full flex items-center justify-center gap-2 bg-accent-blue hover:bg-accent-blue/90 text-white text-sm font-semibold py-2 px-4 rounded shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export evidence package
          </button>
        </div>
      )}
    </div>
  );
}

export default Compliance;
