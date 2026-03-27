import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Profile from './pages/Profile';
import AuthModal from './pages/AuthModal';
import WalletModal from './pages/WalletModal';
import CrashGame from './pages/CrashGame';
import { WSC } from './lib/wsClient';
import './index.css';

const C = {
  bg: '#08020E',
  bg2: '#0D0208',
  bgCard: 'rgba(180,0,40,0.13)',
  border: 'rgba(255,30,60,0.22)',
  red: '#FF1A3A',
  gold: '#FFD700',
  textMuted: '#AA7788',
  textDim: '#664455',
};

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

  const chip: React.CSSProperties = {
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: '10px',
    padding: '6px 10px',
    cursor: 'pointer',
    textAlign: 'left',
  };

  return (
    <header style={{
      background: C.bg2,
      borderBottom: `1px solid ${C.border}`,
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      padding: '10px 16px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      flexShrink: 0,
    }}>
      {/* Left — Balance chip */}
      <div style={{ display: 'flex' }}>
        <button onClick={state.user ? toggleWallet : onAuthOpen} style={chip}>
          <div style={{ fontSize: '9px', color: C.textMuted, fontWeight: 600, letterSpacing: '1.5px', lineHeight: 1.3 }}>BALANCE</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.gold, lineHeight: 1.2 }}>
            ₹{(state.user?.balance ?? 0).toLocaleString('en-IN')}
          </div>
        </button>
      </div>

      {/* Center — BLAZE */}
      <span style={{ fontSize: '18px', fontWeight: 700, color: C.red, letterSpacing: '4px' }}>BLAZE</span>

      {/* Right — LIVE chip */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ ...chip, cursor: 'default', display: 'flex', alignItems: 'center', gap: '5px', textAlign: 'left' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#00E676' : '#FF1A3A', flexShrink: 0 }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: C.textMuted }}>
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
      background: C.bg2,
      borderTop: `1px solid ${C.border}`,
      display: 'flex',
      flexShrink: 0,
    }}>
      {items.map(item => {
        const active = tab === item.id;
        return (
          <button key={item.id}
            onClick={() => item.id === 'wallet' ? onWalletOpen() : setTab(item.id)}
            style={{
              flex: 1, height: '64px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '4px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? C.red : C.textDim,
            }}>
            <span style={{ fontSize: '22px' }}>{item.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px' }}>{item.label}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#08020E', overflow: 'hidden' }}>
      <Header onAuthOpen={() => setAuthOpen(true)} />
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {tab === 'game'    && <CrashGame navigate={setTab as (t: string) => void} />}
        {tab === 'wallet'  && <div style={{ padding: '20px', color: '#fff' }}>Wallet — use bottom nav</div>}
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
