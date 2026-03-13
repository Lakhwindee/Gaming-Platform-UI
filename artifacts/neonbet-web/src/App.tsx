import { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Lobby from './pages/Lobby';
import CrashGame from './pages/CrashGame';
import DiceGame from './pages/DiceGame';
import CoinFlipGame from './pages/CoinFlipGame';
import Leaderboard from './pages/Leaderboard';
import History from './pages/History';
import Profile from './pages/Profile';
import AuthModal from './pages/AuthModal';
import './index.css';

function NavBar({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { state, navigate, logout } = useGame();
  const { user, page } = state;

  const navItems = [
    { id: 'lobby', label: 'Lobby', icon: '🎮' },
    { id: 'leaderboard', label: 'Ranks', icon: '🏆' },
    { id: 'history', label: 'History', icon: '📋' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: '64px',
      background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('lobby')}>
        <span style={{ fontSize: '24px' }}>⚡</span>
        <span style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.5px' }}>
          <span style={{ color: 'var(--neon-blue)' }}>Neon</span>
          <span style={{ color: 'var(--text)' }}>Bet</span>
        </span>
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => navigate(item.id)} style={{
            padding: '8px 16px', borderRadius: '10px', border: 'none',
            background: page === item.id ? 'var(--neon-blue)15' : 'transparent',
            color: page === item.id ? 'var(--neon-blue)' : 'var(--text2)',
            fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            borderBottom: page === item.id ? '2px solid var(--neon-blue)' : '2px solid transparent',
            transition: 'all 0.2s',
          }}>
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {user ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--bg3)', borderRadius: '10px', padding: '8px 14px',
              border: '1px solid var(--border)',
            }}>
              <span style={{ color: 'var(--neon-gold)', fontSize: '14px' }}>⚡</span>
              <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '15px' }}>
                {user.balance.toLocaleString()}
              </span>
              <span style={{ color: 'var(--text3)', fontSize: '12px' }}>pts</span>
            </div>
            <button onClick={() => navigate('profile')} style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '8px 14px', color: 'var(--text)',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}>
              👤 {user.username}
            </button>
            <button onClick={logout} style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '8px 14px', color: 'var(--text2)',
              fontSize: '14px', cursor: 'pointer',
            }}>
              Sign Out
            </button>
          </>
        ) : (
          <button onClick={onAuthOpen} style={{
            background: 'var(--neon-blue)', border: 'none',
            borderRadius: '10px', padding: '10px 20px', color: '#000',
            fontWeight: 700, fontSize: '14px', cursor: 'pointer',
          }}>
            Sign In / Register
          </button>
        )}
      </div>
    </nav>
  );
}

function AppContent() {
  const { state } = useGame();
  const [authOpen, setAuthOpen] = useState(false);

  const renderPage = () => {
    if (state.activeGame === 'crash') return <CrashGame />;
    if (state.activeGame === 'dice') return <DiceGame />;
    if (state.activeGame === 'coinflip') return <CoinFlipGame />;

    switch (state.page) {
      case 'lobby': return <Lobby />;
      case 'leaderboard': return <Leaderboard />;
      case 'history': return <History />;
      case 'profile': return <Profile onAuthOpen={() => setAuthOpen(true)} />;
      default: return <Lobby />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NavBar onAuthOpen={() => setAuthOpen(true)} />
      <main>{renderPage()}</main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
