import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { WSC, wsSend, wsSendReliable, Phase, RoundBet, TopBet } from '../lib/wsClient';
import { startAmbient, stopAmbient, playBlast, playCashout, updateAmbientMult } from '../lib/soundEngine';

// ── Constants (copied from Expo) ──────────────────────────────────────────
const C = {
  bg: '#08020E',
  bgCard: 'rgba(180,0,40,0.13)',
  bgCardBright: 'rgba(220,0,50,0.18)',
  border: 'rgba(255,30,60,0.22)',
  borderBright: 'rgba(255,50,80,0.45)',
  primary: '#CC0022',
  primaryBright: '#FF1A3A',
  gold: '#FFD700',
  green: '#00C853',
  orange: '#FF6B00',
  red: '#FF1A3A',
  text: '#FFFFFF',
  textSoft: '#E8D0D8',
  textMuted: '#AA7788',
  textDim: '#664455',
  tabBg: '#110008',
};

const AVATAR_COLORS = ['#E53935','#8E24AA','#1E88E5','#00897B','#F4511E','#6D4C41','#546E7A','#43A047'];
const AVATAR_EMOJI  = ['🦅','🚀','🎯','💰','🔥','⚡','🌙','🎲'];

function multColor(m: number): string {
  if (m >= 10) return '#7B2FFF';
  if (m >= 2)  return '#54B3FF';
  return '#F1222A';
}

// ── Canvas geometry ───────────────────────────────────────────────────────
const CV_H = 260;
function getPos(elapsed: number, cvW: number): { x: number; y: number } {
  const origX = cvW * 0.09, origY = CV_H * 0.88;
  const MAX_T = 40;
  const t = Math.min(elapsed / MAX_T, 1);
  const x = origX + t * t * (cvW * 0.88 - origX);
  const y = origY - Math.sqrt(t) * (CV_H * 0.76);
  return { x, y: Math.max(y, 22) };
}
function calcMult(elapsed: number): number {
  return Math.floor(Math.pow(Math.E, 0.077 * elapsed) * 100) / 100;
}

// ── Slot types ────────────────────────────────────────────────────────────
type SlotStatus = 'idle' | 'placed' | 'queued' | 'active' | 'cashedout' | 'lost';
interface SlotState {
  amount: number;
  input: string;
  status: SlotStatus;
  cashedOutAt: number | null;
  result: { text: string; win: boolean } | null;
}
const mkSlot = (amt: number): SlotState => ({ amount: amt, input: String(amt), status: 'idle', cashedOutAt: null, result: null });
type BetsTab = 'all' | 'prev' | 'top';
type TopSort = 'X' | 'Win' | 'Rounds';
type TopTime = 'Day' | 'Month' | 'Year';

// ── Rocket — vertical orientation matching Expo SVG exactly ──────────────
function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, flying: boolean, waiting: boolean, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2); // +90° so nose-up rocket follows path, same as Expo's angleDeg = angle*180/PI + 90

  const S = 26;

  // Flame — below body (positive y)
  if (flying) {
    const flOuter = ctx.createLinearGradient(0, 0, 0, S * 1.5);
    flOuter.addColorStop(0, 'rgba(255,215,0,0.9)');
    flOuter.addColorStop(0.45, 'rgba(255,107,0,0.7)');
    flOuter.addColorStop(1, 'rgba(255,26,58,0)');
    ctx.fillStyle = flOuter;
    ctx.beginPath(); ctx.ellipse(0, S * 0.85, 8, S * 0.62, 0, 0, Math.PI * 2); ctx.fill();

    const flMid = ctx.createLinearGradient(0, 0, 0, S * 1.1);
    flMid.addColorStop(0, 'rgba(255,255,255,0.95)');
    flMid.addColorStop(0.5, 'rgba(255,215,0,0.8)');
    flMid.addColorStop(1, 'rgba(255,107,0,0)');
    ctx.fillStyle = flMid;
    ctx.beginPath(); ctx.ellipse(0, S * 0.70, 4.5, S * 0.38, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(0, S * 0.56, 2, S * 0.20, 0, 0, Math.PI * 2); ctx.fill();
  }

  if (waiting) {
    const bob = Math.sin(t * 2.5) * 0.3;
    const flW = ctx.createLinearGradient(0, 0, 0, S * 1.1);
    flW.addColorStop(0, `rgba(255,215,0,${0.55 + bob * 0.35})`);
    flW.addColorStop(0.45, `rgba(255,107,0,${0.35 + bob * 0.25})`);
    flW.addColorStop(1, 'rgba(255,26,58,0)');
    ctx.fillStyle = flW;
    ctx.beginPath(); ctx.ellipse(0, S * 0.78, 6.5, S * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Fins
  ctx.fillStyle = '#D43050';
  ctx.beginPath(); ctx.moveTo(-8, S * 0.20); ctx.lineTo(-17, S * 0.55); ctx.lineTo(-8, S * 0.42); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(8,  S * 0.20); ctx.lineTo(17,  S * 0.55); ctx.lineTo(8,  S * 0.42); ctx.closePath(); ctx.fill();

  // Body
  const bodyGrad = ctx.createLinearGradient(-8, 0, 8, 0);
  bodyGrad.addColorStop(0, '#C8CED8'); bodyGrad.addColorStop(0.45, '#F0F2F8'); bodyGrad.addColorStop(1, '#9098A8');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.roundRect(-8, -S * 0.46, 16, S * 0.92, 4); ctx.fill();

  // Red stripe
  ctx.fillStyle = 'rgba(238,17,51,0.9)';
  ctx.beginPath(); ctx.roundRect(-3.5, -S * 0.44, 7, S * 0.26, 2); ctx.fill();

  // Window
  ctx.fillStyle = 'rgba(80,160,255,0.22)';
  ctx.strokeStyle = '#88CCFF'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, -S * 0.10, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(-1.5, -S * 0.10 - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();

  // Body highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.roundRect(-5, -S * 0.43, 2.5, S * 0.82, 1.2); ctx.fill();

  // Nose — pointing UP (negative y)
  const noseGrad = ctx.createLinearGradient(0, -S, 0, -S * 0.46);
  noseGrad.addColorStop(0, '#FFFFFF'); noseGrad.addColorStop(1, '#B8C0D0');
  ctx.fillStyle = noseGrad;
  ctx.beginPath(); ctx.moveTo(0, -S); ctx.lineTo(8, -S * 0.46); ctx.lineTo(-8, -S * 0.46); ctx.closePath(); ctx.fill();

  // Engine nozzle
  ctx.fillStyle = '#484E60';
  ctx.beginPath(); ctx.roundRect(-6.5, S * 0.44, 13, 5.5, 2); ctx.fill();

  ctx.restore();
}

function drawBlast(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save(); ctx.translate(x, y);
  const rings = [[38,0.10],[26,0.18],[17,0.28]];
  for (const [r, a] of rings) {
    ctx.fillStyle = `rgba(255,80,0,${a})`; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = '#FF6B00'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();
  [0,45,90,135,180,225,270,315].forEach((deg,i) => {
    const rad = (deg*Math.PI)/180, r1=13, r2=30+(i%3)*8;
    ctx.strokeStyle = i%2===0 ? '#FF6B00' : '#FFD700'; ctx.lineWidth = i%2===0 ? 2.5 : 1.5;
    ctx.lineCap = 'round'; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(Math.cos(rad)*r1,Math.sin(rad)*r1); ctx.lineTo(Math.cos(rad)*r2,Math.sin(rad)*r2); ctx.stroke();
  });
  ctx.globalAlpha = 1; ctx.restore();
}

const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: (Math.sin(i * 137.5) * 0.5 + 0.5),
  y: (Math.cos(i * 239.3) * 0.5 + 0.5) * 0.9,
  r: 0.5 + (i % 3) * 0.5,
}));

// ── Main component ────────────────────────────────────────────────────────
export default function CrashGame({ navigate }: { navigate: (t: string) => void }) {
  const { state } = useGame();
  const [, setTick] = useState(0);
  const [betsTab, setBetsTab] = useState<BetsTab>('all');
  const [topSort, setTopSort] = useState<TopSort>('X');
  const [topTime, setTopTime] = useState<TopTime>('Month');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [slot1, setSlot1] = useState<SlotState>(mkSlot(100));
  const [slot2, setSlot2] = useState<SlotState>(mkSlot(200));
  const slot1Ref = useRef(slot1);
  const slot2Ref = useRef(slot2);
  const stateRef = useRef(state);
  const prevPhaseRef = useRef<Phase>(WSC.state.phase);
  // Two-step confirm for queued bets (prevents accidental bets during flying)
  const [pendingConfirm, setPendingConfirm] = useState<[boolean, boolean]>([false, false]);
  const pendingConfirmRef = useRef<[boolean, boolean]>([false, false]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const confirmTimers = useRef<[ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]>([null, null]);

  useEffect(() => { slot1Ref.current = slot1; slot2Ref.current = slot2; stateRef.current = state; });

  const updateSlot = useCallback((idx: 0 | 1, patch: Partial<SlotState>) => {
    if (idx === 0) {
      setSlot1(s => {
        const next = { ...s, ...patch };
        slot1Ref.current = next;
        return next;
      });
    } else {
      setSlot2(s => {
        const next = { ...s, ...patch };
        slot2Ref.current = next;
        return next;
      });
    }
  }, []);

  // Phase change listener
  useEffect(() => {
    const update = () => {
      const newPhase = WSC.state.phase;
      const oldPhase = prevPhaseRef.current;
      if (oldPhase === 'crashed' && newPhase === 'waiting') {
        setSlot1(s => (s.status === 'cashedout' || s.status === 'lost') ? mkSlot(s.amount) : s);
        setSlot2(s => (s.status === 'cashedout' || s.status === 'lost') ? mkSlot(s.amount) : s);
      }
      if (newPhase === 'crashed') {
        // Mark active bets as lost
        if (slot1Ref.current.status === 'active') setSlot1(s => ({ ...s, status: 'lost', result: { text: 'LOST', win: false } }));
        if (slot2Ref.current.status === 'active') setSlot2(s => ({ ...s, status: 'lost', result: { text: 'LOST', win: false } }));
        // NOTE: 'placed' bets are NOT demoted to 'queued' here.
        // A 'placed' bet at crash time means bet_ok(auto:true) arrived slightly early
        // (race condition). It should remain 'placed' so waiting→flying can promote it
        // to 'active' in the correct new round.
        // 💥 Blast sound + stop ambient
        stopAmbient();
        playBlast();
      }
      if (oldPhase !== 'flying' && newPhase === 'flying') {
        // Only 'placed' bets (confirmed for current round) go active — 'queued' bets stay queued until next round's bet_ok
        if (slot1Ref.current.status === 'placed') setSlot1(s => ({ ...s, status: 'active' }));
        if (slot2Ref.current.status === 'placed') setSlot2(s => ({ ...s, status: 'active' }));
        // 🎵 Start ambient music when rocket flies
        startAmbient();
      }
      prevPhaseRef.current = newPhase;
      setTick(n => n + 1);
    };
    WSC.listeners.add(update);
    return () => { WSC.listeners.delete(update); };
  }, []);

  // Server messages
  useEffect(() => {
    const handler = (msg: Record<string, unknown>) => {
      const s = Number(msg.slot ?? 1);
      if (msg.type === 'bet_ok') {
        // Always set 'placed' — waiting→flying transition promotes to 'active'.
        // Using 'active' directly caused a race condition where auto:true arrived
        // while the client was still in the old 'flying' phase, incorrectly showing
        // CASHOUT + CANCEL BET for a queued bet in the wrong round.
        updateSlot(s === 2 ? 1 : 0, { status: 'placed' });
      }
      if (msg.type === 'bet_queued') updateSlot(s === 2 ? 1 : 0, { status: 'queued' });
      if (msg.type === 'bet_fail') {
        const idx = s === 2 ? 1 : 0;
        const errMsg = String(msg.error ?? 'Failed');
        const isOccupied = errMsg.toLowerCase().includes('already has a bet') || errMsg.toLowerCase().includes('already active');
        if (isOccupied) {
          // Server still has a live bet on this slot — restore so cancel button shows
          const ph = WSC.state.phase;
          const restored = ph === 'flying' ? 'active' : ph === 'crashed' ? 'queued' : 'placed';
          updateSlot(idx, { status: restored as SlotState['status'] });
        } else {
          updateSlot(idx, { status: 'idle', result: { text: errMsg, win: false } });
        }
      }
      // Restore bet state after WS reconnect
      if (msg.type === 'bet_state') {
        const bSlots = (msg as any).slots as Array<{ slot: number; active: boolean; queued: boolean; queuedAmount: number; amount: number }>;
        const ph = (msg as any).phase as string;
        bSlots.forEach((sl) => {
          const idx = (sl.slot - 1) as 0 | 1;
          if (sl.active) {
            updateSlot(idx, { status: ph === 'flying' ? 'active' : 'placed', amount: sl.amount });
          } else if (sl.queued) {
            updateSlot(idx, { status: 'queued', amount: sl.queuedAmount });
          }
        });
      }
      if (msg.type === 'bet_cancelled') updateSlot(s === 2 ? 1 : 0, { status: 'idle', result: null });
      if (msg.type === 'bet_cancel_fail') {
        // Revert to placed/active so user sees their bet is still live
        updateSlot(s === 2 ? 1 : 0, { status: 'active' });
      }
      if (msg.type === 'cashout_ok') {
        const m = Number(msg.mult);
        const payout = Number(msg.payout);
        updateSlot(s === 2 ? 1 : 0, {
          status: 'cashedout', cashedOutAt: m,
          result: { text: `+₹${payout.toLocaleString('en-IN')} @ ${m.toFixed(2)}x`, win: true },
        });
        playCashout(); // 🎵 Win chime
      }
      if (msg.type === 'cashout_fail') {
        // Cashout timed out or failed — revert to active so button stays visible
        updateSlot(s === 2 ? 1 : 0, { status: 'active' });
      }
    };
    WSC.msgListeners.add(handler);
    return () => { WSC.msgListeners.delete(handler); };
  }, [updateSlot]);

  // ── Canvas ──────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const elapsedRef = useRef(0);
  const startTimeRef = useRef(0);
  const smoothAngRef = useRef(-0.22);
  const crashTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Hi-DPI setup: scale canvas buffer by devicePixelRatio so it's crisp
    const setupHiDpi = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayW = canvas.clientWidth || 480;
      const displayH = CV_H;
      canvas.width = Math.round(displayW * dpr);
      canvas.height = Math.round(displayH * dpr);
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    };
    setupHiDpi();
    const ro = new ResizeObserver(() => { setupHiDpi(); });
    ro.observe(canvas);

    function draw(now: number) {
      const phase = WSC.state.phase;
      const W = (canvas!.clientWidth || 480), H = CV_H;

      // ── Elapsed — exactly like Expo: (Date.now() - server.startTime) / 1000 ──
      if (phase === 'flying' && WSC.state.startTime > 0) {
        elapsedRef.current = (Date.now() - WSC.state.startTime) / 1000;
      } else if (phase === 'waiting') {
        elapsedRef.current = 0; startTimeRef.current = 0; smoothAngRef.current = -Math.PI / 2;
      }
      if (phase === 'crashed') {
        if (crashTimeRef.current === 0) crashTimeRef.current = now;
      } else {
        crashTimeRef.current = 0;
      }
      const elapsed = elapsedRef.current;
      const m = calcMult(elapsed);
      const isFlying = phase === 'flying';
      const isCrashed = phase === 'crashed';
      const isWaiting = phase === 'waiting';
      const t = now / 1000;

      // Background
      ctx!.clearRect(0, 0, W, H);
      const bg = ctx!.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0A0120'); bg.addColorStop(1, '#04000C');
      ctx!.fillStyle = bg; ctx!.fillRect(0, 0, W, H);

      // Stars
      for (const s of STARS) {
        const blink = 0.5 + 0.5 * Math.sin(t * 0.9 + s.x * 20 + s.y * 15);
        ctx!.globalAlpha = 0.3 + 0.7 * blink;
        ctx!.fillStyle = '#FFFFFF';
        ctx!.beginPath(); ctx!.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // Positions — exact Expo logic
      const origX = W * 0.09, origY = H * 0.88;
      const pos = (isFlying || isCrashed)
        ? getPos(elapsed, W)
        : { x: origX + 10, y: origY - 20 }; // waiting: same as Expo {ORIG_X+10, ORIG_Y-20}

      // Flight path — triple layer exactly like Expo
      if ((isFlying || isCrashed) && elapsed > 0) {
        // Build stepped path
        let pathPoints: {x:number,y:number}[] = [];
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const et = elapsed * (i / steps);
          pathPoints.push(getPos(et, W));
        }
        const drawPath = () => {
          ctx!.beginPath(); ctx!.moveTo(origX, origY);
          for (const p of pathPoints) ctx!.lineTo(p.x, p.y);
        };
        ctx!.lineCap = 'round';
        // Layer 1: glow shadow
        ctx!.strokeStyle = 'rgba(255,107,0,0.25)'; ctx!.lineWidth = 8;
        drawPath(); ctx!.stroke();
        // Layer 2: medium
        ctx!.strokeStyle = 'rgba(255,107,0,0.5)'; ctx!.lineWidth = 3;
        drawPath(); ctx!.stroke();
        // Layer 3: bright gold
        ctx!.strokeStyle = '#FFD700'; ctx!.lineWidth = 1.5;
        drawPath(); ctx!.stroke();
        // Glow circle at tip — exact Expo RadialGradient
        const glowInner = isCrashed ? 'rgba(255,26,58,0.15)' : m >= 10 ? 'rgba(255,215,0,0.15)' : m >= 3 ? 'rgba(255,107,0,0.15)' : 'rgba(255,255,255,0.15)';
        const grd = ctx!.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 18);
        grd.addColorStop(0, glowInner); grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx!.fillStyle = grd;
        ctx!.beginPath(); ctx!.arc(pos.x, pos.y, 18, 0, Math.PI * 2); ctx!.fill();
      }

      // Rocket angle — exact Expo: atan2(dy,dx) then +PI/2 in drawRocket
      const dT = 0.3;
      const e0 = Math.max(elapsed - dT, 0.001);
      const e1 = elapsed + dT;
      const pA = (isFlying || isCrashed) ? getPos(e0, W) : { x: origX, y: origY - 30 };
      const pB = (isFlying || isCrashed) ? getPos(e1, W) : { x: origX + 1, y: origY - 31 };
      const rawAng = Math.atan2(pB.y - pA.y, pB.x - pA.x);
      smoothAngRef.current += (rawAng - smoothAngRef.current) * 0.12;

      if (isCrashed) {
        drawBlast(ctx!, pos.x, pos.y);
      } else {
        drawRocket(ctx!, pos.x, pos.y, smoothAngRef.current, isFlying, isWaiting, t);
      }

      // Multiplier overlay — exact Expo text positioning
      const mColor2 = isCrashed ? '#FF1A3A' : '#FFFFFF';
      ctx!.save();
      ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle';
      if (isFlying) {
        updateAmbientMult(m); // Drone pitch rises with multiplier
        ctx!.font = 'bold 54px Inter,sans-serif';
        ctx!.fillStyle = mColor2;
        ctx!.fillText(`${m.toFixed(2)}x`, W / 2, H * 0.42);
      } else if (isCrashed) {
        ctx!.font = 'bold 54px Inter,sans-serif';
        ctx!.fillStyle = '#FF1A3A';
        ctx!.fillText(`${m.toFixed(2)}x`, W / 2, H * 0.38);
        ctx!.font = 'bold 20px Inter,sans-serif';
        ctx!.fillStyle = '#FF4500'; ctx!.letterSpacing = '5px';
        ctx!.fillText('💥  BLAST!', W / 2, H * 0.38 + 48);
      } else if (isWaiting) {
        const cd = WSC.state.countdown;
        ctx!.font = 'bold 10px Inter,sans-serif';
        ctx!.fillStyle = C.textMuted; ctx!.letterSpacing = '2px';
        ctx!.fillText('NEXT ROUND IN', W / 2, H * 0.38);
        ctx!.font = 'bold 40px Inter,sans-serif';
        ctx!.fillStyle = C.textMuted; ctx!.letterSpacing = '0px';
        ctx!.fillText(cd > 0 ? `${Math.ceil(cd)}s` : '...', W / 2, H * 0.38 + 40);
      }
      ctx!.restore();

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────
  function placeBet(slotIdx: 0 | 1) {
    if (!state.user) { navigate('profile'); return; }
    const slot = slotIdx === 0 ? slot1Ref.current : slot2Ref.current;
    const isEffectivelyIdle = slot.status === 'idle' || slot.status === 'cashedout' || slot.status === 'lost';
    if (!isEffectivelyIdle) return;
    wsSend({ type: 'place_bet', slot: slotIdx + 1, amount: slot.amount });
    const isFlying = WSC.state.phase === 'flying' || WSC.state.phase === 'crashed';
    updateSlot(slotIdx, { status: isFlying ? 'queued' : 'placed', result: null });
  }
  function cancelBet(slotIdx: 0 | 1) {
    const slot = slotIdx === 0 ? slot1Ref.current : slot2Ref.current;
    const canCancel = slot.status === 'placed' || slot.status === 'queued' ||
      // Also allow during first 5s of flying (server enforces the window)
      (slot.status === 'active' && WSC.state.phase === 'flying' &&
        WSC.state.startTime > 0 && Date.now() - WSC.state.startTime < 5000);
    if (!canCancel) return;
    wsSend({ type: 'cancel_bet', slot: slotIdx + 1 });
    updateSlot(slotIdx, { status: 'idle' });
  }
  function cashOut(slotIdx: 0 | 1) {
    const slot = slotIdx === 0 ? slot1Ref.current : slot2Ref.current;
    if (slot.status !== 'active') return;
    // Retry once if WS not ready (e.g. momentary reconnect)
    const sent = wsSendReliable({ type: 'cashout', slot: slotIdx + 1 });
    if (!sent) setTimeout(() => wsSendReliable({ type: 'cashout', slot: slotIdx + 1 }), 80);
  }
  function setSlotAmount(slotIdx: 0 | 1, val: number) {
    const v = Math.max(10, Math.min(100000, val));
    updateSlot(slotIdx, { amount: v, input: String(v) });
  }

  // ── Read WS state ────────────────────────────────────────────────────────
  const phase    = WSC.state.phase;
  const mult     = WSC.state.mult;
  const history  = WSC.state.history ?? [];
  const allBets  = WSC.state.allBets ?? [];
  const betCount = WSC.state.betCount ?? 0;
  const cashedCount = WSC.state.cashedCount ?? 0;
  const totalWin = WSC.state.totalWin ?? 0;
  const prevRound = WSC.state.prevRound ?? null;
  const topBets  = WSC.state.topBets ?? [];
  const topHistory = (WSC.state as Record<string, unknown>).topHistory as { date: string; mult: number }[] ?? [];

  // ── Avatar circles ───────────────────────────────────────────────────────
  function Avatar({ idx, size = 32 }: { idx: number; size?: number }) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: AVATAR_COLORS[idx % AVATAR_COLORS.length],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.5,
      }}>{AVATAR_EMOJI[idx % AVATAR_EMOJI.length]}</div>
    );
  }

  // ── renderBetPanel (exact Expo replica) ──────────────────────────────────
  function renderBetPanel(slotIdx: 0 | 1) {
    const slot = slotIdx === 0 ? slot1 : slot2;
    const label = slotIdx === 0 ? 'BET 1' : 'BET 2';
    const effectiveStatus: SlotStatus = (slot.status === 'cashedout' || slot.status === 'lost') ? 'idle' : slot.status;
    const canEdit = effectiveStatus === 'idle';
    const potentialWin = effectiveStatus === 'active' ? Math.floor(slot.amount * mult) : 0;
    const isFlying = phase === 'flying';
    const isNextRound = phase === 'flying' || phase === 'crashed';

    let btnContent: React.ReactNode;
    if (effectiveStatus === 'active' && isFlying) {
      btnContent = (
        <button onClick={() => cashOut(slotIdx)} style={{
          width: '100%', padding: '12px 0', borderRadius: '12px', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#FF8C00,#CC4400)',
          boxShadow: '0 0 16px rgba(255,107,0,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
        }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '2px' }}>CASHOUT</span>
          <span style={{ fontSize: '22px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>₹{potentialWin.toLocaleString('en-IN')}</span>
        </button>
      );
    } else if (effectiveStatus === 'placed') {
      btnContent = (
        <button onClick={() => cancelBet(slotIdx)} style={{
          width: '100%', flex: 1, padding: '10px 0', borderRadius: '12px',
          border: '1.5px solid rgba(0,200,83,0.4)', background: 'rgba(0,200,83,0.07)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
        }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#00C853', letterSpacing: '1.5px', marginBottom: '3px' }}>BET PLACED ✓</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '3px' }}>₹{slot.amount.toLocaleString('en-IN')}</span>
          <span style={{ fontSize: '8px', fontWeight: 500, color: 'rgba(255,26,58,0.7)', letterSpacing: '1.2px' }}>TAP TO CANCEL</span>
        </button>
      );
    } else if (effectiveStatus === 'queued') {
      btnContent = (
        <button onClick={() => cancelBet(slotIdx)} style={{
          width: '100%', flex: 1, padding: '10px 0', borderRadius: '12px',
          border: '1.5px solid rgba(255,152,0,0.45)', background: 'rgba(255,152,0,0.07)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
        }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#FF9800', letterSpacing: '1.5px', marginBottom: '3px' }}>NEXT ROUND ✓</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '3px' }}>₹{slot.amount.toLocaleString('en-IN')}</span>
          <span style={{ fontSize: '8px', fontWeight: 500, color: 'rgba(255,26,58,0.7)', letterSpacing: '1.2px' }}>TAP TO CANCEL</span>
        </button>
      );
    } else {
      // Aviator-style: flying/crashed → bet queues for NEXT round (no confirm, direct queue)
      const isNextRound = phase === 'flying' || phase === 'crashed';
      const canBet = !!state.user && effectiveStatus === 'idle';

      btnContent = (
        <button
          onClick={() => canBet ? placeBet(slotIdx) : undefined}
          disabled={!canBet}
          style={{
            width: '100%', padding: '14px 0', borderRadius: '12px', border: 'none',
            cursor: canBet ? 'pointer' : 'not-allowed',
            background: !canBet
              ? 'rgba(20,10,20,0.4)'
              : isNextRound
                ? 'linear-gradient(135deg,#FF9800,#E65100)'
                : 'linear-gradient(135deg,#00C853,#009C41)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            transition: 'background 0.2s',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', color: canBet ? '#fff' : C.textDim }}>
            {!state.user
              ? 'SIGN IN'
              : isNextRound
                ? `BET NEXT  ₹${slot.amount.toLocaleString('en-IN')}`
                : `BET  ₹${slot.amount.toLocaleString('en-IN')}`}
          </span>
          {isNextRound && canBet && <span style={{ fontSize: '9px', fontWeight: 500, color: 'rgba(255,255,255,0.7)', letterSpacing: '1px' }}>for next round</span>}
        </button>
      );
    }

    return (
      <div style={{
        flex: 1, minWidth: 0, background: C.bgCard, borderRadius: '16px',
        border: `1px solid ${C.border}`, padding: '11px',
        display: 'flex', flexDirection: 'column', gap: '0',
      }}>
        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, letterSpacing: '2px' }}>{label}</span>
          {slot.result && (
            <span style={{
              fontSize: '10px', fontWeight: 700, borderRadius: '8px', padding: '3px 7px',
              background: slot.result.win ? 'rgba(0,200,83,0.15)' : 'rgba(255,26,58,0.15)',
              color: slot.result.win ? '#00C853' : '#FF1A3A',
            }}>{slot.result.text}</span>
          )}
        </div>

        {/* Amount row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <button onClick={() => setSlotAmount(slotIdx, slot.amount - 50)} disabled={!canEdit} style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'rgba(255,26,58,0.12)', border: `1px solid ${C.border}`,
            color: '#fff', fontSize: '20px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: canEdit ? 1 : 0.35, flexShrink: 0, cursor: canEdit ? 'pointer' : 'default',
          }}>−</button>
          <div style={{
            flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.4)',
            borderRadius: '10px', border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', padding: '7px 9px',
          }}>
            <span style={{ color: C.gold, fontSize: '14px', fontWeight: 700, marginRight: '2px', flexShrink: 0 }}>₹</span>
            <input
              type="number" value={slot.input} disabled={!canEdit}
              onChange={e => updateSlot(slotIdx, { input: e.target.value })}
              onBlur={() => {
                const slotCurrent = slotIdx === 0 ? slot1Ref.current : slot2Ref.current;
                const v = parseInt(slotCurrent.input, 10);
                if (!isNaN(v) && v >= 10) setSlotAmount(slotIdx, v);
                else updateSlot(slotIdx, { input: String(slotCurrent.amount) });
              }}
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#fff',
                fontSize: '15px', fontWeight: 700, outline: 'none', opacity: canEdit ? 1 : 0.5,
              }}
            />
          </div>
          <button onClick={() => setSlotAmount(slotIdx, slot.amount + 50)} disabled={!canEdit} style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'rgba(255,26,58,0.12)', border: `1px solid ${C.border}`,
            color: '#fff', fontSize: '20px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: canEdit ? 1 : 0.35, flexShrink: 0, cursor: canEdit ? 'pointer' : 'default',
          }}>+</button>
        </div>

        {/* Preset chips */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          {[100, 250, 500, 1000].map(v => (
            <button key={v} onClick={() => setSlotAmount(slotIdx, v)} disabled={!canEdit} style={{
              flex: 1, padding: '6px 0', borderRadius: '8px',
              border: `1px solid ${slot.amount === v ? C.primaryBright : C.border}`,
              fontSize: '10px', fontWeight: 600, cursor: canEdit ? 'pointer' : 'default',
              background: slot.amount === v ? 'rgba(255,26,58,0.18)' : 'rgba(0,0,0,0.3)',
              color: slot.amount === v ? C.red : C.textMuted,
              opacity: canEdit ? 1 : 0.5,
            }}>{v >= 1000 ? '₹1K' : `₹${v}`}</button>
          ))}
        </div>

        {btnContent}
      </div>
    );
  }

  // ── Bets row — exact Expo sizes ──────────────────────────────────────────
  function BetRow({ b }: { b: RoundBet }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
        <Avatar idx={b.avatar} size={28} />
        <span style={{ flex: 1.4, fontSize: '12px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.user}</span>
        <span style={{ flex: 1.5, fontSize: '11px', fontWeight: 500, color: C.textMuted, textAlign: 'right' }}>₹{b.amount.toLocaleString('en-IN')}</span>
        <span style={{ flex: 0.9, fontSize: '12px', fontWeight: 700, textAlign: 'center', color: b.cashout ? multColor(b.cashout) : '#555' }}>
          {b.cashout ? `${b.cashout.toFixed(2)}x` : '—'}
        </span>
        <span style={{ flex: 1.5, fontSize: '11px', fontWeight: 600, textAlign: 'right', color: b.winAmount > 0 ? '#00C853' : '#555' }}>
          {b.winAmount > 0 ? `₹${b.winAmount.toLocaleString('en-IN')}` : '0.00'}
        </span>
      </div>
    );
  }

  // column header — exact Expo: rgba(255,255,255,0.35)
  const colHead = (label: string, flex: number, align: 'left' | 'right' | 'center' = 'left') => (
    <span style={{ flex, fontSize: '10px', fontWeight: 500, color: 'rgba(255,255,255,0.35)', textAlign: align, letterSpacing: '0.5px' }}>{label}</span>
  );

  const cashPct = betCount > 0 ? Math.min(100, (cashedCount / betCount) * 100) : 0;

  // ── Bets panel (Expo style) ───────────────────────────────────────────────
  const betsPanel = (
    <div style={{ background: C.bgCard, borderRadius: '16px', border: `1px solid ${C.border}`, padding: '14px', marginTop: 0 }}>
      {/* Tab bar — pill style (exact Expo) */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.35)', borderRadius: '20px', padding: '3px', marginBottom: '14px' }}>
        {(['all', 'prev', 'top'] as BetsTab[]).map(tab => (
          <button key={tab} onClick={() => setBetsTab(tab)} style={{
            flex: 1, padding: '7px 0', borderRadius: '16px', border: 'none', cursor: 'pointer',
            background: betsTab === tab ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: betsTab === tab ? '#fff' : C.textMuted,
            fontWeight: 600, fontSize: '12px',
          }}>{tab === 'all' ? 'All Bets' : tab === 'prev' ? 'Previous' : 'Top'}</button>
        ))}
      </div>

      {/* ── ALL BETS ── */}
      {betsTab === 'all' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {[0,1,2].map(i => <div key={i} style={{ marginLeft: i > 0 ? '-10px' : 0 }}><Avatar idx={i} size={28} /></div>)}
              <span style={{ fontSize: '12px', fontWeight: 500, color: C.textMuted, marginLeft: '8px' }}>{cashedCount}/{betCount} Bets</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>₹{totalWin >= 1000 ? (totalWin/1000).toFixed(2)+'K' : totalWin.toFixed(2)}</div>
              <div style={{ fontSize: '10px', fontWeight: 500, color: C.textMuted }}>Total win INR</div>
            </div>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${cashPct}%`, background: '#00C853', borderRadius: '2px', transition: 'width 0.4s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '6px', borderBottom: `1px solid rgba(255,255,255,0.06)`, marginBottom: '4px' }}>
            {colHead('Player', 1.8)}{colHead('Bet INR', 1.5, 'right')}{colHead('X', 0.9, 'center')}{colHead('Win INR', 1.5, 'right')}
          </div>
          {allBets.slice(0, 18).map((b, i) => <BetRow key={i} b={b} />)}
          {allBets.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: C.textDim, fontSize: '13px' }}>Waiting for bets...</div>}
        </div>
      )}

      {/* ── PREVIOUS ── */}
      {betsTab === 'prev' && (
        <div>
          {/* Centered header — exact Expo prevHeader */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 500, color: C.textMuted, letterSpacing: '1.5px', marginBottom: '4px' }}>Round Result</span>
            <span style={{ fontSize: '34px', fontWeight: 700, color: prevRound ? multColor(prevRound.result) : '#888' }}>
              {prevRound ? `${prevRound.result.toFixed(2)}x` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', paddingBottom: '6px', borderBottom: `1px solid rgba(255,255,255,0.08)`, marginBottom: '2px' }}>
            {colHead('Player', 1.8)}{colHead('Bet INR', 1.5, 'right')}{colHead('X', 0.9, 'center')}{colHead('Win INR', 1.5, 'right')}
          </div>
          {(prevRound?.bets ?? []).slice(0, 18).map((b, i) => <BetRow key={i} b={b} />)}
          {!prevRound && <div style={{ textAlign: 'center', padding: '24px', color: C.textMuted, fontSize: '13px', fontWeight: 500 }}>No previous round data yet</div>}
        </div>
      )}

      {/* ── TOP ── */}
      {betsTab === 'top' && (
        <div>
          {/* Sort row — exact Expo topFilterBtn/topFilterBtnActive */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {(['X','Win','Rounds'] as TopSort[]).map(f => (
              <button key={f} onClick={() => setTopSort(f)} style={{
                flex: 1, padding: '6px 0', borderRadius: '8px', cursor: 'pointer',
                border: `1px solid ${topSort === f ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                background: topSort === f ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.25)',
                color: topSort === f ? C.text : C.textMuted, fontSize: '11px', fontWeight: 600,
              }}>{f}</button>
            ))}
          </div>
          {/* Time row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {(['Day','Month','Year'] as TopTime[]).map(f => (
              <button key={f} onClick={() => setTopTime(f)} style={{
                flex: 1, padding: '6px 0', borderRadius: '8px', cursor: 'pointer',
                border: `1px solid ${topTime === f ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                background: topTime === f ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.25)',
                color: topTime === f ? C.text : C.textMuted, fontSize: '11px', fontWeight: 600,
              }}>{f}</button>
            ))}
          </div>

          {topSort === 'X' && (() => {
            const cutoff = topTime === 'Day' ? 86400000 : topTime === 'Month' ? 30*86400000 : 365*86400000;
            const rows = topHistory.filter(h => Date.now() - new Date(h.date).getTime() < cutoff);
            const fmtDate = (iso: string) => {
              const d = new Date(iso);
              return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            };
            const fmtMult = (m: number) => m >= 1000 ? m.toLocaleString('en-US', { maximumFractionDigits: 2 })+'x' : m.toFixed(2)+'x';
            return (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 2px', borderBottom:`1px solid rgba(255,255,255,0.08)`, marginBottom:'2px' }}>
                  <span style={{ fontSize:'11px', fontWeight:600, color:C.textMuted }}>Date & Time</span>
                  <span style={{ fontSize:'11px', fontWeight:600, color:C.textMuted }}>X</span>
                </div>
                {rows.map((h,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom:`1px solid rgba(255,255,255,0.05)` }}>
                    <span style={{ fontSize:'12px', fontWeight:500, color:C.textMuted }}>{fmtDate(h.date)}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <span style={{ fontSize:'14px', fontWeight:700, color:'#C62AE8' }}>{fmtMult(h.mult)}</span>
                      <div style={{ width:28, height:28, borderRadius:'14px', background:'rgba(120,120,140,0.2)', border:'1px solid rgba(180,180,200,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:'13px', color:'rgba(180,180,200,0.8)', fontWeight:700 }}>✓</span>
                      </div>
                    </div>
                  </div>
                ))}
                {rows.length === 0 && <div style={{ textAlign:'center', padding:'24px', color:C.textMuted, fontSize:'13px', fontWeight:500 }}>No records for this period</div>}
              </div>
            );
          })()}

          {topSort === 'Win' && (() => {
            const cutoff = topTime === 'Day' ? 86400000 : topTime === 'Month' ? 30*86400000 : 365*86400000;
            const rows = topBets.filter((t: TopBet) => Date.now() - new Date((t as unknown as {date:string}).date ?? 0).getTime() < cutoff);
            return (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 2px', borderBottom:`1px solid rgba(255,255,255,0.08)`, marginBottom:'2px' }}>
                  <span style={{ fontSize:'11px', fontWeight:600, color:C.textMuted }}>Player</span>
                  <span style={{ fontSize:'11px', fontWeight:600, color:C.textMuted }}>Win INR</span>
                </div>
                {rows.map((t: TopBet, i: number) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom:`1px solid rgba(255,255,255,0.05)` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <Avatar idx={t.avatar} size={28} />
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{t.user}</div>
                        <div style={{ fontSize:'10px', fontWeight:700, color:multColor(t.mult) }}>{t.mult.toFixed(2)}x</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <span style={{ fontSize:'13px', fontWeight:600, color:'#00C853' }}>₹{t.win.toLocaleString('en-IN')}</span>
                      <div style={{ width:28, height:28, borderRadius:'14px', background:'rgba(120,120,140,0.2)', border:'1px solid rgba(180,180,200,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:'13px', color:'rgba(180,180,200,0.8)', fontWeight:700 }}>✓</span>
                      </div>
                    </div>
                  </div>
                ))}
                {rows.length === 0 && <div style={{ textAlign:'center', padding:'24px', color:C.textMuted, fontSize:'13px', fontWeight:500 }}>No records for this period</div>}
              </div>
            );
          })()}

          {topSort === 'Rounds' && (() => {
            const ROUNDS_DATA = [
              { user:'5***8', avatar:3, rounds:1842, wins:1124 },
              { user:'2***1', avatar:6, rounds:1567, wins:892 },
              { user:'7***4', avatar:1, rounds:1344, wins:755 },
              { user:'3***9', avatar:5, rounds:1122, wins:612 },
              { user:'9***2', avatar:0, rounds:987,  wins:487 },
              { user:'4***7', avatar:2, rounds:856,  wins:398 },
              { user:'8***5', avatar:4, rounds:742,  wins:301 },
              { user:'1***6', avatar:7, rounds:621,  wins:244 },
            ];
            return (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 2px', borderBottom:`1px solid rgba(255,255,255,0.08)`, marginBottom:'2px' }}>
                  <span style={{ fontSize:'11px', fontWeight:600, color:C.textMuted }}>Player</span>
                  <span style={{ fontSize:'11px', fontWeight:600, color:C.textMuted }}>Rounds</span>
                </div>
                {ROUNDS_DATA.map((r, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom:`1px solid rgba(255,255,255,0.05)` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <Avatar idx={r.avatar} size={28} />
                      <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{r.user}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'13px', fontWeight:600, color:C.textMuted }}>{r.rounds.toLocaleString()}</div>
                        <div style={{ fontSize:'10px', fontWeight:500, color:C.textMuted, textAlign:'right' }}>{r.wins} wins</div>
                      </div>
                      <div style={{ width:28, height:28, borderRadius:'14px', background:'rgba(120,120,140,0.2)', border:'1px solid rgba(180,180,200,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:'13px', color:'rgba(180,180,200,0.8)', fontWeight:700 }}>✓</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );

  // ── History strip ─────────────────────────────────────────────────────────
  function histChip(h: number, i: number) {
    const col = h >= 10 ? '#7B2FFF' : h >= 2 ? '#54B3FF' : '#F1222A';
    const bg  = h >= 10 ? 'rgba(123,47,255,0.15)' : h >= 2 ? 'rgba(84,179,255,0.15)' : 'rgba(241,34,42,0.15)';
    return (
      <div key={i} style={{ flexShrink: 0, background: bg, border: `1px solid ${col}55`, borderRadius: '8px', padding: '4px 9px', fontSize: '11px', fontWeight: 700, color: col }}>
        {h.toFixed(2)}x
      </div>
    );
  }

  const historyStrip = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
      {/* Last 6 rounds visible */}
      <div style={{ flex: 1, display: 'flex', gap: '5px', overflow: 'hidden' }}>
        {[...history].slice(0, 6).map((h, i) => histChip(h, i))}
      </div>
      {/* ⋯ button */}
      {history.length > 0 && (
        <button onClick={() => setHistoryOpen(true)} style={{
          flexShrink: 0, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '8px', padding: '4px 10px', fontSize: '15px', color: '#aaa',
          cursor: 'pointer', letterSpacing: '2px', fontWeight: 900, lineHeight: 1,
        }}>···</button>
      )}
    </div>
  );

  // ── History modal ──────────────────────────────────────────────────────────
  const historyModal = historyOpen ? (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={() => setHistoryOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#12001E', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px', width: '340px', maxWidth: '92vw',
        maxHeight: '75vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.9)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '1px', color: '#fff' }}>ROUND HISTORY</span>
          <button onClick={() => setHistoryOpen(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {/* Grid of chips */}
        <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-start' }}>
          {history.length === 0 ? (
            <span style={{ color: '#666', fontSize: '13px' }}>No history yet</span>
          ) : history.map((h, i) => {
            const col = h >= 10 ? '#7B2FFF' : h >= 2 ? '#54B3FF' : '#F1222A';
            const bg  = h >= 10 ? 'rgba(123,47,255,0.15)' : h >= 2 ? 'rgba(84,179,255,0.15)' : 'rgba(241,34,42,0.15)';
            return (
              <div key={i} style={{
                background: bg, border: `1px solid ${col}60`,
                borderRadius: '10px', padding: '7px 12px',
                fontSize: '13px', fontWeight: 800, color: col,
                minWidth: '64px', textAlign: 'center',
              }}>
                {h.toFixed(2)}x
              </div>
            );
          })}
        </div>
        {/* Footer */}
        <div style={{ padding: '10px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <span style={{ color: '#555', fontSize: '11px' }}>{history.length} rounds shown</span>
        </div>
      </div>
    </div>
  ) : null;

  // ── Canvas element ────────────────────────────────────────────────────────
  const canvasEl = (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${C.border}`, background: 'rgba(4,0,12,0.9)', marginBottom: '12px' }}>
      <canvas ref={canvasRef} width={480} height={CV_H} style={{ width: '100%', height: 'auto', display: 'block' }} />
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────
  const content = (
    <div style={{ paddingHorizontal: 16 } as React.CSSProperties}>
      <div style={{ padding: '0 16px' }}>
        {historyStrip}
        {canvasEl}
        {/* Dual panel */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          {renderBetPanel(0)}
          {renderBetPanel(1)}
        </div>
        {betsPanel}
      </div>
    </div>
  );

  if (!isMobile) {
    // Desktop: canvas left (65%), bet panels right (35%)
    return (
      <div style={{ width: '100%', padding: '0 20px 20px', boxSizing: 'border-box' }}>
        {historyModal}
        {/* History full-width */}
        <div style={{ padding: '10px 0' }}>
          {historyStrip}
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          {/* Left: Canvas + bets */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {canvasEl}
            {betsPanel}
          </div>
          {/* Right: Bet panels */}
          <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {renderBetPanel(0)}
            {renderBetPanel(1)}
          </div>
        </div>
      </div>
    );
  }

  // Mobile: stack vertically (same as Expo)
  return (
    <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto', padding: '10px 16px 24px', boxSizing: 'border-box' }}>
      {historyModal}
      {historyStrip}
      {canvasEl}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {renderBetPanel(0)}
        {renderBetPanel(1)}
      </div>
      {betsPanel}
    </div>
  );
}
