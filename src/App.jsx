import React from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, signOut } from './firebase';
import { ToastProvider } from './components/ui.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transfer from './pages/Transfer.jsx';
import Friends from './pages/Friends.jsx';
import Market from './pages/Market.jsx';
import Games from './pages/Games.jsx';
import Earn from './pages/Earn.jsx';
import CardPage from './pages/Card.jsx';

export const ProfileCtx = React.createContext(null);

const NAV = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/transfer', label: 'Transfer', icon: '💸' },
  { to: '/friends', label: 'Friends', icon: '🤝' },
  { to: '/market', label: 'Market', icon: '📈' },
  { to: '/games', label: 'Games', icon: '🎮' },
  { to: '/earn', label: 'Earn', icon: '🎁' },
  { to: '/card', label: 'Card', icon: '💳' },
];

function Shell({ user, profile }) {
  const nav = useNavigate();
  const initial = (profile?.name || '?').trim()[0]?.toUpperCase();
  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand-mark">F</div>
          <div>
            <h1 style={{ fontSize: 16, lineHeight: 1.1 }}>FINB Platinum</h1>
            <div className="faint" style={{ fontSize: 11 }}>Designer Gold · @{profile?.username}</div>
          </div>
          <div className="balance-pill">◈ {Number(profile?.balance ?? 0).toLocaleString()}</div>
          <div className="avatar" title={profile?.name}>{initial}</div>
          <button
            className="btn ghost sm"
            onClick={async () => { await signOut(); nav('/'); }}
          >
            Log out
          </button>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transfer" element={<Transfer />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/market" element={<Market />} />
        <Route path="/games" element={<Games />} />
        <Route path="/earn" element={<Earn />} />
        <Route path="/card" element={<CardPage />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>

      <nav className="bottomnav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>{n.icon}</span> {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const [user, setUser] = React.useState(undefined); // undefined = loading
  const [profile, setProfile] = React.useState(null);

  React.useEffect(() => {
    const un = onAuthStateChanged(auth, (u) => setUser(u || null));
    return un;
  }, []);

  React.useEffect(() => {
    if (!user) { setProfile(null); return; }
    const un = onSnapshot(doc(db, 'users', user.uid), (s) =>
      setProfile(s.exists() ? s.data() : null));
    return un;
  }, [user?.uid]);

  if (user === undefined) {
    return <div className="spinner" />;
  }

  return (
    <ToastProvider>
      <ProfileCtx.Provider value={{ user, profile, refreshKey: user?.uid }}>
        {!user || !profile ? <Auth needsProfile={!!user && !profile} /> : <Shell user={user} profile={profile} />}
      </ProfileCtx.Provider>
    </ToastProvider>
  );
}
