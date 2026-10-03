import React, { useState } from 'react';
import { useAutomataStore } from '../store/automataStore';
import { StringSimulator } from '../components/simulator/StringSimulator';
import { AutomataGraph } from '../components/graph/AutomataGraph';

export const SimulatorPage: React.FC = () => {
  const { nfa, dfa, minimizationResult } = useAutomataStore();

  const [activeStates, setActiveStates] = useState<string[]>([]);
  const [activeTransitions, setActiveTransitions] = useState<
    { from: string; symbol: string; to: string }[]
  >([]);

  const handleStepHighlight = (
    states: string[],
    transitions: { from: string; symbol: string; to: string }[]
  ) => {
    setActiveStates(states);
    setActiveTransitions(transitions);
  };

  const activeGraphAutomaton = minimizationResult?.minimizedDfa || dfa || nfa;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
          Interactive String Simulation Engine
        </h2>
        <p className="text-xs text-slate-400">
          Trace string execution through NFA, DFA, or Minimized DFA with real-time graph state highlights.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5">
          <StringSimulator onStepHighlight={handleStepHighlight} />
        </div>

        <div className="col-span-7 h-[680px]">
          <AutomataGraph
            automaton={activeGraphAutomaton}
            activeStates={activeStates}
            activeTransitions={activeTransitions}
            title="Interactive Simulation State Path Highlight"
          />
        </div>
      </div>
    </div>
  );
};
