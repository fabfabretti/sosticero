import { useState } from "react";
import type { CampusNotice } from "./types";

export function campusNoticeMessage(notice: CampusNotice, signature: string, recipientName: string): string {
  const rows = [...notice.rows].sort((a, b) => a.h - b.h);
  const periods = [...new Set(rows.map(r => r.h))].map(h => `${h}ª`);
  const hours = periods.length < 2 ? periods[0] : `${periods.slice(0, -1).join(", ")} e ${periods.at(-1)}`;
  const campus = (site: string) => site === "centrale" ? "Centrale" : "Succursale";
  return `[Ore a disposizione] Cambio sede disposizione per le ore ${hours}

Gentile Professore/Professoressa ${recipientName},

la contatto in quanto, per necessità organizzative dell'Istituto, per le sue ore a disposizione ${hours} del giorno ${notice.day.split("-").reverse().join("/")} è richiesta la sua presenza in sede ${campus(notice.destination)}, anziché ${campus(notice.origin)}.

Al momento le sono state assegnate, in ordine, le seguenti supplenze:
${rows.map(r => `${r.h}ª ora — classe ${r.label || r.c}, aula ${r.aula || "da verificare"}`).join("\n")}

Ricordo, per favore, di verificare le sostituzioni effettivamente assegnate sul tabellone delle sostituzioni, e di firmare quelle svolte.

Cordiali saluti,
${signature}`;
}

export function CampusNoticeActions({ notice, signature, recipientName, busy, canAssign, onRefuse, onToggle }: {
  notice: CampusNotice; signature: string; recipientName: string; busy: boolean; canAssign: boolean;
  onRefuse: () => void;
  onToggle: (field: "communicated" | "accepted") => void;
}) {
  const [feedback, setFeedback] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(campusNoticeMessage(notice, signature, recipientName)); setFeedback("Copiato"); }
    catch { setFeedback("Copia non riuscita: accesso agli appunti non disponibile o negato."); }
  }
  const label = notice.rows.map(r => `${r.h}ª ora`).join(", ");
  return <span className="recovery-actions"><span className="opt communicated">
    {([["communicated", "Comunicato"], ["accepted", "Accettata"]] as const).map(([field, text]) => <button key={field} type="button"
      className={notice[field] ? "on" : ""} aria-pressed={notice[field]} disabled={busy || !canAssign}
      title={!canAssign ? `Assegnazione riservata alla sede ${notice.destination}` : undefined}
      aria-label={`${text} cambio sede disposizione, ${label}`} onClick={() => { if (!busy && canAssign) onToggle(field); }}>
      {notice[field] && <span aria-hidden="true">✓ </span>}{text}
    </button>)}
    <button type="button" aria-label={`Copia comunicazione cambio sede disposizione, ${label}`} title="Copia comunicazione cambio sede disposizione" onClick={() => void copy()}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>
    </button>
    <button type="button" className="refuse" disabled={busy || !canAssign}
      title={!canAssign ? `Assegnazione riservata alla sede ${notice.destination}` : `Registra il rifiuto e libera tutte le ore del cambio sede: ${label}`}
      aria-label={`Rifiutata intera comunicazione cambio sede, ${label}`} onClick={() => { if (!busy && canAssign) onRefuse(); }}>Rifiutata (tutte le ore)</button>
  </span><small role="status">{feedback}</small></span>;
}
