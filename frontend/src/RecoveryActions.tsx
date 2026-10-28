import { useState } from "react";
import type { Assignment, Row } from "./types";

export type RecoveryRequest = { date: string; periods: number[] } | { date: null };

export function recoveryMessage(day: string, row: Row, permit: RecoveryRequest): string {
  const date = (value: string) => value.split("-").reverse().join("/");
  let clause = "recuperando un'ora del saldo permessi pregresso";
  if (permit.date !== null) {
    const periods = [...permit.periods].sort((a, b) => a - b).map(h => `${h}ª`);
    const hours = periods.length === 1 ? `alla ${periods[0]} ora` : `alle ore ${periods.slice(0, -1).join(", ")} e ${periods.at(-1)}`;
    clause = `recuperando l'ora di permesso presa il ${date(permit.date)} ${hours}`;
  }
  return `[Recupero permesso] ${date(day)} · ${row.h}ª ora · ${row.c}

Gentile Professoressa/Professore,

In assenza di altre soluzioni, richiederei la sua presenza in data/ora
${date(day)} · ${row.h}ª ora classe ${row.c}, aula ${row.aula || "da verificare"}, ${clause}. Le è possibile?

Grazie mille e cordiali saluti,
Fabiola Fabretti`;
}

export function RecoveryActions({ day, row, assignment, permit, busy, canAssign, onAccept }: {
  day: string; row: Row; assignment: Assignment; permit?: RecoveryRequest;
  busy: boolean; canAssign: boolean; onAccept: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const reason = `Assegnazione riservata alla sede ${row.sede || "non indicata"}`;
  const missing = "Permesso collegato non disponibile: impossibile copiare il messaggio.";
  async function copy() {
    setFeedback("");
    if (!permit) { setFeedback(missing); return; }
    try {
      await navigator.clipboard.writeText(recoveryMessage(day, row, permit));
      setFeedback("Copiato");
    } catch {
      setFeedback("Copia non riuscita: accesso agli appunti non disponibile o negato.");
    }
  }
  return <span className="recovery-actions">
    <span className="opt communicated">
      <button type="button" className={assignment.accepted ? "on" : ""} aria-pressed={assignment.accepted === true}
        disabled={busy || !canAssign} title={!canAssign ? reason : undefined}
        aria-label={`Accettata ${row.c}, ${row.h}ª ora${!canAssign ? `. ${reason}` : ""}`}
        onClick={() => { if (!busy && canAssign) onAccept(); }}>
        {assignment.accepted && <span aria-hidden="true">✓ </span>}Accettata
      </button>
      <button type="button" aria-label={`Copia richiesta recupero permesso ${row.c}, ${row.h}ª ora`}
        title={permit ? "Copia richiesta recupero permesso" : missing} disabled={!permit}
        aria-describedby={!permit ? `recovery-${row.k}` : undefined} onClick={() => void copy()}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
      </button>
    </span>
    <small id={`recovery-${row.k}`} role="status">{!permit ? missing : feedback}</small>
  </span>;
}
