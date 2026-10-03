#include "test_framework.hpp"
#include "../include/Automaton.hpp"
#include "../include/Conversion.hpp"

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build simple NFA for tests
// ─────────────────────────────────────────────────────────────────────────────
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

static NFA makeEpsilonNFA() {
    // q0 --ε--> q1 --a--> q2
    NFA nfa;
    nfa.states = {"q0","q1","q2"};
    nfa.alphabet = {"a"};
    nfa.startState = "q0";
    nfa.finalStates = {"q2"};
    nfa.transitions[{"q0", EPSILON}] = {"q1"};
    nfa.transitions[{"q1","a"}] = {"q2"};
    return nfa;
}

// ─────────────────────────────────────────────────────────────────────────────
// Epsilon closure tests
// ─────────────────────────────────────────────────────────────────────────────
TEST(epsilon_closure_no_epsilon_transitions) {
    NFA nfa = makeEndingIn01NFA();
    // No epsilon transitions — closure should be just the state itself
    StateSet closure = epsilonClosure(nfa, "q0");
    ASSERT_EQ(closure.size(), 1u);
    ASSERT_TRUE(closure.count("q0"));
}

TEST(epsilon_closure_single_hop) {
    NFA nfa = makeEpsilonNFA();
    StateSet closure = epsilonClosure(nfa, "q0");
    ASSERT_EQ(closure.size(), 2u); // q0 and q1
    ASSERT_TRUE(closure.count("q0"));
    ASSERT_TRUE(closure.count("q1"));
}

TEST(epsilon_closure_set_of_states) {
    NFA nfa = makeEpsilonNFA();
    StateSet input = {"q0"};
    StateSet closure = epsilonClosure(nfa, input);
    ASSERT_TRUE(closure.count("q0"));
    ASSERT_TRUE(closure.count("q1"));
}

TEST(epsilon_closure_chain) {
    // q0 --ε--> q1 --ε--> q2
    NFA nfa;
    nfa.states = {"q0","q1","q2"};
    nfa.alphabet = {};
    nfa.startState = "q0";
    nfa.finalStates = {};
    nfa.transitions[{"q0", EPSILON}] = {"q1"};
    nfa.transitions[{"q1", EPSILON}] = {"q2"};

    StateSet closure = epsilonClosure(nfa, "q0");
    ASSERT_EQ(closure.size(), 3u);
    ASSERT_TRUE(closure.count("q2"));
}

TEST(epsilon_closure_cycle) {
    // q0 --ε--> q1 --ε--> q0 (cycle)
    NFA nfa;
    nfa.states = {"q0","q1","q2"};
    nfa.alphabet = {};
    nfa.startState = "q0";
    nfa.finalStates = {};
    nfa.transitions[{"q0", EPSILON}] = {"q1"};
    nfa.transitions[{"q1", EPSILON}] = {"q0"};

    StateSet closure = epsilonClosure(nfa, "q0");
    ASSERT_EQ(closure.size(), 2u); // should not loop forever
}

// ─────────────────────────────────────────────────────────────────────────────
// Move tests
// ─────────────────────────────────────────────────────────────────────────────
TEST(move_basic) {
    NFA nfa = makeEndingIn01NFA();
    StateSet states = {"q0"};
    StateSet result = move(nfa, states, "0");
    ASSERT_TRUE(result.count("q0"));
    ASSERT_TRUE(result.count("q1"));
}

TEST(move_missing_transition) {
    NFA nfa = makeEndingIn01NFA();
    StateSet states = {"q1"};
    StateSet result = move(nfa, states, "0"); // q1 has no transition on '0'
    ASSERT_TRUE(result.empty());
}

TEST(move_multi_state) {
    NFA nfa = makeEndingIn01NFA();
    StateSet states = {"q0","q1"};
    StateSet result = move(nfa, states, "1");
    ASSERT_TRUE(result.count("q0")); // q0 --1--> q0
    ASSERT_TRUE(result.count("q2")); // q1 --1--> q2
}

// ─────────────────────────────────────────────────────────────────────────────
// NFA→DFA Conversion tests
// ─────────────────────────────────────────────────────────────────────────────
TEST(conversion_ending_in_01) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    ASSERT_TRUE(cr.success);
    // Subset construction for ending in 01 generates 3 DFA states: {q0}, {q0,q1}, {q0,q2}
    ASSERT_EQ(cr.dfa.states.size(), 3u);
    ASSERT_FALSE(cr.dfa.startState.empty());
    ASSERT_FALSE(cr.dfa.finalStates.empty());
}

TEST(conversion_epsilon_nfa) {
    NFA nfa = makeEpsilonNFA();
    ConversionResult cr = nfaToDfa(nfa);
    ASSERT_TRUE(cr.success);
    // Should produce DFA states for {q0,q1}, {q2}
    ASSERT_EQ(cr.dfa.states.size(), 2u);
}

TEST(conversion_dfa_start_is_not_empty) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    ASSERT_FALSE(cr.dfa.startState.empty());
}

TEST(conversion_final_states_correct) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    // At least one DFA final state must exist (states containing q2)
    ASSERT_FALSE(cr.dfa.finalStates.empty());
}

TEST(conversion_steps_recorded) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    ASSERT_FALSE(cr.steps.empty());
}

TEST(conversion_state_mapping_populated) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    // Every DFA state should have a mapping to NFA states
    ASSERT_EQ(cr.dfa.stateMapping.size(), cr.dfa.states.size());
}

TEST(conversion_single_state_nfa) {
    NFA nfa;
    nfa.states = {"q0"};
    nfa.alphabet = {"0","1"};
    nfa.startState = "q0";
    nfa.finalStates = {"q0"};
    // No transitions
    ConversionResult cr = nfaToDfa(nfa);
    ASSERT_TRUE(cr.success);
    ASSERT_EQ(cr.dfa.states.size(), 1u);
    ASSERT_FALSE(cr.dfa.finalStates.empty()); // q0 is final in NFA → DFA start state is final
}

TEST(conversion_alphabet_preserved) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    ASSERT_EQ(cr.dfa.alphabet, nfa.alphabet);
}
