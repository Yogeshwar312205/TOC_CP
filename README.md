# AutomataLab — NFA to DFA Conversion & DFA Minimization Web Application

**AutomataLab** is a full-featured educational web application built for visualizing and exploring core concepts in the **Theory of Computation**. It features interactive NFA/$\varepsilon$-NFA creation, NFA $\rightarrow$ DFA subset construction, Myhill-Nerode table-filling DFA minimization, string simulation with real-time state highlighting, and structural automata comparison.

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
   - Built-in library of standard benchmark automata (Ends with '01', Contains '101', Epsilon chains, Redundant state DFAs).

---

## 🏗️ Architecture & Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS v4, Lucide Icons, React Flow (`@xyflow/react`), Dagre Layout, Zustand state management.
- **Backend Algorithms**: High-performance C++17 library (`AutomataEngine`) containing pure algorithms for $\varepsilon$-closure, move, subset construction, unreachable state removal, table-filling minimization, validation, and simulation.
- **REST API**: REST service endpoint layer (`http://localhost:8080/api`) providing JSON API access to all backend algorithms.

---

## 🚀 Getting Started

### 1. Start the API Backend
```bash
# From the project root:
node backend/server.cjs
# Or run C++ backend test suite:
.\backend\build\automatalab_tests.exe
```

### 2. Start the Frontend Development Server
```bash
cd frontend
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🧪 Unit Tests

Run the backend unit test suite:
```bash
cd backend
.\build\automatalab_tests.exe
```
Output:
```text
=== 37 passed, 0 failed ===
```
