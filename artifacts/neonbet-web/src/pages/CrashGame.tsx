import { useEffect, useRef, useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

type Phase = 'waiting' | 'flying' | 'crashed';

const HISTORY_ITEMS = [2.14, 1.01, 8.56, 3.22, 1.01, 15.4, 2.87, 1.01, 4.12, 1.01, 22.8, 1.01, 1.63, 5.5, 1.01];

// Pre-generated stars (stable across renders)
const STARS = Array.from({ length: 180 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.6 + 0.4,
  blink: Math.random() * Math.PI * 2,
  speed: Math.random() * 2 + 1,
}));

function getMultiplier(elapsedSec: number): number {
  return Math.floor(Math.pow(Math.E, 0.077 * elapsedSec) * 100) / 100;
}

function getPlanePos(elapsed: number, mult: number, W: number, H: number) {
  const tX = Math.min(elapsed / 22, 1);
  const x = W * 0.09 + tX * W * 0.82;
  const tY = Math.min(Math.log(Math.max(mult, 1)) / Math.log(28), 1);
  const y = H * 0.88 - tY * H * 0.80;
  return { x, y };
}

// ─── PRIVATE JET ─────────────────────────────────────────────────────────────
function drawJet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  t: number,
  crashed: boolean
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  if (crashed) {
    ctx.rotate(Math.sin(t * 18) * 0.4);
    ctx.globalAlpha = Math.max(0, 1 - (t % 2) * 0.8);
  }

  // ── ENGINE GLOW ─────────────────────────────────────────────────────────────
  const eGlow = Math.abs(Math.sin(t * 9)) * 0.35 + 0.65;
  ctx.shadowColor = '#FF8820';
  ctx.shadowBlur = 28;
  ctx.fillStyle = `rgba(255,130,20,${eGlow})`;
  ctx.beginPath(); ctx.ellipse(-38, -22, 8, 5, 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-38,  22, 8, 5,-0.28, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // ── WINGS ────────────────────────────────────────────────────────────────────
  const wG = ctx.createLinearGradient(0, -58, 0, 2);
  wG.addColorStop(0, '#9AAABB');
  wG.addColorStop(0.5, '#C8D4DC');
  wG.addColorStop(1, '#E0E8F0');
  ctx.fillStyle = wG;
  // Upper wing
  ctx.beginPath();
  ctx.moveTo( 8, -8);
  ctx.lineTo(-20, -8);
  ctx.lineTo(-42, -58);
  ctx.lineTo(-14, -58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.stroke();
  // Winglet upper
  ctx.fillStyle = '#B8C8D4';
  ctx.beginPath();
  ctx.moveTo(-14, -58);
  ctx.lineTo(-42, -58);
  ctx.lineTo(-44, -70);
  ctx.lineTo(-18, -63);
  ctx.closePath();
  ctx.fill();

  // Lower wing (mirrored)
  ctx.fillStyle = wG;
  ctx.beginPath();
  ctx.moveTo( 8,  8);
  ctx.lineTo(-20,  8);
  ctx.lineTo(-42,  58);
  ctx.lineTo(-14,  58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.stroke();
  // Winglet lower
  ctx.fillStyle = '#B8C8D4';
  ctx.beginPath();
  ctx.moveTo(-14,  58);
  ctx.lineTo(-42,  58);
  ctx.lineTo(-44,  70);
  ctx.lineTo(-18,  63);
  ctx.closePath();
  ctx.fill();

  // ── ENGINES ─────────────────────────────────────────────────────────────────
  function drawEngine(ey: number, sign: number) {
    const eG = ctx.createLinearGradient(-44, ey * sign - 8, -22, ey * sign + 8);
    eG.addColorStop(0, '#4A5868');
    eG.addColorStop(0.4, '#7A8898');
    eG.addColorStop(1, '#3A4858');
    ctx.fillStyle = eG;
    ctx.beginPath(); ctx.ellipse(-28, ey * sign, 9, 17, 0.26 * sign, 0, Math.PI * 2); ctx.fill();
    // Inlet ring
    ctx.strokeStyle = '#505868'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-28, ey * sign - 14 * sign, 8, 6, 0.26 * sign, 0, Math.PI * 2); ctx.stroke();
    // Inlet dark
    ctx.fillStyle = '#1A2028';
    ctx.beginPath(); ctx.ellipse(-28, ey * sign - 14 * sign, 6, 5, 0.26 * sign, 0, Math.PI * 2); ctx.fill();
    // Exhaust nozzle
    ctx.fillStyle = '#606878';
    ctx.beginPath(); ctx.ellipse(-38, ey * sign + 6 * sign, 6, 7, 0.26 * sign, 0, Math.PI * 2); ctx.fill();
  }
  drawEngine(22, -1);
  drawEngine(22,  1);

  // ── FUSELAGE ─────────────────────────────────────────────────────────────────
  const fG = ctx.createLinearGradient(0, -13, 0, 13);
  fG.addColorStop(0, '#F2F6FA');
  fG.addColorStop(0.18, '#E8EEF4');
  fG.addColorStop(0.55, '#CCD4DE');
  fG.addColorStop(0.85, '#98A8B8');
  fG.addColorStop(1, '#6A7A8A');
  ctx.fillStyle = fG;
  ctx.beginPath();
  ctx.moveTo(68, 0);
  ctx.bezierCurveTo(68, -6, 52, -13, 22, -13);
  ctx.lineTo(-56, -11);
  ctx.bezierCurveTo(-70, -11, -78, -7, -80, -3);
  ctx.lineTo(-80,  3);
  ctx.bezierCurveTo(-78,  7, -70, 11, -56, 11);
  ctx.lineTo(22, 13);
  ctx.bezierCurveTo(52, 13, 68, 6, 68, 0);
  ctx.closePath();
  ctx.fill();

  // Fuselage highlight
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(62, -2);
  ctx.bezierCurveTo(56, -9, 38, -11, 12, -11);
  ctx.lineTo(-48, -10);
  ctx.bezierCurveTo(-60, -10, -68, -8, -74, -5);
  ctx.bezierCurveTo(-62, -6, -38, -7, 8, -7);
  ctx.bezierCurveTo(36, -7, 54, -5, 62, -2);
  ctx.fill();

  // Bottom shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(50, 5);
  ctx.lineTo(-54, 9);
  ctx.bezierCurveTo(-66, 10, -74, 9, -78, 6);
  ctx.bezierCurveTo(-70, 11, -50, 11, 22, 11);
  ctx.bezierCurveTo(42, 11, 56, 8, 62, 5);
  ctx.fill();

  // ── LIVERY (blue stripe + gold trim) ────────────────────────────────────────
  ctx.fillStyle = 'rgba(20, 90, 200, 0.82)';
  ctx.beginPath();
  ctx.moveTo(48, -2.5);
  ctx.lineTo(-56, -3.5);
  ctx.bezierCurveTo(-68, -3.5, -76, -1, -78,  0);
  ctx.bezierCurveTo(-76,  1, -68, 3.5, -56, 3.5);
  ctx.lineTo(48, 2.5);
  ctx.closePath();
  ctx.fill();
  // Gold trim lines
  ctx.strokeStyle = 'rgba(255,210,40,0.9)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(48, -3.5); ctx.lineTo(-56, -4.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(48,  3.5); ctx.lineTo(-56,  4.5); ctx.stroke();

  // ── WINDOWS ─────────────────────────────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const wx = 38 - i * 11;
    ctx.fillStyle = '#1E4E78';
    ctx.beginPath(); ctx.ellipse(wx, -3.5, 4.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3A80C0';
    ctx.beginPath(); ctx.ellipse(wx, -3.5, 3.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,170,0.38)';
    ctx.beginPath(); ctx.ellipse(wx, -3.5, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(wx - 1.5, -5, 1.2, 1.8, 0.3, 0, Math.PI * 2); ctx.fill();
  }

  // ── NOSE CONE (radar) ────────────────────────────────────────────────────────
  ctx.fillStyle = '#14181E';
  ctx.beginPath();
  ctx.moveTo(68, 0);
  ctx.bezierCurveTo(64, -4, 52, -7, 46, -6);
  ctx.lineTo(46, 6);
  ctx.bezierCurveTo(52, 7, 64, 4, 68, 0);
  ctx.fill();
  // Pitot tube
  ctx.strokeStyle = '#888898'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(68, -3); ctx.lineTo(80, -3); ctx.stroke();

  // ── VERTICAL TAIL FIN ───────────────────────────────────────────────────────
  const vfG = ctx.createLinearGradient(-60, -38, -55, 0);
  vfG.addColorStop(0, '#C8D4DC');
  vfG.addColorStop(1, '#98A8B8');
  ctx.fillStyle = vfG;
  ctx.beginPath();
  ctx.moveTo(-56, -9);
  ctx.lineTo(-75, -9);
  ctx.bezierCurveTo(-78, -9, -80, -7, -80, -3);
  ctx.lineTo(-72, -38);
  ctx.bezierCurveTo(-70, -42, -62, -42, -60, -38);
  ctx.lineTo(-57, -9);
  ctx.closePath();
  ctx.fill();
  // Tail livery stripe
  ctx.fillStyle = 'rgba(20,90,200,0.75)';
  ctx.beginPath();
  ctx.moveTo(-57, -9);
  ctx.lineTo(-60, -32);
  ctx.bezierCurveTo(-61, -38, -67, -40, -68, -36);
  ctx.lineTo(-72, -28);
  ctx.lineTo(-68, -9);
  ctx.closePath();
  ctx.fill();

  // ── HORIZONTAL STABILIZERS ──────────────────────────────────────────────────
  ctx.fillStyle = '#B8C8D4';
  ctx.beginPath();
  ctx.moveTo(-65, -8); ctx.lineTo(-78, -8); ctx.lineTo(-86, -26); ctx.lineTo(-70, -18); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-65,  8); ctx.lineTo(-78,  8); ctx.lineTo(-86,  26); ctx.lineTo(-70,  18); ctx.closePath();
  ctx.fill();

  // ── NAVIGATION LIGHTS ───────────────────────────────────────────────────────
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#FF2020'; ctx.shadowColor = '#FF2020';
  ctx.beginPath(); ctx.arc(-28, -62, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20FF40'; ctx.shadowColor = '#20FF40';
  ctx.beginPath(); ctx.arc(-28,  62, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = '#FFFFFF';
  ctx.beginPath(); ctx.arc(-80, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  // Strobe flash
  if (Math.sin(t * 5) > 0.7) {
    ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(10, -12, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ─── EXPLOSION PARTICLES ─────────────────────────────────────────────────────
type Particle = { x: number; y: number; vx: number; vy: number; life: number; r: number; color: string };

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function CrashGame() {
  const { state, navigate, addHistory, addNotification } = useGame();

  const [phase,        setPhase       ] = useState<Phase>('waiting');
  const [multiplier,   setMultiplier  ] = useState(1.0);
  const [betAmount,    setBetAmount   ] = useState(100);
  const [autoCashout,  setAutoCashout ] = useState(2.0);
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [crashPoint,   setCrashPoint  ] = useState(0);
  const [cashedOutAt,  setCashedOutAt ] = useState<number | null>(null);
  const [countdown,    setCountdown   ] = useState(5);
  const [history,      setHistory     ] = useState(HISTORY_ITEMS);
  const [resultMsg,    setResultMsg   ] = useState<{ text: string; win: boolean } | null>(null);
  const [bets, setBets] = useState([
    { user: 'Player1',   amount: 250,  status: 'active', cashout: null as number | null },
    { user: 'CryptoKing',amount: 1000, status: 'active', cashout: null as number | null },
    { user: 'NeonBlade', amount: 750,  status: 'active', cashout: null as number | null },
    { user: 'StarDust',  amount: 500,  status: 'active', cashout: null as number | null },
  ]);

  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef         = useRef<number>(0);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const startTimeRef    = useRef(0);
  const crashPointRef   = useRef(0);
  const multiplierRef   = useRef(1.0);
  const phaseRef        = useRef<Phase>('waiting');
  const hasActiveBetRef = useRef(false);
  const cashedOutRef    = useRef<number | null>(null);
  const pathRef         = useRef<{ x: number; y: number }[]>([]);
  const lastPathRef     = useRef(0);
  const particlesRef    = useRef<Particle[]>([]);
  const crashPosRef     = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const crashTRef       = useRef(0);

  function generateCrashPoint() {
    const r = Math.random();
    if (r < 0.28) return 1.00 + Math.random() * 0.05;
    if (r < 0.50) return 1.1  + Math.random() * 0.6;
    if (r < 0.70) return 1.8  + Math.random() * 1.5;
    if (r < 0.85) return 3.5  + Math.random() * 6;
    if (r < 0.94) return 10   + Math.random() * 20;
    if (r < 0.99) return 30   + Math.random() * 70;
    return 100 + Math.random() * 900;
  }

  function startCountdown() {
    phaseRef.current = 'waiting'; setPhase('waiting');
    setMultiplier(1.0); multiplierRef.current = 1.0;
    setCashedOutAt(null); cashedOutRef.current = null;
    setResultMsg(null);
    hasActiveBetRef.current = false; setHasActiveBet(false);
    pathRef.current = [];
    particlesRef.current = [];
    setBets([
      { user: 'Player1',   amount: 250  + Math.floor(Math.random() * 750),  status: 'active', cashout: null },
      { user: 'CryptoKing',amount: 500  + Math.floor(Math.random() * 1500), status: 'active', cashout: null },
      { user: 'NeonBlade', amount: 250  + Math.floor(Math.random() * 1000), status: 'active', cashout: null },
      { user: 'StarDust',  amount: 100  + Math.floor(Math.random() * 500),  status: 'active', cashout: null },
    ]);
    const cp = generateCrashPoint();
    setCrashPoint(cp); crashPointRef.current = cp;
    let tt = 5; setCountdown(tt);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      tt--; setCountdown(tt);
      if (tt <= 0) { clearInterval(countdownRef.current!); startFlight(); }
    }, 1000);
  }

  function startFlight() {
    phaseRef.current = 'flying'; setPhase('flying');
    startTimeRef.current = Date.now();
    pathRef.current = [];
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const m = getMultiplier(elapsed);
      multiplierRef.current = m; setMultiplier(m);
      setBets(prev => prev.map(b => {
        if (b.status === 'active' && Math.random() < 0.003 && m > 1.2)
          return { ...b, status: 'cashed', cashout: m };
        return b;
      }));
      if (hasActiveBetRef.current && autoCashout > 1 && m >= autoCashout && !cashedOutRef.current) {
        doCashout(m); return;
      }
      if (m >= crashPointRef.current) doCrash(m);
    }, 100);
  }

  function doCashout(atMult: number) {
    if (!hasActiveBetRef.current || cashedOutRef.current) return;
    cashedOutRef.current = atMult; setCashedOutAt(atMult);
    hasActiveBetRef.current = false; setHasActiveBet(false);
    const payout = Math.floor(betAmount * atMult);
    const profit = payout - betAmount;
    setResultMsg({ text: `Cashed out at ${atMult.toFixed(2)}x! +₹${profit.toLocaleString()}`, win: true });
    if (state.user) {
      addHistory({ id: makeId(), game: 'crash', wager: betAmount, multiplier: atMult, payout, won: true, timestamp: Date.now() });
      addNotification(`✈️ Cashed out at ${atMult.toFixed(2)}x! +₹${profit.toLocaleString()}`, 'win');
    }
  }

  function doCrash(finalMult: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    phaseRef.current = 'crashed'; setPhase('crashed');
    crashTRef.current = Date.now();
    setHistory(prev => [Math.floor(finalMult * 100) / 100, ...prev].slice(0, 15));
    if (hasActiveBetRef.current && !cashedOutRef.current) {
      setResultMsg({ text: `Flew away at ${finalMult.toFixed(2)}x! Lost ₹${betAmount.toLocaleString()}`, win: false });
      if (state.user)
        addHistory({ id: makeId(), game: 'crash', wager: betAmount, multiplier: finalMult, payout: 0, won: false, timestamp: Date.now() });
      hasActiveBetRef.current = false; setHasActiveBet(false);
    }
    // Spawn explosion particles
    const cp = crashPosRef.current;
    const expColors = ['#FF8800', '#FF4400', '#FFCC00', '#FF2200', '#FFE080', '#FFFFFF'];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      particlesRef.current.push({
        x: cp.x, y: cp.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
        life: 1, r: 2 + Math.random() * 6,
        color: expColors[Math.floor(Math.random() * expColors.length)],
      });
    }
    setBets(prev => prev.map(b => b.status === 'active' ? { ...b, status: 'crashed' } : b));
    setTimeout(() => startCountdown(), 4200);
  }

  function placeBet() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < betAmount) { alert('Insufficient balance!'); return; }
    if (phase !== 'waiting') { alert('Wait for next round!'); return; }
    hasActiveBetRef.current = true; setHasActiveBet(true);
    setBets(prev => [{ user: state.user!.username, amount: betAmount, status: 'active', cashout: null }, ...prev]);
  }

  function cashOut() {
    if (!hasActiveBetRef.current || phaseRef.current !== 'flying' || cashedOutRef.current) return;
    doCashout(multiplierRef.current);
  }

  // ── CANVAS ANIMATION LOOP ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const now = Date.now();
      const t = now / 1000;
      const phase = phaseRef.current;
      const m = multiplierRef.current;
      const isflying  = phase === 'flying';
      const iscrashed = phase === 'crashed';
      const iswaiting = phase === 'waiting';
      const elapsed = isflying ? (now - startTimeRef.current) / 1000 : 0;

      // ── SKY GRADIENT ──────────────────────────────────────────────────────
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#01060F');
      sky.addColorStop(0.4, '#040E20');
      sky.addColorStop(0.75, '#071828');
      sky.addColorStop(1, '#0C2238');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // ── STARS ─────────────────────────────────────────────────────────────
      STARS.forEach(s => {
        const alpha = 0.5 + 0.5 * Math.sin(t * s.speed + s.blink);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H * 0.85, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // ── MOON ──────────────────────────────────────────────────────────────
      const moonX = W * 0.88, moonY = H * 0.08;
      ctx.shadowColor = 'rgba(200,220,255,0.4)'; ctx.shadowBlur = 30;
      ctx.fillStyle = '#F0F0D8';
      ctx.beginPath(); ctx.arc(moonX, moonY, 26, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Moon craters
      ctx.fillStyle = 'rgba(200,200,190,0.5)';
      [[moonX - 8, moonY - 6, 5], [moonX + 7, moonY + 8, 4], [moonX - 4, moonY + 9, 3]].forEach(([mx, my, mr]) => {
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      });
      // Moon shadow
      ctx.fillStyle = 'rgba(2,8,20,0.4)';
      ctx.beginPath(); ctx.arc(moonX + 8, moonY, 24, 0, Math.PI * 2); ctx.fill();

      // ── DISTANT CLOUDS ────────────────────────────────────────────────────
      [[0.12, 0.3, 90, 0.12], [0.45, 0.22, 70, 0.08], [0.78, 0.28, 80, 0.10]].forEach(([rx, ry, rs, ra]) => {
        const cx2 = rx * W;
        ctx.globalAlpha = ra;
        ctx.fillStyle = '#8AAABB';
        ctx.beginPath(); ctx.arc(cx2, ry * H, rs, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx2 + 55, ry * H + 8, rs * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx2 - 50, ry * H + 10, rs * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      // ── CITY HORIZON GLOW ─────────────────────────────────────────────────
      const cityG = ctx.createLinearGradient(0, H * 0.82, 0, H);
      cityG.addColorStop(0, 'rgba(30,70,120,0)');
      cityG.addColorStop(0.6, 'rgba(30,70,120,0.12)');
      cityG.addColorStop(1, 'rgba(40,80,140,0.3)');
      ctx.fillStyle = cityG; ctx.fillRect(0, H * 0.82, W, H * 0.18);
      // Tiny city lights
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 60; i++) {
        const lx = (i * 137.5) % W;
        const ly = H * 0.86 + (i * 23.7) % (H * 0.12);
        const lc = ['#FFE080', '#FF9040', '#80C8FF', '#FFFFFF'][(i * 7) % 4];
        ctx.fillStyle = lc;
        ctx.fillRect(lx, ly, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      // ── FLIGHT PATH CURVE — always starts from fixed origin ───────────────
      // Fixed origin = bottom-left corner where plane starts
      const ORIG_X = W * 0.09;
      const ORIG_Y = H * 0.88;

      // Update crash position during flight
      if (isflying) {
        crashPosRef.current = getPlanePos(elapsed, m, W, H);
      }

      // Draw the path mathematically (never relies on accumulated points)
      if (isflying || iscrashed) {
        const drawElapsed = isflying ? elapsed : elapsed; // keeps last elapsed for crashed
        const STEPS = 90;

        // Outer glow
        ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 22;
        ctx.strokeStyle = 'rgba(255,80,0,0.35)'; ctx.lineWidth = 10;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(ORIG_X, ORIG_Y);
        for (let i = 1; i <= STEPS; i++) {
          const ft = drawElapsed * (i / STEPS);
          const fm = getMultiplier(ft);
          const p = getPlanePos(ft, fm, W, H);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Mid glow
        ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(255,140,20,0.7)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(ORIG_X, ORIG_Y);
        for (let i = 1; i <= STEPS; i++) {
          const ft = drawElapsed * (i / STEPS);
          const fm = getMultiplier(ft);
          const p = getPlanePos(ft, fm, W, H);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Core bright line
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#FFCC44'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ORIG_X, ORIG_Y);
        for (let i = 1; i <= STEPS; i++) {
          const ft = drawElapsed * (i / STEPS);
          const fm = getMultiplier(ft);
          const p = getPlanePos(ft, fm, W, H);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Origin dot
        ctx.fillStyle = '#FFCC44'; ctx.shadowColor = '#FF8800'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(ORIG_X, ORIG_Y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Multiplier Y-axis guide lines
        const curPos = getPlanePos(drawElapsed, m, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.font = 'bold 11px Inter,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        [2, 5, 10, 25].forEach(mv => {
          if (m >= mv) {
            // Find what elapsed time corresponds to this multiplier
            let guideT = 0;
            for (let s = 0; s < 300; s++) {
              if (getMultiplier(s * 0.1) >= mv) { guideT = s * 0.1; break; }
            }
            const gPos = getPlanePos(guideT, mv, W, H);
            ctx.beginPath(); ctx.moveTo(ORIG_X, gPos.y); ctx.lineTo(curPos.x + 10, gPos.y); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillText(`${mv}x`, ORIG_X - 36, gPos.y);
          }
        });
        ctx.setLineDash([]);
      }

      // ── PLANE ─────────────────────────────────────────────────────────────
      if (!iswaiting) {
        const pos = iscrashed
          ? crashPosRef.current
          : getPlanePos(elapsed, m, W, H);

        if (!iscrashed) crashPosRef.current = pos;

        // Compute angle mathematically from the curve derivative
        const dT = 0.08;
        const posA = getPlanePos(Math.max(elapsed - dT, 0), getMultiplier(Math.max(elapsed - dT, 0.001)), W, H);
        const posB = getPlanePos(elapsed + dT, getMultiplier(elapsed + dT), W, H);
        let angle = Math.atan2(posB.y - posA.y, posB.x - posA.x);

        // Crash spin
        if (iscrashed) {
          const ct = (now - crashTRef.current) / 1000;
          angle += ct * 3.5;
        }

        // Contrail glow behind plane
        if (isflying) {
          const cG = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 28);
          cG.addColorStop(0, 'rgba(180,210,255,0.22)');
          cG.addColorStop(1, 'rgba(180,210,255,0)');
          ctx.fillStyle = cG;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2); ctx.fill();
        }

        drawJet(ctx, pos.x, pos.y, angle, t, iscrashed);
      } else {
        // Waiting — show stationary jet at origin
        drawJet(ctx, ORIG_X + 20, ORIG_Y - 10, -0.18, t, false);
      }

      // ── EXPLOSION PARTICLES ───────────────────────────────────────────────
      particlesRef.current = particlesRef.current.filter(p => p.life > 0).map(p => {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.15; // gravity
        p.vx *= 0.97;
        p.r *= 0.97;
        p.life -= 0.025;
        ctx.globalAlpha = p.life;
        ctx.shadowColor = p.color; ctx.shadowBlur = 10;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        return p;
      });

      // ── MULTIPLIER HUD ────────────────────────────────────────────────────
      if (isflying) {
        const mColor = m >= 10 ? '#00FF88' : m >= 5 ? '#FFD700' : m >= 2 ? '#FF9900' : '#22DDFF';
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 100, 12, 200, 72, 14); ctx.fill();
        ctx.strokeStyle = mColor + 'AA'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(W / 2 - 100, 12, 200, 72, 14); ctx.stroke();
        ctx.font = 'bold 56px Inter,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = mColor; ctx.shadowColor = mColor; ctx.shadowBlur = 32;
        ctx.fillText(`${m.toFixed(2)}x`, W / 2, 18);
        ctx.shadowBlur = 0;
      } else if (iswaiting) {
        ctx.fillStyle = 'rgba(0,0,0,0.68)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 120, 12, 240, 64, 14); ctx.fill();
        ctx.font = 'bold 13px Inter,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#8899AA'; ctx.fillText('FLIGHT DEPARTS IN', W / 2, 18);
        ctx.font = 'bold 34px Inter,sans-serif';
        ctx.fillStyle = '#22DDFF'; ctx.shadowColor = '#22DDFF'; ctx.shadowBlur = 18;
        ctx.fillText(`${countdown}s`, W / 2, 38);
        ctx.shadowBlur = 0;
      } else if (iscrashed) {
        const ct = (now - crashTRef.current) / 1000;
        ctx.globalAlpha = Math.min(ct * 3, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 130, H / 2 - 45, 260, 90, 14); ctx.fill();
        ctx.font = 'bold 44px Inter,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FF3344'; ctx.shadowColor = '#FF3344'; ctx.shadowBlur = 30;
        ctx.fillText('FLEW AWAY!', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.font = 'bold 18px Inter,sans-serif';
        ctx.fillStyle = '#FF8888';
        ctx.fillText(`${multiplier.toFixed(2)}x`, W / 2, H / 2 + 24);
        ctx.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); };
  }, []);

  useEffect(() => {
    startCountdown();
    return () => {
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const multColor = phase === 'crashed'    ? 'var(--neon-red)'
    : multiplier >= 5 ? 'var(--neon-green)'
    : multiplier >= 2 ? 'var(--neon-gold)'
    : 'var(--neon-blue)';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('fastgames')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer', fontSize: '14px' }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>✈️ Aviator Crash — Private Jet</h1>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {history.slice(0, 12).map((v, i) => (
            <div key={i} style={{ background: v <= 1.5 ? 'var(--neon-red)20' : v >= 10 ? 'var(--neon-gold)20' : 'var(--neon-green)20', color: v <= 1.5 ? 'var(--neon-red)' : v >= 10 ? 'var(--neon-gold)' : 'var(--neon-green)', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>{v.toFixed(2)}x</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#01060F', borderRadius: 'var(--radius-lg)', border: '1px solid #1A3050', position: 'relative', overflow: 'hidden' }}>
            <canvas ref={canvasRef} width={720} height={380} style={{ width: '100%', display: 'block' }} />
          </div>

          {resultMsg && (
            <div style={{ padding: '16px 20px', borderRadius: 'var(--radius)', background: resultMsg.win ? 'var(--neon-green)15' : 'var(--neon-red)15', border: `1px solid ${resultMsg.win ? 'var(--neon-green)40' : 'var(--neon-red)40'}`, color: resultMsg.win ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 700, fontSize: '18px', textAlign: 'center', animation: 'scaleIn 0.3s ease' }}>
              {resultMsg.win ? '✅' : '✈️💨'} {resultMsg.text}
            </div>
          )}

          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>👥 Live Bets</span>
              <span style={{ color: 'var(--text3)', fontSize: '13px' }}>{bets.length} players</span>
            </div>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {bets.map((b, i) => (
                <div key={i} style={{ padding: '10px 18px', borderBottom: i < bets.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.status === 'crashed' ? 'var(--neon-red)' : b.status === 'cashed' ? 'var(--neon-green)' : 'var(--neon-blue)', animation: b.status === 'active' ? 'pulse 1.5s infinite' : 'none' }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{b.user}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)', fontSize: '13px' }}>₹{b.amount.toLocaleString()}</span>
                    {b.status === 'cashed'  && <span style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '13px' }}>✈️ {b.cashout?.toFixed(2)}x</span>}
                    {b.status === 'crashed' && <span style={{ color: 'var(--neon-red)', fontWeight: 700, fontSize: '13px' }}>💥 Crashed</span>}
                    {b.status === 'active'  && <span style={{ color: 'var(--neon-blue)', fontSize: '12px', fontStyle: 'italic' }}>In flight…</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '24px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>🎯 Place Bet</h3>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>BET AMOUNT</label>
            <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))} disabled={phase !== 'waiting'} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '16px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setBetAmount(v)} disabled={phase !== 'waiting'} style={{ background: betAmount === v ? 'var(--neon-blue)20' : 'var(--bg3)', border: `1px solid ${betAmount === v ? 'var(--neon-blue)' : 'var(--border)'}`, color: betAmount === v ? 'var(--neon-blue)' : 'var(--text2)', borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{v}</button>
              ))}
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>AUTO CASHOUT AT</label>
            <input type="number" value={autoCashout} step="0.1" min="1.1" onChange={e => setAutoCashout(Number(e.target.value))} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: '15px', fontWeight: 700, marginBottom: '20px' }} />

            {!hasActiveBet ? (
              <button onClick={placeBet} disabled={phase !== 'waiting'} style={{ width: '100%', background: phase === 'waiting' ? 'linear-gradient(135deg,#1060E0,#4490FF)' : 'var(--bg3)', color: phase === 'waiting' ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 'var(--radius)', padding: '16px', fontWeight: 800, fontSize: '16px', cursor: phase === 'waiting' ? 'pointer' : 'not-allowed' }}>
                {phase === 'waiting' ? `✈️ Board Jet — ₹${betAmount.toLocaleString()}` : '🛫 Flight in progress…'}
              </button>
            ) : (
              <button onClick={cashOut} disabled={phase !== 'flying' || !!cashedOutAt} style={{ width: '100%', background: !cashedOutAt && phase === 'flying' ? 'var(--neon-green)' : 'var(--bg3)', color: !cashedOutAt && phase === 'flying' ? '#000' : 'var(--text2)', border: 'none', borderRadius: 'var(--radius)', padding: '16px', fontWeight: 800, fontSize: '16px', cursor: !cashedOutAt && phase === 'flying' ? 'pointer' : 'not-allowed', animation: !cashedOutAt && phase === 'flying' ? 'neonPulse 1.5s infinite' : 'none' }}>
                {cashedOutAt ? `✅ Exited at ${cashedOutAt.toFixed(2)}x` : `🪂 Eject! ₹${Math.floor(betAmount * multiplier).toLocaleString()}`}
              </button>
            )}

            {phase === 'flying' && (
              <div style={{ marginTop: '14px', padding: '14px', borderRadius: '12px', textAlign: 'center', background: 'var(--bg3)', border: `1px solid ${multColor}40` }}>
                <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>ALTITUDE</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: multColor, textShadow: `0 0 20px ${multColor}`, lineHeight: 1 }}>{multiplier.toFixed(2)}x</div>
                {hasActiveBet && !cashedOutAt && <div style={{ color: 'var(--neon-green)', fontSize: '14px', fontWeight: 700, marginTop: '6px' }}>→ ₹{Math.floor(betAmount * multiplier).toLocaleString()}</div>}
              </div>
            )}

            {state.user && (
              <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '14px' }}>₹{state.user.balance.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '14px' }}>🏁 Flight History</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {history.map((v, i) => (
                <div key={i} style={{ background: v <= 1.5 ? 'var(--neon-red)15' : v >= 10 ? 'var(--neon-gold)15' : 'var(--neon-green)15', color: v <= 1.5 ? 'var(--neon-red)' : v >= 10 ? 'var(--neon-gold)' : 'var(--neon-green)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 700 }}>{v.toFixed(2)}x</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
