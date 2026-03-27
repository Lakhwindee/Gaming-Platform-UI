import { useGame } from '../context/GameContext';

const GAMES = [
  { id: 'crash', name: 'Crash', desc: 'Watch the multiplier grow. Cash out before it crashes!', icon: '📈', color: '#00d4ff', maxWin: '1000x', tag: 'HOT', players: 1248 },
  { id: 'mines', name: 'Mines', desc: 'Navigate the minefield. More mines = bigger multiplier!', icon: '💣', color: '#ff3b5c', maxWin: '∞', tag: 'NEW', players: 892 },
  { id: 'plinko', name: 'Plinko', desc: 'Drop the ball and watch it bounce to multipliers!', icon: '🎯', color: '#a855f7', maxWin: '1000x', tag: 'HOT', players: 654 },
  { id: 'tower', name: 'Tower', desc: 'Climb the tower — each floor increases your winnings!', icon: '🗼', color: '#ffd700', maxWin: '500x', tag: '', players: 412 },
  { id: 'hilo', name: 'Hi-Lo', desc: 'Predict if the next card is higher or lower!', icon: '🃏', color: '#00ff88', maxWin: '200x', tag: '', players: 389 },
  { id: 'slots', name: 'Slots', desc: 'Classic slot machine — spin for epic wins!', icon: '🎰', color: '#ff2d9b', maxWin: '500x', tag: '', players: 1842 },
  { id: 'dice', name: 'Dice Roll', desc: 'Predict High or Low on a 6-sided dice!', icon: '🎲', color: '#a855f7', maxWin: '1.95x', tag: '', players: 521 },
  { id: 'coinflip', name: 'Coin Flip', desc: 'Classic 50/50 — Heads or Tails!', icon: '🪙', color: '#ffd700', maxWin: '1.98x', tag: '', players: 347 },
];

export default function FastGames() {
  const { playGame } = useGame();

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontWeight: 900, fontSize: '28px', letterSpacing: '-0.5px', marginBottom: '8px' }}>⚡ Fast Games</h1>
        <p style={{ color: 'var(--text2)', fontSize: '15px' }}>Instant action — place a bet and win in seconds. No waiting, pure adrenaline.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {GAMES.map(g => (
          <div key={g.id} style={{
            background: `linear-gradient(135deg, ${g.color}12, var(--bg2))`,
            border: `1px solid ${g.color}25`, borderRadius: 'var(--radius-xl)',
            padding: '28px', cursor: 'pointer', transition: 'all 0.2s',
            position: 'relative', overflow: 'hidden',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = g.color; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 40px ${g.color}20`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${g.color}25`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
          >
            {/* Glow blob */}
            <div style={{
              position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px',
              borderRadius: '50%', background: g.color, opacity: 0.06, filter: 'blur(30px)', pointerEvents: 'none',
            }} />

            {g.tag && (
              <div style={{
                position: 'absolute', top: '16px', right: '16px',
                background: g.tag === 'HOT' ? 'var(--neon-red)' : 'var(--neon-green)',
                color: '#fff', fontSize: '10px', fontWeight: 800,
                padding: '3px 10px', borderRadius: '12px',
              }}>{g.tag === 'HOT' ? '🔥 HOT' : '✨ NEW'}</div>
            )}

            <div style={{ fontSize: '56px', marginBottom: '16px' }}>{g.icon}</div>
            <h3 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '8px' }}>{g.name}</h3>
            <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>{g.desc}</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>MAX WIN</div>
                <div style={{ color: g.color, fontWeight: 800, fontSize: '18px' }}>{g.maxWin}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>PLAYING</div>
                <div style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '14px' }}>🟢 {g.players.toLocaleString()}</div>
              </div>
            </div>

            <button onClick={() => playGame(g.id)} style={{
              width: '100%', background: g.color, color: '#000', border: 'none',
              borderRadius: 'var(--radius)', padding: '14px', fontWeight: 800, fontSize: '16px', cursor: 'pointer',
            }}>
              Play {g.name} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
