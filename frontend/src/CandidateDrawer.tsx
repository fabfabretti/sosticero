import { useEffect, useRef } from "react";
import type { Row, Candidate } from "./types";
const category = (c: Candidate) =>
  ({
    RP: "rp",
    C: "comp",
    D: "dis",
    POT:
      c.loc === "centrale"
        ? "pot-c"
        : c.loc === "succursale"
          ? "pot-s"
          : "unknown",
    UTC: "utc",
    UTS: "uts",
    DIS: "dsi",
    TC: "tc",
    DIR: "dir",
    SPECIAL: "special",
    UNCOVERED: "uncovered",
  })[c.ty] || "unknown";
const roleLabel = (r?: string) =>
  r
    ? r === "curricolare"
      ? "Curricolare"
      : r === "sostegno"
        ? "Sostegno"
        : r
    : "";
export function CandidateDrawer({
  open,
  cands,
  current,
  busy,
  name,
  onClose,
  onAssign,
}: {
  open: Row;
  cands: Candidate[];
  current?: string;
  busy: boolean;
  name: (id: string) => string;
  onClose: () => void;
  onAssign: (id: string, exceptional?: boolean) => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            ".dr button:not(:disabled)",
          ),
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  return (
    <div
      className="dr"
      role="dialog"
      aria-modal="true"
      aria-label="Scegli il supplente"
    >
      <header>
        <div>
          <b>
            {open.h}ª ora, classe {open.c}
          </b>
          <p>
            Sostituisce {open.ids.map(name).join(" / ")} · {open.sede || "sede non indicata"}
          </p>
        </div>
        <button ref={close} className="x" aria-label="Chiudi" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="lst">
        {cands.map((c, index) => {
          const cross = !!(c.loc && open.sede && c.loc !== open.sede);
          return (
            <div key={c.id}>
            {c.ty === "RP" && cands[index - 1]?.ty !== "RP" && <h3 className="fallback-title">{c.convenient && !c.why ? "Recuperi permesso · ore favorevoli" : "Altri recuperi permesso"}</h3>}
            {c.exceptional && !cands[index - 1]?.exceptional && <h3 className="fallback-title">Solo in caso di necessità</h3>}
            <button
              disabled={!!c.why || busy || c.enable === false}
              className={
                "c1" +
                (c.enable === false ? " off" : "") +
                (cross ? " cross-site" : "") +
                (current === c.id ? " sel" : "")
              }
              onClick={() => { if (!c.exceptional || window.confirm(`Usare comunque ${c.name} alla ${open.h}ª ora? Tipo occupato: ${c.typeLabel || c.ty}.`)) onAssign(c.id, !!c.exceptional); }}
            >
              <span className="m">
                <b>{c.name}</b>
                <span
                  className={"type-chip-wrapper" + (cross ? " cross-site" : "")}
                >
                  <span className={"type-chip " + (c.color ? "palette-" + c.color : "type-" + category(c))}>
                    {c.typeLabel || (c.ty === "DIS"
                      ? "DI.S"
                      : c.ty === "C"
                        ? "Compresenza"
                        : c.ty === "TC"
                          ? "Rottura compresenza"
                          : c.ty === "D"
                            ? "A disposizione"
                            : c.ty === "UNCOVERED"
                              ? "Scoperta"
                            : c.ty === "SPECIAL"
                              ? "Entrata / uscita"
                              : c.ty)}
                    {c.ty === "POT" ? " · " + (c.loc || "sede ignota") : ""}
                  </span>
                </span>
                {c.exceptional && <b className="exception-action">Usa comunque…</b>}
                <span className="tag">
                  {c.tag}
                  {cross ? " · altra sede" : ""}
                </span>
                {c.clsWeek && (
                  <span className="prof">
                    <span className="cdc">
                      {roleLabel(c.role)}
                      {c.cdcName
                        ? (c.role ? " · " : "") +
                          (c.cdc ? c.cdc + " " : "") +
                          c.cdcName
                        : ""}
                    </span>
                    <span className="cls">
                      {c.clsWeek.map((x) => (
                        <span
                          key={x}
                          className={"chip" + (x === open.c ? " in" : "")}
                        >
                          {x}
                        </span>
                      ))}
                    </span>
                    {c.inClass && <b className="badge">Già in {open.c}</b>}
                  </span>
                )}
                {c.ty === "SPECIAL" && c.info && (
                  <em className="info">{c.info}</em>
                )}
              </span>
              {!["UNCOVERED", "ENTRA", "ESCE", "DIR"].includes(c.id) && <span className="ct">
                <b>{c.total}</b> h assegnate
                <br />
                <b>{c.today}</b> h oggi
              </span>}
            </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
