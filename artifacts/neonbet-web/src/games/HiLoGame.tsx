import { useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function randCard() {
  return { value: VALUES[Math.floor(Math.random() * 13)], suit: SUITS[Math.floor(Math.random() * 4)] };
}

function cardNum(v: string) {
  const i = VALUES.indexOf(v);
  return i === 0 ? 14 : i + 2;
}

function calcMult(streak: number): number {
  return +(Math.pow(1.8, streak) * 0.97).toFixed(2);
}

type Card = { value: string; suit: string };

export default function HiLoGame() {
  const { state, navigate, addHistory, addNotification } = useGame();
  const [bet, setBet] = useState(100);
  const [currentCard, setCurrentCard] = useState<Card>(randCard());
  const [history, setHistory] = useState<Card[]>([]);
  const [streak, setStreak] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [lastPick, setLastPick] = useState<'higher' | 'lower' | null>(null);
  const [revealCard, setRevealCard] = useState<Card | null>(null);

  const currentMult = calcMult(streak);
  const isRed = currentCard.suit === '♥' || currentCard.suit === '♦';

  function startGame() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < bet) { alert('Insufficient balance!'); return; }
    const card = randCard();
    setCurrentCard(card);
    setHistory([]);
    setStreak(0);
    setPlaying(true);
    setGameOver(false);
    setWon(false);
    setLastPick(null);
    setRevealCard(null);
  }

  function pick(direction: 'higher' | 'lower') {
    if (!playing || gameOver) return;
    setLastPick(direction);
    const nextCard = randCard();
    setRevealCard(nextCard);

    const currentNum = cardNum(currentCard.value);
    const nextNum = cardNum(nextCard.value);

    let correct = false;
    if (direction === 'higher') correct = nextNum > currentNum;
    else correct = nextNum < currentNum;

    // Equal is a push (neutral)
    if (nextNum === currentNum) {
      setTimeout(() => {
        setCurrentCard(nextCard);
        setHistory(prev => [nextCard, ...prev]);
        setRevealCard(null);
        setLastPick(null);
      }, 800);
      return;
    }

    if (correct) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setTimeout(() => {
        setHistory(prev => [nextCard, ...prev]);
        setCurrentCard(nextCard);
        setRevealCard(null);
        setLastPick(null);
      }, 800);
    } else {
      setGameOver(true);
      setPlaying(false);
      addHistory({ id: makeId(), game: 'hilo', wager: bet, multiplier: 0, payout: 0, won: false, timestamp: Date.now() });
      addNotification(`💔 Wrong! Lost ${bet.toLocaleString()} pts`, 'info');
    }
  }

  function cashOut() {
    if (!playing || streak === 0) return;
    const payout = Math.floor(bet * currentMult);
    setGameOver(true);
    setPlaying(false);
    setWon(true);
    addHistory({ id: makeId(), game: 'hilo', wager: bet, multiplier: currentMult, payout, won: true, timestamp: Date.now() });
    addNotification(`🃏 Cashed out at ${currentMult}x! +${(payout - bet).toLocaleString()} pts`, 'win');
  }

  function renderCard(card: Card | null, big = false) {
    if (!card) return <div style={{ width: big ? '120px' : '70px', height: big ? '160px' : '90px', borderRadius: '12px', background: 'var(--bg4)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '24px' }}>?</div>;
    const red = card.suit === '♥' || card.suit === '♦';
    return (
      <div style={{
        width: big ? '120px' : '70px', height: big ? '160px' : '90px',
        borderRadius: '12px', background: '#fff', border: '2px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: red ? '#e74c3c' : '#1a1a2e', position: 'relative', padding: '8px',
        boxShadow: big ? `0 0 30px ${red ? '#e74c3c40' : '#00d4ff40'}` : 'none',
        animation: revealCard && revealCard === card ? 'scaleIn 0.3s ease' : 'none',
      }}>
        <div style={{ position: 'absolute', top: '6px', left: '8px', fontSize: big ? '16px' : '12px', fontWeight: 800 }}>{card.value}</div>
        <div style={{ fontSize: big ? '40px' : '24px' }}>{card.suit}</div>
        <div style={{ position: 'absolute', bottom: '6px', right: '8px', fontSize: big ? '16px' : '12px', fontWeight: 800, transform: 'rotate(180deg)' }}>{card.value}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('fastgames')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>🃏 Hi-Lo</h1>
        {playing && streak > 0 && <span style={{ color: 'var(--neon-green)', fontWeight: 700 }}>Streak: {streak} · {currentMult}x</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Game area */}
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
            padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '340px',
            justifyContent: 'center', gap: '24px',
          }}>
            {!playing && !gameOver && (
              <div style={{ textAlign: 'center', color: 'var(--text2)' }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🃏</div>
                <div>Set your bet and start playing!</div>
              </div>
            )}

            {(playing || gameOver) && (
              <>
                {/* Streak display */}
                {streak > 0 && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {Array.from({ length: Math.min(streak, 8) }).map((_, i) => (
                      <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--neon-green)' }} />
                    ))}
                    {streak > 8 && <span style={{ color: 'var(--neon-green)', fontSize: '14px', fontWeight: 700 }}>+{streak - 8}</span>}
                  </div>
                )}

                {/* Cards row */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  {history.slice(0, 3).reverse().map((c, i) => (
                    <div key={i} style={{ opacity: 0.4 - i * 0.1, transform: `scale(${0.8 - i * 0.1})` }}>
                      {renderCard(c)}
                    </div>
                  ))}
                  <div style={{ animation: 'scaleIn 0.2s ease' }}>{renderCard(currentCard, true)}</div>
                  {revealCard && (
                    <div style={{ animation: 'scaleIn 0.3s ease' }}>{renderCard(revealCard, true)}</div>
                  )}
                </div>

                {/* Result */}
                {gameOver && (
                  <div style={{
                    padding: '16px 32px', borderRadius: 'var(--radius-lg)',
                    background: won ? 'var(--neon-green)20' : 'var(--neon-red)20',
                    color: won ? 'var(--neon-green)' : 'var(--neon-red)',
                    fontWeight: 800, fontSize: '20px', animation: 'scaleIn 0.3s ease',
                  }}>
                    {won ? `🎉 Won ${Math.floor(bet * currentMult).toLocaleString()} pts!` : '💔 Wrong guess!'}
                  </div>
                )}

                {/* Pick buttons */}
                {playing && !gameOver && !revealCard && (
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button onClick={() => pick('lower')} style={{
                      background: 'var(--neon-red)20', border: '2px solid var(--neon-red)',
                      borderRadius: 'var(--radius-lg)', padding: '20px 32px',
                      color: 'var(--neon-red)', fontWeight: 800, fontSize: '20px', cursor: 'pointer',
                    }}>🔽 Lower</button>
                    <button onClick={() => pick('higher')} style={{
                      background: 'var(--neon-green)20', border: '2px solid var(--neon-green)',
                      borderRadius: 'var(--radius-lg)', padding: '20px 32px',
                      color: 'var(--neon-green)', fontWeight: 800, fontSize: '20px', cursor: 'pointer',
                    }}>🔼 Higher</button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Card history */}
          {history.length > 0 && (
            <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>Card History</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {history.slice(0, 10).map((c, i) => {
                  const red = c.suit === '♥' || c.suit === '♦';
                  return (
                    <div key={i} style={{
                      background: '#fff', borderRadius: '6px', padding: '6px 10px',
                      color: red ? '#e74c3c' : '#1a1a2e', fontWeight: 800, fontSize: '14px',
                    }}>
                      {c.value}{c.suit}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>BET AMOUNT</label>
            <input type="number" value={bet} onChange={e => setBet(Number(e.target.value))} disabled={playing && !gameOver}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px', marginBottom: '16px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setBet(v)} disabled={playing && !gameOver} style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)',
                  borderRadius: '8px', padding: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>

            {/* Streak multiplier preview */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>MULTIPLIERS</div>
              {[1, 2, 3, 4, 5].map(s => (
                <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', opacity: s === streak ? 1 : 0.6 }}>
                  <span style={{ color: 'var(--text3)', fontSize: '12px' }}>Streak {s}</span>
                  <span style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '13px' }}>{calcMult(s).toFixed(2)}x</span>
                </div>
              ))}
            </div>

            {(!playing || gameOver) ? (
              <button onClick={startGame} style={{
                width: '100%', background: 'var(--neon-green)', color: '#000', border: 'none',
                borderRadius: 'var(--radius)', padding: '14px', fontWeight: 800, fontSize: '15px', cursor: 'pointer',
              }}>
                {gameOver ? '🔄 Play Again' : '🃏 Start Game'}
              </button>
            ) : (
              <button onClick={cashOut} disabled={streak === 0} style={{
                width: '100%', background: streak > 0 ? 'var(--neon-gold)' : 'var(--bg3)',
                color: streak > 0 ? '#000' : 'var(--text2)',
                border: 'none', borderRadius: 'var(--radius)', padding: '14px', fontWeight: 800, fontSize: '15px', cursor: streak > 0 ? 'pointer' : 'not-allowed',
              }}>
                {streak > 0 ? `💰 Cash Out ${Math.floor(bet * currentMult).toLocaleString()}` : 'Guess to continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
