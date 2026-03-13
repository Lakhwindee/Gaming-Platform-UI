import { useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

const ROWS_PER_LEVEL = 4;
const TOTAL_LEVELS = 10;

function calcMult(level: number, difficulty: 'easy' | 'medium' | 'hard'): number {
  const base = difficulty === 'easy' ? 1.3 : difficulty === 'medium' ? 1.6 : 2.0;
  return +(Math.pow(base, level) * 0.97).toFixed(2);
}

type CellType = 'hidden' | 'safe' | 'danger';

export default function TowerGame() {
  const { state, navigate, addHistory, addNotification } = useGame();
  const [bet, setBet] = useState(100);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [tower, setTower] = useState<CellType[][]>([]);
  const [playing, setPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  const dangerPerRow = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
  const safePerRow = ROWS_PER_LEVEL - dangerPerRow;
  const currentMult = calcMult(currentLevel, difficulty);

  function startGame() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < bet) { alert('Insufficient balance!'); return; }

    const t: CellType[][] = [];
    for (let l = 0; l < TOTAL_LEVELS; l++) {
      const row: CellType[] = Array(ROWS_PER_LEVEL).fill('safe');
      const dangerIdxs = new Set<number>();
      while (dangerIdxs.size < dangerPerRow) dangerIdxs.add(Math.floor(Math.random() * ROWS_PER_LEVEL));
      dangerIdxs.forEach(i => { row[i] = 'danger'; });
      t.push(row.map(() => 'hidden'));
    }
    // Store actual layout
    const actual: CellType[][] = [];
    for (let l = 0; l < TOTAL_LEVELS; l++) {
      const row: CellType[] = Array(ROWS_PER_LEVEL).fill('safe');
      const dangerIdxs = new Set<number>();
      while (dangerIdxs.size < dangerPerRow) dangerIdxs.add(Math.floor(Math.random() * ROWS_PER_LEVEL));
      dangerIdxs.forEach(i => { row[i] = 'danger'; });
      actual.push(row);
    }
    setTower(t);
    (window as any)._towerActual = actual;
    setCurrentLevel(0);
    setPlaying(true);
    setGameOver(false);
    setWon(false);
  }

  function clickCell(levelIdx: number, cellIdx: number) {
    if (!playing || gameOver || levelIdx !== (TOTAL_LEVELS - 1 - currentLevel)) return;
    const actual: CellType[][] = (window as any)._towerActual;
    const isSafe = actual[currentLevel][cellIdx] === 'safe';

    setTower(prev => prev.map((row, li) => {
      if (li === TOTAL_LEVELS - 1 - currentLevel) {
        return row.map((c, ci) => {
          if (ci === cellIdx) return isSafe ? 'safe' : 'danger';
          return c;
        });
      }
      return row;
    }));

    if (!isSafe) {
      // Reveal all mines in current row
      setTower(prev => prev.map((row, li) => {
        if (li === TOTAL_LEVELS - 1 - currentLevel) {
          return actual[currentLevel].map((c) => c);
        }
        return row;
      }));
      setGameOver(true);
      setPlaying(false);
      addHistory({ id: makeId(), game: 'tower', wager: bet, multiplier: 0, payout: 0, won: false, timestamp: Date.now() });
      addNotification(`💥 Tower fell! Lost ${bet.toLocaleString()} pts`, 'info');
    } else {
      const nextLevel = currentLevel + 1;
      if (nextLevel >= TOTAL_LEVELS) {
        // Won the whole tower!
        const mult = calcMult(nextLevel, difficulty);
        const payout = Math.floor(bet * mult);
        setCurrentLevel(nextLevel);
        setGameOver(true);
        setPlaying(false);
        setWon(true);
        addHistory({ id: makeId(), game: 'tower', wager: bet, multiplier: mult, payout, won: true, timestamp: Date.now() });
        addNotification(`🗼 Tower complete! ${mult}x — +${(payout - bet).toLocaleString()} pts`, 'win');
      } else {
        setCurrentLevel(nextLevel);
      }
    }
  }

  function cashOut() {
    if (!playing || gameOver || currentLevel === 0) return;
    const payout = Math.floor(bet * currentMult);
    setGameOver(true);
    setPlaying(false);
    setWon(true);
    addHistory({ id: makeId(), game: 'tower', wager: bet, multiplier: currentMult, payout, won: true, timestamp: Date.now() });
    addNotification(`💰 Cashed out at ${currentMult}x! +${(payout - bet).toLocaleString()} pts`, 'win');
  }

  const diffColors = { easy: 'var(--neon-green)', medium: 'var(--neon-blue)', hard: 'var(--neon-red)' };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('fastgames')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>🗼 Tower</h1>
        {playing && currentLevel > 0 && (
          <span style={{ color: 'var(--neon-gold)', fontWeight: 700 }}>Level {currentLevel} — {currentMult}x</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px' }}>
        {/* Tower display */}
        <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', padding: '20px' }}>
          {!playing && !gameOver && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🗼</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>Start a game to climb the tower!</div>
            </div>
          )}

          {gameOver && (
            <div style={{
              textAlign: 'center', marginBottom: '16px', padding: '16px',
              background: won ? 'var(--neon-green)15' : 'var(--neon-red)15',
              borderRadius: 'var(--radius)',
              color: won ? 'var(--neon-green)' : 'var(--neon-red)',
              fontWeight: 800, fontSize: '20px',
            }}>
              {won ? `🎉 Cashed out at ${currentMult}x!` : `💥 Fell at level ${currentLevel}!`}
            </div>
          )}

          {(playing || gameOver) && tower.map((row, li) => {
            const level = TOTAL_LEVELS - 1 - li;
            const isActive = level === currentLevel && playing && !gameOver;
            const isPast = level < currentLevel;
            const isMult = calcMult(level + 1, difficulty);

            return (
              <div key={li} style={{
                display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px',
                opacity: level > currentLevel ? 0.4 : 1,
              }}>
                <div style={{
                  width: '60px', textAlign: 'right', flexShrink: 0,
                  color: isPast ? 'var(--neon-green)' : 'var(--text3)', fontSize: '12px', fontWeight: 700,
                }}>
                  {isMult.toFixed(1)}x
                </div>
                <div style={{
                  flex: 1, display: 'grid', gridTemplateColumns: `repeat(${ROWS_PER_LEVEL},1fr)`, gap: '6px',
                }}>
                  {row.map((cell, ci) => (
                    <div key={ci} onClick={() => clickCell(li, ci)} style={{
                      height: '40px', borderRadius: '10px', border: '1px solid',
                      borderColor: isActive ? 'var(--neon-blue)50' : 'var(--border)',
                      background: cell === 'safe' ? 'var(--neon-green)30' : cell === 'danger' ? 'var(--neon-red)30' : isActive ? 'var(--bg3)' : isPast ? 'var(--neon-green)15' : 'var(--bg4)',
                      cursor: isActive ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '18px', transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => { if (isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--neon-blue)20'; }}
                      onMouseLeave={e => { if (isActive && cell === 'hidden') (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'; }}
                    >
                      {cell === 'safe' ? '✅' : cell === 'danger' ? '💣' : isPast ? '✅' : ''}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '16px', fontSize: '15px' }}>Settings</h3>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>DIFFICULTY</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <button key={d} onClick={() => setDifficulty(d)} disabled={playing && !gameOver} style={{
                  padding: '10px', borderRadius: '8px', border: '1px solid',
                  borderColor: difficulty === d ? diffColors[d] : 'var(--border)',
                  background: difficulty === d ? `${diffColors[d]}20` : 'var(--bg3)',
                  color: difficulty === d ? diffColors[d] : 'var(--text2)',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ textTransform: 'capitalize' }}>{d}</span>
                  <span style={{ fontSize: '12px', opacity: 0.7 }}>
                    {d === 'easy' ? '1 mine' : d === 'medium' ? '2 mines' : '3 mines'}
                  </span>
                </button>
              ))}
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>BET</label>
            <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} disabled={playing && !gameOver}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '15px', fontWeight: 700, marginBottom: '12px' }} />

            {!playing || gameOver ? (
              <button onClick={startGame} style={{
                width: '100%', background: 'var(--neon-gold)', color: '#000', border: 'none',
                borderRadius: 'var(--radius)', padding: '14px', fontWeight: 800, fontSize: '15px', cursor: 'pointer',
              }}>
                {gameOver ? '🔄 Play Again' : '🗼 Start Climb'}
              </button>
            ) : (
              <button onClick={cashOut} disabled={currentLevel === 0} style={{
                width: '100%', background: currentLevel > 0 ? 'var(--neon-green)' : 'var(--bg3)',
                color: currentLevel > 0 ? '#000' : 'var(--text2)',
                border: 'none', borderRadius: 'var(--radius)', padding: '14px', fontWeight: 800, fontSize: '15px', cursor: currentLevel > 0 ? 'pointer' : 'not-allowed',
              }}>
                {currentLevel > 0 ? `💰 Cash Out ${Math.floor(bet * currentMult).toLocaleString()} pts` : 'Climb to cash out'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
