// Regular Expression Parser, AST, and Thompson's Construction in JavaScript
// Reuses the exact same grammar, precedence, and Thompson fragments as the C++ engine.

const EPSILON = 'ε';

function isEpsilon(sym) {
  return sym === 'ε' || sym === 'epsilon' || sym === 'eps' || sym === '' || sym === '\u03B5';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lexer & Parser with Implicit Concatenation and Shunting-Yard
// ─────────────────────────────────────────────────────────────────────────────
function parseRegex(pattern, alphabet) {
  if (!pattern || typeof pattern !== 'string') {
    return { success: false, error: 'Regular expression cannot be empty' };
  }

  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    return { success: false, error: 'Regular expression cannot be empty' };
  }

  if (trimmed.length > 500) {
    return { success: false, error: 'Regular expression exceeds maximum length (500 chars)' };
  }

  const alphaSet = new Set(alphabet);
  // Sort symbols descending by length
  const sortedAlpha = Array.from(alphaSet).sort((a, b) => b.length - a.length);

  // Lexing
  const rawTokens = [];
  let i = 0;
  let parenDepth = 0;

  while (i < trimmed.length) {
    const c = trimmed[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === '(') {
      rawTokens.push({ type: 'LPAREN', symbol: '(' });
      parenDepth++;
      if (parenDepth > 50) {
        return { success: false, error: 'Nesting depth exceeded (max 50)' };
      }
      i++;
      continue;
    }

    if (c === ')') {
      parenDepth--;
      if (parenDepth < 0) {
        return { success: false, error: `Unmatched closing parenthesis ')' at index ${i + 1}` };
      }
      rawTokens.push({ type: 'RPAREN', symbol: ')' });
      i++;
      continue;
    }

    if (c === '*' || c === '+') {
      rawTokens.push({ type: c === '*' ? 'STAR' : 'UNION', symbol: c });
      i++;
      continue;
    }

    if (c === '|') {
      rawTokens.push({ type: 'UNION', symbol: '+' });
      i++;
      continue;
    }

    // Epsilon
    if (trimmed.startsWith('ε', i) || trimmed.startsWith('\u03B5', i)) {
      rawTokens.push({ type: 'EPSILON', symbol: EPSILON });
      i += 1;
      continue;
    }
    if (trimmed.startsWith('epsilon', i)) {
      rawTokens.push({ type: 'EPSILON', symbol: EPSILON });
      i += 7;
      continue;
    }
    if (trimmed.startsWith('eps', i)) {
      rawTokens.push({ type: 'EPSILON', symbol: EPSILON });
      i += 3;
      continue;
    }

    // Alphabet symbol matching
    let matched = false;
    for (const sym of sortedAlpha) {
      if (trimmed.startsWith(sym, i)) {
        rawTokens.push({ type: 'LITERAL', symbol: sym });
        i += sym.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      return {
        success: false,
        error: `Invalid symbol '${c}' at index ${i + 1} (not in declared alphabet: {${alphabet.join(', ')}})`,
      };
    }
  }

  if (parenDepth !== 0) {
    return { success: false, error: "Unbalanced parentheses: missing closing ')'" };
  }

  if (rawTokens.length === 0) {
    return { success: false, error: 'Regular expression contains no symbols' };
  }

  // Insert implicit concatenation
  const tokens = [];
  for (let idx = 0; idx < rawTokens.length; idx++) {
    tokens.push(rawTokens[idx]);
    if (idx + 1 < rawTokens.length) {
      const curr = rawTokens[idx].type;
      const next = rawTokens[idx + 1].type;

      const currCanEnd = curr === 'LITERAL' || curr === 'EPSILON' || curr === 'STAR' || curr === 'RPAREN';
      const nextCanStart = next === 'LITERAL' || next === 'EPSILON' || next === 'LPAREN';

      if (currCanEnd && nextCanStart) {
        tokens.push({ type: 'CONCAT', symbol: '.' });
      }
    }
  }

  // Shunting-Yard
  const prec = { STAR: 3, CONCAT: 2, UNION: 1, LPAREN: 0 };
  const nodeStack = [];
  const opStack = [];

  function applyOp(op) {
    if (op.type === 'STAR') {
      if (nodeStack.length < 1) {
        return { success: false, error: "Operator '*' requires a preceding operand" };
      }
      const top = nodeStack.pop();
      nodeStack.push({ type: 'STAR', left: top });
      return { success: true };
    }

    if (op.type === 'UNION' || op.type === 'CONCAT') {
      if (nodeStack.length < 2) {
        return { success: false, error: `Operator '${op.symbol}' requires two operands` };
      }
      const right = nodeStack.pop();
      const left = nodeStack.pop();
      nodeStack.push({ type: op.type, left, right });
      return { success: true };
    }

    return { success: false, error: 'Unexpected operator' };
  }

  for (const tok of tokens) {
    if (tok.type === 'LITERAL') {
      nodeStack.push({ type: 'LITERAL', symbol: tok.symbol });
    } else if (tok.type === 'EPSILON') {
      nodeStack.push({ type: 'EPSILON', symbol: EPSILON });
    } else if (tok.type === 'STAR') {
      const res = applyOp(tok);
      if (!res.success) return res;
    } else if (tok.type === 'LPAREN') {
      opStack.push(tok);
    } else if (tok.type === 'RPAREN') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'LPAREN') {
        const res = applyOp(opStack.pop());
        if (!res.success) return res;
      }
      if (opStack.length === 0) {
        return { success: false, error: 'Mismatched parentheses' };
      }
      opStack.pop(); // Pop LPAREN
    } else if (tok.type === 'UNION' || tok.type === 'CONCAT') {
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1].type !== 'LPAREN' &&
        prec[opStack[opStack.length - 1].type] >= prec[tok.type]
      ) {
        const res = applyOp(opStack.pop());
        if (!res.success) return res;
      }
      opStack.push(tok);
    }
  }

  while (opStack.length > 0) {
    const op = opStack.pop();
    if (op.type === 'LPAREN') {
      return { success: false, error: "Unmatched opening parenthesis '('" };
    }
    const res = applyOp(op);
    if (!res.success) return res;
  }

  if (nodeStack.length !== 1) {
    return { success: false, error: 'Malformed regular expression' };
  }

  const root = nodeStack[0];

  function stringify(node, parentPrec = 0) {
    if (!node) return '';
    if (node.type === 'EPSILON') return 'ε';
    if (node.type === 'LITERAL') return node.symbol;
    if (node.type === 'STAR') {
      const inner = stringify(node.left, 3);
      return inner + '*';
    }
    if (node.type === 'CONCAT') {
      const l = stringify(node.left, 2);
      const r = stringify(node.right, 2);
      const res = l + r;
      return parentPrec > 2 ? `(${res})` : res;
    }
    if (node.type === 'UNION') {
      const l = stringify(node.left, 1);
      const r = stringify(node.right, 1);
      const res = `${l}+${r}`;
      return parentPrec > 1 ? `(${res})` : res;
    }
    return '';
  }

  return {
    success: true,
    root,
    normalizedRegex: stringify(root),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Thompson's Construction: AST -> ε-NFA
// ─────────────────────────────────────────────────────────────────────────────
function buildThompsonNFA(ast, alphabet) {
  let stateCounter = 0;
  function newState() {
    return 'q' + stateCounter++;
  }

  function buildFragment(node) {
    if (!node) {
      throw new Error('Null node in AST');
    }

    if (node.type === 'LITERAL') {
      const start = newState();
      const accept = newState();
      return {
        startState: start,
        acceptState: accept,
        states: [start, accept],
        transitions: [{ from: start, symbol: node.symbol, to: accept }],
      };
    }

    if (node.type === 'EPSILON') {
      const start = newState();
      const accept = newState();
      return {
        startState: start,
        acceptState: accept,
        states: [start, accept],
        transitions: [{ from: start, symbol: EPSILON, to: accept }],
      };
    }

    if (node.type === 'CONCAT') {
      const left = buildFragment(node.left);
      const right = buildFragment(node.right);

      return {
        startState: left.startState,
        acceptState: right.acceptState,
        states: [...new Set([...left.states, ...right.states])],
        transitions: [
          ...left.transitions,
          ...right.transitions,
          { from: left.acceptState, symbol: EPSILON, to: right.startState },
        ],
      };
    }

    if (node.type === 'UNION') {
      const left = buildFragment(node.left);
      const right = buildFragment(node.right);
      const newStart = newState();
      const newAccept = newState();

      return {
        startState: newStart,
        acceptState: newAccept,
        states: [...new Set([...left.states, ...right.states, newStart, newAccept])],
        transitions: [
          ...left.transitions,
          ...right.transitions,
          { from: newStart, symbol: EPSILON, to: left.startState },
          { from: newStart, symbol: EPSILON, to: right.startState },
          { from: left.acceptState, symbol: EPSILON, to: newAccept },
          { from: right.acceptState, symbol: EPSILON, to: newAccept },
        ],
      };
    }

    if (node.type === 'STAR') {
      const inner = buildFragment(node.left);
      const newStart = newState();
      const newAccept = newState();

      return {
        startState: newStart,
        acceptState: newAccept,
        states: [...new Set([...inner.states, newStart, newAccept])],
        transitions: [
          ...inner.transitions,
          { from: newStart, symbol: EPSILON, to: inner.startState },
          { from: newStart, symbol: EPSILON, to: newAccept },
          { from: inner.acceptState, symbol: EPSILON, to: inner.startState },
          { from: inner.acceptState, symbol: EPSILON, to: newAccept },
        ],
      };
    }

    throw new Error(`Unknown node type: ${node.type}`);
  }

  const rootFrag = buildFragment(ast);

  return {
    states: rootFrag.states,
    alphabet: alphabet,
    startState: rootFrag.startState,
    finalStates: [rootFrag.acceptState],
    acceptStates: [rootFrag.acceptState],
    transitions: rootFrag.transitions,
  };
}

module.exports = {
  EPSILON,
  isEpsilon,
  parseRegex,
  buildThompsonNFA,
};
