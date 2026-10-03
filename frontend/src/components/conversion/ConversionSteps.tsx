import React from 'react';
import { useAutomataStore } from '../../store/automataStore';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { ConversionStep } from '../../types/automaton';

interface ConversionStepsProps {
  steps: ConversionStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
}

export const ConversionSteps: React.FC<ConversionStepsProps> = ({
  steps,
  currentStepIndex,
  onStepChange,
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false);

  React.useEffect(() => {
    let timer: number;
    if (isPlaying) {
      timer = window.setInterval(() => {
        onStepChange(
          currentStepIndex >= steps.length - 1 ? 0 : currentStepIndex + 1
        );
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentStepIndex, steps.length, onStepChange]);

  if (!steps || steps.length === 0) {
    return (
      <div className="glass-panel p-8 rounded-2xl text-center space-y-3">
        <p className="text-slate-400">No conversion steps available yet.</p>
        <p className="text-xs text-slate-500">
          Click "Convert NFA to DFA" above to trigger C++ subset construction algorithm.
        </p>
      </div>
    );
  }

  const step = steps[currentStepIndex] || steps[0];

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-6">
      {/* Control Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
            <span>Subset Construction Execution Trace</span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/40 text-xs font-mono">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          </h3>
        </div>

        {/* Step Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStepChange(0)}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
            title="Reset to Step 1"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Auto Play
              </>
            )}
          </button>
          <button
            onClick={() => onStepChange(Math.min(steps.length - 1, currentStepIndex + 1))}
            disabled={currentStepIndex === steps.length - 1}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-cyan-400 to-purple-500 h-full transition-all duration-300"
          style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Step Detail Card */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Processing DFA State:</span>
          <span className="text-cyan-400 font-bold text-sm bg-cyan-950/80 px-2.5 py-1 rounded-md border border-cyan-800/60">
            {step.dfaState}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">NFA Substates Subset:</span>
          <span className="text-purple-300 font-semibold bg-purple-950/60 px-2.5 py-1 rounded-md border border-purple-800/40">
            {`{ ${step.nfaSubstates.join(', ')} }`}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Input Symbol Evaluated:</span>
          <span className="text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
            '{step.symbol}'
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Resulting Next DFA State:</span>
          <span className="text-emerald-300 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/40">
            {step.nextDfaState}
          </span>
        </div>

        {/* Narrative Description */}
        <div className="pt-2 border-t border-slate-800/60 text-slate-300 leading-relaxed font-sans text-xs">
          <p className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>{step.description}</span>
          </p>
        </div>
      </div>
    </div>
  );
};
