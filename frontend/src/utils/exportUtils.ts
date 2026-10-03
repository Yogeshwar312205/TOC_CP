import type { NFA, DFA } from '../types/automaton';

export const exportAutomatonToJson = (automaton: NFA | DFA, filename: string = 'automaton.json') => {
  const jsonStr = JSON.stringify(automaton, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const importAutomatonFromJson = (
  file: File,
  onSuccess: (automaton: NFA) => void,
  onError: (err: string) => void
) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const parsed = JSON.parse(content);
      if (!parsed.states || !parsed.alphabet || !parsed.transitions || !parsed.startState) {
        onError('Invalid automaton JSON structure.');
        return;
      }
      onSuccess(parsed as NFA);
    } catch {
      onError('Failed to parse JSON file.');
    }
  };
  reader.readAsText(file);
};
