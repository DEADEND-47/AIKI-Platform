import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  FileText, Brain, ShieldAlert, Hexagon, Moon, LogOut, Search, 
  BarChart2, Sun, Settings, Home, Wrench, Menu, X, ChevronLeft, ChevronRight,
  Zap
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
  // Desktop sidebar: false = full, true = icon-only
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Close mobile drawer when route changes
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

  // Plant selector
  const [selectedPlantId, setSelectedPlantId] = useState(
    localStorage.getItem('plantId') || 'p1-ohio-1111-1111-111111111111'
  );
  
  const plants = [
    { plant_id: 'p1-ohio-1111-1111-111111111111', name: 'Plant Alpha', location: 'Ohio' },
    { plant_id: 'p2-texas-2222-2222-222222222222', name: 'Plant Beta', location: 'Texas' },
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

  // Global RAG search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const delay = setTimeout(async () => {
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
    return () => clearTimeout(delay);
  }, [searchQuery]);

  // Close search results on outside click
  useEffect(() => {
    const handle = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const navItems = [
    { name: 'Dashboard',       path: '/',          icon: Home },
    { name: 'Documents',       path: '/documents', icon: FileText },
    { name: 'AI Copilot',      path: '/copilot',   icon: Brain,     isAI: true },
    { name: 'Compliance',      path: '/compliance',icon: ShieldAlert },
    { name: 'Knowledge Graph', path: '/graph',     icon: Hexagon },
    { name: 'Equipment',       path: '/equipment', icon: Wrench },
    { name: 'Analytics',       path: '/analytics', icon: BarChart2 },
    { name: 'Settings',        path: '/settings',  icon: Settings },
  ];

  // Login screen — no sidebar
  if (isLoginPage || !token) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        {children}
      </div>
    );
  }

  const sidebarWidth = isSidebarCollapsed ? 'w-[60px]' : 'w-[240px]';
  const mainMargin   = isSidebarCollapsed ? 'lg:ml-[60px]' : 'lg:ml-[240px]';

  // ── Sidebar content ──────────────────────────────────────────────
  const renderSidebarContent = (isMobileView = false) => {
    const collapsed = !isMobileView && isSidebarCollapsed;

    return (
      <div className="flex flex-col h-full justify-between select-none">
        <div className="space-y-1">
          {/* Logo row */}
          <div className={`flex items-center py-3 mb-1 ${collapsed ? 'justify-center px-1' : 'justify-between px-2'}`}>
            {collapsed ? (
              <div
                className="p-1.5 bg-accent-blue/10 border border-accent-blue/30 rounded-md text-accent-blue cursor-pointer hover:bg-accent-blue/20 transition-colors"
                onClick={() => setIsSidebarCollapsed(false)}
                title="Expand sidebar"
              >
                <Hexagon className="w-5 h-5" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-accent-blue/10 border border-accent-blue/30 rounded-md text-accent-blue">
                    <Hexagon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-base font-bold tracking-tight text-text-primary">AIKI</span>
                    <span className="text-[8px] uppercase tracking-[0.15em] text-text-muted font-mono font-bold">Asset Brain</span>
                  </div>
                </div>
                {isMobileView ? (
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-card border border-surface-border rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIsSidebarCollapsed(true)}
                    className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-card rounded-md transition-colors"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Plant selector — hidden when collapsed */}
          {!collapsed && (
            <div className="px-2 pb-1">
              <label className="section-label block mb-1.5">Active Facility</label>
              <select
                value={selectedPlantId}
                onChange={handlePlantChange}
                className="w-full bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-blue transition-colors cursor-pointer"
              >
                {plants.map(p => (
                  <option key={p.plant_id} value={p.plant_id}>
                    {p.name} ({p.location})
                  </option>
                ))}
                {user?.role === 'admin' && <option value="all">All Facilities</option>}
              </select>
            </div>
          )}

          {/* Global RAG search — hidden when collapsed */}
          {!collapsed && (
            <div className="px-2 pb-2 relative" ref={searchRef}>
              <label className="section-label block mb-1.5">Global RAG Search</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tag or spec…"
                  className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue transition-all"
                />
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5" />
                {isSearching && (
                  <span className="absolute right-2.5 top-2.5 w-3 h-3 rounded-full border-t-2 border-accent-blue animate-spin" />
                )}
              </div>

              {/* Results dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute left-2 right-2 mt-1 bg-surface-card border border-surface-border rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto p-1.5 space-y-0.5 select-text animate-fade-in">
                  {searchResults.map((r) => (
                    <div
                      key={r.doc_id}
                      onClick={() => {
                        setShowSearchResults(false);
                        setSearchQuery('');
                        setIsDrawerOpen(false);
                        navigate(`/documents?open=${r.doc_id}`);
                      }}
                      className="p-2 rounded-lg hover:bg-surface cursor-pointer transition-colors text-[11px] space-y-0.5"
                    >
                      <div className="font-semibold text-accent-blue truncate">{r.filename}</div>
                      <div className="text-[10px] text-text-muted capitalize">{r.doc_type.replace('_', ' ')}</div>
                      <p className="text-[10px] text-text-secondary line-clamp-2 leading-normal">
                        "{r.excerpt.replace(/\*\*/g, '')}"
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {showSearchResults && searchResults.length === 0 && !isSearching && (
                <div className="absolute left-2 right-2 mt-1 bg-surface-card border border-surface-border rounded-xl shadow-xl z-50 p-3 text-[11px] text-text-muted italic animate-fade-in">
                  No results found.
                </div>
              )}
            </div>
          )}

          {/* Separator */}
          {!collapsed && <div className="mx-2 h-px bg-surface-border" />}

          {/* Navigation links */}
          <nav className={`space-y-0.5 pt-1 ${collapsed ? 'px-1' : 'px-1.5'}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              if (collapsed) {
                // Icon-only mode
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={item.name}
                    className={`flex items-center justify-center w-9 h-9 mx-auto rounded-lg transition-all duration-150 group relative ${
                      isActive
                        ? 'bg-accent-blue/15 text-accent-blue'
                        : 'text-text-muted hover:bg-surface-card hover:text-text-primary'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {isActive && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent-blue rounded-full" />
                    )}
                    {item.isAI && !isActive && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent-purple" />
                    )}
                  </NavLink>
                );
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group relative ${
                    isActive
                      ? 'bg-accent-blue/12 text-accent-blue font-semibold'
                      : 'text-text-secondary hover:bg-surface-card hover:text-text-primary'
                  }`}
                >
                  {/* Active left indicator */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent-blue rounded-r-full" />
                  )}
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-transform duration-150 ${isActive ? '' : 'group-hover:scale-110'}`} />
                  <span>{item.name}</span>
                  {item.isAI && (
                    <span className="ml-auto text-[8px] font-bold px-1 py-0.5 rounded bg-accent-purple/10 text-accent-purple border border-accent-purple/20 uppercase tracking-wide">
                      AI
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* ── Bottom panel ── */}
        <div className={`border-t border-surface-border pt-3 space-y-2 ${collapsed ? 'px-1' : 'px-2'}`}>
          {/* User info */}
          {user && !collapsed && (
            <div className="flex items-center justify-between py-2 border-b border-surface-border/60 mb-1">
              <div className="min-w-0">
                <span className="section-label block mb-0.5">Signed in as</span>
                <span className="text-xs text-text-primary font-medium block truncate max-w-[120px]">
                  {user.email.split('@')[0]}
                </span>
                <span className="inline-block text-[8px] font-mono font-bold text-accent-purple bg-accent-purple/10 border border-accent-purple/20 px-1.5 py-0.5 rounded uppercase mt-0.5">
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Log out"
                className="text-text-muted hover:text-accent-red border border-surface-border hover:bg-accent-red/10 p-1.5 rounded-lg transition-all duration-150 active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {collapsed && (
            <button
              onClick={handleLogout}
              title="Log out"
              className="w-9 h-9 mx-auto flex items-center justify-center text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all duration-150 active:scale-95"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          {/* Theme selector */}
          {!collapsed && (
            <div className="flex items-center justify-between text-xs text-text-muted py-1">
              <span className="flex items-center gap-1.5 font-medium">
                {theme === 'light' ? (
                  <Sun className="w-3.5 h-3.5 text-accent-amber" />
                ) : theme === 'industrial' ? (
                  <Zap className="w-3.5 h-3.5 text-accent-amber" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-accent-blue" />
                )}
                Theme
              </span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="bg-surface border border-surface-border rounded-md px-1.5 py-0.5 text-[10px] text-text-primary focus:outline-none cursor-pointer capitalize font-mono"
              >
                {themes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {/* Version / Expand button */}
          {!collapsed ? (
            <div className="flex items-center justify-between text-[10px] font-mono text-text-muted py-1">
              <span>AIKI Platform</span>
              <span>v2.0.0</span>
            </div>
          ) : (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              title="Expand sidebar"
              className="w-9 h-9 mx-auto flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-card rounded-lg transition-all duration-150"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row text-text-primary transition-colors duration-200">
      
      {/* ── DESKTOP SIDEBAR (≥1024px) ── */}
      <aside className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 ${sidebarWidth} bg-surface-sidebar border-r border-surface-border z-30 p-3 transition-all duration-250 ease-in-out overflow-hidden`}>
        {renderSidebarContent(false)}
      </aside>

      {/* ── MOBILE HEADER (<1024px) ── */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface-sidebar border-b border-surface-border sticky top-0 z-40 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 text-text-secondary hover:text-text-primary border border-surface-border rounded-md hover:bg-surface-card transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Hexagon className="w-4.5 h-4.5 text-accent-blue" />
            <span className="font-bold text-base text-text-primary tracking-tight">AIKI</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className="text-[10px] font-mono bg-surface-card border border-surface-border px-2 py-0.5 rounded-full text-text-secondary capitalize">
              {user.role}
            </span>
          )}
        </div>
      </header>

      {/* ── MOBILE DRAWER BACKDROP ── */}
      <div
        onClick={() => setIsDrawerOpen(false)}
        className={`lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-45 transition-opacity duration-250 ${
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* ── MOBILE SLIDING DRAWER ── */}
      <aside
        className={`lg:hidden fixed top-0 bottom-0 left-0 w-[260px] bg-surface-sidebar border-r border-surface-border z-50 p-3 transition-transform duration-250 ease-in-out overflow-hidden ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className={`flex-1 ${mainMargin} p-4 lg:p-8 overflow-y-auto transition-all duration-250 ease-in-out`}>
        <div className="max-w-6xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
