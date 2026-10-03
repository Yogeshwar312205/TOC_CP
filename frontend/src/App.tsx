import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { NfaEditorPage } from './pages/NfaEditorPage';
import { ConversionPage } from './pages/ConversionPage';
import { DfaPage } from './pages/DfaPage';
import { MinimizationPage } from './pages/MinimizationPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { ExamplesPage } from './pages/ExamplesPage';
import { useAutomataStore } from './store/automataStore';
import { AlertCircle, X } from 'lucide-react';

export const App: React.FC = () => {
  const { error, setError } = useAutomataStore();

  return (
    <Router>
      <Layout>
        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs font-mono flex items-center justify-between shadow-lg shadow-rose-950/50 animate-shake">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 rounded-lg hover:bg-rose-900/60 transition-colors"
            >
              <X className="w-4 h-4 text-rose-300" />
            </button>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor" element={<NfaEditorPage />} />
          <Route path="/conversion" element={<ConversionPage />} />
          <Route path="/dfa" element={<DfaPage />} />
          <Route path="/minimization" element={<MinimizationPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="/examples" element={<ExamplesPage />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
