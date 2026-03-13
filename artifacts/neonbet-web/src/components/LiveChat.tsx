import { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const SAMPLE_MSGS = [
  { user: 'CryptoKing', msg: 'Just hit 24x on Crash 🔥', time: '12:34' },
  { user: 'NeonBlade', msg: 'Mines is way too addictive lol', time: '12:35' },
  { user: 'StarDust', msg: 'gg everyone, cashing out early saved me', time: '12:35' },
  { user: 'ShadowWolf', msg: 'Plinko multi ball is insane', time: '12:36' },
  { user: 'Support', msg: '👋 Welcome to NeonBet! Need help? Ask me!', time: '12:36' },
];

const BOT_REPLIES = [
  'Sounds good! 🎮', 'Nice play!', 'GG! 🔥', 'Let\'s gooo!',
  'That\'s the spirit! 💪', 'Keep it up!', 'Big win incoming! 🤞',
  'Support here! How can I help?', 'Try Crash next — it\'s 🔥 today!',
];

export default function LiveChat() {
  const { state, toggleChat } = useGame();
  const [msgs, setMsgs] = useState(SAMPLE_MSGS);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // Random incoming messages
  useEffect(() => {
    const users = ['CryptoKing', 'NeonBlade', 'StarDust', 'ShadowWolf', 'IronFist', 'VortexX'];
    const phrases = ['wow big win!', 'crashed too early smh', 'mines cleared 5!', 'let\'s go!', 'plinko bounced perfectly 😂', 'anyone on sports?'];
    const t = setInterval(() => {
      setMsgs(prev => [...prev, {
        user: users[Math.floor(Math.random() * users.length)],
        msg: phrases[Math.floor(Math.random() * phrases.length)],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  function send() {
    if (!input.trim()) return;
    const name = state.user?.username || 'Guest';
    setMsgs(prev => [...prev, { user: name, msg: input, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInput('');
    setTimeout(() => {
      setMsgs(prev => [...prev, {
        user: 'Support',
        msg: BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    }, 1000);
  }

  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '20px', zIndex: 3000,
      background: 'var(--bg2)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)', width: '320px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.8)', animation: 'slideIn 0.3s ease',
      display: 'flex', flexDirection: 'column', height: '460px',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg3)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-green)', animation: 'pulse 1s infinite' }} />
          <span style={{ fontWeight: 700, fontSize: '14px' }}>💬 Live Chat</span>
          <span style={{ color: 'var(--text3)', fontSize: '12px' }}>({msgs.length} online)</span>
        </div>
        <button onClick={toggleChat} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '20px', cursor: 'pointer' }}>×</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {msgs.map((m, i) => {
          const isMe = state.user?.username === m.user;
          const isSupport = m.user === 'Support';
          return (
            <div key={i} style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: isSupport ? 'var(--neon-blue)30' : isMe ? 'var(--neon-green)30' : 'var(--bg4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 800,
                color: isSupport ? 'var(--neon-blue)' : isMe ? 'var(--neon-green)' : 'var(--text2)',
              }}>
                {isSupport ? '🎧' : m.user[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 700,
                    color: isSupport ? 'var(--neon-blue)' : isMe ? 'var(--neon-green)' : 'var(--text2)',
                  }}>{m.user}</span>
                  <span style={{ color: 'var(--text3)', fontSize: '10px' }}>{m.time}</span>
                </div>
                <div style={{
                  background: isMe ? 'var(--neon-green)15' : 'var(--bg3)',
                  borderRadius: '0 10px 10px 10px', padding: '8px 10px',
                  fontSize: '13px', color: 'var(--text)',
                }}>{m.msg}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={state.user ? 'Say something...' : 'Sign in to chat'}
          disabled={!state.user}
          style={{
            flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px',
          }} />
        <button onClick={send} disabled={!state.user} style={{
          background: 'var(--neon-blue)', color: '#000', border: 'none',
          borderRadius: '10px', padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '14px',
        }}>→</button>
      </div>
    </div>
  );
}
