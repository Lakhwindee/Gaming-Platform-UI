import React, { useCallback, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { api, ApiGameHistory } from '../lib/api';

const C = {
  bg: '#08020E', bgCard: 'rgba(180,0,40,0.13)', border: 'rgba(255,30,60,0.22)',
  red: '#FF1A3A', gold: '#FFD700', green: '#00C853', orange: '#FF8C00',
  blue: '#4DA6FF', purple: '#FF4DFF', textMuted: '#AA7788', textDim: '#664455',
};

const VIP_TIERS = [
  { label: 'Bronze',   min: 0,       color: '#CD7F32' },
  { label: 'Silver',   min: 50000,   color: '#C0C0C0' },
  { label: 'Gold',     min: 200000,  color: '#FFD700' },
  { label: 'Platinum', min: 500000,  color: '#00CFFF' },
  { label: 'Diamond',  min: 1000000, color: '#BF00FF' },
];

function getVip(wagered: number) {
  let tier = VIP_TIERS[0];
  for (const t of VIP_TIERS) if (wagered >= t.min) tier = t;
  const idx = VIP_TIERS.indexOf(tier);
  const next = VIP_TIERS[idx + 1];
  const pct = next ? Math.min((wagered - tier.min) / (next.min - tier.min), 1) : 1;
  return { tier, next, pct };
}

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div style={{
      width: 'calc(50% - 6px)', background: C.bgCard, borderRadius: 14,
      padding: '14px', border: `1px solid ${C.border}`, display: 'flex',
      flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
    </div>
  );
}

function HistoryRow({ item, last }: { item: ApiGameHistory; last: boolean }) {
  const won = item.status === 'cashedout' && item.payout != null && item.payout > 0;
  const mult = item.cashedOutAt ? parseFloat(item.cashedOutAt) : null;
  const crashMult = item.crashPoint ? parseFloat(item.crashPoint) : null;
  const profit = won ? (item.payout! - item.amount) : -item.amount;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12,
      borderBottom: last ? 'none' : `1px solid rgba(255,255,255,0.04)`,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: won ? C.green : C.red, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
          {won ? `Cashed out @ ${mult?.toFixed(2)}×` : `Crashed @ ${crashMult?.toFixed(2) ?? '?'}×`}
        </div>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{timeAgo(item.placedAt)}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: won ? C.green : C.red }}>
          {won ? '+' : '-'}{fmt(Math.abs(profit))}
        </div>
        <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{fmt(item.amount)}</div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function submit() {
    if (!cur || !next || !confirm) { setErr('All fields required'); return; }
    if (next !== confirm) { setErr("Passwords don't match"); return; }
    if (next.length < 6) { setErr('Min 6 characters'); return; }
    setLoading(true); setErr('');
    try {
      const token = localStorage.getItem('nb_token') ?? '';
      await api.changePassword(token, cur, next);
      alert('Password changed successfully!');
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#0D0208', borderRadius: '20px 20px 0 0',
        border: `1px solid ${C.border}`, width: '100%', maxWidth: 480,
        padding: '24px 20px 40px',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 20px' }} />
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: '#fff' }}>Change Password</div>

        {[
          { label: 'CURRENT PASSWORD', val: cur, set: setCur, show: showCur, toggle: () => setShowCur(p => !p) },
          { label: 'NEW PASSWORD', val: next, set: setNext, show: showNew, toggle: () => setShowNew(p => !p) },
          { label: 'CONFIRM NEW PASSWORD', val: confirm, set: setConfirm, show: showNew, toggle: () => setShowNew(p => !p) },
        ].map((f, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: 1.5, marginBottom: 6 }}>{f.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', background: '#180010', borderRadius: 10, border: `1px solid ${C.border}`, padding: '10px 14px' }}>
              <input
                type={f.show ? 'text' : 'password'}
                value={f.val}
                onChange={e => { f.set(e.target.value); setErr(''); }}
                placeholder={i === 0 ? 'Enter current password' : i === 1 ? 'At least 6 characters' : 'Re-enter new password'}
                style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 14, outline: 'none' }}
              />
              <button onClick={f.toggle} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 16 }}>
                {f.show ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        ))}

        {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>⚠️ {err}</div>}

        <button
          onClick={submit}
          disabled={loading || !cur || !next || !confirm}
          style={{
            width: '100%', padding: '14px', background: loading ? '#333' : C.red,
            border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800,
            fontSize: 15, cursor: loading ? 'default' : 'pointer', marginTop: 4,
            opacity: (!cur || !next || !confirm) && !loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Changing...' : 'CHANGE PASSWORD'}
        </button>
        <button onClick={onClose} style={{
          width: '100%', padding: '12px', background: 'none', border: 'none',
          color: C.textMuted, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 8,
        }}>Cancel</button>
      </div>
    </div>
  );
}

export default function Profile({ onAuthOpen }: { onAuthOpen?: () => void }) {
  const { state, logout } = useGame();
  const user = state.user;
  const [history, setHistory] = useState<ApiGameHistory[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);

  const loadHistory = useCallback(async () => {
    const token = localStorage.getItem('nb_token');
    if (!token) return;
    try {
      setHistLoading(true);
      const h = await api.getGameHistory(token);
      setHistory(h);
    } catch { /* ignore */ } finally { setHistLoading(false); }
  }, []);

  useEffect(() => { if (user) loadHistory(); }, [user, loadHistory]);

  // ── Guest view ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: C.bgCard, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px' }}>👤</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Not Signed In</div>
          <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 24, lineHeight: 1.5 }}>Sign in to track your stats and game history.</div>
          {onAuthOpen && (
            <button onClick={onAuthOpen} style={{
              background: C.red, color: '#fff', border: 'none', borderRadius: 12,
              padding: '14px 32px', fontWeight: 800, fontSize: 16, cursor: 'pointer', width: '100%',
            }}>Sign In / Register</button>
          )}
        </div>
      </div>
    );
  }

  const totalGames = user.totalWins + user.totalLosses;
  const winRate = totalGames > 0 ? Math.round((user.totalWins / totalGames) * 100) : 0;
  const { tier, next: nextTier, pct: vipPct } = getVip(user.totalWagered);
  const initials = user.username.slice(0, 2).toUpperCase();

  const biggestWin = history.reduce<number>((acc, h) => {
    if (h.status === 'cashedout' && h.payout != null) {
      const profit = h.payout - h.amount;
      return profit > acc ? profit : acc;
    }
    return acc;
  }, 0);

  const bestMult = history.reduce<number>((acc, h) => {
    if (h.cashedOutAt) { const m = parseFloat(h.cashedOutAt); return m > acc ? m : acc; }
    return acc;
  }, 0);

  const visibleHistory = showAll ? history : history.slice(0, 8);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 40px', color: '#fff' }}>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 68, height: 68, borderRadius: 34, flexShrink: 0,
          background: `linear-gradient(135deg, ${tier.color}88, ${tier.color}33)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 8,
            paddingInline: 8, paddingBlock: 3, marginTop: 6,
            backgroundColor: tier.color + '22', border: `1px solid ${tier.color}55`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: tier.color }}>🏆 {tier.label}</span>
          </div>
        </div>
        <div style={{
          width: 58, height: 58, borderRadius: 29, flexShrink: 0,
          border: `2px solid ${C.green}55`, backgroundColor: C.green + '18',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{winRate}%</div>
          <div style={{ fontSize: 8, color: C.textMuted }}>WIN</div>
        </div>
      </div>

      {/* ── Balance card ─────────────────────────────────────────── */}
      <div style={{
        borderRadius: 16, border: '1px solid rgba(255,215,0,0.2)',
        background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,215,0,0.04))',
        padding: 16, marginBottom: 12,
      }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: C.textMuted, letterSpacing: 2 }}>WALLET BALANCE</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: C.gold, marginTop: 4 }}>₹{user.balance.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>Total wagered: {fmt(user.totalWagered)}</div>
      </div>

      {/* ── VIP Progress ─────────────────────────────────────────── */}
      <div style={{ backgroundColor: C.bgCard, borderRadius: 14, padding: 14, marginBottom: 16, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: tier.color }}>🏆 {tier.label}</span>
          </div>
          {nextTier && (
            <span style={{ fontSize: 11, color: C.textMuted }}>
              {fmt(nextTier.min - user.totalWagered)} to <span style={{ color: nextTier.color }}>{nextTier.label}</span>
            </span>
          )}
        </div>
        <div style={{ height: 7, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: `linear-gradient(90deg, ${tier.color}, ${nextTier?.color ?? tier.color})`,
            width: `${Math.round(vipPct * 100)}%`, transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ fontSize: 10, color: C.textDim, marginTop: 5, textAlign: 'right' }}>{Math.round(vipPct * 100)}% to next tier</div>
      </div>

      {/* ── Stats Grid ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <StatCard label="Total Games" value={totalGames.toString()} color={C.red} icon="🎮" />
        <StatCard label="Wins" value={user.totalWins.toString()} color={C.green} icon="📈" />
        <StatCard label="Best Mult" value={bestMult > 0 ? `${bestMult.toFixed(2)}×` : '—'} color={C.gold} icon="🚀" />
        <StatCard label="Biggest Win" value={biggestWin > 0 ? fmt(biggestWin) : '—'} color={C.orange} icon="🏆" />
      </div>

      {/* ── Game History ─────────────────────────────────────────── */}
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 2, marginBottom: 10 }}>GAME HISTORY</div>
      <div style={{ backgroundColor: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, marginBottom: 20, overflow: 'hidden' }}>
        {histLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Loading history…</div>
        ) : history.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎮</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#ccc' }}>No games played yet</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Start playing to see your history here</div>
          </div>
        ) : (
          <>
            {visibleHistory.map((item, i) => (
              <HistoryRow key={item.betId} item={item} last={i === visibleHistory.length - 1} />
            ))}
            {history.length > 8 && (
              <button onClick={() => setShowAll(p => !p)} style={{
                width: '100%', padding: '12px', background: 'none', border: 'none',
                borderTop: `1px solid ${C.border}`, color: C.red,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
                {showAll ? 'Show Less ↑' : `Show All (${history.length}) ↓`}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Account menu ─────────────────────────────────────────── */}
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 2, marginBottom: 10 }}>ACCOUNT</div>
      <div style={{ backgroundColor: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 20 }}>
        {[
          { icon: '🔒', label: 'Change Password', color: C.red, action: () => setShowPwModal(true) },
          { icon: '⚙️', label: 'Admin Panel', color: '#FF6B00', action: () => window.open('/api/admin', '_blank') },
          { icon: '💬', label: 'Support', color: C.green, action: () => alert('Contact us at support@blazeapp.in\nWhatsApp: +91 99999 99999') },
          { icon: 'ℹ️', label: 'About', color: C.textMuted, action: () => alert('Blaze v1.0.0\nPremium Crash Game by Star Games\n\n© 2025 Star Games') },
          { icon: '🚪', label: 'Sign Out', color: C.red, action: () => { if (confirm('Are you sure you want to sign out?')) logout(); }, isLast: true },
        ].map((item, i, arr) => (
          <React.Fragment key={i}>
            <button onClick={item.action} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: i === arr.length - 1 ? C.red : '#fff' }}>{item.label}</span>
              <span style={{ color: C.textDim, fontSize: 16 }}>›</span>
            </button>
            {i < arr.length - 1 && <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginLeft: 64 }} />}
          </React.Fragment>
        ))}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: C.textDim }}>
        Blaze v1.0.0 by Star Games  ·  © 2025
        <br />
        <a
          href="/api/admin"
          style={{ color: 'rgba(255,26,58,0.3)', fontSize: 10, textDecoration: 'none', marginTop: 6, display: 'inline-block', letterSpacing: 1 }}
        >
          admin
        </a>
      </div>

      {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
    </div>
  );
}
