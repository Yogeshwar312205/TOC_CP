#include "../include/Validation.hpp"
#include <sstream>
#include <stdexcept>

// ─────────────────────────────────────────────────────────────────────────────
// validateNFA
// ─────────────────────────────────────────────────────────────────────────────
ValidationResult validateNFA(const NFA& nfa) {
    ValidationResult result;
    result.valid = true;

    auto addError = [&](const std::string& code, const std::string& msg) {
        result.errors.push_back({code, msg});
        result.valid = false;
    };

    // Must have at least one state
    if (nfa.states.empty())
        addError("EMPTY_AUTOMATON", "NFA has no states");

    // Start state must be in states
    if (!nfa.startState.empty() && !nfa.states.count(nfa.startState))
        addError("INVALID_START_STATE",
                 "Start state '" + nfa.startState + "' is not in the states set");

    if (nfa.startState.empty())
        addError("MISSING_START_STATE", "No start state specified");

    // All final states must be in states
    for (const State& fs : nfa.finalStates) {
        if (!nfa.states.count(fs))
            addError("INVALID_FINAL_STATE",
                     "Final state '" + fs + "' is not in the states set");
    }

    // All transitions must reference valid states and symbols
    for (const auto& kv : nfa.transitions) {
        const auto&  key   = kv.first;
        const auto&  dests = kv.second;
        const State&  from  = key.first;
        const Symbol& sym   = key.second;

        if (!nfa.states.count(from))
            addError("INVALID_TRANSITION",
                     "Transition from unknown state '" + from + "'");

        // sym can be EPSILON (ε) or a symbol in the alphabet
        if (sym != EPSILON && !nfa.alphabet.count(sym))
            addError("INVALID_SYMBOL",
                     "Transition uses symbol '" + sym + "' not in alphabet");

        for (const State& dest : dests) {
            if (!nfa.states.count(dest))
                addError("INVALID_TRANSITION",
                         "Transition from '" + from + "' on '" + sym +
                         "' goes to unknown state '" + dest + "'");
        }
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateDFA
// ─────────────────────────────────────────────────────────────────────────────
ValidationResult validateDFA(const DFA& dfa) {
    ValidationResult result;
    result.valid = true;

    auto addError = [&](const std::string& code, const std::string& msg) {
        result.errors.push_back({code, msg});
        result.valid = false;
    };

    if (dfa.states.empty())
        addError("EMPTY_AUTOMATON", "DFA has no states");

    if (dfa.startState.empty())
        addError("MISSING_START_STATE", "No start state specified");

    if (!dfa.startState.empty() && !dfa.states.count(dfa.startState))
        addError("INVALID_START_STATE",
                 "Start state '" + dfa.startState + "' is not in the states set");

    for (const State& fs : dfa.finalStates) {
        if (!dfa.states.count(fs))
            addError("INVALID_FINAL_STATE",
                     "Final state '" + fs + "' is not in the states set");
    }

    for (const auto& kv : dfa.transitions) {
        const auto&  key  = kv.first;
        const auto&  dest = kv.second;
        const State&  from = key.first;
        const Symbol& sym  = key.second;

        if (!dfa.states.count(from))
            addError("INVALID_TRANSITION",
                     "Transition from unknown state '" + from + "'");

        if (!dfa.alphabet.count(sym))
            addError("INVALID_SYMBOL",
                     "Transition uses symbol '" + sym + "' not in alphabet");

        if (!dfa.states.count(dest))
            addError("INVALID_TRANSITION",
                     "Transition to unknown state '" + dest + "'");
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseNFAFromJson
// ─────────────────────────────────────────────────────────────────────────────
NFA parseNFAFromJson(const nlohmann::json& j) {
    NFA nfa;

    if (!j.contains("states") || !j["states"].is_array())
        throw std::invalid_argument("Missing or invalid 'states' array");
    for (const auto& s : j["states"])
        nfa.states.insert(s.get<std::string>());

    if (!j.contains("alphabet") || !j["alphabet"].is_array())
        throw std::invalid_argument("Missing or invalid 'alphabet' array");
    for (const auto& a : j["alphabet"])
        nfa.alphabet.insert(a.get<std::string>());

    if (!j.contains("startState") || !j["startState"].is_string())
        throw std::invalid_argument("Missing or invalid 'startState'");
    nfa.startState = j["startState"].get<std::string>();

    if (!j.contains("finalStates") || !j["finalStates"].is_array())
        throw std::invalid_argument("Missing or invalid 'finalStates' array");
    for (const auto& fs : j["finalStates"])
        nfa.finalStates.insert(fs.get<std::string>());

    if (!j.contains("transitions") || !j["transitions"].is_array())
        throw std::invalid_argument("Missing or invalid 'transitions' array");

    for (const auto& t : j["transitions"]) {
        if (!t.contains("from") || !t.contains("symbol") || !t.contains("to"))
            throw std::invalid_argument("Transition missing 'from', 'symbol', or 'to'");

        State  from   = t["from"].get<std::string>();
        Symbol symbol = t["symbol"].get<std::string>();

        if (symbol == "epsilon" || symbol == "eps" || symbol == "" ||
            symbol == "ε" || symbol == "e")
            symbol = EPSILON;

        StateSet dests;
        if (t["to"].is_array()) {
            for (const auto& d : t["to"])
                dests.insert(d.get<std::string>());
        } else if (t["to"].is_string()) {
            dests.insert(t["to"].get<std::string>());
        } else {
            throw std::invalid_argument("Transition 'to' must be a string or array");
        }

        auto& existing = nfa.transitions[{from, symbol}];
        existing.insert(dests.begin(), dests.end());
    }

    return nfa;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseDFAFromJson
// ─────────────────────────────────────────────────────────────────────────────
DFA parseDFAFromJson(const nlohmann::json& j) {
    DFA dfa;

    if (!j.contains("states") || !j["states"].is_array())
        throw std::invalid_argument("Missing or invalid 'states' array");
    for (const auto& s : j["states"])
        dfa.states.insert(s.get<std::string>());

    if (!j.contains("alphabet") || !j["alphabet"].is_array())
        throw std::invalid_argument("Missing or invalid 'alphabet' array");
    for (const auto& a : j["alphabet"])
        dfa.alphabet.insert(a.get<std::string>());

    if (!j.contains("startState") || !j["startState"].is_string())
        throw std::invalid_argument("Missing or invalid 'startState'");
    dfa.startState = j["startState"].get<std::string>();

    if (!j.contains("finalStates") || !j["finalStates"].is_array())
        throw std::invalid_argument("Missing or invalid 'finalStates' array");
    for (const auto& fs : j["finalStates"])
        dfa.finalStates.insert(fs.get<std::string>());

    if (!j.contains("transitions") || !j["transitions"].is_array())
        throw std::invalid_argument("Missing or invalid 'transitions' array");

    for (const auto& t : j["transitions"]) {
        State  from   = t["from"].get<std::string>();
        Symbol symbol = t["symbol"].get<std::string>();
        State  to;
        if (t["to"].is_array() && !t["to"].empty())
            to = t["to"][0].get<std::string>();
        else
            to = t["to"].get<std::string>();
        dfa.transitions[{from, symbol}] = to;
    }

    return dfa;
}
