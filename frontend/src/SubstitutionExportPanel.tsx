import { useEffect, useRef, useState } from 'react';
import type { Data } from './types';
import { projectExport, type CampusChoice } from './substitutionExport';
import { generateSubstitutionPdf } from './substitutionPdf';

type Props = { data?: Data; day: string; initialChoice: CampusChoice; disabled: boolean; specialLabel: (key: string) => string | undefined };
export function SubstitutionExport({ data, day, initialChoice, disabled, specialLabel }: Props) {
  const [choice, setChoice] = useState<CampusChoice>(initialChoice);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; filename: string; warnings: string[] }>();
  const unavailable = useRef(disabled);
  unavailable.current = disabled;
  const latest = useRef(data);
  latest.current = data;
  useEffect(() => {
    latest.current = data;
    setResult(undefined);
    setError('');
    return () => { latest.current = undefined; };
  }, [data]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  const generate = async () => {
    if (!data || !choice || disabled || generating) return;
    setGenerating(true);
    setError('');
    setResult(undefined);
    const snapshot = data;
    try {
      const content = projectExport(snapshot, day, choice, specialLabel);
      if (latest.current !== snapshot || unavailable.current) return;
      const pdf = generateSubstitutionPdf(content);
      setResult({ url: URL.createObjectURL(pdf.output('blob')), filename: `supplenze-${day}-${choice === 'both' ? 'entrambe' : choice === 'centrale' ? 'centrale' : 'separata'}.pdf`, warnings: content.warnings });
    } catch (e) {
      if (latest.current === snapshot) setError(`Impossibile generare il PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setGenerating(false); }
  };
  return <details className="ui-page ui-surface substitution-export">
    <summary>Stampa / PDF</summary>
    <div className="export-controls">
      <label>Sede da esportare <select value={choice} disabled={generating} onChange={e => { setChoice(e.target.value as CampusChoice); setResult(undefined); setError(''); }}>
        <option value="centrale">Centrale</option>
        <option value="succursale">Separata</option>
        <option value="both">Entrambe (un PDF, fogli separati)</option>
      </select></label>
      <button className="ui-button ui-button-primary" type="button" disabled={disabled || !data || !choice || generating} onClick={() => void generate()}>{generating ? 'Generazione…' : 'Genera PDF'}</button>
    </div>
    {generating && <p role="status">Preparazione dei fogli…</p>}
    {error && <p className="ui-notice ui-notice-error" role="alert">{error}</p>}
    {result && <div className="export-result">
      <p role="status">PDF pronto.</p>
      {result.warnings.map(w => <p role="alert" key={w}>{w}</p>)}
      <div className="export-controls">
        <a className="ui-button" href={result.url} download={result.filename}>Scarica PDF</a>
        <a className="ui-button" href={result.url} target="_blank" rel="noopener noreferrer">Apri PDF / Stampa</a>
      </div>
    </div>}
  </details>;
}
