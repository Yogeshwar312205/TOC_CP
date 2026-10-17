#pragma once
#include "Automaton.hpp"
#include <string>
#include <vector>
#include <map>

// ─────────────────────────────────────────────────────────────────────────────
// A single entry in the distinguishability table
// ─────────────────────────────────────────────────────────────────────────────
struct TableEntry {
    State  stateA;
    State  stateB;
    bool   distinguished;
    int    markedAtIteration; // -1 = not marked, 0 = initial (final/non-final), else iteration number
    Symbol distinguishingSymbol;
    State  destA;
    State  destB;
    std::string reason;
};

// ─────────────────────────────────────────────────────────────────────────────
// One iteration of the table-filling loop
// ─────────────────────────────────────────────────────────────────────────────
struct MinimizationIteration {
    int                    iterationNumber;
    std::vector<TableEntry> newlyMarked;  // pairs marked in this iteration
};

// ─────────────────────────────────────────────────────────────────────────────
// Equivalent state groups after minimization
// ─────────────────────────────────────────────────────────────────────────────
struct EquivalenceGroup {
    StateSet          states;        // equivalent states merged into one
    State             representative; // the state name chosen for merged state
};

// ─────────────────────────────────────────────────────────────────────────────
// Full minimization result
// ─────────────────────────────────────────────────────────────────────────────
struct MinimizationResult {
    DFA                               originalDfa;
    StateSet                          reachableStates;
    StateSet                          unreachableStates;
    DFA                               reachableDfa;      // after removing unreachable
    std::vector<TableEntry>           initialTable;      // all pairs, initial marking
    std::vector<MinimizationIteration> iterations;
    std::vector<TableEntry>           finalTable;
    std::vector<EquivalenceGroup>      equivalenceGroups;
    DFA                               minimizedDfa;
    bool                              success;
    std::string                       errorMessage;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/// Returns the set of states reachable from the DFA start state
StateSet reachableStates(const DFA& dfa);

/// Returns a DFA with unreachable states removed
DFA removeUnreachableStates(const DFA& dfa);

/// Run the full table-filling minimization, recording all steps.
/// complete: if true (default), ensures the input DFA is complete and preserves completeness in minimized result.
MinimizationResult minimizeDfa(const DFA& dfa, bool complete = true);
