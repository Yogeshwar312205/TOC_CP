// ─────────────────────────────────────────────────────────────────────────────
// Core automaton type definitions — mirrors the C++ backend structures
// ─────────────────────────────────────────────────────────────────────────────

export interface Transition {
  from: string;
  symbol: string; // "ε" for epsilon
  to: string | string[];
}

export interface NFA {
  states: string[];
  alphabet: string[];
  startState: string;
  acceptStates: string[];
  finalStates?: string[];
  transitions: Transition[];
}

export interface DFA {
  states: string[];
  alphabet: string[];
  startState: string;
  acceptStates: string[];
  finalStates?: string[];
  transitions: { from: string; symbol: string; to: string }[];
  stateMapping?: Record<string, string[]>; // DFA label → original NFA states
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion
// ─────────────────────────────────────────────────────────────────────────────
export interface ConversionStep {
  stepIndex: number;
  dfaState: string;
  nfaSubstates: string[];
  symbol: string;
  nextDfaState: string;
  isNewState: boolean;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimization
// ─────────────────────────────────────────────────────────────────────────────
export interface TableEntry {
  stateA: string;
  stateB: string;
  distinguishable: boolean;
  stepMarked: number;
  reasonSymbol: string;
}

export interface EquivalenceClass {
  states: string[];
  representative: string;
}

export interface MinimizationResult {
  originalStates: string[];
  unreachableStates: string[];
  table: TableEntry[];
  equivalenceClasses: EquivalenceClass[];
  stateMapping: Record<string, string>;
  minimizedDfa: DFA;
  stats: {
    originalStateCount: number;
    minimizedStateCount: number;
    reductionPercentage: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation
// ─────────────────────────────────────────────────────────────────────────────
export interface DFASimulationStep {
  stepIndex: number;
  currentState: string;
  symbolRead: string;
  nextState: string;
  remainingString: string;
  description: string;
}

export interface DFASimulationResult {
  accepted: boolean;
  finalState: string;
  rejectionReason: string;
  steps: DFASimulationStep[];
}

export interface NFASimulationStep {
  stepIndex: number;
  activeStates: string[];
  symbolRead: string;
  remainingString: string;
  transitionsTaken: { from: string; symbol: string; to: string }[];
  description: string;
}

export interface NFASimulationResult {
  accepted: boolean;
  trace: NFASimulationStep[];
  rejectionReason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────
export interface ValidationError {
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  errors: ValidationError[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Examples
// ─────────────────────────────────────────────────────────────────────────────
export interface AutomataExample {
  id: string;
  name: string;
  description: string;
  category: string;
  nfa: NFA;
}
