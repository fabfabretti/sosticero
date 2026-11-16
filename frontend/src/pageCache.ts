// Session memory only: snapshots never survive logout or a browser reload.
export const PAGE_FRESH_MS = 15000;
type Snapshot = { value: unknown; receivedAt: number };
const snapshots = new Map<string, Snapshot>();
const flights = new Map<string, Promise<unknown>>();
let epoch = 0;
export const pageCacheEpoch = () => epoch;
export function clearPageCache() { ++epoch; snapshots.clear(); flights.clear(); }
export function cachedPage<T>(key: string) { return snapshots.get(key) as { value: T; receivedAt: number } | undefined; }
export function loadPage<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = flights.get(key);
  if (existing) return existing as Promise<T>;
  const owner = epoch;
  const request = load().then(value => {
    if (owner !== epoch) throw new Error('Dati aggiornati durante il caricamento. Riprova.');
    snapshots.delete(key);
    snapshots.set(key, { value, receivedAt: Date.now() });
    // Bound memory when staff browse many different dates.
    if (snapshots.size > 30) snapshots.delete(snapshots.keys().next().value!);
    return value;
  }).finally(() => { if (flights.get(key) === request) flights.delete(key); });
  flights.set(key, request);
  return request;
}
