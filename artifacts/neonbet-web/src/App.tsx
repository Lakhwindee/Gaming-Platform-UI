import { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Home from './pages/Home';
import Casino from './pages/Casino';
import FastGames from './pages/FastGames';
import Sports from './pages/Sports';
import LiveCasino from './pages/LiveCasino';
import Promotions from './pages/Promotions';
import Leaderboard from './pages/Leaderboard';
import History from './pages/History';
import Profile from './pages/Profile';
import AuthModal from './pages/AuthModal';
import WalletModal from './pages/WalletModal';
import CrashGame from './pages/CrashGame';
import DiceGame from './pages/DiceGame';
import CoinFlipGame from './pages/CoinFlipGame';
import MinesGame from './games/MinesGame';
import PlinkoGame from './games/PlinkoGame';
import TowerGame from './games/TowerGame';
import HiLoGame from './games/HiLoGame';
import SlotsGame from './games/SlotsGame';
import LiveChat from './components/LiveChat';
import './index.css';

const NAV_SECTIONS = [
  { label: 'MAIN', items: [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'promotions', icon: '🎁', label: 'Promotions' },
    { id: 'leaderboard', icon: '🏆', label: 'Leaderboard' },
  ]},
  { label: 'GAMES', items: [
    { id: 'casino', icon: '🎰', label: 'Casino' },
    { id: 'fastgames', icon: '⚡', label: 'Fast Games' },
    { id: 'livecasino', icon: '🎥', label: 'Live Casino' },
    { id: 'sports', icon: '⚽', label: 'Sports Betting' },
  ]},
  { label: 'ACCOUNT', items: [
    { id: 'history', icon: '📋', label: 'My History' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ]},
];

function Sidebar({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { state, navigate, toggleWallet } = useGame();
  const [collapsed, setCollapsed] = useState(false);

  const VIP_COLORS: Record<string, string> = {
    Bronze: '#CD7F32', Silver: '#C0C0C0', Gold: '#FFD700',
    Platinum: '#00d4ff', Diamond: '#a855f7',
  };

  return (
    <aside style={{
      width: collapsed ? '68px' : '220px',
      minHeight: '100vh', background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.25s ease',
      flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
      overflowY: 'auto', overflowX: 'hidden',
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 16px', display: 'flex',
        alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => navigate('home')}>
            <span style={{ fontSize: '22px' }}>⚡</span>
            <span style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '-0.5px' }}>
              <span style={{ color: 'var(--neon-blue)' }}>Neon</span>Bet
            </span>
          </div>
        )}
        {collapsed && <span style={{ fontSize: '22px', cursor: 'pointer' }} onClick={() => navigate('home')}>⚡</span>}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: '8px', width: '28px', height: '28px',
          color: 'var(--text2)', cursor: 'pointer', fontSize: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Balance */}
      {state.user && (
        <div style={{
          padding: '14px', margin: '12px', borderRadius: 'var(--radius)',
          background: 'var(--bg3)', border: '1px solid var(--neon-gold)25',
          flexShrink: 0,
        }}>
          {!collapsed ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>BALANCE</span>
                <span style={{
                  background: `${VIP_COLORS[state.user.vipLevel]}20`,
                  color: VIP_COLORS[state.user.vipLevel],
                  fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                }}>{state.user.vipLevel}</span>
              </div>
              <div style={{ color: 'var(--neon-gold)', fontWeight: 900, fontSize: '22px', marginBottom: '8px' }}>
                {state.user.balance.toLocaleString()}
                <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 500, marginLeft: '4px' }}>pts</span>
              </div>
              <button onClick={toggleWallet} style={{
                width: '100%', background: 'var(--neon-green)', color: '#000',
                border: 'none', borderRadius: '8px', padding: '8px',
                fontWeight: 800, fontSize: '13px', cursor: 'pointer',
              }}>+ Deposit</button>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--neon-gold)', fontWeight: 900, fontSize: '13px' }}>
                {(state.user.balance / 1000).toFixed(1)}K
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px' }}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom: '16px' }}>
            {!collapsed && (
              <div style={{
                color: 'var(--text3)', fontSize: '10px', fontWeight: 700,
                letterSpacing: '2px', padding: '4px 8px 8px',
              }}>{section.label}</div>
            )}
            {section.items.map(item => (
              <button key={item.id} onClick={() => navigate(item.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: '10px', padding: collapsed ? '10px' : '10px 12px',
                borderRadius: '10px', border: 'none',
                background: state.page === item.id ? 'var(--neon-blue)15' : 'transparent',
                color: state.page === item.id ? 'var(--neon-blue)' : 'var(--text2)',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                marginBottom: '2px', transition: 'all 0.15s',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderLeft: state.page === item.id ? '2px solid var(--neon-blue)' : '2px solid transparent',
              }}
                onMouseEnter={e => { if (state.page !== item.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3)'; }}
                onMouseLeave={e => { if (state.page !== item.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {!state.user ? (
          <button onClick={onAuthOpen} style={{
            width: '100%', background: 'var(--neon-blue)', color: '#000',
            border: 'none', borderRadius: '10px', padding: '12px',
            fontWeight: 800, fontSize: '14px', cursor: 'pointer',
            display: collapsed ? 'none' : 'block',
          }}>Sign In / Register</button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--neon-blue)50, var(--neon-purple)50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '15px',
            }}>{state.user.username[0].toUpperCase()}</div>
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.user.username}</div>
                <div style={{ color: 'var(--text3)', fontSize: '11px' }}>Lv.{state.user.level}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function TopBar({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { state, navigate, toggleWallet, toggleChat } = useGame();
  const [searchQ, setSearchQ] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = state.notifications.length;

  return (
    <header style={{
      height: '60px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: '16px',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      {/* Search */}
      <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}>🔍</span>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder="Search games..."
          style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '8px 12px 8px 36px',
            color: 'var(--text)', fontSize: '14px',
          }} />
      </div>

      <div style={{ flex: 1 }} />

      {/* Quick game links */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[
          { id: 'crash', label: '📈 Crash' },
          { id: 'mines', label: '💣 Mines' },
          { id: 'plinko', label: '🎯 Plinko' },
        ].map(g => (
          <button key={g.id} onClick={() => navigate('fastgames')} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '6px 12px', color: 'var(--text2)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>{g.label}</button>
        ))}
      </div>

      {/* Chat button */}
      <button onClick={toggleChat} style={{
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '8px 14px', color: 'var(--text2)',
        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
      }}>💬 Chat</button>

      {/* Notifications */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowNotifs(!showNotifs)} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px 14px', color: 'var(--text2)',
          fontSize: '16px', cursor: 'pointer', position: 'relative',
        }}>
          🔔
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: '2px', right: '2px',
              background: 'var(--neon-red)', color: '#fff',
              borderRadius: '50%', width: '16px', height: '16px',
              fontSize: '10px', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unread}</span>
          )}
        </button>
        {showNotifs && (
          <div style={{
            position: 'absolute', right: 0, top: '110%',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', width: '300px', zIndex: 1000,
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Notifications</div>
            {state.notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>No notifications</div>
            ) : (
              state.notifications.slice(0, 6).map(n => (
                <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                  <span>{n.type === 'win' ? '🎉' : n.type === 'bonus' ? '🎁' : 'ℹ️'}</span> {n.message}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {!state.user ? (
        <button onClick={onAuthOpen} style={{
          background: 'var(--neon-blue)', color: '#000', border: 'none',
          borderRadius: '10px', padding: '10px 20px', fontWeight: 800, fontSize: '14px', cursor: 'pointer',
        }}>Sign In</button>
      ) : (
        <button onClick={toggleWallet} style={{
          background: 'var(--neon-green)', color: '#000', border: 'none',
          borderRadius: '10px', padding: '10px 20px', fontWeight: 800, fontSize: '14px', cursor: 'pointer',
        }}>+ Deposit</button>
      )}
    </header>
  );
}

function AppContent() {
  const { state, navigate } = useGame();
  const [authOpen, setAuthOpen] = useState(false);

  const renderPage = () => {
    if (state.activeGame === 'crash') return <CrashGame />;
    if (state.activeGame === 'dice') return <DiceGame />;
    if (state.activeGame === 'coinflip') return <CoinFlipGame />;
    if (state.activeGame === 'mines') return <MinesGame />;
    if (state.activeGame === 'plinko') return <PlinkoGame />;
    if (state.activeGame === 'tower') return <TowerGame />;
    if (state.activeGame === 'hilo') return <HiLoGame />;
    if (state.activeGame === 'slots') return <SlotsGame />;

    switch (state.page) {
      case 'home': return <Home />;
      case 'casino': return <Casino />;
      case 'fastgames': return <FastGames />;
      case 'sports': return <Sports />;
      case 'livecasino': return <LiveCasino />;
      case 'promotions': return <Promotions />;
      case 'leaderboard': return <Leaderboard />;
      case 'history': return <History />;
      case 'profile': return <Profile onAuthOpen={() => setAuthOpen(true)} />;
      default: return <Home />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar onAuthOpen={() => setAuthOpen(true)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar onAuthOpen={() => setAuthOpen(true)} />
        <main style={{ flex: 1, overflowY: 'auto' }}>{renderPage()}</main>
      </div>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {state.walletOpen && <WalletModal />}
      {state.chatOpen && <LiveChat />}
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
