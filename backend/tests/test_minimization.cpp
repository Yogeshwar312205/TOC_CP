#include "test_framework.hpp"
#include "../include/Automaton.hpp"
#include "../include/Minimization.hpp"
#include "../include/Conversion.hpp"

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a DFA with known equivalent states (from Dragon Book example)
// States: A,B,C,D,E  alphabet: 0,1
// A=start, C and E are final
// After minimization: B,D merge (both non-final, same behavior)
//                     C,E merge (both final, same behavior)
// ─────────────────────────────────────────────────────────────────────────────
static DFA makeDFAWithEquivalentStates() {
    DFA dfa;
    dfa.states    = {"A","B","C","D","E"};
    dfa.alphabet  = {"0","1"};
    dfa.startState = "A";
    dfa.finalStates= {"C","E"};
    dfa.transitions = {
        {{"A","0"}, "B"}, {{"A","1"}, "C"},
        {{"B","0"}, "B"}, {{"B","1"}, "D"},
        {{"C","0"}, "B"}, {{"C","1"}, "C"},
        {{"D","0"}, "B"}, {{"D","1"}, "E"},
        {{"E","0"}, "B"}, {{"E","1"}, "C"}
    };
    return dfa;
}

// Simple already-minimal DFA: accepts strings ending in 1
static DFA makeAlreadyMinimalDFA() {
    DFA dfa;
    dfa.states    = {"q0","q1"};
    dfa.alphabet  = {"0","1"};
    dfa.startState = "q0";
    dfa.finalStates= {"q1"};
    dfa.transitions = {
        {{"q0","0"}, "q0"}, {{"q0","1"}, "q1"},
        {{"q1","0"}, "q0"}, {{"q1","1"}, "q1"}
    };
    return dfa;
}

static DFA makeDFAWithUnreachableState() {
    DFA dfa;
    dfa.states    = {"A","B","C","D"};  // D is unreachable
    dfa.alphabet  = {"0","1"};
    dfa.startState = "A";
    dfa.finalStates= {"C"};
    dfa.transitions = {
        {{"A","0"}, "B"}, {{"A","1"}, "A"},
        {{"B","0"}, "B"}, {{"B","1"}, "C"},
        {{"C","0"}, "C"}, {{"C","1"}, "C"},
        {{"D","0"}, "D"}, {{"D","1"}, "D"}  // D is unreachable from A
    };
    return dfa;
}

// ─────────────────────────────────────────────────────────────────────────────
TEST(reachable_states_basic) {
    DFA dfa = makeDFAWithUnreachableState();
    StateSet reach = reachableStates(dfa);
    ASSERT_EQ(reach.size(), 3u); // A, B, C
    ASSERT_TRUE(reach.count("A"));
    ASSERT_TRUE(reach.count("B"));
    ASSERT_TRUE(reach.count("C"));
    ASSERT_FALSE(reach.count("D"));
}

TEST(remove_unreachable_removes_D) {
    DFA dfa = makeDFAWithUnreachableState();
    DFA cleaned = removeUnreachableStates(dfa);
    ASSERT_EQ(cleaned.states.size(), 3u);
    ASSERT_FALSE(cleaned.states.count("D"));
}

TEST(minimization_reduces_state_count) {
    DFA dfa = makeDFAWithEquivalentStates();
    MinimizationResult mr = minimizeDfa(dfa);
    ASSERT_TRUE(mr.success);
    // B and D are equivalent, C and E are equivalent → 3 states: A, {B,D}, {C,E}
    ASSERT_EQ(mr.minimizedDfa.states.size(), 3u);
}

TEST(minimization_preserves_start_state) {
    DFA dfa = makeDFAWithEquivalentStates();
    MinimizationResult mr = minimizeDfa(dfa);
    ASSERT_FALSE(mr.minimizedDfa.startState.empty());
}

TEST(minimization_preserves_final_states) {
    DFA dfa = makeDFAWithEquivalentStates();
    MinimizationResult mr = minimizeDfa(dfa);
    ASSERT_FALSE(mr.minimizedDfa.finalStates.empty());
}

TEST(minimization_already_minimal) {
    DFA dfa = makeAlreadyMinimalDFA();
    MinimizationResult mr = minimizeDfa(dfa);
    ASSERT_TRUE(mr.success);
    ASSERT_EQ(mr.minimizedDfa.states.size(), 2u); // still 2 states
}

TEST(minimization_initial_table_populated) {
    DFA dfa = makeDFAWithEquivalentStates();
    MinimizationResult mr = minimizeDfa(dfa);
    ASSERT_FALSE(mr.initialTable.empty());
}

TEST(minimization_equivalence_groups_correct) {
    DFA dfa = makeDFAWithEquivalentStates();
    MinimizationResult mr = minimizeDfa(dfa);
    ASSERT_EQ(mr.equivalenceGroups.size(), 3u);
}

TEST(minimization_unreachable_removed) {
    DFA dfa = makeDFAWithUnreachableState();
    MinimizationResult mr = minimizeDfa(dfa);
    ASSERT_TRUE(mr.unreachableStates.count("D"));
}

#include "../include/Simulator.hpp"

TEST(minimization_single_state_dfa) {
    DFA dfa;
    dfa.states     = {"q0"};
    dfa.alphabet   = {"0"};
    dfa.startState = "q0";
    dfa.finalStates= {"q0"};
    dfa.transitions= {{{"q0", "0"}, "q0"}};
    MinimizationResult mr = minimizeDfa(dfa, true);
    ASSERT_TRUE(mr.success);
    ASSERT_EQ(mr.minimizedDfa.states.size(), 1u);

    // Incomplete DFA with complete = false should also stay 1 state
    DFA partialDfa;
    partialDfa.states     = {"q0"};
    partialDfa.alphabet   = {"0"};
    partialDfa.startState = "q0";
    partialDfa.finalStates= {"q0"};
    MinimizationResult mrPartial = minimizeDfa(partialDfa, false);
    ASSERT_TRUE(mrPartial.success);
    ASSERT_EQ(mrPartial.minimizedDfa.states.size(), 1u);
}

TEST(minimization_starts_with_10_complete) {
    // Construct NFA for 10(0+1)*:
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

    MinimizationResult mr = minimizeDfa(cr.dfa, true);
    ASSERT_TRUE(mr.success);

    const DFA& dfa = mr.minimizedDfa;

    // 1. Correct state count and labels
    ASSERT_EQ(dfa.states.size(), 4u);
    ASSERT_TRUE(dfa.states.count("A"));
    ASSERT_TRUE(dfa.states.count("B"));
    ASSERT_TRUE(dfa.states.count("C"));
    ASSERT_TRUE(dfa.states.count("D"));

    // 2. Start and Final states
    ASSERT_EQ(dfa.startState, "A");
    ASSERT_EQ(dfa.finalStates.size(), 1u);
    ASSERT_TRUE(dfa.finalStates.count("C"));

    // 3. Exact transition table verification
    // State A: 0 -> D, 1 -> B
    ASSERT_EQ(dfa.transitions.at({"A", "0"}), "D");
    ASSERT_EQ(dfa.transitions.at({"A", "1"}), "B");

    // State B: 0 -> C, 1 -> D
    ASSERT_EQ(dfa.transitions.at({"B", "0"}), "C");
    ASSERT_EQ(dfa.transitions.at({"B", "1"}), "D");

    // State C: 0 -> C, 1 -> C (accepting self-loop)
    ASSERT_EQ(dfa.transitions.at({"C", "0"}), "C");
    ASSERT_EQ(dfa.transitions.at({"C", "1"}), "C");

    // State D: 0 -> D, 1 -> D (dead state self-loop)
    ASSERT_EQ(dfa.transitions.at({"D", "0"}), "D");
    ASSERT_EQ(dfa.transitions.at({"D", "1"}), "D");

    // 4. Verify language semantics via simulation:
    // Accept cases:
    ASSERT_TRUE(simulateDfa(dfa, "10").accepted);
    ASSERT_TRUE(simulateDfa(dfa, "100").accepted);
    ASSERT_TRUE(simulateDfa(dfa, "10101").accepted);

    // Reject cases:
    ASSERT_FALSE(simulateDfa(dfa, "11").accepted);
    ASSERT_FALSE(simulateDfa(dfa, "0").accepted);
    ASSERT_FALSE(simulateDfa(dfa, "110").accepted);
    ASSERT_FALSE(simulateDfa(dfa, "").accepted);
}

TEST(minimization_ends_with_01) {
    DFA dfa;
    dfa.states = {"A", "B", "C"};
    dfa.alphabet = {"0", "1"};
    dfa.startState = "A";
    dfa.finalStates = {"C"};
    dfa.transitions = {
        {{"A", "0"}, "B"}, {{"A", "1"}, "A"},
        {{"B", "0"}, "B"}, {{"B", "1"}, "C"},
        {{"C", "0"}, "B"}, {{"C", "1"}, "A"}
    };

    MinimizationResult mr = minimizeDfa(dfa, true);
    ASSERT_TRUE(mr.success);
    ASSERT_EQ(mr.minimizedDfa.states.size(), 3u);

    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "01").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "001").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "101").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "1101").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "010").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "1").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "").accepted);
}

TEST(minimization_contains_bbb) {
    DFA dfa;
    dfa.states = {"S0", "S1", "S2", "S3"};
    dfa.alphabet = {"a", "b"};
    dfa.startState = "S0";
    dfa.finalStates = {"S3"};
    dfa.transitions = {
        {{"S0", "a"}, "S0"}, {{"S0", "b"}, "S1"},
        {{"S1", "a"}, "S0"}, {{"S1", "b"}, "S2"},
        {{"S2", "a"}, "S0"}, {{"S2", "b"}, "S3"},
        {{"S3", "a"}, "S3"}, {{"S3", "b"}, "S3"}
    };

    MinimizationResult mr = minimizeDfa(dfa, true);
    ASSERT_TRUE(mr.success);
    ASSERT_EQ(mr.minimizedDfa.states.size(), 4u);

    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "bbb").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "abbba").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "bbba").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "babbb").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "bb").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "ab").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "bba").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "").accepted);
}

TEST(minimization_even_number_of_ones) {
    DFA dfa;
    dfa.states = {"EVEN", "ODD"};
    dfa.alphabet = {"0", "1"};
    dfa.startState = "EVEN";
    dfa.finalStates = {"EVEN"};
    dfa.transitions = {
        {{"EVEN", "0"}, "EVEN"}, {{"EVEN", "1"}, "ODD"},
        {{"ODD", "0"}, "ODD"},   {{"ODD", "1"}, "EVEN"}
    };

    MinimizationResult mr = minimizeDfa(dfa, true);
    ASSERT_TRUE(mr.success);
    ASSERT_EQ(mr.minimizedDfa.states.size(), 2u);

    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "0").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "11").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "101").accepted);
    ASSERT_TRUE(simulateDfa(mr.minimizedDfa, "001100").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "1").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "010").accepted);
    ASSERT_FALSE(simulateDfa(mr.minimizedDfa, "111").accepted);
}

