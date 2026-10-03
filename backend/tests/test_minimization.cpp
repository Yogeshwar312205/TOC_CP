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

TEST(minimization_single_state_dfa) {
    DFA dfa;
    dfa.states     = {"q0"};
    dfa.alphabet   = {"0"};
    dfa.startState = "q0";
    dfa.finalStates= {"q0"};
    MinimizationResult mr = minimizeDfa(dfa);
    ASSERT_TRUE(mr.success);
    ASSERT_EQ(mr.minimizedDfa.states.size(), 1u);
}
