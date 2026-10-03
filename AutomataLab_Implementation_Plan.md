# AutomataLab — Implementation Plan

## Project Overview

**AutomataLab** is a production-quality, full-stack educational web application for visualizing and teaching automata theory. The core algorithms (ε-closure, move, NFA→DFA subset construction, DFA minimization via table-filling) are implemented in **C++20** and exposed via a **Crow** REST API. The **React/TypeScript** frontend communicates with the backend over JSON and renders interactive automata graphs using **React Flow**.

```
d:\TOC_CP\
├── backend/          ← C++20 + Crow + CMake
└── frontend/         ← React + TypeScript + Vite + Tailwind + shadcn/ui
```

---

## Open Questions

> [!IMPORTANT]
> **Q1 — C++ Compiler**: Do you have Visual Studio 2022 (MSVC), MinGW-w64, or LLVM/Clang installed on Windows? This affects the CMake generator and build commands. **Recommended: Visual Studio 2022 with MSVC** (best Windows C++20 support and Crow compatibility).

> [!IMPORTANT]
> **Q2 — CMake & Git**: Are CMake (≥ 3.15) and Git installed? These are required for `FetchContent` to pull Crow and nlohmann/json automatically during the build.

> [!NOTE]
> **Q3 — Node.js**: Node.js ≥ 18 and npm are required for the frontend. Is this already installed?

> [!NOTE]
> **Q4 — Backend Port**: The backend will run on `http://localhost:8080` and the frontend dev server on `http://localhost:5173`. Is this acceptable, or do you need different ports?

> [!WARNING]
> **Tailwind CSS Version**: This plan uses **Tailwind v4** (`@tailwindcss/vite` plugin, no `tailwind.config.js`), which is the current default for both Tailwind and shadcn/ui. If you need v3, say so and I'll use `tailwindcss@3 postcss autoprefixer`.

> [!WARNING]
> **Zod v4 Breaking Changes**: Zod is now at v4.6.5, which has breaking changes from v3. This plan uses Zod v4 with `@hookform/resolvers` v5.2.0+ (required for v4 compatibility). If you need v3 stability, say so.

> [!IMPORTANT]
> **motion package rename**: Framer Motion is now published as `motion` (v13.3.0). Imports use `from "motion/react"` instead of `from "framer-motion"`. This plan uses the new package name.

---

## Technology Stack (Confirmed)

### Backend
| Component | Choice | Version / Notes |
|---|---|---|
| Language | C++17 | `std::set`, `std::map`, `std::vector`, `std::queue` |
| Web framework | Crow | **v1.3.0** — via `FetchContent` |
| JSON | nlohmann/json | **v3.12.0** — via `FetchContent` |
| Async | Asio (standalone) | **asio-1-34-2** — via `FetchContent`; **NO Boost required** |
| Build system | CMake | ≥ 3.15 |

### Frontend
| Component | Choice | Version |
|---|---|---|
| Framework | React + TypeScript | Latest |
| Build tool | Vite | Latest |
| Node.js | — | **20.19+ or 22.12+** (required by Vite 6) |
| CSS | Tailwind CSS v4 | `@tailwindcss/vite` plugin, CSS-first |
| UI components | shadcn/ui | Latest CLI (`npx shadcn@latest`) |
| Graph | @xyflow/react | **v12.11.6** |
| Animations | motion (ex-Framer) | **v13.3.0** — import from `"motion/react"` |
| Icons | Lucide React | **v1.46.0** |
| HTTP client | Axios | **v1.20.0** |
| Forms | React Hook Form | **v7.88.0** |
| Validation | Zod | **v4.6.5** + `@hookform/resolvers` **v5.2.0+** |
| State mgmt | Zustand | Latest — lightweight global state |

---

## Proposed Project Structure

### Backend (`d:\TOC_CP\backend\`)

```
backend/
├── CMakeLists.txt
├── include/
│   ├── Automaton.hpp        ← Shared NFA/DFA data structures
│   ├── NFA.hpp              ← NFA class
│   ├── DFA.hpp              ← DFA class
│   ├── Conversion.hpp       ← NFA→DFA subset construction
│   ├── Minimization.hpp     ← Table-filling DFA minimization
│   ├── Simulator.hpp        ← DFA + NFA simulation
│   └── Validation.hpp       ← Input validation
├── src/
│   ├── main.cpp             ← Crow app, CORS, routes
│   ├── NFA.cpp
│   ├── DFA.cpp
│   ├── Conversion.cpp
│   ├── Minimization.cpp
│   ├── Simulator.cpp
│   └── Validation.cpp
├── tests/
│   ├── test_main.cpp        ← Test runner (simple custom framework)
│   ├── test_epsilon_closure.cpp
│   ├── test_move.cpp
│   ├── test_conversion.cpp
│   ├── test_minimization.cpp
│   └── test_simulator.cpp
└── third_party/             ← Empty (FetchContent handles deps)
```

### Frontend (`d:\TOC_CP\frontend\`)

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── components.json            ← shadcn/ui config
├── public/
│   └── examples/             ← Built-in example JSON files
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css              ← Tailwind v4 + design tokens
    ├── types/
    │   ├── automaton.ts       ← NFA, DFA, Transition interfaces
    │   ├── api.ts             ← API request/response types
    │   └── simulation.ts      ← Step-by-step types
    ├── services/
    │   ├── api.ts             ← Axios instance + all API calls
    │   └── examples.ts        ← Built-in example data
    ├── store/
    │   └── automataStore.ts   ← Zustand global state
    ├── hooks/
    │   ├── useAutomaton.ts
    │   ├── useConversion.ts
    │   ├── useMinimization.ts
    │   └── useSimulator.ts
    ├── components/
    │   ├── ui/                ← shadcn/ui generated components
    │   ├── layout/
    │   │   ├── Sidebar.tsx
    │   │   ├── Header.tsx
    │   │   └── Layout.tsx
    │   ├── graph/
    │   │   ├── AutomataGraph.tsx     ← React Flow wrapper
    │   │   ├── StateNode.tsx         ← Custom React Flow node
    │   │   ├── TransitionEdge.tsx    ← Custom React Flow edge
    │   │   └── GraphControls.tsx
    │   ├── editor/
    │   │   ├── NfaEditor.tsx         ← Form-based NFA editor
    │   │   ├── TransitionTable.tsx
    │   │   ├── StatePanel.tsx
    │   │   └── AlphabetPanel.tsx
    │   ├── conversion/
    │   │   ├── ConversionSteps.tsx   ← Step-by-step display
    │   │   ├── StepCard.tsx
    │   │   └── StepControls.tsx
    │   ├── minimization/
    │   │   ├── DistinguishabilityTable.tsx
    │   │   ├── MinimizationSteps.tsx
    │   │   └── EquivalenceGroups.tsx
    │   ├── simulator/
    │   │   ├── StringSimulator.tsx
    │   │   ├── SimulationTrace.tsx
    │   │   └── SimulatorControls.tsx
    │   └── comparison/
    │       └── ComparisonPanel.tsx
    ├── pages/
    │   ├── Dashboard.tsx
    │   ├── NfaEditor.tsx
    │   ├── ConversionPage.tsx
    │   ├── DfaPage.tsx
    │   ├── MinimizationPage.tsx
    │   ├── SimulatorPage.tsx
    │   ├── ComparisonPage.tsx
    │   ├── ExamplesPage.tsx
    │   └── DocumentationPage.tsx
    └── utils/
        ├── graphLayout.ts     ← Dagre-based auto layout
        ├── stateNaming.ts     ← {q0,q1} → "A","B","C" naming
        └── exportUtils.ts     ← JSON/CSV export helpers
```

---

## Proposed Changes

### Phase 1–8: C++ Backend (Algorithms + Tests)

#### [NEW] [CMakeLists.txt](file:///d:/TOC_CP/backend/CMakeLists.txt)
- `cmake_minimum_required(VERSION 3.15)`, `set(CMAKE_CXX_STANDARD 17)`
- `FetchContent_Declare` for:
  - **Asio standalone** `asio-1-34-2` (from chriskohlhoff/asio)
  - **Crow** `v1.3.0` with `CROW_USE_BOOST OFF` and `CROW_BUILD_EXAMPLES OFF`
  - **nlohmann/json** `v3.12.0` via tarball URL
- `ASIO_STANDALONE` defined as compile definition on all targets
- Separate `AutomataEngine` static library (algorithm code only, no Crow dependency)
- Main executable links `AutomataEngine` + Crow + nlohmann_json
- Test executable links only `AutomataEngine` + nlohmann_json
- MSVC flags: `/W4 /bigobj /EHsc`; GCC/Clang: `-Wall -Wextra`

#### [NEW] [Automaton.hpp](file:///d:/TOC_CP/backend/include/Automaton.hpp)
Core shared data structures:
```cpp
using State = std::string;
using Symbol = std::string;
using StateSet = std::set<State>;

struct NFATransitionKey { State from; Symbol symbol; };
using NFATransitionMap = std::map<std::pair<State,Symbol>, StateSet>;

struct NFA {
    std::set<State> states;
    std::set<Symbol> alphabet;   // does NOT include epsilon
    State startState;
    std::set<State> finalStates;
    NFATransitionMap transitions; // symbol "ε" for epsilon
};

struct DFA {
    std::set<State> states;
    std::set<Symbol> alphabet;
    State startState;
    std::set<State> finalStates;
    std::map<std::pair<State,Symbol>, State> transitions;
    std::map<State, StateSet> stateMapping; // DFA state → original NFA state set
};
```

#### [NEW] [Conversion.hpp / Conversion.cpp](file:///d:/TOC_CP/backend/include/Conversion.hpp)
```cpp
StateSet epsilonClosure(const NFA& nfa, const State& state);
StateSet epsilonClosure(const NFA& nfa, const StateSet& states);
StateSet move(const NFA& nfa, const StateSet& states, const Symbol& sym);
ConversionResult nfaToDfa(const NFA& nfa);
```
`ConversionResult` contains:
- The resulting `DFA`
- `std::vector<ConversionStep>` where each step records: `currentDfaState`, `symbol`, `moveResult`, `epsClosureResult`, `newDfaState`, `transition`

#### [NEW] [Minimization.hpp / Minimization.cpp](file:///d:/TOC_CP/backend/include/Minimization.hpp)
```cpp
std::set<State> reachableStates(const DFA& dfa);
DFA removeUnreachableStates(const DFA& dfa);

// Table-filling
using StatePair = std::pair<State, State>;
using DistTable = std::map<StatePair, bool>;

DistTable initializeTable(const DFA& dfa);
void markFinalNonFinal(const DFA& dfa, DistTable& table);
bool markIndirectlyDistinguishable(const DFA& dfa, DistTable& table); // returns true if any change
MinimizationResult minimizeDfa(const DFA& dfa);
```
`MinimizationResult` contains the minimized `DFA` + all intermediate steps.

#### [NEW] [Simulator.hpp / Simulator.cpp](file:///d:/TOC_CP/backend/include/Simulator.hpp)
```cpp
DFASimulationResult simulateDfa(const DFA& dfa, const std::string& input);
NFASimulationResult simulateNfa(const NFA& nfa, const std::string& input);
```
Each `SimulationStep`: `stepIndex`, `currentState(s)`, `symbol`, `nextState(s)`, `description`

#### [NEW] [Validation.hpp / Validation.cpp](file:///d:/TOC_CP/backend/include/Validation.hpp)
```cpp
ValidationResult validateNFA(const NFA& nfa);
ValidationResult validateDFA(const DFA& dfa);
NFA parseNFAFromJson(const nlohmann::json& j);   // throws on malformed
```

#### [NEW] tests/ — Unit Tests
Custom lightweight test runner (no external library):
- `test_epsilon_closure.cpp` — basic, multi-hop, cycles, no epsilon
- `test_move.cpp` — single/multi-state, missing transitions, empty result
- `test_conversion.cpp` — all 7 built-in examples, verify state counts
- `test_minimization.cpp` — table marking, merge, already-minimal DFA
- `test_simulator.cpp` — accepted/rejected strings, trace verification

---

### Phase 9: Crow REST API

#### [NEW] [main.cpp](file:///d:/TOC_CP/backend/src/main.cpp)
All routes defined here, CORS headers on every response.

| Method | Route | Request Body | Response |
|---|---|---|---|
| `GET` | `/api/health` | — | `{ "status": "ok", "version": "1.0.0" }` |
| `POST` | `/api/validate` | `NFA JSON` | `{ success, errors[] }` |
| `POST` | `/api/convert` | `NFA JSON` | `{ success, data: { dfa, steps[] } }` |
| `POST` | `/api/minimize` | `DFA JSON` | `{ success, data: { minimizedDfa, steps[] } }` |
| `POST` | `/api/simulate` | `{ dfa, input }` | `{ success, data: { accepted, trace[] } }` |
| `POST` | `/api/nfa-simulate` | `{ nfa, input }` | `{ success, data: { accepted, trace[] } }` |
| `POST` | `/api/convert-and-minimize` | `NFA JSON` | `{ success, data: { dfa, minimizedDfa, convSteps[], minSteps[] } }` |
| `GET` | `/api/examples` | — | Built-in example list |

**Error response format:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Transition from 'q5' references unknown state"
  }
}
```

---

### Phase 10–16: React Frontend

#### [NEW] Design System (`src/index.css`)
- Dark mode by default with light mode toggle
- Color palette: Deep navy (`#0A0F1E`) background, electric violet (`#7C3AED`) primary, cyan accent (`#06B6D4`)
- CSS custom properties for all tokens
- Glassmorphism card style: `backdrop-filter: blur(16px)`
- Typography: **Inter** from Google Fonts

#### [NEW] Pages

| Page | Route | Key Features |
|---|---|---|
| Dashboard | `/` | Hero, quick-start cards, recent automata |
| NFA Editor | `/editor` | Graph + form dual editing, transition table |
| NFA→DFA | `/convert` | Step navigator, side-by-side graphs |
| DFA View | `/dfa` | DFA graph, state name legend |
| Minimization | `/minimize` | Interactive distinguishability table |
| Simulator | `/simulate` | Play/pause/step controls, trace |
| Comparison | `/compare` | Three-column stats table |
| Examples | `/examples` | Gallery cards with load button |
| Docs | `/docs` | Algorithm explanations, API reference |

#### [NEW] AutomataGraph Component
- Custom `StateNode`: circular, double border for final states, arrow-in indicator for start state
- Custom `TransitionEdge`: bezier curve, label with symbol, self-loops rendered as quadratic paths
- Dagre layout algorithm for automatic node positioning
- Highlight prop: active state (filled color), active transition (animated dash)
- Controls: fit view, zoom in/out, layout reset, export PNG

#### [NEW] NFA Editor
- **Form panel**: add/delete states, set start/final, add transitions
- **Graph panel**: drag states to reposition, click state to set properties
- Real-time validation with inline error messages (react-hook-form + Zod)
- Import JSON (drag & drop or file picker)
- Export JSON / CSV

#### [NEW] Conversion Page
- Left: NFA graph + transition table
- Center: Step-by-step conversion log with Next/Previous/Play/Reset
- Right: DFA being built incrementally (new states appear as steps progress)
- Each step card shows: current DFA state, symbol, move result, ε-closure, new transition

#### [NEW] Minimization Page
- Original DFA → Reachability → Distinguishability table → Minimized DFA
- Interactive matrix: click any marked cell to see reason
- Color coding: unmarked (gray), marked initial (red), marked indirect (orange)

#### [NEW] Simulator Page
- Input string field with character-by-character highlighting as simulation progresses
- Vertical trace list: state → symbol → state
- Graph highlights current state in gold, active edge in cyan
- Controls: Play (auto-advance), Pause, Next, Previous, Restart, Reset speed slider

#### [NEW] Store (Zustand)
```typescript
interface AutomataStore {
  nfa: NFA | null;
  dfa: DFA | null;
  minimizedDfa: DFA | null;
  conversionSteps: ConversionStep[];
  minimizationSteps: MinimizationStep[];
  setNfa: (nfa: NFA) => void;
  // ... actions
}
```

---

## API JSON Schema (Key Examples)

### NFA Input
```json
{
  "states": ["q0", "q1", "q2"],
  "alphabet": ["0", "1"],
  "startState": "q0",
  "finalStates": ["q2"],
  "transitions": [
    { "from": "q0", "symbol": "0", "to": ["q0", "q1"] },
    { "from": "q0", "symbol": "ε", "to": ["q1"] },
    { "from": "q1", "symbol": "1", "to": ["q2"] }
  ]
}
```

### Conversion Step (in response)
```json
{
  "stepIndex": 3,
  "currentDfaState": "{q0,q1}",
  "symbol": "0",
  "moveResult": ["{q0,q2}"],
  "epsilonClosureResult": ["{q0,q2}"],
  "isNewState": true,
  "transitionAdded": "{q0,q1} --0--> {q0,q2}",
  "description": "move({q0,q1}, 0) = {q0,q2}; ε-closure({q0,q2}) = {q0,q2} [NEW STATE]"
}
```

---

## Built-in Examples

| # | Name | Description |
|---|---|---|
| 1 | Simple NFA | 3 states, no epsilon |
| 2 | ε-NFA | 4 states, multiple epsilon transitions |
| 3 | Strings ending in 01 | Classic NFA, good DFA demo |
| 4 | Strings containing 101 | Overlapping pattern NFA |
| 5 | Multiple same-symbol transitions | Shows non-determinism clearly |
| 6 | Large DFA generation | 5 NFA states → 8+ DFA states |
| 7 | DFA for minimization | Pre-converted DFA with redundant states |

---

## Verification Plan

### Automated (C++ tests)
```bash
cd backend/build
ctest --output-on-failure
```
Tests verify:
- ε-closure on all 7 example NFAs
- subset construction state counts match expected
- table-filling marks correct pairs
- minimized DFA has correct state count
- simulator accepts/rejects correct strings

### Manual Verification
1. Load "Strings ending in 01" example → convert → verify DFA has 4 states
2. Simulate "01", "001", "10" on resulting DFA → verify accept/reject
3. Minimize a DFA with known equivalent states → verify state reduction
4. Import/export round-trip: export JSON, reimport, re-run conversion, verify same result
5. Test all error cases: empty NFA, unknown state in transition, invalid JSON

### Build Verification
```bash
# Backend
cd d:\TOC_CP\backend
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
.\build\Release\automatalab_server.exe

# Frontend
cd d:\TOC_CP\frontend
npm install
npm run dev
```

---

## Development Phases (Execution Order)

```
Phase  1  ─ C++ data structures (Automaton.hpp, NFA.hpp, DFA.hpp)
Phase  2  ─ epsilonClosure() + unit tests
Phase  3  ─ move() + unit tests
Phase  4  ─ nfaToDfa() subset construction + unit tests
Phase  5  ─ DFA simulation + unit tests
Phase  6  ─ removeUnreachableStates() + unit tests
Phase  7  ─ minimizeDfa() table-filling + unit tests
Phase  8  ─ Validation.cpp
Phase  9  ─ Crow REST API (main.cpp + all routes)
Phase 10  ─ Vite + React + Tailwind + shadcn/ui project scaffold
Phase 11  ─ Design system, layout, routing, Zustand store
Phase 12  ─ NFA Editor (form + graph editing)
Phase 13  ─ Conversion page + step visualizer
Phase 14  ─ DFA page + minimization page + distinguishability table
Phase 15  ─ Simulator (play/pause/step)
Phase 16  ─ Comparison page, Examples gallery, Documentation
Phase 17  ─ Import/export (JSON, CSV, PNG)
Phase 18  ─ Polish: toast notifications, error boundaries, loading states
Phase 19  ─ README, setup script, API docs
```

---

## Prerequisites Summary

| Tool | Minimum Version | Purpose |
|---|---|---|
| Visual Studio 2022 (with "Desktop development with C++" workload) OR MinGW-w64 | MSVC 19.3+ / GCC 12+ | C++17 compilation |
| CMake | 3.15 | Build system (`FetchContent`) |
| Git | Any recent | `FetchContent` pulls Crow, Asio, nlohmann |
| Node.js | **20.19+ or 22.12+** | Frontend build (Vite 6 requirement) |
| npm | 10.x | Package management |

> [!CAUTION]
> **MSVC + Crow on Windows requires `/bigobj`** compiler flag — already included in the CMake config. Without it, Crow's heavy template instantiation causes `C1128` "number of sections exceeded object file format limit" errors.

> [!CAUTION]
> **`ASIO_STANDALONE` must be defined** as a compile definition for every target that includes Crow headers. If omitted, Crow will attempt to find Boost and fail.

> [!TIP]
> Once you approve this plan, I will begin execution starting with Phase 1. Each phase will be committed and verifiable before moving to the next. The entire build can be done with two simple commands (one for backend, one for frontend) after setup.
