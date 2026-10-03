import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAutomataStore } from '../store/automataStore';
import { SAMPLE_AUTOMATA } from '../services/examples';
import {
  PenTool,
  GitCompare,
  Sparkles,
  PlayCircle,
  FolderOpen,
  ArrowRight,
  Cpu,
  Layers,
  Server,
  Activity,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { nfa, dfa, loadExample } = useAutomataStore();

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-8">
      {/* Hero Header */}
      <div className="glass-panel-glow p-6 md:p-8 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> C++ Crow Engine Powered
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent">
            AutomataLab
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Interactive visualization engine for NFA to DFA Subset Construction, Table-Filling DFA Minimization, and String Simulation.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => navigate('/editor')}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <PenTool className="w-4 h-4 shrink-0" /> Open NFA Editor
            </button>
            <button
              onClick={() => navigate('/examples')}
              className="px-5 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-purple-400 shrink-0" /> Explore Examples
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Section (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>NFA States</span>
            <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">
            {nfa.states.length}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>NFA Transitions</span>
            <Activity className="w-4 h-4 text-purple-400 shrink-0" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">
            {nfa.transitions.length}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>DFA States</span>
            <GitCompare className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 font-mono">
            {dfa ? dfa.states.length : 'Dynamic'}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Backend Status</span>
            <Server className="w-4 h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-400 pt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected</span>
          </div>
        </div>
      </div>

      {/* Core Workflow Cards (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/editor')}
          className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-cyan-500/50 transition-all cursor-pointer group space-y-3"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/40 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform shrink-0">
            <PenTool className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-cyan-300">1. Define NFA / ε-NFA</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Create states, define alphabet symbols, and configure transitions.
          </p>
          <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform pt-1">
            Go to Editor <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => navigate('/conversion')}
          className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-purple-500/50 transition-all cursor-pointer group space-y-3"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800/40 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform shrink-0">
            <GitCompare className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-purple-300">2. Subset Construction</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Convert NFA to equivalent DFA with step-by-step subset tracking.
          </p>
          <div className="text-xs font-semibold text-purple-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform pt-1">
            Convert NFA <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => navigate('/minimization')}
          className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-emerald-500/50 transition-all cursor-pointer group space-y-3"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-emerald-300">3. DFA Minimization</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Table-filling algorithm matrix to produce the minimal DFA.
          </p>
          <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform pt-1">
            Minimize DFA <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => navigate('/simulator')}
          className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-amber-500/50 transition-all cursor-pointer group space-y-3"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform shrink-0">
            <PlayCircle className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-amber-300">4. String Simulator</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Test strings step-by-step with real-time state path highlighting.
          </p>
          <div className="text-xs font-semibold text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform pt-1">
            Run Simulator <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Quick Start Preset Library Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Quick Start Preset Library
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_AUTOMATA.slice(0, 3).map((sample) => (
            <div
              key={sample.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/40">
                  {sample.category}
                </span>
                <h4 className="font-bold text-sm text-slate-100">{sample.name}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{sample.description}</p>
              </div>

              <button
                onClick={() => {
                  loadExample(sample);
                  navigate('/editor');
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 text-xs font-bold rounded-xl border border-slate-800 hover:border-cyan-500/30 transition-all cursor-pointer mt-2"
              >
                Load Preset & Edit
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
