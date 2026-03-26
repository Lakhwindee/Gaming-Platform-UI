import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { makeId } from '../lib/utils';
import { WSC, wsSend, Phase, RoundBet, TopBet } from '../lib/wsClient';

const AVATAR_COLORS = ['#E53935','#8E24AA','#1E88E5','#00ACC1','#43A047','#F4511E','#F6BF26','#6D4C41'];
const AVATAR_EMOJI  = ['🚀','🎯','💎','⚡','🔥','🎮','🏆','🦁'];

const STARS = Array.from({ length: 180 }, () => ({
  x: Math.random(), y: Math.random(),
  r: Math.random() * 1.6 + 0.4,
  speed: 0.4 + Math.random() * 1.4,
  blink: Math.random() * Math.PI * 2,
}));

function calcMult(t: number) { return Math.max(1, Math.pow(1.0006, t * 1000) * (1 + t * 0.012)); }

function getPos(t: number, _m: number, W: number, H: number) {
  const origX = W * 0.09, origY = H * 0.88;
  const maxX = W * 0.90 - origX, maxY = origY - H * 0.08;
  const prog = Math.min(1, t / 60);
  const eased = 1 - Math.pow(1 - prog, 2.6);
  return { x: origX + eased * maxX, y: origY - eased * maxY };
}

function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, t: number, crashed: boolean, waiting: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (crashed) { ctx.rotate(Math.PI * 0.4); ctx.globalAlpha = 0.35; }
  if (waiting) {
    const bob = Math.sin(t * 2.5) * 3;
    ctx.translate(0, bob);
    ctx.rotate(Math.sin(t * 1.3) * 0.04);
  }
  const S = 22;
  if (!crashed) {
    ctx.shadowColor = '#FF7700'; ctx.shadowBlur = 14;
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * S * 0.22;
      const fl = ctx.createLinearGradient(-S * 1.1 + off, 0, -S * 1.7 + off, 0);
      fl.addColorStop(0, i === 1 ? '#FFD700' : '#FF6600');
      fl.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = fl;
      ctx.beginPath(); ctx.ellipse(-S * 1.0, off, S * 0.6, S * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    }
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

type SlotStatus = 'idle' | 'placing' | 'active' | 'queued' | 'cashedout' | 'lost';
interface SlotState {
  amount: number;
  input: string;
  status: SlotStatus;
  cashedOutAt: number | null;
  result: { text: string; win: boolean } | null;
}
const mkSlot = (amt: number): SlotState => ({ amount: amt, input: String(amt), status: 'idle', cashedOutAt: null, result: null });

function multColor(m: number) { return m >= 10 ? '#FF4DFF' : m >= 2 ? '#4DA6FF' : '#FF3A3A'; }

type BetsTab = 'all' | 'prev' | 'top';

export default function CrashGame({ navigate }: { navigate: (t: string) => void }) {
  const { state, addHistory, addNotification } = useGame();
  const [, setTick] = useState(0);
  const [betsTab, setBetsTab] = useState<BetsTab>('all');

  const [slot1, setSlot1] = useState<SlotState>(mkSlot(100));
  const [slot2, setSlot2] = useState<SlotState>(mkSlot(200));

  const slot1Ref = useRef(slot1);
  const slot2Ref = useRef(slot2);
  const addHistRef   = useRef(addHistory);
  const addNotifRef  = useRef(addNotification);
  const stateRef     = useRef(state);
  const prevPhaseRef = useRef<Phase>(WSC.state.phase);

  useEffect(() => {
    slot1Ref.current = slot1;
    slot2Ref.current = slot2;
    addHistRef.current = addHistory;
    addNotifRef.current = addNotification;
    stateRef.current = state;
  });

  // Reset slots when new round starts
  useEffect(() => {
    const update = () => {
      const newPhase = WSC.state.phase;
      const oldPhase = prevPhaseRef.current;
      if (oldPhase === 'crashed' && newPhase === 'waiting') {
        setSlot1(s => s.status === 'cashedout' || s.status === 'lost' ? { ...s, status: 'idle', cashedOutAt: null, result: null } : s);
        setSlot2(s => s.status === 'cashedout' || s.status === 'lost' ? { ...s, status: 'idle', cashedOutAt: null, result: null } : s);
      }
      prevPhaseRef.current = newPhase;
      setTick(n => n + 1);
    };
    WSC.listeners.add(update);
    return () => { WSC.listeners.delete(update); };
  }, []);

  // Handle server messages
  useEffect(() => {
    const handler = (msg: Record<string, unknown>) => {
      const s = Number(msg.slot ?? 1);
      const setSlot = s === 2 ? setSlot2 : setSlot1;
      const slotRef = s === 2 ? slot2Ref : slot1Ref;

      if (msg.type === 'bet_ok') {
        setSlot(prev => ({ ...prev, status: 'active' }));
      }
      if (msg.type === 'bet_queued') {
        setSlot(prev => ({ ...prev, status: 'queued' }));
      }
      if (msg.type === 'bet_fail') {
        setSlot(prev => ({ ...prev, status: 'idle', result: { text: String(msg.error ?? 'Bet failed'), win: false } }));
        addNotifRef.current(`❌ Bet failed: ${msg.error}`, 'loss');
      }
      if (msg.type === 'cashout_ok') {
        const mult = msg.mult as number;
        const payout = msg.payout as number;
        const wager = slotRef.current.amount;
        const profit = payout - wager;
        setSlot(prev => ({ ...prev, status: 'cashedout', cashedOutAt: mult, result: { text: `Cashed out @${mult.toFixed(2)}x! +₹${profit.toLocaleString()}`, win: true } }));
        addNotifRef.current(`✈️ Cashed out at ${mult.toFixed(2)}x! +₹${profit.toLocaleString()}`, 'win');
        if (stateRef.current.user)
          addHistRef.current({ id: makeId(), game: 'crash', wager, multiplier: mult, payout, won: true, timestamp: Date.now() });
      }
      if (msg.type === 'cashout_fail') {
        setSlot(prev => ({ ...prev, result: { text: String(msg.error ?? 'Cashout failed'), win: false } }));
      }
      if (msg.type === 'bet_crash') {
        const mult = msg.mult as number;
        const wager = slotRef.current.amount;
        setSlot(prev => ({ ...prev, status: 'lost', result: { text: `Flew away @${mult.toFixed(2)}x`, win: false } }));
        if (stateRef.current.user)
          addHistRef.current({ id: makeId(), game: 'crash', wager, multiplier: mult, payout: 0, won: false, timestamp: Date.now() });
      }
    };
    WSC.msgListeners.add(handler);
    return () => { WSC.msgListeners.delete(handler); };
  }, []);

  // Canvas
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
      const { phase, mult: m, startTime } = WSC.state;
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
          const ang = Math.random() * Math.PI * 2; const spd = 1.5 + Math.random() * 5;
          particlesRef.current.push({ x: cp.x, y: cp.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2, life: 1, r: 1.5 + Math.random() * 2.5, color: EXP_COLORS[Math.floor(Math.random() * EXP_COLORS.length)] });
        }
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2; const spd = 3.5 + Math.random() * 3;
          particlesRef.current.push({ x: cp.x, y: cp.y, ox: cp.x, oy: cp.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, r: 0, color: RAY_COLORS[i % RAY_COLORS.length], ray: true });
        }
      }
      if (isWaiting) particlesRef.current = [];
      cvPrevPhase.current = phase;

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#04000C'); sky.addColorStop(0.4, '#08000F');
      sky.addColorStop(0.75, '#0C0015'); sky.addColorStop(1, '#100018');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      STARS.forEach(s => {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed + s.blink));
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H * 0.85, s.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

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

      [[0.12, 0.28, 80, 0.10], [0.46, 0.20, 65, 0.07], [0.78, 0.26, 75, 0.09]].forEach(([rx, ry, rs, ra]) => {
        ctx.globalAlpha = ra; ctx.fillStyle = '#8AAABB';
        ctx.beginPath(); ctx.arc(rx * W, ry * H, rs, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx * W + 50, ry * H + 8, rs * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx * W - 45, ry * H + 10, rs * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      const cg = ctx.createLinearGradient(0, H * 0.83, 0, H);
      cg.addColorStop(0, 'rgba(30,70,120,0)'); cg.addColorStop(1, 'rgba(40,80,140,0.28)');
      ctx.fillStyle = cg; ctx.fillRect(0, H * 0.83, W, H * 0.17);
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 55; i++) {
        ctx.fillStyle = ['#FFE080', '#FF9040', '#80C8FF', '#FFFFFF'][(i * 7) % 4];
        ctx.fillRect((i * 137.5) % W, H * 0.87 + (i * 23.7) % (H * 0.11), 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      if (isFlying || isCrashed) {
        const drawEl = elapsed; const N = 90;
        ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(255,80,0,0.3)'; ctx.lineWidth = 10;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(ORIG_X, ORIG_Y);
        for (let i = 1; i <= N; i++) { const ft = drawEl * (i / N); const p = getPos(ft, calcMult(ft), W, H); ctx.lineTo(p.x, p.y); }
        ctx.stroke();
        ctx.shadowBlur = 8; ctx.strokeStyle = 'rgba(255,140,20,0.65)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(ORIG_X, ORIG_Y);
        for (let i = 1; i <= N; i++) { const ft = drawEl * (i / N); const p = getPos(ft, calcMult(ft), W, H); ctx.lineTo(p.x, p.y); }
        ctx.stroke();
        ctx.shadowBlur = 3; ctx.strokeStyle = '#FFCC44'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ORIG_X, ORIG_Y);
        for (let i = 1; i <= N; i++) { const ft = drawEl * (i / N); const p = getPos(ft, calcMult(ft), W, H); ctx.lineTo(p.x, p.y); }
        ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFCC44'; ctx.shadowColor = '#FF8800'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(ORIG_X, ORIG_Y, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        const curPt = getPos(drawEl, m, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.font = 'bold 11px Inter,sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        [2, 5, 10, 25].forEach(mv => {
          if (m >= mv) {
            let gt = 0;
            for (let ss = 0; ss < 400; ss++) { if (calcMult(ss * 0.1) >= mv) { gt = ss * 0.1; break; } }
            const gp = getPos(gt, mv, W, H);
            ctx.beginPath(); ctx.moveTo(ORIG_X, gp.y); ctx.lineTo(curPt.x + 8, gp.y); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillText(`${mv}x`, ORIG_X - 4, gp.y);
          }
        });
        ctx.setLineDash([]);
      }

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
        ctx.fillStyle = cG; ctx.beginPath(); ctx.arc(pos.x, pos.y, 26, 0, Math.PI * 2); ctx.fill();
      }
      drawRocket(ctx, pos.x, pos.y, isWaiting ? -0.22 : angle, t, isCrashed, isWaiting);

      particlesRef.current = particlesRef.current.filter(p => p.life > 0).map(p => {
        const shimmer = 0.65 + 0.35 * Math.abs(Math.sin(now / 55 + p.x * 0.05 + p.y * 0.03));
        if (p.ray) {
          p.x += p.vx * 0.88; p.y += p.vy * 0.88; p.life -= 0.035;
          ctx.globalAlpha = p.life * shimmer; ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * p.life; ctx.lineCap = 'round';
          ctx.shadowColor = p.color; ctx.shadowBlur = 12 + 10 * shimmer;
          ctx.beginPath(); ctx.moveTo(p.ox!, p.oy!); ctx.lineTo(p.x, p.y); ctx.stroke();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        } else {
          p.x += p.vx; p.y += p.vy; p.vy += 0.10; p.vx *= 0.97; p.r *= 0.97; p.life -= 0.022;
          ctx.globalAlpha = p.life * shimmer; ctx.shadowColor = p.color; ctx.shadowBlur = 8 + 8 * shimmer;
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }
        return p;
      });

      // Altitude display
      if (isFlying || isCrashed) {
        const col = multColor(m);
        const label = isCrashed ? 'BLAST!' : `${m.toFixed(2)}x`;
        ctx.save();
        ctx.font = `bold ${isCrashed ? 34 : 52}px Inter,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = col; ctx.shadowBlur = 28;
        ctx.fillStyle = col;
        ctx.fillText(label, W / 2, H * 0.42);
        if (isCrashed) {
          ctx.font = 'bold 22px Inter,sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.shadowBlur = 0;
          ctx.fillText(`${m.toFixed(2)}x`, W / 2, H * 0.42 + 42);
        }
        ctx.shadowBlur = 0; ctx.restore();
      } else if (isWaiting) {
        const cd = WSC.state.countdown;
        ctx.save();
        ctx.font = 'bold 18px Inter,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(cd > 0 ? `Starting in ${cd.toFixed(0)}s` : 'Starting...', W / 2, H * 0.42);
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  function placeBet(slotIdx: 0 | 1) {
    if (!state.user) { navigate('profile'); return; }
    const slot = slotIdx === 0 ? slot1Ref.current : slot2Ref.current;
    if (slot.status !== 'idle') return;
    const setSlot = slotIdx === 0 ? setSlot1 : setSlot2;
    setSlot(s => ({ ...s, status: 'placing' }));
    wsSend({ type: 'place_bet', slot: slotIdx + 1, amount: slot.amount });
  }

  function cashOut(slotIdx: 0 | 1) {
    const slot = slotIdx === 0 ? slot1Ref.current : slot2Ref.current;
    if (slot.status !== 'active') return;
    wsSend({ type: 'cashout', slot: slotIdx + 1 });
  }

  function cancelBet(slotIdx: 0 | 1) {
    const slot = slotIdx === 0 ? slot1Ref.current : slot2Ref.current;
    if (slot.status !== 'queued') return;
    const setSlot = slotIdx === 0 ? setSlot1 : setSlot2;
    setSlot(s => ({ ...s, status: 'idle' }));
    wsSend({ type: 'cancel_bet', slot: slotIdx + 1 });
  }

  function setSlotAmount(slotIdx: 0 | 1, val: number) {
    const setSlot = slotIdx === 0 ? setSlot1 : setSlot2;
    const v = Math.max(10, Math.min(100000, val));
    setSlot(s => ({ ...s, amount: v, input: String(v) }));
  }

  const phase = WSC.state.phase;
  const mult  = WSC.state.mult;
  const history = WSC.state.history;
  const allBets = WSC.state.allBets ?? [];
  const betCount = WSC.state.betCount ?? 0;
  const cashedCount = WSC.state.cashedCount ?? 0;
  const totalWin = WSC.state.totalWin ?? 0;
  const prevRound = WSC.state.prevRound ?? null;
  const topBets = WSC.state.topBets ?? [];

  function renderBetPanel(slotIdx: 0 | 1) {
    const slot = slotIdx === 0 ? slot1 : slot2;
    const label = slotIdx === 0 ? 'BET 1' : 'BET 2';
    const canEdit = slot.status === 'idle';
    const isFlying = phase === 'flying' || phase === 'crashed';

    let mainBtn: React.ReactNode;
    if (slot.status === 'active') {
      mainBtn = (
        <button onClick={() => cashOut(slotIdx)} style={{
          width: '100%', padding: '13px', borderRadius: '12px', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#FF3A3A,#CC0000)',
          color: '#fff', fontWeight: 900, fontSize: '14px', letterSpacing: '0.5px',
        }}>
          CASHOUT @ {mult.toFixed(2)}x
        </button>
      );
    } else if (slot.status === 'queued') {
      mainBtn = (
        <button onClick={() => cancelBet(slotIdx)} style={{
          width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid rgba(255,200,0,0.4)', cursor: 'pointer',
          background: 'rgba(255,200,0,0.08)',
          color: '#FFD700', fontWeight: 800, fontSize: '14px',
        }}>
          ⏳ QUEUED — Cancel
        </button>
      );
    } else if (slot.status === 'cashedout') {
      mainBtn = (
        <button disabled style={{
          width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
          background: 'rgba(0,180,80,0.1)', color: '#00C853', fontWeight: 800, fontSize: '14px',
        }}>
          EXITED @ {slot.cashedOutAt?.toFixed(2)}x ✓
        </button>
      );
    } else if (slot.status === 'lost') {
      mainBtn = (
        <button disabled style={{
          width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
          background: 'rgba(255,58,58,0.08)', color: '#FF5555', fontWeight: 800, fontSize: '14px',
        }}>
          FLEW AWAY 💥
        </button>
      );
    } else {
      const canBet = !!state.user && slot.status === 'idle';
      mainBtn = (
        <button onClick={() => placeBet(slotIdx)} disabled={!canBet} style={{
          width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
          cursor: canBet ? 'pointer' : 'default',
          background: canBet
            ? (isFlying ? 'linear-gradient(135deg,#1565C0,#0D47A1)' : 'linear-gradient(135deg,#00C853,#009C41)')
            : 'rgba(40,40,60,0.4)',
          color: canBet ? '#fff' : '#556', fontWeight: 900, fontSize: '14px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
        }}>
          <span>{!state.user ? 'LOGIN TO BET' : isFlying ? `BET NEXT  ₹${slot.amount.toLocaleString('en-IN')}` : `BET  ₹${slot.amount.toLocaleString('en-IN')}`}</span>
          {isFlying && canBet && <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.8 }}>next round</span>}
        </button>
      );
    }

    return (
      <div style={{
        background: 'rgba(180,0,40,0.08)', border: '1px solid rgba(255,58,58,0.15)',
        borderRadius: '14px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.8px' }}>{label}</span>
          {slot.result && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
              background: slot.result.win ? 'rgba(0,200,83,0.15)' : 'rgba(255,26,58,0.15)',
              color: slot.result.win ? '#00C853' : '#FF5555',
            }}>{slot.result.text}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => setSlotAmount(slotIdx, slot.amount - 50)} disabled={!canEdit} style={{
            width: '32px', height: '34px', borderRadius: '9px', border: 'none', cursor: canEdit ? 'pointer' : 'default',
            background: 'rgba(255,58,58,0.18)', color: '#FF3A3A', fontSize: '20px', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canEdit ? 1 : 0.4, flexShrink: 0,
          }}>−</button>
          <div style={{
            flex: 1, minWidth: 0, background: 'rgba(10,5,20,0.6)', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center',
            padding: '0 6px', height: '34px', overflow: 'hidden',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginRight: '2px', flexShrink: 0 }}>₹</span>
            <input
              type="number" value={slot.input} disabled={!canEdit}
              onChange={e => { const setSlot = slotIdx === 0 ? setSlot1 : setSlot2; setSlot(s => ({ ...s, input: e.target.value })); }}
              onBlur={() => {
                const v = parseInt(slotIdx === 0 ? slot1.input : slot2.input, 10);
                if (!isNaN(v) && v >= 10) setSlotAmount(slotIdx, v);
                else { const setSlot = slotIdx === 0 ? setSlot1 : setSlot2; setSlot(s => ({ ...s, input: String(s.amount) })); }
              }}
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#fff',
                fontSize: '14px', fontWeight: 800, outline: 'none', opacity: canEdit ? 1 : 0.5,
              }}
            />
          </div>
          <button onClick={() => setSlotAmount(slotIdx, slot.amount + 50)} disabled={!canEdit} style={{
            width: '32px', height: '34px', borderRadius: '9px', border: 'none', cursor: canEdit ? 'pointer' : 'default',
            background: 'rgba(255,58,58,0.18)', color: '#FF3A3A', fontSize: '20px', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canEdit ? 1 : 0.4, flexShrink: 0,
          }}>+</button>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {[100, 250, 500, 1000].map(v => (
            <button key={v} onClick={() => setSlotAmount(slotIdx, v)} disabled={!canEdit} style={{
              flex: 1, padding: '6px 0', borderRadius: '8px', border: '1px solid',
              fontSize: '11px', fontWeight: 800, cursor: canEdit ? 'pointer' : 'default',
              background: slot.amount === v ? 'rgba(255,58,58,0.22)' : 'transparent',
              borderColor: slot.amount === v ? 'rgba(255,58,58,0.6)' : 'rgba(255,255,255,0.12)',
              color: slot.amount === v ? '#FF3A3A' : 'rgba(255,255,255,0.5)',
              opacity: canEdit ? 1 : 0.5,
            }}>{v >= 1000 ? '₹1K' : `₹${v}`}</button>
          ))}
        </div>

        {mainBtn}
      </div>
    );
  }

  function renderBetsRow(b: RoundBet, i: number) {
    return (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: AVATAR_COLORS[b.avatar % AVATAR_COLORS.length],
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
        }}>{AVATAR_EMOJI[b.avatar % AVATAR_EMOJI.length]}</div>
        <span style={{ flex: 1.5, fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{b.user}</span>
        <span style={{ flex: 1.5, fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textAlign: 'right' }}>₹{b.amount.toLocaleString('en-IN')}</span>
        <span style={{ flex: 0.9, fontSize: '13px', fontWeight: 700, textAlign: 'center', color: b.cashout ? multColor(b.cashout) : '#555' }}>
          {b.cashout ? `${b.cashout.toFixed(2)}x` : '—'}
        </span>
        <span style={{ flex: 1.5, fontSize: '13px', fontWeight: 700, textAlign: 'right', color: b.winAmount > 0 ? '#00C853' : '#444' }}>
          {b.winAmount > 0 ? `₹${b.winAmount.toLocaleString('en-IN')}` : '0.00'}
        </span>
      </div>
    );
  }

  const cashPct = betCount > 0 ? Math.min(100, (cashedCount / betCount) * 100) : 0;

  return (
    <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto', paddingBottom: '20px', boxSizing: 'border-box' }}>

      {/* History strip */}
      <div style={{ overflowX: 'auto', display: 'flex', gap: '6px', padding: '10px 12px', scrollbarWidth: 'none' }}>
        {(history.length > 0 ? history : []).map((h, i) => {
          const col = multColor(h);
          const bg  = h >= 10 ? 'rgba(255,77,255,0.13)' : h >= 2 ? 'rgba(77,166,255,0.13)' : 'rgba(255,58,58,0.13)';
          return (
            <div key={i} style={{
              flexShrink: 0, background: bg, border: `1px solid ${col}55`,
              borderRadius: '20px', padding: '4px 10px',
              fontSize: '12px', fontWeight: 800, color: col,
            }}>{h.toFixed(2)}x</div>
          );
        })}
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', margin: '0 12px', borderRadius: '16px', overflow: 'hidden', width: 'calc(100% - 24px)' }}>
        <canvas ref={canvasRef} width={480} height={260} style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>

      {/* Dual Bet Panels */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px', boxSizing: 'border-box' }}>
        <div style={{ flex: '1 1 0', minWidth: '0' }}>{renderBetPanel(0)}</div>
        <div style={{ flex: '1 1 0', minWidth: '0' }}>{renderBetPanel(1)}</div>
      </div>

      {/* Bets Section */}
      <div style={{ margin: '0 12px', background: 'rgba(10,5,20,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {(['all', 'prev', 'top'] as BetsTab[]).map(tab => (
            <button key={tab} onClick={() => setBetsTab(tab)} style={{
              flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
              background: betsTab === tab ? 'rgba(255,58,58,0.12)' : 'transparent',
              color: betsTab === tab ? '#FF3A3A' : 'rgba(255,255,255,0.4)',
              fontWeight: 800, fontSize: '13px', letterSpacing: '0.3px',
              borderBottom: betsTab === tab ? '2px solid #FF3A3A' : '2px solid transparent',
            }}>
              {tab === 'all' ? 'All Bets' : tab === 'prev' ? 'Previous' : 'Top'}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px' }}>
          {/* All Bets */}
          {betsTab === 'all' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: '28px', height: '28px', borderRadius: '50%', marginLeft: i > 0 ? '-10px' : 0,
                      background: AVATAR_COLORS[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                    }}>{AVATAR_EMOJI[i]}</div>
                  ))}
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginLeft: '4px' }}>{cashedCount}/{betCount} Bets</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#fff' }}>₹{totalWin >= 1000 ? (totalWin/1000).toFixed(2)+'K' : totalWin.toFixed(2)}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Total win INR</div>
                </div>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginBottom: '10px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${cashPct}%`, background: '#FF3A3A', borderRadius: '2px', transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', padding: '0 0 6px' }}>
                <span style={{ flex: 1.5, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>Player</span>
                <span style={{ flex: 1.5, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'right' }}>Bet INR</span>
                <span style={{ flex: 0.9, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'center' }}>X</span>
                <span style={{ flex: 1.5, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'right' }}>Win INR</span>
              </div>
              {allBets.slice(0, 20).map((b, i) => renderBetsRow(b, i))}
              {allBets.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>Waiting for bets...</div>}
            </>
          )}

          {/* Previous Round */}
          {betsTab === 'prev' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Round Result</span>
                <span style={{ fontSize: '22px', fontWeight: 900, color: prevRound ? multColor(prevRound.result) : '#555' }}>
                  {prevRound ? `${prevRound.result.toFixed(2)}x` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', padding: '0 0 6px' }}>
                <span style={{ flex: 1.5, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>Player</span>
                <span style={{ flex: 1.5, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'right' }}>Bet INR</span>
                <span style={{ flex: 0.9, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'center' }}>X</span>
                <span style={{ flex: 1.5, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'right' }}>Win INR</span>
              </div>
              {(prevRound?.bets ?? []).slice(0, 20).map((b, i) => renderBetsRow(b, i))}
              {!prevRound && <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>No previous round data</div>}
            </>
          )}

          {/* Top Bets */}
          {betsTab === 'top' && (
            <>
              <div style={{ display: 'flex', padding: '0 0 8px' }}>
                <span style={{ flex: 1.5, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>Player</span>
                <span style={{ flex: 1.2, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'right' }}>Bet</span>
                <span style={{ flex: 0.9, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'center' }}>X</span>
                <span style={{ flex: 1.5, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textAlign: 'right' }}>Win INR</span>
              </div>
              {topBets.slice(0, 20).map((b: TopBet, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: AVATAR_COLORS[b.avatar % AVATAR_COLORS.length],
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
                  }}>{AVATAR_EMOJI[b.avatar % AVATAR_EMOJI.length]}</div>
                  <span style={{ flex: 1.2, fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{b.user}</span>
                  <span style={{ flex: 1.2, fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.45)', textAlign: 'right' }}>₹{b.amount.toLocaleString('en-IN')}</span>
                  <span style={{ flex: 0.9, fontSize: '13px', fontWeight: 800, textAlign: 'center', color: multColor(b.mult) }}>{b.mult.toFixed(2)}x</span>
                  <span style={{ flex: 1.5, fontSize: '13px', fontWeight: 800, textAlign: 'right', color: '#00C853' }}>₹{b.win.toLocaleString('en-IN')}</span>
                </div>
              ))}
              {topBets.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>No top bets yet</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
