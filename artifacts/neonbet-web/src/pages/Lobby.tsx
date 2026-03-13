import { useGame } from '../context/GameContext';

const GAMES = [
  {
    id: 'crash',
    name: 'Crash',
    desc: 'Watch the multiplier grow. Cash out before it crashes or lose everything!',
    tag: 'MULTIPLAYER',
    mult: 'Up to 1000x',
    gradient: 'linear-gradient(135deg, #00d4ff20, #00d4ff05)',
    border: '#00d4ff',
    icon: '📈',
    hot: true,
  },
  {
    id: 'dice',
    name: 'Dice Roll',
    desc: 'Predict if the dice lands High (4-6) or Low (1-3). Instant results.',
    tag: 'INSTANT',
    mult: '1.95x',
    gradient: 'linear-gradient(135deg, #a855f720, #a855f705)',
    border: '#a855f7',
    icon: '🎲',
    hot: false,
  },
  {
    id: 'coinflip',
    name: 'Coin Flip',
    desc: 'Classic 50/50 — pick Heads or Tails and double your money!',
    tag: 'CLASSIC',
    mult: '1.98x',
    gradient: 'linear-gradient(135deg, #ffd70020, #ffd70005)',
    border: '#ffd700',
    icon: '🪙',
    hot: false,
  },
];

const STATS = [
  { label: 'Active Players', value: '14,832', color: 'var(--text)' },
  { label: 'Total Wagered', value: '$8.4M', color: 'var(--neon-green)' },
  { label: 'Biggest Win', value: '856x', color: 'var(--neon-gold)' },
  { label: 'Win Rate', value: '49.2%', color: 'var(--neon-blue)' },
];

const RECENT_WINS = [
  { user: 'CryptoKing', game: 'Crash', mult: '24.5x', profit: '+12,250', color: 'var(--neon-green)' },
  { user: 'NeonBlade', game: 'Coin Flip', mult: '1.98x', profit: '+4,950', color: 'var(--neon-green)' },
  { user: 'StarDust', game: 'Dice', mult: '1.95x', profit: '+975', color: 'var(--neon-green)' },
  { user: 'ShadowWolf', game: 'Crash', mult: '8.2x', profit: '+8,200', color: 'var(--neon-green)' },
  { user: 'IronFist', game: 'Coin Flip', mult: '1.98x', profit: '+1,980', color: 'var(--neon-green)' },
];

export default function Lobby() {
  const { state, playGame, navigate } = useGame();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg3) 0%, var(--bg2) 100%)',
        borderRadius: 'var(--radius-xl)', padding: '40px',
        border: '1px solid var(--border)', marginBottom: '32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'var(--neon-blue)', opacity: 0.06, filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                background: 'var(--neon-green)20', border: '1px solid var(--neon-green)40',
                borderRadius: '20px', padding: '4px 12px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-green)', animation: 'pulse 2s infinite' }} />
                <span style={{ color: 'var(--neon-green)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>LIVE</span>
              </div>
            </div>
            <h1 style={{ fontSize: '42px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '12px' }}>
              Win Big on <span style={{ color: 'var(--neon-blue)' }}>NeonBet</span>
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: '16px', maxWidth: '480px', lineHeight: 1.6 }}>
              Play Crash, Dice & Coin Flip with real-time multipliers. Start with 10,000 points free!
            </p>
          </div>
          {!state.user && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => navigate('profile')} style={{
                background: 'var(--neon-blue)', color: '#000',
                border: 'none', borderRadius: 'var(--radius)', padding: '14px 28px',
                fontWeight: 800, fontSize: '16px', cursor: 'pointer',
              }}>
                Start Playing Free
              </button>
            </div>
          )}
          {state.user && (
            <div style={{
              background: 'var(--bg4)', borderRadius: 'var(--radius-lg)',
              padding: '20px 28px', border: '1px solid var(--neon-blue)30',
              textAlign: 'center',
            }}>
              <div style={{ color: 'var(--text2)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', marginBottom: '6px' }}>YOUR BALANCE</div>
              <div style={{ color: 'var(--neon-gold)', fontSize: '36px', fontWeight: 900, letterSpacing: '-1px' }}>
                {state.user.balance.toLocaleString()} <span style={{ fontSize: '18px', color: 'var(--text2)' }}>pts</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '32px' }}>
        {STATS.map(s => (
          <div key={s.label} style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius)',
            padding: '20px', border: '1px solid var(--border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: s.color, marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Games */}
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.5px' }}>Choose a Game</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {GAMES.map(game => (
              <div key={game.id}
                onClick={() => playGame(game.id)}
                style={{
                  background: game.gradient, borderRadius: 'var(--radius-lg)',
                  border: `1px solid ${game.border}30`, padding: '24px',
                  cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '20px',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${game.border}70`;
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${game.border}20`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${game.border}30`;
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '72px', height: '72px', borderRadius: '20px',
                  background: `${game.border}20`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '36px', flexShrink: 0, border: `1px solid ${game.border}30`,
                }}>
                  {game.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '20px' }}>{game.name}</span>
                    <span style={{
                      background: `${game.border}20`, color: game.border,
                      fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
                      padding: '3px 8px', borderRadius: '6px',
                    }}>{game.tag}</span>
                    {game.hot && (
                      <span style={{
                        background: 'var(--neon-red)20', color: 'var(--neon-red)',
                        fontSize: '10px', fontWeight: 700, padding: '3px 8px',
                        borderRadius: '6px', letterSpacing: '1px',
                      }}>🔥 HOT</span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '8px', lineHeight: 1.5 }}>{game.desc}</p>
                  <span style={{ color: game.border, fontWeight: 700, fontSize: '14px' }}>Max: {game.mult}</span>
                </div>
                <button style={{
                  background: game.border, color: '#000',
                  border: 'none', borderRadius: 'var(--radius)', padding: '12px 24px',
                  fontWeight: 800, fontSize: '15px', cursor: 'pointer', flexShrink: 0,
                }}>
                  Play Now →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Wins */}
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.5px' }}>Recent Big Wins</h2>
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {RECENT_WINS.map((w, i) => (
              <div key={i} style={{
                padding: '14px 18px', borderBottom: i < RECENT_WINS.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                animation: `slideIn 0.${i + 3}s ease`,
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>🎉 {w.user}</div>
                  <div style={{ color: 'var(--text3)', fontSize: '12px' }}>{w.game} · {w.mult}</div>
                </div>
                <div style={{ color: 'var(--neon-green)', fontWeight: 800, fontSize: '16px' }}>{w.profit}</div>
              </div>
            ))}
          </div>

          {/* Mini leaderboard */}
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '24px 0 16px', letterSpacing: '-0.5px' }}>🏆 Top Players</h2>
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            {[
              { rank: 1, name: 'CryptoKing', pts: '485K', color: 'var(--neon-gold)' },
              { rank: 2, name: 'NeonBlade', pts: '342K', color: '#C0C0C0' },
              { rank: 3, name: 'ShadowWolf', pts: '298K', color: '#CD7F32' },
            ].map((p, i) => (
              <div key={i} style={{
                padding: '14px 18px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <span style={{ fontSize: '20px' }}>{p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉'}</span>
                <span style={{ fontWeight: 700, fontSize: '14px', flex: 1 }}>{p.name}</span>
                <span style={{ color: 'var(--neon-green)', fontWeight: 800 }}>{p.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
