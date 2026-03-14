import { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { makeId } from '../lib/utils';

const ROWS = 12;
const MULTIPLIERS_12 = [1000, 130, 26, 9, 4, 2, 0.5, 0.5, 2, 4, 9, 26, 130, 1000];

type Ball = { x: number; y: number; vx: number; vy: number; done: boolean; slot: number };

export default function PlinkoGame() {
  const { state, navigate, addHistory, addNotification } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animRef = useRef<number>(0);
  const [bet, setBet] = useState(100);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [lastResult, setLastResult] = useState<{ mult: number; won: boolean; payout: number } | null>(null);
  const [dropping, setDropping] = useState(false);
  const [totalWon, setTotalWon] = useState(0);

  const W = 500, H = 460;
  const PIN_R = 4;
  const BALL_R = 8;
  const TOP_PAD = 40;
  const COL_SPACING = W / (ROWS + 2);

  const RISK_MULTS: Record<string, number[]> = {
    low: [5.6, 2.1, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 2.1, 5.6, 5.6, 2.1, 5.6],
    medium: [88, 14, 5.3, 3, 1.3, 0.7, 0.5, 0.7, 1.3, 3, 5.3, 14, 88, 88],
    high: [1000, 130, 26, 9, 4, 2, 0.5, 0.5, 2, 4, 9, 26, 130, 1000],
  };

  const mults = RISK_MULTS[risk];
  const numSlots = mults.length;
  const slotW = W / numSlots;

  function dropBall() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < bet) { alert('Insufficient balance!'); return; }
    setDropping(true);

    const ball: Ball = {
      x: W / 2 + (Math.random() - 0.5) * 2,
      y: TOP_PAD, vx: (Math.random() - 0.5) * 0.5,
      vy: 2, done: false, slot: 0,
    };
    ballsRef.current.push(ball);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function getPinPos(row: number, col: number) {
      const pinsInRow = row + 1;
      const rowWidth = pinsInRow * COL_SPACING;
      const startX = (W - rowWidth) / 2 + COL_SPACING / 2;
      const y = TOP_PAD + row * ((H - TOP_PAD - 60) / ROWS);
      return { x: startX + col * COL_SPACING, y };
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#111118';
      ctx.fillRect(0, 0, W, H);

      // Grid/pins
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col <= row; col++) {
          const { x, y } = getPinPos(row, col);
          ctx.beginPath();
          ctx.arc(x, y, PIN_R, 0, Math.PI * 2);
          ctx.fillStyle = '#2e2e45';
          ctx.fill();
        }
      }

      // Slots
      for (let i = 0; i < numSlots; i++) {
        const m = mults[i];
        const x = i * slotW;
        const slotColor = m >= 100 ? '#ffd700' : m >= 10 ? '#ff3b5c' : m >= 2 ? '#a855f7' : m >= 1 ? '#00d4ff' : '#44445a';
        ctx.fillStyle = slotColor + '40';
        ctx.fillRect(x + 2, H - 52, slotW - 4, 48);
        ctx.fillStyle = slotColor;
        ctx.font = 'bold 11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${m}x`, x + slotW / 2, H - 28);
      }

      // Update & draw balls
      ballsRef.current = ballsRef.current.filter(b => {
        if (b.done) return false;

        b.vy += 0.25;
        b.x += b.vx;
        b.y += b.vy;

        // Bounce off pins
        for (let row = 0; row < ROWS; row++) {
          for (let col = 0; col <= row; col++) {
            const { x: px, y: py } = getPinPos(row, col);
            const dx = b.x - px, dy = b.y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < PIN_R + BALL_R) {
              const nx = dx / dist, ny = dy / dist;
              const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
              b.vx = nx * speed * 0.8 + (Math.random() - 0.5) * 2;
              b.vy = Math.abs(ny * speed * 0.8) + 1;
              b.x = px + nx * (PIN_R + BALL_R + 1);
              b.y = py + ny * (PIN_R + BALL_R + 1);
            }
          }
        }

        // Walls
        if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
        if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }

        // Land
        if (b.y >= H - 60) {
          b.done = true;
          const slot = Math.min(numSlots - 1, Math.max(0, Math.floor(b.x / slotW)));
          const mult = mults[slot];
          const payout = Math.floor(bet * mult);
          const won = payout >= bet;
          setLastResult({ mult, won, payout });
          setTotalWon(t => t + payout - bet);
          setDropping(false);
          if (state.user) {
            addHistory({ id: makeId(), game: 'plinko', wager: bet, multiplier: mult, payout, won, timestamp: Date.now() });
            if (won) addNotification(`🎯 Plinko landed on ${mult}x! +₹${(payout - bet).toLocaleString()}`, 'win');
          }
          return false;
        }

        // Draw ball
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
        ctx.fillStyle = '#00d4ff';
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        return true;
      });

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [bet, risk, state.user]);

  const riskColors = { low: 'var(--neon-green)', medium: 'var(--neon-blue)', high: 'var(--neon-red)' };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('fastgames')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>🎯 Plinko</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
        <div>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', display: 'block' }} />
          </div>
          {lastResult && (
            <div style={{
              marginTop: '12px', padding: '16px', borderRadius: 'var(--radius-lg)',
              background: lastResult.won ? 'var(--neon-green)15' : 'var(--neon-red)15',
              border: `1px solid ${lastResult.won ? 'var(--neon-green)' : 'var(--neon-red)'}40`,
              textAlign: 'center', animation: 'scaleIn 0.3s ease',
            }}>
              <span style={{ color: lastResult.won ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 800, fontSize: '20px' }}>
                {lastResult.won ? '🎉' : '😞'} {lastResult.mult}x — {lastResult.won ? '+' : ''}₹{(lastResult.payout - bet).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>Drop Settings</h3>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>RISK LEVEL</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '16px' }}>
              {(['low', 'medium', 'high'] as const).map(r => (
                <button key={r} onClick={() => setRisk(r)} style={{
                  padding: '8px', borderRadius: '8px',
                  background: risk === r ? `${riskColors[r]}20` : 'var(--bg3)',
                  border: `1px solid ${risk === r ? riskColors[r] : 'var(--border)'}`,
                  color: risk === r ? riskColors[r] : 'var(--text2)',
                  fontWeight: 700, fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize',
                }}>{r}</button>
              ))}
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>BET AMOUNT</label>
            <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} disabled={dropping}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px', marginBottom: '20px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setBet(v)} disabled={dropping} style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  color: 'var(--text2)', borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>

            <button onClick={dropBall} disabled={dropping}
              style={{
                width: '100%', background: dropping ? 'var(--bg3)' : 'var(--neon-purple)',
                color: dropping ? 'var(--text2)' : '#fff', border: 'none',
                borderRadius: 'var(--radius)', padding: '16px', fontWeight: 800, fontSize: '16px', cursor: dropping ? 'wait' : 'pointer',
              }}>
              {dropping ? '🎯 Dropping...' : '🎯 Drop Ball!'}
            </button>

            {state.user && (
              <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '14px' }}>₹{state.user.balance.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '16px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '10px' }}>Top Multipliers</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[...new Set(mults)].sort((a, b) => b - a).slice(0, 6).map(m => (
                <div key={m} style={{
                  background: m >= 100 ? 'var(--neon-gold)20' : m >= 10 ? 'var(--neon-red)20' : 'var(--neon-purple)20',
                  color: m >= 100 ? 'var(--neon-gold)' : m >= 10 ? 'var(--neon-red)' : 'var(--neon-purple)',
                  borderRadius: '8px', padding: '4px 10px', fontWeight: 700, fontSize: '13px',
                }}>{m}x</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
