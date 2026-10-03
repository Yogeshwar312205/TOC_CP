#pragma once
#include "Automaton.hpp"
#include <string>
#include <vector>

// ─────────────────────────────────────────────────────────────────────────────
// Conversion step — one row of the subset-construction table
// ─────────────────────────────────────────────────────────────────────────────
struct ConversionStep {
    int       stepIndex;
    StateSet  currentDfaStateSet;   // the NFA state set for current DFA state
    State     currentDfaStateName;  // e.g. "A", "B"
    Symbol    symbol;
    StateSet  moveResult;           // move(currentDfaStateSet, symbol)
    StateSet  epsilonClosureResult; // ε-closure(moveResult)
    State     nextDfaStateName;     // label for the resulting DFA state
    bool      isNewState;
    std::string description;        // human-readable summary of this step
};

// ─────────────────────────────────────────────────────────────────────────────
// Full NFA→DFA conversion result
// ─────────────────────────────────────────────────────────────────────────────
struct ConversionResult {
    DFA                        dfa;
    std::vector<ConversionStep> steps;
    bool                        success;
    std::string                 errorMessage;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/// Compute ε-closure of a single state
StateSet epsilonClosure(const NFA& nfa, const State& state);

/// Compute ε-closure of a set of states (union of individual closures)
StateSet epsilonClosure(const NFA& nfa, const StateSet& states);

/// Compute move(states, symbol): all states reachable from 'states' via 'symbol'
StateSet move(const NFA& nfa, const StateSet& states, const Symbol& symbol);

/// Run the full subset construction algorithm, recording every step
ConversionResult nfaToDfa(const NFA& nfa);
