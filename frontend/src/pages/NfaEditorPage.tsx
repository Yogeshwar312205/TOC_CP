import React from 'react';
import { useAutomataStore } from '../store/automataStore';
import { NfaEditor } from '../components/editor/NfaEditor';
import { AutomataGraph } from '../components/graph/AutomataGraph';
import { exportAutomatonToJson, importAutomatonFromJson } from '../utils/exportUtils';
import { Download, Upload, GitCompare, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NfaEditorPage: React.FC = () => {
  const { nfa, validation, setNfa, setError } = useAutomataStore();
  const navigate = useNavigate();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importAutomatonFromJson(
        file,
        (importedNfa) => setNfa(importedNfa),
        (err) => setError(err)
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            NFA / ε-NFA Interactive Editor
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Build your non-deterministic finite automaton or import a JSON specification.
          </p>
        </div>

        <div className="flex gap-2">
          <label className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5 text-cyan-400" /> Import JSON
            <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
          </label>

          <button
            onClick={() => exportAutomatonToJson(nfa, 'nfa_definition.json')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" /> Export JSON
          </button>

          <button
            onClick={() => navigate('/conversion')}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <GitCompare className="w-3.5 h-3.5" /> Convert to DFA
          </button>
        </div>
      </div>

      {/* Validation Banner if present */}
      {validation && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
            validation.valid
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          <span>Validation Result: {validation.valid ? 'VALID NFA' : 'INVALID DEFINITION'}</span>
          <span className="text-slate-400">{validation.message}</span>
        </div>
      )}

      {/* Grid: Editor Left (40%), Graph Right (60%) */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5">
          <NfaEditor />
        </div>
        <div className="col-span-7 h-[700px]">
          <AutomataGraph automaton={nfa} title="Active NFA State Diagram" />
        </div>
      </div>
    </div>
  );
};
