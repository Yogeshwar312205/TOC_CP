#include "test_framework.hpp"
#include "../include/Automaton.hpp"
#include "../include/Simulator.hpp"
#include "../include/Conversion.hpp"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
static DFA makeEndingIn01DFA() {
    // Pre-computed DFA for "strings ending in 01"
    DFA dfa;
    dfa.states     = {"A","B","C","D"};
    dfa.alphabet   = {"0","1"};
    dfa.startState = "A"; // {q0}
    dfa.finalStates= {"D"}; // {q0,q2} which is the state containing q2 (final NFA state)
    // A={q0}, B={q0,q1}, C={q0}, D={q0,q2}
    // Actually build correctly via conversion
    dfa.transitions = {
        {{"A","0"}, "B"}, {{"A","1"}, "A"},
        {{"B","0"}, "B"}, {{"B","1"}, "C"},
        {{"C","0"}, "B"}, {{"C","1"}, "A"},
        {{"D","0"}, "B"}, {{"D","1"}, "A"}
    };
    // D is final but unreachable in this setup — let's use the real conversion
    return dfa;
}

static NFA makeEndingIn01NFA() {
    NFA nfa;
    nfa.states = {"q0","q1","q2"};
    nfa.alphabet = {"0","1"};
    nfa.startState = "q0";
    nfa.finalStates = {"q2"};
    nfa.transitions[{"q0","0"}] = {"q0","q1"};
    nfa.transitions[{"q0","1"}] = {"q0"};
    nfa.transitions[{"q1","1"}] = {"q2"};
    return nfa;
}

// ─────────────────────────────────────────────────────────────────────────────
// DFA Simulator tests
// ─────────────────────────────────────────────────────────────────────────────
TEST(dfa_simulate_accepted_string) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    DFASimulationResult sr = simulateDfa(cr.dfa, "01");
    ASSERT_TRUE(sr.success);
    ASSERT_TRUE(sr.accepted);
}

TEST(dfa_simulate_rejected_string) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    DFASimulationResult sr = simulateDfa(cr.dfa, "10");
    ASSERT_TRUE(sr.success);
    ASSERT_FALSE(sr.accepted);
}

TEST(dfa_simulate_empty_string_not_accepted) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    DFASimulationResult sr = simulateDfa(cr.dfa, "");
    ASSERT_TRUE(sr.success);
    ASSERT_FALSE(sr.accepted);
}

TEST(dfa_simulate_longer_accepted) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    DFASimulationResult sr = simulateDfa(cr.dfa, "10101");
    ASSERT_TRUE(sr.success);
    ASSERT_TRUE(sr.accepted);
}

TEST(dfa_simulate_steps_count) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    // simulate "01" → start + 2 symbol steps + end = 4 steps
    DFASimulationResult sr = simulateDfa(cr.dfa, "01");
    ASSERT_EQ(sr.steps.size(), 4u);
}

TEST(dfa_simulate_rejection_reason_set) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    DFASimulationResult sr = simulateDfa(cr.dfa, "1");
    ASSERT_FALSE(sr.accepted);
    ASSERT_FALSE(sr.rejectionReason.empty());
}

// ─────────────────────────────────────────────────────────────────────────────
// NFA Simulator tests
// ─────────────────────────────────────────────────────────────────────────────
TEST(nfa_simulate_accepted_string) {
    NFA nfa = makeEndingIn01NFA();
    NFASimulationResult sr = simulateNfa(nfa, "01");
    ASSERT_TRUE(sr.success);
    ASSERT_TRUE(sr.accepted);
}

TEST(nfa_simulate_rejected_string) {
    NFA nfa = makeEndingIn01NFA();
    NFASimulationResult sr = simulateNfa(nfa, "10");
    ASSERT_TRUE(sr.success);
    ASSERT_FALSE(sr.accepted);
}

TEST(nfa_simulate_matches_dfa_simulation) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);

    std::vector<std::string> testStrings = {"01","001","101","10","0","1","0101","0100"};
    for (const auto& s : testStrings) {
        DFASimulationResult dfaSr = simulateDfa(cr.dfa, s);
        NFASimulationResult nfaSr = simulateNfa(nfa, s);
        ASSERT_EQ(dfaSr.accepted, nfaSr.accepted);
    }
}

TEST(nfa_simulate_epsilon_nfa) {
    // q0 --ε--> q1 --a--> q2 (final)
    NFA nfa;
    nfa.states = {"q0","q1","q2"};
    nfa.alphabet = {"a"};
    nfa.startState = "q0";
    nfa.finalStates = {"q2"};
    nfa.transitions[{"q0", EPSILON}] = {"q1"};
    nfa.transitions[{"q1","a"}] = {"q2"};

    NFASimulationResult sr = simulateNfa(nfa, "a");
    ASSERT_TRUE(sr.accepted);

    NFASimulationResult sr2 = simulateNfa(nfa, "b");
    ASSERT_FALSE(sr2.accepted);
}

TEST(nfa_simulate_steps_populated) {
    NFA nfa = makeEndingIn01NFA();
    NFASimulationResult sr = simulateNfa(nfa, "01");
    ASSERT_FALSE(sr.steps.empty());
}
