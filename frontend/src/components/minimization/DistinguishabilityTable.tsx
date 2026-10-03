import React from 'react';
import type { MinimizationResult } from '../../types/automaton';
import { Layers, Sparkles, CheckCircle2 } from 'lucide-react';

interface DistinguishabilityTableProps {
  result: MinimizationResult;
}

export const DistinguishabilityTable: React.FC<DistinguishabilityTableProps> = ({ result }) => {
  const { originalStates, table, equivalenceClasses, stateMapping, stats } = result;

  // Render lower triangular matrix (pair (states[i], states[j]) where j < i)
  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-cyan-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Original States</p>
            <p className="text-lg font-mono font-bold text-cyan-300">{stats.originalStateCount}</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-purple-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-950/80 border border-purple-800/40 flex items-center justify-center text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Minimized States</p>
            <p className="text-lg font-mono font-bold text-purple-300">{stats.minimizedStateCount}</p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">State Reduction</p>
            <p className="text-lg font-mono font-bold text-emerald-300">
              {stats.reductionPercentage.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Table-Filling Lower Triangular Matrix */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
          <span>Table-Filling Distinguishability Matrix (Myhill-Nerode)</span>
          <span className="text-xs font-normal text-slate-400">
            ❌ = Distinguishable Pair | Blank = Equivalent (Merged)
          </span>
        </h3>

        <div className="overflow-x-auto">
          <table className="border-collapse text-xs font-mono">
            <thead>
              <tr>
                <th className="p-2 border border-slate-800 bg-slate-900 text-slate-400">State</th>
                {originalStates.slice(0, originalStates.length - 1).map((st) => (
                  <th key={st} className="p-2 border border-slate-800 bg-slate-900 text-cyan-400 font-bold">
                    {st}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {originalStates.slice(1).map((stI, rowIdx) => (
                <tr key={stI}>
                  <td className="p-2 border border-slate-800 bg-slate-900 text-cyan-400 font-bold">
                    {stI}
                  </td>
                  {originalStates.slice(0, rowIdx + 1).map((stJ) => {
                    // find entry in table
                    const entry = table.find(
                      (e) =>
                        (e.stateA === stI && e.stateB === stJ) ||
                        (e.stateA === stJ && e.stateB === stI)
                    );
                    const isDistinguishable = entry ? entry.distinguishable : false;

                    return (
                      <td
                        key={stJ}
                        className={`p-3 text-center border border-slate-800/80 transition-colors ${
                          isDistinguishable
                            ? 'bg-rose-950/40 text-rose-400 font-bold'
                            : 'bg-emerald-950/40 text-emerald-300 font-bold'
                        }`}
                        title={
                          entry
                            ? `Pair (${stI}, ${stJ}): ${
                                isDistinguishable
                                  ? `Distinguishable at step ${entry.stepMarked} via '${entry.reasonSymbol}'`
                                  : 'Equivalent Pair'
                              }`
                            : ''
                        }
                      >
                        {isDistinguishable ? (
                          <span className="inline-block hover:scale-125 transition-transform">
                            ✕<sub>{entry?.stepMarked}</sub>
                          </span>
                        ) : (
                          <span className="text-emerald-400">≡</span>
                        )}
                      </td>
                    );
                  })}
                  {/* Fill empty cells for upper triangular */}
                  {Array.from({ length: originalStates.length - 2 - rowIdx }).map((_, i) => (
                    <td key={i} className="p-3 border border-slate-900 bg-slate-950/40" />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equivalence Classes & State Mapping */}
      <div className="grid grid-cols-2 gap-6">
        <div className="glass-panel p-5 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
            Equivalence Classes
          </h4>
          <div className="space-y-2">
            {equivalenceClasses.map((eq, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono flex items-center justify-between"
              >
                <span className="text-slate-400">Class {idx + 1}:</span>
                <span className="text-purple-300 font-bold">
                  {`[ ${eq.states.join(', ')} ]`} ➔ Representative:{' '}
                  <span className="text-cyan-300">{eq.representative}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            State Mapping (Old ➔ New)
          </h4>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {Object.entries(stateMapping).map(([oldSt, newSt]) => (
              <div
                key={oldSt}
                className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono flex items-center justify-between"
              >
                <span className="text-cyan-400 font-bold">{oldSt}</span>
                <span className="text-slate-500">➔</span>
                <span className="text-emerald-300 font-bold">{newSt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
