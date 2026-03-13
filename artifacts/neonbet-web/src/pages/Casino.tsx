import { useState } from 'react';
import { useGame } from '../context/GameContext';

const PROVIDERS = ['All', 'Pragmatic Play', 'NetEnt', 'Microgaming', 'Evolution', 'Play\'n GO', 'Novomatic', 'BGAMING', 'Spribe'];
const CATEGORIES = ['All', 'Slots', 'Table Games', 'Video Poker', 'Jackpot', 'Megaways', 'Classic', 'New'];

const ALL_GAMES = [
  { name: 'Gates of Olympus', provider: 'Pragmatic Play', cat: 'Megaways', rtp: '96.5%', icon: '⚡', players: 6234, hot: true },
  { name: 'Sweet Bonanza', provider: 'Pragmatic Play', cat: 'Slots', rtp: '96.5%', icon: '🍭', players: 5892, hot: true },
  { name: 'Starburst', provider: 'NetEnt', cat: 'Classic', rtp: '96.1%', icon: '⭐', players: 5123, hot: false },
  { name: 'Book of Ra', provider: 'Novomatic', cat: 'Classic', rtp: '95.1%', icon: '📖', players: 4821, hot: false },
  { name: 'Crazy Time', provider: 'Evolution', cat: 'Table Games', rtp: '96.1%', icon: '🎪', players: 5621, hot: true },
  { name: 'Lightning Roulette', provider: 'Evolution', cat: 'Table Games', rtp: '97.3%', icon: '⚡🎡', players: 4341, hot: true },
  { name: 'Big Bass Bonanza', provider: 'Pragmatic Play', cat: 'Slots', rtp: '96.7%', icon: '🎣', players: 2987, hot: false },
  { name: 'Wolf Gold', provider: 'Pragmatic Play', cat: 'Jackpot', rtp: '96%', icon: '🐺', players: 2341, hot: false },
  { name: 'Gonzo\'s Quest', provider: 'NetEnt', cat: 'Slots', rtp: '96%', icon: '🗿', players: 1876, hot: false },
  { name: 'Fire Joker', provider: 'Play\'n GO', cat: 'Classic', rtp: '96.2%', icon: '🃏', players: 1654, hot: false },
  { name: 'Reactoonz', provider: 'Play\'n GO', cat: 'Slots', rtp: '96.5%', icon: '👾', players: 1523, hot: false },
  { name: 'Book of Dead', provider: 'Play\'n GO', cat: 'Slots', rtp: '96.2%', icon: '💀', players: 3421, hot: false },
  { name: 'Mega Moolah', provider: 'Microgaming', cat: 'Jackpot', rtp: '88.1%', icon: '🦁', players: 2123, hot: true },
  { name: 'Immortal Romance', provider: 'Microgaming', cat: 'Slots', rtp: '96.9%', icon: '🧛', players: 1234, hot: false },
  { name: 'Thunderstruck II', provider: 'Microgaming', cat: 'Slots', rtp: '96.7%', icon: '⚡⚡', players: 987, hot: false },
  { name: 'Aviator', provider: 'Spribe', cat: 'New', rtp: '97%', icon: '✈️', players: 8234, hot: true },
  { name: 'Mines', provider: 'BGAMING', cat: 'New', rtp: '99%', icon: '💣', players: 3892, hot: true },
  { name: 'Plinko', provider: 'BGAMING', cat: 'New', rtp: '99%', icon: '🎯', players: 2654, hot: false },
  { name: 'Dice', provider: 'BGAMING', cat: 'New', rtp: '99%', icon: '🎲', players: 1521, hot: false },
  { name: 'European Roulette', provider: 'NetEnt', cat: 'Table Games', rtp: '97.3%', icon: '🎡', players: 2341, hot: false },
  { name: 'Blackjack Pro', provider: 'NetEnt', cat: 'Table Games', rtp: '99.5%', icon: '🃏', players: 1892, hot: false },
  { name: 'Baccarat', provider: 'Microgaming', cat: 'Table Games', rtp: '98.9%', icon: '🎴', players: 987, hot: false },
  { name: 'Deuces Wild', provider: 'NetEnt', cat: 'Video Poker', rtp: '100.7%', icon: '🃏♠', players: 654, hot: false },
  { name: 'Joker Poker', provider: 'Microgaming', cat: 'Video Poker', rtp: '98.6%', icon: '🃏🃏', players: 432, hot: false },
];

export default function Casino() {
  const { navigate } = useGame();
  const [provider, setProvider] = useState('All');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');

  const filtered = ALL_GAMES.filter(g => {
    const matchP = provider === 'All' || g.provider === provider;
    const matchC = category === 'All' || g.cat === category;
    const matchS = g.name.toLowerCase().includes(search.toLowerCase());
    return matchP && matchC && matchS;
  }).sort((a, b) => {
    if (sort === 'popular') return b.players - a.players;
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'rtp') return parseFloat(b.rtp) - parseFloat(a.rtp);
    return 0;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <h1 style={{ fontWeight: 900, fontSize: '28px', letterSpacing: '-0.5px' }}>🎰 Casino</h1>
        <span style={{ color: 'var(--text3)', fontSize: '14px' }}>{filtered.length} games</span>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search games..."
              style={{
                width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '10px 12px 10px 36px', color: 'var(--text)', fontSize: '14px',
              }} />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '14px', cursor: 'pointer',
          }}>
            <option value="popular">Most Popular</option>
            <option value="rtp">Highest RTP</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              padding: '7px 16px', borderRadius: '20px', border: '1px solid',
              borderColor: category === c ? 'var(--neon-blue)' : 'var(--border)',
              background: category === c ? 'var(--neon-blue)20' : 'var(--bg3)',
              color: category === c ? 'var(--neon-blue)' : 'var(--text2)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}>{c}</button>
          ))}
        </div>

        {/* Providers */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {PROVIDERS.map(p => (
            <button key={p} onClick={() => setProvider(p)} style={{
              padding: '6px 14px', borderRadius: '20px', border: '1px solid',
              borderColor: provider === p ? 'var(--neon-purple)' : 'var(--border)',
              background: provider === p ? 'var(--neon-purple)20' : 'var(--bg3)',
              color: provider === p ? 'var(--neon-purple)' : 'var(--text3)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Games grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {filtered.map((g, i) => (
          <div key={i} onClick={() => navigate('casino')} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '20px', cursor: 'pointer',
            textAlign: 'center', transition: 'all 0.2s', position: 'relative',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--neon-blue)50'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
          >
            {g.hot && (
              <div style={{
                position: 'absolute', top: '8px', left: '8px',
                background: 'var(--neon-red)', color: '#fff',
                fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '10px',
              }}>🔥 HOT</div>
            )}
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>{g.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px', lineHeight: 1.3 }}>{g.name}</div>
            <div style={{ color: 'var(--text3)', fontSize: '11px', marginBottom: '6px' }}>{g.provider}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'var(--bg3)', borderRadius: '6px', padding: '2px 8px',
                fontSize: '10px', fontWeight: 600, color: 'var(--neon-blue)',
              }}>{g.rtp}</span>
            </div>
            <div style={{ color: 'var(--text3)', fontSize: '10px', marginTop: '6px' }}>🟢 {g.players.toLocaleString()}</div>

            {/* Play overlay on hover */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)',
              background: 'rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '0'}
            >
              <button style={{
                background: 'var(--neon-blue)', color: '#000', border: 'none',
                borderRadius: '8px', padding: '8px 16px', fontWeight: 800, fontSize: '13px',
              }}>Play</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
