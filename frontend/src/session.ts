import { ApiError } from './concurrency';
export type Account = { id: string; username: string; name: string; campus: 'centrale' | 'succursale' };
export type Session = { account: Account; csrf: string; generation: number };
let session: Session | undefined;
export const currentSession = () => session;
export function setSession(value: Session | undefined) { session = value; }
export async function sessionFetch(url: string, options: RequestInit = {}, generation?: number): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.method && options.method !== 'GET') {
    if (session) headers.set('X-CSRF-Token', session.csrf);
    headers.set('X-Data-Generation', String(generation ?? session?.generation ?? 0));
  }
  const response = await fetch(url, { ...options, headers });
  const latestGeneration = response.headers.get('X-Data-Generation');
  if (session && latestGeneration !== null) session.generation = Math.max(session.generation, Number(latestGeneration));
  if (response.status === 401 && !url.startsWith('/api/auth/')) {
    setSession(undefined);
    window.dispatchEvent(new Event('session-expired'));
  }
  return response;
}
export async function requestApi<T>(url: string, body?: unknown): Promise<T> {
  let generation: number | undefined;
  let value = body;
  if (body && typeof body === 'object') {
    const source = body as Record<string, unknown>;
    value = { ...source };
    generation = source._generation as number | undefined;
    delete (value as Record<string, unknown>)._generation;
    if (source.expected && typeof source.expected === 'object') {
      const expected = { ...(source.expected as Record<string, string>) };
      if ('__generation__' in expected) { generation = Number(expected.__generation__); delete expected.__generation__; }
      (value as Record<string, unknown>).expected = expected;
    }
  }
  const response = await sessionFetch('/api/' + url, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }, generation);
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.detail);
  const revision = Number(response.headers.get('X-Data-Generation') || 0);
  if (data && typeof data === 'object') {
    Object.defineProperty(data, 'generation', { value: revision, enumerable: false });
    if (data.concurrency) data.concurrency.generation = revision;
  }
  return data as T;
}
