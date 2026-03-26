import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { makeId } from '../lib/utils';
import { WSC, wsSend, Phase } from '../lib/wsClient';

const HISTORY_ITEMS = [2.14, 1.01, 8.56, 3.22, 1.01, 15.4, 2.87, 1.01, 4.12, 1.01, 22.8, 1.01, 1.63, 5.5, 1.01];

const STARS = Array.from({ length: 180 }, () => ({
  x: Math.random(), y: Math.random(),
  r: Math.random() * 1.6 + 0.4,
  blink: Math.random() * Math.PI * 2,
  speed: Math.random() * 2 + 1,
}));

function calcMult(elapsedSec: number): number {
  return Math.floor(Math.pow(Math.E, 0.077 * elapsedSec) * 100) / 100;
}

function getPos(elapsed: number, mult: number, W: number, H: number) {
  const tX = Math.min(elapsed / 22, 1);
  const x = W * 0.09 + tX * W * 0.82;
  const tY = Math.min(Math.log(Math.max(mult, 1)) / Math.log(28), 1);
  const y = H * 0.88 - tY * H * 0.80;
  return { x, y };
}

function drawRocket(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, t: number, fading: boolean, waiting: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  if (fading) ctx.globalAlpha = Math.max(0, 1 - (t % 2));

  const S = 30;
  const showFlame = !fading;

  if (showFlame) {
    const osc  = 0.6 + 0.4 * Math.sin(t * 14);
    const osc2 = 0.5 + 0.5 * Math.sin(t * 9 + 1.5);
    const fScale = waiting ? 0.45 : 1.0;
    const fReach = waiting ? 0.95 : 1.6;
    ctx.shadowColor = '#FF6B00'; ctx.shadowBlur = waiting ? 10 : 20;
    ctx.fillStyle = `rgba(255,80,0,${(0.65 + 0.35 * osc) * (waiting ? 0.65 : 1)})`;
    ctx.beginPath(); ctx.ellipse(-S * fReach * osc, 0, S * 0.55 * osc * fScale, S * 0.26 * fScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,200,0,${0.75 * (waiting ? 0.55 : 1)})`;
    ctx.beginPath(); ctx.ellipse(-S * (waiting ? 0.78 : 1.3) * osc2, 0, S * 0.32 * osc2 * fScale, S * 0.16 * fScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,0.9)';
    ctx.beginPath(); ctx.ellipse(-S * (waiting ? 0.62 : 1.05), 0, S * 0.15 * fScale, S * 0.08 * fScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = '#D43050';
  ctx.beginPath(); ctx.moveTo(-S * 0.25, -S * 0.3); ctx.lineTo(-S * 0.78, -S * 0.65); ctx.lineTo(-S * 0.55, -S * 0.3); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-S * 0.25,  S * 0.3); ctx.lineTo(-S * 0.78,  S * 0.65); ctx.lineTo(-S * 0.55,  S * 0.3); ctx.closePath(); ctx.fill();

  const bg = ctx.createLinearGradient(0, -S * 0.32, 0, S * 0.32);
  bg.addColorStop(0, '#C8CED8'); bg.addColorStop(0.45, '#F0F2F8'); bg.addColorStop(1, '#9098A8');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(-S * 0.8, -S * 0.3, S * 1.1, S * 0.6, S * 0.14); ctx.fill();

  ctx.fillStyle = '#EE1133';
  ctx.beginPath(); ctx.rect(-S * 0.18, -S * 0.3, S * 0.22, S * 0.6); ctx.fill();

  ctx.fillStyle = '#CC1133';
  ctx.beginPath(); ctx.moveTo(S * 0.85, 0); ctx.lineTo(S * 0.3, -S * 0.3); ctx.lineTo(S * 0.3, S * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,100,130,0.4)';
  ctx.beginPath(); ctx.moveTo(S * 0.85, 0); ctx.lineTo(S * 0.3, -S * 0.3); ctx.lineTo(S * 0.62, -S * 0.1); ctx.closePath(); ctx.fill();

  ctx.shadowColor = '#88CCFF'; ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(80,160,255,0.35)';
  ctx.beginPath(); ctx.arc(S * 0.18, 0, S * 0.17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(S * 0.12, -S * 0.06, S * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#484E60';
  ctx.beginPath(); ctx.roundRect(-S * 0.82, -S * 0.18, S * 0.18, S * 0.36, 3); ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; r: number; color: string; ray?: boolean; ox?: number; oy?: number; };

export default function CrashGame() {
  const { state, navigate, addHistory, addNotification } = useGame();
  const [, setTick] = useState(0);
  const [betAmount, setBetAmount] = useState(100);
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [resultMsg, setResultMsg] = useState<{ text: string; win: boolean } | null>(null);

  const betRef       = useRef(100);
  const hasActiveRef = useRef(false);
  const cashedRef    = useRef<number | null>(null);
  const prevPhaseRef = useRef<Phase>(WSC.state.phase);
  const addHistRef   = useRef(addHistory);
  const addNotifRef  = useRef(addNotification);
  const stateRef     = useRef(state);
  const betAmtRef    = useRef(betAmount);

  useEffect(() => {
    addHistRef.current = addHistory;
    addNotifRef.current = addNotification;
    stateRef.current = state;
  });

  // Subscribe to WebSocket state (re-renders + phase transitions + auto-cashout)
  useEffect(() => {
    const update = () => {
      const newPhase = WSC.state.phase;
      const oldPhase = prevPhaseRef.current;

      if (oldPhase !== newPhase) {
        if (oldPhase === 'crashed' && newPhase === 'waiting') {
          cashedRef.current = null; setCashedOutAt(null);
          setTimeout(() => setResultMsg(null), 1500);
        }
        prevPhaseRef.current = newPhase;
      }
      setTick(n => n + 1);
    };
    WSC.listeners.add(update);
    return () => { WSC.listeners.delete(update); };
  }, []);

  // Handle server messages (bet results, cashout results, crash)
  useEffect(() => {
    const handler = (msg: Record<string, unknown>) => {
      if (msg.type === 'bet_ok') {
        // Bet placed OK — nothing extra needed (balance updated via GameContext listener)
      }
      if (msg.type === 'bet_fail') {
        setResultMsg({ text: String(msg.error ?? 'Bet failed'), win: false });
        hasActiveRef.current = false; setHasActiveBet(false);
      }
      if (msg.type === 'cashout_ok') {
        const mult = msg.mult as number;
        const payout = msg.payout as number;
        cashedRef.current = mult; setCashedOutAt(mult);
        hasActiveRef.current = false; setHasActiveBet(false);
        const profit = payout - betAmtRef.current;
        setResultMsg({ text: `Cashed out at ${mult.toFixed(2)}x! +₹${profit.toLocaleString()}`, win: true });
        addNotifRef.current(`✈️ Cashed out at ${mult.toFixed(2)}x! +₹${profit.toLocaleString()}`, 'win');
        if (stateRef.current.user)
          addHistRef.current({ id: makeId(), game: 'crash', wager: betAmtRef.current, multiplier: mult, payout, won: true, timestamp: Date.now() });
      }
      if (msg.type === 'cashout_fail') {
        setResultMsg({ text: String(msg.error ?? 'Cashout failed'), win: false });
      }
      if (msg.type === 'bet_crash') {
        const mult = msg.mult as number;
        setResultMsg({ text: `Flew away at ${mult.toFixed(2)}x! Lost ₹${betAmtRef.current.toLocaleString()}`, win: false });
        hasActiveRef.current = false; setHasActiveBet(false);
        if (stateRef.current.user)
          addHistRef.current({ id: makeId(), game: 'crash', wager: betAmtRef.current, multiplier: mult, payout: 0, won: false, timestamp: Date.now() });
      }
    };
    WSC.msgListeners.add(handler);
    return () => { WSC.msgListeners.delete(handler); };
  }, []);

  // Canvas animation loop — reads WSC.state directly (no stale closure)
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const animRef      = useRef(0);
  const smoothAngRef = useRef(-0.3);
  const lastElRef    = useRef(0);
  const crashPosRef  = useRef({ x: 0, y: 0 });
  const crashTimeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const cvPrevPhase  = useRef<Phase>(WSC.state.phase);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const ORIG_X = W * 0.09, ORIG_Y = H * 0.88;
    const EXP_COLORS = ['#FF8800', '#FF4400', '#FFCC00', '#FF2200', '#FFE080', '#FFFFFF'];
    const RAY_COLORS = ['#FFFFFF', '#FFD700', '#FF6B00', '#FF3A3A', '#FFB800', '#FF9500', '#FFEE80', '#FF5500', '#FFD000', '#FFAAAA'];

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const now = Date.now();
      const t = now / 1000;
      const { phase, mult: m, startTime, countdown } = WSC.state;
      const isFlying  = phase === 'flying';
      const isCrashed = phase === 'crashed';
      const isWaiting = phase === 'waiting';

      const elapsed = isFlying ? (now - startTime) / 1000 : lastElRef.current;
      if (isFlying) { lastElRef.current = elapsed; crashPosRef.current = getPos(elapsed, m, W, H); }
      if (isWaiting) { lastElRef.current = 0; smoothAngRef.current = -0.22; }

      if (cvPrevPhase.current === 'flying' && phase === 'crashed') {
        crashTimeRef.current = now;
        const cp = crashPosRef.current;
        for (let i = 0; i < 22; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 1.5 + Math.random() * 5;
          particlesRef.current.push({ x: cp.x, y: cp.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2, life: 1, r: 1.5 + Math.random() * 2.5, color: EXP_COLORS[Math.floor(Math.random() * EXP_COLORS.length)] });
        }
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2;
          const spd = 3.5 + Math.random() * 3;
          particlesRef.current.push({ x: cp.x, y: cp.y, ox: cp.x, oy: cp.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, r: 0, color: RAY_COLORS[i % RAY_COLORS.length], ray: true });
        }
      }
      if (isWaiting) particlesRef.current = [];
      cvPrevPhase.current = phase;

      // SKY
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#04000C'); sky.addColorStop(0.4, '#08000F');
      sky.addColorStop(0.75, '#0C0015'); sky.addColorStop(1, '#100018');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // STARS
      STARS.forEach(s => {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed + s.blink));
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H * 0.85, s.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // MOON
      const mX = W * 0.88, mY = H * 0.09;
      ctx.shadowColor = 'rgba(200,220,255,0.35)'; ctx.shadowBlur = 28;
      ctx.fillStyle = '#F0F0D8';
      ctx.beginPath(); ctx.arc(mX, mY, 24, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200,200,190,0.45)';
      [[mX - 7, mY - 5, 4.5], [mX + 6, mY + 7, 3.5], [mX - 3, mY + 8, 2.5]].forEach(([mx, my, mr]) => {
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = 'rgba(2,8,20,0.38)';
      ctx.beginPath(); ctx.arc(mX + 7, mY, 22, 0, Math.PI * 2); ctx.fill();

      // CLOUDS
      [[0.12, 0.28, 80, 0.10], [0.46, 0.20, 65, 0.07], [0.78, 0.26, 75, 0.09]].forEach(([rx, ry, rs, ra]) => {
        ctx.globalAlpha = ra;
        ctx.fillStyle = '#8AAABB';
        ctx.beginPath(); ctx.arc(rx * W, ry * H, rs, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx * W + 50, ry * H + 8, rs * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx * W - 45, ry * H + 10, rs * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      // CITY GLOW
      const cg = ctx.createLinearGradient(0, H * 0.83, 0, H);
      cg.addColorStop(0, 'rgba(30,70,120,0)'); cg.addColorStop(1, 'rgba(40,80,140,0.28)');
      ctx.fillStyle = cg; ctx.fillRect(0, H * 0.83, W, H * 0.17);
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 55; i++) {
        ctx.fillStyle = ['#FFE080', '#FF9040', '#80C8FF', '#FFFFFF'][(i * 7) % 4];
        ctx.fillRect((i * 137.5) % W, H * 0.87 + (i * 23.7) % (H * 0.11), 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      // FLIGHT PATH
      if (isFlying || isCrashed) {
        const drawEl = elapsed;
        const N = 90;

        ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(255,80,0,0.3)'; ctx.lineWidth = 10;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(ORIG_X, ORIG_Y);
        for (let i = 1; i <= N; i++) { const ft = drawEl * (i / N); const p = getPos(ft, calcMult(ft), W, H); ctx.lineTo(p.x, p.y); }
        ctx.stroke();

        ctx.shadowBlur = 8;
        ctx.strokeStyle = 'rgba(255,140,20,0.65)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(ORIG_X, ORIG_Y);
        for (let i = 1; i <= N; i++) { const ft = drawEl * (i / N); const p = getPos(ft, calcMult(ft), W, H); ctx.lineTo(p.x, p.y); }
        ctx.stroke();

        ctx.shadowBlur = 3;
        ctx.strokeStyle = '#FFCC44'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ORIG_X, ORIG_Y);
        for (let i = 1; i <= N; i++) { const ft = drawEl * (i / N); const p = getPos(ft, calcMult(ft), W, H); ctx.lineTo(p.x, p.y); }
        ctx.stroke(); ctx.shadowBlur = 0;

        ctx.fillStyle = '#FFCC44'; ctx.shadowColor = '#FF8800'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(ORIG_X, ORIG_Y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        const curPt = getPos(drawEl, m, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.font = 'bold 11px Inter,sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        [2, 5, 10, 25].forEach(mv => {
          if (m >= mv) {
            let gt = 0;
            for (let s = 0; s < 400; s++) { if (calcMult(s * 0.1) >= mv) { gt = s * 0.1; break; } }
            const gp = getPos(gt, mv, W, H);
            ctx.beginPath(); ctx.moveTo(ORIG_X, gp.y); ctx.lineTo(curPt.x + 8, gp.y); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillText(`${mv}x`, ORIG_X - 4, gp.y);
          }
        });
        ctx.setLineDash([]);
      }

      // PLANE
      const pos = (isFlying || isCrashed) ? getPos(elapsed, m, W, H) : { x: ORIG_X, y: ORIG_Y };
      if (!isWaiting) {
        const dT = 0.25;
        const pA = getPos(Math.max(elapsed - dT, 0), calcMult(Math.max(elapsed - dT, 0.001)), W, H);
        const pB = getPos(elapsed + dT, calcMult(elapsed + dT), W, H);
        const rawAng = Math.atan2(pB.y - pA.y, pB.x - pA.x);
        smoothAngRef.current += (rawAng - smoothAngRef.current) * 0.08;
      }
      let angle = smoothAngRef.current;
      if (isCrashed) angle += ((now - crashTimeRef.current) / 1000) * 3.5;

      if (isFlying) {
        const cG = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 26);
        cG.addColorStop(0, 'rgba(180,210,255,0.18)'); cG.addColorStop(1, 'rgba(180,210,255,0)');
        ctx.fillStyle = cG;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 26, 0, Math.PI * 2); ctx.fill();
      }
      drawRocket(ctx, pos.x, pos.y, isWaiting ? -0.22 : angle, t, isCrashed, isWaiting);

      // EXPLOSION PARTICLES
      particlesRef.current = particlesRef.current.filter(p => p.life > 0).map(p => {
        const shimmer = 0.65 + 0.35 * Math.abs(Math.sin(now / 55 + p.x * 0.05 + p.y * 0.03));
        if (p.ray) {
          p.x += p.vx * 0.88; p.y += p.vy * 0.88; p.life -= 0.035;
          ctx.globalAlpha = p.life * shimmer;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * p.life;
          ctx.lineCap = 'round';
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12 + 10 * shimmer;
          ctx.beginPath();
          ctx.moveTo(p.ox!, p.oy!);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        } else {
          p.x += p.vx; p.y += p.vy; p.vy += 0.10; p.vx *= 0.97; p.r *= 0.97; p.life -= 0.022;
          ctx.globalAlpha = p.life * shimmer;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8 + 8 * shimmer;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }
        return p;
      });

      // HUD
      if (isFlying) {
        const mColor = m >= 10 ? '#FF4DFF' : m >= 2 ? '#4DA6FF' : '#FF3A3A';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 100, 14, 200, 68, 14); ctx.fill();
        ctx.strokeStyle = mColor + 'AA'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(W / 2 - 100, 14, 200, 68, 14); ctx.stroke();
        ctx.font = 'bold 54px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = mColor;
        ctx.fillText(`${m.toFixed(2)}x`, W / 2, 20);

      } else if (isWaiting) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 130, 14, 260, 66, 14); ctx.fill();
        ctx.font = 'bold 12px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#664466'; ctx.fillText('NEXT ROUND IN', W / 2, 20);
        ctx.font = 'bold 36px Inter,sans-serif';
        ctx.fillStyle = '#FF3A3A';
        ctx.fillText(`${countdown}s`, W / 2, 36);

      } else if (isCrashed) {
        const ct = Math.min((now - crashTimeRef.current) / 1000 * 3, 1);
        ctx.globalAlpha = ct;
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 140, H / 2 - 48, 280, 96, 16); ctx.fill();
        ctx.font = 'bold 42px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FF3A3A';
        ctx.fillText('💥 BLAST!', W / 2, H / 2 - 12);
        ctx.font = 'bold 20px Inter,sans-serif'; ctx.fillStyle = '#FF8888';
        ctx.fillText(`${m.toFixed(2)}x`, W / 2, H / 2 + 26);
        ctx.globalAlpha = 1;
      }

      // CONNECTION indicator
      if (!WSC.state.connected) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 20px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FF3344'; ctx.fillText('Reconnecting…', W / 2, H / 2);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  function placeBet() {
    if (!state.user) { navigate('profile'); return; }
    if (WSC.state.phase !== 'waiting') { return; }
    if (hasActiveRef.current) return;
    betAmtRef.current = betAmount;
    hasActiveRef.current = true; setHasActiveBet(true);
    wsSend({ type: 'place_bet', amount: betAmount, autoCashout });
  }

  function cashOut() {
    if (!hasActiveRef.current || WSC.state.phase !== 'flying' || cashedRef.current) return;
    wsSend({ type: 'cashout' });
  }

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { phase, mult: m, countdown, history, bots } = WSC.state;
  const displayHistory = history.length > 0 ? history : HISTORY_ITEMS;
  const multColor = phase === 'crashed' ? 'var(--neon-red)' : m >= 5 ? 'var(--neon-green)' : m >= 2 ? 'var(--neon-gold)' : 'var(--neon-blue)';

  const BetControls = () => (
    <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: isMobile ? '16px' : '24px' }}>
      {!isMobile && <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>🎯 Place Bet</h3>}

      <label style={{ display: 'block', color: 'var(--text3)', fontSize: '11px', fontWeight: 700, marginBottom: '6px', letterSpacing: '1px' }}>BET AMOUNT</label>
      <input type="number" value={betAmount}
        onChange={e => { const v = Number(e.target.value); setBetAmount(v); betRef.current = v; betAmtRef.current = v; }}
        disabled={phase !== 'waiting'}
        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '11px 14px', color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '14px' }}>
        {[100, 250, 500, 1000].map(v => (
          <button key={v} onClick={() => { setBetAmount(v); betRef.current = v; betAmtRef.current = v; }} disabled={phase !== 'waiting'}
            style={{ background: betAmount === v ? 'var(--primary)22' : 'var(--bg3)', border: `1px solid ${betAmount === v ? 'var(--primary)' : 'var(--border)'}`, color: betAmount === v ? 'var(--primary)' : 'var(--text2)', borderRadius: '8px', padding: '8px 4px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{v}</button>
        ))}
      </div>

      <label style={{ display: 'block', color: 'var(--text3)', fontSize: '11px', fontWeight: 700, marginBottom: '6px', letterSpacing: '1px' }}>AUTO CASHOUT</label>
      <input type="number" value={autoCashout} step="0.1" min="1.1"
        onChange={e => setAutoCashout(Number(e.target.value))}
        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '11px 14px', color: 'var(--text)', fontSize: '15px', fontWeight: 700, marginBottom: '16px' }} />

      {!hasActiveBet ? (
        <button onClick={placeBet} disabled={phase !== 'waiting'}
          style={{ width: '100%', background: phase === 'waiting' ? 'linear-gradient(135deg,var(--primary),#FF7050)' : 'var(--bg3)', color: phase === 'waiting' ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 'var(--radius)', padding: '15px', fontWeight: 800, fontSize: '16px', cursor: phase === 'waiting' ? 'pointer' : 'not-allowed', letterSpacing: '0.3px' }}>
          {phase === 'waiting' ? `🚀 Launch ₹${betAmount.toLocaleString()}` : phase === 'flying' ? '⏳ Round in progress…' : '💥 Wait for next round…'}
        </button>
      ) : (
        <button onClick={cashOut} disabled={phase !== 'flying' || !!cashedOutAt}
          style={{ width: '100%', background: !cashedOutAt && phase === 'flying' ? 'var(--neon-green)' : 'var(--bg3)', color: !cashedOutAt && phase === 'flying' ? '#000' : 'var(--text2)', border: 'none', borderRadius: 'var(--radius)', padding: '15px', fontWeight: 800, fontSize: '16px', cursor: !cashedOutAt && phase === 'flying' ? 'pointer' : 'not-allowed' }}>
          {cashedOutAt ? `✅ Exited at ${cashedOutAt.toFixed(2)}x` : `🪂 Eject! ₹${Math.floor(betAmount * m).toLocaleString()}`}
        </button>
      )}

      {phase === 'flying' && (
        <div style={{ marginTop: '12px', padding: '12px', borderRadius: '12px', textAlign: 'center', background: 'var(--bg3)', border: `1px solid ${multColor}40` }}>
          <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>ALTITUDE</div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: multColor, lineHeight: 1 }}>{m.toFixed(2)}x</div>
          {hasActiveBet && !cashedOutAt && <div style={{ color: 'var(--neon-green)', fontSize: '13px', fontWeight: 700, marginTop: '4px' }}>→ ₹{Math.floor(betAmount * m).toLocaleString()}</div>}
        </div>
      )}
      {phase === 'waiting' && (
        <div style={{ marginTop: '12px', padding: '12px', borderRadius: '12px', textAlign: 'center', background: 'var(--bg3)', border: '1px solid var(--primary)30' }}>
          <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>NEXT ROUND</div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{countdown}s</div>
        </div>
      )}

      {state.user ? (
        <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text3)', fontSize: '12px' }}>Balance</span>
          <span style={{ fontWeight: 800, color: 'var(--neon-gold)', fontSize: '15px' }}>₹{state.user.balance.toLocaleString('en-IN')}</span>
        </div>
      ) : (
        <button onClick={() => navigate('profile')}
          style={{ marginTop: '10px', width: '100%', background: 'rgba(255,58,58,0.08)', border: '1px solid rgba(255,58,58,0.25)', borderRadius: '10px', padding: '11px', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>
          🔐 Login to bet with real balance
        </button>
      )}
    </div>
  );

  return (
    <div style={{ padding: isMobile ? '0' : '24px', maxWidth: '1200px', margin: '0 auto', animation: 'slideIn 0.3s ease' }}>

      {/* History strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '10px 12px' : '0 0 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {!isMobile && <span style={{ fontWeight: 900, fontSize: '18px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>🚀 BLAZE</span>}
        {!isMobile && WSC.state.connected && <span style={{ background: 'rgba(0,204,102,0.12)', color: 'var(--neon-green)', borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(0,204,102,0.25)', whiteSpace: 'nowrap' }}>● LIVE</span>}
        {displayHistory.slice(0, isMobile ? 10 : 14).map((v, i) => (
          <div key={i} style={{ flexShrink: 0, background: v <= 1.5 ? 'rgba(255,58,58,0.15)' : v >= 10 ? 'rgba(255,215,0,0.15)' : 'rgba(0,204,102,0.12)', color: v <= 1.5 ? 'var(--neon-red)' : v >= 10 ? 'var(--neon-gold)' : 'var(--neon-green)', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>{v.toFixed(2)}x</div>
        ))}
      </div>

      {isMobile ? (
        /* ─── MOBILE LAYOUT ─── */
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Canvas */}
          <div style={{ background: '#04000C', borderTop: '1px solid #2A0A20', borderBottom: '1px solid #2A0A20' }}>
            <canvas ref={canvasRef} width={720} height={400} style={{ width: '100%', display: 'block' }} />
          </div>

          {resultMsg && (
            <div style={{ margin: '0 12px 0', padding: '12px 16px', borderRadius: '0 0 var(--radius) var(--radius)', background: resultMsg.win ? 'rgba(0,204,102,0.12)' : 'rgba(255,58,58,0.12)', border: `1px solid ${resultMsg.win ? 'var(--neon-green)' : 'var(--neon-red)'}40`, color: resultMsg.win ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 700, fontSize: '16px', textAlign: 'center' }}>
              {resultMsg.win ? '✅' : '💥'} {resultMsg.text}
            </div>
          )}

          {/* Bet Panel */}
          <div style={{ padding: '12px' }}>
            <BetControls />
          </div>

          {/* Live Bets compact */}
          <div style={{ margin: '0 12px 12px', background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>👥 Live Bets</span>
              <span style={{ color: 'var(--text3)', fontSize: '12px' }}>{bots.length + (hasActiveBet ? 1 : 0)} players</span>
            </div>
            <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
              {hasActiveBet && (
                <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{state.user?.username ?? 'You'}</span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)', fontSize: '12px' }}>₹{betAmount.toLocaleString()}</span>
                    {cashedOutAt ? <span style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '12px' }}>✅ {cashedOutAt.toFixed(2)}x</span>
                      : <span style={{ color: 'var(--neon-blue)', fontSize: '11px' }}>Flying…</span>}
                  </div>
                </div>
              )}
              {bots.slice(0, 5).map((b, i) => (
                <div key={i} style={{ padding: '9px 16px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{b.user}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)', fontSize: '12px' }}>₹{b.amount.toLocaleString()}</span>
                    {b.status === 'cashed'  && <span style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '12px' }}>✅ {b.cashout?.toFixed(2)}x</span>}
                    {b.status === 'crashed' && <span style={{ color: 'var(--neon-red)', fontWeight: 700, fontSize: '12px' }}>💥</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ─── DESKTOP LAYOUT ─── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
          {/* Left: Canvas + Live Bets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#04000C', borderRadius: 'var(--radius-lg)', border: '1px solid #2A0A20', overflow: 'hidden' }}>
              <canvas ref={canvasRef} width={720} height={380} style={{ width: '100%', display: 'block' }} />
            </div>

            {resultMsg && (
              <div style={{ padding: '14px 20px', borderRadius: 'var(--radius)', background: resultMsg.win ? 'rgba(0,204,102,0.12)' : 'rgba(255,58,58,0.12)', border: `1px solid ${resultMsg.win ? 'var(--neon-green)' : 'var(--neon-red)'}40`, color: resultMsg.win ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 700, fontSize: '18px', textAlign: 'center', animation: 'scaleIn 0.3s ease' }}>
                {resultMsg.win ? '✅' : '💥'} {resultMsg.text}
              </div>
            )}

            <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>👥 Live Bets</span>
                <span style={{ color: 'var(--text3)', fontSize: '13px' }}>{bots.length + (hasActiveBet ? 1 : 0)} players</span>
              </div>
              <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                {hasActiveBet && (
                  <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(77,166,255,0.04)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cashedOutAt ? 'var(--neon-green)' : 'var(--neon-blue)', animation: 'pulse 1.5s infinite' }} />
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{state.user?.username ?? 'You'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text2)', fontSize: '13px' }}>₹{betAmount.toLocaleString()}</span>
                      {cashedOutAt ? <span style={{ color: 'var(--neon-green)', fontWeight: 700 }}>✅ {cashedOutAt.toFixed(2)}x</span>
                        : <span style={{ color: 'var(--neon-blue)', fontSize: '12px' }}>In flight…</span>}
                    </div>
                  </div>
                )}
                {bots.map((b, i) => (
                  <div key={i} style={{ padding: '10px 18px', borderBottom: i < bots.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.status === 'crashed' ? 'var(--neon-red)' : b.status === 'cashed' ? 'var(--neon-green)' : 'var(--neon-blue)', animation: b.status === 'active' ? 'pulse 1.5s infinite' : 'none' }} />
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{b.user}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text2)', fontSize: '13px' }}>₹{b.amount.toLocaleString()}</span>
                      {b.status === 'cashed'  && <span style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '13px' }}>✅ {b.cashout?.toFixed(2)}x</span>}
                      {b.status === 'crashed' && <span style={{ color: 'var(--neon-red)', fontWeight: 700, fontSize: '13px' }}>💥 Lost</span>}
                      {b.status === 'active'  && <span style={{ color: 'var(--neon-blue)', fontSize: '12px' }}>Flying…</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Controls + History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <BetControls />
            <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '18px' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '12px', fontSize: '13px', color: 'var(--text3)', letterSpacing: '1px' }}>🏁 HISTORY</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {displayHistory.map((v, i) => (
                  <div key={i} style={{ background: v <= 1.5 ? 'rgba(255,58,58,0.15)' : v >= 10 ? 'rgba(255,215,0,0.15)' : 'rgba(0,204,102,0.12)', color: v <= 1.5 ? 'var(--neon-red)' : v >= 10 ? 'var(--neon-gold)' : 'var(--neon-green)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 700 }}>{v.toFixed(2)}x</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
