import type { AbsenceKind } from "./types";

export function ClassificationChoices({ value, onChange }: { value: AbsenceKind; onChange: (value: AbsenceKind) => void }) {
  return <div className="opt classification" role="group" aria-label="Tipo di assenza">
    {([["planned", "Programmata"], ["last_minute", "Last minute"], ["trip", "In gita"], ["strike", "In sciopero"]] as const).map(([kind, label]) =>
      <button key={kind} type="button" aria-pressed={value === kind} className={value === kind ? "on" : ""} onClick={() => onChange(value === kind ? null : kind)}>{label}</button>)}
  </div>;
}
