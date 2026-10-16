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

  console.log(`\n=== API Tests: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
