#include "../include/Conversion.hpp"
#include <queue>
#include <map>
#include <algorithm>
#include <sstream>

// ─────────────────────────────────────────────────────────────────────────────
// Helper: assign a human-readable letter name ("A","B",…,"Z","AA",…) to a
// StateSet, maintaining a registry so the same set always gets the same name.
// ─────────────────────────────────────────────────────────────────────────────
static std::string generateStateLabel(int index) {
    std::string label;
    do {
        label = static_cast<char>('A' + (index % 26)) + label;
        index = index / 26 - 1;
    } while (index >= 0);
    return label;
}

// ─────────────────────────────────────────────────────────────────────────────
// epsilonClosure(nfa, state)
// Returns all states reachable from 'state' using only ε-transitions.
// Uses iterative DFS via an explicit stack — handles cycles correctly.
// ─────────────────────────────────────────────────────────────────────────────
StateSet epsilonClosure(const NFA& nfa, const State& state) {
    StateSet   closure;
    std::vector<State> stack;

    closure.insert(state); // A state is always in its own ε-closure
    stack.push_back(state);

    while (!stack.empty()) {
        State current = stack.back();
        stack.pop_back();

        // Look for ε-transitions from 'current'
        auto it = nfa.transitions.find({current, EPSILON});
        if (it != nfa.transitions.end()) {
            for (const State& dest : it->second) {
                if (closure.find(dest) == closure.end()) {
                    closure.insert(dest);
                    stack.push_back(dest);
                }
            }
        }
    }
    return closure;
}

// ─────────────────────────────────────────────────────────────────────────────
// epsilonClosure(nfa, states)
// Union of ε-closures for every state in the set
// ─────────────────────────────────────────────────────────────────────────────
StateSet epsilonClosure(const NFA& nfa, const StateSet& states) {
    StateSet result;
    for (const State& s : states) {
        StateSet c = epsilonClosure(nfa, s);
        result.insert(c.begin(), c.end());
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// move(nfa, states, symbol)
// Returns all states reachable from any state in 'states' via a single
// non-epsilon transition labelled 'symbol'.
// ─────────────────────────────────────────────────────────────────────────────
StateSet move(const NFA& nfa, const StateSet& states, const Symbol& symbol) {
    StateSet result;
    for (const State& s : states) {
        auto it = nfa.transitions.find({s, symbol});
        if (it != nfa.transitions.end()) {
            result.insert(it->second.begin(), it->second.end());
        }
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// completeDFA
// Completes an existing DFA by routing any undefined transitions to a dead state
// with self-loops on all alphabet symbols.
// ─────────────────────────────────────────────────────────────────────────────
DFA completeDFA(const DFA& dfa) {
    if (dfa.states.empty() || dfa.alphabet.empty()) return dfa;

    bool isComplete = true;
    for (const auto& st : dfa.states) {
        for (const auto& sym : dfa.alphabet) {
            if (dfa.transitions.find({st, sym}) == dfa.transitions.end()) {
                isComplete = false;
                break;
            }
        }
        if (!isComplete) break;
    }
    if (isComplete) return dfa;

    DFA result = dfa;

    // Check if an existing state is already a trap/dead state
    std::string deadState = "";
    for (const auto& st : result.states) {
        if (result.finalStates.count(st)) continue;
        bool isDead = true;
        for (const auto& sym : result.alphabet) {
            auto it = result.transitions.find({st, sym});
            if (it == result.transitions.end() || it->second != st) {
                isDead = false;
                break;
            }
        }
        if (isDead) {
            deadState = st;
            break;
        }
    }

    if (deadState.empty()) {
        int idx = 0;
        do {
            deadState = generateStateLabel(idx++);
        } while (result.states.count(deadState));

        result.states.insert(deadState);
        result.stateMapping[deadState] = {};
        for (const auto& sym : result.alphabet) {
            result.transitions[{deadState, sym}] = deadState;
        }
    }

    // Route all missing transitions to deadState
    for (const auto& st : result.states) {
        for (const auto& sym : result.alphabet) {
            if (result.transitions.find({st, sym}) == result.transitions.end()) {
                result.transitions[{st, sym}] = deadState;
            }
        }
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// nfaToDfa — Subset Construction Algorithm
// ─────────────────────────────────────────────────────────────────────────────
ConversionResult nfaToDfa(const NFA& nfa, bool complete) {
    ConversionResult result;
    result.success = true;

    // Registry: NFA StateSet → DFA state label
    std::map<StateSet, State> stateRegistry;
    // Queue of sets to process
    std::queue<StateSet> workQueue;
    int labelIndex = 0;
    int stepIndex  = 0;

    auto getOrCreateLabel = [&](const StateSet& set) -> std::pair<State, bool> {
        auto it = stateRegistry.find(set);
        if (it != stateRegistry.end()) {
            return {it->second, false}; // already exists
        }
        std::string label = generateStateLabel(labelIndex++);
        stateRegistry[set] = label;
        return {label, true}; // newly created
    };

    // ── Step 1: DFA start state = ε-closure(NFA start) ──────────────────────
    StateSet startSet = epsilonClosure(nfa, nfa.startState);
    auto startPair = getOrCreateLabel(startSet);
    std::string startLabel = startPair.first;
    workQueue.push(startSet);

    result.dfa.startState = startLabel;
    result.dfa.alphabet   = nfa.alphabet;

    // Sort alphabet for deterministic step ordering
    std::vector<Symbol> sortedAlphabet(nfa.alphabet.begin(), nfa.alphabet.end());
    std::sort(sortedAlphabet.begin(), sortedAlphabet.end());

    struct PendingDead {
        State from;
        Symbol sym;
        size_t stepIdx;
    };
    std::vector<PendingDead> pendingDeadTransitions;

    // ── Step 2: Process the work queue ──────────────────────────────────────
    std::set<StateSet> processed;

    while (!workQueue.empty()) {
        StateSet currentSet = workQueue.front();
        workQueue.pop();

        if (processed.count(currentSet)) continue;
        processed.insert(currentSet);

        State currentLabel = stateRegistry[currentSet];
        result.dfa.states.insert(currentLabel);
        result.dfa.stateMapping[currentLabel] = currentSet;

        // Mark as DFA final state if it contains any NFA final state
        for (const State& fs : nfa.finalStates) {
            if (currentSet.count(fs)) {
                result.dfa.finalStates.insert(currentLabel);
                break;
            }
        }

        // ── For every alphabet symbol ───────────────────────────────────────
        for (const Symbol& sym : sortedAlphabet) {
            // a. move(currentSet, sym)
            StateSet moveSet = move(nfa, currentSet, sym);

            // b. ε-closure of move result
            StateSet closure = epsilonClosure(nfa, moveSet);

            // Build the step record
            ConversionStep step;
            step.stepIndex              = stepIndex++;
            step.currentDfaStateSet     = currentSet;
            step.currentDfaStateName    = currentLabel;
            step.symbol                 = sym;
            step.moveResult             = moveSet;
            step.epsilonClosureResult   = closure;

            if (closure.empty()) {
                if (!complete) {
                    // Partial DFA — no transition added
                    step.nextDfaStateName = "∅";
                    step.isNewState       = false;

                    std::ostringstream desc;
                    desc << "move(" << stateSetToString(currentSet) << ", " << sym << ") = ∅"
                         << " → no transition";
                    step.description = desc.str();
                    result.steps.push_back(std::move(step));
                } else {
                    // Complete DFA — will route to dead/trap state
                    step.nextDfaStateName = "∅";
                    step.isNewState       = false;

                    std::ostringstream desc;
                    desc << "move(" << stateSetToString(currentSet) << ", " << sym << ") = ∅"
                         << " → Dead state";
                    step.description = desc.str();

                    pendingDeadTransitions.push_back({currentLabel, sym, result.steps.size()});
                    result.steps.push_back(std::move(step));
                }
            } else {
                // c. Register the new DFA state if needed
                auto nextPair = getOrCreateLabel(closure);
                std::string targetLabel = nextPair.first;
                bool isNew              = nextPair.second;

                step.nextDfaStateName   = targetLabel;
                step.isNewState         = isNew;

                // d. Record the DFA transition
                result.dfa.transitions[{currentLabel, sym}] = targetLabel;

                if (isNew) {
                    workQueue.push(closure);
                }

                std::ostringstream desc;
                desc << "move(" << stateSetToString(currentSet) << ", " << sym << ") = "
                     << stateSetToString(moveSet)
                     << "; ε-closure = " << stateSetToString(closure)
                     << " → " << currentLabel << " --" << sym << "--> " << targetLabel;
                if (isNew) desc << " [NEW STATE]";
                step.description = desc.str();
                result.steps.push_back(std::move(step));
            }
        }
    }

    // ── Step 3: Handle Dead State for Complete DFA ───────────────────────────
    if (complete && !pendingDeadTransitions.empty()) {
        std::string deadLabel = generateStateLabel(labelIndex++);
        result.dfa.states.insert(deadLabel);
        result.dfa.stateMapping[deadLabel] = {};

        for (const auto& pd : pendingDeadTransitions) {
            result.dfa.transitions[{pd.from, pd.sym}] = deadLabel;
            result.steps[pd.stepIdx].nextDfaStateName = deadLabel;
            std::ostringstream desc;
            desc << "move(" << stateSetToString(result.steps[pd.stepIdx].currentDfaStateSet) << ", " << pd.sym << ") = ∅"
                 << " → " << pd.from << " --" << pd.sym << "--> " << deadLabel << " [DEAD STATE]";
            result.steps[pd.stepIdx].description = desc.str();
        }

        // Dead state loops on all alphabet symbols
        for (const Symbol& sym : sortedAlphabet) {
            result.dfa.transitions[{deadLabel, sym}] = deadLabel;

            ConversionStep deadStep;
            deadStep.stepIndex            = stepIndex++;
            deadStep.currentDfaStateSet   = {};
            deadStep.currentDfaStateName  = deadLabel;
            deadStep.symbol               = sym;
            deadStep.moveResult           = {};
            deadStep.epsilonClosureResult = {};
            deadStep.nextDfaStateName     = deadLabel;
            deadStep.isNewState           = false;

            std::ostringstream desc;
            desc << "move(∅, " << sym << ") = ∅; ε-closure = ∅ → Dead state "
                 << deadLabel << " --" << sym << "--> " << deadLabel;
            deadStep.description = desc.str();

            result.steps.push_back(std::move(deadStep));
        }
    }

    return result;
}

