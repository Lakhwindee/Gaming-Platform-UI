import { useGame } from '../context/GameContext';

const TOP_PLAYERS = [
  { rank: 1, username: 'CryptoKing', level: 42, wins: 482, totalWagered: 4850000, profit: 485200, badge: '🥇', color: '#ffd700' },
  { rank: 2, username: 'NeonBlade', level: 38, wins: 341, totalWagered: 3420000, profit: 342100, badge: '🥈', color: '#C0C0C0' },
  { rank: 3, username: 'ShadowWolf', level: 35, wins: 298, totalWagered: 2987000, profit: 298700, badge: '🥉', color: '#CD7F32' },
  { rank: 4, username: 'StarDust', level: 29, wins: 187, totalWagered: 1875000, profit: 187500, badge: '4', color: '#a855f7' },
  { rank: 5, username: 'IronFist', level: 26, wins: 156, totalWagered: 1563000, profit: 156300, badge: '5', color: '#00d4ff' },
  { rank: 6, username: 'PixelHunter', level: 23, wins: 134, totalWagered: 1348000, profit: 134800, badge: '6', color: '#00ff88' },
  { rank: 7, username: 'VortexX', level: 21, wins: 112, totalWagered: 1120000, profit: 112000, badge: '7', color: '#00ff88' },
  { rank: 8, username: 'NightOwl', level: 19, wins: 98, totalWagered: 985000, profit: 98500, badge: '8', color: '#00ff88' },
  { rank: 9, username: 'BlazeRun', level: 17, wins: 87, totalWagered: 872000, profit: 87200, badge: '9', color: '#00ff88' },
  { rank: 10, username: 'GhostRider', level: 15, wins: 76, totalWagered: 761000, profit: 76100, badge: '10', color: '#00ff88' },
];

export default function Leaderboard() {
  const { state } = useGame();

  const allPlayers = [...TOP_PLAYERS];
  if (state.user && state.user.totalWins > 0) {
    allPlayers.push({
      rank: allPlayers.length + 1,
      username: state.user.username + ' (You)',
      level: state.user.level,
      wins: state.user.totalWins,
      totalWagered: state.user.totalWagered,
      profit: state.user.balance - 10000,
      badge: `${allPlayers.length + 1}`,
      color: '#00d4ff',
    });
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '8px' }}>🏆 Leaderboard</h1>
        <p style={{ color: 'var(--text2)', fontSize: '15px' }}>Top players ranked by total winnings</p>
      </div>

      {/* Top 3 podium */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        {/* 2nd place */}
        <div style={{
          background: 'linear-gradient(135deg, #C0C0C015, var(--bg3))',
          borderRadius: 'var(--radius-xl)', padding: '28px', textAlign: 'center',
          border: '1px solid #C0C0C030', alignSelf: 'end',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🥈</div>
          <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '4px' }}>{TOP_PLAYERS[1].username}</div>
          <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '12px' }}>Level {TOP_PLAYERS[1].level}</div>
          <div style={{ color: '#C0C0C0', fontWeight: 800, fontSize: '20px' }}>
            +{TOP_PLAYERS[1].profit.toLocaleString()}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '12px' }}>pts won</div>
        </div>

        {/* 1st place */}
        <div style={{
          background: 'linear-gradient(135deg, #ffd70015, var(--bg3))',
          borderRadius: 'var(--radius-xl)', padding: '36px 28px', textAlign: 'center',
          border: '1px solid #ffd70040',
          boxShadow: '0 0 40px #ffd70015',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '12px' }}>🥇</div>
          <div style={{ fontWeight: 900, fontSize: '22px', marginBottom: '4px', color: '#ffd700' }}>{TOP_PLAYERS[0].username}</div>
          <div style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '12px' }}>Level {TOP_PLAYERS[0].level}</div>
          <div style={{ color: 'var(--neon-gold)', fontWeight: 900, fontSize: '28px' }}>
            +{TOP_PLAYERS[0].profit.toLocaleString()}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '13px' }}>pts won</div>
        </div>

        {/* 3rd place */}
        <div style={{
          background: 'linear-gradient(135deg, #CD7F3215, var(--bg3))',
          borderRadius: 'var(--radius-xl)', padding: '24px', textAlign: 'center',
          border: '1px solid #CD7F3230', alignSelf: 'end',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🥉</div>
          <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '4px' }}>{TOP_PLAYERS[2].username}</div>
          <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '12px' }}>Level {TOP_PLAYERS[2].level}</div>
          <div style={{ color: '#CD7F32', fontWeight: 800, fontSize: '20px' }}>
            +{TOP_PLAYERS[2].profit.toLocaleString()}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '12px' }}>pts won</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '60px 1fr 100px 120px 140px 120px',
          padding: '14px 24px', borderBottom: '1px solid var(--border)',
          color: 'var(--text3)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px',
        }}>
          <span>RANK</span>
          <span>PLAYER</span>
          <span style={{ textAlign: 'center' }}>LEVEL</span>
          <span style={{ textAlign: 'right' }}>WINS</span>
          <span style={{ textAlign: 'right' }}>WAGERED</span>
          <span style={{ textAlign: 'right' }}>PROFIT</span>
        </div>

        {allPlayers.map((p, i) => {
          const isUser = p.username.includes('(You)');
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 100px 120px 140px 120px',
              padding: '16px 24px',
              borderBottom: i < allPlayers.length - 1 ? '1px solid var(--border)' : 'none',
              background: isUser ? 'var(--neon-blue)08' : 'transparent',
              transition: 'background 0.2s',
              alignItems: 'center',
            }}
              onMouseEnter={e => { if (!isUser) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'; }}
              onMouseLeave={e => { if (!isUser) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <div>
                {i < 3
                  ? <span style={{ fontSize: '24px' }}>{p.badge}</span>
                  : <span style={{ fontWeight: 700, color: 'var(--text3)', fontSize: '15px' }}>#{p.rank}</span>
                }
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${p.color}40, ${p.color}20)`,
                  border: `2px solid ${p.color}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '16px', color: p.color,
                  flexShrink: 0,
                }}>
                  {p.username[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: isUser ? 'var(--neon-blue)' : 'var(--text)' }}>
                    {p.username}
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: '12px' }}>{p.wins} wins</div>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  background: `${p.color}20`, color: p.color,
                  padding: '4px 10px', borderRadius: '20px',
                  fontWeight: 700, fontSize: '13px',
                }}>Lv.{p.level}</span>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text)', fontSize: '14px' }}>{p.wins}</div>
              <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text2)', fontSize: '14px' }}>
                {(p.totalWagered / 1000).toFixed(0)}K
              </div>
              <div style={{ textAlign: 'right', fontWeight: 800, color: 'var(--neon-green)', fontSize: '15px' }}>
                +{(p.profit / 1000).toFixed(0)}K
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
