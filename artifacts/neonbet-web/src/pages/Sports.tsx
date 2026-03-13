import { useState } from 'react';
import { useGame } from '../context/GameContext';

const SPORTS = [
  { icon: '⚽', name: 'Football', count: 124, live: 12 },
  { icon: '🏀', name: 'Basketball', count: 48, live: 6 },
  { icon: '🎾', name: 'Tennis', count: 86, live: 18 },
  { icon: '🏏', name: 'Cricket', count: 32, live: 4 },
  { icon: '🏐', name: 'Volleyball', count: 24, live: 3 },
  { icon: '🥊', name: 'MMA/Boxing', count: 16, live: 2 },
  { icon: '🏈', name: 'American Football', count: 28, live: 0 },
  { icon: '🏒', name: 'Hockey', count: 22, live: 5 },
  { icon: '🎮', name: 'Esports', count: 64, live: 9 },
  { icon: '🏊', name: 'Swimming', count: 12, live: 0 },
  { icon: '🚴', name: 'Cycling', count: 8, live: 0 },
  { icon: '🏇', name: 'Horse Racing', count: 42, live: 8 },
];

const LIVE_MATCHES = [
  {
    sport: '⚽ Football', league: 'Premier League',
    t1: 'Manchester City', t2: 'Arsenal', score: '2 - 1',
    time: "72'", odds: { t1: 1.45, draw: 4.20, t2: 6.50 },
  },
  {
    sport: '🏀 Basketball', league: 'NBA',
    t1: 'Lakers', t2: 'Celtics', score: '94 - 87',
    time: 'Q3 8:24', odds: { t1: 1.65, draw: null, t2: 2.25 },
  },
  {
    sport: '🎾 Tennis', league: 'Wimbledon',
    t1: 'Alcaraz', t2: 'Djokovic', score: '6-4, 3-5',
    time: 'Set 2', odds: { t1: 2.10, draw: null, t2: 1.75 },
  },
  {
    sport: '🏏 Cricket', league: 'IPL',
    t1: 'Mumbai Indians', t2: 'CSK', score: '142/6',
    time: 'Ov 18.2', odds: { t1: 2.40, draw: null, t2: 1.60 },
  },
  {
    sport: '🎮 Esports', league: 'CS2 Major',
    t1: 'NaVi', t2: 'Astralis', score: '11 - 8',
    time: 'Map 2', odds: { t1: 1.55, draw: null, t2: 2.55 },
  },
];

const UPCOMING = [
  { sport: '⚽', t1: 'Liverpool', t2: 'Chelsea', time: 'Today 20:45', odds: { t1: 2.10, draw: 3.20, t2: 3.80 } },
  { sport: '🏀', t1: 'Warriors', t2: 'Heat', time: 'Today 23:00', odds: { t1: 1.85, draw: null, t2: 2.05 } },
  { sport: '🎾', t1: 'Medvedev', t2: 'Zverev', time: 'Tomorrow 14:00', odds: { t1: 1.90, draw: null, t2: 1.95 } },
  { sport: '⚽', t1: 'Barcelona', t2: 'Real Madrid', time: 'Tomorrow 21:00', odds: { t1: 2.20, draw: 3.10, t2: 3.50 } },
  { sport: '🎮', t1: 'Team Liquid', t2: 'FaZe', time: 'Tomorrow 15:00', odds: { t1: 1.70, draw: null, t2: 2.20 } },
];

export default function Sports() {
  const { state, addHistory, addNotification, toggleWallet } = useGame();
  const [selectedSport, setSelectedSport] = useState('All');
  const [betSlip, setBetSlip] = useState<{ match: string; pick: string; odds: number; amount: number }[]>([]);
  const [betAmount, setBetAmount] = useState(100);

  function addToBetSlip(match: string, pick: string, odds: number) {
    if (!state.user) { alert('Please sign in to bet!'); return; }
    setBetSlip(prev => {
      const exists = prev.find(b => b.match === match);
      if (exists) return prev.map(b => b.match === match ? { ...b, pick, odds } : b);
      return [...prev, { match, pick, odds, amount: betAmount }];
    });
  }

  function placeBets() {
    if (!state.user) return;
    if (state.user.balance < betSlip.reduce((a, b) => a + b.amount, 0)) {
      toggleWallet(); return;
    }
    betSlip.forEach(b => {
      const won = Math.random() > 0.5;
      addHistory({
        id: Date.now().toString(), game: 'sports',
        wager: b.amount, multiplier: won ? b.odds : 0,
        payout: won ? Math.floor(b.amount * b.odds) : 0,
        won, timestamp: Date.now(),
      });
      if (won) addNotification(`🎉 Sports bet won! +${Math.floor(b.amount * b.odds).toLocaleString()} pts`, 'win');
    });
    setBetSlip([]);
  }

  const totalOdds = betSlip.reduce((a, b) => a * b.odds, 1);
  const totalPayout = Math.floor(betAmount * totalOdds);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <h1 style={{ fontWeight: 900, fontSize: '28px', letterSpacing: '-0.5px' }}>⚽ Sports Betting</h1>
        <div style={{
          background: 'var(--neon-red)20', color: 'var(--neon-red)',
          border: '1px solid var(--neon-red)40', borderRadius: '20px',
          padding: '4px 12px', fontSize: '12px', fontWeight: 800,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--neon-red)', animation: 'pulse 1s infinite' }} />
          38 LIVE
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 280px', gap: '20px' }}>
        {/* Sport selection */}
        <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', height: 'fit-content' }}>
          {SPORTS.map(s => (
            <button key={s.name} onClick={() => setSelectedSport(s.name)} style={{
              width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--border)',
              background: selectedSport === s.name ? 'var(--neon-blue)15' : 'transparent',
              color: selectedSport === s.name ? 'var(--neon-blue)' : 'var(--text2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            }}>
              <span>{s.icon} {s.name}</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {s.live > 0 && <span style={{
                  background: 'var(--neon-red)20', color: 'var(--neon-red)',
                  fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: '8px',
                }}>{s.live}</span>}
                <span style={{ color: 'var(--text3)', fontSize: '12px' }}>{s.count}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Matches */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Live */}
          <div>
            <h2 style={{ fontWeight: 800, fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-red)', animation: 'pulse 1s infinite' }} />
              Live Matches
            </h2>
            {LIVE_MATCHES.map((m, i) => (
              <div key={i} style={{
                background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                padding: '18px', marginBottom: '10px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ color: 'var(--text3)', fontSize: '12px', fontWeight: 700 }}>{m.sport} · {m.league}</div>
                  <div style={{
                    color: 'var(--neon-red)', fontSize: '12px', fontWeight: 700,
                    background: 'var(--neon-red)15', padding: '2px 8px', borderRadius: '8px',
                  }}>🔴 {m.time}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px' }}>{m.t1}</span>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 900, fontSize: '22px', color: 'var(--neon-gold)' }}>{m.score}</div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '16px' }}>{m.t2}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: m.odds.draw ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: m.t1, value: m.odds.t1, pick: 'home' },
                    ...(m.odds.draw ? [{ label: 'Draw', value: m.odds.draw, pick: 'draw' }] : []),
                    { label: m.t2, value: m.odds.t2, pick: 'away' },
                  ].map(o => o.value && (
                    <button key={o.pick} onClick={() => addToBetSlip(`${m.t1} vs ${m.t2}`, `${o.label} (${o.value})`, o.value)} style={{
                      padding: '10px', borderRadius: '10px', border: '1px solid var(--border)',
                      background: betSlip.find(b => b.match === `${m.t1} vs ${m.t2}` && b.pick === `${o.label} (${o.value})`) ? 'var(--neon-blue)30' : 'var(--bg3)',
                      color: 'var(--text)', cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px' }}>{o.label}</div>
                      <div style={{ fontWeight: 800, color: 'var(--neon-blue)', fontSize: '16px' }}>{o.value}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming */}
          <div>
            <h2 style={{ fontWeight: 800, fontSize: '16px', marginBottom: '12px' }}>📅 Upcoming</h2>
            {UPCOMING.map((m, i) => (
              <div key={i} style={{
                background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                padding: '16px', marginBottom: '10px',
                display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '20px' }}>{m.sport}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{m.t1} vs {m.t2}</div>
                  <div style={{ color: 'var(--text3)', fontSize: '12px' }}>{m.time}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { label: '1', value: m.odds.t1, pick: 'home' },
                    ...(m.odds.draw ? [{ label: 'X', value: m.odds.draw, pick: 'draw' }] : []),
                    { label: '2', value: m.odds.t2, pick: 'away' },
                  ].map(o => o.value && (
                    <button key={o.pick} onClick={() => addToBetSlip(`${m.t1} vs ${m.t2}`, `${o.label} (${o.value})`, o.value)} style={{
                      padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)',
                      background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer',
                      minWidth: '60px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{o.label}</div>
                      <div style={{ fontWeight: 800, color: 'var(--neon-blue)', fontSize: '15px' }}>{o.value}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bet Slip */}
        <div>
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
            overflow: 'hidden', position: 'sticky', top: '80px',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 800, fontSize: '16px' }}>🎫 Bet Slip</h3>
              {betSlip.length > 0 && (
                <button onClick={() => setBetSlip([])} style={{ background: 'none', border: 'none', color: 'var(--neon-red)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Clear All</button>
              )}
            </div>

            {betSlip.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎫</div>
                <div style={{ fontSize: '14px' }}>Click odds to add bets to your slip</div>
              </div>
            ) : (
              <div>
                {betSlip.map((b, i) => (
                  <div key={i} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{b.match}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text2)', fontSize: '12px' }}>{b.pick}</span>
                      <span style={{ color: 'var(--neon-blue)', fontWeight: 800, fontSize: '16px' }}>{b.odds}</span>
                    </div>
                  </div>
                ))}

                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                  <label style={{ display: 'block', color: 'var(--text3)', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>BET AMOUNT</label>
                  <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))} style={{
                    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '15px', fontWeight: 700,
                  }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginTop: '8px' }}>
                    {[50, 100, 250, 500].map(v => (
                      <button key={v} onClick={() => setBetAmount(v)} style={{
                        background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px',
                        padding: '6px', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      }}>{v}</button>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Total Odds</span>
                    <span style={{ fontWeight: 800, color: 'var(--neon-blue)', fontSize: '16px' }}>{totalOdds.toFixed(2)}x</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Potential Win</span>
                    <span style={{ fontWeight: 800, color: 'var(--neon-green)', fontSize: '16px' }}>{totalPayout.toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ padding: '16px 18px' }}>
                  <button onClick={placeBets} style={{
                    width: '100%', background: 'var(--neon-green)', color: '#000', border: 'none',
                    borderRadius: 'var(--radius)', padding: '14px', fontWeight: 800, fontSize: '15px', cursor: 'pointer',
                  }}>Place Bet ({betSlip.length} selections)</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
