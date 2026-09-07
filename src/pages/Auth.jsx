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

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <h1>Fake International Bank</h1>
            <div className="sub">FINB Platinum · Online · Estd 2023</div>
          </div>
        </div>

        {needsProfile || mode === 'finish' ? (
          <>
            <p className="muted center mt" style={{ fontSize: 14 }}>
              Choose your unique handle to finish setting up your Platinum account.
            </p>
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
                {busy ? 'Creating…' : 'Claim my card & 100 credits'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="auth-tabs">
              <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Log in</button>
              <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
            </div>

            <button className="google-btn" onClick={google} disabled={busy}>
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
                {busy ? 'Please wait…' : mode === 'signin' ? 'Log in' : 'Create my Platinum card'}
              </button>
            </form>

            {mode === 'signup' && (
              <p className="faint center mt" style={{ fontSize: 12 }}>
                Registration is free — no activation code needed. Link Google after signing in to
                grab <span className="gold">100 free credits</span>.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
