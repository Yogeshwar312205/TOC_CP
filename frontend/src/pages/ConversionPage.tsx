import React from 'react';
import { useAutomataStore } from '../store/automataStore';
import { apiService } from '../services/api';
import { AutomataGraph } from '../components/graph/AutomataGraph';
import { ConversionSteps } from '../components/conversion/ConversionSteps';
import { GitCompare, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ConversionPage: React.FC = () => {
  const {
    nfa,
    conversionSteps,
    setConversionSteps,
    conversionResult,
    setConversionResult,
    setDfa,
    currentStepIndex,
    setCurrentStepIndex,
    isLoading,
    setIsLoading,
    setError,
  } = useAutomataStore();

  const navigate = useNavigate();

  const handleRunConversion = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiService.convertNfaToDfa(nfa);
      if (res.success && res.data) {
        setConversionSteps(res.data.steps);
        setConversionResult(res.data.dfa);
        setDfa(res.data.dfa);
        setCurrentStepIndex(0);
      } else {
        setError(res.error || 'Conversion failed on backend.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backend connection error.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const activeStep = conversionSteps[currentStepIndex];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            NFA ➔ DFA Subset Construction Algorithm
          </h2>
          <p className="text-xs text-slate-400">
            Computes $\epsilon$-closures, computes $move(S, a)$, and builds deterministic state power-sets.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRunConversion}
            disabled={isLoading}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Running C++ Subset Construction...
              </>
            ) : (
              <>
                <GitCompare className="w-4 h-4" /> Run Subset Construction
              </>
            )}
          </button>

          {conversionResult && (
            <button
              onClick={() => navigate('/minimization')}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Sparkles className="w-4 h-4" /> Proceed to DFA Minimization <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Side-by-Side Graph Visualization */}
      <div className="grid grid-cols-2 gap-6 h-[460px]">
        <AutomataGraph
          automaton={nfa}
          activeStates={activeStep ? activeStep.nfaSubstates : []}
          title="Input NFA (Active Substates Highlighted)"
        />

        {conversionResult ? (
          <AutomataGraph
            automaton={conversionResult}
            activeStates={activeStep ? [activeStep.dfaState, activeStep.nextDfaState] : []}
            title="Generated DFA State Diagram"
          />
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center space-y-3">
            <GitCompare className="w-12 h-12 text-slate-700 animate-pulse" />
            <p className="text-slate-400 font-medium text-sm">DFA Graph Not Yet Generated</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Click "Run Subset Construction" to invoke backend C++ algorithm.
            </p>
          </div>
        )}
      </div>

      {/* Conversion Steps Trace Panel */}
      <ConversionSteps
        steps={conversionSteps}
        currentStepIndex={currentStepIndex}
        onStepChange={(idx) => setCurrentStepIndex(idx)}
      />
    </div>
  );
};
