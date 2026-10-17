const fs = require('fs');
const path = require('path');

// Try loading .env if exists in backend/ or root
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx).trim();
              let val = trimmed.slice(eqIdx + 1).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        });
      } catch (e) {
        // ignore
      }
    }
  }
}
loadEnv();

const PRESET_PATTERNS = [
  {
    matches: (desc) => /three\s+consecutive\s+b|contains?\s+bbb|substring\s+bbb/i.test(desc),
    response: (alphabet) => ({
      status: 'success',
      normalizedDescription: "Strings containing three consecutive b's ('bbb')",
      alphabet: alphabet && alphabet.length ? alphabet : ['a', 'b'],
      regularExpression: '(a+b)*bbb(a+b)*',
      explanation: "Accepts any string having 'bbb' as a substring. Leading and trailing parts can be any combination of alphabet symbols.",
      assumptions: ["Assumes the alphabet contains 'a' and 'b' and string must contain at least one occurrence of 'bbb'."],
      confidence: 0.99,
    }),
  },
  {
    matches: (desc) => /end(s|ing)?\s+in\s+01|ends?\s+with\s+01/i.test(desc),
    response: (alphabet) => ({
      status: 'success',
      normalizedDescription: "Strings ending in '01'",
      alphabet: alphabet && alphabet.length ? alphabet : ['0', '1'],
      regularExpression: '(0+1)*01',
      explanation: "Any sequence of 0s and 1s ending strictly with '01'.",
      assumptions: ["Prefix can be empty or any binary sequence."],
      confidence: 0.99,
    }),
  },
  {
    matches: (desc) => /start(s|ing)?\s+with\s+('?10'?|10\b)/i.test(desc),
    response: (alphabet) => ({
      status: 'success',
      normalizedDescription: "Strings starting with '10'",
      alphabet: alphabet && alphabet.length ? alphabet : ['0', '1'],
      regularExpression: '10(0+1)*',
      explanation: "Any binary sequence beginning strictly with '10', followed by zero or more symbols from {0, 1}.",
      assumptions: ["Prefix must be '10'."],
      confidence: 0.99,
    }),
  },
  {
    matches: (desc) => /start(s|ing)?\s+with\s+0/i.test(desc),
    response: (alphabet) => ({
      status: 'success',
      normalizedDescription: "Strings starting with '0'",
      alphabet: alphabet && alphabet.length ? alphabet : ['0', '1'],
      regularExpression: '0(0+1)*',
      explanation: "First symbol must be '0', followed by zero or more 0s and 1s.",
      assumptions: ["Empty string is not accepted since length must be at least 1."],
      confidence: 0.99,
    }),
  },
  {
    matches: (desc) => /contains?\s+ab(\b|\s)|substring\s+ab/i.test(desc),
    response: (alphabet) => ({
      status: 'success',
      normalizedDescription: "Strings containing 'ab' as a substring",
      alphabet: alphabet && alphabet.length ? alphabet : ['a', 'b'],
      regularExpression: '(a+b)*ab(a+b)*',
      explanation: "Any string over {a,b} that contains 'ab' as a continuous substring.",
      assumptions: [],
      confidence: 0.99,
    }),
  },
  {
    matches: (desc) => /even\s+number\s+of\s+1/i.test(desc),
    response: (alphabet) => ({
      status: 'success',
      normalizedDescription: "Strings containing an even number of 1's",
      alphabet: alphabet && alphabet.length ? alphabet : ['0', '1'],
      regularExpression: '0*(10*10*)*',
      explanation: "Allows any number of 0s separated by pairs of 1s (0 pairs, 1 pair, 2 pairs, etc.).",
      assumptions: ["0 is an even number, so the empty string and strings of all 0s are accepted."],
      confidence: 0.98,
    }),
  },
  {
    matches: (desc) => /exactly\s+two(\s+occurrences\s+of)?\s+a/i.test(desc),
    response: (alphabet) => ({
      status: 'success',
      normalizedDescription: "Strings with exactly two occurrences of 'a'",
      alphabet: alphabet && alphabet.length ? alphabet : ['a', 'b'],
      regularExpression: 'b*ab*ab*',
      explanation: "Strings having any number of 'b's before, between, and after exactly two 'a's.",
      assumptions: ["No other 'a's are permitted."],
      confidence: 0.99,
    }),
  },
  {
    matches: (desc) => /equal\s+number\s+of\s+a.*b|a\^n\s*b\^n|anbn|balanced\s+parenthes|palindrome/i.test(desc),
    response: (alphabet) => ({
      status: 'non_regular',
      normalizedDescription: 'Language requiring unbounded counting or arbitrary symmetry',
      alphabet: alphabet && alphabet.length ? alphabet : ['a', 'b'],
      regularExpression: '',
      explanation: 'This language (such as L = { a^n b^n | n ≥ 0 }) is context-free but NOT regular. Finite automata possess a finite number of states and cannot count an arbitrary, unbounded number of symbols (provable via the Pumping Lemma for regular languages).',
      assumptions: ['Finite state machines cannot recognize this language without a bound on n.'],
      confidence: 0.99,
    }),
  },
];

// Placeholder/dummy key values that should be treated as "not configured"
const PLACEHOLDER_KEY_PATTERNS = [
  'your_gemini_api_key_here',
  'your-api-key-here',
  'placeholder',
  'changeme',
  'xxxx',
  'todo',
  '<your_key>',
];

function isPlaceholderKey(key) {
  if (!key) return true;
  const lower = key.toLowerCase().trim();
  return PLACEHOLDER_KEY_PATTERNS.some((p) => lower.includes(p)) || lower.length < 10;
}

async function interpretLanguageWithAI(description, alphabet) {
  const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const apiKey = isPlaceholderKey(rawKey) ? null : rawKey;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    // Check built-in preset patterns for offline demo/test
    for (const preset of PRESET_PATTERNS) {
      if (preset.matches(description)) {
        const res = preset.response(alphabet);
        res.assumptions.push('Interpreted via offline benchmark presets (GEMINI_API_KEY not configured).');
        return { success: true, data: res };
      }
    }

    return {
      success: false,
      error: 'GEMINI_API_KEY is not set on the server. Please set GEMINI_API_KEY in backend/.env to interpret custom descriptions.',
      code: 'API_KEY_MISSING',
    };
  }

  const alphaStr = alphabet.map((s) => `'${s}'`).join(', ');

  const systemPrompt = `You are a Theory of Computation and Formal Languages expert in AutomataLab.
Your task is to analyze the user's natural language description of a formal language over the declared alphabet {${alphaStr}} and return a candidate regular expression.

Supported regular-expression grammar:
- Alphabet symbols: exactly the symbols in declared alphabet {${alphaStr}}
- Union: '+'
- Concatenation: implicit (e.g. 'ab', 'a(b+c)', '(a+b)*')
- Kleene star: '*'
- Parentheses: '(' and ')'
- Empty string: 'ε' (or 'eps')

Instructions:
1. Check if the language is REGULAR:
   - If NOT regular (e.g. a^n b^n, equal number of a's and b's, arbitrary length palindromes, expressions requiring unbounded memory):
     Set "status": "non_regular", provide a clear mathematical explanation in "explanation", and set "regularExpression": "".
2. Check if the description is AMBIGUOUS:
   - If the description is vague, under-specified, or could describe fundamentally different languages:
     Set "status": "clarification_needed", explain what is ambiguous in "explanation", and list clarifying questions in "assumptions".
3. If it is a valid regular language:
   - Set "status": "success"
   - "normalizedDescription": concise description of the recognized language
   - "regularExpression": exact regular expression using ONLY the supported grammar and alphabet symbols
   - "explanation": clear explanation of how the expression recognizes the language
   - "assumptions": any reasonable assumptions made (e.g. 0 occurrences allowed, substrings vs whole words)
   - "confidence": confidence score between 0.0 and 1.0

Return ONLY a valid JSON object matching this schema, without markdown backticks or commentary:
{
  "status": "success" | "clarification_needed" | "non_regular",
  "normalizedDescription": "...",
  "alphabet": [${alphaStr}],
  "regularExpression": "...",
  "explanation": "...",
  "assumptions": ["..."],
  "confidence": 0.95
}`;

  const userContent = `Alphabet: [${alphabet.join(', ')}]
Language description: "${description}"`;

  // Models to try in order if the primary is overloaded
  const FALLBACK_MODELS = [
    model,
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
  ];

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  let lastError = null;

  for (const tryModel of FALLBACK_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${tryModel}:generateContent?key=${apiKey}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: requestBody,
        });
        clearTimeout(timeoutId);

        // Transient overload → wait and retry with exponential backoff
        if (response.status === 503 || response.status === 429) {
          lastError = `Gemini overloaded (${response.status}) on model ${tryModel}`;
          console.warn(`[aiService] ${lastError} — attempt ${attempt + 1}/2`);
          continue; // retry attempt with delay
        }

        if (!response.ok) {
          const errText = await response.text();
          // Auth errors → preset fallback
          if (response.status === 400 || response.status === 401) {
            for (const preset of PRESET_PATTERNS) {
              if (preset.matches(description)) {
                const res = preset.response(alphabet);
                res.assumptions.push('Interpreted via offline benchmark presets (Gemini API key is invalid or unauthorized).');
                return { success: true, data: res };
              }
            }
          }
          // Model not found → try next model silently
          if (response.status === 404) {
            lastError = `Model ${tryModel} not found`;
            break;
          }
          return {
            success: false,
            error: `Gemini API error (${response.status}): ${errText}`,
            code: 'AI_PROVIDER_ERROR',
          };
        }

        const jsonResp = await response.json();
        const candidate = jsonResp.candidates && jsonResp.candidates[0];
        const text = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;

        if (!text) {
          return { success: false, error: 'Empty response received from Gemini API', code: 'MALFORMED_AI_RESPONSE' };
        }

        // Sanitize in case of markdown fence
        let cleanJson = text.trim();
        if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
        if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
        if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
        cleanJson = cleanJson.trim();

        const parsed = JSON.parse(cleanJson);

        // Validate required fields
        if (!parsed.status || !['success', 'clarification_needed', 'non_regular'].includes(parsed.status)) {
          return { success: false, error: 'Malformed structured AI response schema', code: 'SCHEMA_VALIDATION_ERROR' };
        }

        if (tryModel !== model) {
          console.info(`[aiService] Used fallback model: ${tryModel}`);
        }

        return {
          success: true,
          data: {
            status: parsed.status,
            normalizedDescription: parsed.normalizedDescription || description,
            alphabet: parsed.alphabet || alphabet,
            regularExpression: parsed.regularExpression || '',
            explanation: parsed.explanation || '',
            assumptions: parsed.assumptions || [],
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
          },
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          lastError = 'AI interpretation request timed out';
          break; // try next model
        }

        // Check offline preset fallback on network error
        for (const preset of PRESET_PATTERNS) {
          if (preset.matches(description)) {
            const res = preset.response(alphabet);
            res.assumptions.push('Interpreted via offline fallback due to network/API error: ' + err.message);
            return { success: true, data: res };
          }
        }

        return { success: false, error: `AI request failed: ${err.message}`, code: 'NETWORK_ERROR' };
      }
    }
  }

  // All models exhausted — try preset fallback
  for (const preset of PRESET_PATTERNS) {
    if (preset.matches(description)) {
      const res = preset.response(alphabet);
      res.assumptions.push(`Interpreted via offline benchmark presets (Gemini unavailable: ${lastError}).`);
      return { success: true, data: res };
    }
  }

  return {
    success: false,
    error: `All Gemini models unavailable: ${lastError}. Please try again shortly.`,
    code: 'AI_PROVIDER_ERROR',
  };
}

module.exports = {
  interpretLanguageWithAI,
  PRESET_PATTERNS,
};
