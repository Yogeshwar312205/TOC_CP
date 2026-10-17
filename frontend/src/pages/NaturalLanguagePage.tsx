import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Layers,
  GitCompare,
  ExternalLink,
  Sliders,
  Check,
} from 'lucide-react';
import { AutomataGraph } from '../components/graph/AutomataGraph';
import { apiService } from '../services/api';
import { useAutomataStore } from '../store/automataStore';
import type {
  NFA,
  DFA,
  LanguageInterpretation,
  LanguageToAutomataMetrics,
  ConversionStep,
  TableEntry,
  DFASimulationResult,
  NFASimulationResult,
} from '../types/automaton';

interface PresetItem {
  name: string;
  alphabet: string[];
  description: string;
  testStrings: string[];
  isNonRegular?: boolean;
}

const PRESETS: PresetItem[] = [
  {
    name: "Contains 'bbb'",
    alphabet: ['a', 'b'],
    description: "Strings containing three consecutive b's",
    testStrings: ['bbb', 'abbb', 'bbba', 'aabbbab', 'abab', 'bb', ''],
  },
  {
    name: "Ends with '01'",
    alphabet: ['0', '1'],
    description: "Strings over {0,1} ending in 01",
    testStrings: ['01', '101', '001', '1101', '100', '0', ''],
  },
  {
    name: "Starts with '10'",
    alphabet: ['0', '1'],
    description: "All binary strings that start with '10'",
    testStrings: ['10', '100', '10101', '11', '0', '110', ''],
  },
  {
    name: "Starts with '0'",
    alphabet: ['0', '1'],
    description: "Strings over {0,1} starting with 0",
    testStrings: ['0', '01', '000', '0101', '10', '1', ''],
  },
  {
    name: "Contains 'ab'",
    alphabet: ['a', 'b'],
    description: "Strings over {a,b} containing ab as a substring",
    testStrings: ['ab', 'aab', 'bab', 'bba', 'aa', 'b', ''],
  },
  {
    name: "Even number of 1's",
    alphabet: ['0', '1'],
    description: "Strings over {0,1} containing an even number of 1s",
    testStrings: ['', '0', '11', '101', '0110', '1', '010'],
  },
  {
    name: "Exactly two a's",
    alphabet: ['a', 'b'],
    description: "Strings over {a,b} with exactly two occurrences of a",
    testStrings: ['aa', 'baa', 'aba', 'baab', 'aaa', 'a', 'b'],
  },
  {
    name: "Non-Regular: a^n b^n",
    alphabet: ['a', 'b'],
    description: "Strings with equal number of a's and b's (a^n b^n)",
    testStrings: ['ab', 'aabb', 'aaabbb', 'aab', 'ba'],
    isNonRegular: true,
  },
];

export const NaturalLanguagePage: React.FC = () => {
  const navigate = useNavigate();
  const { loadGeneratedAutomata } = useAutomataStore();

  // Form Inputs
  const [alphabetInput, setAlphabetInput] = useState<string>('a, b');
  const [descriptionInput, setDescriptionInput] = useState<string>(
    "Strings containing three consecutive b's"
  );
  const [editableRegex, setEditableRegex] = useState<string>('');
  const [isEditingRegex, setIsEditingRegex] = useState<boolean>(false);

  // Results State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const [interpretation, setInterpretation] = useState<LanguageInterpretation | null>(null);
  const [epsilonNFA, setEpsilonNFA] = useState<NFA | null>(null);
  const [dfa, setDFA] = useState<DFA | null>(null);
  const [minimizedDFA, setMinimizedDFA] = useState<DFA | null>(null);
  const [metrics, setMetrics] = useState<LanguageToAutomataMetrics | null>(null);
  const [conversionSteps, setConversionSteps] = useState<ConversionStep[]>([]);
  const [minimizationTrace, setMinimizationTrace] = useState<TableEntry[]>([]);
  const [engineUsed, setEngineUsed] = useState<string>('');

  // UI View Layout
  const [activeViewTab, setActiveViewTab] = useState<'3way' | 'nfa' | 'dfa' | 'minimized'>('3way');

  // Simulation State
  const [testString, setTestString] = useState<string>('bbb');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [nfaSim, setNfaSim] = useState<NFASimulationResult | null>(null);
  const [dfaSim, setDfaSim] = useState<DFASimulationResult | null>(null);
  const [minDfaSim, setMinDfaSim] = useState<DFASimulationResult | null>(null);
  const [quickTestPresets, setQuickTestPresets] = useState<string[]>([
    'bbb',
    'abbb',
    'bbba',
    'aabbbab',
    'abab',
    'bb',
    '',
  ]);

  const parseAlphabet = (): string[] => {
    return Array.from(
      new Set(
        alphabetInput
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    );
  };

  const handleSelectPreset = (preset: PresetItem) => {
    setAlphabetInput(preset.alphabet.join(', '));
    setDescriptionInput(preset.description);
    setQuickTestPresets(preset.testStrings);
    if (preset.testStrings.length > 0) {
      setTestString(preset.testStrings[0]);
    }
    setErrorMessage(null);
    setWarningMessage(null);
    setIsEditingRegex(false);
  };

  const handleGenerate = async (overrideRegex?: string) => {
    const symbols = parseAlphabet();
    if (symbols.length === 0) {
      setErrorMessage('Please specify at least one alphabet symbol (e.g. a, b).');
      return;
    }

    if (!overrideRegex && !descriptionInput.trim()) {
      setErrorMessage('Please enter a natural language description.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setWarningMessage(null);
    setNfaSim(null);
    setDfaSim(null);
    setMinDfaSim(null);

    try {
      setLoadingStep(overrideRegex ? 'Validating edited regular expression...' : 'Analyzing with Gemini AI...');

      const res = await apiService.convertLanguageToAutomata(
        symbols,
        descriptionInput.trim(),
        overrideRegex
      );

      if (!res.success) {
        if (res.status === 'non_regular') {
          setWarningMessage(
            res.interpretation?.explanation ||
              'This language is non-regular and cannot be recognized by finite automata.'
          );
          setInterpretation(res.interpretation);
        } else if (res.status === 'clarification_needed') {
          setWarningMessage(
            res.interpretation?.explanation ||
              'The language description is ambiguous. Please clarify your requirements.'
          );
          setInterpretation(res.interpretation);
        } else {
          setErrorMessage(res.error || 'Failed to generate automata.');
        }
        setIsLoading(false);
        return;
      }

      setLoadingStep('Synthesizing automata representations...');

      if (res.automata && res.interpretation) {
        setInterpretation(res.interpretation);
        setEditableRegex(res.interpretation.regularExpression || '');
        setEpsilonNFA(res.automata.epsilonNFA);
        setDFA(res.automata.dfa);
        setMinimizedDFA(res.automata.minimizedDFA);
        setMetrics(res.metrics || null);
        setConversionSteps(res.traces?.conversion || []);
        setMinimizationTrace(res.traces?.minimization || []);
        setEngineUsed(res.engine || 'cpp');

        // Automatically run simulator on default test string if present
        if (testString !== undefined) {
          runSimulationOnAll(
            res.automata.epsilonNFA,
            res.automata.dfa,
            res.automata.minimizedDFA,
            testString
          );
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'An unexpected error occurred.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  // Interactive Step-by-Step Simulation State
  const [simStepIndex, setSimStepIndex] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);

  const runSimulationOnAll = async (
    targetNfa: NFA,
    targetDfa: DFA,
    targetMinDfa: DFA,
    strToTest: string
  ) => {
    setIsSimulating(true);
    setIsSimPlaying(false);
    try {
      const [nfaRes, dfaRes, minRes] = await Promise.all([
        apiService.simulateNFA(targetNfa, strToTest),
        apiService.simulateDFA(targetDfa, strToTest),
        apiService.simulateDFA(targetMinDfa, strToTest),
      ]);

      if (nfaRes.success && nfaRes.data) setNfaSim(nfaRes.data);
      if (dfaRes.success && dfaRes.data) setDfaSim(dfaRes.data);
      if (minRes.success && minRes.data) setMinDfaSim(minRes.data);
      setSimStepIndex(0);
    } catch (err: any) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const maxSimSteps = useMemo(() => {
    const nfaLen = nfaSim?.trace?.length || 0;
    const dfaLen = dfaSim?.steps?.length || 0;
    const minLen = minDfaSim?.steps?.length || 0;
    return Math.max(nfaLen, dfaLen, minLen, 1);
  }, [nfaSim, dfaSim, minDfaSim]);

  // Auto-play interval
  useEffect(() => {
    let timer: number;
    if (isSimPlaying && maxSimSteps > 1) {
      timer = window.setInterval(() => {
        setSimStepIndex((prev) => {
          if (prev >= maxSimSteps - 1) {
            setIsSimPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1100);
    }
    return () => clearInterval(timer);
  }, [isSimPlaying, maxSimSteps]);

  const handleRunSimulation = () => {
    if (!epsilonNFA || !dfa || !minimizedDFA) return;
    runSimulationOnAll(epsilonNFA, dfa, minimizedDFA, testString);
  };

  const handleLoadIntoStore = () => {
    if (!epsilonNFA || !dfa || !minimizedDFA) return;
    loadGeneratedAutomata(epsilonNFA, dfa, minimizedDFA, conversionSteps);
    navigate('/comparison');
  };

  // Determine agreement
  const allAgree =
    nfaSim && dfaSim && minDfaSim && nfaSim.accepted === dfaSim.accepted && dfaSim.accepted === minDfaSim.accepted;
  const agreementAccepted = allAgree && nfaSim?.accepted;

  // Active step-by-step states and transitions for ε-NFA
  const currentNfaStep = useMemo(() => {
    if (!nfaSim || !nfaSim.trace || nfaSim.trace.length === 0) return null;
    const idx = Math.min(simStepIndex, nfaSim.trace.length - 1);
    return nfaSim.trace[idx];
  }, [nfaSim, simStepIndex]);

  const activeNfaStates = currentNfaStep ? currentNfaStep.activeStates : [];
  const activeNfaTransitions = currentNfaStep?.transitionsTaken || [];

  // Active step-by-step states and transitions for Subset DFA
  const currentDfaStep = useMemo(() => {
    if (!dfaSim || !dfaSim.steps || dfaSim.steps.length === 0) return null;
    const idx = Math.min(simStepIndex, dfaSim.steps.length - 1);
    return dfaSim.steps[idx];
  }, [dfaSim, simStepIndex]);

  const activeDfaStates = useMemo(() => {
    if (!currentDfaStep || currentDfaStep.currentState === '∅') return [];
    return [currentDfaStep.currentState];
  }, [currentDfaStep]);

  const activeDfaTransitions = useMemo(() => {
    if (!dfaSim || simStepIndex <= 0) return [];
    const prev = dfaSim.steps[simStepIndex - 1];
    const cur = dfaSim.steps[Math.min(simStepIndex, dfaSim.steps.length - 1)];
    if (prev && cur && cur.symbolRead && cur.currentState !== '∅') {
      return [{ from: prev.currentState, symbol: cur.symbolRead, to: cur.currentState }];
    }
    return [];
  }, [dfaSim, simStepIndex]);

  // Active step-by-step states and transitions for Minimized DFA
  const currentMinDfaStep = useMemo(() => {
    if (!minDfaSim || !minDfaSim.steps || minDfaSim.steps.length === 0) return null;
    const idx = Math.min(simStepIndex, minDfaSim.steps.length - 1);
    return minDfaSim.steps[idx];
  }, [minDfaSim, simStepIndex]);

  const activeMinDfaStates = useMemo(() => {
    if (!currentMinDfaStep || currentMinDfaStep.currentState === '∅') return [];
    return [currentMinDfaStep.currentState];
  }, [currentMinDfaStep]);

  const activeMinDfaTransitions = useMemo(() => {
    if (!minDfaSim || simStepIndex <= 0) return [];
    const prev = minDfaSim.steps[simStepIndex - 1];
    const cur = minDfaSim.steps[Math.min(simStepIndex, minDfaSim.steps.length - 1)];
    if (prev && cur && cur.symbolRead && cur.currentState !== '∅') {
      return [{ from: prev.currentState, symbol: cur.symbolRead, to: cur.currentState }];
    }
    return [];
  }, [minDfaSim, simStepIndex]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Bot className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent">
              AI Natural Language to Automata
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30">
              Gemini Powered
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Specify an alphabet and describe your language in natural English. AutomataLab synthesizes a formal regular expression, builds the Thompson ε-NFA, converts to DFA via subset construction, and produces the minimal DFA.
          </p>
        </div>

        {engineUsed && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Engine:</span>
            <span className="font-bold text-cyan-300 uppercase">{engineUsed === 'cpp' ? 'C++17 Native Engine' : 'Node.js Engine'}</span>
          </div>
        )}
      </div>

      {/* Preset Buttons Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Benchmark Presets:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleSelectPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                preset.isNonRegular
                  ? 'bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-900/50'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300 hover:bg-cyan-950/20'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Input Configuration Panel */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 bg-slate-950/60 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Alphabet Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Alphabet (Σ)</span>
              <span className="text-[10px] text-slate-500">Comma separated</span>
            </label>
            <input
              type="text"
              value={alphabetInput}
              onChange={(e) => setAlphabetInput(e.target.value)}
              placeholder="e.g. a, b or 0, 1"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Natural Language Description */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Language Description (English)</span>
              <span className="text-[10px] text-slate-500">Describe conditions, prefixes, substrings, parity</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="e.g. Strings containing three consecutive b's"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              <button
                onClick={() => handleGenerate()}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all disabled:opacity-50 shrink-0"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Automata</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        {isLoading && (
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs flex items-center gap-3 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-cyan-400" />
            <span className="font-mono">{loadingStep}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Generation Error</p>
              <p className="font-mono text-[11px] text-rose-300">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Non-Regular or Clarification Warning */}
        {warningMessage && (
          <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">
                {interpretation?.status === 'non_regular'
                  ? 'Non-Regular Language Detected'
                  : 'Clarification Needed'}
              </p>
              <p className="text-[12px] text-amber-300">{warningMessage}</p>
              {interpretation?.assumptions && interpretation.assumptions.length > 0 && (
                <ul className="list-disc list-inside text-[11px] text-amber-300/80 pt-1">
                  {interpretation.assumptions.map((assump, idx) => (
                    <li key={idx}>{assump}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interpretation & Regex Edit Panel */}
      {interpretation && interpretation.status === 'success' && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-950/50 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-slate-200">AI Interpretation:</span>
              <span className="text-xs text-slate-300 italic font-serif">
                "{interpretation.normalizedDescription}"
              </span>
            </div>

            <div className="flex items-center gap-3">
              {interpretation.confidence !== undefined && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  <span>Confidence:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    {(interpretation.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              <button
                onClick={handleLoadIntoStore}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Open in Comparison & Simulation Labs"
              >
                <span>Open in Labs</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Regex Display & Inline Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <span>Formal Regular Expression:</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Precedence: Star (*) &gt; Implicit Concat &gt; Union (+)
                </span>
              </label>

              <button
                onClick={() => setIsEditingRegex(!isEditingRegex)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
              >
                <Sliders className="w-3 h-3" />
                <span>{isEditingRegex ? 'Lock Expression' : 'Edit Expression'}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={editableRegex}
                disabled={!isEditingRegex}
                onChange={(e) => setEditableRegex(e.target.value)}
                className={`flex-1 px-4 py-2.5 rounded-xl font-mono text-sm tracking-wide transition-all ${
                  isEditingRegex
                    ? 'bg-slate-900 border border-cyan-500/80 text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-500'
                    : 'bg-slate-900/50 border border-slate-800 text-cyan-300 cursor-default'
                }`}
              />

              {isEditingRegex && (
                <button
                  onClick={() => handleGenerate(editableRegex)}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate from Expression</span>
                </button>
              )}
            </div>
          </div>

          {/* Explanation and Assumptions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
              <span className="font-semibold text-slate-300">Mathematical Rationale:</span>
              <p className="text-slate-400 leading-relaxed">{interpretation.explanation}</p>
            </div>

            {interpretation.assumptions && interpretation.assumptions.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <span className="font-semibold text-slate-300">Model Assumptions:</span>
                <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                  {interpretation.assumptions.map((assump, idx) => (
                    <li key={idx}>{assump}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-400 uppercase">1. Thompson ε-NFA</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <div className="text-xl font-extrabold text-slate-100">{metrics.epsilonNFAStates} States</div>
            <div className="text-[11px] text-slate-400">{metrics.epsilonNFATransitions || 0} Transitions</div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-sky-500/30 bg-sky-950/20 space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-400 uppercase">2. Subset DFA</span>
              <span className="w-2 h-2 rounded-full bg-sky-400" />
            </div>
            <div className="text-xl font-extrabold text-slate-100">{metrics.dfaStates} States</div>
            <div className="text-[11px] text-slate-400">{metrics.dfaTransitions || 0} Transitions</div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-400 uppercase">3. Minimized DFA</span>
              <span className="w-2 h-2 rounded-full bg-purple-400" />
            </div>
            <div className="text-xl font-extrabold text-slate-100">{metrics.minimizedDFAStates} States</div>
            <div className="text-[11px] text-slate-400">{metrics.minimizedDFATransitions || 0} Transitions</div>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 uppercase">State Reduction</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="text-xl font-extrabold text-emerald-300">
              {metrics.stateReductionPercentage.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-400">
              {metrics.dfaStates} ➔ {metrics.minimizedDFAStates} states
            </div>
          </div>
        </div>
      )}

      {/* String Simulator Panel */}
      {epsilonNFA && dfa && minimizedDFA && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-950/70 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400" />
                <span>Synchronized Multi-Automata Simulation Player</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Step-by-step execution across ε-NFA, Subset DFA, and Minimized DFA with synchronized real-time state and transition animations.
              </p>
            </div>

            {/* Consistency Badge */}
            {nfaSim && dfaSim && minDfaSim && (
              <div
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  allAgree
                    ? agreementAccepted
                      ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 shadow-lg shadow-emerald-950/50'
                      : 'bg-rose-950/70 border-rose-500/60 text-rose-300 shadow-lg shadow-rose-950/50'
                    : 'bg-amber-950/70 border-amber-500/60 text-amber-300'
                }`}
              >
                {allAgree ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>
                      All 3 Automata Agree: {agreementAccepted ? 'ACCEPTED' : 'REJECTED'}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Automata Disagreement Detected</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Test Input & Quick Chips */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={testString}
                onChange={(e) => setTestString(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunSimulation()}
                placeholder="Enter test string (or leave empty for ε)"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Simulate String</span>
              </button>
            </div>

            {/* Quick Test Chips */}
            {quickTestPresets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Quick Test:</span>
                {quickTestPresets.map((str, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTestString(str);
                      runSimulationOnAll(epsilonNFA, dfa, minimizedDFA, str);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                      testString === str
                        ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 shadow-md shadow-cyan-950/40 font-bold'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {str === '' ? 'ε (empty)' : str}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Step-by-Step Playback Controller */}
          {nfaSim && dfaSim && minDfaSim && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
              {/* Input Character Tape */}
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider shrink-0">
                  Input Tape:
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  {/* Step 0: Initial Epsilon State */}
                  <div
                    onClick={() => {
                      setSimStepIndex(0);
                      setIsSimPlaying(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-all border ${
                      simStepIndex === 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-md shadow-amber-500/30 font-bold scale-105'
                        : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    START (ε)
                  </div>

                  {/* Character Tape Cells */}
                  {testString.split('').map((char, cIdx) => {
                    const stepNumber = cIdx + 1;
                    const isCurrent = simStepIndex === stepNumber;
                    const isPast = simStepIndex > stepNumber;
                    return (
                      <div
                        key={cIdx}
                        onClick={() => {
                          setSimStepIndex(stepNumber);
                          setIsSimPlaying(false);
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer transition-all border ${
                          isCurrent
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-110'
                            : isPast
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {char}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Player Transport Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSimStepIndex(0);
                      setIsSimPlaying(false);
                    }}
                    title="Reset to Step 0"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSimStepIndex((prev) => Math.max(0, prev - 1));
                      setIsSimPlaying(false);
                    }}
                    disabled={simStepIndex <= 0}
                    title="Previous Step"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsSimPlaying((prev) => !prev)}
                    title={isSimPlaying ? 'Pause Simulation' : 'Play Simulation'}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    {isSimPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Play Trace</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSimStepIndex((prev) => Math.min(maxSimSteps - 1, prev + 1));
                      setIsSimPlaying(false);
                    }}
                    disabled={simStepIndex >= maxSimSteps - 1}
                    title="Next Step"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSimStepIndex(maxSimSteps - 1);
                      setIsSimPlaying(false);
                    }}
                    title="Jump to End"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Step Slider & Counter */}
                <div className="flex items-center gap-3 font-mono text-xs text-slate-300">
                  <span className="text-slate-400">Step:</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, maxSimSteps - 1)}
                    value={simStepIndex}
                    onChange={(e) => {
                      setSimStepIndex(Number(e.target.value));
                      setIsSimPlaying(false);
                    }}
                    className="w-32 sm:w-48 accent-amber-400 cursor-pointer"
                  />
                  <span className="font-bold text-amber-300 min-w-[50px]">
                    {simStepIndex} / {Math.max(0, maxSimSteps - 1)}
                  </span>
                </div>
              </div>

              {/* 3 Synchronized Step Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {/* NFA Step */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-cyan-500/30 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-bold uppercase">1. Thompson ε-NFA</span>
                    <span className="text-[10px] text-slate-400">
                      Step {Math.min(simStepIndex, (nfaSim.trace?.length || 1) - 1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Active States:{' '}
                    <span className="text-amber-300 font-bold">
                      {activeNfaStates.length > 0 ? `{${activeNfaStates.join(', ')}}` : '∅'}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate" title={currentNfaStep?.description || ''}>
                    {currentNfaStep?.description || 'Start state initial closure'}
                  </p>
                </div>

                {/* DFA Step */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-sky-500/30 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sky-400 font-bold uppercase">2. Subset DFA</span>
                    <span className="text-[10px] text-slate-400">
                      Step {Math.min(simStepIndex, (dfaSim.steps?.length || 1) - 1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Current State:{' '}
                    <span className="text-sky-300 font-bold">{currentDfaStep?.currentState || 'None'}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate" title={currentDfaStep?.description || ''}>
                    {currentDfaStep?.description || 'Start state'}
                  </p>
                </div>

                {/* Minimized DFA Step */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-purple-500/30 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-400 font-bold uppercase">3. Minimized DFA</span>
                    <span className="text-[10px] text-slate-400">
                      Step {Math.min(simStepIndex, (minDfaSim.steps?.length || 1) - 1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Current State:{' '}
                    <span className="text-purple-300 font-bold">{currentMinDfaStep?.currentState || 'None'}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 truncate" title={currentMinDfaStep?.description || ''}>
                    {currentMinDfaStep?.description || 'Start state'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visualizations Section */}
      {epsilonNFA && dfa && minimizedDFA && (
        <div className="space-y-3">
          {/* View Tab Selector */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveViewTab('3way')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeViewTab === '3way'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Side-by-Side (3-Way)
              </button>
              <button
                onClick={() => setActiveViewTab('nfa')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeViewTab === 'nfa'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. Thompson ε-NFA
              </button>
              <button
                onClick={() => setActiveViewTab('dfa')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeViewTab === 'dfa'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2. Subset DFA
              </button>
              <button
                onClick={() => setActiveViewTab('minimized')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeViewTab === 'minimized'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                3. Minimized DFA
              </button>
            </div>
          </div>

          {/* Graph Visualizations Container */}
          {activeViewTab === '3way' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[550px]">
              <div className="h-full rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-xl">
                <AutomataGraph
                  automaton={epsilonNFA}
                  activeStates={activeNfaStates}
                  activeTransitions={activeNfaTransitions}
                  title="1. Thompson ε-NFA"
                />
              </div>
              <div className="h-full rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-xl">
                <AutomataGraph
                  automaton={dfa}
                  activeStates={activeDfaStates}
                  activeTransitions={activeDfaTransitions}
                  title="2. Converted DFA"
                />
              </div>
              <div className="h-full rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-xl">
                <AutomataGraph
                  automaton={minimizedDFA}
                  activeStates={activeMinDfaStates}
                  activeTransitions={activeMinDfaTransitions}
                  title="3. Minimized DFA"
                />
              </div>
            </div>
          ) : activeViewTab === 'nfa' ? (
            <div className="h-[600px] rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-xl">
              <AutomataGraph
                automaton={epsilonNFA}
                activeStates={activeNfaStates}
                activeTransitions={activeNfaTransitions}
                title="Thompson ε-NFA"
              />
            </div>
          ) : activeViewTab === 'dfa' ? (
            <div className="h-[600px] rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-xl">
              <AutomataGraph
                automaton={dfa}
                activeStates={activeDfaStates}
                activeTransitions={activeDfaTransitions}
                title="Subset Construction DFA"
              />
            </div>
          ) : (
            <div className="h-[600px] rounded-2xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-xl">
              <AutomataGraph
                automaton={minimizedDFA}
                activeStates={activeMinDfaStates}
                activeTransitions={activeMinDfaTransitions}
                title="Myhill-Nerode Minimized DFA"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
