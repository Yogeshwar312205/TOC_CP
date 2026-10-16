#include "../include/RegexToNFA.hpp"
#include <stdexcept>

class ThompsonBuilder {
public:
    explicit ThompsonBuilder(std::set<Symbol> alphabet)
        : m_alphabet(std::move(alphabet)), m_stateCounter(0) {}

    NFA build(const std::shared_ptr<RegexNode>& ast) {
        if (!ast) {
            // Empty automaton
            NFA nfa;
            nfa.alphabet = m_alphabet;
            State s0 = newState();
            nfa.states.insert(s0);
            nfa.startState = s0;
            return nfa;
        }

        NFAFragment rootFrag = buildFragment(ast);

        NFA nfa;
        nfa.states = rootFrag.states;
        nfa.alphabet = m_alphabet;
        nfa.startState = rootFrag.startState;
        nfa.finalStates.insert(rootFrag.acceptState);
        nfa.transitions = rootFrag.transitions;

        return nfa;
    }

private:
    std::set<Symbol> m_alphabet;
    int m_stateCounter;

    State newState() {
        return "q" + std::to_string(m_stateCounter++);
    }

    void addTransition(NFATransitionMap& trans, const State& from, const Symbol& sym, const State& to) {
        trans[{from, sym}].insert(to);
    }

    NFAFragment buildFragment(const std::shared_ptr<RegexNode>& node) {
        if (!node) {
            throw std::runtime_error("Null node in regex AST");
        }

        switch (node->type) {
            case RegexNodeType::LITERAL: {
                State sIn = newState();
                State sOut = newState();
                NFAFragment frag;
                frag.startState = sIn;
                frag.acceptState = sOut;
                frag.states.insert(sIn);
                frag.states.insert(sOut);
                addTransition(frag.transitions, sIn, node->symbol, sOut);
                return frag;
            }

            case RegexNodeType::EPSILON: {
                State sIn = newState();
                State sOut = newState();
                NFAFragment frag;
                frag.startState = sIn;
                frag.acceptState = sOut;
                frag.states.insert(sIn);
                frag.states.insert(sOut);
                addTransition(frag.transitions, sIn, EPSILON, sOut);
                return frag;
            }

            case RegexNodeType::CONCAT: {
                NFAFragment leftFrag = buildFragment(node->left);
                NFAFragment rightFrag = buildFragment(node->right);

                NFAFragment frag;
                frag.startState = leftFrag.startState;
                frag.acceptState = rightFrag.acceptState;

                frag.states.insert(leftFrag.states.begin(), leftFrag.states.end());
                frag.states.insert(rightFrag.states.begin(), rightFrag.states.end());

                frag.transitions = leftFrag.transitions;
                for (const auto& kv : rightFrag.transitions) {
                    auto& dests = frag.transitions[kv.first];
                    dests.insert(kv.second.begin(), kv.second.end());
                }

                // ε-transition from left accept to right start
                addTransition(frag.transitions, leftFrag.acceptState, EPSILON, rightFrag.startState);

                return frag;
            }

            case RegexNodeType::UNION: {
                NFAFragment leftFrag = buildFragment(node->left);
                NFAFragment rightFrag = buildFragment(node->right);

                State newStart = newState();
                State newAccept = newState();

                NFAFragment frag;
                frag.startState = newStart;
                frag.acceptState = newAccept;

                frag.states.insert(leftFrag.states.begin(), leftFrag.states.end());
                frag.states.insert(rightFrag.states.begin(), rightFrag.states.end());
                frag.states.insert(newStart);
                frag.states.insert(newAccept);

                frag.transitions = leftFrag.transitions;
                for (const auto& kv : rightFrag.transitions) {
                    auto& dests = frag.transitions[kv.first];
                    dests.insert(kv.second.begin(), kv.second.end());
                }

                addTransition(frag.transitions, newStart, EPSILON, leftFrag.startState);
                addTransition(frag.transitions, newStart, EPSILON, rightFrag.startState);
                addTransition(frag.transitions, leftFrag.acceptState, EPSILON, newAccept);
                addTransition(frag.transitions, rightFrag.acceptState, EPSILON, newAccept);

                return frag;
            }

            case RegexNodeType::STAR: {
                NFAFragment innerFrag = buildFragment(node->left);

                State newStart = newState();
                State newAccept = newState();

                NFAFragment frag;
                frag.startState = newStart;
                frag.acceptState = newAccept;

                frag.states = innerFrag.states;
                frag.states.insert(newStart);
                frag.states.insert(newAccept);

                frag.transitions = innerFrag.transitions;

                // 4 ε-transitions for Kleene star:
                // 1) newStart -> inner start
                addTransition(frag.transitions, newStart, EPSILON, innerFrag.startState);
                // 2) newStart -> newAccept (match empty string)
                addTransition(frag.transitions, newStart, EPSILON, newAccept);
                // 3) inner accept -> inner start (loop)
                addTransition(frag.transitions, innerFrag.acceptState, EPSILON, innerFrag.startState);
                // 4) inner accept -> newAccept (exit)
                addTransition(frag.transitions, innerFrag.acceptState, EPSILON, newAccept);

                return frag;
            }

            case RegexNodeType::EMPTY:
            default: {
                State sIn = newState();
                State sOut = newState();
                NFAFragment frag;
                frag.startState = sIn;
                frag.acceptState = sOut;
                frag.states.insert(sIn);
                frag.states.insert(sOut);
                return frag;
            }
        }
    }
};

NFA regexToNFA(const std::shared_ptr<RegexNode>& ast, const std::set<Symbol>& alphabet) {
    ThompsonBuilder builder(alphabet);
    return builder.build(ast);
}

NFA regexToNFA(const std::string& pattern, const std::set<Symbol>& alphabet) {
    auto parseRes = parseRegex(pattern, alphabet);
    if (!parseRes.success) {
        throw std::invalid_argument("Failed to parse regular expression: " + parseRes.errorMessage);
    }
    return regexToNFA(parseRes.root, alphabet);
}
