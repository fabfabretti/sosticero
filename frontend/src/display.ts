export type DisplayTeacher = { name: string; slots: { period: number; classe: string; room: string; replaced: string[] }[] };
export type ScheduleChange = { classe: string; action: 'ENTRA' | 'ESCE'; period: number };
export type DisplayData = { day: string; campus: string; updated: string; teachers: DisplayTeacher[]; changes: ScheduleChange[]; incomplete: boolean };
export type DisplayState = { day: string; data?: DisplayData; error: boolean };

export const romeDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

export function nextMidnight(now = new Date()) {
  const tomorrow = new Date(romeDay(now) + 'T00:00:00Z');
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const offset = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' })
    .formatToParts(tomorrow).find(p => p.type === 'timeZoneName')!.value;
  return tomorrow.getTime() - Number(offset.replace('GMT', '')) * 3600000;
}

// Pack whole measured rows into consecutive columns, preserving alphabetical order.
export function packRows(heights: number[], available: number, columns: number) {
  if (available <= 0 || heights.some(h => h > available)) return undefined;
  const pages: number[][][] = [];
  let page: number[][] = [[]], used = 0;
  heights.forEach((height, index) => {
    if (used + height > available && page.at(-1)!.length) {
      if (page.length === columns) { pages.push(page); page = [[]]; }
      else page.push([]);
      used = 0;
    }
    page.at(-1)!.push(index);
    used += height;
  });
  pages.push(page);
  return pages;
}

export function rotatePages(count: number, change: (next: (current: number) => number) => void) {
  if (count <= 1) return;
  const timer = setInterval(() => change(current => (current + 1) % count), 15000);
  return () => clearInterval(timer);
}

export function startDisplay(campus: string, apply: (state: DisplayState) => void) {
  let state: DisplayState = { day: romeDay(), error: false };
  let pending: AbortController | undefined, stopped = false;
  let midnight: ReturnType<typeof setTimeout>;
  const publish = () => { if (!stopped) apply(state); };
  const refresh = async () => {
    const day = romeDay();
    if (state.day !== day) {
      pending?.abort();
      pending = undefined;
      state = { day, error: false };
      publish();
    }
    if (pending || stopped) return;
    const controller = new AbortController();
    pending = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch('/api/display?campus=' + campus, {
        signal: controller.signal, cache: 'no-store', credentials: 'omit',
      });
      if (!response.ok) throw new Error('Display unavailable');
      const data: DisplayData = await response.json();
      if (stopped || pending !== controller || day !== romeDay()) return;
      if (data.day !== day || data.campus !== campus) throw new Error('Display date mismatch');
      state = { day, data, error: false };
      publish();
    } catch {
      if (!stopped && pending === controller && day === romeDay()) {
        state = { ...state, error: true };
        publish();
      }
    } finally {
      clearTimeout(timeout);
      if (pending === controller) pending = undefined;
    }
  };
  const scheduleMidnight = () => {
    clearTimeout(midnight);
    midnight = setTimeout(() => { void refresh(); scheduleMidnight(); }, Math.max(1, nextMidnight() - Date.now()));
  };
  const visible = () => {
    if (document.visibilityState === 'visible') { void refresh(); scheduleMidnight(); }
  };
  publish();
  void refresh();
  scheduleMidnight();
  const poll = setInterval(() => void refresh(), 30000);
  document.addEventListener('visibilitychange', visible);
  return () => {
    stopped = true;
    pending?.abort();
    clearInterval(poll);
    clearTimeout(midnight);
    document.removeEventListener('visibilitychange', visible);
  };
}
