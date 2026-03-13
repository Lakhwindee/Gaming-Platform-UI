import { useEffect, useRef, useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

type Phase = 'waiting' | 'flying' | 'crashed';

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

// ─── SIMPLE AVIATOR-STYLE PLANE ─────────────────────────────────────────────
function drawPlane(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, t: number, fading: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  if (fading) ctx.globalAlpha = Math.max(0, 1 - (t % 2));

  // Exhaust glow
  ctx.shadowColor = '#FF7000'; ctx.shadowBlur = 22;
  ctx.fillStyle = `rgba(255,110,0,${0.55 + 0.45 * Math.sin(t * 10)})`;
  ctx.beginPath(); ctx.ellipse(-42, 0, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Wings
  ctx.fillStyle = '#BDC8D8';
  ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(-14, -5); ctx.lineTo(-32, -40); ctx.lineTo(-10, -40); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(6,  4); ctx.lineTo(-14,  5); ctx.lineTo(-32,  40); ctx.lineTo(-10,  40); ctx.closePath(); ctx.fill();

  // Fuselage
  const fg = ctx.createLinearGradient(0, -10, 0, 10);
  fg.addColorStop(0, '#FFFFFF'); fg.addColorStop(0.35, '#EEF2FA');
  fg.addColorStop(0.75, '#C0CCD8'); fg.addColorStop(1, '#8898A8');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(48, 0);
  ctx.bezierCurveTo(46, -8, 28, -10, 0, -10);
  ctx.lineTo(-38, -8); ctx.lineTo(-46, 0); ctx.lineTo(-38, 8);
  ctx.lineTo(0, 10);
  ctx.bezierCurveTo(28, 10, 46, 8, 48, 0);
  ctx.closePath(); ctx.fill();

  // Top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(42, -2);
  ctx.bezierCurveTo(36, -7, 20, -9, 0, -9); ctx.lineTo(-30, -7);
  ctx.bezierCurveTo(-20, -7, 0, -6, 20, -5); ctx.bezierCurveTo(30, -4, 38, -3, 42, -2);
  ctx.fill();

  // Cockpit
  ctx.fillStyle = 'rgba(70,145,220,0.78)';
  ctx.beginPath(); ctx.ellipse(18, -3, 12, 7, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.beginPath(); ctx.ellipse(15, -5, 5, 3, -0.1, 0, Math.PI * 2); ctx.fill();

  // Tail fin
  ctx.fillStyle = '#AAB8C4';
  ctx.beginPath(); ctx.moveTo(-34, -6); ctx.lineTo(-44, -6); ctx.lineTo(-40, -24); ctx.lineTo(-32, -12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-36, -3); ctx.lineTo(-46, -3); ctx.lineTo(-50, -16); ctx.lineTo(-38, -9); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-36,  3); ctx.lineTo(-46,  3); ctx.lineTo(-50,  16); ctx.lineTo(-38,  9); ctx.closePath(); ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── MODULE-LEVEL GAME ENGINE (persists across navigations) ─────────────────
interface BotBet { user: string; amount: number; status: string; cashout: number | null; }
type Listener = () => void;

function genCrash(): number {
  const r = Math.random();
  if (r < 0.28) return 1.0 + Math.random() * 0.05;
  if (r < 0.50) return 1.1 + Math.random() * 0.6;
  if (r < 0.70) return 1.8 + Math.random() * 1.5;
  if (r < 0.85) return 3.5 + Math.random() * 6;
  if (r < 0.94) return 10 + Math.random() * 20;
  if (r < 0.99) return 30 + Math.random() * 70;
  return 100 + Math.random() * 900;
}

const BOT_NAMES = ['CryptoKing', 'NeonBlade', 'StarDust', 'VortexX', 'NightOwl', 'BlazeRun', 'GhostRider', 'PixelHunter'];
function genBots(): BotBet[] {
  return Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({
    user: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
    amount: 100 + Math.floor(Math.random() * 1900),
    status: 'active', cashout: null,
  }));
}

const ENG = {
  phase: 'waiting' as Phase,
  mult: 1.0,
  countdown: 5,
  crashPoint: 0,
  startTime: 0,
  crashTime: 0,
  crashPos: { x: 0, y: 0 },
  history: [...HISTORY_ITEMS],
  bots: genBots(),
  listeners: new Set<Listener>(),
  timer: null as ReturnType<typeof setInterval> | null,
  cdTimer: null as ReturnType<typeof setInterval> | null,
  initialized: false,
};

function engNotify() { ENG.listeners.forEach(fn => fn()); }

function engStartCountdown() {
  ENG.phase = 'waiting';
  ENG.mult = 1.0;
  ENG.countdown = 5;
  ENG.crashPoint = genCrash();
  ENG.bots = genBots();
  if (ENG.cdTimer) clearInterval(ENG.cdTimer);
  engNotify();
  ENG.cdTimer = setInterval(() => {
    ENG.countdown = Math.max(0, ENG.countdown - 1);
    engNotify();
    if (ENG.countdown <= 0) {
      clearInterval(ENG.cdTimer!); ENG.cdTimer = null;
      engStartFlight();
    }
  }, 1000);
}

function engStartFlight() {
  ENG.phase = 'flying';
  ENG.startTime = Date.now();
  ENG.mult = 1.0;
  if (ENG.timer) clearInterval(ENG.timer);
  engNotify();
  ENG.timer = setInterval(() => {
    const el = (Date.now() - ENG.startTime) / 1000;
    ENG.mult = calcMult(el);
    ENG.bots = ENG.bots.map(b => {
      if (b.status === 'active' && Math.random() < 0.004 && ENG.mult > 1.3)
        return { ...b, status: 'cashed', cashout: ENG.mult };
      return b;
    });
    engNotify();
    if (ENG.mult >= ENG.crashPoint) engCrash();
  }, 100);
}

function engCrash() {
  if (ENG.timer) { clearInterval(ENG.timer); ENG.timer = null; }
  ENG.phase = 'crashed';
  ENG.crashTime = Date.now();
  ENG.bots = ENG.bots.map(b => b.status === 'active' ? { ...b, status: 'crashed' } : b);
  ENG.history = [Math.floor(ENG.mult * 100) / 100, ...ENG.history].slice(0, 15);
  engNotify();
  setTimeout(engStartCountdown, 4500);
}

// Boot engine once — persists forever
if (!ENG.initialized) {
  ENG.initialized = true;
  engStartCountdown();
}

// ─── PARTICLE TYPE ───────────────────────────────────────────────────────────
type Particle = { x: number; y: number; vx: number; vy: number; life: number; r: number; color: string };

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function CrashGame() {
  const { state, navigate, addHistory, addNotification } = useGame();
  const [, setTick] = useState(0);
  const [betAmount, setBetAmount] = useState(100);
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [resultMsg, setResultMsg] = useState<{ text: string; win: boolean } | null>(null);

  const betRef        = useRef(100);
  const hasActiveRef  = useRef(false);
  const cashedRef     = useRef<number | null>(null);
  const autoCashRef   = useRef(2.0);
  const prevPhaseRef  = useRef<Phase>(ENG.phase);
  const addHistRef    = useRef(addHistory);
  const addNotifRef   = useRef(addNotification);
  const stateRef      = useRef(state);

  useEffect(() => {
    addHistRef.current = addHistory;
    addNotifRef.current = addNotification;
    stateRef.current = state;
  });

  function doCashout(atMult: number) {
    if (!hasActiveRef.current || cashedRef.current) return;
    cashedRef.current = atMult; setCashedOutAt(atMult);
    hasActiveRef.current = false; setHasActiveBet(false);
    const payout = Math.floor(betRef.current * atMult);
    const profit = payout - betRef.current;
    setResultMsg({ text: `Cashed out at ${atMult.toFixed(2)}x! +₹${profit.toLocaleString()}`, win: true });
    if (stateRef.current.user) {
      addHistRef.current({ id: makeId(), game: 'crash', wager: betRef.current, multiplier: atMult, payout, won: true, timestamp: Date.now() });
      addNotifRef.current(`✈️ Cashed out at ${atMult.toFixed(2)}x! +₹${profit.toLocaleString()}`, 'win');
    }
  }

  // Subscribe to engine — handles phase transitions + auto-cashout
  useEffect(() => {
    const update = () => {
      const newPhase = ENG.phase;
      const oldPhase = prevPhaseRef.current;

      if (oldPhase !== newPhase) {
        // Flying → Crashed
        if (oldPhase === 'flying' && newPhase === 'crashed') {
          if (hasActiveRef.current && !cashedRef.current) {
            setResultMsg({ text: `Flew away at ${ENG.mult.toFixed(2)}x! Lost ₹${betRef.current.toLocaleString()}`, win: false });
            hasActiveRef.current = false; setHasActiveBet(false);
            if (stateRef.current.user)
              addHistRef.current({ id: makeId(), game: 'crash', wager: betRef.current, multiplier: ENG.mult, payout: 0, won: false, timestamp: Date.now() });
          }
        }
        // Crashed → Waiting (new round starting)
        if (oldPhase === 'crashed' && newPhase === 'waiting') {
          cashedRef.current = null; setCashedOutAt(null);
          setTimeout(() => setResultMsg(null), 1500);
        }
        prevPhaseRef.current = newPhase;
      }

      // Auto-cashout
      if (newPhase === 'flying' && hasActiveRef.current && !cashedRef.current) {
        if (autoCashRef.current > 1.05 && ENG.mult >= autoCashRef.current) {
          doCashout(ENG.mult);
        }
      }

      setTick(n => n + 1);
    };

    ENG.listeners.add(update);
    return () => { ENG.listeners.delete(update); };
  }, []); // eslint-disable-line

  // Canvas loop — reads ENG directly (no stale closure)
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const animRef       = useRef(0);
  const smoothAngRef  = useRef(-0.3);
  const lastElRef     = useRef(0);
  const particlesRef  = useRef<Particle[]>([]);
  const cvPrevPhase   = useRef<Phase>(ENG.phase);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const ORIG_X = W * 0.09, ORIG_Y = H * 0.88;
    const EXP_COLORS = ['#FF8800', '#FF4400', '#FFCC00', '#FF2200', '#FFE080', '#FFFFFF'];

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const now = Date.now();
      const t = now / 1000;
      const phase = ENG.phase;
      const m = ENG.mult;
      const isFlying  = phase === 'flying';
      const isCrashed = phase === 'crashed';
      const isWaiting = phase === 'waiting';

      // Track elapsed for smooth crash freeze
      const elapsed = isFlying ? (now - ENG.startTime) / 1000 : lastElRef.current;
      if (isFlying) { lastElRef.current = elapsed; ENG.crashPos = getPos(elapsed, m, W, H); }
      if (isWaiting) { lastElRef.current = 0; smoothAngRef.current = -0.3; }

      // Spawn explosion on crash
      if (cvPrevPhase.current === 'flying' && phase === 'crashed') {
        const cp = ENG.crashPos;
        for (let i = 0; i < 55; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 2 + Math.random() * 8;
          particlesRef.current.push({ x: cp.x, y: cp.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 3, life: 1, r: 2 + Math.random() * 6, color: EXP_COLORS[Math.floor(Math.random() * 6)] });
        }
      }
      if (isWaiting) particlesRef.current = [];
      cvPrevPhase.current = phase;

      // ── SKY ──────────────────────────────────────────────────────────────────
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#01060F'); sky.addColorStop(0.4, '#040E20');
      sky.addColorStop(0.75, '#071828'); sky.addColorStop(1, '#0C2238');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // ── STARS ────────────────────────────────────────────────────────────────
      STARS.forEach(s => {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed + s.blink));
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H * 0.85, s.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // ── MOON ─────────────────────────────────────────────────────────────────
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

      // ── CLOUDS ───────────────────────────────────────────────────────────────
      [[0.12, 0.28, 80, 0.10], [0.46, 0.20, 65, 0.07], [0.78, 0.26, 75, 0.09]].forEach(([rx, ry, rs, ra]) => {
        ctx.globalAlpha = ra;
        ctx.fillStyle = '#8AAABB';
        ctx.beginPath(); ctx.arc(rx * W, ry * H, rs, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx * W + 50, ry * H + 8, rs * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(rx * W - 45, ry * H + 10, rs * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      // ── CITY GLOW ────────────────────────────────────────────────────────────
      const cg = ctx.createLinearGradient(0, H * 0.83, 0, H);
      cg.addColorStop(0, 'rgba(30,70,120,0)'); cg.addColorStop(1, 'rgba(40,80,140,0.28)');
      ctx.fillStyle = cg; ctx.fillRect(0, H * 0.83, W, H * 0.17);
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 55; i++) {
        ctx.fillStyle = ['#FFE080', '#FF9040', '#80C8FF', '#FFFFFF'][(i * 7) % 4];
        ctx.fillRect((i * 137.5) % W, H * 0.87 + (i * 23.7) % (H * 0.11), 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      // ── FLIGHT PATH (from fixed origin) ──────────────────────────────────────
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
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Origin dot
        ctx.fillStyle = '#FFCC44'; ctx.shadowColor = '#FF8800'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(ORIG_X, ORIG_Y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Multiplier guide lines
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

      // ── PLANE ────────────────────────────────────────────────────────────────
      const pos = (isFlying || isCrashed) ? getPos(elapsed, m, W, H) : { x: ORIG_X + 20, y: ORIG_Y - 10 };

      // Smooth angle via lerp
      if (!isWaiting) {
        const dT = 0.25;
        const pA = getPos(Math.max(elapsed - dT, 0), calcMult(Math.max(elapsed - dT, 0.001)), W, H);
        const pB = getPos(elapsed + dT, calcMult(elapsed + dT), W, H);
        const rawAng = Math.atan2(pB.y - pA.y, pB.x - pA.x);
        smoothAngRef.current += (rawAng - smoothAngRef.current) * 0.08;
      }
      let angle = smoothAngRef.current;
      if (isCrashed) angle += ((now - ENG.crashTime) / 1000) * 3.5;

      // Contrail
      if (isFlying) {
        const cG = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 26);
        cG.addColorStop(0, 'rgba(180,210,255,0.18)'); cG.addColorStop(1, 'rgba(180,210,255,0)');
        ctx.fillStyle = cG;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 26, 0, Math.PI * 2); ctx.fill();
      }

      drawPlane(ctx, pos.x, pos.y, isWaiting ? -0.22 : angle, t, isCrashed);

      // ── EXPLOSION PARTICLES ──────────────────────────────────────────────────
      particlesRef.current = particlesRef.current.filter(p => p.life > 0).map(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.97; p.r *= 0.97; p.life -= 0.025;
        ctx.globalAlpha = p.life; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        return p;
      });

      // ── HUD ──────────────────────────────────────────────────────────────────
      if (isFlying) {
        const mColor = m >= 10 ? '#00FF88' : m >= 5 ? '#FFD700' : m >= 2 ? '#FF9900' : '#22DDFF';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 100, 14, 200, 68, 14); ctx.fill();
        ctx.strokeStyle = mColor + 'AA'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(W / 2 - 100, 14, 200, 68, 14); ctx.stroke();
        ctx.font = 'bold 54px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = mColor; ctx.shadowColor = mColor; ctx.shadowBlur = 28;
        ctx.fillText(`${m.toFixed(2)}x`, W / 2, 20);
        ctx.shadowBlur = 0;

      } else if (isWaiting) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 130, 14, 260, 66, 14); ctx.fill();
        ctx.font = 'bold 12px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#7A8898'; ctx.fillText('NEXT FLIGHT DEPARTS IN', W / 2, 20);
        ctx.font = 'bold 36px Inter,sans-serif';
        ctx.fillStyle = '#22DDFF'; ctx.shadowColor = '#22DDFF'; ctx.shadowBlur = 18;
        ctx.fillText(`${ENG.countdown}s`, W / 2, 36);  // reads ENG directly — never stale
        ctx.shadowBlur = 0;

      } else if (isCrashed) {
        const ct = Math.min((now - ENG.crashTime) / 1000 * 3, 1);
        ctx.globalAlpha = ct;
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 140, H / 2 - 48, 280, 96, 16); ctx.fill();
        ctx.font = 'bold 42px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FF3344'; ctx.shadowColor = '#FF3344'; ctx.shadowBlur = 28;
        ctx.fillText('FLEW AWAY!', W / 2, H / 2 - 12);
        ctx.shadowBlur = 0;
        ctx.font = 'bold 20px Inter,sans-serif'; ctx.fillStyle = '#FF8888';
        ctx.fillText(`${m.toFixed(2)}x`, W / 2, H / 2 + 26);
        ctx.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  function placeBet() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < betAmount) { alert('Insufficient balance!'); return; }
    if (ENG.phase !== 'waiting') { alert('Bet only during countdown!'); return; }
    betRef.current = betAmount;
    hasActiveRef.current = true; setHasActiveBet(true);
  }

  function cashOut() {
    if (!hasActiveRef.current || ENG.phase !== 'flying' || cashedRef.current) return;
    doCashout(ENG.mult);
  }

  const phase = ENG.phase;
  const mult  = ENG.mult;
  const multColor = phase === 'crashed' ? 'var(--neon-red)' : mult >= 5 ? 'var(--neon-green)' : mult >= 2 ? 'var(--neon-gold)' : 'var(--neon-blue)';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('fastgames')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer', fontSize: '14px' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>✈️ Aviator Crash</h1>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {ENG.history.slice(0, 12).map((v, i) => (
            <div key={i} style={{ background: v <= 1.5 ? 'var(--neon-red)20' : v >= 10 ? 'var(--neon-gold)20' : 'var(--neon-green)20', color: v <= 1.5 ? 'var(--neon-red)' : v >= 10 ? 'var(--neon-gold)' : 'var(--neon-green)', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>{v.toFixed(2)}x</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        {/* Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#01060F', borderRadius: 'var(--radius-lg)', border: '1px solid #1A3050', overflow: 'hidden' }}>
            <canvas ref={canvasRef} width={720} height={380} style={{ width: '100%', display: 'block' }} />
          </div>

          {resultMsg && (
            <div style={{ padding: '16px 20px', borderRadius: 'var(--radius)', background: resultMsg.win ? 'var(--neon-green)15' : 'var(--neon-red)15', border: `1px solid ${resultMsg.win ? 'var(--neon-green)' : 'var(--neon-red)'}40`, color: resultMsg.win ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 700, fontSize: '18px', textAlign: 'center', animation: 'scaleIn 0.3s ease' }}>
              {resultMsg.win ? '✅' : '✈️💨'} {resultMsg.text}
            </div>
          )}

          {/* Live Bets */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>👥 Live Bets</span>
              <span style={{ color: 'var(--text3)', fontSize: '13px' }}>{ENG.bots.length + (hasActiveBet ? 1 : 0)} players</span>
            </div>
            <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
              {hasActiveBet && (
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--neon-blue)08' }}>
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
              {ENG.bots.map((b, i) => (
                <div key={i} style={{ padding: '10px 18px', borderBottom: i < ENG.bots.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.status === 'crashed' ? 'var(--neon-red)' : b.status === 'cashed' ? 'var(--neon-green)' : 'var(--neon-blue)', animation: b.status === 'active' ? 'pulse 1.5s infinite' : 'none' }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{b.user}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)', fontSize: '13px' }}>₹{b.amount.toLocaleString()}</span>
                    {b.status === 'cashed'  && <span style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '13px' }}>✈️ {b.cashout?.toFixed(2)}x</span>}
                    {b.status === 'crashed' && <span style={{ color: 'var(--neon-red)', fontWeight: 700, fontSize: '13px' }}>💥 Lost</span>}
                    {b.status === 'active'  && <span style={{ color: 'var(--neon-blue)', fontSize: '12px' }}>Flying…</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>🎯 Place Bet</h3>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>BET AMOUNT</label>
            <input type="number" value={betAmount} onChange={e => { setBetAmount(Number(e.target.value)); betRef.current = Number(e.target.value); }} disabled={phase !== 'waiting'} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '16px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => { setBetAmount(v); betRef.current = v; }} disabled={phase !== 'waiting'} style={{ background: betAmount === v ? 'var(--neon-blue)20' : 'var(--bg3)', border: `1px solid ${betAmount === v ? 'var(--neon-blue)' : 'var(--border)'}`, color: betAmount === v ? 'var(--neon-blue)' : 'var(--text2)', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{v}</button>
              ))}
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>AUTO CASHOUT</label>
            <input type="number" value={autoCashout} step="0.1" min="1.1" onChange={e => { setAutoCashout(Number(e.target.value)); autoCashRef.current = Number(e.target.value); }} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: '15px', fontWeight: 700, marginBottom: '20px' }} />

            {!hasActiveBet ? (
              <button onClick={placeBet} disabled={phase !== 'waiting'} style={{ width: '100%', background: phase === 'waiting' ? 'linear-gradient(135deg,#1060E0,#4490FF)' : 'var(--bg3)', color: phase === 'waiting' ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 'var(--radius)', padding: '16px', fontWeight: 800, fontSize: '16px', cursor: phase === 'waiting' ? 'pointer' : 'not-allowed' }}>
                {phase === 'waiting' ? `✈️ Board — ₹${betAmount.toLocaleString()}` : phase === 'flying' ? '🛫 Round in progress…' : '💥 Crashed — wait…'}
              </button>
            ) : (
              <button onClick={cashOut} disabled={phase !== 'flying' || !!cashedOutAt} style={{ width: '100%', background: !cashedOutAt && phase === 'flying' ? 'var(--neon-green)' : 'var(--bg3)', color: !cashedOutAt && phase === 'flying' ? '#000' : 'var(--text2)', border: 'none', borderRadius: 'var(--radius)', padding: '16px', fontWeight: 800, fontSize: '16px', cursor: !cashedOutAt && phase === 'flying' ? 'pointer' : 'not-allowed', animation: !cashedOutAt && phase === 'flying' ? 'neonPulse 1.5s infinite' : 'none' }}>
                {cashedOutAt ? `✅ Exited at ${cashedOutAt.toFixed(2)}x` : `🪂 Eject! ₹${Math.floor(betAmount * mult).toLocaleString()}`}
              </button>
            )}

            {phase === 'flying' && (
              <div style={{ marginTop: '14px', padding: '14px', borderRadius: '12px', textAlign: 'center', background: 'var(--bg3)', border: `1px solid ${multColor}40` }}>
                <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>ALTITUDE</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: multColor, textShadow: `0 0 20px ${multColor}`, lineHeight: 1 }}>{mult.toFixed(2)}x</div>
                {hasActiveBet && !cashedOutAt && <div style={{ color: 'var(--neon-green)', fontSize: '14px', fontWeight: 700, marginTop: '6px' }}>→ ₹{Math.floor(betAmount * mult).toLocaleString()}</div>}
              </div>
            )}

            {phase === 'waiting' && (
              <div style={{ marginTop: '14px', padding: '14px', borderRadius: '12px', textAlign: 'center', background: 'var(--bg3)', border: '1px solid var(--neon-blue)30' }}>
                <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>NEXT FLIGHT</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--neon-blue)', lineHeight: 1 }}>{ENG.countdown}s</div>
              </div>
            )}

            {state.user && (
              <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '14px' }}>₹{state.user.balance.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* History */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '14px' }}>🏁 Flight History</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ENG.history.map((v, i) => (
                <div key={i} style={{ background: v <= 1.5 ? 'var(--neon-red)15' : v >= 10 ? 'var(--neon-gold)15' : 'var(--neon-green)15', color: v <= 1.5 ? 'var(--neon-red)' : v >= 10 ? 'var(--neon-gold)' : 'var(--neon-green)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 700 }}>{v.toFixed(2)}x</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
