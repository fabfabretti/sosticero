import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { currentSession, setSession, requestApi, type Account, type Session } from './session';
const AccountContext = createContext<Account | undefined>(undefined);
export const useAccount = () => useContext(AccountContext);
export function Auth({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account>();
  const [ready, setReady] = useState(false), [locked, setLocked] = useState(false);
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [identity, setIdentity] = useState(0);
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
    void requestApi<Session>('auth/session').then(accept).catch(() => { setReady(true); setLocked(true); });
    const expire = () => { if (document.documentElement.dataset.auth === 'locked') return; lastFocus.current = document.activeElement as HTMLElement; setLocked(true); };
    const logout = async () => {
      try { await requestApi('auth/logout', {}); }
      catch (e) { setError(String(e)); return; }
      setSession(undefined); setAccount(undefined); previous.current=undefined; setIdentity(k=>k+1); setLocked(true); setPassword('');
    };
    const check = () => {
      if (!currentSession() || document.visibilityState === 'hidden') return;
      void requestApi<Session>('auth/session').then(accept).catch(e => { if (e.status === 401) { setSession(undefined); expire(); } });
    };
    const timer = setInterval(check,15000);
    document.addEventListener('visibilitychange',check);
    window.addEventListener('session-expired',expire);
    window.addEventListener('session-logout',logout);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange',check); window.removeEventListener('session-expired',expire); window.removeEventListener('session-logout',logout); };
  }, []);
  return <AccountContext.Provider value={account}>
    {ready && account && <div key={identity} inert={locked} aria-hidden={locked || undefined}>{children}</div>}
    {!ready && <p role="status">Accesso in corso…</p>}
    {ready && (locked || !account) && <div className="auth-backdrop"><section className="auth-login ui-surface" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <h1 id="login-title">Accedi a Sosticero</h1>
      <form onSubmit={async event => { event.preventDefault(); if(busy)return;setBusy(true);setError('');try { accept(await requestApi<Session>('auth/login',{username,password})); } catch(e){setError(String(e));} finally{setBusy(false);} }}>
        <label>Nome utente<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required disabled={busy}/></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></label>
        {error && <p role="alert">{error}</p>}
        <button className="ui-button ui-button-primary" disabled={busy}>Accedi</button>
      </form>
    </section></div>}
  </AccountContext.Provider>;
}
