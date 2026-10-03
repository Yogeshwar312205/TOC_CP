import React from 'react';
import { useAutomataStore } from '../store/automataStore';
import { AutomataGraph } from '../components/graph/AutomataGraph';
import { Split, Layers, Sparkles, GitCompare } from 'lucide-react';

export const ComparisonPage: React.FC = () => {
  const { nfa, dfa, minimizationResult } = useAutomataStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
          3-Way Structural & Complexity Comparison
        </h2>
        <p className="text-xs text-slate-400">
          Side-by-side visualization of NFA, Converted DFA, and Minimized DFA.
        </p>
      </div>

      {/* Comparison Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-cyan-500/30 space-y-1 font-mono text-xs">
          <span className="text-cyan-400 font-bold uppercase">1. NFA / ε-NFA</span>
          <div className="flex justify-between text-slate-300">
            <span>States: {nfa.states.length}</span>
            <span>Transitions: {nfa.transitions.length}</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-purple-500/30 space-y-1 font-mono text-xs">
          <span className="text-purple-400 font-bold uppercase">2. Converted DFA</span>
          <div className="flex justify-between text-slate-300">
            <span>States: {dfa ? dfa.states.length : 'N/A'}</span>
            <span>Transitions: {dfa ? dfa.transitions.length : 'N/A'}</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-emerald-500/30 space-y-1 font-mono text-xs">
          <span className="text-emerald-400 font-bold uppercase">3. Minimized DFA</span>
          <div className="flex justify-between text-slate-300">
            <span>States: {minimizationResult ? minimizationResult.minimizedDfa.states.length : 'N/A'}</span>
            <span>Transitions: {minimizationResult ? minimizationResult.minimizedDfa.transitions.length : 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* 3 Graphs Side-by-Side */}
      <div className="grid grid-cols-3 gap-4 h-[550px]">
        <AutomataGraph automaton={nfa} title="Input NFA" />

        {dfa ? (
          <AutomataGraph automaton={dfa} title="Subset DFA" />
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 flex items-center justify-center text-slate-500 text-xs">
            Run NFA➔DFA conversion first
          </div>
        )}

        {minimizationResult ? (
          <AutomataGraph automaton={minimizationResult.minimizedDfa} title="Minimized DFA" />
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 flex items-center justify-center text-slate-500 text-xs">
            Run DFA Minimization first
          </div>
        )}
      </div>
    </div>
  );
};
