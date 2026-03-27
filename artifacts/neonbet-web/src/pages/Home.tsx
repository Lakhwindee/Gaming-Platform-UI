import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const BANNERS = [
  { title: '500% Welcome Bonus', sub: 'Up to ₹50,000 on first deposit', btn: 'Claim Now', color: 'var(--neon-blue)', bg: 'linear-gradient(135deg, #00d4ff15, #00d4ff05)', icon: '🎁' },
  { title: 'Aviator is LIVE', sub: 'Play the hottest crash game — up to 1000x', btn: 'Play Now', color: 'var(--neon-green)', bg: 'linear-gradient(135deg, #00ff8815, #00ff8805)', icon: '✈️' },
  { title: 'Monthly Jackpot', sub: '₹30,000 prize pool — compete now!', btn: 'Join Tournament', color: 'var(--neon-gold)', bg: 'linear-gradient(135deg, #ffd70015, #ffd70005)', icon: '🏆' },
  { title: 'VIP Cashback', sub: 'Get up to 30% back on losses every week', btn: 'Learn More', color: 'var(--neon-purple)', bg: 'linear-gradient(135deg, #a855f715, #a855f705)', icon: '💎' },
];

const FAST_GAMES = [
  { id: 'crash',    name: 'Crash',     icon: '✈️', color: '#00d4ff', tag: 'HOT', players: 1248 },
  { id: 'mines',    name: 'Mines',     icon: '💣', color: '#ff3b5c', tag: 'NEW', players: 892 },
  { id: 'plinko',   name: 'Plinko',    icon: '🎯', color: '#a855f7', tag: 'HOT', players: 654 },
  { id: 'tower',    name: 'Tower',     icon: '🗼', color: '#ffd700', tag: '',    players: 412 },
  { id: 'hilo',     name: 'Hi-Lo',     icon: '🃏', color: '#00ff88', tag: '',    players: 389 },
  { id: 'slots',    name: 'Slots',     icon: '🎰', color: '#ff2d9b', tag: '',    players: 1842 },
  { id: 'dice',     name: 'Dice',      icon: '🎲', color: '#a855f7', tag: '',    players: 521 },
  { id: 'coinflip', name: 'Coin Flip', icon: '🪙', color: '#ffd700', tag: '',    players: 347 },
];

const RECENT_WINS = [
  { user: 'CryptoKing',  game: 'Crash',     mult: '24.5x', profit: '+₹12,250', time: '2s ago' },
  { user: 'NeonBlade',   game: 'Mines',     mult: '8.1x',  profit: '+₹8,100',  time: '5s ago' },
  { user: 'StarDust',    game: 'Plinko',    mult: '16x',   profit: '+₹8,000',  time: '8s ago' },
  { user: 'ShadowWolf',  game: 'Slots',     mult: '45x',   profit: '+₹22,500', time: '12s ago' },
  { user: 'IronFist',    game: 'Hi-Lo',     mult: '6.2x',  profit: '+₹3,100',  time: '15s ago' },
  { user: 'PixelHunter', game: 'Coin Flip', mult: '1.98x', profit: '+₹990',    time: '18s ago' },
];

export default function Home() {
  const { state, playGame, navigate } = useGame();
  const [bannerIdx, setBannerIdx] = useState(0);
  const [wins, setWins] = useState(RECENT_WINS);

  useEffect(() => {
    const t = setInterval(() => setBannerIdx(i => (i + 1) % BANNERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const names = ['CryptoKing', 'NeonBlade', 'StarDust', 'ShadowWolf', 'IronFist', 'PixelHunter', 'VortexX', 'NightOwl', 'BlazeRun', 'GhostRider'];
    const games = ['Crash', 'Mines', 'Plinko', 'Slots', 'Hi-Lo', 'Dice', 'Coin Flip', 'Tower'];
    const mults = ['2.5x', '5.2x', '12x', '8.1x', '1.95x', '24.5x', '3.2x', '45x', '16x'];
    const t = setInterval(() => {
      const mult = mults[Math.floor(Math.random() * mults.length)];
      const base = Math.floor(Math.random() * 5000) + 500;
      setWins(prev => [
        { user: names[Math.floor(Math.random() * names.length)], game: games[Math.floor(Math.random() * games.length)], mult, profit: `+₹${base.toLocaleString()}`, time: 'just now' },
        ...prev.slice(0, 5),
      ]);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const banner = BANNERS[bannerIdx];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Hero banner */}
      <div style={{
        borderRadius: 'var(--radius-xl)', background: banner.bg, border: `1px solid ${banner.color}30`,
        padding: '36px 40px', marginBottom: '24px', position: 'relative', overflow: 'hidden',
        transition: 'all 0.5s ease', minHeight: '160px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          position: 'absolute', right: '-20px', top: '-20px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: banner.color, opacity: 0.07, filter: 'blur(40px)',
        }} />
        <div>
          <div style={{ fontSize: '64px', marginBottom: '12px' }}>{banner.icon}</div>
          <h1 style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '8px', color: banner.color }}>
            {banner.title}
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '16px', marginBottom: '20px' }}>{banner.sub}</p>
          <button onClick={() => navigate('promotions')} style={{
            background: banner.color, color: '#000', border: 'none',
            borderRadius: 'var(--radius)', padding: '14px 28px',
            fontWeight: 800, fontSize: '16px', cursor: 'pointer',
          }}>{banner.btn}</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
          {BANNERS.map((_, i) => (
            <div key={i} onClick={() => setBannerIdx(i)} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: i === bannerIdx ? banner.color : 'var(--text3)', cursor: 'pointer',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '28px' }}>
        {[
          { label: 'Players Online',  value: '14,832', icon: '🟢', color: 'var(--neon-green)' },
          { label: 'Games Available', value: '8',      icon: '🎮', color: 'var(--neon-blue)' },
          { label: 'Paid Out Today',  value: '₹8.4M',  icon: '💰', color: 'var(--neon-gold)' },
          { label: 'Biggest Win',     value: '856x',   icon: '🏆', color: 'var(--neon-purple)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius)',
            padding: '16px', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ fontSize: '24px' }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '18px', color: s.color }}>{s.value}</div>
              <div style={{ color: 'var(--text3)', fontSize: '12px' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px' }}>
        <div>
          {/* Fast Games */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontWeight: 800, fontSize: '20px' }}>⚡ Fast Games</h2>
            <button onClick={() => navigate('fastgames')} style={{ background: 'none', border: 'none', color: 'var(--neon-blue)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>View All →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
            {FAST_GAMES.map(g => (
              <div key={g.id} onClick={() => playGame(g.id)} style={{
                background: `linear-gradient(135deg, ${g.color}15, var(--bg3))`,
                border: `1px solid ${g.color}25`, borderRadius: 'var(--radius-lg)',
                padding: '20px', cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.2s', position: 'relative',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = g.color; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${g.color}25`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                {g.tag && (
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: g.tag === 'HOT' ? 'var(--neon-red)' : 'var(--neon-green)',
                    color: '#fff', fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '10px',
                  }}>{g.tag}</div>
                )}
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>{g.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{g.name}</div>
                <div style={{ color: g.color, fontSize: '11px', fontWeight: 600 }}>🟢 {g.players.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Wins */}
        <div>
          <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '14px' }}>🔴 Live Wins</h2>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '16px' }}>
            {wins.map((w, i) => (
              <div key={i} style={{
                padding: '12px 16px', borderBottom: i < wins.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                animation: i === 0 ? 'slideIn 0.3s ease' : 'none',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>🎉 {w.user}</div>
                  <div style={{ color: 'var(--text3)', fontSize: '11px' }}>{w.game} · {w.mult}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--neon-green)', fontWeight: 800, fontSize: '14px' }}>{w.profit}</div>
                  <div style={{ color: 'var(--text3)', fontSize: '10px' }}>{w.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Promo teasers */}
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('promotions')}>
            <div style={{
              background: 'linear-gradient(135deg, var(--neon-purple)20, var(--neon-blue)10)',
              border: '1px solid var(--neon-purple)30', borderRadius: 'var(--radius-lg)', padding: '20px',
              marginBottom: '10px',
            }}>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>🎁 500% Welcome Bonus</div>
              <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '12px' }}>Get up to ₹50,000 on your first deposit!</div>
              <button style={{
                background: 'var(--neon-purple)', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '8px 16px', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              }}>Claim Bonus</button>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, var(--neon-gold)15, var(--bg3))',
              border: '1px solid var(--neon-gold)25', borderRadius: 'var(--radius-lg)', padding: '20px',
            }}>
              <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>🏆 Monthly Tournament</div>
              <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '12px' }}>₹30,000 prize pool — compete now!</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['17h', '42m', '08s'].map((v, n) => (
                  <div key={n} style={{
                    flex: 1, background: 'var(--bg3)', borderRadius: '8px', padding: '8px', textAlign: 'center',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ color: 'var(--neon-gold)', fontWeight: 800, fontSize: '15px' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
