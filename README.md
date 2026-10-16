# AutomataLab — NFA to DFA Conversion, Minimization & AI Language to Automata

**AutomataLab** is a full-featured educational web application built for visualizing and exploring core concepts in the **Theory of Computation**. It features interactive NFA/$\varepsilon$-NFA creation, NFA $\rightarrow$ DFA subset construction, Myhill-Nerode table-filling DFA minimization, string simulation with real-time state highlighting, structural automata comparison, and an **AI-powered Natural Language to Automata** feature using Google Gemini.

---

## 🌟 Key Features

1. **NFA & $\varepsilon$-NFA Interactive Editor**
   - Add/remove states, set start and accept states.
   - Define custom alphabet symbols and transitions (including $\varepsilon$-transitions).
   - Real-time NFA diagram visualization powered by React Flow with Dagre auto-layout.
   - Export and import automata definitions in standard JSON format.

2. **NFA $\rightarrow$ DFA Subset Construction Algorithm**
   - Computes $\varepsilon$-closures for state sets.
   - Computes $move(S, a)$ for every input symbol.
   - Generates step-by-step subset construction execution trace with narrative explanations.
   - Auto-play and step-by-step navigator highlighting active substates on both graphs.

3. **Myhill-Nerode Table-Filling DFA Minimization**
   - Unreachable state detection and removal.
   - Lower-triangular distinguishability matrix table with step markings and reason indicators.
   - Automatic equivalence class collapsing ($[q_i] \rightarrow q_{rep}$).
   - Metrics showing original state count vs minimized state count and reduction percentage.

4. **Interactive String Simulator**
   - Step-by-step execution trace and fast-forward modes.
   - Support for testing strings on NFA, DFA, or Minimized DFA.
   - Real-time active state and edge path highlighting on diagram graphs.
   - Detailed rejection reason logging for non-accepted strings.

5. **3-Way Automata Comparison & Preset Library**
   - Side-by-side comparative layout of NFA, Converted DFA, and Minimized DFA.
   - Built-in library of standard benchmark automata.

6. **✨ AI Natural Language to Automata** *(NEW)*
   - Describe a formal language in plain English (e.g. *"Strings containing three consecutive b's"*).
   - Gemini AI interprets the description and produces a structured candidate regular expression.
   - AI output passes through a formal regex parser and validator — AI-generated text is never trusted blindly.
   - Thompson's construction (C++17) converts the validated regex to a $\varepsilon$-NFA.
   - Existing subset construction converts $\varepsilon$-NFA → DFA.
   - Existing Myhill-Nerode algorithm minimizes the DFA.
   - All 3 automata displayed in React Flow.
   - Multi-machine consistency simulator verifies ε-NFA, DFA, and minimized DFA agree on every test string.
   - Non-regular language detection (e.g. $a^n b^n$) with formal mathematical explanation.
   - Ambiguous descriptions return clarification-required responses — no silent guessing.

---

## 🏗️ Architecture & Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS v4, Lucide Icons, React Flow (`@xyflow/react`), Dagre Layout, Zustand state management.
- **Backend Algorithms (C++17)**: `AutomataEngine` static library — ε-closure, move, subset construction, unreachable state removal, table-filling minimization, validation, simulation, **RegexParser** (Shunting-Yard), **RegexToNFA** (Thompson's construction).
- **REST API**: Node.js `server.cjs` on port 8080 with all endpoints plus the new `POST /api/language-to-automata`.
- **AI Integration**: Google Gemini API (server-side only) via `aiService.cjs` — credentials never sent to the frontend.
- **CLI Bridge**: `automatalab_cli.exe` — a purpose-built C++ CLI executable invoked by Node.js via `spawnSync` to run the full Regex → NFA → DFA → MinDFA pipeline with native C++17 performance.

---

## 🚀 Getting Started

### 1. Configure the Gemini API Key (Required for AI feature)

```bash
# Copy the example file
cp backend/.env.example backend/.env

# Edit backend/.env and set your API key:
GEMINI_API_KEY=your_key_from_aistudio.google.com
```

> **Without `GEMINI_API_KEY`**: The AI natural language feature will return an error. All other features (editor, conversion, minimization, simulation) remain fully functional. The regex-override mode (supplying a regex directly) also works without an API key.

### 2. Start the API Backend

```bash
# From the project root:
node backend/server.cjs

# Optional: run C++ backend test suite (49 tests):
.\backend\build\automatalab_tests.exe

# Optional: run API integration tests:
node backend/tests/test_api.cjs
```

### 3. Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🧪 Tests

### C++ Unit Tests (49 tests)

```bash
.\backend\build\automatalab_tests.exe
```

```
=== 49 passed, 0 failed ===
```

Covers:
- Regex parser: literals, implicit concat, union, precedence, ε, unbalanced parens, invalid alphabet symbols, empty pattern
- Thompson's construction: valid NFA generation, start/accept states
- End-to-end pipeline equivalence: ε-NFA ↔ DFA ↔ MinDFA on all test strings for "contains bbb" and "ends with 01"
- ε-closure, move, subset construction, Myhill-Nerode minimization, DFA/NFA simulation

### API Integration Tests (6 tests)

```bash
node backend/tests/test_api.cjs
```

```
=== API Tests: 6 passed, 0 failed ===
```

Covers:
- `/api/health`
- Successful language generation with preset pattern matching
- Non-regular language (`a^n b^n`) detection and rejection
- Invalid alphabet symbol rejection
- Unbalanced parentheses regex rejection
- Regex override mode

### Frontend Build + Type Check

```bash
cd frontend && npm run build
```

---

## 📐 Supported Regular Expression Grammar

| Construct | Syntax | Example |
|---|---|---|
| Alphabet symbol | Just the symbol | `a`, `b`, `0`, `1` |
| Concatenation | Implicit (juxtaposition) | `ab`, `a(b+c)` |
| Union | `+` or `|` | `a+b`, `a|b` |
| Kleene star | `*` | `a*`, `(a+b)*` |
| Parentheses | `(` and `)` | `(a+b)*c` |
| Empty string | `ε`, `eps`, or `epsilon` | `a+ε` |

**Operator Precedence** (highest to lowest):
1. Kleene star (`*`)
2. Implicit concatenation
3. Union (`+`)

---

## 🔌 New REST Endpoint

### `POST /api/language-to-automata`

**Request:**
```json
{
  "alphabet": ["a", "b"],
  "description": "Strings containing three consecutive b's",
  "regexOverride": "(a+b)*bbb(a+b)*"
}
```
- `alphabet` (required): Array of single or multi-character symbols
- `description` (required unless `regexOverride` provided): Natural language description
- `regexOverride` (optional): Skip AI, use this regex directly

**Success Response:**
```json
{
  "success": true,
  "interpretation": {
    "status": "success",
    "normalizedDescription": "Strings containing three consecutive b's ('bbb')",
    "regularExpression": "(a+b)*bbb(a+b)*",
    "explanation": "Accepts any string having 'bbb' as a substring...",
    "assumptions": [],
    "confidence": 0.99
  },
  "automata": {
    "epsilonNFA": { "states": [...], "alphabet": [...], ... },
    "dfa": { "states": [...], ... },
    "minimizedDFA": { "states": [...], ... }
  },
  "metrics": {
    "epsilonNFAStates": 22,
    "dfaStates": 9,
    "minimizedDFAStates": 4,
    "stateReductionPercentage": 55.6
  },
  "traces": { "conversion": [...], "minimization": [...] },
  "engine": "cpp"
}
```

**Non-Regular Language Response:**
```json
{
  "success": false,
  "status": "non_regular",
  "interpretation": {
    "explanation": "This language is context-free but NOT regular..."
  }
}
```

---

## 🔒 Security Notes

- `GEMINI_API_KEY` is loaded **server-side only** from `backend/.env`. It is never exposed to the frontend.
- AI-generated regular expressions pass through the **formal parser** before reaching the automata engine — AI output is never executed as code.
- The `automatalab_cli.exe` subprocess receives only JSON arguments; no shell expansion or eval is involved.
- Request bodies are size-limited by Node's built-in buffering; expressions ≤500 characters; nesting depth ≤50.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Node.js server port |
| `GEMINI_API_KEY` | *(required for AI)* | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model name |
