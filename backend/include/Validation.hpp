#pragma once
#include "Automaton.hpp"
#include <string>
#include <vector>

// ─────────────────────────────────────────────────────────────────────────────
// Individual validation error
// ─────────────────────────────────────────────────────────────────────────────
struct ValidationError {
    std::string code;    // e.g. "INVALID_TRANSITION"
    std::string message; // human-readable
};

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate validation result
// ─────────────────────────────────────────────────────────────────────────────
struct ValidationResult {
    bool                        valid;
    std::vector<ValidationError> errors;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
ValidationResult validateNFA(const NFA& nfa);
ValidationResult validateDFA(const DFA& dfa);

/// Parse NFA from nlohmann::json — returns populated NFA or throws std::invalid_argument
/// (included via forward declaration so Validation.hpp doesn't drag in json.hpp everywhere)
#include <nlohmann/json.hpp>
NFA  parseNFAFromJson(const nlohmann::json& j);
DFA  parseDFAFromJson(const nlohmann::json& j);
