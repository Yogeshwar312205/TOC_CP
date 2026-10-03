#include "../include/Minimization.hpp"
#include <queue>
#include <algorithm>
#include <sstream>
#include <functional>

// ─────────────────────────────────────────────────────────────────────────────
// reachableStates
// BFS from startState following DFA transitions.
// ─────────────────────────────────────────────────────────────────────────────
StateSet reachableStates(const DFA& dfa) {
    StateSet           visited;
    std::queue<State>  q;

    if (dfa.states.empty()) return visited;

    q.push(dfa.startState);
    visited.insert(dfa.startState);

    while (!q.empty()) {
        State cur = q.front(); q.pop();
        for (const auto& sym : dfa.alphabet) {
            auto it = dfa.transitions.find({cur, sym});
            if (it != dfa.transitions.end()) {
                const State& dest = it->second;
                if (!visited.count(dest)) {
                    visited.insert(dest);
                    q.push(dest);
                }
            }
        }
    }
    return visited;
}

// ─────────────────────────────────────────────────────────────────────────────
// removeUnreachableStates
// Returns a new DFA containing only the reachable states.
// ─────────────────────────────────────────────────────────────────────────────
DFA removeUnreachableStates(const DFA& dfa) {
    StateSet reach = reachableStates(dfa);

    DFA result;
    result.alphabet   = dfa.alphabet;
    result.startState = dfa.startState;
    result.states     = reach;

    for (const State& fs : dfa.finalStates) {
        if (reach.count(fs)) result.finalStates.insert(fs);
    }
    for (const auto& kv : dfa.transitions) {
        const auto& key  = kv.first;
        const auto& dest = kv.second;
        if (reach.count(key.first) && reach.count(dest)) {
            result.transitions[key] = dest;
        }
    }
    for (const auto& kv : dfa.stateMapping) {
        const auto& label = kv.first;
        const auto& set   = kv.second;
        if (reach.count(label)) result.stateMapping[label] = set;
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// minimizeDfa — Table-Filling Algorithm
// ─────────────────────────────────────────────────────────────────────────────
MinimizationResult minimizeDfa(const DFA& input) {
    MinimizationResult result;
    result.success = true;

    // ── Phase 1: remove unreachable states ───────────────────────────────────
    result.originalDfa       = input;
    result.reachableStates   = reachableStates(input);
    result.unreachableStates = {};
    for (const State& s : input.states) {
        if (!result.reachableStates.count(s))
            result.unreachableStates.insert(s);
    }
    DFA dfa = removeUnreachableStates(input);
    result.reachableDfa = dfa;

    // Collect sorted state list for deterministic pair ordering
    std::vector<State> stateVec(dfa.states.begin(), dfa.states.end());
    std::sort(stateVec.begin(), stateVec.end());
    int n = static_cast<int>(stateVec.size());

    if (n <= 1) {
        // Already minimal
        result.minimizedDfa = dfa;
        return result;
    }

    // ── Phase 2: Build distinguishability table ───────────────────────────────
    using SPair = std::pair<State, State>;
    auto makePair = [](const State& a, const State& b) -> SPair {
        return a < b ? SPair{a, b} : SPair{b, a};
    };

    std::map<SPair, bool>        distinguished;   // true = distinguishable
    std::map<SPair, TableEntry>  tableEntries;

    // Initialize all pairs as non-distinguishable
    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            SPair p = makePair(stateVec[i], stateVec[j]);
            distinguished[p] = false;
            TableEntry entry;
            entry.stateA            = p.first;
            entry.stateB            = p.second;
            entry.distinguished     = false;
            entry.markedAtIteration = -1;
            tableEntries[p]         = entry;
        }
    }

    // ── Phase 3: Initial marking — final vs non-final ───────────────────────
    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            SPair p = makePair(stateVec[i], stateVec[j]);
            bool isFinal = dfa.finalStates.count(stateVec[i]) > 0;
            bool jFinal  = dfa.finalStates.count(stateVec[j]) > 0;
            if (isFinal != jFinal) {
                distinguished[p]                   = true;
                tableEntries[p].distinguished      = true;
                tableEntries[p].markedAtIteration  = 0;
                tableEntries[p].reason = "One is final, the other is not";
            }
        }
    }

    // Capture initial table state
    for (auto& kv : tableEntries) {
        const auto& key = kv.first;
        auto& entry     = kv.second;
        entry.distinguished = distinguished[key];
        result.initialTable.push_back(entry);
    }

    // ── Phase 4: Iterative marking ───────────────────────────────────────────
    bool changed = true;
    int  iteration = 1;

    while (changed) {
        changed = false;
        MinimizationIteration iter;
        iter.iterationNumber = iteration;

        for (int i = 0; i < n; ++i) {
            for (int j = i + 1; j < n; ++j) {
                SPair p = makePair(stateVec[i], stateVec[j]);
                if (distinguished[p]) continue; // already marked

                // Check each symbol
                for (const Symbol& sym : dfa.alphabet) {
                    auto itA = dfa.transitions.find({stateVec[i], sym});
                    auto itB = dfa.transitions.find({stateVec[j], sym});

                    bool aHasTrans = (itA != dfa.transitions.end());
                    bool bHasTrans = (itB != dfa.transitions.end());

                    if (!aHasTrans && !bHasTrans) continue; // both missing → same behavior

                    if (aHasTrans != bHasTrans) {
                        distinguished[p]                   = true;
                        tableEntries[p].distinguished      = true;
                        tableEntries[p].markedAtIteration  = iteration;
                        tableEntries[p].distinguishingSymbol = sym;
                        tableEntries[p].destA = aHasTrans ? itA->second : "∅";
                        tableEntries[p].destB = bHasTrans ? itB->second : "∅";
                        tableEntries[p].reason = "On '" + sym + "': one state has a transition, the other does not";
                        changed = true;
                        iter.newlyMarked.push_back(tableEntries[p]);
                        break;
                    }

                    // Both have transitions
                    State destA = itA->second;
                    State destB = itB->second;

                    if (destA == destB) continue;

                    SPair destPair = makePair(destA, destB);
                    if (distinguished.count(destPair) && distinguished[destPair]) {
                        distinguished[p]                    = true;
                        tableEntries[p].distinguished       = true;
                        tableEntries[p].markedAtIteration   = iteration;
                        tableEntries[p].distinguishingSymbol = sym;
                        tableEntries[p].destA               = destA;
                        tableEntries[p].destB               = destB;
                        tableEntries[p].reason = "On '" + sym + "': δ(" + stateVec[i] + "," + sym + ")=" + destA +
                                                 " and δ(" + stateVec[j] + "," + sym + ")=" + destB +
                                                 " are distinguishable";
                        changed = true;
                        iter.newlyMarked.push_back(tableEntries[p]);
                        break;
                    }
                }
            }
        }

        result.iterations.push_back(iter);
        ++iteration;
        if (!changed) break;
    }

    // Final table
    for (auto& kv : tableEntries) {
        result.finalTable.push_back(kv.second);
    }

    // ── Phase 5: Find equivalence classes ─────────────────────────────────────
    std::map<State, State> parent;
    for (const State& s : stateVec) parent[s] = s;

    std::function<State(const State&)> findState = [&](const State& s) -> State {
        if (parent[s] != s) parent[s] = findState(parent[s]);
        return parent[s];
    };

    auto unite = [&](const State& a, const State& b) {
        State ra = findState(a);
        State rb = findState(b);
        if (ra != rb) parent[rb] = ra;
    };

    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            SPair p = makePair(stateVec[i], stateVec[j]);
            if (!distinguished[p]) {
                unite(stateVec[i], stateVec[j]);
            }
        }
    }

    // Build equivalence groups
    std::map<State, EquivalenceGroup> groups;
    for (const State& s : stateVec) {
        State rep = findState(s);
        groups[rep].states.insert(s);
        groups[rep].representative = rep;
    }
    for (auto& kv : groups) {
        result.equivalenceGroups.push_back(kv.second);
    }

    // ── Phase 6: Construct minimized DFA ─────────────────────────────────────
    DFA& minDfa = result.minimizedDfa;
    minDfa.alphabet = dfa.alphabet;

    for (auto& kv : groups) {
        const auto& rep = kv.first;
        const auto& grp = kv.second;
        minDfa.states.insert(rep);
        minDfa.stateMapping[rep] = grp.states;
    }

    // Start state
    minDfa.startState = findState(dfa.startState);

    // Final states
    for (const State& fs : dfa.finalStates) {
        minDfa.finalStates.insert(findState(fs));
    }

    // Transitions
    for (const auto& kv : dfa.transitions) {
        const auto& key  = kv.first;
        const auto& dest = kv.second;
        State repSrc  = findState(key.first);
        State repDest = findState(dest);
        minDfa.transitions[{repSrc, key.second}] = repDest;
    }

    return result;
}
