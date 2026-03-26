import { useState, useEffect } from 'react';
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
  return (
    <header style={{
      height: '58px', background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', padding: '0 14px',
      position: 'sticky', top: 0, zIndex: 100, flexShrink: 0,
    }}>
      {/* Left: Balance or Login */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {state.user ? (
          <button onClick={toggleWallet} style={{
            background: 'rgba(255,58,58,0.12)', border: '1px solid rgba(255,58,58,0.28)',
            borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '0.8px' }}>BALANCE</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#FFD700', lineHeight: 1 }}>
              ₹{state.user.balance.toLocaleString('en-IN')}
            </div>
          </button>
        ) : (
          <button onClick={onAuthOpen} style={{
            background: 'var(--primary)', color: '#fff',
            border: 'none', borderRadius: '10px',
            padding: '9px 16px', fontWeight: 800,
            fontSize: '13px', cursor: 'pointer',
          }}>Login / Register</button>
        )}
      </div>

      {/* Center: BLAZE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '2px', color: '#FF3A3A', fontFamily: 'Inter, sans-serif' }}>BLAZE</span>
      </div>

      {/* Right: LIVE badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          background: connected ? 'rgba(0,230,118,0.12)' : 'rgba(255,58,58,0.12)',
          border: `1px solid ${connected ? 'rgba(0,230,118,0.3)' : 'rgba(255,58,58,0.3)'}`,
          borderRadius: '8px', padding: '5px 10px',
        }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: connected ? '#00E676' : '#FF3A3A',
            boxShadow: connected ? '0 0 6px #00E676' : '0 0 6px #FF3A3A',
          }} />
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.8px', color: connected ? '#00E676' : '#FF5555' }}>
            {connected ? 'LIVE' : 'OFF'}
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
