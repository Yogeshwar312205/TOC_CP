#include "../include/RegexParser.hpp"
#include <stack>
#include <cctype>
#include <algorithm>
#include <sstream>

enum class TokenType {
    LITERAL,
    EPSILON,
    UNION,
    CONCAT,
    STAR,
    LPAREN,
    RPAREN
};

struct Token {
    TokenType type;
    Symbol symbol;
};

static int getPrecedence(TokenType t) {
    switch (t) {
        case TokenType::STAR:   return 3;
        case TokenType::CONCAT: return 2;
        case TokenType::UNION:  return 1;
        default:                return 0;
    }
}

RegexParseResult parseRegex(const std::string& pattern, const std::set<Symbol>& alphabet) {
    RegexParseResult result;
    result.success = false;

    if (pattern.empty()) {
        result.errorMessage = "Regular expression cannot be empty";
        return result;
    }

    if (pattern.length() > 500) {
        result.errorMessage = "Regular expression exceeds maximum supported length (500 characters)";
        return result;
    }

    // Sort alphabet by length descending for greedy matching of multi-char symbols
    std::vector<Symbol> sortedAlphabet(alphabet.begin(), alphabet.end());
    std::sort(sortedAlphabet.begin(), sortedAlphabet.end(), [](const Symbol& a, const Symbol& b) {
        return a.length() > b.length();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 1: Lexing
    // ─────────────────────────────────────────────────────────────────────────
    std::vector<Token> rawTokens;
    size_t i = 0;
    int parenDepth = 0;

    while (i < pattern.length()) {
        char c = pattern[i];

        if (std::isspace(static_cast<unsigned char>(c))) {
            i++;
            continue;
        }

        if (c == '(') {
            rawTokens.push_back({TokenType::LPAREN, "("});
            parenDepth++;
            if (parenDepth > 50) {
                result.errorMessage = "Regular expression exceeds maximum nesting depth (50)";
                return result;
            }
            i++;
            continue;
        }

        if (c == ')') {
            parenDepth--;
            if (parenDepth < 0) {
                result.errorMessage = "Unmatched closing parenthesis ')' at position " + std::to_string(i + 1);
                return result;
            }
            rawTokens.push_back({TokenType::RPAREN, ")"});
            i++;
            continue;
        }

        if (c == '*' || c == '+') {
            if (c == '*') rawTokens.push_back({TokenType::STAR, "*"});
            else rawTokens.push_back({TokenType::UNION, "+"});
            i++;
            continue;
        }

        if (c == '|') {
            rawTokens.push_back({TokenType::UNION, "+"});
            i++;
            continue;
        }

        // Check for epsilon symbols
        if (pattern.compare(i, 2, "\xce\xb5") == 0) {
            rawTokens.push_back({TokenType::EPSILON, EPSILON});
            i += 2;
            continue;
        }
        if (pattern.compare(i, 7, "epsilon") == 0) {
            rawTokens.push_back({TokenType::EPSILON, EPSILON});
            i += 7;
            continue;
        }
        if (pattern.compare(i, 3, "eps") == 0) {
            rawTokens.push_back({TokenType::EPSILON, EPSILON});
            i += 3;
            continue;
        }

        // Try to match symbol in alphabet
        bool matched = false;
        for (const auto& sym : sortedAlphabet) {
            if (pattern.compare(i, sym.length(), sym) == 0) {
                rawTokens.push_back({TokenType::LITERAL, sym});
                i += sym.length();
                matched = true;
                break;
            }
        }

        if (!matched) {
            std::string invalidChar(1, c);
            result.errorMessage = "Invalid symbol '" + invalidChar + "' at position " +
                                  std::to_string(i + 1) + " (not in declared alphabet)";
            return result;
        }
    }

    if (parenDepth != 0) {
        result.errorMessage = "Unbalanced parentheses: missing closing ')'";
        return result;
    }

    if (rawTokens.empty()) {
        result.errorMessage = "Regular expression contains no symbols";
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: Insert implicit concatenation tokens
    // ─────────────────────────────────────────────────────────────────────────
    std::vector<Token> tokens;
    for (size_t idx = 0; idx < rawTokens.size(); idx++) {
        tokens.push_back(rawTokens[idx]);
        if (idx + 1 < rawTokens.size()) {
            TokenType curr = rawTokens[idx].type;
            TokenType next = rawTokens[idx + 1].type;

            bool currCanEnd = (curr == TokenType::LITERAL ||
                               curr == TokenType::EPSILON ||
                               curr == TokenType::STAR ||
                               curr == TokenType::RPAREN);

            bool nextCanStart = (next == TokenType::LITERAL ||
                                 next == TokenType::EPSILON ||
                                 next == TokenType::LPAREN);

            if (currCanEnd && nextCanStart) {
                tokens.push_back({TokenType::CONCAT, "."});
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 3: Shunting-yard to build AST
    // ─────────────────────────────────────────────────────────────────────────
    std::stack<std::shared_ptr<RegexNode>> nodeStack;
    std::stack<Token> opStack;

    auto applyOp = [&](const Token& op) -> bool {
        if (op.type == TokenType::STAR) {
            if (nodeStack.empty()) {
                result.errorMessage = "Operator '*' requires a preceding expression";
                return false;
            }
            auto top = nodeStack.top();
            nodeStack.pop();
            nodeStack.push(std::make_shared<RegexNode>(RegexNodeType::STAR, top));
            return true;
        }

        if (op.type == TokenType::UNION || op.type == TokenType::CONCAT) {
            if (nodeStack.size() < 2) {
                result.errorMessage = "Operator '" + op.symbol + "' requires two operands";
                return false;
            }
            auto right = nodeStack.top(); nodeStack.pop();
            auto left  = nodeStack.top(); nodeStack.pop();

            RegexNodeType nt = (op.type == TokenType::UNION) ? RegexNodeType::UNION : RegexNodeType::CONCAT;
            nodeStack.push(std::make_shared<RegexNode>(nt, left, right));
            return true;
        }

        result.errorMessage = "Unexpected operator in expression";
        return false;
    };

    for (size_t idx = 0; idx < tokens.size(); idx++) {
        const auto& tok = tokens[idx];

        if (tok.type == TokenType::LITERAL) {
            nodeStack.push(std::make_shared<RegexNode>(RegexNodeType::LITERAL, tok.symbol));
        } else if (tok.type == TokenType::EPSILON) {
            nodeStack.push(std::make_shared<RegexNode>(RegexNodeType::EPSILON));
        } else if (tok.type == TokenType::STAR) {
            // Apply star immediately
            if (!applyOp(tok)) return result;
        } else if (tok.type == TokenType::LPAREN) {
            opStack.push(tok);
        } else if (tok.type == TokenType::RPAREN) {
            while (!opStack.empty() && opStack.top().type != TokenType::LPAREN) {
                Token op = opStack.top();
                opStack.pop();
                if (!applyOp(op)) return result;
            }
            if (opStack.empty()) {
                result.errorMessage = "Mismatched parentheses";
                return result;
            }
            opStack.pop(); // Pop LPAREN
        } else if (tok.type == TokenType::UNION || tok.type == TokenType::CONCAT) {
            // Left-associative: pop while top precedence >= current precedence
            while (!opStack.empty() && opStack.top().type != TokenType::LPAREN &&
                   getPrecedence(opStack.top().type) >= getPrecedence(tok.type)) {
                Token topOp = opStack.top();
                opStack.pop();
                if (!applyOp(topOp)) return result;
            }
            opStack.push(tok);
        }
    }

    while (!opStack.empty()) {
        Token op = opStack.top();
        opStack.pop();
        if (op.type == TokenType::LPAREN) {
            result.errorMessage = "Unmatched opening parenthesis '('";
            return result;
        }
        if (!applyOp(op)) return result;
    }

    if (nodeStack.size() != 1) {
        result.errorMessage = "Malformed regular expression";
        return result;
    }

    result.root = nodeStack.top();
    result.success = true;

    // Build normalized regex representation
    std::function<std::string(const std::shared_ptr<RegexNode>&, int)> stringify;
    stringify = [&](const std::shared_ptr<RegexNode>& node, int parentPrec) -> std::string {
        if (!node) return "";
        if (node->type == RegexNodeType::EPSILON) return "ε";
        if (node->type == RegexNodeType::LITERAL) return node->symbol;
        if (node->type == RegexNodeType::STAR) {
            std::string inner = stringify(node->left, 3);
            return inner + "*";
        }
        if (node->type == RegexNodeType::CONCAT) {
            std::string l = stringify(node->left, 2);
            std::string r = stringify(node->right, 2);
            std::string res = l + r;
            return (parentPrec > 2) ? "(" + res + ")" : res;
        }
        if (node->type == RegexNodeType::UNION) {
            std::string l = stringify(node->left, 1);
            std::string r = stringify(node->right, 1);
            std::string res = l + "+" + r;
            return (parentPrec > 1) ? "(" + res + ")" : res;
        }
        return "";
    };

    result.normalizedRegex = stringify(result.root, 0);
    return result;
}
