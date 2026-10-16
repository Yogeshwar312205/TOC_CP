#pragma once
#include "Automaton.hpp"
#include <string>
#include <vector>
#include <memory>
#include <set>

// ─────────────────────────────────────────────────────────────────────────────
// Regex AST Node Types
// ─────────────────────────────────────────────────────────────────────────────
enum class RegexNodeType {
    EMPTY,     // Empty language ∅
    EPSILON,   // Empty string ε
    LITERAL,   // Alphabet symbol
    CONCAT,    // Concatenation (left . right)
    UNION,     // Union (left + right)
    STAR       // Kleene star (left*)
};

struct RegexNode {
    RegexNodeType type;
    Symbol symbol;
    std::shared_ptr<RegexNode> left;
    std::shared_ptr<RegexNode> right;

    explicit RegexNode(RegexNodeType t) : type(t) {}
    RegexNode(RegexNodeType t, Symbol s) : type(t), symbol(std::move(s)) {}
    RegexNode(RegexNodeType t, std::shared_ptr<RegexNode> l, std::shared_ptr<RegexNode> r = nullptr)
        : type(t), left(std::move(l)), right(std::move(r)) {}
};

struct RegexParseResult {
    bool success;
    std::string errorMessage;
    std::shared_ptr<RegexNode> root;
    std::string normalizedRegex;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/// Parses and validates a regular expression string against declared alphabet.
/// Supports:
///   - Alphabet symbols in alphabet
///   - Union: '+' or '|'
///   - Implicit concatenation: 'ab', 'a(b+c)', '(a+b)*c'
///   - Kleene star: '*'
///   - Parentheses: '(' and ')'
///   - Empty string: 'ε', 'eps', 'epsilon'
RegexParseResult parseRegex(const std::string& pattern, const std::set<Symbol>& alphabet);
