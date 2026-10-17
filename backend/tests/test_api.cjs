const http = require('http');
const assert = require('assert');

// Start backend server on test port 8089
process.env.PORT = '8089';
require('../server.cjs');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8089,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('Running API integration tests on http://localhost:8089...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[ PASS ] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[ FAIL ] ${name}:`, err.message);
      failed++;
    }
  }

  // Allow server to listen
  await new Promise((r) => setTimeout(r, 600));

  await test('GET /api/health returns ok', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.status, 'ok');
  });

  await test('POST /api/language-to-automata generates three consecutive bs', async () => {
    const res = await request('POST', '/api/language-to-automata', {
      alphabet: ['a', 'b'],
      description: "Strings containing three consecutive b's",
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.automata.epsilonNFA);
    assert(res.data.automata.dfa);
    assert(res.data.automata.minimizedDFA);
    assert(res.data.metrics.epsilonNFAStates > 0);
    assert(res.data.metrics.dfaStates > 0);
    assert(res.data.metrics.minimizedDFAStates > 0);
    assert.strictEqual(res.data.interpretation.regularExpression, '(a+b)*bbb(a+b)*');
  });

  await test('POST /api/language-to-automata handles non-regular language rejection', async () => {
    const res = await request('POST', '/api/language-to-automata', {
      alphabet: ['a', 'b'],
      description: 'equal number of a and b (anbn)',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, false);
    assert(/not regular|non-regular/i.test(res.data.interpretation.explanation));
  });

  await test('POST /api/language-to-automata rejects invalid alphabet symbol', async () => {
    const res = await request('POST', '/api/language-to-automata', {
      alphabet: ['a', 'b'],
      regexOverride: 'a+c',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert(res.data.error.includes('not in declared alphabet'));
  });

  await test('POST /api/language-to-automata rejects unbalanced parentheses', async () => {
    const res = await request('POST', '/api/language-to-automata', {
      alphabet: ['a', 'b'],
      regexOverride: '(a+b',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert(res.data.error.includes('parentheses') || res.data.error.includes('Mismatched'));
  });

  await test('POST /api/language-to-automata with regex override generates automata', async () => {
    const res = await request('POST', '/api/language-to-automata', {
      alphabet: ['0', '1'],
      regexOverride: '(0+1)*01',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.automata.minimizedDFA.alphabet.length, 2);
  });

  await test('POST /api/language-to-automata: All binary strings that start with 10', async () => {
    const res = await request('POST', '/api/language-to-automata', {
      alphabet: ['0', '1'],
      description: "All binary strings that start with '10'",
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    const minDfa = res.data.automata.minimizedDFA;
    assert.strictEqual(minDfa.states.length, 4, `Expected 4 states in complete minimized DFA, got ${minDfa.states.length}: ${JSON.stringify(minDfa.states)}`);
    assert.deepStrictEqual(minDfa.states.sort(), ['A', 'B', 'C', 'D']);
    assert.strictEqual(minDfa.startState, 'A');
    assert.deepStrictEqual(minDfa.finalStates, ['C']);

    // Check complete transitions (8 total transitions, 1 per state/symbol)
    const trans = {};
    for (const t of minDfa.transitions) {
      trans[`${t.from},${t.symbol}`] = t.to;
    }
    assert.strictEqual(trans['A,0'], 'D');
    assert.strictEqual(trans['A,1'], 'B');
    assert.strictEqual(trans['B,0'], 'C');
    assert.strictEqual(trans['B,1'], 'D');
    assert.strictEqual(trans['C,0'], 'C');
    assert.strictEqual(trans['C,1'], 'C');
    assert.strictEqual(trans['D,0'], 'D');
    assert.strictEqual(trans['D,1'], 'D');

    // Simulate required acceptance & rejection strings via /api/simulate
    const testCases = [
      { input: '10', expected: true },
      { input: '100', expected: true },
      { input: '10101', expected: true },
      { input: '11', expected: false },
      { input: '0', expected: false },
      { input: '110', expected: false },
      { input: '', expected: false },
    ];

    for (const tc of testCases) {
      const simRes = await request('POST', '/api/simulate', {
        dfa: minDfa,
        input: tc.input,
      });
      assert.strictEqual(simRes.status, 200);
      assert.strictEqual(
        simRes.data.data.accepted,
        tc.expected,
        `String "${tc.input}" expected accepted=${tc.expected}, got ${simRes.data.data.accepted}`
      );
    }
  });

  await test('POST /api/minimize supports complete and partial DFA modes', async () => {
    // 3-state partial DFA for 10(0+1)* without dead state
    const partialDfa = {
      states: ['A', 'B', 'C'],
      alphabet: ['0', '1'],
      startState: 'A',
      finalStates: ['C'],
      transitions: [
        { from: 'A', symbol: '1', to: 'B' },
        { from: 'B', symbol: '0', to: 'C' },
        { from: 'C', symbol: '0', to: 'C' },
        { from: 'C', symbol: '1', to: 'C' },
      ],
    };

    // When complete: true (default), dead state D is added -> 4 states
    const resComplete = await request('POST', '/api/minimize', {
      dfa: partialDfa,
      complete: true,
    });
    assert.strictEqual(resComplete.status, 200);
    assert.strictEqual(resComplete.data.data.minimizedDfa.states.length, 4);

    // When complete: false, dead state is not added -> 3 states
    const resPartial = await request('POST', '/api/minimize', {
      dfa: partialDfa,
      complete: false,
    });
    assert.strictEqual(resPartial.status, 200);
    assert.strictEqual(resPartial.data.data.minimizedDfa.states.length, 3);
  });

  console.log(`\n=== API Tests: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
