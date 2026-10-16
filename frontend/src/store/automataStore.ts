import { create } from 'zustand';
import type {
  NFA,
  DFA,
  ConversionStep,
  MinimizationResult,
  DFASimulationResult,
  NFASimulationResult,
  ValidationResult,
  AutomataExample,
} from '../types/automaton';

interface AutomataState {
  // Active NFA
  nfa: NFA;
  setNfa: (nfa: NFA | ((prev: NFA) => NFA)) => void;

  // Active DFA (converted or created)
  dfa: DFA | null;
  setDfa: (dfa: DFA | null) => void;

  // Conversion process state
  conversionSteps: ConversionStep[];
  setConversionSteps: (steps: ConversionStep[]) => void;
  conversionResult: DFA | null;
  setConversionResult: (dfa: DFA | null) => void;
  currentStepIndex: number;
  setCurrentStepIndex: (index: number | ((prev: number) => number)) => void;

  // Minimization result
  minimizationResult: MinimizationResult | null;
  setMinimizationResult: (result: MinimizationResult | null) => void;

  // Simulation state
  nfaSimResult: NFASimulationResult | null;
  setNfaSimResult: (result: NFASimulationResult | null) => void;
  dfaSimResult: DFASimulationResult | null;
  setDfaSimResult: (result: DFASimulationResult | null) => void;
  minDfaSimResult: DFASimulationResult | null;
  setMinDfaSimResult: (result: DFASimulationResult | null) => void;

  // Validation
  validation: ValidationResult | null;
  setValidation: (v: ValidationResult | null) => void;

  // UI / Status flags
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (err: string | null) => void;

  // Helper actions
  resetStore: () => void;
  loadExample: (example: AutomataExample) => void;
  loadGeneratedAutomata: (nfa: NFA, dfa: DFA, minDfa: DFA, steps?: ConversionStep[]) => void;
}

const DEFAULT_NFA: NFA = {
  states: ['q0', 'q1', 'q2'],
  alphabet: ['0', '1'],
  transitions: [
    { from: 'q0', symbol: '0', to: 'q0' },
    { from: 'q0', symbol: '1', to: 'q1' },
    { from: 'q1', symbol: '0', to: 'q2' },
    { from: 'q1', symbol: 'ε', to: 'q0' },
    { from: 'q2', symbol: '1', to: 'q2' },
  ],
  startState: 'q0',
  acceptStates: ['q2'],
};

export const useAutomataStore = create<AutomataState>((set) => ({
  nfa: DEFAULT_NFA,
  setNfa: (updater) =>
    set((state) => ({
      nfa: typeof updater === 'function' ? updater(state.nfa) : updater,
      dfa: null,
      conversionSteps: [],
      conversionResult: null,
      currentStepIndex: 0,
      minimizationResult: null,
      nfaSimResult: null,
      dfaSimResult: null,
      minDfaSimResult: null,
      validation: null,
    })),

  dfa: null,
  setDfa: (dfa) => set({ dfa }),

  conversionSteps: [],
  setConversionSteps: (steps) => set({ conversionSteps: steps }),
  conversionResult: null,
  setConversionResult: (dfa) => set({ conversionResult: dfa }),
  currentStepIndex: 0,
  setCurrentStepIndex: (updater) =>
    set((state) => ({
      currentStepIndex:
        typeof updater === 'function'
          ? updater(state.currentStepIndex)
          : updater,
    })),

  minimizationResult: null,
  setMinimizationResult: (result) => set({ minimizationResult: result }),

  nfaSimResult: null,
  setNfaSimResult: (result) => set({ nfaSimResult: result }),
  dfaSimResult: null,
  setDfaSimResult: (result) => set({ dfaSimResult: result }),
  minDfaSimResult: null,
  setMinDfaSimResult: (result) => set({ minDfaSimResult: result }),

  validation: null,
  setValidation: (v) => set({ validation: v }),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (err) => set({ error: err }),

  resetStore: () =>
    set({
      nfa: DEFAULT_NFA,
      dfa: null,
      conversionSteps: [],
      conversionResult: null,
      currentStepIndex: 0,
      minimizationResult: null,
      nfaSimResult: null,
      dfaSimResult: null,
      minDfaSimResult: null,
      validation: null,
      error: null,
    }),

  loadExample: (example: AutomataExample) =>
    set({
      nfa: example.nfa,
      dfa: null,
      conversionSteps: [],
      conversionResult: null,
      currentStepIndex: 0,
      minimizationResult: null,
      nfaSimResult: null,
      dfaSimResult: null,
      minDfaSimResult: null,
      error: null,
    }),

  loadGeneratedAutomata: (nfa, dfa, minDfa, steps = []) =>
    set({
      nfa,
      dfa,
      conversionResult: dfa,
      conversionSteps: steps,
      currentStepIndex: steps.length > 0 ? steps.length - 1 : 0,
      minimizationResult: {
        originalStates: dfa.states,
        unreachableStates: [],
        table: [],
        equivalenceClasses: [],
        stateMapping: {},
        minimizedDfa: minDfa,
        stats: {
          originalStateCount: dfa.states.length,
          minimizedStateCount: minDfa.states.length,
          reductionPercentage:
            dfa.states.length > 0
              ? Math.max(0, ((dfa.states.length - minDfa.states.length) / dfa.states.length) * 100)
              : 0,
        },
      },
      nfaSimResult: null,
      dfaSimResult: null,
      minDfaSimResult: null,
      error: null,
    }),
}));

