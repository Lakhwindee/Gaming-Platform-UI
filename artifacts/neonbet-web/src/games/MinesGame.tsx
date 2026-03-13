import { useState, useCallback } from 'react';
import { useGame, makeId } from '../context/GameContext';

type CellState = 'hidden' | 'gem' | 'mine' | 'revealed';

const MINE_COUNTS = [1, 3, 5, 10, 15, 20, 24];

function calcMultiplier(revealed: number, mines: number, total = 25): number {
  if (revealed === 0) return 1;
  let mult = 1;
  for (let i = 0; i < revealed; i++) {
    mult *= (total - mines - i) / (total - i);
  }
  return Math.max(1, +(0.97 / mult).toFixed(2));
}

export default function MinesGame() {
  const { state, navigate, addHistory, addNotification } = useGame();
  const [bet, setBet] = useState(100);
  const [mineCount, setMineCount] = useState(5);
  const [cells, setCells] = useState<CellState[]>(Array(25).fill('hidden'));
  const [minePositions, setMinePositions] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [currentMult, setCurrentMult] = useState(1);

  const startGame = useCallback(() => {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < bet) { alert('Insufficient balance!'); return; }

    const positions = new Set<number>();
    while (positions.size < mineCount) {
      positions.add(Math.floor(Math.random() * 25));
    }
    setMinePositions(positions);
    setCells(Array(25).fill('hidden'));
    setRevealed(0);
    setPlaying(true);
    setGameOver(false);
    setWon(false);
    setCurrentMult(1);
  }, [state.user, bet, mineCount]);

  const revealCell = useCallback((idx: number) => {
    if (!playing || gameOver || cells[idx] !== 'hidden') return;

    if (minePositions.has(idx)) {
      // Hit mine
      setCells(prev => prev.map((c, i) => {
        if (i === idx) return 'mine';
        if (minePositions.has(i)) return 'mine';
        return c;
      }));
      setGameOver(true);
      setPlaying(false);
      addHistory({ id: makeId(), game: 'mines', wager: bet, multiplier: 0, payout: 0, won: false, timestamp: Date.now() });
      addNotification(`💣 Mine hit! Lost ${bet.toLocaleString()} pts`, 'info');
    } else {
      const newRevealed = revealed + 1;
      const mult = calcMultiplier(newRevealed, mineCount);
      setRevealed(newRevealed);
      setCurrentMult(mult);
      setCells(prev => prev.map((c, i) => i === idx ? 'gem' : c));

      if (newRevealed === 25 - mineCount) {
        // All gems found!
        cashOut(mult, newRevealed);
      }
    }
  }, [playing, gameOver, cells, minePositions, revealed, mineCount, bet]);

  function cashOut(mult = currentMult, revCount = revealed) {
    if (!playing || gameOver || revCount === 0) return;
    const payout = Math.floor(bet * mult);
    setPlaying(false);
    setWon(true);
    setGameOver(true);
    setCells(prev => prev.map((c, i) => minePositions.has(i) ? 'mine' : c === 'hidden' ? 'hidden' : c));
    addHistory({ id: makeId(), game: 'mines', wager: bet, multiplier: mult, payout, won: true, timestamp: Date.now() });
    addNotification(`💎 Cashed out at ${mult}x! +${(payout - bet).toLocaleString()} pts`, 'win');
  }

  const potentialWin = Math.floor(bet * currentMult);
  const profit = potentialWin - bet;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('fastgames')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>💣 Mines</h1>
        {playing && <span style={{ color: 'var(--neon-blue)', fontWeight: 700 }}>{currentMult.toFixed(2)}x — {revealed} gems found</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        {/* Grid */}
        <div>
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
            padding: '24px', position: 'relative',
          }}>
            {/* Current multiplier */}
            {playing && revealed > 0 && (
              <div style={{
                textAlign: 'center', marginBottom: '16px',
                fontSize: '32px', fontWeight: 900, color: 'var(--neon-green)',
                textShadow: '0 0 20px var(--neon-green)',
              }}>
                {currentMult.toFixed(2)}x
              </div>
            )}

            {gameOver && (
              <div style={{
                textAlign: 'center', marginBottom: '16px',
                fontSize: '28px', fontWeight: 900,
                color: won ? 'var(--neon-green)' : 'var(--neon-red)',
              }}>
                {won ? `🎉 Won ${potentialWin.toLocaleString()} pts!` : '💥 Mine hit!'}
              </div>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
              gap: '8px',
            }}>
              {cells.map((cell, i) => (
                <div key={i} onClick={() => revealCell(i)} style={{
                  aspectRatio: '1', borderRadius: '12px',
                  background: cell === 'gem' ? 'var(--neon-green)20' : cell === 'mine' ? 'var(--neon-red)20' : 'var(--bg3)',
                  border: `2px solid ${cell === 'gem' ? 'var(--neon-green)' : cell === 'mine' ? 'var(--neon-red)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '28px', cursor: playing && cell === 'hidden' ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  transform: cell !== 'hidden' ? 'scale(0.95)' : 'scale(1)',
                }}
                  onMouseEnter={e => { if (playing && cell === 'hidden') (e.currentTarget as HTMLDivElement).style.background = 'var(--bg4)'; }}
                  onMouseLeave={e => { if (playing && cell === 'hidden') (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'; }}
                >
                  {cell === 'gem' ? '💎' : cell === 'mine' ? '💣' : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Multiplier table */}
          <div style={{ marginTop: '16px', background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>Multiplier Preview ({mineCount} mines)</h3>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Array.from({ length: Math.min(10, 25 - mineCount) }, (_, i) => i + 1).map(n => (
                <div key={n} style={{
                  background: n === revealed && playing ? 'var(--neon-green)20' : 'var(--bg3)',
                  border: `1px solid ${n === revealed && playing ? 'var(--neon-green)' : 'var(--border)'}`,
                  borderRadius: '8px', padding: '6px 10px', textAlign: 'center', minWidth: '60px',
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '2px' }}>{n} gem{n > 1 ? 's' : ''}</div>
                  <div style={{ fontWeight: 700, color: 'var(--neon-green)', fontSize: '13px' }}>{calcMultiplier(n, mineCount).toFixed(2)}x</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>Game Settings</h3>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>BET AMOUNT</label>
            <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} disabled={playing && !gameOver}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '16px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setBet(v)} disabled={playing && !gameOver} style={{
                  background: bet === v ? 'var(--neon-red)20' : 'var(--bg3)',
                  border: `1px solid ${bet === v ? 'var(--neon-red)' : 'var(--border)'}`,
                  color: bet === v ? 'var(--neon-red)' : 'var(--text2)',
                  borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>MINES COUNT</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '20px' }}>
              {MINE_COUNTS.map(v => (
                <button key={v} onClick={() => setMineCount(v)} disabled={playing && !gameOver} style={{
                  background: mineCount === v ? 'var(--neon-red)20' : 'var(--bg3)',
                  border: `1px solid ${mineCount === v ? 'var(--neon-red)' : 'var(--border)'}`,
                  color: mineCount === v ? 'var(--neon-red)' : 'var(--text2)',
                  borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>

            {playing && revealed > 0 && !gameOver ? (
              <button onClick={() => cashOut()} style={{
                width: '100%', background: 'var(--neon-green)', color: '#000', border: 'none',
                borderRadius: 'var(--radius)', padding: '16px', fontWeight: 800, fontSize: '16px', cursor: 'pointer',
                marginBottom: '8px',
              }}>
                💰 Cash Out {potentialWin.toLocaleString()} pts
              </button>
            ) : (
              <button onClick={startGame} disabled={playing && !gameOver} style={{
                width: '100%', background: playing && !gameOver ? 'var(--bg3)' : 'var(--neon-red)',
                color: playing && !gameOver ? 'var(--text2)' : '#fff',
                border: 'none', borderRadius: 'var(--radius)', padding: '16px',
                fontWeight: 800, fontSize: '16px', cursor: playing && !gameOver ? 'not-allowed' : 'pointer',
                marginBottom: '8px',
              }}>
                {gameOver ? '🔄 Play Again' : '💣 Start Game'}
              </button>
            )}

            {playing && revealed > 0 && !gameOver && (
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--neon-green)10', border: '1px solid var(--neon-green)30', textAlign: 'center' }}>
                <div style={{ color: 'var(--text2)', fontSize: '12px' }}>If you cash out now</div>
                <div style={{ color: 'var(--neon-green)', fontWeight: 900, fontSize: '22px' }}>+{profit.toLocaleString()} pts</div>
              </div>
            )}

            {state.user && (
              <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '14px' }}>{state.user.balance.toLocaleString()} pts</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
