#pragma once
#include <string>
#include <set>
#include <map>
#include <vector>
#include <utility>

// ─────────────────────────────────────────────────────────────────────────────
// Core type aliases
// ─────────────────────────────────────────────────────────────────────────────
using State    = std::string;
using Symbol   = std::string;
using StateSet = std::set<State>;

// Epsilon symbol used internally in transition maps
static const Symbol EPSILON = "\xce\xb5"; // UTF-8 ε

// ─────────────────────────────────────────────────────────────────────────────
// NFA transition map: (from-state, symbol) → set of destination states
// A symbol value of EPSILON represents an ε-transition
// ─────────────────────────────────────────────────────────────────────────────
using NFATransitionMap = std::map<std::pair<State, Symbol>, StateSet>;

// ─────────────────────────────────────────────────────────────────────────────
// DFA transition map: (from-state, symbol) → single destination state
// ─────────────────────────────────────────────────────────────────────────────
using DFATransitionMap = std::map<std::pair<State, Symbol>, State>;

// ─────────────────────────────────────────────────────────────────────────────
// NFA data structure
// ─────────────────────────────────────────────────────────────────────────────
struct NFA {
    StateSet         states;
    std::set<Symbol> alphabet;   // does NOT include epsilon
    State            startState;
    StateSet         finalStates;
    NFATransitionMap transitions; // uses EPSILON for ε-transitions
};

// ─────────────────────────────────────────────────────────────────────────────
// DFA data structure
// stateMapping: maps each DFA state name → the NFA StateSet it was built from
// ─────────────────────────────────────────────────────────────────────────────
struct DFA {
    StateSet         states;
    std::set<Symbol> alphabet;
    State            startState;
    StateSet         finalStates;
    DFATransitionMap transitions;
    // Human-readable label → NFA state set (populated during conversion)
    std::map<State, StateSet> stateMapping;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert a StateSet to a canonical string "{q0,q1,q2}"
// ─────────────────────────────────────────────────────────────────────────────
inline std::string stateSetToString(const StateSet& s) {
    if (s.empty()) return "{}";
    std::string result = "{";
    bool first = true;
    for (const auto& st : s) { // std::set is sorted — deterministic order
        if (!first) result += ",";
        result += st;
        first = false;
    }
    result += "}";
    return result;
}
