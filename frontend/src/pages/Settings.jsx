import React, { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { healthCheck } from '../api/client';
import { 
  Settings as SettingsIcon, Shield, Server, RefreshCw, Layout as LayoutIcon, User, Globe
} from 'lucide-react';
import { useToast } from '../hooks/useToast';

export function Settings() {
  const { success, error: toastError } = useToast();
  const { theme, setTheme, themes } = useTheme();

  // User details state
  const [user, setUser] = useState(null);
  useEffect(() => {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch (e) {
        setUser(null);
      }
    }
  }, []);

  // Plant selector logic
  const [selectedPlantId, setSelectedPlantId] = useState(
    localStorage.getItem('plantId') || 'p1-ohio-1111-1111-111111111111'
  );
  
  const plants = [
    { plant_id: 'p1-ohio-1111-1111-111111111111', name: 'Plant Alpha', location: 'Ohio' },
    { plant_id: 'p2-texas-2222-2222-222222222222', name: 'Plant Beta', location: 'Texas' }
  ];

  const handlePlantChange = (val) => {
    setSelectedPlantId(val);
    localStorage.setItem('plantId', val);
    success(`Facility switched to: ${val === 'all' ? 'Cross-Plant' : val.split('-')[1].toUpperCase()}`);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  // Diagnostic API health check
  const [apiStatus, setApiStatus] = useState('unknown');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [apiVersion, setApiVersion] = useState(null);

  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    setApiStatus('testing');
    try {
      const res = await healthCheck();
      if (res && res.status === 'ok') {
        setApiStatus('connected');
        setApiVersion(res.version || 'v2.0.0');
        success('REST API diagnostic test passed.');
      } else {
        setApiStatus('malfunction');
      }
    } catch (err) {
      setApiStatus('failed');
      toastError('REST API server connection failed.');
    } finally {
      setIsDiagnosing(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* Header */}
      <div className="border-b border-surface-border pb-5">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-accent-blue" />
          System Preferences
        </h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Configure interface options, facility profiles, and inspect API telemetry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* FACILITY PROFILE CARD */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2 font-mono">
            <Globe className="w-4 h-4 text-accent-blue" />
            Active Profile
          </h3>
          <p className="text-xs text-text-secondary leading-normal">
            Switching active facility profiles changes the contextual filters for compliance documents and risk heatmaps.
          </p>
          
          <div className="space-y-2.5">
            {plants.map((p) => (
              <label 
                key={p.plant_id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedPlantId === p.plant_id 
                    ? 'bg-accent-blue/5 border-accent-blue text-text-primary font-semibold'
                    : 'border-surface-border bg-surface hover:bg-surface/50 text-text-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input 
                    type="radio" 
                    name="plant-profile"
                    checked={selectedPlantId === p.plant_id}
                    onChange={() => handlePlantChange(p.plant_id)}
                    className="accent-accent-blue cursor-pointer h-3.5 w-3.5"
                  />
                  <div className="text-xs">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">{p.location} Operation</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-text-muted">{p.plant_id.slice(0, 7)}...</span>
              </label>
            ))}

            {user && user.role === 'admin' && (
              <label 
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedPlantId === 'all' 
                    ? 'bg-accent-purple/5 border-accent-purple text-text-primary font-semibold'
                    : 'border-surface-border bg-surface hover:bg-surface/50 text-text-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input 
                    type="radio" 
                    name="plant-profile"
                    checked={selectedPlantId === 'all'}
                    onChange={() => handlePlantChange('all')}
                    className="accent-accent-purple cursor-pointer h-3.5 w-3.5"
                  />
                  <div className="text-xs">
                    <div className="font-bold">All Facilities</div>
                    <div className="text-[10px] text-text-muted mt-0.5">Cross-Plant Global Scope</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-accent-purple bg-accent-purple/10 px-1.5 py-0.2 rounded font-bold uppercase select-none">
                  ADMIN ONLY
                </span>
              </label>
            )}
          </div>
        </div>

        {/* UI VISUAL THEME CARD */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2 font-mono">
            <LayoutIcon className="w-4 h-4 text-accent-blue" />
            Visual Customization
          </h3>
          <p className="text-xs text-text-secondary leading-normal">
            Choose a visual appearance theme. Theme adjustments persist automatically.
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            {themes.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`p-3.5 border rounded-lg text-center transition-all capitalize select-none text-xs font-semibold flex flex-col items-center justify-center gap-2 ${
                  theme === t 
                    ? 'bg-accent-blue/10 border-accent-blue text-text-primary shadow-sm'
                    : 'border-surface-border bg-surface hover:bg-surface/75 text-text-secondary'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border ${
                  t === 'dark' ? 'bg-[#181816]' : t === 'light' ? 'bg-[#fcfbf9]' : 'bg-[#000000]'
                }`} />
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ACCOUNT INFORMATION CARD */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2 font-mono">
            <User className="w-4 h-4 text-accent-blue" />
            Security & Authentication
          </h3>
          
          <div className="bg-surface border border-surface-border rounded-lg p-4 space-y-3.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Authorized User:</span>
              <span className="font-semibold text-text-primary font-mono select-text">{user?.email || 'N/A'}</span>
            </div>
            <div className="h-px bg-surface-border" />
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Role Classification:</span>
              <span className="inline-block text-[10px] font-mono font-bold text-accent-purple bg-accent-purple/10 border border-accent-purple/20 px-2.5 py-0.5 rounded uppercase select-none">
                {user?.role || 'Guest'}
              </span>
            </div>
            <div className="h-px bg-surface-border" />
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Session Auth Token:</span>
              <span className="font-mono text-text-muted text-[10px]">
                {localStorage.getItem('token') ? 'Active (JWT payload present)' : 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* API TELEMETRY DIAGNOSTICS CARD */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-surface-border pb-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2 font-mono">
              <Server className="w-4 h-4 text-accent-blue" />
              API Diagnostics
            </h3>
            <button
              onClick={runDiagnostics}
              disabled={isDiagnosing}
              className="text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-surface border border-surface-border rounded-lg p-4 space-y-3 text-xs select-text">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary select-none">Endpoint Host:</span>
              <span className="font-mono text-text-primary text-[10px]">
                {import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}
              </span>
            </div>
            <div className="h-px bg-surface-border/50" />
            <div className="flex justify-between items-center">
              <span className="text-text-secondary select-none">Connectivity Status:</span>
              <span className={`inline-flex items-center gap-1.5 font-bold font-mono text-[10px] select-none ${
                apiStatus === 'connected' ? 'text-accent-green' : apiStatus === 'testing' ? 'text-accent-amber animate-pulse' : 'text-accent-red'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  apiStatus === 'connected' ? 'bg-accent-green' : apiStatus === 'testing' ? 'bg-accent-amber animate-pulse' : 'bg-accent-red'
                }`} />
                {apiStatus.toUpperCase()}
              </span>
            </div>
            {apiVersion && (
              <>
                <div className="h-px bg-surface-border/50" />
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary select-none">Remote Server Version:</span>
                  <span className="font-mono text-text-primary text-[10px]">{apiVersion}</span>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Settings;
