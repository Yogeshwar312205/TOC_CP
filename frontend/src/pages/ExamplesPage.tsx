import React from 'react';
import { SAMPLE_AUTOMATA } from '../services/examples';
import { useAutomataStore } from '../store/automataStore';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, ArrowRight, Layers } from 'lucide-react';

export const ExamplesPage: React.FC = () => {
  const { loadExample } = useAutomataStore();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
          Automata Library & Benchmark Examples
        </h2>
        <p className="text-xs text-slate-400">
          Curated collection of standard Theory of Computation automata for educational analysis.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {SAMPLE_AUTOMATA.map((sample) => (
          <div
            key={sample.id}
            className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-purple-950/80 text-purple-300 border border-purple-800/40">
                  {sample.category}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {sample.nfa.states.length} states | {sample.nfa.transitions.length} transitions
                </span>
              </div>

              <h3 className="font-bold text-base text-slate-100">{sample.name}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{sample.description}</p>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 font-mono text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Start: <span className="text-purple-300">{sample.nfa.startState}</span></span>
                  <span>Accept: <span className="text-emerald-300">{sample.nfa.acceptStates.join(', ')}</span></span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                loadExample(sample);
                navigate('/editor');
              }}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all mt-4"
            >
              Load into AutomataLab <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
