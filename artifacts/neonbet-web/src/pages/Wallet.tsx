import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { api, ApiTransaction, UpiInitResult } from '../lib/api';

const C = {
  bg: '#08010F', bgCard: 'rgba(20,5,35,0.95)', red: '#FF3A3A', gold: '#FFD700',
  green: '#00C853', orange: '#FF9800', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.45)',
  border: 'rgba(255,255,255,0.08)', tabBg: 'rgba(10,0,20,0.95)',
};

type PayMethod = 'gpay' | 'phonepe' | 'paytm' | 'upi';
type PayState = 'idle' | 'initiating' | 'waiting' | 'confirming' | 'success';

const PAY_METHODS: { id: PayMethod; label: string; color: string; bg: string; emoji: string }[] = [
  { id: 'gpay',    label: 'Google Pay', color: '#34A853', bg: 'rgba(52,168,83,0.15)',   emoji: '🟢' },
  { id: 'phonepe', label: 'PhonePe',   color: '#6739B7', bg: 'rgba(103,57,183,0.15)',  emoji: '💜' },
  { id: 'paytm',   label: 'Paytm',     color: '#00BAF2', bg: 'rgba(0,186,242,0.15)',   emoji: '🔵' },
  { id: 'upi',     label: 'Other UPI', color: '#FF6B00', bg: 'rgba(255,107,0,0.15)',   emoji: '📲' },
];

const AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

function buildUpiUrl(method: PayMethod, amount: number, merchantUpi: string, txnRef: string): string {
  const name = encodeURIComponent('Blaze');
  const note = encodeURIComponent('Blaze Deposit ' + txnRef);
  const base = 'pa=' + merchantUpi + '&pn=' + name + '&am=' + amount + '&cu=INR&tn=' + note;
  if (method === 'gpay')    return 'tez://upi/pay?' + base;
  if (method === 'phonepe') return 'phonepe://pay?transactionId=' + txnRef + '&' + base;
  if (method === 'paytm')   return 'paytmmp://upi/pay?' + base;
  return 'upi://pay?' + base;
}

function txIcon(type: string): string {
  if (type === 'deposit')  return '⬇️';
  if (type === 'withdraw') return '⬆️';
  if (type === 'win')      return '🏆';
  return '❌';
}
function txColor(type: string): string {
  if (type === 'deposit') return C.green;
  if (type === 'win')     return C.gold;
  if (type === 'withdraw') return C.red;
  return C.textMuted;
}

export default function Wallet() {
  const { state, getToken, refreshBalance } = useGame();
  const user = state.user;
  const balance = user?.balance ?? 0;

  const [tab, setTab]       = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [loading, setLoading] = useState(false);

  const [selectedAmt, setSelectedAmt] = useState<number | null>(500);
  const [customAmt,   setCustomAmt]   = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PayMethod>('gpay');

  const [payState,   setPayState]   = useState<PayState>('idle');
  const [pendingTxn, setPendingTxn] = useState<UpiInitResult | null>(null);
  const [utrInput,   setUtrInput]   = useState('');
  const [confirming, setConfirming] = useState(false);
  const [autoFailMsg, setAutoFailMsg] = useState('');

  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [upiId,       setUpiId]       = useState('');

  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [txLoading,    setTxLoading]    = useState(false);

  const pendingTxnRef = useRef(pendingTxn);
  useEffect(() => { pendingTxnRef.current = pendingTxn; }, [pendingTxn]);

  const finalAmount = (() => {
    if (customAmt.trim()) {
      const v = parseInt(customAmt.replace(/[^0-9]/g, ''), 10);
      return isNaN(v) ? 0 : v;
    }
    return selectedAmt ?? 0;
  })();

  const bonus = finalAmount >= 1000 ? Math.floor(finalAmount * 0.1) : 0;

  const loadTx = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setTxLoading(true);
    try {
      const data = await api.getTransactions(token);
      setTransactions(data);
    } catch { setTransactions([]); }
    finally { setTxLoading(false); }
  }, [getToken]);

  useEffect(() => { if (tab === 'history') loadTx(); }, [tab, loadTx]);

  async function handleDeposit() {
    const token = getToken();
    if (!token || !user) { alert('Please sign in first'); return; }
    if (finalAmount < 100) { alert('Minimum deposit is ₹100'); return; }
    if (finalAmount > 100000) { alert('Maximum deposit is ₹1,00,000'); return; }

    setLoading(true);
    setPayState('initiating');

    try {
      const txn = await api.upiInitiate(token, finalAmount, selectedMethod);
      setPendingTxn(txn);
      setUtrInput('');
      setAutoFailMsg('');
      setPayState('waiting');

      const upiUrl = buildUpiUrl(selectedMethod, finalAmount, txn.merchantUpi, txn.txnRef);
      const generic = 'upi://pay?pa=' + txn.merchantUpi +
        '&pn=' + encodeURIComponent('Blaze') +
        '&am=' + finalAmount +
        '&cu=INR&tn=' + encodeURIComponent('Blaze Deposit ' + txn.txnRef);

      try { window.location.href = upiUrl; }
      catch { try { window.location.href = generic; } catch { /* manual */ } }
    } catch (e) {
      alert('Failed: ' + (e instanceof Error ? e.message : 'Please try again'));
      setPayState('idle');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPaid() {
    const token = getToken();
    if (!token || !pendingTxn) return;
    const utr = utrInput.trim();
    if (!utr) return;
    setConfirming(true);
    setAutoFailMsg('');
    try {
      await api.upiConfirm(token, pendingTxn.txnRef, utr);
      await refreshBalance();
      setPayState('success');
      setTimeout(() => {
        setPayState('idle'); setPendingTxn(null);
        setUtrInput(''); setCustomAmt(''); setSelectedAmt(500); setAutoFailMsg('');
      }, 3000);
    } catch (e) {
      setAutoFailMsg(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally { setConfirming(false); }
  }

  function handleCancelPayment() {
    setPayState('idle'); setPendingTxn(null);
    setUtrInput(''); setAutoFailMsg('');
  }

  async function handleWithdraw() {
    const amt = parseInt(withdrawAmt, 10);
    const token = getToken();
    if (isNaN(amt) || amt < 200) { alert('Minimum withdrawal is ₹200'); return; }
    if (!upiId.trim()) { alert('Enter your UPI ID or phone number'); return; }
    if (!token) { alert('Please sign in first'); return; }
    if (!window.confirm(`Withdraw ₹${amt.toLocaleString('en-IN')} to:\n${upiId}\n\nProcessed within 24 hours.`)) return;
    setLoading(true);
    try {
      await api.withdraw(token, amt, upiId);
      await refreshBalance();
      alert(`₹${amt.toLocaleString('en-IN')} withdrawal submitted. You'll receive it within 24 hours.`);
      setWithdrawAmt(''); setUpiId('');
    } catch (e) { alert('Failed: ' + (e instanceof Error ? e.message : 'Try again')); }
    finally { setLoading(false); }
  }

  const methodInfo = PAY_METHODS.find(m => m.id === selectedMethod)!;

  return (
    <div style={{ minHeight: '100%', background: C.bg, paddingBottom: 20 }}>
      {/* Screen title */}
      <div style={{ padding: '20px 16px 4px', fontSize: 22, fontWeight: 900, color: C.text }}>Wallet</div>

      {/* Balance card */}
      <div style={{ margin: '0 16px 16px', background: 'linear-gradient(135deg, rgba(200,0,40,0.25), rgba(60,0,15,0.15))', borderRadius: 16, border: '1px solid rgba(255,58,58,0.2)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1.2 }}>TOTAL BALANCE</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.gold, marginTop: 2 }}>₹{balance.toLocaleString('en-IN')}</div>
          </div>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>💰</div>
        </div>
        <div style={{ height: 1, background: C.border, margin: '14px 0' }} />
        <div style={{ display: 'flex', gap: 0 }}>
          {(['deposit', 'withdraw', 'history'] as const).map((t, i) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 0', borderRight: i < 2 ? '1px solid ' + C.border : 'none' }}>
              <span style={{ fontSize: 16 }}>{t === 'deposit' ? '➕' : t === 'withdraw' ? '⬆️' : '🧾'}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>
                {t === 'deposit' ? 'Add Money' : t === 'withdraw' ? 'Withdraw' : 'History'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', margin: '0 16px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, border: '1px solid ' + C.border }}>
        {(['deposit', 'withdraw', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
            background: tab === t ? (t === 'deposit' ? C.green : t === 'withdraw' ? C.red : 'rgba(255,255,255,0.12)') : 'transparent',
            color: tab === t ? '#fff' : C.textMuted,
          }}>
            {t === 'deposit' ? 'UPI Deposit' : t === 'withdraw' ? 'Withdraw' : 'History'}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* ── DEPOSIT TAB ── */}
        {tab === 'deposit' && (
          <div>
            {/* Payment waiting overlay */}
            {(payState === 'waiting' || payState === 'confirming' || payState === 'success') && pendingTxn && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid ' + C.border, borderRadius: 16, padding: 24, marginBottom: 16, textAlign: 'center' }}>
                {payState === 'success' ? (
                  <>
                    <div style={{ fontSize: 52, marginBottom: 8 }}>✅</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>Payment Confirmed!</div>
                    <div style={{ color: C.textMuted, marginTop: 6 }}>₹{pendingTxn.total.toLocaleString('en-IN')} added to your wallet</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{methodInfo.emoji}</div>
                    {confirming ? (
                      <div style={{ color: methodInfo.color, fontWeight: 700, marginBottom: 8 }}>Verifying payment…</div>
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 8 }}>
                        {payState === 'confirming' ? 'Did you complete the payment?' : 'Complete Payment in ' + methodInfo.label}
                      </div>
                    )}
                    <div style={{ color: C.textMuted, fontSize: 14, marginBottom: 4 }}>
                      Pay ₹{pendingTxn.amount.toLocaleString('en-IN')} to
                    </div>
                    <div style={{ color: C.gold, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{pendingTxn.merchantUpi}</div>
                    <div style={{ color: C.textMuted, fontSize: 11, marginBottom: 16 }}>Ref: {pendingTxn.txnRef}</div>

                    {autoFailMsg && (
                      <div style={{ background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: 10, padding: '8px 12px', color: '#FF9800', fontSize: 12, marginBottom: 12 }}>
                        ⚠️ {autoFailMsg}
                      </div>
                    )}

                    {/* UTR entry */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 12, textAlign: 'left' }}>
                      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>TRANSACTION ID / UTR</div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 8 }}>
                        Google Pay → Activity → tap payment → copy UPI Transaction ID
                      </div>
                      <input
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid ' + (utrInput.length > 0 ? C.green : C.border), borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                        placeholder="Paste UTR/Transaction ID here"
                        value={utrInput}
                        onChange={e => { setUtrInput(e.target.value); setAutoFailMsg(''); }}
                        autoCapitalize="none"
                      />
                    </div>

                    <button
                      onClick={handleConfirmPaid}
                      disabled={utrInput.trim().length === 0 || confirming}
                      style={{ width: '100%', padding: '13px 0', background: utrInput.trim().length > 0 ? C.green : 'rgba(0,60,30,0.3)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 14, cursor: utrInput.trim().length > 0 ? 'pointer' : 'default', marginBottom: 10 }}>
                      ✓ CONFIRM PAYMENT
                    </button>
                    <button onClick={handleCancelPayment} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 13, cursor: 'pointer' }}>
                      I didn't pay — Cancel
                    </button>
                  </>
                )}
              </div>
            )}

            {payState === 'idle' && (
              <>
                {/* Amount selection */}
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1.2, marginBottom: 10 }}>SELECT AMOUNT</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  {AMOUNTS.map(a => (
                    <button key={a} onClick={() => { setSelectedAmt(a); setCustomAmt(''); }} style={{ padding: '11px 0', borderRadius: 10, border: '1px solid', borderColor: selectedAmt === a && !customAmt ? C.red : C.border, background: selectedAmt === a && !customAmt ? 'rgba(255,58,58,0.15)' : 'rgba(255,255,255,0.04)', color: selectedAmt === a && !customAmt ? C.red : C.text, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      ₹{a >= 1000 ? a / 1000 + 'K' : a}
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: 10, border: '1px solid ' + C.border, padding: '0 12px', marginBottom: 20 }}>
                  <span style={{ color: C.gold, fontWeight: 700, fontSize: 16, marginRight: 4 }}>₹</span>
                  <input
                    style={{ flex: 1, background: 'none', border: 'none', padding: '12px 0', color: C.text, fontSize: 15, fontWeight: 600, outline: 'none' }}
                    placeholder="Enter custom amount"
                    value={customAmt}
                    onChange={e => { const c = e.target.value.replace(/[^0-9]/g, ''); setCustomAmt(c); if (c) setSelectedAmt(null); }}
                    inputMode="numeric"
                    maxLength={7}
                  />
                  {customAmt && <button onClick={() => { setCustomAmt(''); setSelectedAmt(500); }} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 18, cursor: 'pointer', padding: 0 }}>×</button>}
                </div>

                {/* Payment method */}
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1.2, marginBottom: 10 }}>PAYMENT METHOD</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {PAY_METHODS.map(m => (
                    <button key={m.id} onClick={() => setSelectedMethod(m.id)} style={{ padding: '12px', borderRadius: 12, border: '1.5px solid', borderColor: selectedMethod === m.id ? m.color : 'rgba(255,255,255,0.08)', background: selectedMethod === m.id ? m.bg : 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                      <span style={{ fontSize: 22 }}>{m.emoji}</span>
                      <span style={{ color: selectedMethod === m.id ? m.color : C.textMuted, fontWeight: 700, fontSize: 13 }}>{m.label}</span>
                      {selectedMethod === m.id && <span style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>✓</span>}
                    </button>
                  ))}
                </div>

                {/* Summary */}
                <div style={{ background: 'linear-gradient(135deg, rgba(0,200,83,0.1), rgba(0,100,40,0.05))', borderRadius: 12, padding: '12px 16px', marginBottom: 16, border: '1px solid rgba(0,200,83,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: C.textMuted, fontSize: 13 }}>Amount</span>
                    <span style={{ color: C.text, fontWeight: 700 }}>{finalAmount > 0 ? '₹' + finalAmount.toLocaleString('en-IN') : '—'}</span>
                  </div>
                  {bonus > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: C.green, fontSize: 13 }}>Bonus (10%)</span>
                      <span style={{ color: C.green, fontWeight: 700 }}>+₹{bonus.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4 }}>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>You get</span>
                    <span style={{ color: C.gold, fontWeight: 900, fontSize: 16 }}>{finalAmount > 0 ? '₹' + (finalAmount + bonus).toLocaleString('en-IN') : '—'}</span>
                  </div>
                </div>

                <button
                  onClick={handleDeposit}
                  disabled={loading || !user || finalAmount < 100}
                  style={{ width: '100%', padding: '15px 0', background: user && finalAmount >= 100 ? 'linear-gradient(to bottom, #00C853, #009C41)' : 'rgba(0,60,30,0.3)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 15, cursor: user && finalAmount >= 100 && !loading ? 'pointer' : 'default', marginBottom: 10 }}>
                  {loading ? '⏳ Processing…' : !user ? 'SIGN IN TO DEPOSIT' : finalAmount >= 100 ? '🔒 PAY ₹' + finalAmount.toLocaleString('en-IN') + ' SECURELY' : 'ENTER AMOUNT (MIN ₹100)'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <span style={{ color: C.green, fontSize: 12 }}>🛡</span>
                  <span style={{ color: C.textMuted, fontSize: 11 }}>256-bit SSL encrypted · UPI Payments</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── WITHDRAW TAB ── */}
        {tab === 'withdraw' && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid ' + C.border, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1.2, marginBottom: 10 }}>WITHDRAWAL AMOUNT</div>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: 10, border: '1px solid ' + C.border, padding: '0 12px', marginBottom: 12 }}>
                <span style={{ color: C.gold, fontWeight: 700, fontSize: 16, marginRight: 4 }}>₹</span>
                <input
                  style={{ flex: 1, background: 'none', border: 'none', padding: '12px 0', color: C.text, fontSize: 15, fontWeight: 600, outline: 'none' }}
                  placeholder="Enter amount (min ₹200)"
                  value={withdrawAmt}
                  onChange={e => setWithdrawAmt(e.target.value.replace(/[^0-9]/g, ''))}
                  inputMode="numeric"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[200, 500, 1000, 2000].map(a => (
                  <button key={a} onClick={() => setWithdrawAmt(String(a))} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid ' + C.border, background: 'rgba(255,255,255,0.04)', color: C.textMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    ₹{a >= 1000 ? a / 1000 + 'K' : a}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 1.2, marginBottom: 10 }}>UPI DETAILS</div>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: 10, border: '1px solid ' + C.border, padding: '0 12px', marginBottom: 12 }}>
                <span style={{ fontSize: 18, marginRight: 8 }}>📱</span>
                <input
                  style={{ flex: 1, background: 'none', border: 'none', padding: '12px 0', color: C.text, fontSize: 14, fontWeight: 600, outline: 'none' }}
                  placeholder="UPI ID (eg: name@upi) or Phone No."
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  autoCapitalize="none"
                />
              </div>

              <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 20 }}>
                <span>ℹ️</span>
                <span style={{ color: C.textMuted, fontSize: 12 }}>Withdrawal is processed within 24 hours. Minimum ₹200. Your balance must cover the amount.</span>
              </div>

              <button
                onClick={handleWithdraw}
                disabled={loading || !user || parseInt(withdrawAmt, 10) < 200 || !upiId.trim()}
                style={{ width: '100%', padding: '15px 0', background: user && parseInt(withdrawAmt, 10) >= 200 && upiId.trim() ? 'linear-gradient(to bottom, #FF3A3A, #CC0020)' : 'rgba(60,0,20,0.3)', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 8 }}>
                {loading ? '⏳ Processing…' : !user ? 'SIGN IN TO WITHDRAW' : '⬆️ REQUEST WITHDRAWAL'}
              </button>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div>
            {txLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading…</div>
            ) : transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
                <div style={{ color: C.textMuted, fontSize: 14 }}>No transactions yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transactions.map(tx => (
                  <div key={tx.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid ' + C.border, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{txIcon(tx.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text, textTransform: 'capitalize' }}>{tx.type}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tx.note}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{new Date(tx.createdAt).toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: txColor(tx.type) }}>
                        {tx.type === 'withdraw' || tx.type === 'loss' ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: 10, color: tx.status === 'completed' ? C.green : tx.status === 'pending' ? C.orange : C.red, fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{tx.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
