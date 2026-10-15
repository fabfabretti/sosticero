import { useEffect, useId, useRef, useState } from "react";

export type ImageDraft = { mediaType: string; data: string } | null | undefined;
export type AttachmentMap = Record<string, Record<string, string>>;
export const imageUrl = (id: string) => "/api/attachments/" + encodeURIComponent(id);

export function AttachmentField({ value, saved, onChange, disabled = false }: { value: ImageDraft; saved?: string; onChange: (value: ImageDraft) => void; disabled?: boolean }) {
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { ++generation.current; }, []);
  const preview = value ? `data:${value.mediaType};base64,${value.data}` : value === undefined && saved ? imageUrl(saved) : "";
  return <div className="attachment-field">
    <div className="attachment-paste" tabIndex={disabled ? -1 : 0} role="group" aria-label="Allegato facoltativo: incolla un’immagine" aria-disabled={disabled}
      onPaste={async e => {
        if (disabled) return;
        e.preventDefault();
        const file = Array.from(e.clipboardData.items).find(item => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
        if (!file || !["image/png", "image/jpeg"].includes(file.type)) { setError("Incolla un’immagine PNG o JPEG."); return; }
        if (file.size > 5_242_880) { setError("L’immagine supera 5 MiB."); return; }
        const current = ++generation.current;
        const reader = new FileReader();
        reader.onerror = () => { if (current === generation.current) setError("Impossibile leggere l’immagine."); };
        reader.onload = () => {
          if (current !== generation.current) return;
          onChange({ mediaType: file.type, data: String(reader.result).split(",")[1] });
          setError("");
        };
        reader.readAsDataURL(file);
      }}>
      <span>Allegato facoltativo — incolla qui</span><small>PNG o JPEG · massimo 5 MiB · Ctrl+V</small>
      {preview && <img src={preview} alt="Anteprima allegato" />}
    </div>
    {preview && <button type="button" disabled={disabled} onClick={() => { ++generation.current; onChange(null); setError(""); }}>Rimuovi allegato</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function RecordInfo({ text = "", links = [] }: { text?: string; links?: { label: string; id?: string }[] }) {
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const popupId = useId();
  const hide = () => popup.current?.hidePopover();
  const position = () => {
    const r = trigger.current!.getBoundingClientRect();
    const p = popup.current!;
    const above = r.top > window.innerHeight / 2;
    p.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 246))}px`;
    p.style.top = `${above ? r.top - 6 : r.bottom + 6}px`;
    p.style.maxHeight = `${Math.max(40, (above ? r.top - 6 : window.innerHeight - r.bottom - 6) - 8)}px`;
    p.style.transform = above ? "translateY(-100%)" : "none";
  };
  useEffect(() => {
    const onScroll = (event: Event) => { if (!(event.target instanceof Node && popup.current?.contains(event.target))) hide(); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, []);
  if (!text && !links.some(link => link.id)) return null;
  return <span className="record-info">
    <button type="button" className="info-trigger" ref={trigger} aria-label="Informazioni e allegati" aria-expanded={expanded} aria-haspopup="dialog"
      popoverTarget={popupId} popoverTargetAction="toggle" onClick={position}>i</button>
    <div id={popupId} popover="auto" role="dialog" aria-label="Informazioni e allegati" className="tip record-popover" ref={popup} onToggle={e => setExpanded(e.newState === "open")}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); hide(); trigger.current?.focus(); } }}>
      {text && <p>{text}</p>}
      {links.filter(link => link.id).map(link => <a key={link.label} href={imageUrl(link.id!)} target="_blank" rel="noopener">{link.label}</a>)}
    </div>
  </span>;
}
