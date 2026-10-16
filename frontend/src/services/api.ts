import axios from 'axios';
import type {
  NFA,
  DFA,
  ConversionStep,
  MinimizationResult,
  DFASimulationResult,
  NFASimulationResult,
  ValidationResult,
  AutomataExample,
  NFASimulationStep,
  DFASimulationStep,
  TableEntry,
  EquivalenceClass,
  LanguageToAutomataResponse,
} from '../types/automaton';
import type { ApiResponse } from '../types/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to normalize NFA payload to backend format
const formatNFAForBackend = (nfa: NFA) => {
  return {
    states: nfa.states,
    alphabet: nfa.alphabet,
    startState: nfa.startState,
    finalStates: nfa.acceptStates || nfa.finalStates || [],
    transitions: nfa.transitions.map((tr) => ({
      from: tr.from,
      symbol: tr.symbol,
      to: Array.isArray(tr.to) ? tr.to : [tr.to],
    })),
  };
};

export const apiService = {
  checkHealth: async (): Promise<ApiResponse<{ status: string; version: string }>> => {
    const res = await api.get('/health');
    return res.data;
  },

  validateNFA: async (nfa: NFA): Promise<ApiResponse<ValidationResult>> => {
    const res = await api.post('/validate', formatNFAForBackend(nfa));
    return res.data;
  },

  convertNfaToDfa: async (
    nfa: NFA
  ): Promise<ApiResponse<{ dfa: DFA; steps: ConversionStep[]; nfa: NFA }>> => {
    const res = await api.post('/convert', formatNFAForBackend(nfa));
    if (res.data.success && res.data.data) {
      const data = res.data.data;
      const dfaData: DFA = data.dfa;
      if (dfaData) {
        if (!dfaData.acceptStates) {
          dfaData.acceptStates = dfaData.finalStates || [];
        }
        if (!dfaData.finalStates) {
          dfaData.finalStates = dfaData.acceptStates || [];
        }
      }

      // Normalize steps format whether from Node server or C++ Crow server
      const rawSteps: any[] = data.steps || [];
      const normalizedSteps: ConversionStep[] = rawSteps.map((s: any, idx: number) => ({
        stepIndex: s.stepIndex !== undefined ? s.stepIndex : idx,
        dfaState: s.dfaState || s.currentDfaStateName || '',
        nfaSubstates: s.nfaSubstates || s.currentDfaStateSet || [],
        symbol: s.symbol || '',
        nextDfaState: s.nextDfaState || s.nextDfaStateName || '',
        isNewState: Boolean(s.isNewState),
        description: s.description || '',
      }));

      return {
        success: true,
        data: {
          dfa: dfaData,
          steps: normalizedSteps,
          nfa: data.nfa || nfa,
        },
      };
    }
    return res.data;
  },

  minimizeDFA: async (dfa: DFA): Promise<ApiResponse<MinimizationResult>> => {
    const payload = {
      states: dfa.states,
      alphabet: dfa.alphabet,
      startState: dfa.startState,
      finalStates: dfa.acceptStates || dfa.finalStates || [],
      transitions: dfa.transitions,
    };
    const res = await api.post('/minimize', payload);
    if (res.data.success && res.data.data) {
      const data = res.data.data;
      const minDfa: DFA = data.minimizedDfa;
      if (minDfa) {
        if (!minDfa.acceptStates) minDfa.acceptStates = minDfa.finalStates || [];
        if (!minDfa.finalStates) minDfa.finalStates = minDfa.acceptStates || [];
      }

      const origStates = data.originalStates || (data.originalDfa ? data.originalDfa.states : dfa.states);
      const unreachStates = data.unreachableStates || [];
      const rawTable = data.table || data.finalTable || data.initialTable || [];

      const table: TableEntry[] = rawTable.map((e: any) => ({
        stateA: e.stateA,
        stateB: e.stateB,
        distinguishable: e.distinguishable !== undefined ? e.distinguishable : Boolean(e.distinguished),
        stepMarked: e.stepMarked !== undefined ? e.stepMarked : (e.markedAtIteration !== undefined ? e.markedAtIteration : 0),
        reasonSymbol: e.reasonSymbol || e.distinguishingSymbol || e.reason || '',
      }));

      const rawClasses = data.equivalenceClasses || data.equivalenceGroups || [];
      const equivalenceClasses: EquivalenceClass[] = rawClasses.map((g: any) => ({
        states: g.states,
        representative: g.representative,
      }));

      const stateMapping: Record<string, string> = data.stateMapping || {};
      if (Object.keys(stateMapping).length === 0 && equivalenceClasses.length > 0) {
        equivalenceClasses.forEach((eq) => {
          eq.states.forEach((st) => {
            stateMapping[st] = eq.representative;
          });
        });
      }

      const origCount = origStates.length;
      const minCount = minDfa ? minDfa.states.length : origCount;
      const stats = data.stats || {
        originalStateCount: origCount,
        minimizedStateCount: minCount,
        reductionPercentage: origCount > 0 ? Math.max(0, ((origCount - minCount) / origCount) * 100) : 0,
      };

      return {
        success: true,
        data: {
          originalStates: origStates,
          unreachableStates: unreachStates,
          table,
          equivalenceClasses,
          stateMapping,
          minimizedDfa: minDfa,
          stats,
        },
      };
    }
    return res.data;
  },

  simulateDFA: async (
    dfa: DFA,
    inputString: string
  ): Promise<ApiResponse<DFASimulationResult>> => {
    const payload = {
      dfa: {
        states: dfa.states,
        alphabet: dfa.alphabet,
        startState: dfa.startState,
        finalStates: dfa.acceptStates || dfa.finalStates || [],
        transitions: dfa.transitions,
      },
      input: inputString,
    };
    const res = await api.post('/simulate', payload);
    if (res.data.success && res.data.data) {
      const data = res.data.data;
      const rawSteps: any[] = data.steps || [];
      const steps: DFASimulationStep[] = rawSteps.map((st: any, idx: number) => ({
        stepIndex: st.stepIndex !== undefined ? st.stepIndex : idx,
        currentState: st.currentState || '',
        symbolRead: st.symbolRead !== undefined ? st.symbolRead : (st.symbol !== undefined ? st.symbol : (idx === 0 ? '' : inputString[idx - 1] || '')),
        nextState: st.nextState || st.currentState || '',
        remainingString: st.remainingString !== undefined ? st.remainingString : inputString.slice(idx),
        description: st.description || '',
      }));

      return {
        success: true,
        data: {
          accepted: Boolean(data.accepted),
          finalState: data.finalState || '',
          rejectionReason: data.rejectionReason || (data.accepted ? '' : 'String rejected'),
          steps,
        },
      };
    }
    return res.data;
  },

  simulateNFA: async (
    nfa: NFA,
    inputString: string
  ): Promise<ApiResponse<NFASimulationResult>> => {
    const payload = {
      nfa: formatNFAForBackend(nfa),
      input: inputString,
    };
    const res = await api.post('/nfa-simulate', payload);
    if (res.data.success && res.data.data) {
      const data = res.data.data;
      const rawTrace: any[] = data.trace || data.steps || [];
      const trace: NFASimulationStep[] = rawTrace.map((st: any, idx: number) => {
        const activeStates: string[] = st.activeStates || st.currentStates || [];
        const symbolRead: string = st.symbolRead !== undefined ? st.symbolRead : (st.symbol !== undefined ? st.symbol : (idx === 0 ? '' : inputString[idx - 1] || ''));
        const remainingString: string = st.remainingString !== undefined ? st.remainingString : inputString.slice(idx);

        let transitionsTaken: { from: string; symbol: string; to: string }[] = st.transitionsTaken || [];
        if (transitionsTaken.length === 0 && idx > 0 && rawTrace[idx - 1]) {
          const prevStates: string[] = rawTrace[idx - 1].activeStates || rawTrace[idx - 1].currentStates || [];
          nfa.transitions.forEach((tr) => {
            const dests = Array.isArray(tr.to) ? tr.to : [tr.to];
            if (prevStates.includes(tr.from) && tr.symbol === symbolRead) {
              dests.forEach((d) => {
                if (activeStates.includes(d)) {
                  transitionsTaken.push({ from: tr.from, symbol: tr.symbol, to: d });
                }
              });
            }
          });
        }

        return {
          stepIndex: st.stepIndex !== undefined ? st.stepIndex : idx,
          activeStates,
          symbolRead,
          remainingString,
          transitionsTaken,
          description: st.description || '',
        };
      });

      return {
        success: true,
        data: {
          accepted: Boolean(data.accepted),
          trace,
          rejectionReason: data.rejectionReason || (data.accepted ? '' : 'NFA rejected string'),
        },
      };
    }
    return res.data;
  },

  getExamples: async (): Promise<ApiResponse<{ examples: AutomataExample[] }>> => {
    const res = await api.get('/examples');
    return res.data;
  },

  convertLanguageToAutomata: async (
    alphabet: string[],
    description: string,
    regexOverride?: string
  ): Promise<LanguageToAutomataResponse> => {
    const res = await api.post('/language-to-automata', {
      alphabet,
      description,
      regexOverride,
    });
    return res.data;
  },
};

