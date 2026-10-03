import React, { useState } from 'react';
import { useAutomataStore } from '../../store/automataStore';
import { TransitionTable } from './TransitionTable';
import { Plus, Trash2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/api';

export const NfaEditor: React.FC = () => {
  const { nfa, setNfa, setValidation, setError } = useAutomataStore();

  const [newStateName, setNewStateName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [fromState, setFromState] = useState(nfa.states[0] || '');
  const [transSymbol, setTransSymbol] = useState(nfa.alphabet[0] || '');
  const [toState, setToState] = useState(nfa.states[0] || '');

  // Add state
  const handleAddState = () => {
    const trimmed = newStateName.trim();
    if (!trimmed) return;
    if (nfa.states.includes(trimmed)) {
      alert(`State "${trimmed}" already exists.`);
      return;
    }
    setNfa((prev) => ({
      ...prev,
      states: [...prev.states, trimmed],
    }));
    setNewStateName('');
  };

  // Delete state
  const handleDeleteState = (st: string) => {
    if (nfa.states.length <= 1) {
      alert('Automaton must have at least one state.');
      return;
    }
    setNfa((prev) => ({
      ...prev,
      states: prev.states.filter((s) => s !== st),
      startState: prev.startState === st ? (prev.states.find((s) => s !== st) || '') : prev.startState,
      acceptStates: prev.acceptStates.filter((s) => s !== st),
      transitions: prev.transitions.filter((t) => t.from !== st && t.to !== st),
    }));
  };

  // Toggle accept state
  const handleToggleAccept = (st: string) => {
    setNfa((prev) => ({
      ...prev,
      acceptStates: prev.acceptStates.includes(st)
        ? prev.acceptStates.filter((s) => s !== st)
        : [...prev.acceptStates, st],
    }));
  };

  // Add symbol to alphabet
  const handleAddSymbol = () => {
    const trimmed = newSymbol.trim();
    if (!trimmed || trimmed === 'ε') return;
    if (nfa.alphabet.includes(trimmed)) return;
    setNfa((prev) => ({
      ...prev,
      alphabet: [...prev.alphabet, trimmed],
    }));
    setNewSymbol('');
  };

  // Remove symbol from alphabet
  const handleRemoveSymbol = (sym: string) => {
    setNfa((prev) => ({
      ...prev,
      alphabet: prev.alphabet.filter((s) => s !== sym),
      transitions: prev.transitions.filter((t) => t.symbol !== sym),
    }));
  };

  // Add transition
  const handleAddTransition = () => {
    const actualFrom = (nfa.states.includes(fromState) ? fromState : nfa.states[0]) || '';
    const actualSymbol =
      nfa.alphabet.includes(transSymbol) || transSymbol === 'ε'
        ? transSymbol
        : nfa.alphabet[0] || 'ε';
    const actualTo = (nfa.states.includes(toState) ? toState : nfa.states[0]) || '';

    if (!actualFrom || !actualSymbol || !actualTo) return;
    setNfa((prev) => ({
      ...prev,
      transitions: [...prev.transitions, { from: actualFrom, symbol: actualSymbol, to: actualTo }],
    }));
  };

  // Delete transition
  const handleRemoveTransition = (idx: number) => {
    setNfa((prev) => ({
      ...prev,
      transitions: prev.transitions.filter((_, i) => i !== idx),
    }));
  };

  // Validate automaton via backend API
  const handleValidate = async () => {
    try {
      const res = await apiService.validateNFA(nfa);
      if (res.success && res.data) {
        setValidation(res.data);
      } else {
        setError(res.error || 'Validation failed.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Backend unreachable';
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      {/* States Management */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
          <span>1. States ({nfa.states.length})</span>
          <span className="text-xs font-normal text-slate-400">Click state to toggle Accept state</span>
        </h3>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New State (e.g. q3)"
            value={newStateName}
            onChange={(e) => setNewStateName(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm focus:outline-none focus:border-cyan-500 flex-1 font-mono text-cyan-200"
          />
          <button
            onClick={handleAddState}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Add State
          </button>
        </div>

        {/* State Tags List */}
        <div className="flex flex-wrap gap-2 pt-2">
          {nfa.states.map((st) => {
            const isStart = st === nfa.startState;
            const isAccept = nfa.acceptStates.includes(st);
            return (
              <div
                key={st}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-all ${
                  isStart
                    ? 'bg-purple-950/80 border-purple-500 text-purple-300'
                    : isAccept
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
                onClick={() => handleToggleAccept(st)}
              >
                <span>{st}</span>
                {isStart && <span className="text-[10px] text-purple-400 uppercase">[Start]</span>}
                {isAccept && <span className="text-[10px] text-emerald-400 uppercase">[Accept]</span>}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteState(st);
                  }}
                  className="hover:text-rose-400 transition-colors ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Select Start State */}
        <div className="flex items-center gap-3 pt-2">
          <label className="text-xs font-medium text-slate-400">Start State:</label>
          <select
            value={nfa.startState}
            onChange={(e) => setNfa((prev) => ({ ...prev, startState: e.target.value }))}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
          >
            {nfa.states.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alphabet Management */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400">
          2. Alphabet Symbols ({nfa.alphabet.length})
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New Symbol (e.g. 0, 1, a, b)"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm focus:outline-none focus:border-purple-500 flex-1 font-mono text-purple-200"
          />
          <button
            onClick={handleAddSymbol}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-purple-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Symbol
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {nfa.alphabet.map((sym) => (
            <div
              key={sym}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-purple-300 flex items-center gap-2"
            >
              <span>{sym}</span>
              <button
                onClick={() => handleRemoveSymbol(sym)}
                className="hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs font-mono font-bold text-purple-400">
            ε (Epsilon allowed)
          </div>
        </div>
      </div>

      {/* Transition Builder */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
          3. Transitions ({nfa.transitions.length})
        </h3>

        <div className="grid grid-cols-3 gap-2">
          <select
            value={fromState}
            onChange={(e) => setFromState(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300"
          >
            {nfa.states.map((st) => (
              <option key={st} value={st}>
                From: {st}
              </option>
            ))}
          </select>

          <select
            value={transSymbol}
            onChange={(e) => setTransSymbol(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-purple-300"
          >
            {nfa.alphabet.map((sym) => (
              <option key={sym} value={sym}>
                Symbol: {sym}
              </option>
            ))}
            <option value="ε">Symbol: ε (Epsilon)</option>
          </select>

          <select
            value={toState}
            onChange={(e) => setToState(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300"
          >
            {nfa.states.map((st) => (
              <option key={st} value={st}>
                To: {st}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAddTransition}
          className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Transition
        </button>

        <TransitionTable
          states={nfa.states}
          alphabet={nfa.alphabet}
          transitions={nfa.transitions}
          onRemoveTransition={handleRemoveTransition}
        />
      </div>

      {/* Validation Trigger */}
      <button
        onClick={handleValidate}
        className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md"
      >
        <CheckCircle2 className="w-4 h-4 text-cyan-400" /> Validate NFA Definition
      </button>
    </div>
  );
};
