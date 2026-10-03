import React from 'react';
import { useAutomataStore } from '../store/automataStore';
import { apiService } from '../services/api';
import { AutomataGraph } from '../components/graph/AutomataGraph';
import { DistinguishabilityTable } from '../components/minimization/DistinguishabilityTable';
import { Sparkles, Loader2, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MinimizationPage: React.FC = () => {
  const {
    dfa,
    conversionResult,
    minimizationResult,
    setMinimizationResult,
    isLoading,
    setIsLoading,
    setError,
  } = useAutomataStore();

  const navigate = useNavigate();
  const activeDfa = dfa || conversionResult;

  const handleRunMinimization = async () => {
    if (!activeDfa) {
      setError('No DFA available to minimize.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiService.minimizeDFA(activeDfa);
      if (res.success && res.data) {
        setMinimizationResult(res.data);
      } else {
        setError(res.error || 'DFA Minimization failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backend unreachable.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            DFA Minimization — Table-Filling Algorithm (Myhill-Nerode)
          </h2>
          <p className="text-xs text-slate-400">
            Removes unreachable states and merges indistinguishable (equivalent) state pairs.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRunMinimization}
            disabled={isLoading || !activeDfa}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Running Table-Filling Algorithm...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Run DFA Minimization
              </>
            )}
          </button>

          {minimizationResult && (
            <button
              onClick={() => navigate('/simulator')}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <PlayCircle className="w-4 h-4" /> Test Strings on Min DFA
            </button>
          )}
        </div>
      </div>

      {/* Side-by-Side Graphs */}
      {activeDfa && (
        <div className="grid grid-cols-2 gap-6 h-[460px]">
          <AutomataGraph
            automaton={activeDfa}
            unreachableStates={minimizationResult ? minimizationResult.unreachableStates : []}
            title="Original DFA (Unreachable States Highlighted)"
          />

          {minimizationResult ? (
            <AutomataGraph
              automaton={minimizationResult.minimizedDfa}
              title="Minimized DFA State Diagram"
            />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center space-y-3">
              <Sparkles className="w-12 h-12 text-slate-700 animate-pulse" />
              <p className="text-slate-400 font-medium text-sm">Minimized DFA Not Yet Generated</p>
              <p className="text-xs text-slate-500 max-w-xs">
                Click "Run DFA Minimization" to calculate lower-triangular distinguishability table.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Table-Filling Distinguishability Matrix */}
      {minimizationResult && <DistinguishabilityTable result={minimizationResult} />}
    </div>
  );
};
