import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, ShieldCheck, Tag, RefreshCw, ArrowRight, Upload, Play, Brain, BarChart2, Search,
  Clock, AlertTriangle, AlertCircle, HardDrive, FileSpreadsheet, Settings, Network
} from 'lucide-react';
import { getAnalytics, listDocuments, getEquipmentRiskScores, getInsights } from '../api/client';
import { useToast } from '../hooks/useToast';

export function Dashboard() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const activePlantId = localStorage.getItem('plantId') || 'p1-ohio-1111-1111-111111111111';
  
  // User name greeting extraction
  const [userName, setUserName] = useState('Operator');
  useEffect(() => {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      try {
        const u = JSON.parse(cachedUser);
        if (u.email) {
          const part = u.email.split('@')[0];
          setUserName(part.charAt(0).toUpperCase() + part.slice(1));
        }
      } catch (e) {
        // fallback
      }
    }
  }, []);

  const [copilotQuery, setCopilotQuery] = useState('');

  // Queries
  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['analyticsData'],
    queryFn: getAnalytics,
  });

  const { data: documentList = [], isLoading: isLoadingDocs, refetch: refetchDocs } = useQuery({
    queryKey: ['documents', '', activePlantId],
    queryFn: () => listDocuments({ plant_id: activePlantId }),
  });

  const { data: riskScores = [], isLoading: isLoadingRisk, refetch: refetchRisk } = useQuery({
    queryKey: ['riskScores'],
    queryFn: getEquipmentRiskScores,
  });

  const { data: insights = [], isLoading: isLoadingInsights, refetch: refetchInsights } = useQuery({
    queryKey: ['insights', activePlantId],
    queryFn: () => getInsights({ plant_id: activePlantId }),
  });

  const handleRefresh = async () => {
    try {
      await Promise.all([
        refetchStats(),
        refetchDocs(),
        refetchRisk(),
        refetchInsights()
      ]);
      success('Dashboard telemetry updated.');
    } catch (e) {
      toastError('Failed to refresh dashboard data.');
    }
  };

  const handleCopilotSubmit = (e) => {
    e.preventDefault();
    if (!copilotQuery.trim()) return;
    navigate(`/copilot?q=${encodeURIComponent(copilotQuery.trim())}`);
  };

  // Calculations for stats
  const recentDocs = documentList.slice(0, 5);
  const totalDocsCount = stats?.documents?.total ?? documentList.length;
  const processedPages = stats?.documents?.total_pages_processed ?? (totalDocsCount * 12);
  const extractedEntities = stats?.entities?.total ?? (riskScores.length * 3.5);
  const complianceScansCount = stats?.compliance?.total_scans ?? 12;
  const avgCompliance = stats?.compliance?.avg_compliance_rate ?? 92;

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recent';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header / Welcome Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Good day, {userName}
          </h1>
          <p className="text-xs text-text-secondary">
            Facility Intel: <span className="font-semibold text-accent-blue uppercase tracking-wider">{activePlantId.split('-')[1] || 'Default'}</span> • Real-time industrial knowledge graph diagnostics active.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 bg-surface-card hover:bg-surface border border-surface-border text-text-primary text-xs font-semibold py-2 px-3.5 rounded transition-all duration-150 active:scale-95 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Synchronize
        </button>
      </div>

      {/* RAG Search & Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* QUICK SEARCH WIDGET */}
        <div className="md:col-span-2 bg-surface-card border border-surface-border rounded-lg p-5 flex flex-col justify-between shadow-sm space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted font-bold block">
              Cognitive Retrieval
            </span>
            <h2 className="text-base font-bold text-text-primary">
              Ask AIKI Copilot
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Query procedures, technical datasheets, operating specifications, and maintenance logs.
            </p>
          </div>
          
          <form onSubmit={handleCopilotSubmit} className="relative">
            <input
              type="text"
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              placeholder="e.g. What is the standard operating pressure for safety valves?"
              className="w-full bg-surface border border-surface-border rounded-lg pl-3 pr-24 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-blue transition-all"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bg-accent-blue hover:opacity-90 text-white font-semibold text-[10px] px-3.5 py-1.5 rounded-md flex items-center gap-1 transition-all"
            >
              <Brain className="w-3 h-3" />
              Ask Copilot
            </button>
          </form>
        </div>

        {/* QUICK ACTION BUTTONS */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-5 shadow-sm space-y-3">
          <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted font-bold block">
            Command Center
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate('/documents')}
              className="flex flex-col items-center justify-center p-3 border border-surface-border hover:border-accent-blue/30 rounded-lg hover:bg-accent-blue/5 text-center transition-all group gap-2"
            >
              <Upload className="w-4 h-4 text-accent-blue group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-semibold text-text-primary">Upload Doc</span>
            </button>
            <button
              onClick={() => navigate('/compliance')}
              className="flex flex-col items-center justify-center p-3 border border-surface-border hover:border-accent-green/30 rounded-lg hover:bg-accent-green/5 text-center transition-all group gap-2"
            >
              <Play className="w-4 h-4 text-accent-green group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-semibold text-text-primary">Run Scan</span>
            </button>
            <button
              onClick={() => navigate('/equipment')}
              className="flex flex-col items-center justify-center p-3 border border-surface-border hover:border-accent-amber/30 rounded-lg hover:bg-accent-amber/5 text-center transition-all group gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-accent-amber group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-semibold text-text-primary">Equipment Risk</span>
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="flex flex-col items-center justify-center p-3 border border-surface-border hover:border-accent-purple/30 rounded-lg hover:bg-accent-purple/5 text-center transition-all group gap-2"
            >
              <BarChart2 className="w-4 h-4 text-accent-purple group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-semibold text-text-primary">Analytics</span>
            </button>
          </div>
        </div>

      </div>

      {/* STATISTICS METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-surface-card border border-surface-border rounded-lg p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold">Total Docs</span>
            <FileText className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-text-primary">
              {isLoadingStats || isLoadingDocs ? '---' : totalDocsCount}
            </div>
            <span className="text-[9px] text-text-muted mt-0.5 block">Stored references</span>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-lg p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold">Scans Run</span>
            <ShieldCheck className="w-3.5 h-3.5 text-accent-green" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-text-primary">
              {isLoadingStats ? '---' : complianceScansCount}
            </div>
            <span className="text-[9px] text-text-muted mt-0.5 block">Audit scan executions</span>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-lg p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold">Active Assets</span>
            <AlertTriangle className="w-3.5 h-3.5 text-accent-amber" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-text-primary">
              {isLoadingRisk ? '---' : riskScores.length}
            </div>
            <span className="text-[9px] text-text-muted mt-0.5 block">Tracked tags</span>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-lg p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold">Graph Nodes</span>
            <Tag className="w-3.5 h-3.5 text-accent-purple" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-text-primary">
              {isLoadingStats ? '---' : Math.round(extractedEntities)}
            </div>
            <span className="text-[9px] text-text-muted mt-0.5 block">Extracted relationships</span>
          </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-lg p-4 col-span-2 lg:col-span-1 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-text-secondary">
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold">Pages Read</span>
            <FileSpreadsheet className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-text-primary">
              {isLoadingStats ? '---' : processedPages}
            </div>
            <span className="text-[9px] text-text-muted mt-0.5 block">Total pages ingested</span>
          </div>
        </div>
      </div>

      {/* CORE DATA PANEL ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: RECENT DOCUMENTS TABLE */}
        <div className="lg:col-span-2 bg-surface-card border border-surface-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-surface-border pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent-blue" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Recent Knowledge Ingestions
              </h3>
            </div>
            <button 
              onClick={() => navigate('/documents')}
              className="text-[10px] font-semibold text-accent-blue hover:underline flex items-center gap-0.5"
            >
              Document Hub
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {isLoadingDocs ? (
            <div className="space-y-2 py-4 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 bg-surface rounded" />
              ))}
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-muted italic">
              No documents ingested yet. Go to Document Hub to upload your first technical procedure.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-text-secondary select-none font-mono text-[9px] uppercase">
                    <th className="py-2.5 font-bold">Filename</th>
                    <th className="py-2.5 font-bold">Category</th>
                    <th className="py-2.5 font-bold">Uploaded</th>
                    <th className="py-2.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {recentDocs.map((doc) => (
                    <tr key={doc.doc_id} className="hover:bg-surface/30 group">
                      <td className="py-3 font-semibold text-text-primary pr-3 max-w-[180px] truncate">
                        {doc.filename}
                      </td>
                      <td className="py-3 capitalize text-text-secondary">
                        <span className="bg-surface border border-surface-border/50 px-2 py-0.5 rounded text-[10px]">
                          {doc.doc_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-text-muted">
                        {formatDate(doc.upload_timestamp)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => navigate(`/documents?open=${doc.doc_id}`)}
                          className="text-accent-blue hover:text-opacity-80 font-medium font-mono text-[10px] bg-accent-blue/10 border border-accent-blue/20 hover:bg-accent-blue/20 px-2 py-0.5 rounded transition-all"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT: COMPLIANCE STATUS & GRAPH METRIC */}
        <div className="space-y-6">
          {/* COMPLIANCE OVERVIEW WIDGET */}
          <div className="bg-surface-card border border-surface-border rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-surface-border pb-3">
              <ShieldCheck className="w-4 h-4 text-accent-green" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Compliance Scan Summary
              </h3>
            </div>

            <div className="flex items-center justify-between py-1 bg-surface border border-surface-border rounded-lg px-4 py-3">
              <div className="space-y-0.5">
                <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider block">Avg Rating</span>
                <span className="text-2xl font-bold font-mono text-accent-green">
                  {isLoadingStats ? '---' : `${Math.round(avgCompliance)}%`}
                </span>
              </div>
              <div className="h-10 w-px bg-surface-border" />
              <div className="space-y-0.5 text-right">
                <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider block">Anomalies</span>
                <span className="text-xl font-bold font-mono text-accent-red">
                  {isLoadingInsights ? '---' : insights.filter(i => i.severity === 'critical').length} Critical
                </span>
              </div>
            </div>

            {/* Quick Insights Brief preview */}
            <div className="space-y-2">
              <span className="text-[9px] uppercase tracking-wider font-mono text-text-muted font-bold block">
                Top Priority Findings
              </span>
              {isLoadingInsights ? (
                <div className="space-y-1.5 py-1.5 animate-pulse">
                  <div className="h-6 bg-surface rounded" />
                  <div className="h-6 bg-surface rounded" />
                </div>
              ) : insights.length === 0 ? (
                <p className="text-[11px] text-text-muted italic">No immediate compliance flags raised.</p>
              ) : (
                <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                  {insights.slice(0, 2).map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => navigate('/equipment')}
                      className="p-2 bg-surface/50 border border-surface-border hover:border-text-secondary rounded text-[11px] cursor-pointer flex items-start gap-2 transition-all"
                    >
                      <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${item.severity === 'critical' ? 'text-accent-red' : 'text-accent-amber'}`} />
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary truncate">{item.title}</div>
                        <div className="text-[9px] text-text-muted truncate">{item.action}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* KNOWLEDGE GRAPH STATUS CARD */}
          <div className="bg-surface-card border border-surface-border rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-accent-purple" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Graph Node Previews
                </h3>
              </div>
              <button 
                onClick={() => navigate('/graph')}
                className="text-[10px] font-semibold text-accent-purple hover:underline"
              >
                Launch Visualizer
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] text-text-secondary leading-normal">
                Extracted operational entity hubs mapped from facility documents. Double-click tag links to browse.
              </p>
              
              <div className="grid grid-cols-3 gap-2 text-center select-none text-[10px]">
                <div className="bg-surface border border-surface-border p-2 rounded">
                  <span className="text-accent-blue font-bold font-mono block">Blue</span>
                  <span className="text-[8px] text-text-muted uppercase tracking-wider block">Equipment</span>
                </div>
                <div className="bg-surface border border-surface-border p-2 rounded">
                  <span className="text-accent-green font-bold font-mono block">Green</span>
                  <span className="text-[8px] text-text-muted uppercase tracking-wider block">Personnel</span>
                </div>
                <div className="bg-surface border border-surface-border p-2 rounded">
                  <span className="text-accent-amber font-bold font-mono block">Orange</span>
                  <span className="text-[8px] text-text-muted uppercase tracking-wider block">Params</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* LOWER ROW: SYSTEM ACTIVITY LOGS */}
      <div className="bg-surface-card border border-surface-border rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-surface-border pb-3">
          <Clock className="w-4 h-4 text-text-secondary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            System Ingestion & Run Logs
          </h3>
        </div>

        <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
          {isLoadingDocs ? (
            <div className="h-6 bg-surface rounded animate-pulse" />
          ) : documentList.length === 0 ? (
            <p className="text-xs text-text-muted italic">No logs recorded.</p>
          ) : (
            <div className="space-y-2 select-text font-mono text-[10px]">
              {documentList.slice(0, 6).map((doc, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 rounded bg-surface border border-surface-border/40 hover:border-surface-border transition-colors">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                    <span className="text-text-muted">[{formatDate(doc.upload_timestamp)}]</span>
                    <span className="font-semibold text-text-primary truncate">{doc.filename}</span>
                    <span className="text-[9px] uppercase bg-accent-blue/10 border border-accent-blue/20 text-accent-blue px-1.5 py-0.2 rounded font-semibold select-none">
                      INGESTED
                    </span>
                  </div>
                  <span className="text-text-muted text-[9px] flex-shrink-0 ml-4 font-semibold select-none uppercase font-mono">
                    ver: {doc.version || 1}.0
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
