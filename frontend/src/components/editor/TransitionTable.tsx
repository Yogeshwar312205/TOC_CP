import React from 'react';
import type { Transition } from '../../types/automaton';

interface TransitionTableProps {
  states: string[];
  alphabet: string[];
  transitions: Transition[];
  onAddTransition?: (from: string, symbol: string, to: string) => void;
  onRemoveTransition?: (index: number) => void;
  readOnly?: boolean;
}

export const TransitionTable: React.FC<TransitionTableProps> = ({
  states,
  alphabet,
  transitions,
  onRemoveTransition,
  readOnly = false,
}) => {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 backdrop-blur-md">
      <table className="w-full text-left text-xs font-mono">
        <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800 uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3">From State</th>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">To State</th>
            {!readOnly && <th className="px-4 py-3 text-right">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-slate-200">
          {transitions.length === 0 ? (
            <tr>
              <td colSpan={readOnly ? 3 : 4} className="px-4 py-6 text-center text-slate-500 italic">
                No transitions defined yet. Add transitions below.
              </td>
            </tr>
          ) : (
            transitions.map((tr, idx) => (
              <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                <td className="px-4 py-2.5 font-bold text-cyan-400">{tr.from}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    tr.symbol === 'ε' ? 'bg-purple-950 text-purple-300 border border-purple-800/50' : 'bg-slate-800 text-cyan-300'
                  }`}>
                    {tr.symbol}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-bold text-cyan-400">{tr.to}</td>
                {!readOnly && onRemoveTransition && (
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => onRemoveTransition(idx)}
                      className="px-2 py-1 rounded bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/40 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
