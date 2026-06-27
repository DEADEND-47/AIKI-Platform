import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FileText, Brain, ShieldAlert, Hexagon, Moon, Sun } from 'lucide-react';

export function Layout({ children }) {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const navItems = [
    { name: 'Document Hub', path: '/documents', icon: FileText },
    { name: 'Knowledge Copilot', path: '/copilot', icon: Brain },
    { name: 'Compliance', path: '/compliance', icon: ShieldAlert },
    { name: 'Knowledge Graph', path: '/graph', icon: Hexagon },
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row text-text-primary">
      {/* DESKTOP SIDEBAR (>= 1024px) */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[240px] bg-surface-sidebar border-r border-surface-border z-30 justify-between p-4">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-2 px-2 py-3 select-none">
            <div className="p-1.5 bg-accent-blue/10 border border-accent-blue/30 rounded-md text-accent-blue">
              <Hexagon className="w-6 h-6 animate-pulse" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
              AIKI
            </span>
            <span className="text-[10px] uppercase tracking-widest text-text-muted mt-1 font-mono font-bold">
              Brain
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path || (item.path === '/documents' && currentPath === '/');
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'border-l-2 border-accent-blue bg-surface-card text-accent-blue font-semibold'
                      : 'border-l-2 border-transparent text-text-secondary hover:bg-[#1C2128] hover:text-text-primary'
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
        <div className="border-t border-surface-border pt-4 space-y-4">
          <div className="flex items-center justify-between px-2 text-xs text-text-muted select-none">
            <span>Mode: Dark</span>
            <button className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded hover:bg-[#1C2128]">
              <Moon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between px-2 text-[11px] font-mono text-text-muted select-none">
            <span>AIKI Platform</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER & TAB BAR (< 1024px) */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-surface-sidebar border-b border-surface-border sticky top-0 z-40 select-none">
        <div className="flex items-center gap-2">
          <Hexagon className="w-5 h-5 text-accent-blue" />
          <span className="font-bold text-lg text-text-primary tracking-tight">AIKI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono bg-surface border border-surface-border px-1.5 py-0.5 rounded text-text-secondary">
            v1.0.0
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-[240px] p-4 lg:p-8 overflow-y-auto pb-[80px] lg:pb-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {children}
        </div>
      </main>

      {/* MOBILE BOTTOM TAB BAR (< 1024px) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[64px] bg-surface-sidebar border-t border-surface-border flex justify-around items-center z-40 px-2 select-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || (item.path === '/documents' && currentPath === '/');
          // Short names for mobile tabs
          const shortName = item.name.replace('Knowledge ', '').replace(' Hub', '');
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all border-t-2 ${
                isActive ? 'text-accent-blue border-accent-blue bg-accent-blue/5 font-semibold' : 'text-text-secondary hover:text-text-primary border-transparent'
              }`}
            >
              <Icon className="w-5 h-5 animate-none" />
              <span className="text-[10px] tracking-tight">
                {shortName}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default Layout;
