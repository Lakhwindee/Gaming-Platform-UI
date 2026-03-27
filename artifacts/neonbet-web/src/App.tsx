import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Profile from './pages/Profile';
import AuthModal from './pages/AuthModal';
import WalletModal from './pages/WalletModal';
import CrashGame from './pages/CrashGame';
import { WSC } from './lib/wsClient';
import './index.css';

type Tab = 'game' | 'wallet' | 'profile';

function Header({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { state, toggleWallet } = useGame();
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick(n => n + 1);
    WSC.listeners.add(update);
    return () => { WSC.listeners.delete(update); };
  }, []);
  const connected = WSC.state.connected;
  const chipStyle: React.CSSProperties = {
    backgroundColor: 'rgba(180,0,40,0.13)',
    borderRadius: '10px',
    border: '1px solid rgba(255,30,60,0.22)',
    padding: '6px 10px',
    cursor: 'pointer',
    textAlign: 'left' as const,
  };
  return (
    <header style={{
      background: 'var(--bg2)',
      borderBottom: '1px solid rgba(255,30,60,0.22)',
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', padding: '10px 16px',
      position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
    }}>
      {/* Left: Balance chip */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={state.user ? toggleWallet : onAuthOpen} style={chipStyle}>
          <div style={{ fontSize: '9px', color: '#AA7788', fontWeight: 600, letterSpacing: '1.5px', lineHeight: 1.2 }}>BALANCE</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFD700', lineHeight: 1.2 }}>
            ₹{(state.user?.balance ?? 0).toLocaleString('en-IN')}
          </div>
        </button>
      </div>

      {/* Center: BLAZE */}
      <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '4px', color: '#FF1A3A' }}>BLAZE</span>

      {/* Right: LIVE chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', ...chipStyle, cursor: 'default' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: connected ? '#00E676' : '#FF1A3A',
          }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#AA7788' }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <Header onAuthOpen={() => setAuthOpen(true)} />

      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {tab === 'game'    && <CrashGame navigate={setTab as (t: string) => void} />}
        {tab === 'wallet'  && <div style={{ padding: '20px', color: '#fff' }}>Open wallet via bottom nav</div>}
        {tab === 'profile' && <Profile />}
      </main>

      <BottomNav tab={tab} setTab={setTab} onWalletOpen={handleWalletOpen} />

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
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
