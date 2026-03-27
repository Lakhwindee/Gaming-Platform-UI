import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { api, ApiTransaction, UpiInitResult } from '../lib/api';

const AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

type PayMethod = 'gpay' | 'phonepe' | 'paytm' | 'upi';
type PayState = 'idle' | 'initiating' | 'waiting' | 'confirming' | 'success';

const PAY_METHODS: { id: PayMethod; label: string; color: string; bg: string }[] = [
  { id: 'gpay',    label: 'Google Pay', color: '#34A853', bg: 'rgba(52,168,83,0.15)' },
  { id: 'phonepe', label: 'PhonePe',   color: '#6739B7', bg: 'rgba(103,57,183,0.15)' },
  { id: 'paytm',   label: 'Paytm',     color: '#00BAF2', bg: 'rgba(0,186,242,0.15)' },
  { id: 'upi',     label: 'Other UPI', color: '#FF6B00', bg: 'rgba(255,107,0,0.15)' },
];

const C = {
  bg: '#08020E',
  bgCard: 'rgba(180,0,40,0.10)',
  bgCard2: 'rgba(120,0,30,0.18)',
  border: 'rgba(255,30,60,0.20)',
  red: '#FF1A3A',
  gold: '#FFD700',
  green: '#00C853',
  orange: '#FF9800',
  text: '#FFFFFF',
  textMuted: '#AA7788',
  textDim: '#664455',
};

function buildUpiParams(amount: number, merchantUpi: string, txnRef: string): string {
  const name = encodeURIComponent('Blaze');
  const note = encodeURIComponent('Blaze Deposit ' + txnRef);
  return 'pa=' + merchantUpi + '&pn=' + name + '&am=' + amount + '&cu=INR&tn=' + note + '&tr=' + txnRef;
}

function buildUpiUrl(method: PayMethod, amount: number, merchantUpi: string, txnRef: string): string {
  const p = buildUpiParams(amount, merchantUpi, txnRef);
  if (method === 'gpay')    return 'tez://upi/pay?' + p;
  if (method === 'phonepe') return 'phonepe://pay?' + p;
  if (method === 'paytm')   return 'paytmmp://upi/pay?' + p;
  return 'upi://pay?' + p;
}

// Android intent URLs — more reliable on Android Chrome
function buildIntentUrl(method: PayMethod, amount: number, merchantUpi: string, txnRef: string): string {
  const p = buildUpiParams(amount, merchantUpi, txnRef);
  if (method === 'gpay')
    return 'intent://upi/pay?' + p + '#Intent;scheme=tez;package=com.google.android.apps.nbu.paisa.user;end';
  if (method === 'phonepe')
    return 'intent://pay?' + p + '#Intent;scheme=phonepe;package=com.phonepe.app;end';
  if (method === 'paytm')
    return 'intent://pay?' + p + '#Intent;scheme=paytmmp;package=net.one97.paytm;end';
  return 'upi://pay?' + p;
}

function tryOpenUpi(url: string): void {
  // Use a hidden <a> with the deep-link so popup blockers don't interfere
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 500);
}

function MethodIcon({ id, size = 28 }: { id: PayMethod; size?: number }) {
  const icons: Record<PayMethod, string> = { gpay: 'G', phonepe: 'P', paytm: 'T', upi: 'U' };
  const colors: Record<PayMethod, string> = { gpay: '#34A853', phonepe: '#6739B7', paytm: '#00BAF2', upi: '#FF6B00' };
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      background: colors[id], display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, fontWeight: 900, color: '#fff',
    }}>{icons[id]}</div>
  );
}

function txIcon(type: string) {
  if (type === 'deposit')  return { icon: '⬇', color: C.green };
  if (type === 'withdraw') return { icon: '⬆', color: C.red };
  if (type === 'win')      return { icon: '🏆', color: C.gold };
  return { icon: '●', color: C.textMuted };
}

export default function Wallet({ onAuthOpen }: { onAuthOpen: () => void }) {
  const { state, refreshBalance } = useGame();
  const token: string | null = typeof window !== 'undefined' ? localStorage.getItem('nb_token') : null;

  const [tab, setTab]     = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [loading, setLoading] = useState(false);

  const [selectedAmt,    setSelectedAmt]    = useState<number | null>(500);
  const [customAmt,      setCustomAmt]      = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PayMethod>('gpay');

  const [payState,    setPayState]    = useState<PayState>('idle');
  const [pendingTxn,  setPendingTxn]  = useState<UpiInitResult | null>(null);
  const [utrInput,    setUtrInput]    = useState('');
  const [confirming,  setConfirming]  = useState(false);
  const [autoFailMsg, setAutoFailMsg] = useState('');
  const [noAppFound,  setNoAppFound]  = useState(false);

  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [upiId,       setUpiId]       = useState('');
  const [withdrawErr, setWithdrawErr] = useState('');
  const [wagerReq,    setWagerReq]    = useState(0);

  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [txLoading,    setTxLoading]    = useState(false);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const visChangeRef = useRef<(() => void) | null>(null);

  const finalAmount = (() => {
    if (customAmt.trim()) {
      const v = parseInt(customAmt.replace(/[^0-9]/g, ''), 10);
      return isNaN(v) ? 0 : v;
    }
    return selectedAmt ?? 0;
  })();

  const bonus = finalAmount >= 1000 ? Math.floor(finalAmount * 0.1) : 0;

  const loadTx = useCallback(async () => {
    if (!token) return;
    setTxLoading(true);
    try {
      const [data, bal] = await Promise.all([
        api.getTransactions(token),
        api.getBalance(token).catch(() => null),
      ]);
      setTransactions(data);
      if (bal && 'wagerRequirement' in bal) setWagerReq((bal as any).wagerRequirement ?? 0);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (tab === 'history') loadTx();
    if (tab === 'withdraw' && token) {
      api.getBalance(token).then(bal => {
        if (bal && 'wagerRequirement' in bal) setWagerReq((bal as any).wagerRequirement ?? 0);
      }).catch(() => {});
    }
  }, [tab, loadTx, token]);

  // Cleanup on unmount
  useEffect(() => () => { stopListeners(); }, []); // eslint-disable-line

  function stopListeners() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (visChangeRef.current) {
      document.removeEventListener('visibilitychange', visChangeRef.current);
      visChangeRef.current = null;
    }
  }

  function openUpiApp(method: PayMethod, amount: number, merchantUpi: string, txnRef: string): boolean {
    // Try specific app intent URL first (Android Chrome), then deep link
    const intentUrl  = buildIntentUrl(method, amount, merchantUpi, txnRef);
    const deepUrl    = buildUpiUrl(method, amount, merchantUpi, txnRef);
    const genericUrl = 'upi://pay?' + buildUpiParams(amount, merchantUpi, txnRef);

    // On Android, intent:// URLs are most reliable; on iOS use deep link
    const isAndroid = /android/i.test(navigator.userAgent);
    const primary   = isAndroid && method !== 'upi' ? intentUrl : deepUrl;
    const fallback  = isAndroid ? deepUrl : genericUrl;

    tryOpenUpi(primary);
    // If primary likely failed (no specific app), try generic after 1.5s
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        tryOpenUpi(fallback);
      }
    }, 1500);

    return true;
  }

  async function handleDeposit() {
    if (!state.user) { onAuthOpen(); return; }
    if (finalAmount < 100) { alert('Minimum deposit is ₹100'); return; }
    if (finalAmount > 100000) { alert('Maximum deposit is ₹1,00,000'); return; }

    setLoading(true);
    setPayState('initiating');
    setNoAppFound(false);

    try {
      const txn = await api.upiInitiate(token!, finalAmount, selectedMethod);
      setPendingTxn(txn);
      setUtrInput('');
      setAutoFailMsg('');
      setPayState('waiting');

      // Open UPI app
      openUpiApp(selectedMethod, finalAmount, txn.merchantUpi, txn.txnRef);

      // When user returns to browser (visibilitychange) → show confirm screen
      stopListeners();
      let gone = false;
      const onVisible = () => {
        if (!gone) return; // user hasn't left yet
        stopListeners();
        setPayState('confirming');
      };
      const onHide = () => { gone = true; };
      visChangeRef.current = () => {
        if (document.visibilityState === 'hidden') onHide();
        else onVisible();
      };
      document.addEventListener('visibilitychange', visChangeRef.current);

      // Fallback: after 30s show "I've PAID" button anyway
      pollRef.current = setTimeout(() => {
        stopListeners();
        setNoAppFound(true);
      }, 30000) as unknown as ReturnType<typeof setInterval>;

    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed. Please try again.');
      setPayState('idle');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPaid() {
    if (!token || !pendingTxn) return;
    const utr = utrInput.trim();
    if (!utr) return;
    setConfirming(true);
    setAutoFailMsg('');
    try {
      await api.upiConfirm(token, pendingTxn.txnRef, utr);
      await refreshBalance();
      stopPoll();
      setPayState('success');
      setTimeout(() => {
        setPayState('idle');
        setPendingTxn(null);
        setUtrInput('');
        setCustomAmt('');
        setSelectedAmt(500);
        setAutoFailMsg('');
      }, 3000);
    } catch (e) {
      setAutoFailMsg(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setConfirming(false);
    }
  }

  function handleCancelPayment() {
    stopListeners();
    setPayState('idle');
    setPendingTxn(null);
    setUtrInput('');
    setAutoFailMsg('');
    setNoAppFound(false);
  }

  async function handleWithdraw() {
    const amt = parseInt(withdrawAmt, 10);
    if (isNaN(amt) || amt < 200) { setWithdrawErr('Minimum withdrawal is ₹200'); return; }
    if (!upiId.trim()) { setWithdrawErr('Enter your UPI ID'); return; }
    if (!token) { onAuthOpen(); return; }
    setWithdrawErr('');
    if (!window.confirm(`Withdraw ₹${amt.toLocaleString('en-IN')} to ${upiId}?\nProcessed within 24 hours.`)) return;
    setLoading(true);
    try {
      await api.withdraw(token, amt, upiId);
      await refreshBalance();
      alert(`₹${amt.toLocaleString('en-IN')} withdrawal submitted. You'll receive it within 24 hours.`);
      setWithdrawAmt(''); setUpiId('');
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Failed. Try again.';
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error === 'wager_required' && parsed?.pending) {
          setWagerReq(parsed.pending);
          setWithdrawErr(`WAGER_BLOCK:${parsed.pending}`);
          return;
        }
      } catch {}
      setWithdrawErr(raw);
    } finally {
      setLoading(false);
    }
  }

  const balance   = state.user?.balance ?? 0;
  const methodInfo = PAY_METHODS.find(m => m.id === selectedMethod)!;

  const card: React.CSSProperties = {
    background: C.bgCard2,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: '16px',
    marginBottom: 12,
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 100px', color: C.text }}>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, letterSpacing: 1 }}>Wallet</div>

      {/* Balance Card */}
      <div style={{ ...card, background: 'linear-gradient(135deg,rgba(200,0,40,0.22),rgba(60,0,15,0.15))' }}>
        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, letterSpacing: 2 }}>TOTAL BALANCE</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: C.gold, margin: '4px 0 12px' }}>
          ₹{balance.toLocaleString('en-IN')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['deposit', 'withdraw', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
              background: tab === t ? C.red : 'rgba(255,255,255,0.06)',
              color: tab === t ? '#fff' : C.textMuted,
              fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: 0.5,
            }}>
              {t === 'deposit' ? '+ Add' : t === 'withdraw' ? '↑ Out' : '📋 History'}
            </button>
          ))}
        </div>
      </div>

      {/* ── DEPOSIT ── */}
      {tab === 'deposit' && (
        <div>
          {/* Pending payment overlay */}
          {(payState === 'waiting' || payState === 'confirming' || payState === 'success') && pendingTxn && (
            <div style={{ ...card, textAlign: 'center' }}>
              {payState === 'success' ? (
                <>
                  <div style={{ fontSize: 52 }}>✅</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.green, marginTop: 8 }}>Payment Confirmed!</div>
                  <div style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>
                    ₹{pendingTxn.total.toLocaleString('en-IN')} added to your wallet
                  </div>
                </>
              ) : (
                <>
                  {/* Method → Wallet animation */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                    <MethodIcon id={selectedMethod} size={44} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: methodInfo.color, opacity: 0.3 + i * 0.35 }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 28 }}>💰</div>
                  </div>

                  {confirming ? (
                    <div style={{ color: methodInfo.color, fontWeight: 700, marginBottom: 8 }}>⏳ Verifying payment…</div>
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
                      {payState === 'confirming' ? 'Did you complete the payment?' : `Complete Payment in ${methodInfo.label}`}
                    </div>
                  )}

                  <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>
                    Pay ₹{pendingTxn.amount.toLocaleString('en-IN')} to
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 4 }}>
                    {pendingTxn.merchantUpi}
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Ref: {pendingTxn.txnRef}</div>

                  {autoFailMsg && (
                    <div style={{ background: 'rgba(255,150,0,0.12)', border: '1px solid rgba(255,150,0,0.3)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: C.orange, marginBottom: 10 }}>
                      ⚠ {autoFailMsg}
                    </div>
                  )}

                  {payState === 'confirming' && !confirming && (
                    <>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: C.textMuted, marginBottom: 10, textAlign: 'left' }}>
                        <strong style={{ color: C.text }}>Google Pay</strong> → Activity → tap payment → copy{' '}
                        <strong style={{ color: C.text }}>UPI Transaction ID</strong>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 1.5, marginBottom: 6 }}>TRANSACTION ID / UTR</div>
                        <input
                          type="text"
                          placeholder="Paste here from Google Pay"
                          value={utrInput}
                          onChange={e => { setUtrInput(e.target.value); setAutoFailMsg(''); }}
                          autoFocus
                          style={{
                            width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14,
                            background: 'rgba(255,255,255,0.06)',
                            border: `1px solid ${utrInput.length > 0 ? C.green : C.border}`,
                            color: C.text, outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <button
                        onClick={handleConfirmPaid}
                        disabled={utrInput.trim().length === 0}
                        style={{
                          width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                          background: utrInput.trim().length > 0 ? C.green : 'rgba(0,200,83,0.2)',
                          color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 8,
                        }}
                      >
                        ✓ CONFIRM PAYMENT
                      </button>
                      <button onClick={handleCancelPayment} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
                        I didn't pay — Cancel
                      </button>
                    </>
                  )}

                  {payState === 'waiting' && !confirming && noAppFound && (
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px', marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>No UPI app detected — pay manually</div>
                      {[['UPI ID', pendingTxn.merchantUpi], ['Amount', '₹' + pendingTxn.amount.toLocaleString('en-IN')], ['Ref', pendingTxn.txnRef]].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                          <span style={{ color: C.textMuted }}>{k}</span>
                          <span style={{ fontWeight: 700, color: C.gold }}>{v}</span>
                        </div>
                      ))}
                      <button
                        onClick={() => setPayState('confirming')}
                        style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: methodInfo.color, color: '#fff', fontWeight: 800, cursor: 'pointer', marginTop: 4 }}
                      >
                        I'VE PAID
                      </button>
                    </div>
                  )}

                  {payState === 'waiting' && !confirming && !noAppFound && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      <button onClick={handleDeposit} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, color: C.textMuted, padding: '9px', cursor: 'pointer', fontSize: 13 }}>
                        🔄 Reopen {methodInfo.label}
                      </button>
                      <button onClick={() => setPayState('confirming')} style={{ background: methodInfo.color, border: 'none', borderRadius: 10, color: '#fff', padding: '11px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                        I'VE PAID — Enter UTR
                      </button>
                      <button onClick={handleCancelPayment} style={{ background: 'none', border: 'none', color: C.textMuted, padding: '6px', cursor: 'pointer', fontSize: 13 }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {payState === 'idle' && (
            <>
              {/* Bonus banner */}
              {bonus > 0 && (
                <div style={{ background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: C.green }}>
                  🎁 10% Bonus! +₹{bonus.toLocaleString('en-IN')} extra for ≥₹1,000 deposits
                </div>
              )}

              {/* Amount presets */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 2, marginBottom: 8 }}>SELECT AMOUNT</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                {AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => { setSelectedAmt(a); setCustomAmt(''); }}
                    style={{
                      padding: '11px 0', borderRadius: 10, border: '1px solid',
                      borderColor: selectedAmt === a && !customAmt ? C.red : C.border,
                      background: selectedAmt === a && !customAmt ? 'rgba(255,26,58,0.15)' : 'rgba(255,255,255,0.04)',
                      color: selectedAmt === a && !customAmt ? C.red : C.textMuted,
                      fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    ₹{a >= 1000 ? a / 1000 + 'K' : a}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                <span style={{ color: C.textMuted, fontSize: 16, marginRight: 6 }}>₹</span>
                <input
                  type="number"
                  placeholder="Enter custom amount"
                  value={customAmt}
                  onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setCustomAmt(v); if (v) setSelectedAmt(null); }}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 15, fontWeight: 600 }}
                />
                {customAmt && (
                  <button onClick={() => { setCustomAmt(''); setSelectedAmt(500); }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                )}
              </div>

              {/* Payment method */}
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 2, marginBottom: 8 }}>PAYMENT METHOD</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                {PAY_METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px', borderRadius: 12, border: '1px solid',
                      borderColor: selectedMethod === m.id ? m.color : C.border,
                      background: selectedMethod === m.id ? m.bg : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer', position: 'relative',
                    }}
                  >
                    <MethodIcon id={m.id} size={32} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: selectedMethod === m.id ? m.color : C.textMuted }}>
                      {m.label}
                    </span>
                    {selectedMethod === m.id && (
                      <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 900 }}>✓</div>
                    )}
                  </button>
                ))}
              </div>

              {/* Deposit button */}
              <button
                onClick={handleDeposit}
                disabled={loading || finalAmount < 100}
                style={{
                  width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                  background: loading || finalAmount < 100 ? 'rgba(0,200,83,0.15)' : `linear-gradient(135deg,${C.green},#009C41)`,
                  color: '#fff', fontWeight: 900, fontSize: 15, cursor: loading ? 'wait' : 'pointer',
                  letterSpacing: 0.5,
                }}
              >
                {loading ? '⏳ Processing…' : `DEPOSIT ₹${finalAmount.toLocaleString('en-IN')}${bonus > 0 ? ` + ₹${bonus.toLocaleString('en-IN')} Bonus` : ''}`}
              </button>

              {/* Merchant info */}
              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: C.textDim }}>
                Secure UPI payment · 7973248683@pthdfc
              </div>
            </>
          )}
        </div>
      )}

      {/* ── WITHDRAW ── */}
      {tab === 'withdraw' && (
        <div style={card}>

          {/* Wagering Requirement Notice */}
          {wagerReq > 0 && (
            <div style={{ background: 'rgba(255,165,0,0.10)', border: '1px solid rgba(255,165,0,0.30)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#FFA500', marginBottom: 6 }}>
                🔒 Withdrawal Lock
              </div>
              <div style={{ fontSize: 12, color: '#CC9020', marginBottom: 10, lineHeight: 1.5 }}>
                Aapne jo deposit kiya hai uske barabar bets lagani hongi tabhi withdrawal hogi.<br/>
                Abhi <strong style={{ color: '#FFA500' }}>₹{wagerReq.toLocaleString('en-IN')}</strong> ki aur bets lagani hain.
              </div>
              {/* Progress Bar */}
              <div style={{ fontSize: 10, color: '#CC9020', letterSpacing: 1, marginBottom: 5, textTransform: 'uppercase' }}>Wagering Progress</div>
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 8,
                  background: 'linear-gradient(90deg,#FFA500,#FFD700)',
                  width: `${Math.min(100, Math.max(5, 100 - (wagerReq / Math.max(wagerReq, 1)) * 100))}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: '#996600', marginTop: 5, textAlign: 'right' }}>
                ₹{wagerReq.toLocaleString('en-IN')} remaining
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 2, marginBottom: 8 }}>WITHDRAW AMOUNT (₹)</div>
          <input
            type="number"
            placeholder="Min ₹200"
            value={withdrawAmt}
            onChange={e => { setWithdrawAmt(e.target.value); setWithdrawErr(''); }}
            style={{
              width: '100%', padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,0.05)', color: C.text, fontSize: 16, fontWeight: 700,
              outline: 'none', boxSizing: 'border-box', marginBottom: 12,
            }}
          />

          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 2, marginBottom: 8 }}>YOUR UPI ID / PHONE</div>
          <input
            type="text"
            placeholder="e.g. 9876543210@ybl"
            value={upiId}
            onChange={e => { setUpiId(e.target.value); setWithdrawErr(''); }}
            autoCapitalize="none"
            style={{
              width: '100%', padding: '13px 14px', borderRadius: 12, border: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,0.05)', color: C.text, fontSize: 14,
              outline: 'none', boxSizing: 'border-box', marginBottom: 12,
            }}
          />

          {withdrawErr && !withdrawErr.startsWith('WAGER_BLOCK:') && (
            <div style={{ background: 'rgba(255,26,58,0.10)', border: '1px solid rgba(255,26,58,0.25)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: C.red, marginBottom: 12 }}>
              ⚠ {withdrawErr}
            </div>
          )}

          <div style={{ background: 'rgba(255,150,0,0.08)', border: '1px solid rgba(255,150,0,0.2)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: C.orange, marginBottom: 14 }}>
            ℹ Withdrawals are processed within 24 hours. Min ₹200.
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>Available balance</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>₹{balance.toLocaleString('en-IN')}</span>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={loading}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: loading ? 'rgba(255,26,58,0.15)' : `linear-gradient(135deg,${C.red},#CC0020)`,
              color: '#fff', fontWeight: 900, fontSize: 15, cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '⏳ Processing…' : `WITHDRAW ₹${parseInt(withdrawAmt || '0').toLocaleString('en-IN')}`}
          </button>
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        <div>
          {txLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Loading…</div>
          ) : transactions.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 32, color: C.textMuted }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div>No transactions yet</div>
            </div>
          ) : (
            transactions.map(tx => {
              const { icon, color } = txIcon(tx.type);
              return (
                <div key={tx.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, width: 36, textAlign: 'center' }}>{icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{tx.type}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{tx.note || tx.status}</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>
                      {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color }}>
                      {tx.type === 'deposit' || tx.type === 'win' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 10, color: tx.status === 'completed' ? C.green : tx.status === 'pending' ? C.orange : C.textMuted, fontWeight: 600 }}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
