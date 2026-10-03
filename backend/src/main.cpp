#include "crow.h"
#include <nlohmann/json.hpp>
#include "../include/Automaton.hpp"
#include "../include/Conversion.hpp"
#include "../include/Minimization.hpp"
#include "../include/Simulator.hpp"
#include "../include/Validation.hpp"
#include <string>
#include <vector>
#include <sstream>

using json = nlohmann::json;

// ─────────────────────────────────────────────────────────────────────────────
// JSON serialisation helpers
// ─────────────────────────────────────────────────────────────────────────────

static json stateSetToJson(const StateSet& s) {
    json arr = json::array();
    for (const auto& st : s) arr.push_back(st);
    return arr;
}

static json serializeDFA(const DFA& dfa) {
    json j;
    j["states"]     = stateSetToJson(dfa.states);
    j["alphabet"]   = stateSetToJson(dfa.alphabet);
    j["startState"] = dfa.startState;
    j["finalStates"]= stateSetToJson(dfa.finalStates);

    json trans = json::array();
    for (const auto& kv : dfa.transitions) {
        const auto& key  = kv.first;
        const auto& dest = kv.second;
        trans.push_back({
            {"from",   key.first},
            {"symbol", key.second},
            {"to",     dest}
        });
    }
    j["transitions"] = trans;

    json mapping = json::object();
    for (const auto& kv : dfa.stateMapping) {
        const auto& label = kv.first;
        const auto& set   = kv.second;
        mapping[label] = stateSetToJson(set);
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

    json trans = json::array();
    for (const auto& kv : nfa.transitions) {
        const auto& key   = kv.first;
        const auto& dests = kv.second;
        trans.push_back({
            {"from",   key.first},
            {"symbol", key.second},
            {"to",     stateSetToJson(dests)}
        });
    }
    j["transitions"] = trans;
    return j;
}

static json serializeConversionStep(const ConversionStep& step) {
    return {
        {"stepIndex",            step.stepIndex},
        {"currentDfaStateSet",   stateSetToJson(step.currentDfaStateSet)},
        {"currentDfaStateName",  step.currentDfaStateName},
        {"symbol",               step.symbol},
        {"moveResult",           stateSetToJson(step.moveResult)},
        {"epsilonClosureResult", stateSetToJson(step.epsilonClosureResult)},
        {"nextDfaStateName",     step.nextDfaStateName},
        {"isNewState",           step.isNewState},
        {"description",          step.description}
    };
}

static json serializeTableEntry(const TableEntry& e) {
    return {
        {"stateA",                e.stateA},
        {"stateB",                e.stateB},
        {"distinguished",         e.distinguished},
        {"markedAtIteration",     e.markedAtIteration},
        {"distinguishingSymbol",  e.distinguishingSymbol},
        {"destA",                 e.destA},
        {"destB",                 e.destB},
        {"reason",                e.reason}
    };
}

static json serializeMinimizationResult(const MinimizationResult& mr) {
    json j;
    j["originalDfa"]       = serializeDFA(mr.originalDfa);
    j["reachableStates"]   = stateSetToJson(mr.reachableStates);
    j["unreachableStates"] = stateSetToJson(mr.unreachableStates);
    j["reachableDfa"]      = serializeDFA(mr.reachableDfa);
    j["minimizedDfa"]      = serializeDFA(mr.minimizedDfa);

    json initialTable = json::array();
    for (const auto& e : mr.initialTable)
        initialTable.push_back(serializeTableEntry(e));
    j["initialTable"] = initialTable;

    json iters = json::array();
    for (const auto& iter : mr.iterations) {
        json it;
        it["iterationNumber"] = iter.iterationNumber;
        json marked = json::array();
        for (const auto& e : iter.newlyMarked)
            marked.push_back(serializeTableEntry(e));
        it["newlyMarked"] = marked;
        iters.push_back(it);
    }
    j["iterations"] = iters;

    json finalTable = json::array();
    for (const auto& e : mr.finalTable)
        finalTable.push_back(serializeTableEntry(e));
    j["finalTable"] = finalTable;

    json groups = json::array();
    for (const auto& g : mr.equivalenceGroups) {
        groups.push_back({
            {"states",         stateSetToJson(g.states)},
            {"representative", g.representative}
        });
    }
    j["equivalenceGroups"] = groups;
    return j;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS middleware — needed for React dev server on port 5173
// ─────────────────────────────────────────────────────────────────────────────
struct CORSMiddleware {
    struct context {};
    void before_handle(crow::request& /*req*/, crow::response& res, context& /*ctx*/) {
        res.add_header("Access-Control-Allow-Origin",  "*");
        res.add_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.add_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    void after_handle(crow::request& /*req*/, crow::response& res, context& /*ctx*/) {
        res.add_header("Access-Control-Allow-Origin",  "*");
        res.add_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.add_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Error / success response builders
// ─────────────────────────────────────────────────────────────────────────────
static crow::response errorResponse(int status, const std::string& code, const std::string& msg) {
    json body = {
        {"success", false},
        {"error", {
            {"code",    code},
            {"message", msg}
        }}
    };
    auto res = crow::response(status, body.dump());
    res.set_header("Content-Type", "application/json");
    return res;
}

static crow::response successResponse(const json& data) {
    json body = {
        {"success", true},
        {"data",    data}
    };
    auto res = crow::response(200, body.dump());
    res.set_header("Content-Type", "application/json");
    return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────
int main() {
    crow::App<CORSMiddleware> app;

    // ── GET /api/health ───────────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/health").methods(crow::HTTPMethod::GET)([]() {
        json data = {
            {"status",  "ok"},
            {"version", "1.0.0"},
            {"service", "AutomataLab Backend"}
        };
        return successResponse(data);
    });

    // ── OPTIONS /* (preflight) ────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/<path>").methods(crow::HTTPMethod::OPTIONS)(
        [](const crow::request&, const std::string&) {
            crow::response res(204);
            res.add_header("Access-Control-Allow-Origin",  "*");
            res.add_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.add_header("Access-Control-Allow-Headers", "Content-Type");
            return res;
        }
    );

    // ── POST /api/validate ────────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/validate").methods(crow::HTTPMethod::POST)(
        [](const crow::request& req) {
            try {
                auto j = json::parse(req.body);
                NFA nfa = parseNFAFromJson(j);
                ValidationResult vr = validateNFA(nfa);

                json errorsJson = json::array();
                for (const auto& e : vr.errors)
                    errorsJson.push_back({{"code", e.code}, {"message", e.message}});

                return successResponse({
                    {"valid",  vr.valid},
                    {"errors", errorsJson}
                });
            } catch (const std::exception& ex) {
                return errorResponse(400, "PARSE_ERROR", ex.what());
            }
        }
    );

    // ── POST /api/convert ─────────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/convert").methods(crow::HTTPMethod::POST)(
        [](const crow::request& req) {
            try {
                auto j = json::parse(req.body);
                NFA nfa = parseNFAFromJson(j);

                ValidationResult vr = validateNFA(nfa);
                if (!vr.valid) {
                    json errorsJson = json::array();
                    for (const auto& e : vr.errors)
                        errorsJson.push_back({{"code", e.code}, {"message", e.message}});
                    return errorResponse(400, "VALIDATION_FAILED",
                        "NFA validation failed: " + vr.errors[0].message);
                }

                ConversionResult cr = nfaToDfa(nfa);

                json steps = json::array();
                for (const auto& step : cr.steps)
                    steps.push_back(serializeConversionStep(step));

                return successResponse({
                    {"dfa",   serializeDFA(cr.dfa)},
                    {"steps", steps},
                    {"nfa",   serializeNFA(nfa)}
                });
            } catch (const std::exception& ex) {
                return errorResponse(400, "PARSE_ERROR", ex.what());
            }
        }
    );

    // ── POST /api/minimize ────────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/minimize").methods(crow::HTTPMethod::POST)(
        [](const crow::request& req) {
            try {
                auto j = json::parse(req.body);

                DFA dfa;
                if (j.contains("transitions") && !j["transitions"].empty()) {
                    bool isDFA = j["transitions"][0]["to"].is_string() ||
                                 (j["transitions"][0]["to"].is_array() &&
                                  j["transitions"][0]["to"].size() == 1);
                    if (isDFA) {
                        dfa = parseDFAFromJson(j);
                    } else {
                        NFA nfa = parseNFAFromJson(j);
                        ConversionResult cr = nfaToDfa(nfa);
                        dfa = cr.dfa;
                    }
                } else {
                    dfa = parseDFAFromJson(j);
                }

                MinimizationResult mr = minimizeDfa(dfa);
                return successResponse(serializeMinimizationResult(mr));
            } catch (const std::exception& ex) {
                return errorResponse(400, "PARSE_ERROR", ex.what());
            }
        }
    );

    // ── POST /api/simulate ────────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/simulate").methods(crow::HTTPMethod::POST)(
        [](const crow::request& req) {
            try {
                auto j = json::parse(req.body);
                if (!j.contains("dfa") || !j.contains("input"))
                    return errorResponse(400, "MISSING_FIELD", "Request must contain 'dfa' and 'input'");

                DFA dfa = parseDFAFromJson(j["dfa"]);
                std::string input = j["input"].get<std::string>();

                DFASimulationResult sr = simulateDfa(dfa, input);

                json steps = json::array();
                for (const auto& step : sr.steps) {
                    steps.push_back({
                        {"stepIndex",        step.stepIndex},
                        {"currentState",     step.currentState},
                        {"symbol",           step.symbol},
                        {"nextState",        step.nextState},
                        {"transitionExists", step.transitionExists},
                        {"description",      step.description}
                    });
                }

                return successResponse({
                    {"accepted",        sr.accepted},
                    {"finalState",      sr.finalState},
                    {"rejectionReason", sr.rejectionReason},
                    {"steps",           steps}
                });
            } catch (const std::exception& ex) {
                return errorResponse(400, "PARSE_ERROR", ex.what());
            }
        }
    );

    // ── POST /api/nfa-simulate ────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/nfa-simulate").methods(crow::HTTPMethod::POST)(
        [](const crow::request& req) {
            try {
                auto j = json::parse(req.body);
                if (!j.contains("nfa") || !j.contains("input"))
                    return errorResponse(400, "MISSING_FIELD", "Request must contain 'nfa' and 'input'");

                NFA nfa = parseNFAFromJson(j["nfa"]);
                std::string input = j["input"].get<std::string>();

                NFASimulationResult sr = simulateNfa(nfa, input);

                json steps = json::array();
                for (const auto& step : sr.steps) {
                    steps.push_back({
                        {"stepIndex",      step.stepIndex},
                        {"currentStates",  stateSetToJson(step.currentStates)},
                        {"symbol",         step.symbol},
                        {"moveResult",     stateSetToJson(step.moveResult)},
                        {"epsilonClosed",  stateSetToJson(step.epsilonClosed)},
                        {"description",    step.description}
                    });
                }

                return successResponse({
                    {"accepted",        sr.accepted},
                    {"finalStateSet",   stateSetToJson(sr.finalStateSet)},
                    {"rejectionReason", sr.rejectionReason},
                    {"steps",           steps}
                });
            } catch (const std::exception& ex) {
                return errorResponse(400, "PARSE_ERROR", ex.what());
            }
        }
    );

    // ── GET /api/examples ─────────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/examples").methods(crow::HTTPMethod::GET)([]() {
        json examples = json::array();

        examples.push_back({
            {"id", "simple-nfa"},
            {"name", "Simple NFA"},
            {"description", "NFA that accepts strings containing 'ab'"},
            {"nfa", {
                {"states",      {"q0","q1","q2"}},
                {"alphabet",    {"a","b"}},
                {"startState",  "q0"},
                {"finalStates", {"q2"}},
                {"transitions", {
                    {{"from","q0"},{"symbol","a"},{"to",{"q0","q1"}}},
                    {{"from","q0"},{"symbol","b"},{"to",{"q0"}}},
                    {{"from","q1"},{"symbol","b"},{"to",{"q2"}}},
                    {{"from","q2"},{"symbol","a"},{"to",{"q2"}}},
                    {{"from","q2"},{"symbol","b"},{"to",{"q2"}}}
                }}
            }}
        });

        return successResponse({{"examples", examples}});
    });

    CROW_LOG_INFO << "AutomataLab backend starting on port 8080...";

    app.port(8080)
       .multithreaded()
       .run();

    return 0;
}
