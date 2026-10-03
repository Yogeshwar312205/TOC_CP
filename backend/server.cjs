const http = require('http');
const PORT = process.env.PORT || 8080;

// Epsilon symbol UTF-8 string
const EPSILON = 'ε';

// Helper: set of states to sorted canonical string "{q0,q1}"
function stateSetToString(set) {
  const arr = Array.from(set).sort();
  if (arr.length === 0) return '{}';
  return `{${arr.join(',')}}`;
}

function isEpsilon(sym) {
  return sym === 'ε' || sym === 'epsilon' || sym === 'eps' || sym === '' || sym === '\u03B5';
}

// Helper: Epsilon closure computation
function epsilonClosure(nfa, states) {
  const stateList = Array.isArray(states) ? states : [states];
  const closure = new Set(stateList);
  const stack = [...stateList];

  while (stack.length > 0) {
    const cur = stack.pop();
    for (const tr of nfa.transitions) {
      if (tr.from === cur && isEpsilon(tr.symbol)) {
        const dests = Array.isArray(tr.to) ? tr.to : [tr.to];
        for (const dest of dests) {
          if (!closure.has(dest)) {
            closure.add(dest);
            stack.push(dest);
          }
        }
      }
    }
  }
  return Array.from(closure).sort();
}

// Helper: Move operation
function move(nfa, states, symbol) {
  const result = new Set();
  for (const st of states) {
    for (const tr of nfa.transitions) {
      if (tr.from === st && tr.symbol === symbol) {
        const dests = Array.isArray(tr.to) ? tr.to : [tr.to];
        for (const dest of dests) result.add(dest);
      }
    }
  }
  return Array.from(result).sort();
}

// NFA to DFA Subset Construction Algorithm
function nfaToDfa(nfa) {
  const stateRegistry = new Map();
  const workQueue = [];
  let labelIndex = 0;
  let stepIndex = 0;

  function generateLabel(idx) {
    let label = '';
    do {
      label = String.fromCharCode(65 + (idx % 26)) + label;
      idx = Math.floor(idx / 26) - 1;
    } while (idx >= 0);
    return label;
  }

  function getOrCreateLabel(set) {
    const key = set.join(',');
    if (stateRegistry.has(key)) {
      return { label: stateRegistry.get(key), isNew: false };
    }
    const label = generateLabel(labelIndex++);
    stateRegistry.set(key, label);
    return { label, isNew: true };
  }

  const startSet = epsilonClosure(nfa, nfa.startState);
  const startRes = getOrCreateLabel(startSet);
  workQueue.push(startSet);

  const dfa = {
    states: [],
    alphabet: nfa.alphabet,
    startState: startRes.label,
    finalStates: [],
    transitions: [],
    stateMapping: {},
  };

  const steps = [];
  const processed = new Set();

  while (workQueue.length > 0) {
    const currentSet = workQueue.shift();
    const key = currentSet.join(',');
    if (processed.has(key)) continue;
    processed.add(key);

    const currentLabel = stateRegistry.get(key);
    if (!dfa.states.includes(currentLabel)) dfa.states.push(currentLabel);
    dfa.stateMapping[currentLabel] = currentSet;

    const finalStates = nfa.finalStates || nfa.acceptStates || [];
    if (currentSet.some((st) => finalStates.includes(st))) {
      if (!dfa.finalStates.includes(currentLabel)) dfa.finalStates.push(currentLabel);
    }

    for (const sym of nfa.alphabet) {
      const moveSet = move(nfa, currentSet, sym);
      const closure = epsilonClosure(nfa, moveSet);

      const step = {
        stepIndex: stepIndex++,
        dfaState: currentLabel,
        nfaSubstates: currentSet,
        symbol: sym,
        nextDfaState: '',
        isNewState: false,
        description: '',
      };

      if (closure.length === 0) {
        step.nextDfaState = '∅';
        step.description = `move({${currentSet.join(',')}}, '${sym}') = ∅ → Dead state`;
      } else {
        const nextRes = getOrCreateLabel(closure);
        step.nextDfaState = nextRes.label;
        step.isNewState = nextRes.isNew;
        step.description = `move({${currentSet.join(',')}}, '${sym}') = {${moveSet.join(',')}}; ε-closure = {${closure.join(',')}} → State ${nextRes.label}`;

        dfa.transitions.push({
          from: currentLabel,
          symbol: sym,
          to: nextRes.label,
        });

        if (nextRes.isNew) {
          workQueue.push(closure);
        }
      }
      steps.push(step);
    }
  }

  return { dfa, steps, nfa };
}

// DFA Minimization Table-Filling Algorithm
function minimizeDfa(inputDfa) {
  const states = inputDfa.states;
  const alphabet = inputDfa.alphabet;
  const finalStates = inputDfa.finalStates || inputDfa.acceptStates || [];

  const n = states.length;
  const table = [];
  const distinguishedMap = new Map();

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const stA = states[i];
      const stB = states[j];
      const pairKey = [stA, stB].sort().join('|');

      const isAFinal = finalStates.includes(stA);
      const isBFinal = finalStates.includes(stB);
      const distinguished = isAFinal !== isBFinal;

      const entry = {
        stateA: stA,
        stateB: stB,
        distinguishable: distinguished,
        stepMarked: distinguished ? 0 : -1,
        reasonSymbol: distinguished ? 'Final vs Non-Final' : '',
      };

      table.push(entry);
      distinguishedMap.set(pairKey, distinguished);
    }
  }

  let changed = true;
  let iter = 1;

  while (changed) {
    changed = false;
    for (const entry of table) {
      if (entry.distinguishable) continue;

      const pairKey = [entry.stateA, entry.stateB].sort().join('|');

      for (const sym of alphabet) {
        const trA = inputDfa.transitions.find((t) => t.from === entry.stateA && t.symbol === sym);
        const trB = inputDfa.transitions.find((t) => t.from === entry.stateB && t.symbol === sym);

        if (!trA || !trB) {
          if (trA !== trB) {
            entry.distinguishable = true;
            entry.stepMarked = iter;
            entry.reasonSymbol = sym;
            distinguishedMap.set(pairKey, true);
            changed = true;
            break;
          }
          continue;
        }

        const destA = trA.to;
        const destB = trB.to;
        if (destA === destB) continue;

        const destKey = [destA, destB].sort().join('|');
        if (distinguishedMap.get(destKey)) {
          entry.distinguishable = true;
          entry.stepMarked = iter;
          entry.reasonSymbol = sym;
          distinguishedMap.set(pairKey, true);
          changed = true;
          break;
        }
      }
    }
    iter++;
  }

  // Equivalence classes
  const parent = {};
  for (const st of states) parent[st] = st;

  function find(s) {
    if (parent[s] !== s) parent[s] = find(parent[s]);
    return parent[s];
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  for (const entry of table) {
    if (!entry.distinguishable) {
      union(entry.stateA, entry.stateB);
    }
  }

  const groupsMap = new Map();
  for (const st of states) {
    const rep = find(st);
    if (!groupsMap.has(rep)) groupsMap.set(rep, []);
    groupsMap.get(rep).push(st);
  }

  const equivalenceClasses = [];
  const stateMapping = {};
  const minStates = [];

  groupsMap.forEach((members, rep) => {
    equivalenceClasses.push({
      states: members,
      representative: rep,
    });
    minStates.push(rep);
    members.forEach((m) => {
      stateMapping[m] = rep;
    });
  });

  const minTransitions = [];
  const minTransKeys = new Set();

  for (const tr of inputDfa.transitions) {
    const srcRep = find(tr.from);
    const destRep = find(tr.to);
    const key = `${srcRep}|${tr.symbol}|${destRep}`;
    if (!minTransKeys.has(key)) {
      minTransKeys.add(key);
      minTransitions.push({
        from: srcRep,
        symbol: tr.symbol,
        to: destRep,
      });
    }
  }

  const minFinalStates = Array.from(
    new Set(finalStates.map((fs) => find(fs)))
  );

  const minDfa = {
    states: minStates,
    alphabet: alphabet,
    startState: find(inputDfa.startState),
    acceptStates: minFinalStates,
    finalStates: minFinalStates,
    transitions: minTransitions,
  };

  return {
    originalStates: states,
    unreachableStates: [],
    table,
    equivalenceClasses,
    stateMapping,
    minimizedDfa: minDfa,
    stats: {
      originalStateCount: states.length,
      minimizedStateCount: minStates.length,
      reductionPercentage: Math.max(0, ((states.length - minStates.length) / states.length) * 100),
    },
  };
}

// Create HTTP Server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    try {
      const url = req.url;

      if (url === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { status: 'ok', version: '1.0.0' } }));
        return;
      }

      if (url === '/api/validate' && req.method === 'POST') {
        const nfa = JSON.parse(body);
        const valid = Boolean(nfa.states && nfa.alphabet && nfa.startState);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            data: { valid, message: valid ? 'Valid NFA' : 'Invalid structure' },
          })
        );
        return;
      }

      if (url === '/api/convert' && req.method === 'POST') {
        const nfa = JSON.parse(body);
        const result = nfaToDfa(nfa);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      if (url === '/api/minimize' && req.method === 'POST') {
        const dfa = JSON.parse(body);
        const result = minimizeDfa(dfa);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      if (url === '/api/simulate' && req.method === 'POST') {
        const { dfa, input } = JSON.parse(body);
        let cur = dfa.startState;
        const steps = [];
        let accepted = true;

        steps.push({
          stepIndex: 0,
          currentState: cur,
          symbolRead: '',
          nextState: cur,
          remainingString: input,
          description: `START: ${cur}`,
        });

        for (let i = 0; i < input.length; i++) {
          const sym = input[i];
          const tr = dfa.transitions.find((t) => t.from === cur && t.symbol === sym);
          if (!tr) {
            accepted = false;
            break;
          }
          cur = tr.to;
          steps.push({
            stepIndex: i + 1,
            currentState: cur,
            symbolRead: sym,
            nextState: cur,
            remainingString: input.slice(i + 1),
            description: `δ(${tr.from}, '${sym}') ➔ ${cur}`,
          });
        }

        const finals = dfa.finalStates || dfa.acceptStates || [];
        if (!finals.includes(cur)) accepted = false;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            data: { accepted, finalState: cur, rejectionReason: accepted ? '' : 'String rejected', steps },
          })
        );
        return;
      }

      if (url === '/api/nfa-simulate' && req.method === 'POST') {
        const { nfa, input } = JSON.parse(body);
        let curStates = epsilonClosure(nfa, nfa.startState);
        const trace = [];

        trace.push({
          stepIndex: 0,
          activeStates: curStates,
          symbolRead: '',
          remainingString: input,
          transitionsTaken: [],
          description: `START: {${curStates.join(',')}}`,
        });

        for (let i = 0; i < input.length; i++) {
          const sym = input[i];
          const moveSet = move(nfa, curStates, sym);
          const closure = epsilonClosure(nfa, moveSet);
          curStates = closure;

          trace.push({
            stepIndex: i + 1,
            activeStates: curStates,
            symbolRead: sym,
            remainingString: input.slice(i + 1),
            transitionsTaken: [],
            description: `move on '${sym}' ➔ {${closure.join(',')}}`,
          });
        }

        const finals = nfa.finalStates || nfa.acceptStates || [];
        const accepted = curStates.some((st) => finals.includes(st));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            data: { accepted, trace, rejectionReason: accepted ? '' : 'NFA rejected' },
          })
        );
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
    console.error(`👉 You can free up port ${PORT} by stopping the existing process, or run on a different port (e.g., PORT=8081 node server.cjs).\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`AutomataLab API server running at http://localhost:${PORT}/api`);
});
