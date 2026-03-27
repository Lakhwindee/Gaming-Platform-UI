import { useGame, GameHistory } from '../context/GameContext';

const GAME_ICONS: Record<string, string> = { crash: '📈', dice: '🎲', coinflip: '🪙' };
const GAME_NAMES: Record<string, string> = { crash: 'Crash', dice: 'Dice Roll', coinflip: 'Coin Flip' };

export default function History() {
  const { state, navigate } = useGame();

  if (!state.user) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '24px' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📋</div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>Sign In to View History</h2>
        <p style={{ color: 'var(--text2)', marginBottom: '24px' }}>Your game history will appear here once you sign in.</p>
        <button onClick={() => navigate('profile')} style={{
          background: 'var(--neon-blue)', color: '#000', border: 'none',
          borderRadius: 'var(--radius)', padding: '14px 32px',
          fontWeight: 800, fontSize: '16px', cursor: 'pointer',
        }}>Sign In</button>
      </div>
    );
  }

  const wins = state.history.filter(h => h.won).length;
  const totalProfit = state.history.reduce((a, h) => a + (h.payout - h.wager), 0);
  const biggestWin = state.history.length ? Math.max(...state.history.map(h => h.payout - h.wager)) : 0;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '8px' }}>📋 Game History</h1>
        <p style={{ color: 'var(--text2)', fontSize: '15px' }}>Your complete betting history</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Total Games', value: state.history.length.toString(), color: 'var(--text)' },
          { label: 'Total Wins', value: wins.toString(), color: 'var(--neon-green)' },
          { label: 'Win Rate', value: state.history.length ? `${Math.round(wins / state.history.length * 100)}%` : '0%', color: 'var(--neon-blue)' },
          { label: 'Total Profit', value: `${totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString()}`, color: totalProfit >= 0 ? 'var(--neon-green)' : 'var(--neon-red)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
            padding: '20px', border: '1px solid var(--border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: s.color, marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* History table */}
      {state.history.length === 0 ? (
        <div style={{
          background: 'var(--bg2)', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)', padding: '80px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎮</div>
          <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px' }}>No games played yet</h3>
          <p style={{ color: 'var(--text2)', marginBottom: '24px' }}>Play Crash, Dice, or Coin Flip to see your history here.</p>
          <button onClick={() => navigate('fastgames')} style={{
            background: 'var(--neon-blue)', color: '#000', border: 'none',
            borderRadius: 'var(--radius)', padding: '14px 32px',
            fontWeight: 800, fontSize: '16px', cursor: 'pointer',
          }}>Start Playing</button>
        </div>
      ) : (
        <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '140px 80px 120px 120px 120px 100px',
            padding: '14px 24px', borderBottom: '1px solid var(--border)',
            color: 'var(--text3)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px',
          }}>
            <span>GAME</span>
            <span>RESULT</span>
            <span style={{ textAlign: 'right' }}>BET</span>
            <span style={{ textAlign: 'right' }}>MULTIPLIER</span>
            <span style={{ textAlign: 'right' }}>PAYOUT</span>
            <span style={{ textAlign: 'right' }}>PROFIT</span>
          </div>

          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {state.history.map((h: GameHistory, i: number) => {
              const profit = h.payout - h.wager;
              return (
                <div key={h.id} style={{
                  display: 'grid', gridTemplateColumns: '140px 80px 120px 120px 120px 100px',
                  padding: '14px 24px', borderBottom: i < state.history.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center', transition: 'background 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>{GAME_ICONS[h.game]}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{GAME_NAMES[h.game]}</div>
                      <div style={{ color: 'var(--text3)', fontSize: '11px' }}>
                        {new Date(h.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span style={{
                      background: h.won ? 'var(--neon-green)20' : 'var(--neon-red)20',
                      color: h.won ? 'var(--neon-green)' : 'var(--neon-red)',
                      padding: '4px 10px', borderRadius: '20px',
                      fontWeight: 700, fontSize: '12px',
                    }}>{h.won ? 'WIN' : 'LOSS'}</span>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text)', fontSize: '14px' }}>
                    {h.wager.toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--neon-blue)', fontSize: '14px' }}>
                    {h.multiplier.toFixed(2)}x
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)', fontSize: '14px' }}>
                    {h.payout.toLocaleString()}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 800, color: profit >= 0 ? 'var(--neon-green)' : 'var(--neon-red)', fontSize: '15px' }}>
                    {profit >= 0 ? '+' : ''}{profit.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
