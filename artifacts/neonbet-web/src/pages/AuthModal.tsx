import { useState } from 'react';
import { useGame } from '../context/GameContext';

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useGame();
  const [tab, setTab] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Enter your username.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setLoading(true);
    try {
      await login(username.trim(), password);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '13px 16px',
    color: 'var(--text)', fontSize: '15px', transition: 'border-color 0.2s',
    outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg2)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)', padding: '40px',
        width: '440px', animation: 'scaleIn 0.2s ease',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        position: 'relative',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🚀</div>
          <div style={{ fontWeight: 900, fontSize: '26px', letterSpacing: '-0.5px', color: 'var(--primary)' }}>
            BLAZE
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '12px', marginTop: '2px', letterSpacing: '1px' }}>by Star Games</div>
          <div style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '6px' }}>
            {tab === 'register' ? 'Create account · Get ₹10,000 free!' : 'Welcome back!'}
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: 'var(--bg3)', borderRadius: 'var(--radius)',
          padding: '4px', marginBottom: '28px', border: '1px solid var(--border)',
        }}>
          {(['register', 'login'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }} style={{
              padding: '10px', borderRadius: '9px',
              background: tab === t ? 'var(--primary)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text2)',
              fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              border: 'none', transition: 'all 0.2s',
            }}>
              {t === 'register' ? 'Register' : 'Sign In'}
            </button>
          ))}
        </div>

        <form onSubmit={tab === 'register' ? handleRegister : handleLogin}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>USERNAME</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter username" disabled={loading} style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--primary)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'}
              />
            </div>

            {tab === 'register' && (
              <div>
                <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>EMAIL</label>
                <input value={email} onChange={e => setEmail(e.target.value)}
                  type="email" placeholder="Enter email" disabled={loading} style={inputStyle}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--primary)'}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>PASSWORD</label>
              <input value={password} onChange={e => setPassword(e.target.value)}
                type="password" placeholder={tab === 'register' ? 'Min 6 characters' : 'Enter password'}
                disabled={loading} style={inputStyle}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'var(--primary)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--border)'}
              />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: '14px', padding: '12px 16px',
              background: 'var(--neon-red)15', border: '1px solid var(--neon-red)40',
              borderRadius: 'var(--radius)', color: 'var(--neon-red)', fontSize: '14px', fontWeight: 600,
            }}>⚠️ {error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', background: loading ? 'var(--bg3)' : 'var(--primary)', color: loading ? 'var(--text3)' : '#fff',
            border: 'none', borderRadius: 'var(--radius)', padding: '16px',
            fontWeight: 800, fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '20px', letterSpacing: '0.5px',
          }}>
            {loading ? '⏳ Please wait…' : tab === 'register' ? '🚀 Create Account & Play!' : '🔥 Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '12px', marginTop: '20px' }}>
          For entertainment only · Play responsibly
        </p>

        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '20px',
          background: 'none', border: 'none', color: 'var(--text3)',
          fontSize: '22px', cursor: 'pointer', lineHeight: 1,
        }}>×</button>
      </div>
    </div>
  );
}
