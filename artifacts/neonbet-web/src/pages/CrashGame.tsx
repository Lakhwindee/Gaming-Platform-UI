import { useEffect, useRef, useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

type Phase = 'waiting' | 'flying' | 'crashed';
type Bullet = { x: number; y: number; speed: number; opacity: number };

const HISTORY_ITEMS = [2.14, 1.01, 8.56, 3.22, 1.01, 15.4, 2.87, 1.01, 4.12, 1.01, 22.8, 1.01, 1.63, 5.5, 1.01];
const HOUSE_COLORS = ['#E8A090', '#90C890', '#B090E8', '#E8D870', '#D890D8', '#70C8D8', '#F0B060', '#80D8A0'];
const ROOF_COLORS  = ['#8B2500', '#2A5C28', '#4040A0', '#B09000', '#8B2060', '#006080', '#904010', '#105050'];

function getMultiplier(elapsedSec: number): number {
  return Math.floor(Math.pow(Math.E, 0.077 * elapsedSec) * 100) / 100;
}

// ─── Canvas helper ──────────────────────────────────────────────────────────
function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  [[0,0,s*0.5],[s*0.42,s*0.1,s*0.38],[-(s*0.42),s*0.12,s*0.33],[s*0.2,-(s*0.18),s*0.44]].forEach(([dx, dy, r]) => {
    ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill();
  });
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  // Trunk
  ctx.fillStyle = '#6B4226';
  ctx.fillRect(x - 5, groundY - 38, 10, 38);
  // Foliage (3 circles)
  ctx.fillStyle = '#2E8B2E';
  ctx.beginPath(); ctx.arc(x, groundY - 55, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3AAA3A';
  ctx.beginPath(); ctx.arc(x - 12, groundY - 46, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 12, groundY - 46, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4EC94E';
  ctx.beginPath(); ctx.arc(x, groundY - 60, 14, 0, Math.PI * 2); ctx.fill();
}

function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, wallColor: string, roofColor: string) {
  const W = 130, H = 90;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x + 8, y + H + 2, W, 6);
  // Wall
  ctx.fillStyle = wallColor;
  ctx.beginPath();
  ctx.roundRect(x, y, W, H, 4);
  ctx.fill();
  // Roof
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 2);
  ctx.lineTo(x + W / 2, y - 48);
  ctx.lineTo(x + W + 12, y + 2);
  ctx.closePath();
  ctx.fill();
  // Roof ridge
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 2);
  ctx.lineTo(x + W / 2, y - 48);
  ctx.lineTo(x + W + 12, y + 2);
  ctx.stroke();
  // Door
  ctx.fillStyle = '#6B3410';
  ctx.beginPath();
  ctx.roundRect(x + 48, y + H - 38, 34, 38, [4, 4, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.arc(x + 77, y + H - 20, 3.5, 0, Math.PI * 2); ctx.fill();
  // Windows
  [x + 10, x + W - 42].forEach(wx => {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(wx, y + 18, 32, 28);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wx + 16, y + 18); ctx.lineTo(wx + 16, y + 46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx, y + 32); ctx.lineTo(wx + 32, y + 32); ctx.stroke();
    // Glow behind window
    ctx.fillStyle = 'rgba(255,255,100,0.18)';
    ctx.fillRect(wx, y + 18, 32, 28);
  });
  // Chimney
  ctx.fillStyle = '#8B5A2B';
  ctx.fillRect(x + W - 30, y - 60, 16, 30);
  // Chimney smoke
  ctx.fillStyle = 'rgba(180,180,180,0.5)';
  ctx.beginPath(); ctx.arc(x + W - 22, y - 68, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + W - 18, y - 78, 5, 0, Math.PI * 2); ctx.fill();
}

function drawJerry(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, mode: 'run'|'walk'|'scared') {
  ctx.save();
  const cycle = mode === 'run' ? Math.sin(t * 16) : Math.sin(t * 6);
  const bob = mode === 'scared' ? -8 : Math.abs(Math.sin(mode === 'run' ? t * 16 : t * 6)) * -4;
  ctx.translate(cx, cy + bob);
  if (mode !== 'scared') ctx.rotate(-0.18); // lean forward

  // Tail
  ctx.strokeStyle = '#B07830'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -14);
  ctx.quadraticCurveTo(-22, -32 + Math.sin(t * 7) * 6, -18, -52 + Math.sin(t * 5) * 4);
  ctx.stroke();
  // Tail tip (white)
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-18, -52 + Math.sin(t * 5) * 4, 5, 0, Math.PI * 2); ctx.fill();

  // LEGS
  const l1 = cycle * 12, l2 = -cycle * 12;
  [[- 6, l1], [6, l2]].forEach(([lx, ly]) => {
    ctx.fillStyle = '#A07030';
    ctx.beginPath(); ctx.ellipse(lx, -5 + ly, 5, 9, cycle * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C49060';
    ctx.beginPath(); ctx.ellipse(lx + (lx < 0 ? -3 : 3), 3 + ly, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  });

  // BODY
  ctx.fillStyle = '#C8963F';
  ctx.beginPath(); ctx.ellipse(0, -20, 13, 16, 0, 0, Math.PI * 2); ctx.fill();
  // Belly
  ctx.fillStyle = '#E8C080';
  ctx.beginPath(); ctx.ellipse(2, -19, 7, 10, 0.1, 0, Math.PI * 2); ctx.fill();

  // ARMS
  if (mode === 'scared') {
    // arms up in panic
    ctx.strokeStyle = '#C8963F'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, -28); ctx.lineTo(-22, -42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -28); ctx.lineTo(22, -42); ctx.stroke();
  } else {
    // pumping arms while running
    ctx.strokeStyle = '#C8963F'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10, -28); ctx.lineTo(-20, -18 + cycle * 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -28); ctx.lineTo(20, -18 - cycle * 6); ctx.stroke();
  }

  // HEAD
  ctx.fillStyle = '#C8963F';
  ctx.beginPath(); ctx.arc(0, -36, 15, 0, Math.PI * 2); ctx.fill();

  // EARS
  [[-12, -50], [12, -50]].forEach(([ex, ey]) => {
    ctx.fillStyle = '#D4A050'; ctx.beginPath(); ctx.arc(ex, ey, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F4C080'; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
  });

  // EYES
  const eyeX = mode === 'scared' ? [[-6, 3], [6, 3]] : [[-5, 2], [5, 2]];
  ctx.fillStyle = '#fff';
  eyeX.forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(ex, -38 + ey, 4, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#1a1a1a';
  eyeX.forEach(([ex, ey]) => {
    ctx.beginPath(); ctx.arc(ex + (mode === 'run' ? 1 : 0), -38 + ey, mode === 'scared' ? 3 : 2.2, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = '#fff';
  eyeX.forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(ex + 1, -39 + ey, 0.9, 0, Math.PI * 2); ctx.fill(); });

  // NOSE
  ctx.fillStyle = '#FF8888';
  ctx.beginPath(); ctx.arc(0, -33, 3.5, 0, Math.PI * 2); ctx.fill();

  // MOUTH
  if (mode === 'scared') {
    ctx.strokeStyle = '#8B5A1F'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -30, 5, 0, Math.PI); ctx.stroke(); // open mouth
    ctx.fillStyle = '#CC4444';
    ctx.beginPath(); ctx.arc(0, -30, 5, 0, Math.PI); ctx.fill();
  } else {
    ctx.strokeStyle = '#8B5A1F'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, -31, 4, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  ctx.restore();
}

function drawTom(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, mode: 'run'|'walk'|'catch') {
  ctx.save();
  const cycle = mode === 'run' ? Math.sin(t * 16 + 0.5) : Math.sin(t * 6 + 0.5);
  const bob = mode === 'catch' ? 0 : Math.abs(Math.sin(mode === 'run' ? t * 16 : t * 6)) * -4;
  ctx.translate(cx, cy + bob);
  if (mode !== 'catch') ctx.rotate(-0.22); // forward lean

  // Tail
  ctx.strokeStyle = '#607890'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -18);
  ctx.quadraticCurveTo(-30, -50 + Math.sin(t * 7) * 10, -26, -72 + Math.sin(t * 5) * 6);
  ctx.stroke();
  // Tail tip
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-26, -72 + Math.sin(t * 5) * 6, 7, 0, Math.PI * 2); ctx.fill();

  // LEGS
  const l1 = cycle * 14, l2 = -cycle * 14;
  [[- 8, l1], [8, l2]].forEach(([lx, ly]) => {
    ctx.fillStyle = '#506880';
    ctx.beginPath(); ctx.ellipse(lx, -6 + ly, 6, 11, cycle * 0.35, 0, Math.PI * 2); ctx.fill();
    // Foot
    ctx.fillStyle = '#2A3848';
    ctx.beginPath(); ctx.ellipse(lx + (lx < 0 ? -4 : 4), 5 + ly, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  });

  // BODY
  ctx.fillStyle = '#607890';
  ctx.beginPath(); ctx.ellipse(0, -26, 18, 22, 0, 0, Math.PI * 2); ctx.fill();
  // Belly
  ctx.fillStyle = '#E8D8B8';
  ctx.beginPath(); ctx.ellipse(2, -24, 9, 14, 0.08, 0, Math.PI * 2); ctx.fill();

  // ARMS
  if (mode === 'catch') {
    // Both arms wrapping around (catching Jerry)
    ctx.strokeStyle = '#607890'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(16, -32); ctx.quadraticCurveTo(38, -22, 34, -12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, -28); ctx.quadraticCurveTo(42, -10, 36, 2); ctx.stroke();
    ctx.fillStyle = '#607890';
    ctx.beginPath(); ctx.arc(34, -10, 8, 0, Math.PI * 2); ctx.fill();
  } else {
    // Running arms + reaching forward
    ctx.strokeStyle = '#607890'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(16, -34); ctx.quadraticCurveTo(30, -28, 42, -20 + cycle * 4); ctx.stroke();
    ctx.fillStyle = '#607890';
    ctx.beginPath(); ctx.arc(42, -20 + cycle * 4, 7, 0, Math.PI * 2); ctx.fill();
    // Left arm swinging
    ctx.strokeStyle = '#4A6070'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-16, -32); ctx.lineTo(-28, -20 - cycle * 6); ctx.stroke();
  }

  // HEAD
  ctx.fillStyle = '#607890';
  ctx.beginPath(); ctx.ellipse(0, -50, 18, 16, 0, 0, Math.PI * 2); ctx.fill();

  // POINTY EARS
  [[-14, -62, -22, -80, -5, -68], [14, -62, 22, -80, 5, -68]].forEach(([bx1, by1, tx, ty, bx2, by2]) => {
    ctx.fillStyle = '#4A6878';
    ctx.beginPath(); ctx.moveTo(bx1, by1); ctx.lineTo(tx, ty); ctx.lineTo(bx2, by2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FF9999';
    ctx.beginPath(); ctx.moveTo(bx1 + 2, by1 + 2); ctx.lineTo(tx, ty + 6); ctx.lineTo(bx2 - 2, by2 + 2); ctx.closePath(); ctx.fill();
  });

  // EYES
  ctx.fillStyle = '#fff';
  [[-7, -52], [7, -52]].forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(ex, ey, 5.5, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#1a1a1a';
  [[-7, -52], [7, -52]].forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(ex + (mode !== 'catch' ? 1.5 : 0), ey, 3, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#fff';
  [[-6, -53], [8, -53]].forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(ex, ey, 1.1, 0, Math.PI * 2); ctx.fill(); });
  // ANGRY BROWS
  ctx.strokeStyle = '#2A3848'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-12, -59); ctx.lineTo(-3, -57); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(12, -59); ctx.lineTo(3, -57); ctx.stroke();

  // NOSE
  ctx.fillStyle = '#FF6666';
  ctx.beginPath(); ctx.arc(0, -46, 4, 0, Math.PI * 2); ctx.fill();

  // WHISKERS
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  [[-6, -45, -28, -42], [-6, -44, -28, -47], [6, -45, 28, -42], [6, -44, 28, -47]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });

  // MOUTH
  if (mode === 'catch') {
    // Big grin
    ctx.strokeStyle = '#2A3848'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -40, 7, 0.1, Math.PI - 0.1); ctx.stroke();
    ctx.fillStyle = '#CC3333';
    ctx.beginPath(); ctx.arc(0, -40, 7, 0.1, Math.PI - 0.1); ctx.fill();
  } else {
    ctx.strokeStyle = '#2A3848'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -42, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.4;
    if (i === 0) ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    else ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.closePath(); ctx.fill();
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function CrashGame() {
  const { state, navigate, addHistory, addNotification } = useGame();

  const [phase, setPhase] = useState<Phase>('waiting');
  const [multiplier, setMultiplier] = useState(1.0);
  const [betAmount, setBetAmount] = useState(100);
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [crashPoint, setCrashPoint] = useState(0);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [history, setHistory] = useState(HISTORY_ITEMS);
  const [resultMsg, setResultMsg] = useState<{ text: string; win: boolean } | null>(null);
  const [bets, setBets] = useState([
    { user: 'Player1', amount: 250, status: 'active', cashout: null as number | null },
    { user: 'CryptoKing', amount: 1000, status: 'active', cashout: null as number | null },
    { user: 'NeonBlade', amount: 750, status: 'active', cashout: null as number | null },
    { user: 'StarDust', amount: 500, status: 'active', cashout: null as number | null },
  ]);

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRef       = useRef<number>(0);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const startTimeRef  = useRef(0);
  const crashPointRef = useRef(0);
  const multiplierRef = useRef(1.0);
  const phaseRef      = useRef<Phase>('waiting');
  const hasActiveBetRef = useRef(false);
  const cashedOutRef  = useRef<number | null>(null);
  const scrollRef     = useRef(0);
  const crashTimeRef  = useRef(0);

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
    phaseRef.current = 'waiting';
    setPhase('waiting');
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    setCashedOutAt(null);
    cashedOutRef.current = null;
    setResultMsg(null);
    hasActiveBetRef.current = false;
    setHasActiveBet(false);
    setBets([
      { user: 'Player1',   amount: 250  + Math.floor(Math.random() * 750),  status: 'active', cashout: null },
      { user: 'CryptoKing',amount: 500  + Math.floor(Math.random() * 1500), status: 'active', cashout: null },
      { user: 'NeonBlade', amount: 250  + Math.floor(Math.random() * 1000), status: 'active', cashout: null },
      { user: 'StarDust',  amount: 100  + Math.floor(Math.random() * 500),  status: 'active', cashout: null },
    ]);

    const cp = generateCrashPoint();
    setCrashPoint(cp);
    crashPointRef.current = cp;

    let t = 5;
    setCountdown(t);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      t--;
      setCountdown(t);
      if (t <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        startFlight();
      }
    }, 1000);
  }

  function startFlight() {
    phaseRef.current = 'flying';
    setPhase('flying');
    startTimeRef.current = Date.now();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const m = getMultiplier(elapsed);
      multiplierRef.current = m;
      setMultiplier(m);

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
    cashedOutRef.current = atMult;
    setCashedOutAt(atMult);
    hasActiveBetRef.current = false;
    setHasActiveBet(false);
    const payout = Math.floor(betAmount * atMult);
    const profit = payout - betAmount;
    setResultMsg({ text: `Cashed out at ${atMult.toFixed(2)}x! +₹${profit.toLocaleString()}`, win: true });
    if (state.user) {
      addHistory({ id: makeId(), game: 'crash', wager: betAmount, multiplier: atMult, payout, won: true, timestamp: Date.now() });
      addNotification(`🐭 Escaped at ${atMult.toFixed(2)}x! +₹${profit.toLocaleString()}`, 'win');
    }
  }

  function doCrash(finalMult: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    phaseRef.current = 'crashed';
    setPhase('crashed');
    crashTimeRef.current = Date.now();
    setHistory(prev => [Math.floor(finalMult * 100) / 100, ...prev].slice(0, 15));

    if (hasActiveBetRef.current && !cashedOutRef.current) {
      setResultMsg({ text: `Tom caught Jerry at ${finalMult.toFixed(2)}x! Lost ₹${betAmount.toLocaleString()}`, win: false });
      if (state.user) {
        addHistory({ id: makeId(), game: 'crash', wager: betAmount, multiplier: finalMult, payout: 0, won: false, timestamp: Date.now() });
      }
      hasActiveBetRef.current = false;
      setHasActiveBet(false);
    }

    setBets(prev => prev.map(b => b.status === 'active' ? { ...b, status: 'crashed' } : b));
    setTimeout(() => startCountdown(), 4000);
  }

  function placeBet() {
    if (!state.user) { navigate('profile'); return; }
    if (state.user.balance < betAmount) { alert('Insufficient balance!'); return; }
    if (phase !== 'waiting') { alert('Wait for next round!'); return; }
    hasActiveBetRef.current = true;
    setHasActiveBet(true);
    setBets(prev => [{ user: state.user!.username, amount: betAmount, status: 'active', cashout: null }, ...prev]);
  }

  function cashOut() {
    if (!hasActiveBetRef.current || phaseRef.current !== 'flying' || cashedOutRef.current) return;
    doCashout(multiplierRef.current);
  }

  // ─── CANVAS ANIMATION LOOP ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const GROUND_Y = 268; // sidewalk top (characters stand here)

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;
      const phase = phaseRef.current;
      const m = multiplierRef.current;
      const iscrashed = phase === 'crashed';
      const isflying  = phase === 'flying';

      // Scroll speed proportional to multiplier
      const speed = isflying ? 2 + (m - 1) * 1.8 : iscrashed ? 0.4 : 0.8;
      scrollRef.current += speed;
      const sc = scrollRef.current;

      // ── SKY ──────────────────────────────────────────────────────────────
      const skyG = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyG.addColorStop(0, '#1A6FC4');
      skyG.addColorStop(0.5, '#4A9FE8');
      skyG.addColorStop(1, '#87CEEB');
      ctx.fillStyle = skyG;
      ctx.fillRect(0, 0, W, GROUND_Y);

      // ── SUN ──────────────────────────────────────────────────────────────
      const sunX = W - 90, sunY = 55;
      ctx.fillStyle = '#FFE844';
      ctx.shadowColor = '#FFE844'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(sunX, sunY, 32, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Sun rays
      ctx.strokeStyle = 'rgba(255,230,60,0.45)'; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 0.3;
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(a) * 38, sunY + Math.sin(a) * 38);
        ctx.lineTo(sunX + Math.cos(a) * 52, sunY + Math.sin(a) * 52);
        ctx.stroke();
      }

      // ── CLOUDS (slow parallax) ─────────────────────────────────────────
      const cloudData = [[80, 55, 55], [280, 38, 42], [480, 62, 38], [650, 45, 48]];
      cloudData.forEach(([bx, by, s]) => {
        const cx = ((bx - sc * 0.18) % (W + 150) + W + 150) % (W + 150);
        drawCloud(ctx, cx, by, s);
      });

      // ── DISTANT HILLS ────────────────────────────────────────────────────
      ctx.fillStyle = '#6AAA6A';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y - 10);
      for (let x = 0; x <= W; x += 5) {
        const hillX = ((x - sc * 0.3) % 800 + 800) % 800;
        const hy = 20 * Math.sin(hillX * 0.012) + 15 * Math.sin(hillX * 0.025);
        ctx.lineTo(x, GROUND_Y - 22 + hy);
      }
      ctx.lineTo(W, GROUND_Y); ctx.lineTo(0, GROUND_Y); ctx.closePath(); ctx.fill();

      // ── HOUSES (medium parallax) ─────────────────────────────────────────
      const HOUSE_SPACING = 210;
      const NUM_HOUSES = Math.ceil(W / HOUSE_SPACING) + 3;
      for (let i = 0; i < NUM_HOUSES; i++) {
        const hx = ((i * HOUSE_SPACING - sc * 1.4) % (NUM_HOUSES * HOUSE_SPACING) + NUM_HOUSES * HOUSE_SPACING) % (NUM_HOUSES * HOUSE_SPACING);
        if (hx < W + 160) {
          drawHouse(ctx, hx - 20, GROUND_Y - 120, HOUSE_COLORS[i % HOUSE_COLORS.length], ROOF_COLORS[i % ROOF_COLORS.length]);
        }
      }

      // ── TREES (fast parallax) ─────────────────────────────────────────────
      const TREE_SPACING = 140;
      const NUM_TREES = Math.ceil(W / TREE_SPACING) + 3;
      for (let i = 0; i < NUM_TREES; i++) {
        const tx = ((i * TREE_SPACING + 60 - sc * 2.5) % (NUM_TREES * TREE_SPACING) + NUM_TREES * TREE_SPACING) % (NUM_TREES * TREE_SPACING);
        if (tx < W + 60) drawTree(ctx, tx, GROUND_Y);
      }

      // ── FENCE ──────────────────────────────────────────────────────────
      ctx.fillStyle = '#F0E8D0';
      const FENCE_SPACING = 28;
      const NUM_POSTS = Math.ceil(W / FENCE_SPACING) + 3;
      for (let i = 0; i < NUM_POSTS; i++) {
        const fx = ((i * FENCE_SPACING - sc * 3.5) % (NUM_POSTS * FENCE_SPACING) + NUM_POSTS * FENCE_SPACING) % (NUM_POSTS * FENCE_SPACING);
        if (fx < W + 10) {
          ctx.fillRect(fx, GROUND_Y - 34, 5, 28);
          ctx.fillRect(fx, GROUND_Y - 30, 10, 6); // top rail
        }
      }
      ctx.fillRect(0, GROUND_Y - 22, W, 5); // horizontal rail
      ctx.fillRect(0, GROUND_Y - 12, W, 5);

      // ── SIDEWALK ──────────────────────────────────────────────────────────
      const swG = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 28);
      swG.addColorStop(0, '#D0C8B8');
      swG.addColorStop(1, '#B8B0A0');
      ctx.fillStyle = swG;
      ctx.fillRect(0, GROUND_Y, W, 28);
      // Sidewalk cracks (scrolling)
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const cx2 = ((i * 90 - sc * 2.8) % (10 * 90) + 10 * 90) % (10 * 90);
        if (cx2 < W) { ctx.beginPath(); ctx.moveTo(cx2, GROUND_Y); ctx.lineTo(cx2, GROUND_Y + 28); ctx.stroke(); }
      }

      // ── ROAD ──────────────────────────────────────────────────────────────
      const roadG = ctx.createLinearGradient(0, GROUND_Y + 28, 0, H);
      roadG.addColorStop(0, '#484848');
      roadG.addColorStop(1, '#383838');
      ctx.fillStyle = roadG;
      ctx.fillRect(0, GROUND_Y + 28, W, H - GROUND_Y - 28);

      // Road edge yellow line
      ctx.strokeStyle = '#FFDD00'; ctx.lineWidth = 3;
      ctx.setLineDash([32, 18]); ctx.lineDashOffset = -(sc * 3.5) % 50;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 36); ctx.lineTo(W, GROUND_Y + 36); ctx.stroke();
      ctx.setLineDash([]);

      // Center white dashes
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
      ctx.setLineDash([44, 30]); ctx.lineDashOffset = -(sc * 4.5) % 74;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 70); ctx.lineTo(W, GROUND_Y + 70); ctx.stroke();
      ctx.setLineDash([]);

      // ── CHARACTERS ────────────────────────────────────────────────────────
      const jerryX = Math.round(W * 0.60);
      const tomX   = Math.round(W * 0.38);

      if (iscrashed) {
        const cTime = (Date.now() - crashTimeRef.current) / 1000;
        // Tom moves toward Jerry over 0.5s then holds
        const progress = Math.min(cTime / 0.5, 1);
        const tomCatchX = tomX + (jerryX - 35 - tomX) * progress;
        // Jerry scared, lifted slightly
        const jerryLiftY = Math.min(cTime / 0.5, 1) * 20;

        drawJerry(ctx, jerryX + 10, GROUND_Y - jerryLiftY, t, 'scared');
        drawTom(ctx, tomCatchX, GROUND_Y, t, 'catch');

        // Stars spinning around them
        if (cTime > 0.4) {
          const starColors = ['#FFD700', '#FF4444', '#44FF44', '#FF44FF', '#44FFFF'];
          for (let s = 0; s < 6; s++) {
            const sa = (s / 6) * Math.PI * 2 + cTime * 4;
            const sr = 38 + Math.sin(cTime * 8 + s) * 8;
            const sx = (tomCatchX + jerryX) / 2 + 5 + Math.cos(sa) * sr;
            const sy = GROUND_Y - 35 + Math.sin(sa) * sr * 0.4;
            drawStar(ctx, sx, sy, 8 + (s % 3) * 3, starColors[s % starColors.length]);
          }
          // BANG / CAUGHT text
          if (cTime > 0.7) {
            ctx.save();
            ctx.font = 'bold 28px Impact, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#B8000A';
            ctx.lineWidth = 4;
            const bx = (tomCatchX + jerryX) / 2 + 5;
            const by2 = GROUND_Y - 88 + Math.sin(cTime * 6) * 4;
            ctx.strokeText('GOTCHA! 🐱', bx, by2);
            ctx.fillText('GOTCHA! 🐱', bx, by2);
            ctx.restore();
          }
        }

      } else if (isflying) {
        drawJerry(ctx, jerryX, GROUND_Y, t, 'run');
        drawTom(ctx, tomX, GROUND_Y, t, 'run');
        // Speed lines when fast
        if (m > 3) {
          ctx.globalAlpha = Math.min((m - 3) / 8, 0.35);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          for (let sl = 0; sl < 12; sl++) {
            const slY = 100 + sl * 15 + ((sl * 37 + sc * 2) % 60) - 30;
            const slX = ((sl * 83 + sc * 5) % (W + 80)) - 40;
            ctx.beginPath(); ctx.moveTo(slX, slY); ctx.lineTo(slX + 40 + sl * 3, slY); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      } else {
        // Waiting — characters walk slowly
        drawJerry(ctx, jerryX - 30, GROUND_Y, t, 'walk');
        drawTom(ctx, tomX - 50, GROUND_Y, t, 'walk');
      }

      // ── MULTIPLIER HUD ────────────────────────────────────────────────────
      if (isflying) {
        const mColor = m >= 5 ? '#00ff88' : m >= 3 ? '#FFD700' : m >= 2 ? '#FF9900' : '#00DDFF';
        // HUD box
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 80, 8, 160, 62, 12); ctx.fill();
        ctx.strokeStyle = mColor + '88'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(W / 2 - 80, 8, 160, 62, 12); ctx.stroke();

        ctx.font = 'bold 48px Inter, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = mColor;
        ctx.shadowColor = mColor; ctx.shadowBlur = 22;
        ctx.fillText(`${m.toFixed(2)}x`, W / 2, 14);
        ctx.shadowBlur = 0;
      } else if (!iscrashed) {
        // Waiting — show "RACE STARTS IN..."
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.roundRect(W / 2 - 110, 8, 220, 56, 12); ctx.fill();
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#aaa';
        ctx.fillText('RACE STARTS IN', W / 2, 14);
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.fillStyle = '#00DDFF';
        ctx.shadowColor = '#00DDFF'; ctx.shadowBlur = 14;
        ctx.fillText(`${Math.ceil(Math.max((5000 - (Date.now() - startTimeRef.current)) / 1000, 0))}s`, W / 2, 32);
        ctx.shadowBlur = 0;
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
    : multiplier >= 3 ? 'var(--neon-green)'
    : multiplier >= 2 ? 'var(--neon-gold)'
    : 'var(--neon-blue)';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', animation: 'slideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('fastgames')} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '8px 16px', color: 'var(--text2)', cursor: 'pointer', fontSize: '14px',
        }}>← Back</button>
        <h1 style={{ fontWeight: 800, fontSize: '24px' }}>🐭 Crash — Tom & Jerry Chase</h1>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {history.slice(0, 12).map((v, i) => (
            <div key={i} style={{
              background: v <= 1.5 ? 'var(--neon-red)20' : v >= 10 ? 'var(--neon-gold)20' : 'var(--neon-green)20',
              color:      v <= 1.5 ? 'var(--neon-red)'   : v >= 10 ? 'var(--neon-gold)'   : 'var(--neon-green)',
              borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700,
            }}>{v.toFixed(2)}x</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        {/* Canvas area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: '#1A6FC4', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
          }}>
            <canvas ref={canvasRef} width={720} height={360} style={{ width: '100%', display: 'block' }} />

            {/* Crashed overlay */}
            {phase === 'crashed' && (
              <div style={{
                position: 'absolute', top: '52%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center', pointerEvents: 'none',
                animation: 'scaleIn 0.3s ease',
              }}>
                <div style={{ fontSize: '54px', fontWeight: 900, color: 'var(--neon-red)', textShadow: '0 0 40px var(--neon-red)', lineHeight: 1 }}>
                  CAUGHT!
                </div>
                <div style={{ color: 'var(--neon-red)', fontWeight: 700, fontSize: '18px', marginTop: '6px' }}>
                  Tom got Jerry at {multiplier.toFixed(2)}x
                </div>
              </div>
            )}
          </div>

          {/* Result banner */}
          {resultMsg && (
            <div style={{
              padding: '16px 20px', borderRadius: 'var(--radius)',
              background: resultMsg.win ? 'var(--neon-green)15' : 'var(--neon-red)15',
              border: `1px solid ${resultMsg.win ? 'var(--neon-green)40' : 'var(--neon-red)40'}`,
              color: resultMsg.win ? 'var(--neon-green)' : 'var(--neon-red)',
              fontWeight: 700, fontSize: '18px', textAlign: 'center',
              animation: 'scaleIn 0.3s ease',
            }}>
              {resultMsg.win ? '🐭 Jerry escaped!' : '🐱 Tom caught Jerry!'} {resultMsg.text}
            </div>
          )}

          {/* Live bets */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>👥 Live Bets</span>
              <span style={{ color: 'var(--text3)', fontSize: '13px' }}>{bets.length} players</span>
            </div>
            <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
              {bets.map((b, i) => (
                <div key={i} style={{
                  padding: '10px 18px',
                  borderBottom: i < bets.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: b.status === 'crashed' ? 'var(--neon-red)' : b.status === 'cashed' ? 'var(--neon-green)' : 'var(--neon-blue)',
                      animation: b.status === 'active' ? 'pulse 1.5s infinite' : 'none',
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{b.user}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)', fontSize: '13px' }}>₹{b.amount.toLocaleString()}</span>
                    {b.status === 'cashed'  && <span style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '13px' }}>🐭 Escaped {b.cashout?.toFixed(2)}x</span>}
                    {b.status === 'crashed' && <span style={{ color: 'var(--neon-red)',   fontWeight: 700, fontSize: '13px' }}>🐱 Caught!</span>}
                    {b.status === 'active'  && <span style={{ color: 'var(--neon-blue)',  fontSize: '12px', fontStyle: 'italic' }}>Running...</span>}
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
            <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
              disabled={phase !== 'waiting'}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginBottom: '16px' }}>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setBetAmount(v)} disabled={phase !== 'waiting'} style={{
                  background: betAmount === v ? 'var(--neon-blue)20' : 'var(--bg3)',
                  border: `1px solid ${betAmount === v ? 'var(--neon-blue)' : 'var(--border)'}`,
                  color: betAmount === v ? 'var(--neon-blue)' : 'var(--text2)',
                  borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}>{v}</button>
              ))}
            </div>

            <label style={{ display: 'block', color: 'var(--text2)', fontSize: '12px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px' }}>AUTO CASHOUT AT</label>
            <input type="number" value={autoCashout} step="0.1" min="1.1" onChange={e => setAutoCashout(Number(e.target.value))}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', color: 'var(--text)', fontSize: '15px', fontWeight: 700, marginBottom: '20px' }} />

            {!hasActiveBet ? (
              <button onClick={placeBet} disabled={phase !== 'waiting'} style={{
                width: '100%',
                background: phase === 'waiting' ? 'linear-gradient(135deg, #FF6B35, #FF3B8A)' : 'var(--bg3)',
                color: phase === 'waiting' ? '#fff' : 'var(--text2)',
                border: 'none', borderRadius: 'var(--radius)', padding: '16px',
                fontWeight: 800, fontSize: '16px', cursor: phase === 'waiting' ? 'pointer' : 'not-allowed',
              }}>
                {phase === 'waiting' ? `🐭 Help Jerry! ₹${betAmount.toLocaleString()}` : '🏃 Race in progress...'}
              </button>
            ) : (
              <button onClick={cashOut} disabled={phase !== 'flying' || !!cashedOutAt} style={{
                width: '100%',
                background: !cashedOutAt && phase === 'flying' ? 'var(--neon-green)' : 'var(--bg3)',
                color: !cashedOutAt && phase === 'flying' ? '#000' : 'var(--text2)',
                border: 'none', borderRadius: 'var(--radius)', padding: '16px',
                fontWeight: 800, fontSize: '16px',
                cursor: !cashedOutAt && phase === 'flying' ? 'pointer' : 'not-allowed',
                animation: !cashedOutAt && phase === 'flying' ? 'neonPulse 1.5s infinite' : 'none',
              }}>
                {cashedOutAt
                  ? `✅ Jerry escaped at ${cashedOutAt.toFixed(2)}x`
                  : `🐭 Escape now! ₹${Math.floor(betAmount * multiplier).toLocaleString()}`}
              </button>
            )}

            {phase === 'flying' && (
              <div style={{ marginTop: '14px', padding: '14px', borderRadius: '12px', textAlign: 'center', background: 'var(--bg3)', border: `1px solid ${multColor}40` }}>
                <div style={{ color: 'var(--text3)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>DISTANCE MULTIPLIER</div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: multColor, textShadow: `0 0 20px ${multColor}`, lineHeight: 1 }}>
                  {multiplier.toFixed(2)}x
                </div>
                {hasActiveBet && !cashedOutAt && (
                  <div style={{ color: 'var(--neon-green)', fontSize: '14px', fontWeight: 700, marginTop: '6px' }}>
                    → ₹{Math.floor(betAmount * multiplier).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {state.user && (
              <div style={{ marginTop: '12px', padding: '12px', borderRadius: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text2)', fontSize: '13px' }}>Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--neon-gold)', fontSize: '14px' }}>₹{state.user.balance.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Round history */}
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '14px' }}>🏁 Race History</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {history.map((v, i) => (
                <div key={i} style={{
                  background: v <= 1.5 ? 'var(--neon-red)15'  : v >= 10 ? 'var(--neon-gold)15' : 'var(--neon-green)15',
                  color:      v <= 1.5 ? 'var(--neon-red)'    : v >= 10 ? 'var(--neon-gold)'   : 'var(--neon-green)',
                  borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 700,
                }}>{v.toFixed(2)}x</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
