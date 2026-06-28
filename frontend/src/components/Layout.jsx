import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  FileText, Brain, ShieldAlert, Hexagon, Moon, LogOut, Search, 
  BarChart2, Sun, Settings, Home, Wrench, Menu, X 
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { semanticSearch } from '../api/client';

export function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  const token = localStorage.getItem('token');
  const isLoginPage = currentPath === '/login';

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Close mobile drawer when location changes
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [currentPath]);

  // Get user details
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
  }, [token]);

  // Plant selector logic
  const [selectedPlantId, setSelectedPlantId] = useState(
    localStorage.getItem('plantId') || 'p1-ohio-1111-1111-111111111111'
  );
  
  const plants = [
    { plant_id: 'p1-ohio-1111-1111-111111111111', name: 'Plant Alpha', location: 'Ohio' },
    { plant_id: 'p2-texas-2222-2222-222222222222', name: 'Plant Beta', location: 'Texas' }
  ];

  const handlePlantChange = (e) => {
    const val = e.target.value;
    setSelectedPlantId(val);
    localStorage.setItem('plantId', val);
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
    window.location.reload();
  };

  const { theme, setTheme, themes } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await semanticSearch(searchQuery);
        setSearchResults(res.results || []);
        setShowSearchResults(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Documents', path: '/documents', icon: FileText },
    { name: 'AI Copilot', path: '/copilot', icon: Brain },
    { name: 'Compliance', path: '/compliance', icon: ShieldAlert },
    { name: 'Knowledge Graph', path: '/graph', icon: Hexagon },
    { name: 'Equipment', path: '/equipment', icon: Wrench },
    { name: 'Analytics', path: '/analytics', icon: BarChart2 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  // Shield rendering if not logged in
  if (isLoginPage || !token) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        {children}
      </div>
    );
  }

  // Sidebar Content rendering function to keep code DRY
  const renderSidebarContent = (isMobileView = false) => {
    return (
      <div className="flex flex-col h-full justify-between select-none">
        <div className="space-y-4">
          {/* Logo & Close Button (for Mobile) */}
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-accent-blue/10 border border-accent-blue/30 rounded-md text-accent-blue">
                <Hexagon className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-text-primary">
                AIKI
              </span>
              <span className="text-[9px] uppercase tracking-widest text-text-muted mt-1 font-mono font-bold">
                Brain
              </span>
            </div>
            {isMobileView && (
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="lg:hidden p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface border border-surface-border rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Plant Selector Dropdown */}
          <div className="px-2 py-1">
            <label className="text-[9px] uppercase font-mono tracking-widest text-text-muted font-bold block mb-1">
              Active Facility
            </label>
            <select
              value={selectedPlantId}
              onChange={handlePlantChange}
              className="w-full bg-surface border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-blue transition-colors cursor-pointer"
            >
              {plants.map(p => (
                <option key={p.plant_id} value={p.plant_id}>
                  {p.name} ({p.location})
                </option>
              ))}
              {user && user.role === 'admin' && (
                <option value="all">All Facilities</option>
              )}
            </select>
          </div>

          {/* Global Semantic Search Input */}
          <div className="px-2 py-1 relative">
            <label className="text-[9px] uppercase font-mono tracking-widest text-[#7D8590] font-bold block mb-1">
              Global RAG Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tag or spec..."
                className="w-full bg-surface border border-surface-border rounded-md pl-8 pr-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-blue transition-all"
              />
              <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-2.5" />
              {isSearching && (
                <span className="absolute right-2.5 top-2.5 w-3 h-3 rounded-full border-t border-accent-blue animate-spin" />
              )}
            </div>
            
            {/* Search Results Dropdown Overlay */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute left-2 right-2 mt-1 bg-surface-card border border-surface-border rounded-md shadow-2xl z-50 max-h-56 overflow-y-auto p-1.5 space-y-1 select-text text-left">
                {searchResults.map((r) => (
                  <div
                    key={r.doc_id}
                    onClick={() => {
                      setShowSearchResults(false);
                      setSearchQuery('');
                      setIsDrawerOpen(false);
                      navigate(`/documents?open=${r.doc_id}`);
                    }}
                    className="p-2 rounded hover:bg-surface cursor-pointer border border-transparent hover:border-surface-border/50 transition-all text-[11px] space-y-1"
                  >
                    <div className="font-mono font-bold text-accent-blue truncate">{r.filename}</div>
                    <div className="text-[10px] text-text-muted font-semibold capitalize">{r.doc_type.replace('_', ' ')}</div>
                    <p className="text-[10px] text-text-secondary line-clamp-2 italic leading-normal">
                      "{r.excerpt.replace(/\*\*/g, '')}"
                    </p>
                  </div>
                ))}
              </div>
            )}
            
            {showSearchResults && searchResults.length === 0 && (
              <div className="absolute left-2 right-2 mt-1 bg-surface-card border border-surface-border rounded-md shadow-2xl z-50 p-3 text-[11px] text-[#7D8590] italic">
                No matching excerpts found.
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-150 border-l-2 ${
                    isActive
                      ? 'border-accent-blue bg-surface-card text-accent-blue font-bold shadow-sm'
                      : 'border-transparent text-text-secondary hover:bg-surface-card/50 hover:text-text-primary'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Panel */}
        <div className="border-t border-surface-border pt-4 space-y-3">
          {user && (
            <div className="px-2 py-1 flex items-center justify-between border-b border-surface-border/50 pb-3 mb-1">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-mono tracking-wider text-text-muted font-bold block">
                  Signed in as
                </span>
                <span className="text-xs text-text-primary font-medium block truncate max-w-[120px]">
                  {user.email.split('@')[0]}
                </span>
                <span className="inline-block text-[8px] font-mono font-bold text-accent-purple bg-accent-purple/10 border border-accent-purple/20 px-1 py-0.2 rounded uppercase mt-0.5">
                  {user.role}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                title="Log out"
                className="text-text-muted hover:text-accent-red border border-surface-border hover:bg-accent-red/10 p-1.5 rounded transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between px-2 text-xs text-text-muted">
            <span className="flex items-center gap-1.5 font-semibold">
              {theme === 'light' ? (
                <Sun className="w-3.5 h-3.5 text-accent-amber" />
              ) : theme === 'industrial' ? (
                <Settings className="w-3.5 h-3.5 text-accent-amber animate-spin" style={{ animationDuration: '4s' }} />
              ) : (
                <Moon className="w-3.5 h-3.5 text-accent-blue" />
              )}
              Theme:
            </span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-surface border border-surface-border rounded px-1.5 py-0.5 text-[10px] text-text-primary focus:outline-none cursor-pointer capitalize font-mono"
            >
              {themes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between px-2 text-[10px] font-mono text-text-muted">
            <span>AIKI Platform</span>
            <span>v2.0.0</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row text-text-primary transition-colors duration-250">
      
      {/* DESKTOP SIDEBAR (>= 1024px) */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[240px] bg-sidebar border-r border-surface-border z-30 p-4">
        {renderSidebarContent(false)}
      </aside>

      {/* MOBILE HEADER (< 1024px) */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-sidebar border-b border-surface-border sticky top-0 z-40 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 text-text-secondary hover:text-text-primary border border-surface-border rounded hover:bg-surface-card transition-colors focus:outline-none"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Hexagon className="w-5 h-5 text-accent-blue" />
            <span className="font-bold text-lg text-text-primary tracking-tight">AIKI</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className="text-[10px] font-mono bg-surface-card border border-surface-border px-2 py-0.5 rounded text-text-secondary capitalize">
              {user.role}
            </span>
          )}
        </div>
      </header>

      {/* MOBILE SLIDING DRAWER OVERLAY (< 1024px) */}
      <div 
        onClick={() => setIsDrawerOpen(false)}
        className={`lg:hidden fixed inset-0 bg-black/60 z-45 transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside 
        className={`lg:hidden fixed top-0 bottom-0 left-0 w-[260px] bg-sidebar border-r border-surface-border z-50 transform transition-transform duration-300 ease-in-out p-4 ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-[240px] p-4 lg:p-8 overflow-y-auto min-h-[calc(100-72)vh]">
        <div className="max-w-6xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;

