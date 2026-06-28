import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, ShieldCheck, Tag, RefreshCw, ArrowRight, Upload, Play, Brain, BarChart2, Search,
  Clock, AlertTriangle, AlertCircle, HardDrive, FileSpreadsheet, Settings, Network, Sparkles, Zap
} from 'lucide-react';
import { getAnalytics, listDocuments, getEquipmentRiskScores, getInsights } from '../api/client';
import { useToast } from '../hooks/useToast';
import AIBadge from '../components/AIBadge';
import { SkeletonStat, SkeletonCard } from '../components/SkeletonLoader';

export function Dashboard() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const activePlantId = localStorage.getItem('plantId') || 'p1-ohio-1111-1111-111111111111';
  
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
      } catch (e) { /* noop */ }
    }
  }, []);

  const [copilotQuery, setCopilotQuery] = useState('');

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
      await Promise.all([refetchStats(), refetchDocs(), refetchRisk(), refetchInsights()]);
      success('Dashboard telemetry updated.');
    } catch {
      toastError('Failed to refresh dashboard data.');
    }
  };

  const handleCopilotSubmit = (e) => {
    e.preventDefault();
    if (!copilotQuery.trim()) return;
    navigate(`/copilot?q=${encodeURIComponent(copilotQuery.trim())}`);
  };

  const recentDocs = documentList.slice(0, 5);
  const totalDocsCount = stats?.documents?.total ?? documentList.length;
  const processedPages = stats?.documents?.total_pages_processed ?? (totalDocsCount * 12);
  const extractedEntities = stats?.entities?.total ?? (riskScores.length * 3.5);
  const complianceScansCount = stats?.compliance?.total_scans ?? 12;
  const avgCompliance = stats?.compliance?.avg_compliance_rate ?? 92;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recent';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  const statCards = [
    {
      label: 'Total Docs',
      value: isLoadingStats || isLoadingDocs ? null : totalDocsCount,
      sub: 'Stored references',
      icon: FileText,
      color: 'text-accent-blue',
      bg: 'bg-accent-blue/8',
    },
    {
      label: 'Scans Run',
      value: isLoadingStats ? null : complianceScansCount,
      sub: 'Audit executions',
      icon: ShieldCheck,
      color: 'text-accent-green',
      bg: 'bg-accent-green/8',
    },
    {
      label: 'Active Assets',
      value: isLoadingRisk ? null : riskScores.length,
      sub: 'Tracked tags',
      icon: AlertTriangle,
      color: 'text-accent-amber',
      bg: 'bg-accent-amber/8',
    },
    {
      label: 'Graph Nodes',
      value: isLoadingStats ? null : Math.round(extractedEntities),
      sub: 'Relationships',
      icon: Tag,
      color: 'text-accent-purple',
      bg: 'bg-accent-purple/8',
    },
    {
      label: 'Pages Read',
      value: isLoadingStats ? null : processedPages,
      sub: 'Total ingested',
      icon: FileSpreadsheet,
      color: 'text-accent-blue',
      bg: 'bg-accent-blue/8',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-border pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Good day, {userName} 👋
          </h1>
          <p className="text-xs text-text-secondary flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 font-semibold text-accent-blue uppercase tracking-wider text-[10px]">
              <Zap className="w-3 h-3" />
              {activePlantId.split('-')[1] || 'Default'}
            </span>
            <span className="text-text-muted">·</span>
            <span>Real-time industrial knowledge graph diagnostics active.</span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn-ghost text-xs flex items-center gap-1.5 active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Synchronize
        </button>
      </div>

      {/* ── RAG Search + Quick Actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Copilot search widget */}
        <div className="md:col-span-2 card flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="section-label block">Cognitive Retrieval</span>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Ask AIKI Copilot
                <AIBadge label="RAG" />
              </h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                Query procedures, datasheets, operating specs, and maintenance logs.
              </p>
            </div>
            <Brain className="w-5 h-5 text-accent-purple flex-shrink-0 opacity-60" />
          </div>

          <form onSubmit={handleCopilotSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              placeholder="e.g. What is the standard operating pressure for safety valves?"
              className="w-full bg-surface border border-surface-border rounded-lg pl-9 pr-28 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/20 transition-all"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 btn-primary text-[10px] px-3 py-1.5 rounded-md gap-1 active:scale-95"
            >
              <Brain className="w-3 h-3" />
              Ask AI
            </button>
          </form>

          {/* AI quick-prompts */}
          <div className="flex flex-wrap gap-1.5">
            {[
              'Safety valve pressure ratings',
              'Maintenance overdue equipment',
              'OISD-118 compliance gaps',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setCopilotQuery(prompt)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-surface-border bg-surface hover:bg-surface-card hover:border-accent-blue/30 text-text-secondary hover:text-text-primary transition-all duration-150"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card space-y-3">
          <span className="section-label block">Command Center</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Upload Doc',    path: '/documents',  icon: Upload,       color: 'accent-blue' },
              { label: 'Run Scan',      path: '/compliance', icon: Play,         color: 'accent-green' },
              { label: 'Equipment Risk',path: '/equipment',  icon: AlertTriangle,color: 'accent-amber' },
              { label: 'Analytics',     path: '/analytics',  icon: BarChart2,    color: 'accent-purple' },
            ].map(({ label, path, icon: Icon, color }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center justify-center p-3 border border-surface-border hover:border-${color}/30 rounded-xl hover:bg-${color}/5 text-center transition-all duration-150 group gap-2 active:scale-95`}
              >
                <Icon className={`w-4 h-4 text-${color} group-hover:scale-110 transition-transform duration-150`} />
                <span className="text-[10px] font-semibold text-text-primary">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Statistics Metric Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          if (card.value === null) return <SkeletonStat key={card.label} />;
          return (
            <div key={card.label} className="card-sm flex flex-col justify-between hover-lift">
              <div className="flex items-center justify-between">
                <span className="section-label">{card.label}</span>
                <div className={`p-1.5 ${card.bg} rounded-lg`}>
                  <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-text-primary">
                  {card.value.toLocaleString()}
                </div>
                <span className="text-[9px] text-text-muted mt-0.5 block">{card.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Core Data Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Documents Table */}
        <div className="lg:col-span-2 card space-y-4">
          <div className="flex justify-between items-center border-b border-surface-border pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-accent-blue/10 rounded-lg border border-accent-blue/20">
                <FileText className="w-3.5 h-3.5 text-accent-blue" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Recent Ingestions
              </h3>
              <AIBadge label="AI" />
            </div>
            <button
              onClick={() => navigate('/documents')}
              className="text-[10px] font-semibold text-accent-blue hover:underline flex items-center gap-0.5 transition-colors"
            >
              Document Hub
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {isLoadingDocs ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="shimmer-bg h-10 rounded-lg" />
              ))}
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-40" />
              <p className="text-xs text-text-muted italic">
                No documents ingested yet.{' '}
                <button onClick={() => navigate('/documents')} className="text-accent-blue hover:underline">
                  Upload your first document →
                </button>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-border text-text-muted font-mono text-[9px] uppercase">
                    <th className="py-2.5 font-semibold">Filename</th>
                    <th className="py-2.5 font-semibold">Category</th>
                    <th className="py-2.5 font-semibold">Indexed</th>
                    <th className="py-2.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {recentDocs.map((doc) => (
                    <tr key={doc.doc_id} className="table-row-hover group">
                      <td className="py-3 font-semibold text-text-primary pr-3 max-w-[180px] truncate" title={doc.filename}>
                        {doc.filename}
                      </td>
                      <td className="py-3">
                        <span className="badge-neutral capitalize text-[9px]">
                          {doc.doc_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-text-muted whitespace-nowrap">
                        {formatDate(doc.upload_timestamp)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => navigate(`/documents?open=${doc.doc_id}`)}
                          className="badge-info text-[9px] hover:opacity-80 transition-opacity active:scale-95"
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

        {/* Right column */}
        <div className="space-y-5">
          {/* Compliance Summary */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2 border-b border-surface-border pb-3">
              <div className="p-1.5 bg-accent-green/10 rounded-lg border border-accent-green/20">
                <ShieldCheck className="w-3.5 h-3.5 text-accent-green" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Compliance Summary
              </h3>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface border border-surface-border rounded-xl px-3 py-3 text-center">
                <span className="section-label block mb-1">Avg Rating</span>
                <span className={`text-xl font-bold font-mono ${
                  avgCompliance >= 90 ? 'text-accent-green' : avgCompliance >= 70 ? 'text-accent-amber' : 'text-accent-red'
                }`}>
                  {isLoadingStats ? '—' : `${Math.round(avgCompliance)}%`}
                </span>
              </div>
              <div className="bg-surface border border-surface-border rounded-xl px-3 py-3 text-center">
                <span className="section-label block mb-1">Critical</span>
                <span className="text-xl font-bold font-mono text-accent-red">
                  {isLoadingInsights ? '—' : insights.filter(i => i.severity === 'critical').length}
                </span>
              </div>
            </div>

            {/* Priority findings */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="section-label">Top Findings</span>
                <AIBadge label="AI" />
              </div>
              {isLoadingInsights ? (
                <div className="space-y-1.5">
                  <div className="shimmer-bg h-8 rounded-lg" />
                  <div className="shimmer-bg h-8 rounded-lg" />
                </div>
              ) : insights.length === 0 ? (
                <p className="text-[11px] text-text-muted italic">No compliance flags raised.</p>
              ) : (
                <div className="space-y-2">
                  {insights.slice(0, 2).map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => navigate('/equipment')}
                      className="p-2.5 bg-surface border border-surface-border hover:border-text-muted/40 rounded-xl text-[11px] cursor-pointer flex items-start gap-2 transition-all duration-150 group"
                    >
                      <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-transform duration-150 group-hover:scale-110 ${
                        item.severity === 'critical' ? 'text-accent-red' : 'text-accent-amber'
                      }`} />
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary truncate">{item.title}</div>
                        <div className="text-[9px] text-text-muted truncate mt-0.5">{item.action}</div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => navigate('/compliance')}
                    className="text-[10px] text-accent-blue hover:underline w-full text-right font-semibold"
                  >
                    View all scans →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Knowledge Graph card */}
          <div className="card space-y-4">
            <div className="flex justify-between items-center border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-accent-purple/10 rounded-lg border border-accent-purple/20">
                  <Network className="w-3.5 h-3.5 text-accent-purple" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Graph Nodes
                </h3>
              </div>
              <button
                onClick={() => navigate('/graph')}
                className="text-[10px] font-semibold text-accent-purple hover:underline transition-colors"
              >
                Visualize →
              </button>
            </div>

            <p className="text-[11px] text-text-secondary leading-relaxed">
              Operational entity hubs extracted from facility documents.
            </p>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              {[
                { color: 'text-accent-blue',   bg: 'bg-accent-blue/8',   label: 'Equipment' },
                { color: 'text-accent-green',  bg: 'bg-accent-green/8',  label: 'Personnel' },
                { color: 'text-accent-amber',  bg: 'bg-accent-amber/8',  label: 'Parameters' },
              ].map(({ color, bg, label }) => (
                <div key={label} className={`${bg} border border-surface-border p-2.5 rounded-xl`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${color.replace('text-', 'bg-')} mx-auto mb-1`} />
                  <span className="text-[9px] text-text-muted uppercase tracking-wider block">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Activity Log ── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 border-b border-surface-border pb-3">
          <div className="p-1.5 bg-surface rounded-lg border border-surface-border">
            <Clock className="w-3.5 h-3.5 text-text-secondary" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            System Activity Log
          </h3>
          <span className="ml-auto text-[9px] text-text-muted font-mono">
            Live feed
          </span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {isLoadingDocs ? (
            <div className="shimmer-bg h-8 rounded-lg" />
          ) : documentList.length === 0 ? (
            <p className="text-xs text-text-muted italic">No activity recorded.</p>
          ) : (
            <div className="space-y-1.5 font-mono text-[10px]">
              {documentList.slice(0, 8).map((doc, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-2.5 rounded-lg bg-surface border border-surface-border/50 hover:border-surface-border transition-all duration-150"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green flex-shrink-0" />
                    <span className="text-text-muted flex-shrink-0">[{formatDate(doc.upload_timestamp)}]</span>
                    <span className="font-semibold text-text-primary truncate">{doc.filename}</span>
                    <span className="badge-info text-[8px] flex-shrink-0 select-none">INGESTED</span>
                  </div>
                  <span className="text-text-muted text-[9px] flex-shrink-0 ml-3 select-none">
                    v{doc.version || 1}.0
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
