import { useState } from "react";
import type { Assignment, Row } from "./types";

export function paidMessage(day: string, row: Row): string {
  const date = day.split("-").reverse().join("/");
  return `[Supplenza a pagamento] ${date} · ${row.h}ª ora · ${row.c}

Gentile Professoressa/Professore,

Richiederei la sua presenza per una supplenza a pagamento il ${date}, ${row.h}ª ora, classe ${row.c}, aula ${row.aula || "da verificare"}, sede ${row.sede || "da verificare"}. Le è possibile?

Grazie mille e cordiali saluti,
Fabiola Fabretti`;
}

export function PaidActions({ day, row, assignment, busy, canAssign, onNotify }: {
  day: string; row: Row; assignment: Assignment; busy: boolean; canAssign: boolean; onNotify: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(paidMessage(day, row)); setFeedback("Copiato"); }
    catch { setFeedback("Copia non riuscita: accesso agli appunti non disponibile o negato."); }
  }
  return <span className="recovery-actions"><span className="opt communicated">
    <button type="button" className={assignment.notified ? "on" : ""} aria-pressed={assignment.notified === true}
      disabled={busy || !canAssign} title={!canAssign ? `Assegnazione riservata alla sede ${row.sede || "non indicata"}` : undefined}
      aria-label={`Avvisato ${row.c}, ${row.h}ª ora`} onClick={() => { if (!busy && canAssign) onNotify(); }}>
      {assignment.notified && <span aria-hidden="true">✓ </span>}Avvisato
    </button>
    <button type="button" aria-label={`Copia richiesta supplenza a pagamento ${row.c}, ${row.h}ª ora`} title="Copia richiesta supplenza a pagamento" onClick={() => void copy()}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
    </button>
  </span><small role="status">{feedback}</small></span>;
}
