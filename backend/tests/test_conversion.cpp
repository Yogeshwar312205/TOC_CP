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
    // In complete DFA mode, undefined transition on 'a' from q2 routes to dead state
    ConversionResult cr = nfaToDfa(nfa, true);
    ASSERT_TRUE(cr.success);
    ASSERT_EQ(cr.dfa.states.size(), 3u);

    // In partial DFA mode, dead state is omitted
    ConversionResult crPartial = nfaToDfa(nfa, false);
    ASSERT_TRUE(crPartial.success);
    ASSERT_EQ(crPartial.dfa.states.size(), 2u);
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
    // In complete DFA mode, missing transitions on 0,1 route to dead state (2 states: q0, dead)
    ConversionResult cr = nfaToDfa(nfa, true);
    ASSERT_TRUE(cr.success);
    ASSERT_EQ(cr.dfa.states.size(), 2u);
    ASSERT_FALSE(cr.dfa.finalStates.empty());

    // In partial mode, only 1 state
    ConversionResult crPartial = nfaToDfa(nfa, false);
    ASSERT_TRUE(crPartial.success);
    ASSERT_EQ(crPartial.dfa.states.size(), 1u);
}

TEST(conversion_alphabet_preserved) {
    NFA nfa = makeEndingIn01NFA();
    ConversionResult cr = nfaToDfa(nfa);
    ASSERT_EQ(cr.dfa.alphabet, nfa.alphabet);
}

TEST(conversion_starts_with_10_complete_dfa) {
    // Construct NFA for 10(0+1)*
    // q0 --1--> q1 --0--> q2 (final) --0,1--> q2
    NFA nfa;
    nfa.states = {"q0", "q1", "q2"};
    nfa.alphabet = {"0", "1"};
    nfa.startState = "q0";
    nfa.finalStates = {"q2"};
    nfa.transitions[{"q0", "1"}] = {"q1"};
    nfa.transitions[{"q1", "0"}] = {"q2"};
    nfa.transitions[{"q2", "0"}] = {"q2"};
    nfa.transitions[{"q2", "1"}] = {"q2"};

    ConversionResult cr = nfaToDfa(nfa, true);
    ASSERT_TRUE(cr.success);

    // Complete DFA has states: A ({q0}), B ({q1}), C ({q2}), D (dead)
    ASSERT_EQ(cr.dfa.states.size(), 4u);
    ASSERT_TRUE(cr.dfa.states.count("A"));
    ASSERT_TRUE(cr.dfa.states.count("B"));
    ASSERT_TRUE(cr.dfa.states.count("C"));
    ASSERT_TRUE(cr.dfa.states.count("D"));

    // Every state in complete DFA has transitions for both 0 and 1
    for (const auto& s : cr.dfa.states) {
        ASSERT_TRUE(cr.dfa.transitions.count({s, "0"}) > 0);
        ASSERT_TRUE(cr.dfa.transitions.count({s, "1"}) > 0);
        ASSERT_TRUE(cr.dfa.states.count(cr.dfa.transitions.at({s, "0"})) > 0);
        ASSERT_TRUE(cr.dfa.states.count(cr.dfa.transitions.at({s, "1"})) > 0);
    }

    // Dead state D loops on 0 and 1
    ASSERT_EQ(cr.dfa.transitions.at({"D", "0"}), "D");
    ASSERT_EQ(cr.dfa.transitions.at({"D", "1"}), "D");

    // A on 0 -> D, A on 1 -> B
    ASSERT_EQ(cr.dfa.transitions.at({"A", "0"}), "D");
    ASSERT_EQ(cr.dfa.transitions.at({"A", "1"}), "B");

    // B on 0 -> C, B on 1 -> D
    ASSERT_EQ(cr.dfa.transitions.at({"B", "0"}), "C");
    ASSERT_EQ(cr.dfa.transitions.at({"B", "1"}), "D");

    // C on 0 -> C, C on 1 -> C
    ASSERT_EQ(cr.dfa.transitions.at({"C", "0"}), "C");
    ASSERT_EQ(cr.dfa.transitions.at({"C", "1"}), "C");
}

