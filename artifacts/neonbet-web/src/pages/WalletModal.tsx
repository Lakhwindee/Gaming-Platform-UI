import { useState } from 'react';
import { useGame } from '../context/GameContext';

const METHODS = [
  { id: 'card', icon: '💳', name: 'Credit/Debit Card' },
  { id: 'upi', icon: '📱', name: 'UPI / PhonePe' },
  { id: 'crypto', icon: '₿', name: 'Crypto (BTC/ETH)' },
  { id: 'paytm', icon: '💰', name: 'Paytm' },
  { id: 'netbanking', icon: '🏦', name: 'Net Banking' },
];

const AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

export default function WalletModal() {
  const { state, toggleWallet, addNotification } = useGame();
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [method, setMethod] = useState('upi');
  const [amount, setAmount] = useState(1000);
  const [processing, setProcessing] = useState(false);

  function handleAction() {
    if (!state.user) return;
    if (tab === 'withdraw' && state.user.balance < amount) {
      alert('Insufficient balance!'); return;
    }
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      addNotification(tab === 'deposit' ? `💰 ${amount.toLocaleString()} pts deposited successfully!` : `💸 ${amount.toLocaleString()} pts withdrawal requested!`, 'bonus');
      toggleWallet();
    }, 1500);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }} onClick={e => { if (e.target === e.currentTarget) toggleWallet(); }}>
      <div style={{
        background: 'var(--bg2)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)', width: '480px',
        animation: 'scaleIn 0.2s ease', boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ fontWeight: 800, fontSize: '20px' }}>💰 Wallet</h2>
          {state.user && (
            <div style={{
              background: 'var(--neon-gold)15', border: '1px solid var(--neon-gold)30',
              borderRadius: '10px', padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center',
            }}>
              <span style={{ color: 'var(--text3)', fontSize: '12px' }}>Balance:</span>
              <span style={{ color: 'var(--neon-gold)', fontWeight: 800, fontSize: '16px' }}>
                {state.user.balance.toLocaleString()} pts
              </span>
            </div>
          )}
          <button onClick={toggleWallet} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '4px',
            border: '1px solid var(--border)', marginBottom: '20px',
          }}>
            {(['deposit', 'withdraw'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '10px', borderRadius: '9px', border: 'none',
                background: tab === t ? (t === 'deposit' ? 'var(--neon-green)' : 'var(--neon-red)') : 'transparent',
                color: tab === t ? (t === 'deposit' ? '#000' : '#fff') : 'var(--text2)',
                fontWeight: 700, fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s',
              }}>{t === 'deposit' ? '⬆ Deposit' : '⬇ Withdraw'}</button>
            ))}
          </div>

          {/* Payment Methods */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: 'var(--text3)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>PAYMENT METHOD</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {METHODS.map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)} style={{
                  padding: '8px 14px', borderRadius: '10px', border: '1px solid',
                  borderColor: method === m.id ? 'var(--neon-blue)' : 'var(--border)',
                  background: method === m.id ? 'var(--neon-blue)20' : 'var(--bg3)',
                  color: method === m.id ? 'var(--neon-blue)' : 'var(--text2)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  {m.icon} {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <label style={{ color: 'var(--text3)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', display: 'block', marginBottom: '10px' }}>AMOUNT (PTS)</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 16px', color: 'var(--text)', fontSize: '18px', fontWeight: 800,
            marginBottom: '10px',
          }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '20px' }}>
            {AMOUNTS.map(a => (
              <button key={a} onClick={() => setAmount(a)} style={{
                padding: '10px', borderRadius: '10px', border: '1px solid',
                borderColor: amount === a ? 'var(--neon-blue)' : 'var(--border)',
                background: amount === a ? 'var(--neon-blue)20' : 'var(--bg3)',
                color: amount === a ? 'var(--neon-blue)' : 'var(--text2)',
                fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              }}>{a.toLocaleString()}</button>
            ))}
          </div>
        </div>

        {/* Action button */}
        <div style={{ padding: '0 24px 24px' }}>
          {tab === 'deposit' && (
            <div style={{
              background: 'var(--neon-green)10', border: '1px solid var(--neon-green)30',
              borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '14px',
              fontSize: '13px', color: 'var(--neon-green)',
            }}>
              🎁 Bonus: Get 500% on first deposit! +{(amount * 5).toLocaleString()} pts extra
            </div>
          )}

          <button onClick={handleAction} disabled={processing} style={{
            width: '100%', border: 'none', borderRadius: 'var(--radius)', padding: '16px',
            background: processing ? 'var(--bg3)' : (tab === 'deposit' ? 'var(--neon-green)' : 'var(--neon-red)'),
            color: processing ? 'var(--text2)' : (tab === 'deposit' ? '#000' : '#fff'),
            fontWeight: 800, fontSize: '16px', cursor: processing ? 'not-allowed' : 'pointer',
          }}>
            {processing ? '⏳ Processing...' : (tab === 'deposit' ? `⬆ Deposit ${amount.toLocaleString()} pts` : `⬇ Withdraw ${amount.toLocaleString()} pts`)}
          </button>
        </div>
      </div>
    </div>
  );
}
