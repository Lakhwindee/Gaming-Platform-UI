import { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Profile from './pages/Profile';
import AuthModal from './pages/AuthModal';
import WalletModal from './pages/WalletModal';
import CrashGame from './pages/CrashGame';
import './index.css';

type Tab = 'game' | 'wallet' | 'profile';

function Header({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { state, toggleWallet } = useGame();
  return (
    <header style={{
      height: '56px', background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: '12px',
      position: 'sticky', top: 0, zIndex: 100,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        <span style={{ fontSize: '22px' }}>🚀</span>
        <span style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px', color: '#FF3A3A' }}>BLAZE</span>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
          color: '#00CC66', background: 'rgba(0,204,102,0.12)',
          border: '1px solid rgba(0,204,102,0.3)',
          borderRadius: '6px', padding: '2px 7px',
        }}>● LIVE</span>
      </div>

      {state.user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>BALANCE</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--neon-gold)' }}>
              ₹{state.user.balance.toLocaleString('en-IN')}
            </div>
          </div>
          <button onClick={toggleWallet} style={{
            background: 'var(--primary)', color: '#fff',
            border: 'none', borderRadius: '10px',
            padding: '9px 18px', fontWeight: 800,
            fontSize: '13px', cursor: 'pointer',
          }}>+ Add Money</button>
        </div>
      ) : (
        <button onClick={onAuthOpen} style={{
          background: 'var(--primary)', color: '#fff',
          border: 'none', borderRadius: '10px',
          padding: '10px 22px', fontWeight: 800,
          fontSize: '14px', cursor: 'pointer',
        }}>Sign In / Register</button>
      )}
    </header>
  );
}

function BottomNav({ tab, setTab, onWalletOpen }: { tab: Tab; setTab: (t: Tab) => void; onWalletOpen: () => void }) {
  const items: { id: Tab; icon: string; label: string }[] = [
    { id: 'game',    icon: '🚀', label: 'Game' },
    { id: 'wallet',  icon: '💰', label: 'Wallet' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ];
  return (
    <nav style={{
      height: '64px', background: 'var(--bg2)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      flexShrink: 0,
    }}>
      {items.map(item => {
        const active = tab === item.id;
        return (
          <button key={item.id}
            onClick={() => item.id === 'wallet' ? onWalletOpen() : setTab(item.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '3px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? 'var(--primary)' : 'var(--text3)',
              borderTop: active ? '2px solid var(--primary)' : '2px solid transparent',
              paddingTop: '2px', transition: 'all 0.15s',
            }}>
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function AppContent() {
  const { state, toggleWallet } = useGame();
  const [tab, setTab] = useState<Tab>('game');
  const [authOpen, setAuthOpen] = useState(false);

  function handleWalletOpen() {
    if (!state.user) { setAuthOpen(true); return; }
    toggleWallet();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Header onAuthOpen={() => setAuthOpen(true)} />

      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: tab === 'game' ? 'block' : 'none', height: '100%' }}>
          <CrashGame />
        </div>
        {tab === 'profile' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <Profile onAuthOpen={() => setAuthOpen(true)} />
          </div>
        )}
      </main>

      <BottomNav tab={tab} setTab={setTab} onWalletOpen={handleWalletOpen} />

      {authOpen  && <AuthModal onClose={() => setAuthOpen(false)} />}
      {state.walletOpen && <WalletModal />}
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
