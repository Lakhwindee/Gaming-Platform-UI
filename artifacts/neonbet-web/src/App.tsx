import { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Profile from './pages/Profile';
import AuthModal from './pages/AuthModal';
import Wallet from './pages/Wallet';
import CrashGame from './pages/CrashGame';
import { WSC } from './lib/wsClient';
import './index.css';

type Tab = 'game' | 'wallet' | 'profile';

function RocketIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 512 512" fill={color}>
      <path d="M328 32C228 32 144 100 128 224L64 288l80 16 16 80 64-64c124-16 192-100 192-200 0-8-88-88-88-88zM208 304l-16 80-32-32 48-48z" opacity="0.9" />
      <path d="M256 192c0-17.7-14.3-32-32-32s-32 14.3-32 32 14.3 32 32 32 32-14.3 32-32z" fill={color === '#FF3A3A' ? '#fff' : '#fff'} opacity="0.9" />
    </svg>
  );
}
function WalletIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 512 512" fill={color}>
      <rect x="48" y="96" width="416" height="352" rx="32" ry="32" fill="none" stroke={color} strokeWidth="32" />
      <path d="M48 192h416M336 288a16 16 0 010 32H336a16 16 0 010-32z" fill="none" stroke={color} strokeWidth="32" strokeLinecap="round" />
      <path d="M112 96V64a16 16 0 0116-16h256a16 16 0 0116 16v32" fill="none" stroke={color} strokeWidth="32" />
    </svg>
  );
}
function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 512 512" fill={color}>
      <circle cx="256" cy="160" r="96" fill={color} />
      <path d="M256 288c-105.9 0-192 59.4-192 128v32h384v-32c0-68.6-86.1-128-192-128z" fill={color} />
    </svg>
  );
}

function Header({ onAuthOpen, onWalletOpen }: { onAuthOpen: () => void; onWalletOpen: () => void }) {
  const { state } = useGame();
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
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {state.user ? (
          <button onClick={onWalletOpen} style={{
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontWeight: 900, fontSize: '20px', letterSpacing: '2px', color: '#FF3A3A', fontFamily: 'Inter, sans-serif' }}>BLAZE</span>
      </div>

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

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: 'game',    label: 'Fly'     },
    { id: 'wallet',  label: 'Wallet'  },
    { id: 'profile', label: 'Profile' },
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
        const color = active ? '#FF3A3A' : 'rgba(255,255,255,0.35)';
        return (
          <button key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '3px',
              background: 'none', border: 'none', cursor: 'pointer',
              borderTop: active ? '2px solid #FF3A3A' : '2px solid transparent',
              paddingTop: '2px', transition: 'all 0.15s',
            }}>
            {item.id === 'game'    && <RocketIcon color={color} />}
            {item.id === 'wallet'  && <WalletIcon color={color} />}
            {item.id === 'profile' && <PersonIcon color={color} />}
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function AppContent() {
  const { state } = useGame();
  const [tab, setTab] = useState<Tab>('game');
  const [authOpen, setAuthOpen] = useState(false);

  function handleWalletOpen() {
    if (!state.user) { setAuthOpen(true); return; }
    setTab('wallet');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {tab !== 'game' && <Header onAuthOpen={() => setAuthOpen(true)} onWalletOpen={handleWalletOpen} />}

      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {tab === 'game'    && <CrashGame onAuthOpen={() => setAuthOpen(true)} />}
        {tab === 'wallet'  && <Wallet />}
        {tab === 'profile' && <Profile />}
      </main>

      <BottomNav tab={tab} setTab={setTab} />

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
