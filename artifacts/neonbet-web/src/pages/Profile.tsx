import { useGame } from '../context/GameContext';

const LEVEL_NAMES = ['Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Elite', 'Legend', 'Master', 'GOAT'];

export default function Profile({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { state, logout, navigate, playGame } = useGame();

  if (!state.user) {
    return (
      <div style={{ maxWidth: '500px', margin: '80px auto', textAlign: 'center', padding: '24px', animation: 'slideIn 0.3s ease' }}>
        <div style={{
          background: 'var(--bg2)', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)', padding: '60px 40px',
        }}>
          <div style={{ fontSize: '72px', marginBottom: '20px' }}>👤</div>
          <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '12px', color: 'var(--primary)' }}>Join BLAZE</h2>
          <p style={{ color: 'var(--text2)', fontSize: '16px', marginBottom: '32px', lineHeight: 1.6 }}>
            Sign up to track your winnings, climb the leaderboard, and save your progress.
          </p>
          <button onClick={onAuthOpen} style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius)', padding: '16px 40px',
            fontWeight: 800, fontSize: '18px', cursor: 'pointer', width: '100%',
            marginBottom: '12px',
          }}>
            Sign In / Register
          </button>
          <p style={{ color: 'var(--text3)', fontSize: '13px' }}>Free to play · ₹10,000 starter balance</p>
        </div>
      </div>
    );
  }

  const { user } = state;
  const levelName = LEVEL_NAMES[Math.min(user.level - 1, LEVEL_NAMES.length - 1)];
  const xpForNext = 500;
  const xpProgress = (user.xp % xpForNext) / xpForNext * 100;
  const winRate = user.totalWins + user.totalLosses > 0 ? Math.round(user.totalWins / (user.totalWins + user.totalLosses) * 100) : 0;
  const totalGames = user.totalWins + user.totalLosses;
  const profit = user.balance - 10000;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-1px' }}>👤 My Profile</h1>
        <button onClick={logout} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '10px 20px',
          color: 'var(--text2)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
        }}>Sign Out</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px' }}>
        {/* Profile card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border)', padding: '32px', textAlign: 'center',
          }}>
            <div style={{
              width: '90px', height: '90px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--neon-blue)40, var(--neon-purple)40)',
              border: '3px solid var(--neon-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '40px', margin: '0 auto 16px',
              boxShadow: '0 0 30px var(--neon-blue)40',
            }}>
              {user.username[0].toUpperCase()}
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '22px', marginBottom: '4px' }}>{user.username}</h2>
            <div style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '16px' }}>{user.email}</div>

            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'var(--neon-purple)20', border: '1px solid var(--neon-purple)40',
              borderRadius: '20px', padding: '6px 16px', marginBottom: '20px',
            }}>
              <span style={{ color: 'var(--neon-purple)', fontWeight: 700, fontSize: '14px' }}>Level {user.level} · {levelName}</span>
            </div>

            {/* XP bar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text3)', fontSize: '12px' }}>XP Progress</span>
                <span style={{ color: 'var(--text2)', fontSize: '12px' }}>{user.xp % xpForNext} / {xpForNext}</span>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '4px',
                  background: 'linear-gradient(90deg, var(--neon-purple), var(--neon-blue))',
                  width: `${xpProgress}%`, transition: 'width 0.5s ease',
                }} />
              </div>
            </div>

            {/* Balance */}
            <div style={{
              background: 'var(--bg3)', borderRadius: 'var(--radius)',
              padding: '16px', border: '1px solid var(--neon-gold)30',
            }}>
              <div style={{ color: 'var(--text3)', fontSize: '12px', fontWeight: 600, letterSpacing: '1px', marginBottom: '6px' }}>BALANCE</div>
              <div style={{ color: 'var(--neon-gold)', fontWeight: 900, fontSize: '32px', letterSpacing: '-1px' }}>
                {user.balance.toLocaleString()}
              </div>
              <div style={{ color: 'var(--text3)', fontSize: '13px' }}></div>
            </div>
          </div>

          {/* Actions */}
          <div style={{
            background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', padding: '20px',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <h3 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>Quick Play</h3>
            {[
              { id: 'crash', label: '📈 Play Crash', color: 'var(--neon-blue)' },
            ].map(g => (
              <button key={g.id} onClick={() => playGame(g.id)} style={{
                background: 'var(--bg3)', border: `1px solid ${g.color}30`,
                borderRadius: '10px', padding: '12px 16px',
                color: g.color, fontWeight: 700, fontSize: '15px', cursor: 'pointer',
                textAlign: 'left', transition: 'all 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = g.color}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = `${g.color}30`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Total Games', value: totalGames.toString(), icon: '🎮', color: 'var(--text)' },
              { label: 'Games Won', value: user.totalWins.toString(), icon: '🏆', color: 'var(--neon-green)' },
              { label: 'Win Rate', value: `${winRate}%`, icon: '📊', color: 'var(--neon-blue)' },
              { label: 'Total Wagered', value: `${(user.totalWagered / 1000).toFixed(1)}K`, icon: '💰', color: 'var(--neon-gold)' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--bg2)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)', padding: '24px',
              }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{s.icon}</div>
                <div style={{ fontWeight: 900, fontSize: '28px', color: s.color, letterSpacing: '-1px', marginBottom: '4px' }}>{s.value}</div>
                <div style={{ color: 'var(--text3)', fontSize: '13px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Profit */}
          <div style={{
            background: profit >= 0 ? 'var(--neon-green)08' : 'var(--neon-red)08',
            borderRadius: 'var(--radius-lg)', border: `1px solid ${profit >= 0 ? 'var(--neon-green)' : 'var(--neon-red)'}30`,
            padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '6px' }}>Net Profit / Loss</div>
              <div style={{
                fontSize: '36px', fontWeight: 900,
                color: profit >= 0 ? 'var(--neon-green)' : 'var(--neon-red)',
                letterSpacing: '-1px',
              }}>
                {profit >= 0 ? '+' : ''}₹{profit.toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: '64px' }}>{profit >= 0 ? '📈' : '📉'}</div>
          </div>

          {/* Recent activity */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '15px' }}>Recent Activity</span>
              <button onClick={() => navigate('history')} style={{
                background: 'none', border: 'none', color: 'var(--neon-blue)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}>View all →</button>
            </div>
            {state.history.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>
                No games played yet. Start playing!
              </div>
            ) : (
              state.history.slice(0, 5).map((h, i) => {
                const profit = h.payout - h.wager;
                return (
                  <div key={h.id} style={{
                    padding: '14px 20px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '20px' }}>
                        {{ crash: '📈', dice: '🎲', coinflip: '🪙' }[h.game]}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{{ crash: 'Crash', dice: 'Dice', coinflip: 'Coin Flip' }[h.game]}</div>
                        <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Bet: {h.wager.toLocaleString()} · {h.multiplier.toFixed(2)}x</div>
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, color: profit >= 0 ? 'var(--neon-green)' : 'var(--neon-red)', fontSize: '15px' }}>
                      {profit >= 0 ? '+' : ''}{profit.toLocaleString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
