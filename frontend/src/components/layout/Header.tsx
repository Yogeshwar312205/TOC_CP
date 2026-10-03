import React from 'react';
import { useAutomataStore } from '../../store/automataStore';
import { Server, CheckCircle2, Menu } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { nfa, dfa, minimizationResult } = useAutomataStore();

  return (
    <header className="h-16 bg-slate-950/70 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Active Automaton Badge Status */}
        <div className="flex items-center gap-2 md:gap-3 text-xs font-mono overflow-x-auto py-1 no-scrollbar">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/80 shrink-0">
            <span className="text-slate-400">NFA:</span>
            <span className="text-cyan-400 font-semibold">{nfa.states.length} states</span>
            <span className="text-slate-600">|</span>
            <span className="text-purple-400 font-semibold">{nfa.transitions.length} trans</span>
          </div>

          {dfa && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-300 shrink-0">
              <span>DFA:</span>
              <span className="font-semibold">{dfa.states.length} states</span>
            </div>
          )}

          {minimizationResult && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 shrink-0">
              <span>Min DFA:</span>
              <span className="font-semibold">{minimizationResult.minimizedDfa.states.length} states</span>
            </div>
          )}
        </div>
      </div>

      {/* Backend Status indicator */}
      <div className="hidden sm:flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 border border-slate-800/80 px-3 py-1.5 rounded-full">
          <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Backend:</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Crow C++ (port 8080)
          </span>
        </div>
      </div>
    </header>
  );
};
