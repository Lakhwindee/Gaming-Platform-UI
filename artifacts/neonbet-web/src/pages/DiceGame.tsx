import { useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

type Choice = 'high' | 'low';
type Phase = 'idle' | 'rolling' | 'result';

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function DiceGame() {
  const { state, navigate, addHistory } = useGame();
  const [bet, setBet] = useState(100);
  const [choice, setChoice] = useState<Choice>('high');
  const [phase, setPhase] = useState<Phase>('idle');
  const [diceValue, setDiceValue] = useState(6);
  const [displayDice, setDisplayDice] = useState(6);
  const [won, setWon] = useState<boolean | null>(null);
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState<{ value: number; choice: Choice; won: boolean }[]>([]);

  function roll() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < bet) { alert('Insufficient balance!'); return; }
    if (phase === 'rolling') return;

    setPhase('rolling');
    setWon(null);

    const result = Math.floor(Math.random() * 6) + 1;
    let frame = 0;
    const maxFrames = 20;

    const interval = setInterval(() => {
      setDisplayDice(Math.floor(Math.random() * 6) + 1);
      frame++;
      if (frame >= maxFrames) {
        clearInterval(interval);
        setDisplayDice(result);
        setDiceValue(result);

        const isHigh = result >= 4;
        const playerWon = (choice === 'high' && isHigh) || (choice === 'low' && !isHigh);
        const pout = playerWon ? Math.floor(bet * 1.95) : 0;

        setPayout(pout);
        setWon(playerWon);
        setPhase('result');
        setHistory(prev => [{ value: result, choice, won: playerWon }, ...prev].slice(0, 20));

        if (state.user) {
          addHistory({
            id: makeId(), game: 'dice', wager: bet,
            multiplier: playerWon ? 1.95 : 0, payout: pout,
            won: playerWon, timestamp: Date.now(),
          });
        }

        setTimeout(() => setPhase('idle'), 3000);
      }
    }, 80);
  }

  const profit = payout - bet;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <button onClick={() => navigate('fastgames')} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer',
        }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>🎲 Dice Roll</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* Main area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Dice display */}
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)', padding: '60px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '300px', position: 'relative', overflow: 'hidden',
          }}>
            {/* Glow */}
            <div style={{
              position: 'absolute', width: '200px', height: '200px', borderRadius: '50%',
              background: phase === 'result' ? (won ? 'var(--neon-green)' : 'var(--neon-red)') : 'var(--neon-purple)',
              opacity: 0.08, filter: 'blur(60px)', pointerEvents: 'none',
            }} />

            <div style={{
              fontSize: '140px', lineHeight: 1,
              animation: phase === 'rolling' ? 'spin 0.3s linear infinite' : phase === 'result' ? 'scaleIn 0.3s ease' : 'none',
              filter: phase === 'result' ? `drop-shadow(0 0 20px ${won ? 'var(--neon-green)' : 'var(--neon-red)'})` : 'none',
              transition: 'filter 0.3s',
            }}>
              {DICE_FACES[displayDice - 1]}
            </div>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              {phase === 'rolling' && (
                <div style={{ color: 'var(--neon-purple)', fontWeight: 700, fontSize: '20px', animation: 'pulse 0.5s infinite' }}>
                  Rolling...
                </div>
              )}
              {phase === 'result' && (
                <div style={{
                  color: won ? 'var(--neon-green)' : 'var(--neon-red)',
                  fontWeight: 800, fontSize: '28px',
                  animation: 'scaleIn 0.3s ease',
                }}>
                  {won ? `🎉 Won ₹${payout.toLocaleString()}!` : `💥 Lost ₹${bet.toLocaleString()}`}
                </div>
              )}
              {phase === 'idle' && (
                <div style={{ color: 'var(--text2)', fontSize: '16px' }}>
                  Roll to win 1.95x your bet!
                </div>
              )}
            </div>
          </div>

          {/* Prediction targets */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', color: 'var(--text2)' }}>DICE RANGES</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '8px' }}>
              {[1,2,3,4,5,6].map(v => (
                <div key={v} style={{
                  padding: '16px', borderRadius: '12px', textAlign: 'center',
                  background: (diceValue === v && phase === 'result') ? (won ? 'var(--neon-green)20' : 'var(--neon-red)20') : 'var(--bg3)',
                  border: `1px solid ${diceValue === v && phase === 'result' ? (won ? 'var(--neon-green)' : 'var(--neon-red)') : 'var(--border)'}`,
                  transition: 'all 0.3s',
                }}>
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>{DICE_FACES[v-1]}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: v >= 4 ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                    {v >= 4 ? 'HIGH' : 'LOW'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Recent Rolls</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {history.map((h, i) => (
                  <div key={i} style={{
                    background: h.won ? 'var(--neon-green)20' : 'var(--neon-red)20',
                    color: h.won ? 'var(--neon-green)' : 'var(--neon-red)',
                    borderRadius: '8px', padding: '6px 12px', fontSize: '14px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    {DICE_FACES[h.value - 1]} {h.value} ({h.choice})
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
              YOUR PREDICTION
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
              <button onClick={() => setChoice('high')} style={{
                padding: '16px', borderRadius: 'var(--radius)',
                background: choice === 'high' ? 'var(--neon-green)' : 'var(--bg3)',
                color: choice === 'high' ? '#000' : 'var(--text2)',
                border: `1px solid ${choice === 'high' ? 'var(--neon-green)' : 'var(--border)'}`,
                fontWeight: 800, fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
                🔼 HIGH<br />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>(4 - 6)</span>
              </button>
              <button onClick={() => setChoice('low')} style={{
                padding: '16px', borderRadius: 'var(--radius)',
                background: choice === 'low' ? 'var(--neon-red)' : 'var(--bg3)',
                color: choice === 'low' ? '#fff' : 'var(--text2)',
                border: `1px solid ${choice === 'low' ? 'var(--neon-red)' : 'var(--border)'}`,
                fontWeight: 800, fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s',
              }}>
                🔽 LOW<br />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>(1 - 3)</span>
              </button>
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
              BET AMOUNT
            </label>
            <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))}
              disabled={phase === 'rolling'}
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '12px 14px',
                color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px',
              }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '20px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setBet(v)}
                  style={{
                    background: bet === v ? 'var(--neon-purple)20' : 'var(--bg3)',
                    border: `1px solid ${bet === v ? 'var(--neon-purple)' : 'var(--border)'}`,
                    color: bet === v ? 'var(--neon-purple)' : 'var(--text2)',
                    borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  }}>{v}</button>
              ))}
            </div>

            {/* Potential win */}
            <div style={{
              background: 'var(--bg3)', borderRadius: '10px', padding: '14px',
              border: '1px solid var(--border)', marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Multiplier</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-purple)' }}>1.95x</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Potential Win</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-green)' }}>+{Math.floor(bet * 0.95).toLocaleString()}</span>
              </div>
            </div>

            <button onClick={roll} disabled={phase === 'rolling'}
              style={{
                width: '100%', background: phase === 'rolling' ? 'var(--bg3)' : 'var(--neon-purple)',
                color: phase === 'rolling' ? 'var(--text2)' : '#fff',
                border: 'none', borderRadius: 'var(--radius)', padding: '16px',
                fontWeight: 800, fontSize: '16px', cursor: phase === 'rolling' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}>
              {phase === 'rolling' ? '🎲 Rolling...' : '🎲 Roll Dice!'}
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

          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', padding: '20px',
          }}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px', fontSize: '14px' }}>📊 Stats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Win Chance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-green)' }}>50%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>House Edge</span>
                <span style={{ fontWeight: 700, color: 'var(--text2)' }}>2.5%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Max Win</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)' }}>Unlimited</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
