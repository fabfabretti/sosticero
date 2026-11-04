import { Loading } from './Loading';
import { useEffect, useId, useRef, useState } from "react";

export type ImageDraft = { mediaType: string; data: string } | null | undefined;
export type AttachmentMap = Record<string, Record<string, string>>;
export const imageUrl = (id: string) => "/api/attachments/" + encodeURIComponent(id);

export function AttachmentField({ value, saved, onChange, disabled = false, onPendingChange }: { onPendingChange?: (pending: boolean) => void; value: ImageDraft; saved?: string; onChange: (value: ImageDraft) => void; disabled?: boolean }) {
  const [reading, setReading] = useState(false);
  const [imageReady, setImageReady] = useState("");
  const pendingCallback = useRef(onPendingChange);
  pendingCallback.current = onPendingChange;
  const pending = (value: boolean) => { setReading(value); pendingCallback.current?.(value); };
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { ++generation.current; pendingCallback.current?.(false); }, []);
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
        pending(true); setError('');
        const reader = new FileReader();
        reader.onerror = () => { if (current === generation.current) { setError("Impossibile leggere l’immagine. Incolla nuovamente o rimuovi l’allegato."); setReading(false); } };
        reader.onload = () => {
          if (current !== generation.current) return;
          pending(false);
          onChange({ mediaType: file.type, data: String(reader.result).split(",")[1] });
          setError("");
        };
        reader.readAsDataURL(file);
      }}>
      <span>Allegato facoltativo — incolla qui</span><small>PNG o JPEG · massimo 5 MiB · Ctrl+V</small>
      {preview && <img src={preview} alt="Anteprima allegato" onLoad={() => setImageReady(preview)} onError={() => { setImageReady(preview); setError("Impossibile caricare l’anteprima."); }} />}
    </div>
    {(reading || (preview && imageReady !== preview)) && <Loading label="Preparazione allegato…" />}
    {(preview || error) && <button type="button" disabled={disabled} onClick={() => { ++generation.current; pending(false); onChange(null); setError(""); }}>Rimuovi allegato</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function RecordInfo({ text = "", links = [], label = "Informazioni e allegati", hover = false }: { text?: string; links?: { label: string; id?: string }[]; label?: string; hover?: boolean }) {
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const popupId = useId();
  const pinned = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hide = () => { clearTimeout(hideTimer.current); pinned.current = false; popup.current?.hidePopover(); };
  const show = () => { clearTimeout(hideTimer.current); position(); popup.current?.showPopover(); };
  const leave = () => { hideTimer.current = setTimeout(() => { if (!pinned.current) hide(); }, 150); };
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
      clearTimeout(hideTimer.current);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, []);
  if (!text && !links.some(link => link.id)) return null;
  return <span className="record-info"
    onMouseEnter={hover ? show : undefined} onMouseLeave={hover ? leave : undefined}
    onFocus={hover ? show : undefined}
    onBlur={hover ? e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) hide(); } : undefined}
    onKeyDown={hover ? e => { if (e.key === "Escape") { e.preventDefault(); hide(); } } : undefined}>
    <button type="button" className="info-trigger" ref={trigger} aria-label={label} aria-expanded={expanded} aria-haspopup="dialog"
      popoverTarget={popupId} popoverTargetAction="toggle" onClick={e => {
        if (!hover) { position(); return; }
        e.preventDefault();
        if (pinned.current) hide();
        else { show(); pinned.current = true; }
      }}>i</button>
    <div id={popupId} popover="auto" role="dialog" aria-label={label} className="tip record-popover" ref={popup} onToggle={e => { setExpanded(e.newState === "open"); if (e.newState !== "open") pinned.current = false; }}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); hide(); trigger.current?.focus(); } }}>
      {text && <p>{text}</p>}
      {links.filter(link => link.id).map(link => <a key={link.label} href={imageUrl(link.id!)} target="_blank" rel="noopener">{link.label}</a>)}
    </div>
  </span>;
}
