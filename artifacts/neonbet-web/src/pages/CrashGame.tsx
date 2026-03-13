import { useEffect, useRef, useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

type Phase = 'waiting' | 'flying' | 'crashed';

const HISTORY_ITEMS = [2.14, 1.01, 8.56, 3.22, 1.01, 15.4, 2.87, 1.01, 4.12, 1.01, 22.8, 1.01, 1.63, 5.5, 1.01];

// Balanced curve: e^(0.10 * t)
// 1x→2x ≈ 7s, 1x→5x ≈ 16s, 1x→10x ≈ 23s
function getMultiplier(elapsedSec: number): number {
  return Math.floor(Math.pow(Math.E, 0.10 * elapsedSec) * 100) / 100;
}

export default function CrashGame() {
  const { state, navigate, addHistory, addNotification } = useGame();

  const [phase, setPhase] = useState<Phase>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [betAmount, setBetAmount] = useState(100);
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [crashPoint, setCrashPoint] = useState(0);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [history, setHistory] = useState(HISTORY_ITEMS);
  const [resultMsg, setResultMsg] = useState<{ text: string; win: boolean } | null>(null);
  const [bets, setBets] = useState([
    { user: 'Player1', amount: 250, status: 'active', cashout: null as number | null },
    { user: 'CryptoKing', amount: 1000, status: 'active', cashout: null as number | null },
    { user: 'NeonBlade', amount: 750, status: 'active', cashout: null as number | null },
    { user: 'StarDust', amount: 500, status: 'active', cashout: null as number | null },
  ]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef(0);
  const crashPointRef = useRef(0);
  const multiplierRef = useRef(1.0);
  const phaseRef = useRef<Phase>('waiting');
  const hasActiveBetRef = useRef(false);
  const cashedOutRef = useRef<number | null>(null);

  function generateCrashPoint() {
    const r = Math.random();
    if (r < 0.28) return 1.00 + Math.random() * 0.05;  // instant crash
    if (r < 0.50) return 1.1 + Math.random() * 0.6;
    if (r < 0.70) return 1.8 + Math.random() * 1.5;
    if (r < 0.85) return 3.5 + Math.random() * 6;
    if (r < 0.94) return 10 + Math.random() * 20;
    if (r < 0.99) return 30 + Math.random() * 70;
    return 100 + Math.random() * 900;
  }

  function startCountdown() {
    phaseRef.current = 'waiting';
    setPhase('waiting');
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    setCashedOutAt(null);
    cashedOutRef.current = null;
    setResultMsg(null);
    hasActiveBetRef.current = false;
    setHasActiveBet(false);
    setBets([
      { user: 'Player1', amount: 250 + Math.floor(Math.random() * 750), status: 'active', cashout: null },
      { user: 'CryptoKing', amount: 500 + Math.floor(Math.random() * 1500), status: 'active', cashout: null },
      { user: 'NeonBlade', amount: 250 + Math.floor(Math.random() * 1000), status: 'active', cashout: null },
      { user: 'StarDust', amount: 100 + Math.floor(Math.random() * 500), status: 'active', cashout: null },
    ]);

    const cp = generateCrashPoint();
    setCrashPoint(cp);
    crashPointRef.current = cp;

    let t = 5;
    setCountdown(t);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      t--;
      setCountdown(t);
      if (t <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        startFlight();
      }
    }, 1000);
  }

  function startFlight() {
    phaseRef.current = 'flying';
    setPhase('flying');
    startTimeRef.current = Date.now();

    if (intervalRef.current) clearInterval(intervalRef.current);
    // 100ms tick — smooth but not frantic
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const m = getMultiplier(elapsed);
      multiplierRef.current = m;
      setMultiplier(m);

      // Random bot cashouts (slower probability to match slower pace)
      setBets(prev => prev.map(b => {
        if (b.status === 'active' && Math.random() < 0.003 && m > 1.2) {
          return { ...b, status: 'cashed', cashout: m };
        }
        return b;
      }));

      // Auto cashout
      if (hasActiveBetRef.current && autoCashout > 1 && m >= autoCashout && !cashedOutRef.current) {
        doCashout(m);
        return;
      }

      if (m >= crashPointRef.current) {
        doCrash(m);
      }
    }, 100);
  }

  function doCashout(atMult: number) {
    if (!hasActiveBetRef.current || cashedOutRef.current) return;
    cashedOutRef.current = atMult;
    setCashedOutAt(atMult);
    hasActiveBetRef.current = false;
    setHasActiveBet(false);
    const payout = Math.floor(betAmount * atMult);
    const profit = payout - betAmount;
    setResultMsg({ text: `Cashed out at ${atMult.toFixed(2)}x! +${profit.toLocaleString()} pts`, win: true });
    if (state.user) {
      addHistory({ id: makeId(), game: 'crash', wager: betAmount, multiplier: atMult, payout, won: true, timestamp: Date.now() });
      addNotification(`✈️ Cashed out at ${atMult.toFixed(2)}x! +${profit.toLocaleString()} pts`, 'win');
    }
  }

  function doCrash(finalMult: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    phaseRef.current = 'crashed';
    setPhase('crashed');
    setHistory(prev => [Math.floor(finalMult * 100) / 100, ...prev].slice(0, 15));

    if (hasActiveBetRef.current && !cashedOutRef.current) {
      setResultMsg({ text: `Crashed at ${finalMult.toFixed(2)}x! Lost ${betAmount.toLocaleString()} pts`, win: false });
      if (state.user) {
        addHistory({ id: makeId(), game: 'crash', wager: betAmount, multiplier: finalMult, payout: 0, won: false, timestamp: Date.now() });
      }
      hasActiveBetRef.current = false;
      setHasActiveBet(false);
    }

    setBets(prev => prev.map(b => b.status === 'active' ? { ...b, status: 'crashed' } : b));
    setTimeout(() => startCountdown(), 4000);
  }

  function placeBet() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < betAmount) { alert('Insufficient balance!'); return; }
    if (phase !== 'waiting') { alert('Wait for next round!'); return; }
    hasActiveBetRef.current = true;
    setHasActiveBet(true);
    setBets(prev => [{ user: state.user!.username, amount: betAmount, status: 'active', cashout: null }, ...prev]);
  }

  function cashOut() {
    if (!hasActiveBetRef.current || phaseRef.current !== 'flying' || cashedOutRef.current) return;
    doCashout(multiplierRef.current);
  }

  // Canvas animation loop (separate from game logic)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;

    // Point history for drawing the curve
    const points: { x: number; y: number }[] = [];

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a0a14');
      bg.addColorStop(1, '#070710');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(i * W / 6, 0); ctx.lineTo(i * W / 6, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * H / 5); ctx.lineTo(W, i * H / 5); ctx.stroke();
      }

      // Multiplier labels on left
      ctx.fillStyle = '#33334a';
      ctx.font = '11px Inter';
      ctx.textAlign = 'left';
      for (let i = 1; i <= 5; i++) {
        const y = H - i * H / 5;
        ctx.fillText(`${i}x`, 6, y - 4);
      }

      if (phaseRef.current === 'waiting') {
        ctx.fillStyle = '#8888aa';
        ctx.font = 'bold 18px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for next round...', W / 2, H / 2 + 6);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const m = multiplierRef.current;
      const iscrashed = phaseRef.current === 'crashed';
      const lineColor = iscrashed ? '#ff3b5c' : '#00d4ff';

      // How far along the x-axis the plane is
      // Cap at 90% of canvas width so we don't go off screen
      const maxMult = Math.max(crashPointRef.current, m, 3);
      const progress = Math.min((m - 1) / (maxMult - 1), 0.92);

      // Build current point
      const curX = 30 + progress * (W - 60);
      // Y: logarithmic curve
      const t = progress;
      const curY = (H - 30) - (H - 70) * Math.pow(t, 0.7);

      // Track points
      if (!iscrashed && points.length === 0) { points.push({ x: 30, y: H - 30 }); }
      if (!iscrashed) { points.push({ x: curX, y: curY }); if (points.length > 300) points.shift(); }

      // Draw filled area under curve
      if (points.length > 1) {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, `${lineColor}25`);
        grad.addColorStop(1, `${lineColor}03`);

        ctx.beginPath();
        ctx.moveTo(points[0].x, H - 30);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, H - 30);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Draw curve line
      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const cpx = (prev.x + curr.x) / 2;
          ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
        }
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (!iscrashed) {
        // Plane emoji at tip of curve
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        // Angle the plane by computing slope
        const last2 = points.length >= 2 ? points[points.length - 2] : null;
        const angle = last2 ? Math.atan2(curY - last2.y, curX - last2.x) : -0.4;
        ctx.save();
        ctx.translate(curX, curY - 10);
        ctx.rotate(angle);
        ctx.fillText('✈️', 0, 0);
        ctx.restore();
      } else {
        // Explosion at crash point
        ctx.font = '36px serif';
        ctx.textAlign = 'center';
        ctx.fillText('💥', curX, curY - 10);
      }

      // Multiplier text on canvas
      if (!iscrashed) {
        ctx.font = 'bold 44px Inter';
        ctx.textAlign = 'center';
        ctx.fillStyle = m >= 3 ? '#00ff88' : m >= 2 ? '#ffd700' : '#00d4ff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 20;
        ctx.fillText(`${m.toFixed(2)}x`, W / 2, 60);
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); points.length = 0; };
  }, []);

  useEffect(() => {
    startCountdown();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const multColor = phase === 'crashed' ? 'var(--neon-red)' : multiplier >= 3 ? 'var(--neon-green)' : multiplier >= 2 ? 'var(--neon-gold)' : 'var(--neon-blue)';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('fastgames')} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)',
          cursor: 'pointer', fontSize: '14px',
        }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>✈️ Crash</h1>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {history.slice(0, 12).map((v, i) => (
            <div key={i} style={{
              background: v <= 1.5 ? 'var(--neon-red)20' : v >= 10 ? 'var(--neon-gold)20' : 'var(--neon-green)20',
              color: v <= 1.5 ? 'var(--neon-red)' : v >= 10 ? 'var(--neon-gold)' : 'var(--neon-green)',
              borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700,
            }}>{v.toFixed(2)}x</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        {/* Canvas area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: '#0a0a14', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
          }}>
            <canvas ref={canvasRef} width={720} height={380} style={{ width: '100%', display: 'block' }} />

            {/* Overlay: crashed big text */}
            {phase === 'crashed' && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center', pointerEvents: 'none',
                animation: 'scaleIn 0.2s ease',
              }}>
                <div style={{ fontSize: '64px', fontWeight: 900, color: 'var(--neon-red)', textShadow: '0 0 40px var(--neon-red)', lineHeight: 1 }}>
                  CRASHED
                </div>
                <div style={{ color: 'var(--neon-red)', fontWeight: 700, fontSize: '20px', marginTop: '8px' }}>
                  at {multiplier.toFixed(2)}x
                </div>
              </div>
            )}

            {/* Waiting overlay */}
            {phase === 'waiting' && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none',
              }}>
                <div style={{ fontSize: '56px', marginBottom: '12px' }}>✈️</div>
                <div style={{ color: 'var(--text2)', fontWeight: 700, fontSize: '18px' }}>Next round in</div>
                <div style={{ fontSize: '52px', fontWeight: 900, color: 'var(--neon-blue)', textShadow: '0 0 20px var(--neon-blue)', lineHeight: 1.1 }}>
                  {countdown}s
                </div>
              </div>
            )}
          </div>

          {/* Result banner */}
          {resultMsg && (
            <div style={{
              padding: '16px 20px', borderRadius: 'var(--radius)',
              background: resultMsg.win ? 'var(--neon-green)15' : 'var(--neon-red)15',
              border: `1px solid ${resultMsg.win ? 'var(--neon-green)40' : 'var(--neon-red)40'}`,
              color: resultMsg.win ? 'var(--neon-green)' : 'var(--neon-red)',
              fontWeight: 700, fontSize: '18px', textAlign: 'center',
              animation: 'scaleIn 0.3s ease',
            }}>
              {resultMsg.win ? '🎉' : '💥'} {resultMsg.text}
            </div>
          )}

          {/* Live bets */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>👥 Live Bets</span>
              <span style={{ color: 'var(--text3)', fontSize: '13px' }}>{bets.length} players</span>
            </div>
            <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
              {bets.map((b, i) => (
                <div key={i} style={{
                  padding: '10px 18px',
                  borderBottom: i < bets.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: b.status === 'crashed' ? 'var(--neon-red)' : b.status === 'cashed' ? 'var(--neon-green)' : 'var(--neon-blue)',
                      animation: b.status === 'active' ? 'pulse 1.5s infinite' : 'none',
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{b.user}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)', fontSize: '13px' }}>{b.amount.toLocaleString()} pts</span>
                    {b.status === 'cashed' && <span style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '13px' }}>✓ {b.cashout?.toFixed(2)}x</span>}
                    {b.status === 'crashed' && <span style={{ color: 'var(--neon-red)', fontWeight: 700, fontSize: '13px' }}>✗ Lost</span>}
                    {b.status === 'active' && <span style={{ color: 'var(--neon-blue)', fontSize: '12px', fontStyle: 'italic' }}>In flight...</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>Place Bet</h3>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>BET AMOUNT</label>
            <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
              disabled={phase !== 'waiting'}
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '12px 14px',
                color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px',
              }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '16px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setBetAmount(v)} disabled={phase !== 'waiting'} style={{
                  background: betAmount === v ? 'var(--neon-blue)20' : 'var(--bg3)',
                  border: `1px solid ${betAmount === v ? 'var(--neon-blue)' : 'var(--border)'}`,
                  color: betAmount === v ? 'var(--neon-blue)' : 'var(--text2)',
                  borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>AUTO CASHOUT AT</label>
            <input type="number" value={autoCashout} step="0.1" min="1.1" onChange={e => setAutoCashout(Number(e.target.value))}
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '12px 14px',
                color: 'var(--text)', fontSize: '15px', fontWeight: 700, marginBottom: '20px',
              }} />

            {!hasActiveBet ? (
              <button onClick={placeBet} disabled={phase !== 'waiting'} style={{
                width: '100%',
                background: phase === 'waiting' ? 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))' : 'var(--bg3)',
                color: phase === 'waiting' ? '#fff' : 'var(--text2)',
                border: 'none', borderRadius: 'var(--radius)', padding: '16px',
                fontWeight: 800, fontSize: '16px', cursor: phase === 'waiting' ? 'pointer' : 'not-allowed',
              }}>
                {phase === 'waiting' ? `✈️ Bet ${betAmount.toLocaleString()} pts` : 'Round in progress...'}
              </button>
            ) : (
              <button onClick={cashOut} disabled={phase !== 'flying' || !!cashedOutAt} style={{
                width: '100%',
                background: !cashedOutAt && phase === 'flying' ? 'var(--neon-green)' : 'var(--bg3)',
                color: !cashedOutAt && phase === 'flying' ? '#000' : 'var(--text2)',
                border: 'none', borderRadius: 'var(--radius)', padding: '16px',
                fontWeight: 800, fontSize: '16px',
                cursor: !cashedOutAt && phase === 'flying' ? 'pointer' : 'not-allowed',
                animation: !cashedOutAt && phase === 'flying' ? 'neonPulse 1.5s infinite' : 'none',
              }}>
                {cashedOutAt
                  ? `✅ Cashed at ${cashedOutAt.toFixed(2)}x`
                  : `💰 Cash Out  ${Math.floor(betAmount * multiplier).toLocaleString()}`}
              </button>
            )}

            {/* Live multiplier display */}
            {phase === 'flying' && (
              <div style={{
                marginTop: '14px', padding: '14px', borderRadius: '12px', textAlign: 'center',
                background: 'var(--bg3)', border: `1px solid ${multColor}40`,
              }}>
                <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>CURRENT</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: multColor, textShadow: `0 0 20px ${multColor}`, lineHeight: 1 }}>
                  {multiplier.toFixed(2)}x
                </div>
                {hasActiveBet && !cashedOutAt && (
                  <div style={{ color: 'var(--neon-green)', fontSize: '14px', fontWeight: 700, marginTop: '6px' }}>
                    → {Math.floor(betAmount * multiplier).toLocaleString()} pts
                  </div>
                )}
              </div>
            )}

            {state.user && (
              <div style={{
                marginTop: '12px', padding: '12px', borderRadius: '10px',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '14px' }}>
                  {state.user.balance.toLocaleString()} pts
                </span>
              </div>
            )}
          </div>

          {/* Round history */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '14px' }}>Round History</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {history.map((v, i) => (
                <div key={i} style={{
                  background: v <= 1.5 ? 'var(--neon-red)15' : v >= 10 ? 'var(--neon-gold)15' : 'var(--neon-green)15',
                  color: v <= 1.5 ? 'var(--neon-red)' : v >= 10 ? 'var(--neon-gold)' : 'var(--neon-green)',
                  borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 700,
                }}>{v.toFixed(2)}x</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
