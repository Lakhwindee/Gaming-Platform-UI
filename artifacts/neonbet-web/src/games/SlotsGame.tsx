import { useState, useRef } from 'react';
import { useGame, makeId } from '../context/GameContext';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣', '🎰', '🔔', '🍀'];
const WEIGHTS = [20, 18, 16, 14, 10, 8, 6, 4, 2, 2]; // lower weight = rarer

const PAYLINES = [
  { name: '3x Same', mult: (s: string[]) => { const u = new Set(s); return u.size === 1 ? (s[0] === '💎' ? 50 : s[0] === '7️⃣' ? 30 : s[0] === '🎰' ? 20 : s[0] === '🍀' ? 15 : s[0] === '⭐' ? 8 : 3) : 0; } },
  { name: 'Two Same', mult: (s: string[]) => { const c = s.filter(x => x === s[0]).length; return (c === 2 || s.filter(x => x === s[1]).length === 2 || s.filter(x => x === s[2]).length === 2) && new Set(s).size === 2 ? 1.5 : 0; } },
];

function spin3x3(): string[][] {
  const result: string[][] = [];
  for (let r = 0; r < 3; r++) {
    const row: string[] = [];
    for (let c = 0; c < 3; c++) {
      let sym = '';
      const total = WEIGHTS.reduce((a, b) => a + b, 0);
      let rand = Math.random() * total;
      for (let i = 0; i < SYMBOLS.length; i++) {
        rand -= WEIGHTS[i];
        if (rand <= 0) { sym = SYMBOLS[i]; break; }
      }
      row.push(sym || SYMBOLS[0]);
    }
    result.push(row);
  }
  return result;
}

function calcWin(grid: string[][], bet: number): { mult: number; winLines: number[] } {
  let totalMult = 0;
  const winLines: number[] = [];
  // Check each row
  for (let r = 0; r < 3; r++) {
    for (const p of PAYLINES) {
      const m = p.mult(grid[r]);
      if (m > 0) { totalMult += m; winLines.push(r); }
    }
  }
  // Check middle column
  const col = [grid[0][1], grid[1][1], grid[2][1]];
  const colSet = new Set(col);
  if (colSet.size === 1) { totalMult += 5; winLines.push(10); }
  // Diagonal
  const diag = [grid[0][0], grid[1][1], grid[2][2]];
  if (new Set(diag).size === 1) { totalMult += 8; winLines.push(20); }

  return { mult: totalMult, winLines };
}

export default function SlotsGame() {
  const { state, navigate, addHistory, addNotification } = useGame();
  const [bet, setBet] = useState(100);
  const [grid, setGrid] = useState<string[][]>([['🎰', '💎', '⭐'], ['🍀', '7️⃣', '🍒'], ['🍋', '🍊', '🍇']]);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<{ mult: number; payout: number; winLines: number[] } | null>(null);
  const [autoSpin, setAutoSpin] = useState(false);
  const [spinCount, setSpinCount] = useState(0);
  const autoRef = useRef(false);

  async function doSpin() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < bet) { alert('Insufficient balance!'); return; }
    setSpinning(true);
    setLastResult(null);

    // Animation: random reels
    let frames = 0;
    const maxFrames = 15;
    const interval = setInterval(() => {
      setGrid(spin3x3());
      frames++;
      if (frames >= maxFrames) {
        clearInterval(interval);
        const finalGrid = spin3x3();
        setGrid(finalGrid);
        const { mult, winLines } = calcWin(finalGrid, bet);
        const payout = Math.floor(bet * mult);
        setLastResult({ mult, payout, winLines });
        setSpinCount(s => s + 1);
        addHistory({ id: makeId(), game: 'slots', wager: bet, multiplier: mult, payout, won: payout >= bet, timestamp: Date.now() });
        if (payout >= bet) addNotification(`🎰 Slots hit ${mult}x! +${(payout - bet).toLocaleString()} pts`, 'win');
        setSpinning(false);
      }
    }, 80);
  }

  function toggleAuto() {
    setAutoSpin(a => !a);
    autoRef.current = !autoSpin;
  }

  const symbolColors: Record<string, string> = {
    '💎': 'var(--neon-blue)', '7️⃣': 'var(--neon-red)', '🎰': 'var(--neon-purple)',
    '🍀': 'var(--neon-green)', '⭐': 'var(--neon-gold)', '🔔': 'var(--neon-gold)',
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('fastgames')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>🎰 Slots</h1>
        <span style={{ color: 'var(--text3)', fontSize: '14px' }}>Spins: {spinCount}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Slot machine */}
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
            padding: '32px', position: 'relative',
          }}>
            {/* Machine frame */}
            <div style={{
              background: 'var(--bg3)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--neon-purple)30',
              padding: '20px', marginBottom: '20px',
              boxShadow: lastResult && lastResult.mult > 0 ? '0 0 30px var(--neon-gold)40' : 'none',
              transition: 'box-shadow 0.3s',
            }}>
              {/* Payline indicator */}
              <div style={{ position: 'absolute', left: '0', top: '50%', width: '4px', height: '4px', background: 'var(--neon-red)', borderRadius: '50%' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {grid.map((row, ri) =>
                  row.map((sym, ci) => {
                    const isWinLine = lastResult?.winLines.includes(ri);
                    return (
                      <div key={`${ri}-${ci}`} style={{
                        height: '80px', borderRadius: '12px',
                        background: isWinLine ? 'var(--neon-gold)20' : 'var(--bg4)',
                        border: `1px solid ${isWinLine ? 'var(--neon-gold)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '44px',
                        animation: spinning ? 'spin 0.1s linear infinite' : isWinLine ? 'bounce 0.5s ease infinite' : 'none',
                        transition: 'border-color 0.3s, background 0.3s',
                      }}>
                        {sym}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Result */}
            {lastResult && !spinning && (
              <div style={{
                padding: '14px', borderRadius: 'var(--radius)',
                background: lastResult.mult > 0 ? 'var(--neon-green)15' : 'var(--neon-red)10',
                border: `1px solid ${lastResult.mult > 0 ? 'var(--neon-green)40' : 'var(--border)'}`,
                textAlign: 'center', marginBottom: '16px', animation: 'scaleIn 0.3s ease',
              }}>
                {lastResult.mult > 0 ? (
                  <span style={{ color: 'var(--neon-green)', fontWeight: 800, fontSize: '18px' }}>
                    🎉 {lastResult.mult}x — Won {lastResult.payout.toLocaleString()} pts!
                  </span>
                ) : (
                  <span style={{ color: 'var(--text2)', fontSize: '15px' }}>No win this time. Try again!</span>
                )}
              </div>
            )}

            <button onClick={doSpin} disabled={spinning} style={{
              width: '100%',
              background: spinning ? 'var(--bg3)' : 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))',
              color: spinning ? 'var(--text2)' : '#fff', border: 'none',
              borderRadius: 'var(--radius)', padding: '18px',
              fontWeight: 900, fontSize: '18px', cursor: spinning ? 'wait' : 'pointer',
              letterSpacing: '1px',
            }}>
              {spinning ? '🎰 SPINNING...' : '🎰 SPIN!'}
            </button>
          </div>

          {/* Paytable */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>💰 Pay Table</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { sym: '💎💎💎', mult: '50x', color: 'var(--neon-blue)' },
                { sym: '7️⃣7️⃣7️⃣', mult: '30x', color: 'var(--neon-red)' },
                { sym: '🎰🎰🎰', mult: '20x', color: 'var(--neon-purple)' },
                { sym: '🍀🍀🍀', mult: '15x', color: 'var(--neon-green)' },
                { sym: '⭐⭐⭐', mult: '8x', color: 'var(--neon-gold)' },
                { sym: 'Any 3x', mult: '3x', color: 'var(--text2)' },
                { sym: 'Any 2x', mult: '1.5x', color: 'var(--text2)' },
                { sym: 'Diagonal', mult: '8x', color: 'var(--neon-pink)' },
              ].map(p => (
                <div key={p.sym} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg3)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px' }}>{p.sym}</span>
                  <span style={{ color: p.color, fontWeight: 800, fontSize: '13px' }}>{p.mult}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '16px', fontSize: '15px' }}>Bet Settings</h3>
            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>BET PER SPIN</label>
            <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} disabled={spinning}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px', marginBottom: '16px' }}>
              {[50, 100, 500, 1000].map(v => (
                <button key={v} onClick={() => setBet(v)} disabled={spinning} style={{
                  background: bet === v ? 'var(--neon-purple)20' : 'var(--bg3)',
                  border: `1px solid ${bet === v ? 'var(--neon-purple)' : 'var(--border)'}`,
                  color: bet === v ? 'var(--neon-purple)' : 'var(--text2)',
                  borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg3)', borderRadius: '10px', marginBottom: '12px' }}>
              <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Max Win</span>
              <span style={{ color: 'var(--neon-gold)', fontWeight: 800 }}>{(bet * 50).toLocaleString()}</span>
            </div>

            {state.user && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg3)', borderRadius: '10px', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '14px' }}>{state.user.balance.toLocaleString()} pts</span>
              </div>
            )}

            <button onClick={toggleAuto} style={{
              width: '100%', background: autoSpin ? 'var(--neon-red)20' : 'var(--bg3)',
              border: `1px solid ${autoSpin ? 'var(--neon-red)' : 'var(--border)'}`,
              color: autoSpin ? 'var(--neon-red)' : 'var(--text2)',
              borderRadius: 'var(--radius)', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
            }}>
              {autoSpin ? '⏹ Stop Auto' : '▶ Auto Spin'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
