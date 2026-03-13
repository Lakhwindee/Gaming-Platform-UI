import { useGame } from '../context/GameContext';

const BONUSES = [
  {
    title: '500% Welcome Bonus', subtitle: 'First Deposit Offer',
    desc: 'Deposit any amount and get 500% on top — up to 50,000 points!',
    icon: '🎁', color: '#00d4ff', tag: 'NEW PLAYERS', expires: 'Permanent',
    steps: ['Register your account', 'Make your first deposit', 'Get 500% bonus instantly'],
  },
  {
    title: '30% Weekly Cashback', subtitle: 'VIP Cashback Program',
    desc: 'Get up to 30% back on your weekly losses — never leave empty-handed.',
    icon: '💰', color: '#00ff88', tag: 'ALL PLAYERS', expires: 'Every Monday',
    steps: ['Play any games during the week', 'Losses are tracked automatically', 'Cashback credited every Monday'],
  },
  {
    title: '₹30,000 Monthly Tournament', subtitle: 'Compete for the Prize Pool',
    desc: 'Compete with other players and climb the leaderboard to win a share of the ₹30,000 prize pool!',
    icon: '🏆', color: '#ffd700', tag: 'HOT', expires: '23 days left',
    steps: ['Play any Fast Games or Casino games', 'Earn points for each bet', 'Top 100 players share the prize'],
  },
  {
    title: '70 Free Spins', subtitle: 'Deposit Reward',
    desc: 'Deposit 1,500+ pts and get 70 free spins on selected slot games!',
    icon: '🎰', color: '#a855f7', tag: 'CASINO', expires: 'Limited time',
    steps: ['Deposit at least 1,500 pts', 'Free spins credited within 24h', 'Play on selected slots'],
  },
  {
    title: 'Refer & Earn', subtitle: 'Referral Program',
    desc: 'Invite friends and earn 10% of their winnings forever — unlimited referrals!',
    icon: '👥', color: '#ff2d9b', tag: 'REFERRAL', expires: 'Permanent',
    steps: ['Share your unique link', 'Friend registers and plays', 'You earn 10% of their winnings'],
  },
  {
    title: 'Loyalty Coins Exchange', subtitle: 'Earn & Redeem',
    desc: 'Every bet earns you Loyalty Coins. Exchange them for bonus balance, free spins, or merchandise!',
    icon: '🪙', color: '#ffd700', tag: 'VIP', expires: 'Always active',
    steps: ['Bet on any game to earn coins', 'Accumulate coins over time', 'Exchange coins in your profile'],
  },
];

const VIP_LEVELS = [
  { name: 'Bronze', icon: '🥉', color: '#CD7F32', wagered: '0', cashback: '5%', bonus: '100%', withdraw: '5,000' },
  { name: 'Silver', icon: '🥈', color: '#C0C0C0', wagered: '100K', cashback: '10%', bonus: '150%', withdraw: '10,000' },
  { name: 'Gold', icon: '🥇', color: '#FFD700', wagered: '500K', cashback: '15%', bonus: '200%', withdraw: '25,000' },
  { name: 'Platinum', icon: '💎', color: '#00d4ff', wagered: '1M', cashback: '20%', bonus: '300%', withdraw: '50,000' },
  { name: 'Diamond', icon: '💜', color: '#a855f7', wagered: '5M', cashback: '30%', bonus: '500%', withdraw: 'Unlimited' },
];

export default function Promotions() {
  const { state, addNotification } = useGame();

  function claimBonus(title: string) {
    if (!state.user) { alert('Sign in to claim bonuses!'); return; }
    addNotification(`🎁 ${title} claimed! Check your balance.`, 'bonus');
    alert(`✅ ${title} has been activated! Your bonus will appear in your account.`);
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontWeight: 900, fontSize: '28px', letterSpacing: '-0.5px', marginBottom: '8px' }}>🎁 Promotions</h1>
        <p style={{ color: 'var(--text2)', fontSize: '15px' }}>Exclusive bonuses, cashback offers and tournaments just for you</p>
      </div>

      {/* Bonus cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px', marginBottom: '48px' }}>
        {BONUSES.map((b, i) => (
          <div key={i} style={{
            background: `linear-gradient(135deg, ${b.color}12, var(--bg2))`,
            border: `1px solid ${b.color}30`, borderRadius: 'var(--radius-xl)', overflow: 'hidden',
          }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${b.color}20` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span style={{ fontSize: '48px' }}>{b.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                  <span style={{
                    background: `${b.color}20`, color: b.color,
                    fontSize: '10px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px',
                  }}>{b.tag}</span>
                  <span style={{ color: 'var(--text3)', fontSize: '11px' }}>⏰ {b.expires}</span>
                </div>
              </div>
              <h3 style={{ fontWeight: 900, fontSize: '22px', marginBottom: '4px', color: b.color }}>{b.title}</h3>
              <div style={{ color: 'var(--text2)', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>{b.subtitle}</div>
              <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>{b.desc}</p>
            </div>

            <div style={{ padding: '16px 24px 20px' }}>
              <div style={{ marginBottom: '16px' }}>
                {b.steps.map((step, j) => (
                  <div key={j} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: `${b.color}30`, color: b.color,
                      fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: '1px',
                    }}>{j + 1}</div>
                    <span style={{ color: 'var(--text2)', fontSize: '13px' }}>{step}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => claimBonus(b.title)} style={{
                width: '100%', background: b.color, color: '#000', border: 'none',
                borderRadius: 'var(--radius)', padding: '13px', fontWeight: 800, fontSize: '15px', cursor: 'pointer',
              }}>
                Claim Bonus →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* VIP Table */}
      <div style={{ marginBottom: '48px' }}>
        <h2 style={{ fontWeight: 900, fontSize: '22px', marginBottom: '16px', letterSpacing: '-0.5px' }}>💎 VIP Program</h2>
        <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
            color: 'var(--text3)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px',
          }}>
            <span>LEVEL</span>
            <span style={{ textAlign: 'center' }}>MIN WAGERED</span>
            <span style={{ textAlign: 'center' }}>CASHBACK</span>
            <span style={{ textAlign: 'center' }}>BONUS</span>
            <span style={{ textAlign: 'center' }}>MAX WITHDRAW</span>
          </div>
          {VIP_LEVELS.map((v, i) => {
            const isActive = state.user?.vipLevel === v.name;
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                padding: '16px 20px', borderBottom: i < VIP_LEVELS.length - 1 ? '1px solid var(--border)' : 'none',
                background: isActive ? `${v.color}10` : 'transparent',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>{v.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: isActive ? v.color : 'var(--text)', fontSize: '15px' }}>{v.name}</div>
                    {isActive && <div style={{ fontSize: '10px', color: v.color, fontWeight: 700 }}>CURRENT</div>}
                  </div>
                </div>
                <div style={{ textAlign: 'center', color: 'var(--text2)', fontWeight: 600 }}>{v.wagered} pts</div>
                <div style={{ textAlign: 'center', color: 'var(--neon-green)', fontWeight: 800 }}>{v.cashback}</div>
                <div style={{ textAlign: 'center', color: 'var(--neon-blue)', fontWeight: 700 }}>{v.bonus}</div>
                <div style={{ textAlign: 'center', color: 'var(--neon-gold)', fontWeight: 700 }}>{v.withdraw}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
