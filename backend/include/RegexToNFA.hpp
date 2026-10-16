#pragma once
#include "Automaton.hpp"
#include "RegexParser.hpp"
#include <memory>
#include <set>

// ─────────────────────────────────────────────────────────────────────────────
// Thompson's Construction Fragment
// ─────────────────────────────────────────────────────────────────────────────
struct NFAFragment {
    State startState;
    State acceptState;
    StateSet states;
    NFATransitionMap transitions;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/// Builds an ε-NFA from a validated regular expression AST using Thompson's construction.
NFA regexToNFA(const std::shared_ptr<RegexNode>& ast, const std::set<Symbol>& alphabet);

/// Convenience function: parses regex and constructs ε-NFA directly.
NFA regexToNFA(const std::string& pattern, const std::set<Symbol>& alphabet);
