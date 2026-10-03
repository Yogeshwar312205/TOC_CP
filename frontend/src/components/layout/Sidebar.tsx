import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PenTool,
  GitCompare,
  Layers,
  Sparkles,
  PlayCircle,
  Split,
  FolderOpen,
  Server,
  Activity,
  X,
  Cpu,
} from 'lucide-react';
import { useAutomataStore } from '../../store/automataStore';
import { apiService } from '../../services/api';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/editor', label: 'NFA / ε-NFA Editor', icon: PenTool },
  { path: '/conversion', label: 'Subset Construction', icon: GitCompare },
  { path: '/dfa', label: 'DFA Viewer', icon: Layers },
  { path: '/minimization', label: 'Table Minimization', icon: Sparkles },
  { path: '/simulator', label: 'String Simulator', icon: PlayCircle },
  { path: '/comparison', label: 'NFA vs DFA', icon: Split },
  { path: '/examples', label: 'Sample Library', icon: FolderOpen },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { nfa } = useAutomataStore();
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await apiService.checkHealth();
        setIsBackendConnected(res.success);
      } catch {
        setIsBackendConnected(false);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => clearInterval(interval);
  }, []);

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 bg-slate-950/95 backdrop-blur-xl border-r border-slate-800/80 text-slate-100">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-2 pb-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent">
                AutomataLab
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Theory of Computation
              </p>
            </div>
          </div>

          {/* Close button for mobile menu */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-md shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Backend Status & NFA Info Panel */}
      <div className="space-y-3 pt-4 border-t border-slate-800/60">
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2 text-slate-200">
              <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>C++ Crow Engine</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className={isBackendConnected ? 'text-emerald-400 font-semibold' : 'text-rose-400'}>
                {isBackendConnected ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/40">
            <span>Port 8080</span>
            <div className="flex items-center gap-1 text-purple-300 font-semibold">
              <Activity className="w-3 h-3 text-purple-400 shrink-0" />
              <span>NFA: {nfa.states.length} states | {nfa.transitions.length} trans</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed/Sticky ~260px) */}
      <aside className="hidden lg:block w-[260px] h-screen sticky top-0 shrink-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="relative w-[270px] max-w-[85vw] h-full shadow-2xl z-10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
