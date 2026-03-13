import { useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

type Side = 'heads' | 'tails';
type Phase = 'idle' | 'flipping' | 'result';

export default function CoinFlipGame() {
  const { state, navigate, addHistory } = useGame();
  const [bet, setBet] = useState(100);
  const [choice, setChoice] = useState<Side>('heads');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Side | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState<{ result: Side; won: boolean }[]>([]);
  const [flipCount, setFlipCount] = useState(0);

  function flip() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < bet) { alert('Insufficient balance!'); return; }
    if (phase === 'flipping') return;

    setPhase('flipping');
    setWon(null);
    setResult(null);

    const outcome: Side = Math.random() < 0.5 ? 'heads' : 'tails';

    let count = 0;
    const flipInterval = setInterval(() => {
      setFlipCount(c => c + 1);
      count++;
      if (count >= 8) {
        clearInterval(flipInterval);
        setResult(outcome);
        const playerWon = outcome === choice;
        const pout = playerWon ? Math.floor(bet * 1.98) : 0;
        setPayout(pout);
        setWon(playerWon);
        setPhase('result');
        setHistory(prev => [{ result: outcome, won: playerWon }, ...prev].slice(0, 20));

        if (state.user) {
          addHistory({
            id: makeId(), game: 'coinflip', wager: bet,
            multiplier: playerWon ? 1.98 : 0, payout: pout,
            won: playerWon, timestamp: Date.now(),
          });
        }

        setTimeout(() => setPhase('idle'), 3000);
      }
    }, 150);
  }

  const currentFace = phase === 'flipping' ? (flipCount % 2 === 0 ? 'heads' : 'tails') : result;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <button onClick={() => navigate('lobby')} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer',
        }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>🪙 Coin Flip</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* Main display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)', padding: '60px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '340px', position: 'relative', overflow: 'hidden',
          }}>
            {/* Glow effect */}
            <div style={{
              position: 'absolute', width: '300px', height: '300px', borderRadius: '50%',
              background: phase === 'result' ? (won ? 'var(--neon-green)' : 'var(--neon-red)') : 'var(--neon-gold)',
              opacity: 0.06, filter: 'blur(80px)', pointerEvents: 'none',
            }} />

            {/* Coin */}
            <div style={{
              width: '160px', height: '160px', borderRadius: '50%',
              background: currentFace === 'heads' || currentFace === null
                ? 'linear-gradient(135deg, #ffd700, #f5a623, #ffd700)'
                : 'linear-gradient(135deg, #888, #bbb, #888)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: phase === 'result'
                ? `0 0 50px ${won ? 'var(--neon-green)' : 'var(--neon-red)'}60, inset 0 4px 8px rgba(255,255,255,0.3)`
                : '0 0 30px rgba(255, 215, 0, 0.4), inset 0 4px 8px rgba(255,255,255,0.3)',
              animation: phase === 'flipping' ? 'coinFlip 0.3s linear infinite' : phase === 'result' ? 'scaleIn 0.3s ease' : 'none',
              transition: 'box-shadow 0.3s, background 0.15s',
              border: '4px solid rgba(255,255,255,0.2)',
              cursor: 'default',
              perspective: '400px',
            }}>
              <span style={{ fontSize: '72px', lineHeight: 1, userSelect: 'none' }}>
                {currentFace === 'heads' || currentFace === null ? '👑' : '⚜️'}
              </span>
            </div>

            <div style={{ marginTop: '32px', textAlign: 'center' }}>
              {phase === 'idle' && (
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--neon-gold)', marginBottom: '8px' }}>
                    {choice === 'heads' ? '👑 Heads' : '⚜️ Tails'}
                  </div>
                  <div style={{ color: 'var(--text2)', fontSize: '15px' }}>Choose your side and flip!</div>
                </div>
              )}
              {phase === 'flipping' && (
                <div style={{ color: 'var(--neon-gold)', fontWeight: 800, fontSize: '24px', animation: 'pulse 0.3s infinite' }}>
                  Flipping...
                </div>
              )}
              {phase === 'result' && result && (
                <div>
                  <div style={{ color: result === 'heads' ? 'var(--neon-gold)' : 'var(--text2)', fontWeight: 800, fontSize: '24px', marginBottom: '8px' }}>
                    {result === 'heads' ? '👑 HEADS' : '⚜️ TAILS'}
                  </div>
                  <div style={{
                    color: won ? 'var(--neon-green)' : 'var(--neon-red)',
                    fontWeight: 800, fontSize: '28px', animation: 'scaleIn 0.3s ease',
                  }}>
                    {won ? `🎉 Won ₹${payout.toLocaleString()}!` : `💥 Lost ₹${bet.toLocaleString()}`}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{
              background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)', padding: '20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>👑</div>
              <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--neon-gold)' }}>Heads</div>
              <div style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '4px' }}>
                {history.length > 0 ? `${Math.round(history.filter(h => h.result === 'heads').length / history.length * 100)}%` : '50%'}
              </div>
            </div>
            <div style={{
              background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)', padding: '20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>⚜️</div>
              <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--text2)' }}>Tails</div>
              <div style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '4px' }}>
                {history.length > 0 ? `${Math.round(history.filter(h => h.result === 'tails').length / history.length * 100)}%` : '50%'}
              </div>
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Recent Flips</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {history.map((h, i) => (
                  <div key={i} style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: h.result === 'heads' ? 'var(--neon-gold)30' : 'var(--bg3)',
                    border: `2px solid ${h.won ? 'var(--neon-green)' : 'var(--neon-red)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px',
                  }}>
                    {h.result === 'heads' ? '👑' : '⚜️'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>Place Bet</h3>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
              PICK YOUR SIDE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
              <button onClick={() => setChoice('heads')} style={{
                padding: '20px 12px', borderRadius: 'var(--radius)',
                background: choice === 'heads' ? 'var(--neon-gold)' : 'var(--bg3)',
                color: choice === 'heads' ? '#000' : 'var(--text2)',
                border: `1px solid ${choice === 'heads' ? 'var(--neon-gold)' : 'var(--border)'}`,
                fontWeight: 800, fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
                👑<br />HEADS
              </button>
              <button onClick={() => setChoice('tails')} style={{
                padding: '20px 12px', borderRadius: 'var(--radius)',
                background: choice === 'tails' ? '#888' : 'var(--bg3)',
                color: choice === 'tails' ? '#fff' : 'var(--text2)',
                border: `1px solid ${choice === 'tails' ? '#888' : 'var(--border)'}`,
                fontWeight: 800, fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
                ⚜️<br />TAILS
              </button>
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
              BET AMOUNT
            </label>
            <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))}
              disabled={phase === 'flipping'}
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '12px 14px',
                color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px',
              }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '20px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setBet(v)} style={{
                  background: bet === v ? 'var(--neon-gold)20' : 'var(--bg3)',
                  border: `1px solid ${bet === v ? 'var(--neon-gold)' : 'var(--border)'}`,
                  color: bet === v ? 'var(--neon-gold)' : 'var(--text2)',
                  borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>

            <div style={{
              background: 'var(--bg3)', borderRadius: '10px', padding: '14px',
              border: '1px solid var(--border)', marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Multiplier</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)' }}>1.98x</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Potential Win</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-green)' }}>+{Math.floor(bet * 0.98).toLocaleString()}</span>
              </div>
            </div>

            <button onClick={flip} disabled={phase === 'flipping'}
              style={{
                width: '100%',
                background: phase === 'flipping' ? 'var(--bg3)' : 'linear-gradient(135deg, var(--neon-gold), #f5a623)',
                color: phase === 'flipping' ? 'var(--text2)' : '#000',
                border: 'none', borderRadius: 'var(--radius)', padding: '16px',
                fontWeight: 800, fontSize: '16px', cursor: phase === 'flipping' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}>
              {phase === 'flipping' ? '🪙 Flipping...' : '🪙 Flip Coin!'}
            </button>

            {state.user && (
              <div style={{
                marginTop: '12px', padding: '12px', borderRadius: '10px',
                background: 'var(--bg3)', border: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Your Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '14px' }}>
                  ₹{state.user.balance.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
