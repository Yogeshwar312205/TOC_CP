#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <nlohmann/json.hpp>
#include "../include/Automaton.hpp"
#include "../include/RegexParser.hpp"
#include "../include/RegexToNFA.hpp"
#include "../include/Conversion.hpp"
#include "../include/Minimization.hpp"
#include "../include/Simulator.hpp"
#include "../include/Validation.hpp"

using json = nlohmann::json;

static json stateSetToJson(const StateSet& s) {
    json arr = json::array();
    for (const auto& st : s) arr.push_back(st);
    return arr;
}

static json serializeDFA(const DFA& dfa) {
    json j;
    j["states"]      = stateSetToJson(dfa.states);
    j["alphabet"]    = stateSetToJson(dfa.alphabet);
    j["startState"]  = dfa.startState;
    j["finalStates"] = stateSetToJson(dfa.finalStates);
    j["acceptStates"]= stateSetToJson(dfa.finalStates);

    json trans = json::array();
    for (const auto& kv : dfa.transitions) {
        trans.push_back({
            {"from",   kv.first.first},
            {"symbol", kv.first.second},
            {"to",     kv.second}
        });
    }
    j["transitions"] = trans;

    json mapping = json::object();
    for (const auto& kv : dfa.stateMapping) {
        mapping[kv.first] = stateSetToJson(kv.second);
    }
    j["stateMapping"] = mapping;
    return j;
}

static json serializeNFA(const NFA& nfa) {
    json j;
    j["states"]      = stateSetToJson(nfa.states);
    j["alphabet"]    = stateSetToJson(nfa.alphabet);
    j["startState"]  = nfa.startState;
    j["finalStates"] = stateSetToJson(nfa.finalStates);
    j["acceptStates"]= stateSetToJson(nfa.finalStates);

    json trans = json::array();
    for (const auto& kv : nfa.transitions) {
        for (const auto& dest : kv.second) {
            trans.push_back({
                {"from",   kv.first.first},
                {"symbol", kv.first.second},
                {"to",     dest}
            });
        }
    }
    j["transitions"] = trans;
    return j;
}

static json serializeConversionStep(const ConversionStep& step) {
    return {
        {"stepIndex",            step.stepIndex},
        {"dfaState",             step.currentDfaStateName},
        {"currentDfaStateName",  step.currentDfaStateName},
        {"nfaSubstates",         stateSetToJson(step.currentDfaStateSet)},
        {"currentDfaStateSet",   stateSetToJson(step.currentDfaStateSet)},
        {"symbol",               step.symbol},
        {"moveResult",           stateSetToJson(step.moveResult)},
        {"epsilonClosureResult", stateSetToJson(step.epsilonClosureResult)},
        {"nextDfaState",         step.nextDfaStateName},
        {"nextDfaStateName",     step.nextDfaStateName},
        {"isNewState",           step.isNewState},
        {"description",          step.description}
    };
}

static json serializeTableEntry(const TableEntry& e) {
    return {
        {"stateA",                e.stateA},
        {"stateB",                e.stateB},
        {"distinguishable",       e.distinguished},
        {"distinguished",         e.distinguished},
        {"stepMarked",            e.markedAtIteration},
        {"markedAtIteration",     e.markedAtIteration},
        {"reasonSymbol",          e.distinguishingSymbol},
        {"distinguishingSymbol",  e.distinguishingSymbol},
        {"destA",                 e.destA},
        {"destB",                 e.destB},
        {"reason",                e.reason}
    };
}

int main(int argc, char* argv[]) {
    try {
        std::string inputStr;
        if (argc > 1) {
            inputStr = argv[1];
        } else {
            // Read from standard input
            std::stringstream buffer;
            buffer << std::cin.rdbuf();
            inputStr = buffer.str();
        }

        if (inputStr.empty()) {
            json err = {{"success", false}, {"error", "Empty input JSON provided"}};
            std::cout << err.dump() << std::endl;
            return 1;
        }

        json req = json::parse(inputStr);

        if (!req.contains("alphabet") || !req["alphabet"].is_array()) {
            json err = {{"success", false}, {"error", "Missing or invalid 'alphabet' array"}};
            std::cout << err.dump() << std::endl;
            return 1;
        }

        if (!req.contains("regex") || !req["regex"].is_string()) {
            json err = {{"success", false}, {"error", "Missing or invalid 'regex' string"}};
            std::cout << err.dump() << std::endl;
            return 1;
        }

        std::set<Symbol> alphabet;
        for (const auto& sym : req["alphabet"]) {
            alphabet.insert(sym.get<std::string>());
        }

        std::string regexStr = req["regex"].get<std::string>();

        // 1. Parse & validate regex
        RegexParseResult parseRes = parseRegex(regexStr, alphabet);
        if (!parseRes.success) {
            json err = {
                {"success", false},
                {"error", parseRes.errorMessage},
                {"code", "REGEX_PARSE_ERROR"}
            };
            std::cout << err.dump() << std::endl;
            return 0; // Return clean JSON with success: false
        }

        // 2. Thompson's construction: Regex -> ε-NFA
        NFA nfa = regexToNFA(parseRes.root, alphabet);
        ValidationResult valNfa = validateNFA(nfa);
        if (!valNfa.valid) {
            json err = {
                {"success", false},
                {"error", "Generated NFA validation failed: " + (valNfa.errors.empty() ? "unknown" : valNfa.errors[0].message)},
                {"code", "NFA_VALIDATION_ERROR"}
            };
            std::cout << err.dump() << std::endl;
            return 0;
        }

        // 3. Subset construction: ε-NFA -> DFA (Calling existing nfaToDfa algorithm)
        ConversionResult convRes = nfaToDfa(nfa);
        if (!convRes.success) {
            json err = {
                {"success", false},
                {"error", "Conversion from NFA to DFA failed: " + convRes.errorMessage},
                {"code", "CONVERSION_ERROR"}
            };
            std::cout << err.dump() << std::endl;
            return 0;
        }

        // 4. DFA Minimization: DFA -> Minimized DFA (Calling existing minimizeDfa algorithm)
        MinimizationResult minRes = minimizeDfa(convRes.dfa);
        if (!minRes.success) {
            json err = {
                {"success", false},
                {"error", "DFA minimization failed: " + minRes.errorMessage},
                {"code", "MINIMIZATION_ERROR"}
            };
            std::cout << err.dump() << std::endl;
            return 0;
        }

        // 5. Build response
        json conversionSteps = json::array();
        for (const auto& st : convRes.steps) {
            conversionSteps.push_back(serializeConversionStep(st));
        }

        json minimizationTable = json::array();
        for (const auto& te : minRes.finalTable) {
            minimizationTable.push_back(serializeTableEntry(te));
        }

        size_t nfaStateCount = nfa.states.size();
        size_t dfaStateCount = convRes.dfa.states.size();
        size_t minStateCount = minRes.minimizedDfa.states.size();

        size_t nfaTransCount = 0;
        for (const auto& kv : nfa.transitions) {
            nfaTransCount += kv.second.size();
        }
        size_t dfaTransCount = convRes.dfa.transitions.size();
        size_t minTransCount = minRes.minimizedDfa.transitions.size();

        double reduction = dfaStateCount > 0
            ? std::max(0.0, (static_cast<double>(dfaStateCount - minStateCount) / dfaStateCount) * 100.0)
            : 0.0;

        json resp;
        resp["success"] = true;
        resp["normalizedRegex"] = parseRes.normalizedRegex;
        resp["automata"] = {
            {"epsilonNFA",   serializeNFA(nfa)},
            {"dfa",          serializeDFA(convRes.dfa)},
            {"minimizedDFA", serializeDFA(minRes.minimizedDfa)}
        };
        resp["metrics"] = {
            {"epsilonNFAStates",        nfaStateCount},
            {"dfaStates",               dfaStateCount},
            {"minimizedDFAStates",      minStateCount},
            {"epsilonNFATransitions",   nfaTransCount},
            {"dfaTransitions",          dfaTransCount},
            {"minimizedDFATransitions", minTransCount},
            {"stateReductionPercentage", reduction}
        };
        resp["traces"] = {
            {"conversion",   conversionSteps},
            {"minimization", minimizationTable}
        };

        std::cout << resp.dump() << std::endl;
        return 0;
    } catch (const std::exception& ex) {
        json err = {{"success", false}, {"error", ex.what()}};
        std::cout << err.dump() << std::endl;
        return 1;
    }
}
