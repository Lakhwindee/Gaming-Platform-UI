import { useEffect, useRef, useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

type Phase = 'waiting' | 'flying' | 'crashed';

const HISTORY_ITEMS = [2.14, 1.01, 8.56, 3.22, 1.01, 15.4, 2.87, 1.01, 4.12, 1.01, 22.8, 1.01, 1.63, 5.5, 1.01];

export default function CrashGame() {
  const { state, navigate, addHistory } = useGame();

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
    { user: 'Player2', amount: 500, status: 'active', cashout: null as number | null },
    { user: 'CryptoKing', amount: 1000, status: 'active', cashout: null as number | null },
    { user: 'NeonBlade', amount: 750, status: 'active', cashout: null as number | null },
  ]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef(0);
  const crashPointRef = useRef(0);

  function generateCrashPoint() {
    const r = Math.random();
    if (r < 0.33) return 1.0 + Math.random() * 0.1;
    if (r < 0.6) return 1.2 + Math.random() * 0.8;
    if (r < 0.8) return 2 + Math.random() * 3;
    if (r < 0.92) return 5 + Math.random() * 10;
    if (r < 0.98) return 15 + Math.random() * 30;
    return 50 + Math.random() * 950;
  }

  function startCountdown() {
    setPhase('waiting');
    setMultiplier(1.0);
    setCashedOutAt(null);
    setResultMsg(null);
    setHasActiveBet(false);
    setBets([
      { user: 'Player1', amount: 250, status: 'active', cashout: null },
      { user: 'Player2', amount: 500, status: 'active', cashout: null },
      { user: 'CryptoKing', amount: 1000, status: 'active', cashout: null },
      { user: 'NeonBlade', amount: 750, status: 'active', cashout: null },
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
    setPhase('flying');
    startTimeRef.current = Date.now();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const m = Math.pow(Math.E, 0.25 * elapsed);
      const rounded = Math.floor(m * 100) / 100;

      setMultiplier(rounded);

      // Random bot cashouts
      setBets(prev => prev.map(b => {
        if (b.status === 'active' && Math.random() < 0.005 && rounded > 1.5) {
          return { ...b, status: 'cashed', cashout: rounded };
        }
        return b;
      }));

      // Auto cashout
      if (hasActiveBet && autoCashout > 1 && rounded >= autoCashout) {
        doCashout(rounded);
        return;
      }

      if (rounded >= crashPointRef.current) {
        doCrash(rounded);
      }
    }, 50);
  }

  function doCashout(atMult: number) {
    if (!hasActiveBet || cashedOutAt) return;
    setCashedOutAt(atMult);
    setHasActiveBet(false);
    const payout = Math.floor(betAmount * atMult);
    const profit = payout - betAmount;
    setResultMsg({ text: `Cashed out at ${atMult.toFixed(2)}x! +${profit.toLocaleString()} pts`, win: true });
    if (state.user) {
      addHistory({
        id: makeId(), game: 'crash', wager: betAmount,
        multiplier: atMult, payout, won: true, timestamp: Date.now(),
      });
    }
  }

  function doCrash(finalMult: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('crashed');
    setHistory(prev => [Math.floor(finalMult * 100) / 100, ...prev].slice(0, 15));

    if (hasActiveBet && !cashedOutAt) {
      setResultMsg({ text: `Crashed at ${finalMult.toFixed(2)}x! Lost ${betAmount.toLocaleString()} pts`, win: false });
      if (state.user) {
        addHistory({
          id: makeId(), game: 'crash', wager: betAmount,
          multiplier: finalMult, payout: 0, won: false, timestamp: Date.now(),
        });
      }
      setHasActiveBet(false);
    }

    setBets(prev => prev.map(b => b.status === 'active' ? { ...b, status: 'crashed' } : b));

    setTimeout(() => startCountdown(), 4000);
  }

  function placeBet() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < betAmount) { alert('Insufficient balance!'); return; }
    if (phase !== 'waiting') { alert('Wait for next round!'); return; }
    setHasActiveBet(true);
    setBets(prev => [{ user: state.user!.username, amount: betAmount, status: 'active', cashout: null }, ...prev]);
  }

  function cashOut() {
    if (!hasActiveBet || phase !== 'flying' || cashedOutAt) return;
    doCashout(multiplier);
  }

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (phase === 'waiting') {
      ctx.fillStyle = '#00d4ff20';
      ctx.font = 'bold 24px Inter';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8888aa';
      ctx.fillText(`Next round in ${countdown}s`, W / 2, H / 2);
      return;
    }

    // Grid
    ctx.strokeStyle = '#252535';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(i * W / 4, 0); ctx.lineTo(i * W / 4, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * H / 4); ctx.lineTo(W, i * H / 4); ctx.stroke();
    }

    const progress = Math.min((multiplier - 1) / Math.max(crashPointRef.current - 1, 1), 1);
    const lineColor = phase === 'crashed' ? '#ff3b5c' : '#00d4ff';

    // Draw curve
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 12;
    ctx.moveTo(0, H - 20);

    const pts = 60;
    for (let i = 0; i <= pts; i++) {
      const t = (i / pts) * progress;
      const x = t * (W - 20) + 10;
      const y = H - 20 - (H - 60) * Math.pow(t, 1.4) * Math.min(1, progress + 0.1);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dot at end
    const dotX = progress * (W - 20) + 10;
    const dotY = H - 20 - (H - 60) * Math.pow(progress, 1.4) * Math.min(1, progress + 0.1);
    ctx.beginPath();
    ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

  }, [phase, multiplier, countdown]);

  useEffect(() => { startCountdown(); return () => { if (intervalRef.current) clearInterval(intervalRef.current); if (countdownRef.current) clearInterval(countdownRef.current); }; }, []);

  const multColor = phase === 'crashed' ? 'var(--neon-red)' : multiplier >= 2 ? 'var(--neon-green)' : 'var(--neon-blue)';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('lobby')} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)',
          cursor: 'pointer', fontSize: '14px',
        }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>📈 Crash</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {history.slice(0, 10).map((v, i) => (
            <div key={i} style={{
              background: v <= 1.5 ? 'var(--neon-red)20' : 'var(--neon-green)20',
              color: v <= 1.5 ? 'var(--neon-red)' : 'var(--neon-green)',
              borderRadius: '8px', padding: '4px 10px', fontSize: '13px', fontWeight: 700,
            }}>{v.toFixed(2)}x</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
        {/* Canvas area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
          }}>
            <canvas ref={canvasRef} width={700} height={360}
              style={{ width: '100%', display: 'block' }} />

            {/* Overlay multiplier */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{
                fontSize: phase === 'crashed' ? '72px' : '80px',
                fontWeight: 900, letterSpacing: '-2px',
                color: multColor,
                textShadow: `0 0 30px ${multColor}`,
                lineHeight: 1,
                transition: 'color 0.2s',
              }}>
                {phase === 'crashed' ? 'CRASH!' : `${multiplier.toFixed(2)}x`}
              </div>
              {phase === 'crashed' && (
                <div style={{ color: 'var(--neon-red)', fontWeight: 700, fontSize: '18px', marginTop: '8px' }}>
                  Crashed at {multiplier.toFixed(2)}x
                </div>
              )}
              {phase === 'waiting' && (
                <div style={{ color: 'var(--text2)', fontWeight: 600, fontSize: '18px', marginTop: '8px' }}>
                  Next round in {countdown}s
                </div>
              )}
            </div>
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
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>👥 Live Bets</span>
              <span style={{ color: 'var(--text3)', fontSize: '13px' }}>{bets.length} players</span>
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {bets.map((b, i) => (
                <div key={i} style={{
                  padding: '10px 18px', borderBottom: i < bets.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: b.status === 'crashed' ? 'var(--neon-red)' : b.status === 'cashed' ? 'var(--neon-green)' : 'var(--neon-blue)',
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{b.user}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)', fontSize: '13px' }}>{b.amount.toLocaleString()}</span>
                    {b.status === 'cashed' && <span style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '13px' }}>✓ {b.cashout?.toFixed(2)}x</span>}
                    {b.status === 'crashed' && <span style={{ color: 'var(--neon-red)', fontWeight: 700, fontSize: '13px' }}>✗ Lost</span>}
                    {b.status === 'active' && <span style={{ color: 'var(--neon-blue)', fontSize: '12px' }}>Playing...</span>}
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

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
              BET AMOUNT
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
                disabled={phase !== 'waiting' && hasActiveBet}
                style={{
                  flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '12px 14px',
                  color: 'var(--text)', fontSize: '16px', fontWeight: 700,
                }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '16px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setBetAmount(v)}
                  disabled={phase !== 'waiting'}
                  style={{
                    background: betAmount === v ? 'var(--neon-blue)20' : 'var(--bg3)',
                    border: `1px solid ${betAmount === v ? 'var(--neon-blue)' : 'var(--border)'}`,
                    color: betAmount === v ? 'var(--neon-blue)' : 'var(--text2)',
                    borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  }}>{v}</button>
              ))}
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
              AUTO CASHOUT AT
            </label>
            <input type="number" value={autoCashout} step="0.1" onChange={e => setAutoCashout(Number(e.target.value))}
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '12px 14px',
                color: 'var(--text)', fontSize: '15px', fontWeight: 700, marginBottom: '20px',
              }} />

            {!hasActiveBet ? (
              <button onClick={placeBet} disabled={phase !== 'waiting'}
                style={{
                  width: '100%', background: phase === 'waiting' ? 'var(--neon-blue)' : 'var(--bg3)',
                  color: phase === 'waiting' ? '#000' : 'var(--text2)',
                  border: 'none', borderRadius: 'var(--radius)', padding: '16px',
                  fontWeight: 800, fontSize: '16px', cursor: phase === 'waiting' ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}>
                {phase === 'waiting' ? `Bet ${betAmount.toLocaleString()} pts` : 'Round in progress...'}
              </button>
            ) : (
              <button onClick={cashOut} disabled={phase !== 'flying' || !!cashedOutAt}
                style={{
                  width: '100%', background: !cashedOutAt && phase === 'flying' ? 'var(--neon-green)' : 'var(--bg3)',
                  color: !cashedOutAt && phase === 'flying' ? '#000' : 'var(--text2)',
                  border: 'none', borderRadius: 'var(--radius)', padding: '16px',
                  fontWeight: 800, fontSize: '16px', cursor: !cashedOutAt && phase === 'flying' ? 'pointer' : 'not-allowed',
                  animation: !cashedOutAt && phase === 'flying' ? 'neonPulse 1.5s infinite' : 'none',
                }}>
                {cashedOutAt ? `Cashed out at ${cashedOutAt.toFixed(2)}x` : `💰 Cash Out ${(betAmount * multiplier).toFixed(0)}`}
              </button>
            )}

            {state.user && (
              <div style={{
                marginTop: '16px', padding: '12px', borderRadius: '10px',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Your Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '14px' }}>
                  {state.user.balance.toLocaleString()} pts
                </span>
              </div>
            )}
          </div>

          {/* Recent history */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '14px' }}>Round History</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {history.map((v, i) => (
                <div key={i} style={{
                  background: v <= 1.5 ? 'var(--neon-red)15' : v >= 5 ? 'var(--neon-gold)15' : 'var(--neon-green)15',
                  color: v <= 1.5 ? 'var(--neon-red)' : v >= 5 ? 'var(--neon-gold)' : 'var(--neon-green)',
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
