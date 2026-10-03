import React from 'react';
import { useAutomataStore } from '../store/automataStore';
import { AutomataGraph } from '../components/graph/AutomataGraph';
import { TransitionTable } from '../components/editor/TransitionTable';
import { exportAutomatonToJson } from '../utils/exportUtils';
import { Download, Sparkles, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DfaPage: React.FC = () => {
  const { dfa, conversionResult } = useAutomataStore();
  const activeDfa = dfa || conversionResult;
  const navigate = useNavigate();

  if (!activeDfa) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-4 max-w-xl mx-auto mt-12">
        <AlertCircle className="w-12 h-12 text-purple-400 mx-auto animate-bounce" />
        <h3 className="text-lg font-bold text-slate-200">No Active DFA Available</h3>
        <p className="text-xs text-slate-400">
          Run subset construction on an NFA first to produce a deterministic finite automaton.
        </p>
        <button
          onClick={() => navigate('/conversion')}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20"
        >
          Go to NFA ➔ DFA Conversion
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Deterministic Finite Automaton (DFA)
          </h2>
          <p className="text-xs text-slate-400">
            {activeDfa.states.length} states | {activeDfa.transitions.length} transitions | Start State: {activeDfa.startState}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => exportAutomatonToJson(activeDfa, 'dfa_definition.json')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" /> Export DFA JSON
          </button>
          <button
            onClick={() => navigate('/minimization')}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4" /> Minimize DFA Table-Filling
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7 h-[600px]">
          <AutomataGraph automaton={activeDfa} title="Active DFA State Diagram" />
        </div>
        <div className="col-span-5 space-y-4">
          <div className="glass-panel p-5 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400">
              DFA Transition Matrix
            </h3>
            <TransitionTable
              states={activeDfa.states}
              alphabet={activeDfa.alphabet}
              transitions={activeDfa.transitions}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
};
