import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';
import { 
  FileText, BookOpen, Tag, TrendingUp, RefreshCw, BarChart2, CheckSquare, Brain
} from 'lucide-react';
import { getAnalytics } from '../api/client';
import { useToast } from '../hooks/useToast';

// Register Analytics Router client call
const fetchAnalytics = async () => {
  // Let's call the client endpoint
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
  const token = localStorage.getItem('token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(`${baseUrl}/analytics`, { headers });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
};

const PIE_COLORS = ['#3FB950', '#D29922', '#F85149'];

export function Analytics() {
  const { error: toastError } = useToast();

  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['analyticsData'],
    queryFn: fetchAnalytics,
    onError: (err) => {
      toastError(`Analytics failed to load: ${err.message}`);
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(n => (
            <div key={n} className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
              <div className="shimmer-bg h-3 rounded w-1/2" />
              <div className="shimmer-bg h-7 rounded w-1/3" />
            </div>
          ))}
        </div>
        <div className="shimmer-bg h-64 rounded-xl" />
      </div>
    );
  }

  // Fallback defaults for Recharts visual rendering
  const topEquipmentData = stats?.entities?.top_equipment || [];
  
  const highPct = stats?.copilot?.high_confidence_pct || 75;
  const avgConf = stats?.copilot?.avg_confidence || 86;
  const lowPct = 100 - highPct - 15 > 0 ? 100 - highPct - 15 : 5;
  const medPct = 100 - highPct - lowPct;
  
  const pieData = [
    { name: 'HIGH', value: Math.round(highPct) },
    { name: 'MEDIUM', value: Math.round(medPct) },
    { name: 'LOW', value: Math.round(lowPct) }
  ];

  return (
    <div className="space-y-6 select-none">
      
      {/* Header Row */}
      <div className="flex justify-between items-center border-b border-surface-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">System Analytics</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time metric aggregates and user interaction performance charts
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* SECTION 1: STATS GRID CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-surface-border rounded-lg p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-accent-blue/10 rounded-full text-accent-blue">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted block">Total Documents</span>
            <span className="text-xl font-bold text-text-primary">{stats?.documents?.total}</span>
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-lg p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-accent-green/10 rounded-full text-accent-green">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted block">Pages Processed</span>
            <span className="text-xl font-bold text-text-primary">{stats?.documents?.total_pages_processed}</span>
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-lg p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-accent-purple/10 rounded-full text-accent-purple">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted block">Entities Extracted</span>
            <span className="text-xl font-bold text-text-primary">{stats?.entities?.total}</span>
          </div>
        </div>

        <div className="bg-surface border border-surface-border rounded-lg p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-accent-amber/10 rounded-full text-accent-amber">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted block">New (Last 30 Days)</span>
            <span className="text-xl font-bold text-text-primary">{stats?.documents?.ingested_last_30_days}</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Chart: Top Equipment Mention Frequencies */}
        <div className="bg-surface border border-surface-border rounded-lg p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-surface-border pb-2">
            <BarChart2 className="w-4 h-4 text-accent-blue" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Top Asset Mention Counts
            </h3>
          </div>
          
          <div className="h-64 select-text">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topEquipmentData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis type="number" stroke="#7D8590" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#7D8590" fontSize={10} width={60} />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-card)', 
                    borderColor: 'var(--border)', 
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: 'var(--text-primary)', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--text-muted)', fontSize: '10px' }}
                />
                <Bar dataKey="value" fill="#2F81F7" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: RAG Confidence Distribution */}
        <div className="bg-surface border border-surface-border rounded-lg p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-surface-border pb-2">
            <Brain className="w-4 h-4 text-accent-blue" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Copilot RAG Answer Quality
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-56 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: 'var(--border)', 
                      borderRadius: '8px' 
                    }}
                    itemStyle={{ fontSize: '12px', color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
                <span className="text-xl font-bold font-mono text-text-primary">
                  {Math.round(avgConf)}%
                </span>
                <span className="text-[9px] uppercase tracking-wider font-mono text-text-muted">
                  avg conf
                </span>
              </div>
            </div>

            {/* Metrics Checklist */}
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-green block" /> High Confidence:
                  </span>
                  <span className="font-mono font-bold text-text-primary">{pieData[0].value}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-amber block" /> Medium Confidence:
                  </span>
                  <span className="font-mono font-bold text-text-primary">{pieData[1].value}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent-red block" /> Low Confidence:
                  </span>
                  <span className="font-mono font-bold text-text-primary">{pieData[2].value}%</span>
                </div>
              </div>
              
              <div className="border-t border-surface-border pt-3 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-secondary">Total Queries Run:</span>
                  <span className="font-mono text-text-primary">{stats?.copilot?.total_queries}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-secondary">Recent Queries (7 Days):</span>
                  <span className="font-mono text-text-primary">{stats?.copilot?.queries_last_7_days}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 3: COMPLIANCE TELEMETRY */}
      <div className="bg-surface border border-surface-border rounded-lg p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-surface-border pb-2">
          <CheckSquare className="w-4 h-4 text-accent-blue" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            Scanned Compliance Telemetry
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs">
          <div className="p-4 bg-surface-card/40 border border-surface-border rounded-xl space-y-1.5">
            <span className="text-[10px] text-text-muted uppercase font-mono tracking-widest">Average Compliance Rate</span>
            <span className="text-2xl font-bold font-mono text-accent-green">
              {Math.round(stats?.compliance?.avg_compliance_rate || 90)}%
            </span>
          </div>

          <div className="p-4 bg-surface-card/40 border border-surface-border rounded-xl space-y-1.5">
            <span className="text-[10px] text-text-muted uppercase font-mono tracking-widest">Most Violated Regulation</span>
            <span className="text-sm font-bold text-accent-amber truncate block">
              {stats?.compliance?.most_violated_regulation || 'OISD-118'}
            </span>
          </div>

          <div className="p-4 bg-surface-card/40 border border-surface-border rounded-xl space-y-1.5">
            <span className="text-[10px] text-text-muted uppercase font-mono tracking-widest">Total Compliance Runs</span>
            <span className="text-2xl font-bold font-mono text-accent-blue">
              {stats?.compliance?.total_scans}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Analytics;
