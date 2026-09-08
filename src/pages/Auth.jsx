import React from 'react';
import { signUp, signIn, signInWithGoogle, auth, validUsername } from '../firebase.js';
import { createProfile } from '../lib/bank.js';
import { useToast } from '../components/ui.jsx';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

export default function Auth({ needsProfile }) {
  const [mode, setMode] = React.useState(needsProfile ? 'finish' : 'signin');
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();

  const [form, setForm] = React.useState({ username: '', name: '', password: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  React.useEffect(() => {
    if (needsProfile) {
      setMode('finish');
      const gUser = auth.currentUser;
      if (gUser?.displayName) setForm((f) => ({ ...f, name: gUser.displayName }));
    }
  }, [needsProfile]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = form.username.trim().toLowerCase().replace(/^@/, '');
      if (mode === 'signup') {
        const user = await signUp({ username: u, name: form.name, password: form.password });
        await createProfile(user, { username: u, name: form.name, googleLinked: false });
        toast('Welcome to FINB Platinum! 💳 Link Google in Earn to claim 100 free credits.');
      } else if (mode === 'signin') {
        await signIn({ username: u, password: form.password });
        toast('Welcome back!');
      } else if (mode === 'finish') {
        if (!validUsername(u)) throw new Error('Username must be 3–20 chars: lowercase letters, numbers or _');
        await createProfile(auth.currentUser, {
          username: u,
          name: form.name || auth.currentUser.displayName || 'Platinum Member',
          googleLinked: true,
        });
        toast('Account created — 100 free credits welcome bonus added! 🎉');
      }
    } catch (err) {
      const friendly = err.code === 'auth/email-already-in-use' ? 'That username is already taken.'
        : err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
          ? 'Incorrect username or password.'
        : err.code === 'auth/popup-closed-by-user' ? 'Google sign-in was cancelled.'
        : err.code === 'auth/network-request-failed' ? 'Network error — check your connection.'
        : err.message;
      toast(friendly, 'err');
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      // App detects missing profile and switches to "finish" mode automatically.
    } catch (err) {
      toast(err.code === 'auth/popup-closed-by-user' ? 'Google sign-in was cancelled.' : err.message, 'err');
      setBusy(false);
    }
  };

  const headline =
    mode === 'finish' ? 'Almost there'
    : mode === 'signup' ? 'Create account'
    : 'Welcome back';

  const subline =
    mode === 'finish' ? 'Pick a unique handle and claim your gold card.'
    : mode === 'signup' ? 'Open a free Platinum account in seconds.'
    : 'Sign in to your Fake International Bank.';

  return (
    <div className="auth-wrap">
      <div className="auth-stage">
        <aside className="auth-hero">
          <div>
            <div className="auth-hero-badge">◈ FINB · Designer Gold</div>
            <h2>Bank like a legend. Play like a pro.</h2>
            <p>
              Trade live markets, spin for free credits, and flash a liquid-gold card —
              all inside a zero-stress game bank.
            </p>
            <div className="auth-hero-stats">
              <div className="auth-hero-stat">
                <b>◈100</b>
                <span>Google bonus</span>
              </div>
              <div className="auth-hero-stat">
                <b>8</b>
                <span>Live stocks</span>
              </div>
              <div className="auth-hero-stat">
                <b>4</b>
                <span>Arcade games</span>
              </div>
            </div>
          </div>
          <div className="auth-hero-art" aria-hidden="true" />
          <p className="faint" style={{ fontSize: 12, marginTop: 24 }}>
            Credits are game-only · no real money · est. 2023
          </p>
        </aside>

        <div className="auth-panel">
          <div className="auth-card">
            <div className="brand">
              <div className="brand-mark">F</div>
              <div>
                <h1>Fake International Bank</h1>
                <div className="sub">FINB Platinum · Online</div>
              </div>
            </div>

            <h2 style={{ fontSize: 26, marginTop: 18, marginBottom: 6 }}>{headline}</h2>
            <p className="muted" style={{ fontSize: 14, marginBottom: 4 }}>{subline}</p>

            {needsProfile || mode === 'finish' ? (
              <>
                <form onSubmit={submit} className="mt">
                  <div className="field">
                    <label>Username</label>
                    <div className="input-prefix">
                      <span className="pre">@</span>
                      <input className="input" placeholder="elonmusk_tesla12" value={form.username}
                        onChange={set('username')} autoCapitalize="none" autoFocus />
                    </div>
                  </div>
                  <div className="field">
                    <label>Your name</label>
                    <input className="input" placeholder="Elon Musk" value={form.name} onChange={set('name')} />
                  </div>
                  <button className="btn primary block" disabled={busy}>
                    {busy ? 'Creating…' : 'Claim my gold card & 100 credits'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="auth-tabs">
                  <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
                    Log in
                  </button>
                  <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
                    Sign up
                  </button>
                </div>

                <button type="button" className="google-btn" onClick={google} disabled={busy}>
                  <GoogleIcon /> Continue with Google
                </button>
                <div className="divider">or {mode === 'signin' ? 'log in' : 'register'} with a username</div>

                <form onSubmit={submit}>
                  {mode === 'signup' && (
                    <div className="field">
                      <label>Your name</label>
                      <input className="input" placeholder="Bill Gates" value={form.name} onChange={set('name')} />
                    </div>
                  )}
                  <div className="field">
                    <label>Username</label>
                    <div className="input-prefix">
                      <span className="pre">@</span>
                      <input className="input" placeholder="billgates" value={form.username}
                        onChange={set('username')} autoCapitalize="none" autoFocus />
                    </div>
                  </div>
                  <div className="field">
                    <label>Password</label>
                    <input className="input" type="password" placeholder="••••••••" value={form.password}
                      onChange={set('password')} />
                  </div>
                  <button className="btn primary block" disabled={busy}>
                    {busy ? 'Please wait…' : mode === 'signin' ? 'Log in' : 'Create my gold card'}
                  </button>
                </form>

                {mode === 'signup' ? (
                  <p className="auth-footnote">
                    Free registration — no activation code. Link Google after signing in to grab{' '}
                    <span className="gold">100 free credits</span>.
                  </p>
                ) : (
                  <p className="auth-footnote">
                    New here?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Create a free account
                    </button>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
