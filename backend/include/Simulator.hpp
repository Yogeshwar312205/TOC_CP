#pragma once
#include "Automaton.hpp"
#include <string>
#include <vector>

// ─────────────────────────────────────────────────────────────────────────────
// One step in a DFA simulation
// ─────────────────────────────────────────────────────────────────────────────
struct DFASimulationStep {
    int         stepIndex;
    State       currentState;
    Symbol      symbol;        // symbol consumed (empty string for start/end pseudo-steps)
    State       nextState;
    bool        transitionExists;
    std::string description;
};

// ─────────────────────────────────────────────────────────────────────────────
// DFA simulation result
// ─────────────────────────────────────────────────────────────────────────────
struct DFASimulationResult {
    bool                          accepted;
    State                         finalState;
    std::vector<DFASimulationStep> steps;
    std::string                   rejectionReason; // empty if accepted
    bool                          success;         // false only for structural errors
    std::string                   errorMessage;
};

// ─────────────────────────────────────────────────────────────────────────────
// One step in an NFA simulation (a set of current states at each point)
// ─────────────────────────────────────────────────────────────────────────────
struct NFASimulationStep {
    int         stepIndex;
    StateSet    currentStates;    // state set before consuming symbol
    Symbol      symbol;
    StateSet    moveResult;
    StateSet    epsilonClosed;    // ε-closure(moveResult)
    std::string description;
};

// ─────────────────────────────────────────────────────────────────────────────
// NFA simulation result
// ─────────────────────────────────────────────────────────────────────────────
struct NFASimulationResult {
    bool                          accepted;
    StateSet                      finalStateSet;
    std::vector<NFASimulationStep> steps;
    std::string                   rejectionReason;
    bool                          success;
    std::string                   errorMessage;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
DFASimulationResult simulateDfa(const DFA& dfa, const std::string& input);
NFASimulationResult simulateNfa(const NFA& nfa, const std::string& input);
