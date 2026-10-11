import { useEffect, useRef } from "react";
import type { Row, Candidate } from "./types";
const category = (c: Candidate) =>
  ({
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
  })[c.ty] || "unknown";
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
  onAssign: (id: string) => void;
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
            Sostituisce {name(open.id)} · {open.sede || "sede non indicata"}
          </p>
        </div>
        <button ref={close} className="x" aria-label="Chiudi" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="lst">
        {cands.map((c) => {
          const cross = !!(c.loc && open.sede && c.loc !== open.sede);
          return (
            <button
              key={c.id}
              disabled={!!c.why || busy}
              className={
                "c1" +
                (cross ? " cross-site" : "") +
                (current === c.id ? " sel" : "")
              }
              onClick={() => onAssign(c.id)}
            >
              <span className="m">
                <b>{c.name}</b>
                <span
                  className={"type-chip-wrapper" + (cross ? " cross-site" : "")}
                >
                  <span className={"type-chip type-" + category(c)}>
                    {c.ty === "DIS"
                      ? "DI.S"
                      : c.ty === "C"
                        ? "Compresenza"
                        : c.ty === "TC"
                          ? "Rottura compresenza"
                          : c.ty === "D"
                            ? "A disposizione"
                            : c.ty === "SPECIAL"
                              ? "Entrata / uscita"
                              : c.ty}
                    {c.ty === "POT" ? " · " + (c.loc || "sede ignota") : ""}
                  </span>
                </span>
                <span className="tag">
                  {c.tag}
                  {cross ? " · altra sede" : ""}
                </span>
              </span>
              <span className="ct">
                <b>{c.total}</b> h assegnate
                <br />
                <b>{c.today}</b> h oggi
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
