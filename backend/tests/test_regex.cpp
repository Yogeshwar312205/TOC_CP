#include "test_framework.hpp"
#include "../include/Automaton.hpp"
#include "../include/RegexParser.hpp"
#include "../include/RegexToNFA.hpp"
#include "../include/Conversion.hpp"
#include "../include/Minimization.hpp"
#include "../include/Simulator.hpp"
#include "../include/Validation.hpp"

TEST(regex_parser_literal) {
    std::set<Symbol> alpha = {"a", "b"};
    auto res = parseRegex("a", alpha);
    ASSERT_TRUE(res.success);
    ASSERT_TRUE(res.root != nullptr);
    ASSERT_TRUE(res.root->type == RegexNodeType::LITERAL);
    ASSERT_EQ(res.root->symbol, "a");
}

TEST(regex_parser_implicit_concat) {
    std::set<Symbol> alpha = {"a", "b"};
    auto res = parseRegex("ab", alpha);
    ASSERT_TRUE(res.success);
    ASSERT_TRUE(res.root != nullptr);
    ASSERT_TRUE(res.root->type == RegexNodeType::CONCAT);
    ASSERT_TRUE(res.root->left->type == RegexNodeType::LITERAL);
    ASSERT_EQ(res.root->left->symbol, "a");
    ASSERT_TRUE(res.root->right->type == RegexNodeType::LITERAL);
    ASSERT_EQ(res.root->right->symbol, "b");
}

TEST(regex_parser_union) {
    std::set<Symbol> alpha = {"a", "b"};
    auto res = parseRegex("a+b", alpha);
    ASSERT_TRUE(res.success);
    ASSERT_TRUE(res.root != nullptr);
    ASSERT_TRUE(res.root->type == RegexNodeType::UNION);
    ASSERT_EQ(res.root->left->symbol, "a");
    ASSERT_EQ(res.root->right->symbol, "b");
}

TEST(regex_parser_union_pipe_alias) {
    std::set<Symbol> alpha = {"a", "b"};
    auto res = parseRegex("a|b", alpha);
    ASSERT_TRUE(res.success);
    ASSERT_TRUE(res.root != nullptr);
    ASSERT_TRUE(res.root->type == RegexNodeType::UNION);
}

TEST(regex_parser_precedence_star_over_concat_and_union) {
    // a+bc* should be parsed as a + (b . (c*))
    std::set<Symbol> alpha = {"a", "b", "c"};
    auto res = parseRegex("a+bc*", alpha);
    ASSERT_TRUE(res.success);
    ASSERT_TRUE(res.root != nullptr);
    ASSERT_TRUE(res.root->type == RegexNodeType::UNION);
    ASSERT_EQ(res.root->left->symbol, "a");
    ASSERT_TRUE(res.root->right->type == RegexNodeType::CONCAT);
    ASSERT_EQ(res.root->right->left->symbol, "b");
    ASSERT_TRUE(res.root->right->right->type == RegexNodeType::STAR);
    ASSERT_EQ(res.root->right->right->left->symbol, "c");
}

TEST(regex_parser_unbalanced_parentheses) {
    std::set<Symbol> alpha = {"a", "b"};
    auto res1 = parseRegex("(a+b", alpha);
    ASSERT_FALSE(res1.success);

    auto res2 = parseRegex("a+b)", alpha);
    ASSERT_FALSE(res2.success);
}

TEST(regex_parser_invalid_alphabet_symbol) {
    std::set<Symbol> alpha = {"a", "b"};
    auto res = parseRegex("a+c", alpha);
    ASSERT_FALSE(res.success);
}

TEST(regex_parser_empty_pattern) {
    std::set<Symbol> alpha = {"a", "b"};
    auto res = parseRegex("", alpha);
    ASSERT_FALSE(res.success);
}

TEST(regex_parser_epsilon_handling) {
    std::set<Symbol> alpha = {"a", "b"};
    auto res = parseRegex("a+ε", alpha);
    ASSERT_TRUE(res.success);
    ASSERT_TRUE(res.root->right->type == RegexNodeType::EPSILON);
}

TEST(thompson_construction_valid_nfa) {
    std::set<Symbol> alpha = {"a", "b"};
    NFA nfa = regexToNFA("(a+b)*a", alpha);
    auto val = validateNFA(nfa);
    ASSERT_TRUE(val.valid);
    ASSERT_TRUE(!nfa.startState.empty());
    ASSERT_EQ(nfa.finalStates.size(), static_cast<size_t>(1));
}

TEST(full_pipeline_three_consecutive_bs) {
    std::set<Symbol> alpha = {"a", "b"};
    std::string pattern = "(a+b)*bbb(a+b)*";

    // 1. Regex to NFA
    NFA nfa = regexToNFA(pattern, alpha);
    ASSERT_TRUE(validateNFA(nfa).valid);

    // 2. NFA to DFA
    ConversionResult cr = nfaToDfa(nfa);
    ASSERT_TRUE(cr.success);
    ASSERT_TRUE(validateDFA(cr.dfa).valid);

    // 3. DFA Minimization
    MinimizationResult mr = minimizeDfa(cr.dfa);
    ASSERT_TRUE(mr.success);
    ASSERT_TRUE(validateDFA(mr.minimizedDfa).valid);

    // 4. Test Acceptance Consistency across all 3 automata
    std::vector<std::pair<std::string, bool>> testCases = {
        {"bbb",     true},
        {"abbb",    true},
        {"bbba",    true},
        {"aabbbab", true},
        {"abab",    false},
        {"bb",      false},
        {"",        false},
        {"b",       false},
        {"abbabbb", true},
        {"abbabba", false}
    };

    for (const auto& tc : testCases) {
        const std::string& input = tc.first;
        bool expected = tc.second;

        auto nfaSim = simulateNfa(nfa, input);
        auto dfaSim = simulateDfa(cr.dfa, input);
        auto minSim = simulateDfa(mr.minimizedDfa, input);

        ASSERT_EQ(nfaSim.accepted, expected);
        ASSERT_EQ(dfaSim.accepted, expected);
        ASSERT_EQ(minSim.accepted, expected);
    }
}

TEST(full_pipeline_ends_with_01) {
    std::set<Symbol> alpha = {"0", "1"};
    std::string pattern = "(0+1)*01";

    NFA nfa = regexToNFA(pattern, alpha);
    ConversionResult cr = nfaToDfa(nfa);
    MinimizationResult mr = minimizeDfa(cr.dfa);

    std::vector<std::pair<std::string, bool>> testCases = {
        {"01",   true},
        {"001",  true},
        {"101",  true},
        {"1101", true},
        {"0",    false},
        {"1",    false},
        {"",     false},
        {"100",  false},
        {"010",  false}
    };

    for (const auto& tc : testCases) {
        auto nfaSim = simulateNfa(nfa, tc.first);
        auto dfaSim = simulateDfa(cr.dfa, tc.first);
        auto minSim = simulateDfa(mr.minimizedDfa, tc.first);

        ASSERT_EQ(nfaSim.accepted, tc.second);
        ASSERT_EQ(dfaSim.accepted, tc.second);
        ASSERT_EQ(minSim.accepted, tc.second);
    }
}
