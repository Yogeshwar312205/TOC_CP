import React, { useState, useEffect } from 'react';
import { useAutomataStore } from '../../store/automataStore';
import { apiService } from '../../services/api';
import { Play, RotateCcw, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Pause } from 'lucide-react';
import type { DFASimulationResult, NFASimulationResult } from '../../types/automaton';

interface StringSimulatorProps {
  onStepHighlight?: (
    activeStates: string[],
    activeTransitions: { from: string; symbol: string; to: string }[]
  ) => void;
  targetType?: 'NFA' | 'DFA' | 'MIN_DFA';
  onTargetTypeChange?: (type: 'NFA' | 'DFA' | 'MIN_DFA') => void;
}

export const StringSimulator: React.FC<StringSimulatorProps> = ({
  onStepHighlight,
  targetType: propTargetType,
  onTargetTypeChange,
}) => {
  const { nfa, dfa, minimizationResult, setIsLoading, setError } = useAutomataStore();

  const [inputString, setInputString] = useState('0101');
  const [internalTargetType, setInternalTargetType] = useState<'NFA' | 'DFA' | 'MIN_DFA'>('NFA');
  const targetType = propTargetType !== undefined ? propTargetType : internalTargetType;

  const setTargetType = (type: 'NFA' | 'DFA' | 'MIN_DFA') => {
    setInternalTargetType(type);
    if (onTargetTypeChange) onTargetTypeChange(type);
  };
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [nfaResult, setNfaResult] = useState<NFASimulationResult | null>(null);
  const [dfaResult, setDfaResult] = useState<DFASimulationResult | null>(null);

  // Synchronize active highlights based on targetType, result, and stepIndex
  const updateHighlight = (idx: number) => {
    if (!onStepHighlight) return;

    if (targetType === 'NFA' && nfaResult && nfaResult.trace.length > 0) {
      const safeIdx = Math.min(Math.max(0, idx), nfaResult.trace.length - 1);
      const step = nfaResult.trace[safeIdx];
      if (step) {
        onStepHighlight(step.activeStates, step.transitionsTaken || []);
      }
    } else if (dfaResult && dfaResult.steps.length > 0) {
      const safeIdx = Math.min(Math.max(0, idx), dfaResult.steps.length - 1);
      const step = dfaResult.steps[safeIdx];
      if (step) {
        const prevStep = safeIdx > 0 ? dfaResult.steps[safeIdx - 1] : null;
        const activeTrans =
          safeIdx > 0 && prevStep
            ? [{ from: prevStep.currentState, symbol: step.symbolRead, to: step.currentState }]
            : [];
        onStepHighlight([step.currentState], activeTrans);
      }
    }
  };

  // Run simulation
  const handleSimulate = async () => {
    setIsLoading(true);
    setError(null);
    setStepIndex(0);
    setIsPlaying(false);

    try {
      if (targetType === 'NFA') {
        const res = await apiService.simulateNFA(nfa, inputString);
        if (res.success && res.data) {
          setNfaResult(res.data);
          setDfaResult(null);
          if (onStepHighlight && res.data.trace.length > 0) {
            onStepHighlight(res.data.trace[0].activeStates, res.data.trace[0].transitionsTaken || []);
          }
        } else {
          setError(res.error || 'NFA simulation failed.');
        }
      } else if (targetType === 'DFA') {
        const targetDfa = dfa || minimizationResult?.minimizedDfa;
        if (!targetDfa) {
          setError('No DFA available. Run NFA->DFA conversion first.');
          setIsLoading(false);
          return;
        }
        const res = await apiService.simulateDFA(targetDfa, inputString);
        if (res.success && res.data) {
          setDfaResult(res.data);
          setNfaResult(null);
          if (onStepHighlight && res.data.steps.length > 0) {
            onStepHighlight([res.data.steps[0].currentState], []);
          }
        } else {
          setError(res.error || 'DFA simulation failed.');
        }
      } else {
        const targetDfa = minimizationResult?.minimizedDfa;
        if (!targetDfa) {
          setError('No Minimized DFA available. Run DFA minimization first.');
          setIsLoading(false);
          return;
        }
        const res = await apiService.simulateDFA(targetDfa, inputString);
        if (res.success && res.data) {
          setDfaResult(res.data);
          setNfaResult(null);
          if (onStepHighlight && res.data.steps.length > 0) {
            onStepHighlight([res.data.steps[0].currentState], []);
          }
        } else {
          setError(res.error || 'Minimized DFA simulation failed.');
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Simulation error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step forward
  const handleNextStep = () => {
    const totalSteps =
      targetType === 'NFA'
        ? nfaResult?.trace.length || 0
        : dfaResult?.steps.length || 0;
    if (totalSteps === 0) return;
    const nextIdx = Math.min(totalSteps - 1, stepIndex + 1);
    setStepIndex(nextIdx);
    updateHighlight(nextIdx);
  };

  // Step backward
  const handlePrevStep = () => {
    const prevIdx = Math.max(0, stepIndex - 1);
    setStepIndex(prevIdx);
    updateHighlight(prevIdx);
  };

  // Reset
  const handleReset = () => {
    setStepIndex(0);
    setIsPlaying(false);
    updateHighlight(0);
  };

  // Select specific step from trace table
  const handleSelectStep = (idx: number) => {
    setStepIndex(idx);
    setIsPlaying(false);
    updateHighlight(idx);
  };

  // Auto-play timer
  useEffect(() => {
    let timer: number;
    const totalSteps =
      targetType === 'NFA'
        ? nfaResult?.trace.length || 0
        : dfaResult?.steps.length || 0;

    if (isPlaying && totalSteps > 0) {
      timer = window.setInterval(() => {
        setStepIndex((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          updateHighlight(next);
          return next;
        });
      }, 1200);
    }
    return () => clearInterval(timer);
  }, [isPlaying, targetType, nfaResult, dfaResult]);

  const activeAccepted =
    targetType === 'NFA' ? nfaResult?.accepted : dfaResult?.accepted;

  const totalSteps =
    targetType === 'NFA'
      ? nfaResult?.trace.length || 0
      : dfaResult?.steps.length || 0;

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
          Automaton String Simulator
        </h3>

        {/* Mode Selector */}
        <div className="flex gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            onClick={() => {
              setTargetType('NFA');
              setStepIndex(0);
              setNfaResult(null);
              setDfaResult(null);
            }}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              targetType === 'NFA' ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            NFA
          </button>
          <button
            onClick={() => {
              setTargetType('DFA');
              setStepIndex(0);
              setNfaResult(null);
              setDfaResult(null);
            }}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              targetType === 'DFA' ? 'bg-purple-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DFA
          </button>
          <button
            onClick={() => {
              setTargetType('MIN_DFA');
              setStepIndex(0);
              setNfaResult(null);
              setDfaResult(null);
            }}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              targetType === 'MIN_DFA' ? 'bg-emerald-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Min DFA
          </button>
        </div>
      </div>

      {/* Input controls */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Input string (e.g. 0101)"
          value={inputString}
          onChange={(e) => setInputString(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
        />
        <button
          onClick={handleSimulate}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
        >
          <Play className="w-4 h-4" /> Run Simulation
        </button>
      </div>

      {/* Decision Banner */}
      {activeAccepted !== undefined && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between font-mono text-xs ${
            activeAccepted
              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/60 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            {activeAccepted ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>STRING ACCEPTED</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-rose-400" />
                <span>STRING REJECTED</span>
              </>
            )}
          </div>

          <span className="text-slate-400 text-xs">
            {targetType === 'NFA' ? nfaResult?.rejectionReason : dfaResult?.rejectionReason}
          </span>
        </div>
      )}

      {/* Interactive Step Controls & Step Trace Log */}
      {(nfaResult || dfaResult) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">
              Step {stepIndex + 1} of {totalSteps}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
                title="Reset Simulation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrevStep}
                disabled={stepIndex === 0}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
                title="Previous Step"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Auto Play
                  </>
                )}
              </button>
              <button
                onClick={handleNextStep}
                disabled={stepIndex >= totalSteps - 1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1 border border-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Trace steps table */}
          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-slate-400 uppercase sticky top-0">
                <tr>
                  <th className="p-3">Step</th>
                  <th className="p-3">State(s)</th>
                  <th className="p-3">Symbol Read</th>
                  <th className="p-3">Remaining String</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {targetType === 'NFA' && nfaResult
                  ? nfaResult.trace.map((tr, idx) => (
                      <tr
                        key={idx}
                        onClick={() => handleSelectStep(idx)}
                        className={`transition-colors cursor-pointer ${
                          idx === stepIndex
                            ? 'bg-cyan-950/80 text-cyan-300 font-bold border-l-4 border-l-cyan-400'
                            : 'text-slate-300 hover:bg-slate-900/40'
                        }`}
                      >
                        <td className="p-3">{tr.stepIndex}</td>
                        <td className="p-3 font-bold text-purple-300">
                          {`{ ${tr.activeStates.join(', ')} }`}
                        </td>
                        <td className="p-3 text-amber-300">{tr.symbolRead || '—'}</td>
                        <td className="p-3 text-slate-400">{tr.remainingString || 'ε (Empty)'}</td>
                      </tr>
                    ))
                  : dfaResult?.steps.map((st, idx) => (
                      <tr
                        key={idx}
                        onClick={() => handleSelectStep(idx)}
                        className={`transition-colors cursor-pointer ${
                          idx === stepIndex
                            ? 'bg-cyan-950/80 text-cyan-300 font-bold border-l-4 border-l-cyan-400'
                            : 'text-slate-300 hover:bg-slate-900/40'
                        }`}
                      >
                        <td className="p-3">{st.stepIndex}</td>
                        <td className="p-3 font-bold text-purple-300">{st.currentState}</td>
                        <td className="p-3 text-amber-300">{st.symbolRead || '—'}</td>
                        <td className="p-3 text-slate-400">{st.remainingString || 'ε (Empty)'}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
