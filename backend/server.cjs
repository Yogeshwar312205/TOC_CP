const http = require('http');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { interpretLanguageWithAI, PRESET_PATTERNS } = require('./aiService.cjs');
const { parseRegex, buildThompsonNFA } = require('./regexEngine.cjs');

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

// Helper: Complete DFA by routing missing transitions to dead state
function completeDfa(dfa) {
  if (!dfa || !dfa.states || dfa.states.length === 0 || !dfa.alphabet || dfa.alphabet.length === 0) {
    return dfa;
  }
  let isComplete = true;
  for (const st of dfa.states) {
    for (const sym of dfa.alphabet) {
      if (!dfa.transitions.some((t) => t.from === st && t.symbol === sym)) {
        isComplete = false;
        break;
      }
    }
    if (!isComplete) break;
  }
  if (isComplete) return dfa;

  const result = {
    states: [...dfa.states],
    alphabet: [...dfa.alphabet],
    startState: dfa.startState,
    finalStates: [...(dfa.finalStates || dfa.acceptStates || [])],
    acceptStates: [...(dfa.acceptStates || dfa.finalStates || [])],
    transitions: [...dfa.transitions],
    stateMapping: { ...(dfa.stateMapping || {}) },
  };

  // Check if existing state is already a trap/dead state
  let deadState = '';
  for (const st of result.states) {
    if (result.finalStates.includes(st)) continue;
    let isDead = true;
    for (const sym of result.alphabet) {
      const tr = result.transitions.find((t) => t.from === st && t.symbol === sym);
      if (!tr || tr.to !== st) {
        isDead = false;
        break;
      }
    }
    if (isDead) {
      deadState = st;
      break;
    }
  }

  function generateLabel(idx) {
    let label = '';
    do {
      label = String.fromCharCode(65 + (idx % 26)) + label;
      idx = Math.floor(idx / 26) - 1;
    } while (idx >= 0);
    return label;
  }

  if (!deadState) {
    let idx = 0;
    do {
      deadState = generateLabel(idx++);
    } while (result.states.includes(deadState));

    result.states.push(deadState);
    result.stateMapping[deadState] = [];
    for (const sym of result.alphabet) {
      result.transitions.push({ from: deadState, symbol: sym, to: deadState });
    }
  }

  for (const st of result.states) {
    for (const sym of result.alphabet) {
      if (!result.transitions.some((t) => t.from === st && t.symbol === sym)) {
        result.transitions.push({ from: st, symbol: sym, to: deadState });
      }
    }
  }

  return result;
}

// NFA to DFA Subset Construction Algorithm
function nfaToDfa(nfa, complete = true) {
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
  const pendingDead = [];

  const sortedAlphabet = [...nfa.alphabet].sort();

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

    for (const sym of sortedAlphabet) {
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
        if (!complete) {
          step.nextDfaState = '∅';
          step.description = `move({${currentSet.join(',')}}, '${sym}') = ∅ → no transition`;
          steps.push(step);
        } else {
          step.nextDfaState = '∅';
          step.description = `move({${currentSet.join(',')}}, '${sym}') = ∅ → Dead state`;
          pendingDead.push({ from: currentLabel, sym, stepIdx: steps.length });
          steps.push(step);
        }
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
        steps.push(step);
      }
    }
  }

  // Handle dead state if complete
  if (complete && pendingDead.length > 0) {
    const deadLabel = generateLabel(labelIndex++);
    dfa.states.push(deadLabel);
    dfa.stateMapping[deadLabel] = [];

    for (const pd of pendingDead) {
      dfa.transitions.push({ from: pd.from, symbol: pd.sym, to: deadLabel });
      steps[pd.stepIdx].nextDfaState = deadLabel;
      steps[pd.stepIdx].description = `move({${steps[pd.stepIdx].nfaSubstates.join(',')}}, '${pd.sym}') = ∅ → ${pd.from} --${pd.sym}--> ${deadLabel} [DEAD STATE]`;
    }

    for (const sym of sortedAlphabet) {
      dfa.transitions.push({ from: deadLabel, symbol: sym, to: deadLabel });
      steps.push({
        stepIndex: stepIndex++,
        dfaState: deadLabel,
        nfaSubstates: [],
        symbol: sym,
        nextDfaState: deadLabel,
        isNewState: false,
        description: `move(∅, '${sym}') = ∅; ε-closure = ∅ → Dead state ${deadLabel} --${sym}--> ${deadLabel}`,
      });
    }
  }

  return { dfa, steps, nfa };
}

// DFA Minimization Table-Filling Algorithm
function minimizeDfa(inputDfa, complete = true) {
  const workingDfa = complete ? completeDfa(inputDfa) : inputDfa;

  // 1. Compute reachable states
  const reachable = new Set();
  const q = [workingDfa.startState];
  if (workingDfa.states.includes(workingDfa.startState)) {
    reachable.add(workingDfa.startState);
  }

  while (q.length > 0) {
    const cur = q.shift();
    for (const sym of workingDfa.alphabet) {
      const tr = workingDfa.transitions.find((t) => t.from === cur && t.symbol === sym);
      if (tr && !reachable.has(tr.to)) {
        reachable.add(tr.to);
        q.push(tr.to);
      }
    }
  }

  const unreachableStates = workingDfa.states.filter((s) => !reachable.has(s));
  const states = workingDfa.states.filter((s) => reachable.has(s)).sort();
  const alphabet = [...workingDfa.alphabet].sort();
  const finalStates = (workingDfa.finalStates || workingDfa.acceptStates || []).filter((s) => reachable.has(s));
  const transitions = workingDfa.transitions.filter((t) => reachable.has(t.from) && reachable.has(t.to));

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
        destA: '',
        destB: '',
        reason: distinguished ? 'One is final, the other is not' : '',
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
        const trA = transitions.find((t) => t.from === entry.stateA && t.symbol === sym);
        const trB = transitions.find((t) => t.from === entry.stateB && t.symbol === sym);

        if (!trA || !trB) {
          if (trA !== trB) {
            entry.distinguishable = true;
            entry.stepMarked = iter;
            entry.reasonSymbol = sym;
            entry.destA = trA ? trA.to : '∅';
            entry.destB = trB ? trB.to : '∅';
            entry.reason = `On '${sym}': one state has a transition, the other does not`;
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
          entry.destA = destA;
          entry.destB = destB;
          entry.reason = `On '${sym}': δ(${entry.stateA},${sym})=${destA} and δ(${entry.stateB},${sym})=${destB} are distinguishable`;
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

  // Identify dead state group (non-final, self-loops on all symbols, not start state)
  const startRep = find(workingDfa.startState);
  let deadGroupRep = null;

  groupsMap.forEach((members, rep) => {
    if (rep === startRep) return;
    const hasFinal = members.some((m) => finalStates.includes(m));
    if (hasFinal) return;

    let allSelfLoop = true;
    for (const sym of alphabet) {
      const tr = transitions.find((t) => t.from === rep && t.symbol === sym);
      if (!tr || find(tr.to) !== rep) {
        allSelfLoop = false;
        break;
      }
    }
    if (allSelfLoop && groupsMap.size > 1) {
      deadGroupRep = rep;
    }
  });

  // Canonical ordering: start group first, BFS over non-dead groups, dead group last
  const orderedReps = [startRep];
  const visitedReps = new Set([startRep]);
  const bfsQ = [startRep];

  while (bfsQ.length > 0) {
    const curRep = bfsQ.shift();
    for (const sym of alphabet) {
      const tr = transitions.find((t) => t.from === curRep && t.symbol === sym);
      if (tr) {
        const destRep = find(tr.to);
        if (destRep !== deadGroupRep && !visitedReps.has(destRep)) {
          visitedReps.add(destRep);
          orderedReps.push(destRep);
          bfsQ.push(destRep);
        }
      }
    }
  }

  // Remaining non-dead groups
  const remainingReps = [];
  groupsMap.forEach((_, rep) => {
    if (rep !== deadGroupRep && !visitedReps.has(rep)) {
      remainingReps.push(rep);
    }
  });
  remainingReps.sort();
  for (const r of remainingReps) {
    orderedReps.push(r);
    visitedReps.add(r);
  }

  // Dead group placed last
  if (deadGroupRep && !visitedReps.has(deadGroupRep)) {
    orderedReps.push(deadGroupRep);
    visitedReps.add(deadGroupRep);
  }

  function generateStateLabel(idx) {
    let label = '';
    do {
      label = String.fromCharCode(65 + (idx % 26)) + label;
      idx = Math.floor(idx / 26) - 1;
    } while (idx >= 0);
    return label;
  }

  const repToCanonical = {};
  let labelIdx = 0;
  for (const rep of orderedReps) {
    repToCanonical[rep] = generateStateLabel(labelIdx++);
  }

  const equivalenceClasses = [];
  const stateMapping = {};
  const minStates = [];

  for (const rep of orderedReps) {
    const canonical = repToCanonical[rep];
    const members = groupsMap.get(rep);
    equivalenceClasses.push({
      states: members,
      representative: canonical,
    });
    minStates.push(canonical);
    members.forEach((m) => {
      stateMapping[m] = canonical;
    });
  }

  const minTransitions = [];
  const minTransKeys = new Set();

  for (const tr of transitions) {
    const srcRep = find(tr.from);
    const destRep = find(tr.to);
    const srcCanon = repToCanonical[srcRep];
    const destCanon = repToCanonical[destRep];
    const key = `${srcCanon}|${tr.symbol}|${destCanon}`;
    if (!minTransKeys.has(key)) {
      minTransKeys.add(key);
      minTransitions.push({
        from: srcCanon,
        symbol: tr.symbol,
        to: destCanon,
      });
    }
  }

  const minFinalStates = [];
  for (const rep of orderedReps) {
    const canonical = repToCanonical[rep];
    const members = groupsMap.get(rep);
    if (members.some((m) => finalStates.includes(m))) {
      minFinalStates.push(canonical);
    }
  }

  const minDfa = {
    states: minStates,
    alphabet: alphabet,
    startState: repToCanonical[startRep],
    acceptStates: minFinalStates,
    finalStates: minFinalStates,
    transitions: minTransitions,
  };

  return {
    originalStates: states,
    unreachableStates,
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

// Pipeline executor: invokes C++ automatalab_cli binary when present, with Node fallback
function executeAutomataPipeline(alphabet, regex) {
  const cliPaths = [
    path.join(__dirname, 'build', 'automatalab_cli.exe'),
    path.join(__dirname, 'build', 'automatalab_cli'),
    path.join(__dirname, 'automatalab_cli.exe'),
  ];

  for (const cliPath of cliPaths) {
    if (fs.existsSync(cliPath)) {
      try {
        const proc = spawnSync(cliPath, [], {
          input: JSON.stringify({ alphabet, regex }),
          encoding: 'utf8',
          timeout: 10000,
          windowsHide: true,
        });

        if (proc.status === 0 && proc.stdout) {
          const parsed = JSON.parse(proc.stdout.trim());
          if (parsed.success) {
            parsed.engine = 'cpp';
            return parsed;
          }
          return { success: false, error: parsed.error, code: parsed.code };
        }
      } catch (err) {
        console.warn('C++ CLI failed, falling back to Node engine:', err.message);
      }
    }
  }

  // Fallback to internal Node.js engine
  const parseRes = parseRegex(regex, alphabet);
  if (!parseRes.success) {
    return { success: false, error: parseRes.error, code: 'REGEX_PARSE_ERROR' };
  }

  const nfa = buildThompsonNFA(parseRes.root, alphabet);
  const convRes = nfaToDfa(nfa);
  const minRes = minimizeDfa(convRes.dfa);

  const dfaStates = convRes.dfa.states.length;
  const minStates = minRes.minimizedDfa.states.length;
  const reduction = dfaStates > 0 ? Math.max(0, ((dfaStates - minStates) / dfaStates) * 100) : 0;

  return {
    success: true,
    engine: 'node',
    normalizedRegex: parseRes.normalizedRegex,
    automata: {
      epsilonNFA: nfa,
      dfa: convRes.dfa,
      minimizedDFA: minRes.minimizedDfa,
    },
    metrics: {
      epsilonNFAStates: nfa.states.length,
      dfaStates: dfaStates,
      minimizedDFAStates: minStates,
      epsilonNFATransitions: nfa.transitions.length,
      dfaTransitions: convRes.dfa.transitions.length,
      minimizedDFATransitions: minRes.minimizedDfa.transitions.length,
      stateReductionPercentage: reduction,
    },
    traces: {
      conversion: convRes.steps,
      minimization: minRes.table,
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
  req.on('end', async () => {
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
        const parsed = JSON.parse(body);
        const nfa = parsed.nfa || parsed;
        const complete = parsed.complete !== undefined ? parsed.complete : true;
        const result = nfaToDfa(nfa, complete);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      if (url === '/api/minimize' && req.method === 'POST') {
        const parsed = JSON.parse(body);
        const dfa = parsed.dfa || parsed;
        const complete = parsed.complete !== undefined ? parsed.complete : true;
        const result = minimizeDfa(dfa, complete);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      if (url === '/api/simulate' && req.method === 'POST') {
        const { dfa, input: rawInput } = JSON.parse(body);
        const input = (rawInput === 'ε' || rawInput === 'eps' || rawInput === 'epsilon') ? '' : String(rawInput ?? '');
        let cur = dfa.startState;
        const steps = [];
        let accepted = true;
        let rejectionReason = '';

        steps.push({
          stepIndex: 0,
          currentState: cur,
          symbolRead: '',
          nextState: cur,
          remainingString: input,
          description: `START: State '${cur}'`,
        });

        for (let i = 0; i < input.length; i++) {
          const sym = input[i];
          const tr = (dfa.transitions || []).find((t) => t.from === cur && t.symbol === sym);
          if (!tr) {
            accepted = false;
            rejectionReason = `No transition from state '${cur}' on symbol '${sym}'`;
            steps.push({
              stepIndex: i + 1,
              currentState: cur,
              symbolRead: sym,
              nextState: '∅',
              remainingString: input.slice(i + 1),
              description: `DEAD END: No transition from '${cur}' on symbol '${sym}'`,
            });
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
        if (accepted && !finals.includes(cur)) {
          accepted = false;
          rejectionReason = `Halted in non-accepting state '${cur}'`;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            data: {
              accepted,
              finalState: cur,
              rejectionReason,
              steps,
            },
          })
        );
        return;
      }

      if (url === '/api/nfa-simulate' && req.method === 'POST') {
        const { nfa, input: rawInput } = JSON.parse(body);
        const input = (rawInput === 'ε' || rawInput === 'eps' || rawInput === 'epsilon') ? '' : String(rawInput ?? '');
        let curStates = epsilonClosure(nfa, nfa.startState);
        const trace = [];

        // Initial step: epsilon-closure of start state
        const initialEpsTransitions = [];
        for (const tr of nfa.transitions || []) {
          if (isEpsilon(tr.symbol) && curStates.includes(tr.from)) {
            const dests = Array.isArray(tr.to) ? tr.to : [tr.to];
            for (const d of dests) {
              if (curStates.includes(d)) {
                initialEpsTransitions.push({ from: tr.from, symbol: tr.symbol, to: d });
              }
            }
          }
        }

        trace.push({
          stepIndex: 0,
          activeStates: curStates,
          symbolRead: '',
          remainingString: input,
          transitionsTaken: initialEpsTransitions,
          description: `START: ε-closure(${nfa.startState}) = {${curStates.join(', ')}}`,
        });

        let rejectedEarly = false;
        let rejectionReason = '';

        for (let i = 0; i < input.length; i++) {
          const sym = input[i];
          const transitionsTaken = [];
          const moveSet = new Set();

          for (const st of curStates) {
            for (const tr of nfa.transitions || []) {
              if (tr.from === st && tr.symbol === sym) {
                const dests = Array.isArray(tr.to) ? tr.to : [tr.to];
                for (const d of dests) {
                  moveSet.add(d);
                  transitionsTaken.push({ from: st, symbol: sym, to: d });
                }
              }
            }
          }

          const moveArr = Array.from(moveSet).sort();
          const closure = epsilonClosure(nfa, moveArr);

          // Record epsilon transitions taken during closure computation
          for (const tr of nfa.transitions || []) {
            if (isEpsilon(tr.symbol) && closure.includes(tr.from)) {
              const dests = Array.isArray(tr.to) ? tr.to : [tr.to];
              for (const d of dests) {
                if (closure.includes(d)) {
                  transitionsTaken.push({ from: tr.from, symbol: tr.symbol, to: d });
                }
              }
            }
          }

          curStates = closure;

          if (curStates.length === 0) {
            rejectedEarly = true;
            rejectionReason = `No transitions on '${sym}' — active state set became empty ∅`;
            trace.push({
              stepIndex: i + 1,
              activeStates: [],
              symbolRead: sym,
              remainingString: input.slice(i + 1),
              transitionsTaken,
              description: `move on '${sym}' ➔ ∅ (No paths remaining)`,
            });
            break;
          }

          trace.push({
            stepIndex: i + 1,
            activeStates: curStates,
            symbolRead: sym,
            remainingString: input.slice(i + 1),
            transitionsTaken,
            description: `move on '${sym}' ➔ {${moveArr.join(',') || '∅'}} | ε-closure ➔ {${closure.join(', ')}}`,
          });
        }

        const finals = nfa.finalStates || nfa.acceptStates || [];
        const accepted = !rejectedEarly && curStates.some((st) => finals.includes(st));

        if (!accepted && !rejectionReason) {
          rejectionReason = `None of the final active states {${curStates.join(', ')}} are accept states`;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            data: { accepted, trace, rejectionReason },
          })
        );
        return;
      }

      if (url === '/api/language-to-automata' && req.method === 'POST') {
        let reqData;
        try {
          reqData = JSON.parse(body);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Malformed JSON in request body' }));
          return;
        }

        const { alphabet, description, regexOverride } = reqData;

        // Validation
        if (!Array.isArray(alphabet) || alphabet.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Alphabet must be a non-empty array of symbols' }));
          return;
        }

        const cleanAlphabet = Array.from(new Set(alphabet.map((s) => String(s).trim()).filter(Boolean)));
        if (cleanAlphabet.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Alphabet contains no valid symbols' }));
          return;
        }

        if (!regexOverride && (!description || typeof description !== 'string' || !description.trim())) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Language description cannot be empty' }));
          return;
        }

        let interpretation;
        let candidateRegex = '';

        if (regexOverride && typeof regexOverride === 'string' && regexOverride.trim()) {
          candidateRegex = regexOverride.trim();
          interpretation = {
            status: 'success',
            normalizedDescription: description ? description.trim() : 'Custom regular expression',
            alphabet: cleanAlphabet,
            regularExpression: candidateRegex,
            explanation: 'Automata generated directly from user-provided regular expression.',
            assumptions: ['User provided direct regular expression override.'],
            confidence: 1.0,
          };
        } else {
          const aiRes = await interpretLanguageWithAI(description.trim(), cleanAlphabet);

          if (!aiRes.success) {
            res.writeHead(aiRes.code === 'API_KEY_MISSING' ? 400 : 500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: aiRes.error, code: aiRes.code }));
            return;
          }

          interpretation = aiRes.data;

          if (interpretation.status !== 'success') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                status: interpretation.status,
                interpretation,
                error:
                  interpretation.status === 'non_regular'
                    ? `Language is non-regular: ${interpretation.explanation}`
                    : `Clarification needed: ${interpretation.explanation}`,
              })
            );
            return;
          }

          candidateRegex = interpretation.regularExpression;
        }

        // Run C++ or Node automata pipeline
        const pipelineRes = executeAutomataPipeline(cleanAlphabet, candidateRegex);

        if (!pipelineRes.success) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              error: pipelineRes.error,
              code: pipelineRes.code || 'PIPELINE_ERROR',
              interpretation,
            })
          );
          return;
        }

        // Return successful generated response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            interpretation,
            automata: pipelineRes.automata,
            metrics: pipelineRes.metrics,
            traces: pipelineRes.traces,
            engine: pipelineRes.engine,
          })
        );
        return;
      }

      if (url === '/api/examples' && req.method === 'GET') {
        const examples = [
          {
            id: 'contains-bbb',
            name: 'Contains bbb',
            description: "Strings containing three consecutive b's ('bbb')",
            alphabet: ['a', 'b'],
            regex: '(a+b)*bbb(a+b)*',
          },
          {
            id: 'ends-with-01',
            name: 'Ends with 01',
            description: "Strings over {0,1} ending in '01'",
            alphabet: ['0', '1'],
            regex: '(0+1)*01',
          },
          {
            id: 'starts-with-0',
            name: 'Starts with 0',
            description: "Strings over {0,1} starting with '0'",
            alphabet: ['0', '1'],
            regex: '0(0+1)*',
          },
          {
            id: 'contains-ab',
            name: 'Contains ab',
            description: "Strings over {a,b} containing 'ab' as a substring",
            alphabet: ['a', 'b'],
            regex: '(a+b)*ab(a+b)*',
          },
          {
            id: 'even-ones',
            name: 'Even number of 1s',
            description: "Strings over {0,1} containing an even number of '1's",
            alphabet: ['0', '1'],
            regex: '0*(10*10*)*',
          },
          {
            id: 'exactly-two-as',
            name: 'Exactly two a-s',
            description: "Strings over {a,b} with exactly two occurrences of 'a'",
            alphabet: ['a', 'b'],
            regex: 'b*ab*ab*',
          },
        ];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { examples } }));
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
