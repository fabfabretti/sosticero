import { Loading } from './Loading';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { currentSession, setSession, requestApi, type Account, type Session } from './session';
const AccountContext = createContext<Account | undefined>(undefined);
export const useAccount = () => useContext(AccountContext);
export function Auth({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account>();
  const [ready, setReady] = useState(false), [locked, setLocked] = useState(false);
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState(0);
  const action = useRef(false);
  const sessionRequest = useRef(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const previous = useRef<string | undefined>(undefined);
  const lastFocus = useRef<HTMLElement | null>(null);
  const accept = (value: Session) => {
    if (previous.current && previous.current !== value.account.id) setIdentity(k => k+1);
    previous.current = value.account.id;
    setSession(value); setAccount(value.account); setReady(true); setLocked(false); setError(''); setPassword('');
    const focus = lastFocus.current; lastFocus.current = null;
    requestAnimationFrame(() => focus?.focus({ preventScroll: true }));
  };
  useEffect(() => { document.documentElement.dataset.auth = locked || !ready ? 'locked' : 'active'; }, [locked, ready]);
  useEffect(() => {
    const initial = ++sessionRequest.current;
    void requestApi<Session>('auth/session').then(value => { if (initial === sessionRequest.current) accept(value); }).catch(() => { if (initial === sessionRequest.current) { setReady(true); setLocked(true); } });
    const expire = () => { if (document.documentElement.dataset.auth === 'locked') return; lastFocus.current = document.activeElement as HTMLElement; setLocked(true); };
    const logout = async () => {
      if (action.current) return;
      action.current = true; ++sessionRequest.current; setLoggingOut(true);
      try { await requestApi('auth/logout', {}); }
      catch (e) { setError(String(e)); return; }
      finally { action.current = false; setLoggingOut(false); }
      setSession(undefined); setAccount(undefined); previous.current=undefined; setIdentity(k=>k+1); setLocked(true); setPassword('');
    };
    const check = () => {
      if (action.current || !currentSession() || document.visibilityState === 'hidden') return;
      const n = ++sessionRequest.current;
      void requestApi<Session>('auth/session').then(value => { if (n === sessionRequest.current) accept(value); }).catch(e => { if (n === sessionRequest.current && e.status === 401) { setSession(undefined); expire(); } });
    };
    const timer = setInterval(check,15000);
    document.addEventListener('visibilitychange',check);
    window.addEventListener('session-expired',expire);
    window.addEventListener('session-logout',logout);
    return () => { ++sessionRequest.current; clearInterval(timer); document.removeEventListener('visibilitychange',check); window.removeEventListener('session-expired',expire); window.removeEventListener('session-logout',logout); };
  }, []);
  return <AccountContext.Provider value={account}>
    {ready && account && <div key={identity} inert={locked || loggingOut} aria-hidden={locked || undefined}>{children}</div>}
    {!ready && <Loading label="Accesso in corso…" />}
    {loggingOut && <Loading label="Uscita in corso…" />}
    {ready && !locked && error && <p role="alert">{error}</p>}
    {ready && (locked || !account) && <div className="auth-backdrop"><section className="auth-login ui-surface" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <h1 id="login-title">Accedi a Sosticero</h1>
      <form onSubmit={async event => { event.preventDefault(); if(action.current)return;action.current=true;++sessionRequest.current;setBusy(true);setError('');try { accept(await requestApi<Session>('auth/login',{username,password})); } catch(e){setError(String(e));} finally{action.current=false;setBusy(false);} }}>
        <label>Nome utente<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required disabled={busy}/></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></label>
        {error && <p role="alert">{error}</p>}
        <button className="ui-button ui-button-primary" disabled={busy}>{busy ? <Loading label="Accesso in corso…" /> : "Accedi"}</button>
      </form>
    </section></div>}
  </AccountContext.Provider>;
}
