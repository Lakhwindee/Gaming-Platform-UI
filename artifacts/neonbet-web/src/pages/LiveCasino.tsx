import { useGame } from '../context/GameContext';

const LIVE_GAMES = [
  { name: 'Lightning Roulette', host: 'Emily', provider: 'Evolution', players: 2341, icon: '⚡🎡', color: '#ffd700', bet: '1-10,000', tag: 'HOT' },
  { name: 'Crazy Time', host: 'Alex', provider: 'Evolution', players: 5621, icon: '🎪', color: '#ff2d9b', bet: '0.10-5,000', tag: 'HOT' },
  { name: 'Live Blackjack VIP', host: 'Sophia', provider: 'Evolution', players: 892, icon: '🃏', color: '#00d4ff', bet: '100-50,000', tag: 'VIP' },
  { name: 'Baccarat Squeeze', host: 'Lucas', provider: 'Evolution', players: 1234, icon: '🎴', color: '#a855f7', bet: '1-50,000', tag: '' },
  { name: 'Dream Catcher', host: 'Maria', provider: 'Evolution', players: 3421, icon: '🌀', color: '#00ff88', bet: '0.10-10,000', tag: '' },
  { name: 'Monopoly Live', host: 'David', provider: 'Evolution', players: 4892, icon: '🎩', color: '#ffd700', bet: '0.10-5,000', tag: 'HOT' },
  { name: 'Dragon Tiger', host: 'Liu', provider: 'Evolution', players: 1892, icon: '🐉', color: '#ff3b5c', bet: '1-10,000', tag: '' },
  { name: 'Live Roulette', host: 'Anna', provider: 'Ezugi', players: 987, icon: '🎡', color: '#00d4ff', bet: '0.25-5,000', tag: '' },
  { name: 'Casino Hold\'em', host: 'Chris', provider: 'Evolution', players: 654, icon: '♠️', color: '#a855f7', bet: '1-2,000', tag: '' },
  { name: 'Side Bet City', host: 'Jake', provider: 'Evolution', players: 432, icon: '🃏🎯', color: '#ff2d9b', bet: '0.10-1,000', tag: 'NEW' },
  { name: 'Infinite Blackjack', host: 'Sara', provider: 'Evolution', players: 2341, icon: '♾️🃏', color: '#00ff88', bet: '1-5,000', tag: '' },
  { name: 'Speed Baccarat', host: 'Ken', provider: 'Evolution', players: 1123, icon: '⚡🎴', color: '#ffd700', bet: '5-25,000', tag: '' },
];

export default function LiveCasino() {
  const { navigate } = useGame();

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h1 style={{ fontWeight: 900, fontSize: '28px', letterSpacing: '-0.5px' }}>🎥 Live Casino</h1>
        <div style={{
          background: 'var(--neon-red)20', color: 'var(--neon-red)',
          border: '1px solid var(--neon-red)40', borderRadius: '20px',
          padding: '4px 12px', fontSize: '12px', fontWeight: 800,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--neon-red)', animation: 'pulse 1s infinite' }} />
          LIVE NOW
        </div>
      </div>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #ff2d9b15, #a855f710)',
        border: '1px solid #ff2d9b30', borderRadius: 'var(--radius-xl)',
        padding: '32px', marginBottom: '28px',
        display: 'flex', alignItems: 'center', gap: '24px',
      }}>
        <div style={{ fontSize: '80px' }}>🎬</div>
        <div>
          <h2 style={{ fontWeight: 900, fontSize: '26px', marginBottom: '8px' }}>Real Dealers. Real Time. Real Wins.</h2>
          <p style={{ color: 'var(--text2)', fontSize: '15px', marginBottom: '16px', maxWidth: '600px' }}>
            Experience the thrill of a real casino from your browser. Play with professional dealers via HD streaming — Blackjack, Roulette, Baccarat and more.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            {['✓ HD Streaming', '✓ 24/7 Live Dealers', '✓ Instant Play', '✓ Multiple Tables'].map(f => (
              <span key={f} style={{ color: 'var(--neon-green)', fontSize: '13px', fontWeight: 600 }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Games */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
        {LIVE_GAMES.map((g, i) => (
          <div key={i} onClick={() => navigate('livecasino')} style={{
            background: `linear-gradient(135deg, ${g.color}12, var(--bg2))`,
            border: `1px solid ${g.color}25`, borderRadius: 'var(--radius-lg)',
            padding: '20px', cursor: 'pointer', transition: 'all 0.2s',
            position: 'relative',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = g.color; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 30px ${g.color}20`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${g.color}25`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
          >
            {/* Live badge */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: '9px', color: 'var(--neon-green)', fontWeight: 800 }}>LIVE</span>
            </div>

            {g.tag && (
              <div style={{
                position: 'absolute', top: '10px', right: '10px',
                background: g.tag === 'HOT' ? 'var(--neon-red)' : g.tag === 'VIP' ? 'var(--neon-gold)' : 'var(--neon-green)',
                color: g.tag === 'VIP' ? '#000' : '#fff',
                fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '10px',
              }}>{g.tag}</div>
            )}

            <div style={{ textAlign: 'center', padding: '16px 0 12px' }}>
              <div style={{ fontSize: '44px', marginBottom: '8px' }}>{g.icon}</div>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '2px' }}>{g.name}</div>
              <div style={{ color: 'var(--text3)', fontSize: '12px', marginBottom: '8px' }}>Host: {g.host} · {g.provider}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ color: 'var(--text3)', fontSize: '10px', fontWeight: 700 }}>BET RANGE</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: g.color }}>{g.bet}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text3)', fontSize: '10px', fontWeight: 700 }}>PLAYERS</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--neon-green)' }}>🟢 {g.players.toLocaleString()}</div>
              </div>
            </div>

            <button style={{
              width: '100%', background: g.color, color: '#000', border: 'none',
              borderRadius: '8px', padding: '10px', fontWeight: 800, fontSize: '14px', cursor: 'pointer',
            }}>Join Table →</button>
          </div>
        ))}
      </div>
    </div>
  );
}
