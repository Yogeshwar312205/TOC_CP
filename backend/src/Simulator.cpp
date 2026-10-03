#include "../include/Simulator.hpp"
#include "../include/Conversion.hpp"   // for epsilonClosure, move
#include <sstream>

// ─────────────────────────────────────────────────────────────────────────────
// simulateDfa
// Processes input string character-by-character through DFA transitions.
// Each character is treated as a single-symbol string (supports multi-char symbols
// if needed in future, but typical use is single chars).
// ─────────────────────────────────────────────────────────────────────────────
DFASimulationResult simulateDfa(const DFA& dfa, const std::string& input) {
    DFASimulationResult result;
    result.success = true;

    if (dfa.states.empty()) {
        result.success      = false;
        result.errorMessage = "DFA has no states";
        return result;
    }

    State currentState = dfa.startState;
    int   stepIndex    = 0;

    // Record start step
    {
        DFASimulationStep step;
        step.stepIndex       = stepIndex++;
        step.currentState    = currentState;
        step.symbol          = "";
        step.nextState       = currentState;
        step.transitionExists = true;
        step.description     = "START: initial state = " + currentState;
        result.steps.push_back(step);
    }

    // Process each symbol in the input string
    for (char ch : input) {
        Symbol sym(1, ch);

        DFASimulationStep step;
        step.stepIndex    = stepIndex++;
        step.currentState = currentState;
        step.symbol       = sym;

        auto it = dfa.transitions.find({currentState, sym});
        if (it == dfa.transitions.end()) {
            // No transition — reject
            step.transitionExists = false;
            step.nextState        = "∅";

            std::ostringstream desc;
            desc << "δ(" << currentState << ", " << sym << ") = undefined → REJECT";
            step.description = desc.str();
            result.steps.push_back(step);

            result.accepted       = false;
            result.finalState     = currentState;
            result.rejectionReason = "No transition from state '" + currentState + "' on symbol '" + sym + "'";
            return result;
        }

        State nextState = it->second;
        step.transitionExists = true;
        step.nextState        = nextState;

        std::ostringstream desc;
        desc << "δ(" << currentState << ", " << sym << ") = " << nextState;
        step.description = desc.str();

        result.steps.push_back(step);
        currentState = nextState;
    }

    // Final step: check acceptance
    {
        DFASimulationStep step;
        step.stepIndex       = stepIndex++;
        step.currentState    = currentState;
        step.symbol          = "";
        step.nextState       = currentState;
        step.transitionExists = true;

        bool accepted = dfa.finalStates.count(currentState) > 0;
        result.accepted   = accepted;
        result.finalState = currentState;

        step.description = accepted
            ? "END: state " + currentState + " is a final state → ACCEPT"
            : "END: state " + currentState + " is NOT a final state → REJECT";
        if (!accepted)
            result.rejectionReason = "Ended in non-final state '" + currentState + "'";

        result.steps.push_back(step);
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// simulateNfa
// Direct NFA simulation using subset tracking + ε-closure at each step.
// ─────────────────────────────────────────────────────────────────────────────
NFASimulationResult simulateNfa(const NFA& nfa, const std::string& input) {
    NFASimulationResult result;
    result.success = true;

    if (nfa.states.empty()) {
        result.success      = false;
        result.errorMessage = "NFA has no states";
        return result;
    }

    // Start with ε-closure of the start state
    StateSet currentStates = epsilonClosure(nfa, nfa.startState);
    int stepIndex = 0;

    // Record start step
    {
        NFASimulationStep step;
        step.stepIndex     = stepIndex++;
        step.currentStates = {};
        step.symbol        = "";
        step.moveResult    = {};
        step.epsilonClosed = currentStates;
        step.description   = "START: ε-closure({" + nfa.startState + "}) = " + stateSetToString(currentStates);
        result.steps.push_back(step);
    }

    for (char ch : input) {
        Symbol sym(1, ch);

        NFASimulationStep step;
        step.stepIndex     = stepIndex++;
        step.currentStates = currentStates;
        step.symbol        = sym;

        // move(currentStates, sym)
        StateSet moveSet = move(nfa, currentStates, sym);
        step.moveResult = moveSet;

        // ε-closure(moveSet)
        StateSet closure = epsilonClosure(nfa, moveSet);
        step.epsilonClosed = closure;

        std::ostringstream desc;
        desc << "move(" << stateSetToString(currentStates) << ", " << sym << ") = "
             << stateSetToString(moveSet)
             << "; ε-closure = " << stateSetToString(closure);
        step.description = desc.str();

        result.steps.push_back(step);
        currentStates = closure;
    }

    // Check acceptance
    result.finalStateSet = currentStates;
    result.accepted      = false;
    for (const State& fs : nfa.finalStates) {
        if (currentStates.count(fs)) {
            result.accepted = true;
            break;
        }
    }
    if (!result.accepted)
        result.rejectionReason = "Final state set " + stateSetToString(currentStates) + " contains no NFA final state";

    // Append final step
    {
        NFASimulationStep step;
        step.stepIndex     = stepIndex++;
        step.currentStates = currentStates;
        step.symbol        = "";
        step.moveResult    = {};
        step.epsilonClosed = currentStates;
        step.description   = result.accepted ? "ACCEPT" : "REJECT — " + result.rejectionReason;
        result.steps.push_back(step);
    }

    return result;
}
