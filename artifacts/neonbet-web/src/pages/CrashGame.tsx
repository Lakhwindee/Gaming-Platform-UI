import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "../context/GameContext";
import { WSC, wsSend } from "../lib/wsClient";
import type { RoundBet, TopBet } from "../lib/wsClient";

// ── Exact same constants as expo ───────────────────────────────────────────
const CV_W = 358;
const CV_H = 260;
const ORIG_X = CV_W * 0.09;
const ORIG_Y = CV_H * 0.88;

const AVATAR_COLORS = ["#E53935","#8E24AA","#1E88E5","#00897B","#F4511E","#6D4C41","#546E7A","#43A047"];
const AVATAR_EMOJI  = ["🦅","🚀","🎯","💰","🔥","⚡","🌙","🎲"];

// Expo C colors
const C = {
  bg: "#08020E",
  bgCard: "rgba(180,0,40,0.13)",
  border: "rgba(255,30,60,0.22)",
  text: "#FFFFFF",
  textMuted: "#AA7788",
  gold: "#FFD700",
  red: "#FF1A3A",
  green: "#00C853",
  greenDim: "#009C41",
  orange: "#FF6B00",
};

function multColor(m: number): string {
  if (m >= 10) return "#FF4DFF";
  if (m >= 2)  return "#4DA6FF";
  return "#FF3A3A";
}

// Exact same as expo
function calcMult(elapsed: number): number {
  return Math.floor(Math.pow(Math.E, 0.077 * elapsed) * 100) / 100;
}

// Exact same as expo (adapted to use CV_W/CV_H constants)
function getPos(elapsed: number): { x: number; y: number } {
  const norm = Math.min(elapsed / 52, 1);
  const xProg = Math.pow(norm, 3.2);
  const yProg = 1 - Math.pow(1 - Math.min(norm * 1.02, 1), 0.35);
  const maxX = CV_W * 0.91 - ORIG_X;
  const maxY = ORIG_Y - CV_H * 0.05;
  return {
    x: ORIG_X + maxX * xProg,
    y: Math.max(CV_H * 0.04, ORIG_Y - maxY * yProg),
  };
}

// Exact same stars as expo
const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: (Math.sin(i * 137.5) * 0.5 + 0.5) * CV_W,
  y: (Math.cos(i * 239.3) * 0.5 + 0.5) * CV_H * 0.9,
  r: 0.5 + (i % 3) * 0.5,
}));

// ── BlastShape — exact port of expo BlastShape ─────────────────────────────
function BlastShape() {
  return (
    <>
      <circle cx={0} cy={0} r={38} fill="rgba(255,80,0,0.10)" />
      <circle cx={0} cy={0} r={26} fill="rgba(255,120,0,0.18)" />
      <circle cx={0} cy={0} r={17} fill="rgba(255,200,0,0.28)" />
      <circle cx={0} cy={0} r={10} fill="#FF6B00" />
      <circle cx={0} cy={0} r={5} fill="#FFD700" />
      <circle cx={0} cy={0} r={2} fill="#FFFFFF" />
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const r1 = 13, r2 = 30 + (i % 3) * 8;
        return (
          <path
            key={deg}
            d={`M ${Math.cos(rad)*r1} ${Math.sin(rad)*r1} L ${Math.cos(rad)*r2} ${Math.sin(rad)*r2}`}
            stroke={i % 2 === 0 ? "#FF6B00" : "#FFD700"}
            strokeWidth={i % 2 === 0 ? 2.5 : 1.5}
            strokeLinecap="round"
            opacity={0.85}
          />
        );
      })}
      {[22,67,112,157,202,247,292,337].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const r2 = 18 + (i % 2) * 6;
        return (
          <circle
            key={deg}
            cx={Math.cos(rad) * r2}
            cy={Math.sin(rad) * r2}
            r={1.5 + (i % 3) * 0.8}
            fill={i % 3 === 0 ? "#FFFFFF" : i % 3 === 1 ? "#FFD700" : "#FF4500"}
            opacity={0.9}
          />
        );
      })}
    </>
  );
}

// ── RocketShape — exact port of expo RocketShape ───────────────────────────
function RocketShape({ phase, flicker = 0, flicker2 = 0 }: { phase: string; flicker?: number; flicker2?: number }) {
  const S = 26;
  const isFlying = phase === "flying";
  const isWaiting = phase === "waiting";
  if (phase === "crashed") return <BlastShape />;
  return (
    <>
      {isFlying && (
        <>
          <ellipse cx={0} cy={S * 0.85} rx={8} ry={S * 0.62} fill="url(#flameOuter)" />
          <ellipse cx={0} cy={S * 0.70} rx={4.5} ry={S * 0.38} fill="url(#flameMid)" />
          <ellipse cx={0} cy={S * 0.56} rx={2} ry={S * 0.20} fill="url(#flameCore)" />
        </>
      )}
      {isWaiting && (
        <>
          <ellipse cx={-9} cy={S * 1.05 + flicker * S * 0.35} rx={4 + flicker2 * 2} ry={2.5 + flicker * 1.5} fill="#FF6B00" opacity={0.18 + flicker2 * 0.14} />
          <ellipse cx={9} cy={S * 1.05 + flicker2 * S * 0.3} rx={4 + flicker * 2} ry={2 + flicker2 * 1.5} fill="#FFD700" opacity={0.15 + flicker * 0.12} />
          <ellipse cx={0} cy={S * 0.78 + flicker * S * 0.18} rx={6.5 + flicker2 * 2.5} ry={S * 0.32 + flicker * S * 0.18} fill="url(#flameOuter)" opacity={0.55 + flicker * 0.35} />
          <ellipse cx={0} cy={S * 0.64 + flicker2 * S * 0.10} rx={3.5 + flicker * 1.5} ry={S * 0.18 + flicker2 * S * 0.10} fill="url(#flameMid)" opacity={0.65 + flicker2 * 0.25} />
          <ellipse cx={0} cy={S * 0.52} rx={2 + flicker * 1} ry={S * 0.09 + flicker * S * 0.05} fill="url(#flameCore)" opacity={0.8 + flicker2 * 0.2} />
          <circle cx={-7 + flicker2 * 5} cy={S * 1.0 + flicker * S * 0.25} r={1.4} fill="#FFD700" opacity={flicker2 * 0.85} />
          <circle cx={8 - flicker * 4} cy={S * 1.15 + flicker2 * S * 0.2} r={1.1} fill="#FF6B00" opacity={flicker * 0.7} />
          <circle cx={-3} cy={S * 0.88 + flicker2 * S * 0.3} r={1.0} fill="#FFFFFF" opacity={flicker2 * 0.6} />
          <circle cx={4} cy={S * 0.92 + flicker * S * 0.22} r={1.2} fill="#FFD700" opacity={flicker * 0.65} />
          <circle cx={-10 + flicker * 3} cy={S * 1.25 + flicker2 * S * 0.15} r={0.9} fill="#FF4500" opacity={flicker2 * 0.5} />
          <circle cx={10 - flicker2 * 3} cy={S * 1.3 + flicker * S * 0.1} r={0.8} fill="#FFD700" opacity={flicker * 0.55} />
        </>
      )}
      <path d={`M -8 ${S * 0.2} L -17 ${S * 0.55} L -8 ${S * 0.42} Z`} fill="#D43050" />
      <path d={`M 8 ${S * 0.2} L 17 ${S * 0.55} L 8 ${S * 0.42} Z`} fill="#D43050" />
      <rect x={-8} y={-S * 0.46} width={16} height={S * 0.92} rx={4} ry={4} fill="url(#rocketBody)" />
      <path d={`M 0 ${-S} L 8 ${-S * 0.46} L -8 ${-S * 0.46} Z`} fill="url(#rocketNose)" />
      <rect x={-3.5} y={-S * 0.44} width={7} height={S * 0.26} rx={2} fill="#EE1133" opacity={0.9} />
      <circle cx={0} cy={-S * 0.10} r={5} fill="rgba(80,160,255,0.22)" stroke="#88CCFF" strokeWidth={1.2} />
      <circle cx={-1.5} cy={-S * 0.10 - 1.5} r={1.8} fill="rgba(255,255,255,0.55)" />
      <rect x={-5} y={-S * 0.43} width={2.5} height={S * 0.82} rx={1.2} fill="rgba(255,255,255,0.18)" />
      <rect x={-6.5} y={S * 0.44} width={13} height={5.5} rx={2} fill="#484E60" />
    </>
  );
}

// ── GameCanvas — exact SVG port of expo GameCanvas ─────────────────────────
function GameCanvas({ phase, mult, countdown, elapsed, synced }: {
  phase: string; mult: number; countdown: number; elapsed: number; synced: boolean;
}) {
  const [, setTick] = useState(0);
  const rafRef = useRef<number>(0);

  // Drive re-renders at ~60fps — same as expo's useAnimatedValue loop
  useEffect(() => {
    const loop = () => { setTick(n => n + 1); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Compute live elapsed every frame from startTime (smooth 60fps) — same as expo
  const liveElapsed = (phase === "flying" && WSC.state.startTime > 0)
    ? (Date.now() - WSC.state.startTime) / 1000
    : elapsed;

  const pos = (phase === "flying" || phase === "crashed")
    ? getPos(liveElapsed)
    : { x: ORIG_X + 10, y: ORIG_Y - 20 };

  let pathD = `M ${ORIG_X} ${ORIG_Y}`;
  if (phase === "flying" || phase === "crashed") {
    const steps = 40;
    for (let i = 1; i <= steps; i++) {
      const t = liveElapsed * (i / steps);
      const p = getPos(t);
      pathD += ` L ${p.x} ${p.y}`;
    }
  }

  const dT = 0.3;
  const e0 = Math.max(liveElapsed - dT, 0.001);
  const e1 = liveElapsed + dT;
  const pA = getPos(e0);
  const pB = getPos(e1);
  const angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
  const angleDeg = (angle * 180) / Math.PI + 90;

  // Exact same as expo line 165
  const mColor = phase === "crashed" ? "#FF1A3A" : mult >= 10 ? "#FFD700" : mult >= 3 ? "#FF6B00" : "#FFFFFF";

  // Flicker driven by Date.now() — same as expo
  const now = Date.now();
  const flicker  = (Math.sin(now / 80) + 1) / 2;
  const flicker2 = (Math.sin(now / 55 + 2.1) + 1) / 2;

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${CV_W}/${CV_H}`, backgroundColor: "rgba(4,0,12,0.9)", borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 12 }}>
      {/* SVG canvas — viewBox matches expo CV_W x CV_H */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${CV_W} ${CV_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={mColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={mColor} stopOpacity={0} />
          </radialGradient>
          {/* Background gradient matching expo sky */}
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#08020E" />
            <stop offset="40%"  stopColor="#0D0208" />
            <stop offset="75%"  stopColor="#130010" />
            <stop offset="100%" stopColor="#180018" />
          </linearGradient>
          <linearGradient id="rocketBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#C8CED8" />
            <stop offset="45%"  stopColor="#F0F2F8" />
            <stop offset="100%" stopColor="#9098A8" />
          </linearGradient>
          <linearGradient id="rocketNose" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#B8C0D0" />
          </linearGradient>
          <linearGradient id="flameOuter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FFD700" stopOpacity="0.9" />
            <stop offset="45%"  stopColor="#FF6B00" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FF1A3A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flameMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="50%"  stopColor="#FFD700" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF6B00" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="flameCore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width={CV_W} height={CV_H} fill="url(#bgGrad)" />

        {/* Stars — exact same as expo */}
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={0.4 + (i % 3) * 0.2} />
        ))}

        {/* Trajectory — exact same stroke widths/colors as expo */}
        {(phase === "flying" || phase === "crashed") && (
          <>
            <path d={pathD} stroke="rgba(255,107,0,0.25)" strokeWidth={8} fill="none" strokeLinecap="round" />
            <path d={pathD} stroke="rgba(255,107,0,0.5)"  strokeWidth={3} fill="none" strokeLinecap="round" />
            <path d={pathD} stroke="#FFD700"               strokeWidth={1.5} fill="none" strokeLinecap="round" />
            <circle cx={pos.x} cy={pos.y} r={18} fill="url(#glow)" />
          </>
        )}

        {/* Rocket — G x y rotation originX=0 originY=0 maps to translate+rotate */}
        <g transform={`translate(${pos.x}, ${pos.y}) rotate(${phase === "waiting" ? 0 : angleDeg})`}>
          <RocketShape phase={phase} flicker={flicker} flicker2={flicker2} />
        </g>
      </svg>

      {/* Overlays — exact same as expo */}
      {phase === "flying" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ fontSize: 54, fontWeight: 700, color: mColor, fontFamily: "Inter,sans-serif", lineHeight: 1 }}>
            {mult.toFixed(2)}x
          </span>
        </div>
      )}
      {phase === "waiting" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: 2, fontFamily: "Inter,sans-serif" }}>NEXT ROUND IN</span>
          <span style={{ fontSize: 40, fontWeight: 700, color: C.textMuted, fontFamily: "Inter,sans-serif", lineHeight: 1 }}>
            {countdown}s
          </span>
        </div>
      )}
      {phase === "crashed" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ fontSize: 54, fontWeight: 700, color: "#FF1A3A", fontFamily: "Inter,sans-serif", lineHeight: 1 }}>
            {mult.toFixed(2)}x
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#FF4500", letterSpacing: 5, marginTop: 4, fontFamily: "Inter,sans-serif" }}>
            💥  BLAST!
          </span>
        </div>
      )}
      {!synced && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(4,0,12,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 16 }}>
          <span style={{ fontSize: 28, marginBottom: 8 }}>🚀</span>
          <span style={{ color: "#FF3A3A", fontSize: 13, fontWeight: 700, letterSpacing: 2, fontFamily: "Inter,sans-serif" }}>SYNCING...</span>
          <span style={{ color: "#AA5566", fontSize: 10, marginTop: 4, letterSpacing: 1, fontFamily: "Inter,sans-serif" }}>Connecting to live game</span>
        </div>
      )}
    </div>
  );
}

// ── Slot types — exact same as expo ───────────────────────────────────────
type SlotStatus = "idle" | "placed" | "queued" | "active" | "cashedout" | "lost";
interface SlotState {
  amount: number;
  input: string;
  status: SlotStatus;
  cashedOutAt: number | null;
  result: { text: string; win: boolean } | null;
}
function initSlot(defaultAmt: number): SlotState {
  return { amount: defaultAmt, input: String(defaultAmt), status: "idle", cashedOutAt: null, result: null };
}

// ── Main game screen ───────────────────────────────────────────────────────
export default function CrashGame({ onAuthOpen }: { onAuthOpen?: () => void }) {
  const { state } = useGame();
  const user = state.user;

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [, setTick] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [slots, setSlots] = useState<[SlotState, SlotState]>([initSlot(100), initSlot(200)]);
  const slotRefs = useRef<[SlotState, SlotState]>([initSlot(100), initSlot(200)]);
  const resultTimers = useRef<[ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]>([null, null]);

  const [cashoutPopup, setCashoutPopup] = useState<{ payout: number; mult: number } | null>(null);
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSlot = useCallback((idx: 0 | 1, patch: Partial<SlotState>) => {
    setSlots(prev => {
      const next: [SlotState, SlotState] = [{ ...prev[0] }, { ...prev[1] }];
      next[idx] = { ...next[idx], ...patch };
      slotRefs.current = next;
      return next;
    });
  }, []);

  // WSC listener — same as expo
  useEffect(() => {
    const wsListener = () => {
      if (WSC.state.phase === "flying" && WSC.state.startTime > 0) {
        setElapsedSec((Date.now() - WSC.state.startTime) / 1000);
      }
      setTick(n => n + 1);
    };
    WSC.listeners.add(wsListener);
    return () => { WSC.listeners.delete(wsListener); };
  }, []);

  // Smooth elapsed timer — same as expo
  useEffect(() => {
    const id = setInterval(() => {
      if (WSC.state.phase === "flying") {
        setElapsedSec((Date.now() - WSC.state.startTime) / 1000);
      } else if (WSC.state.phase === "waiting") {
        setElapsedSec(0);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);

  // Message handler — same as expo
  useEffect(() => {
    const handler = (msg: Record<string, unknown>) => {
      const slotNum = (msg.slot as number | undefined) ?? 1;
      const slotIdx = (slotNum - 1) as 0 | 1;

      if (msg.type === "bet_ok") {
        const isQueued = msg.auto === true;
        updateSlot(slotIdx, { status: isQueued ? "active" : "placed", result: null });
      }
      if (msg.type === "bet_queued") {
        updateSlot(slotIdx, { status: "queued", result: null });
      }
      if (msg.type === "bet_cancelled") {
        updateSlot(slotIdx, { status: "idle" });
      }
      if (msg.type === "cashout_ok") {
        const m = msg.mult as number;
        const payout = msg.payout as number;
        const amt = slotRefs.current[slotIdx].amount;
        const profit = payout - amt;
        if (resultTimers.current[slotIdx]) clearTimeout(resultTimers.current[slotIdx]!);
        updateSlot(slotIdx, {
          status: "cashedout",
          cashedOutAt: m,
          result: { text: `+₹${profit.toLocaleString("en-IN")} @ ${m.toFixed(2)}x`, win: true },
        });
        resultTimers.current[slotIdx] = setTimeout(() => updateSlot(slotIdx, { result: null }), 5000);
        if (popupTimer.current) clearTimeout(popupTimer.current);
        setCashoutPopup({ payout, mult: m });
        popupTimer.current = setTimeout(() => setCashoutPopup(null), 5000);
      }
      if (msg.type === "cashout_fail") {
        updateSlot(slotIdx, { status: "active" });
      }
      if (msg.type === "bet_crash") {
        const m = msg.mult as number;
        const amt = slotRefs.current[slotIdx].amount;
        if (resultTimers.current[slotIdx]) clearTimeout(resultTimers.current[slotIdx]!);
        updateSlot(slotIdx, {
          status: "lost",
          result: { text: `-₹${amt.toLocaleString("en-IN")} @ ${m.toFixed(2)}x`, win: false },
        });
        resultTimers.current[slotIdx] = setTimeout(() => updateSlot(slotIdx, { result: null }), 5000);
      }
      if (msg.type === "bet_fail") {
        const errSlot = (((msg.slot as number | undefined) ?? 1) - 1) as 0 | 1;
        alert(String(msg.error ?? "Bet failed. Please try again."));
        updateSlot(errSlot, { status: "idle" });
      }
      if (msg.type === "state") {
        const newPhase = (msg as { phase?: string }).phase;
        if (newPhase === "waiting") {
          setSlots(prev => {
            const next: [SlotState, SlotState] = [{ ...prev[0] }, { ...prev[1] }];
            for (let i = 0; i < 2; i++) {
              if (next[i].status === "lost" || next[i].status === "cashedout") {
                next[i] = { ...next[i], status: "idle", cashedOutAt: null };
              }
            }
            slotRefs.current = next;
            return next;
          });
        }
        if (newPhase === "flying") {
          setSlots(prev => {
            const next: [SlotState, SlotState] = [{ ...prev[0] }, { ...prev[1] }];
            for (let i = 0; i < 2; i++) {
              if (next[i].status === "placed") next[i] = { ...next[i], status: "active" };
            }
            slotRefs.current = next;
            return next;
          });
        }
      }
    };
    WSC.msgListeners.add(handler);
    return () => { WSC.msgListeners.delete(handler); };
  }, [updateSlot]);

  const phase     = WSC.state.phase;
  const mult      = WSC.state.mult;
  const countdown = WSC.state.countdown;
  const allBets   = WSC.state.allBets ?? [];
  const history   = WSC.state.history ?? [];
  const betCount    = WSC.state.betCount ?? 0;
  const cashedCount = WSC.state.cashedCount ?? 0;
  const totalWin    = WSC.state.totalWin ?? 0;
  const prevRound   = WSC.state.prevRound ?? null;
  const topBets     = WSC.state.topBets ?? [];
  const topHistory  = (WSC.state as any).topHistory ?? [];
  const connected   = WSC.state.connected;
  const synced      = WSC.state.synced;

  const [betsTab, setBetsTab] = useState<"all" | "prev" | "top">("all");
  const [topSort, setTopSort] = useState<"X" | "Win" | "Rounds">("X");
  const [topTime, setTopTime] = useState<"Day" | "Month" | "Year">("Month");

  function placeBet(slotIdx: 0 | 1) {
    if (!user) { onAuthOpen?.(); return; }
    const slot = slots[slotIdx];
    const isEffectivelyIdle = slot.status === "idle" || slot.status === "cashedout" || slot.status === "lost";
    if (!isEffectivelyIdle) return;
    wsSend({ type: "place_bet", slot: slotIdx + 1, amount: slot.amount });
    updateSlot(slotIdx, {
      status: (phase === "flying" || phase === "crashed") ? "queued" : "placed",
      result: null,
    });
  }

  function cancelBet(slotIdx: 0 | 1) {
    const slot = slots[slotIdx];
    if (slot.status !== "placed" && slot.status !== "queued") return;
    wsSend({ type: "cancel_bet", slot: slotIdx + 1 });
    updateSlot(slotIdx, { status: "idle" });
  }

  function cashOut(slotIdx: 0 | 1) {
    const slot = slots[slotIdx];
    if (slot.status !== "active" || phase !== "flying") return;
    wsSend({ type: "cashout", slot: slotIdx + 1 });
  }

  function setSlotAmount(slotIdx: 0 | 1, val: number) {
    const amt = Math.max(10, val);
    updateSlot(slotIdx, { amount: amt, input: String(amt) });
  }

  // ── Bet panel — exact port of expo renderBetPanel ──────────────────────
  function renderBetPanel(slotIdx: 0 | 1) {
    const slot = slots[slotIdx];
    const label = slotIdx === 0 ? "BET 1" : "BET 2";
    const effectiveStatus: SlotStatus = (slot.status === "cashedout" || slot.status === "lost") ? "idle" : slot.status;
    const canEdit = effectiveStatus === "idle";
    const potentialWin = effectiveStatus === "active" ? Math.floor(slot.amount * mult) : 0;

    let btnContent: React.ReactNode;
    if (effectiveStatus === "active" && phase === "flying") {
      btnContent = (
        <button onClick={() => cashOut(slotIdx)} style={{ flex: 1, width: "100%", background: "linear-gradient(to bottom, #FF8C00, #CC4400)", border: "none", borderRadius: 12, padding: "14px 0", cursor: "pointer", boxShadow: "0 0 16px rgba(255,107,0,0.8)" }}>
          <div style={{ color: "#FFF", fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>CASHOUT  ₹{potentialWin.toLocaleString("en-IN")}</div>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 700, marginTop: 1 }}>{mult.toFixed(2)}x</div>
        </button>
      );
    } else if (effectiveStatus === "placed") {
      btnContent = (
        <button onClick={() => cancelBet(slotIdx)} style={{ width: "100%", background: "rgba(0,200,83,0.07)", border: "1.5px solid rgba(0,200,83,0.4)", borderRadius: 12, padding: "10px 0", cursor: "pointer" }}>
          <div style={{ color: "#00C853", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, marginBottom: 3 }}>BET PLACED ✓</div>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 700, marginBottom: 3 }}>₹{slot.amount.toLocaleString("en-IN")}</div>
          <div style={{ color: "rgba(255,26,58,0.7)", fontSize: 8, fontWeight: 500, letterSpacing: 1.2 }}>TAP TO CANCEL</div>
        </button>
      );
    } else if (effectiveStatus === "queued") {
      btnContent = (
        <button onClick={() => cancelBet(slotIdx)} style={{ width: "100%", background: "rgba(255,152,0,0.07)", border: "1.5px solid rgba(255,152,0,0.45)", borderRadius: 12, padding: "10px 0", cursor: "pointer" }}>
          <div style={{ color: "#FF9800", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, marginBottom: 3 }}>NEXT ROUND ✓</div>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 700, marginBottom: 3 }}>₹{slot.amount.toLocaleString("en-IN")}</div>
          <div style={{ color: "rgba(255,26,58,0.7)", fontSize: 8, fontWeight: 500, letterSpacing: 1.2 }}>TAP TO CANCEL</div>
        </button>
      );
    } else {
      const canBet = !!user && effectiveStatus === "idle";
      const isNextRound = phase === "flying" || phase === "crashed";
      const btnBg = canBet
        ? (isNextRound ? "linear-gradient(to bottom, #1565C0, #0D47A1)" : "linear-gradient(to bottom, #00C853, #009C41)")
        : "linear-gradient(to bottom, rgba(20,20,30,0.4), rgba(10,10,20,0.4))";
      btnContent = (
        <button onClick={() => placeBet(slotIdx)} disabled={!canBet} style={{ width: "100%", background: btnBg, border: "none", borderRadius: 12, padding: "14px 0", cursor: canBet ? "pointer" : "default", opacity: canBet ? 1 : 0.7 }}>
          <div style={{ color: canBet ? "#FFF" : "#556", fontSize: 11, fontWeight: 700, letterSpacing: 0.8 }}>
            {!user ? "SIGN IN" : isNextRound ? `BET NEXT  ₹${slot.amount.toLocaleString("en-IN")}` : `BET  ₹${slot.amount.toLocaleString("en-IN")}`}
          </div>
          {isNextRound && canBet && <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: 500, marginTop: 2, letterSpacing: 1 }}>next round</div>}
        </button>
      );
    }

    return (
      <div key={slotIdx} style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, padding: 11 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 2 }}>{label}</span>
          {slot.result && (
            <span style={{ borderRadius: 8, padding: "3px 7px", backgroundColor: slot.result.win ? "rgba(0,200,83,0.15)" : "rgba(255,26,58,0.15)", color: slot.result.win ? "#00C853" : "#FF1A3A", fontSize: 10, fontWeight: 700 }}>
              {slot.result.text}
            </span>
          )}
        </div>

        {/* Amount row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <button onClick={() => setSlotAmount(slotIdx, slot.amount - 50)} disabled={!canEdit} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,26,58,0.12)", border: `1px solid ${C.border}`, color: C.text, fontSize: 20, fontWeight: 700, cursor: canEdit ? "pointer" : "default", opacity: canEdit ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
          <div style={{ flex: 1, display: "flex", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 10, border: `1px solid ${C.border}`, padding: "7px 9px" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.gold, marginRight: 2 }}>₹</span>
            <input
              type="number"
              value={slot.input}
              disabled={!canEdit}
              onChange={e => updateSlot(slotIdx, { input: e.target.value })}
              onBlur={() => {
                const v = parseInt(slot.input, 10);
                if (!isNaN(v) && v >= 10) updateSlot(slotIdx, { amount: v, input: String(v) });
                else updateSlot(slotIdx, { input: String(slot.amount) });
              }}
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, fontWeight: 700, color: C.text, width: "100%" }}
            />
          </div>
          <button onClick={() => setSlotAmount(slotIdx, slot.amount + 50)} disabled={!canEdit} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,26,58,0.12)", border: `1px solid ${C.border}`, color: C.text, fontSize: 20, fontWeight: 700, cursor: canEdit ? "pointer" : "default", opacity: canEdit ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>

        {/* Preset amounts */}
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          {[100, 250, 500, 1000].map(v => (
            <button key={v} onClick={() => setSlotAmount(slotIdx, v)} disabled={!canEdit} style={{ flex: 1, padding: "6px 0", borderRadius: 8, backgroundColor: slot.amount === v ? "rgba(255,26,58,0.18)" : "rgba(0,0,0,0.3)", border: `1px solid ${slot.amount === v ? C.red : C.border}`, color: slot.amount === v ? C.red : C.textMuted, fontSize: 10, fontWeight: 600, cursor: canEdit ? "pointer" : "default", opacity: canEdit ? 1 : 0.35 }}>
              ₹{v >= 1000 ? "1K" : v}
            </button>
          ))}
        </div>

        {btnContent}
      </div>
    );
  }

  // ── Top section helper ───────────────────────────────────────────────────
  const ROUNDS_DATA = [
    { user: "5***8", avatar: 3, rounds: 1842, wins: 1124 },
    { user: "2***1", avatar: 6, rounds: 1567, wins: 892 },
    { user: "7***4", avatar: 1, rounds: 1344, wins: 755 },
    { user: "3***9", avatar: 5, rounds: 1122, wins: 612 },
    { user: "9***2", avatar: 0, rounds: 987,  wins: 487 },
    { user: "4***7", avatar: 2, rounds: 856,  wins: 398 },
    { user: "8***5", avatar: 4, rounds: 742,  wins: 301 },
    { user: "1***6", avatar: 7, rounds: 621,  wins: 244 },
  ];

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yy} ${hh}:${mi}`;
  };
  const fmtMult = (m: number) => m >= 1000 ? m.toLocaleString("en-US", { maximumFractionDigits: 2 }) + "x" : m.toFixed(2) + "x";

  // ── Styles (matching expo) ───────────────────────────────────────────────
  const S = {
    avatarCircle: { width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as React.CSSProperties,
    avatarText: { fontSize: 15 } as React.CSSProperties,
    betsColText: { fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: 0.5 } as React.CSSProperties,
    betRow2: { display: "flex", alignItems: "center", gap: 6, paddingVertical: 5, borderBottom: `1px solid rgba(255,30,60,0.06)`, padding: "5px 0" } as React.CSSProperties,
    betUser2: { fontSize: 12, fontWeight: 500, color: C.textMuted } as React.CSSProperties,
    betAmt2: { fontSize: 12, fontWeight: 600, color: C.text, textAlign: "right" as const } as React.CSSProperties,
    betMult: { fontSize: 11, fontWeight: 700, textAlign: "center" as const } as React.CSSProperties,
    betWin: { fontSize: 12, fontWeight: 600, textAlign: "right" as const } as React.CSSProperties,
    topTableHeaderTxt: { fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: 0.5 } as React.CSSProperties,
    topTableDate: { fontSize: 10, color: C.textMuted } as React.CSSProperties,
    topTableMult: { fontSize: 11, fontWeight: 700, color: C.gold } as React.CSSProperties,
    topTableUser: { fontSize: 12, fontWeight: 600, color: C.text } as React.CSSProperties,
    topShieldBadge: { backgroundColor: "rgba(0,200,83,0.15)", borderRadius: 6, padding: "2px 5px" } as React.CSSProperties,
    topShieldTxt: { color: "#00C853", fontSize: 9, fontWeight: 700 } as React.CSSProperties,
    emptyMsg: { color: C.textMuted, fontSize: 12, textAlign: "center" as const, padding: "16px 0" } as React.CSSProperties,
  };

  // ── Shared JSX pieces ─────────────────────────────────────────────────────
  const historyChips = (
    <div style={{ display: "flex", overflowX: "auto", gap: 5, marginBottom: 10, scrollbarWidth: "none" as any }}>
      {history.map((h, i) => {
        const col = h >= 10 ? "#FF4DFF" : h >= 2 ? "#4DA6FF" : "#FF3A3A";
        const bg  = h >= 10 ? "rgba(255,77,255,0.13)" : h >= 2 ? "rgba(77,166,255,0.13)" : "rgba(255,58,58,0.13)";
        return (
          <div key={i} style={{ flexShrink: 0, borderRadius: 8, padding: "4px 9px", backgroundColor: bg, border: `1px solid ${col}55` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{h.toFixed(2)}x</span>
          </div>
        );
      })}
    </div>
  );

  // ── PLACEHOLDER so code compiles; full betsPanel below ────────────────────
  const betsPanel = (
    <div style={{ backgroundColor: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, padding: 14 }}>
              {/* Tab bar */}
              <div style={{ display: "flex", backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 20, padding: 3, marginBottom: 14 }}>
                {(["all", "prev", "top"] as const).map(tab => (
                  <button key={tab} onClick={() => setBetsTab(tab)} style={{ flex: 1, padding: "7px 0", borderRadius: 16, backgroundColor: betsTab === tab ? "rgba(255,255,255,0.12)" : "transparent", border: "none", cursor: "pointer", color: betsTab === tab ? C.text : C.textMuted, fontSize: 12, fontWeight: 600 }}>
                    {tab === "all" ? "All Bets" : tab === "prev" ? "Previous" : "Top"}
                  </button>
                ))}
              </div>

              {/* ── ALL BETS ── */}
              {betsTab === "all" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ ...S.avatarCircle, backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i > 0 ? -10 : 0 }}>
                          <span style={S.avatarText}>{AVATAR_EMOJI[i % AVATAR_EMOJI.length]}</span>
                        </div>
                      ))}
                      <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginLeft: 8 }}>{cashedCount}/{betCount} Bets</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>₹{totalWin >= 1000 ? (totalWin / 1000).toFixed(2) + "K" : totalWin.toFixed(2)}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.textMuted }}>Total win INR</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 3, backgroundColor: "rgba(255,26,58,0.12)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
                    <div style={{ height: "100%", backgroundColor: C.red, borderRadius: 2, width: betCount > 0 ? `${Math.min(100, (cashedCount / betCount) * 100)}%` : "0%" }} />
                  </div>
                  {/* Column header */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ ...S.betsColText, flex: 1.8 }}>Player</span>
                    <span style={{ ...S.betsColText, flex: 1.5, textAlign: "right" }}>Bet INR</span>
                    <span style={{ ...S.betsColText, flex: 0.9, textAlign: "center" }}>X</span>
                    <span style={{ ...S.betsColText, flex: 1.5, textAlign: "right" }}>Win INR</span>
                  </div>
                  {allBets.slice(0, 18).map((b, i) => (
                    <div key={i} style={S.betRow2}>
                      <div style={{ ...S.avatarCircle, backgroundColor: AVATAR_COLORS[b.avatar % AVATAR_COLORS.length] }}>
                        <span style={S.avatarText}>{AVATAR_EMOJI[b.avatar % AVATAR_EMOJI.length]}</span>
                      </div>
                      <span style={{ ...S.betUser2, flex: 1.4 }}>{b.user}</span>
                      <span style={{ ...S.betAmt2, flex: 1.5 }}>₹{b.amount.toLocaleString("en-IN")}</span>
                      <span style={{ ...S.betMult, flex: 0.9, color: b.status === "cashed" ? multColor(b.cashout ?? 0) : b.status === "lost" ? "#555" : "#888" }}>
                        {b.cashout ? `${b.cashout.toFixed(2)}x` : "—"}
                      </span>
                      <span style={{ ...S.betWin, flex: 1.5, color: b.winAmount > 0 ? "#00C853" : "#555" }}>
                        {b.winAmount > 0 ? `₹${b.winAmount.toLocaleString("en-IN")}` : "0.00"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── PREVIOUS ── */}
              {betsTab === "prev" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>Round Result</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: prevRound ? multColor(prevRound.result) : "#888" }}>
                      {prevRound ? `${prevRound.result.toFixed(2)}x` : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ ...S.betsColText, flex: 1.8 }}>Player</span>
                    <span style={{ ...S.betsColText, flex: 1.5, textAlign: "right" }}>Bet INR</span>
                    <span style={{ ...S.betsColText, flex: 0.9, textAlign: "center" }}>X</span>
                    <span style={{ ...S.betsColText, flex: 1.5, textAlign: "right" }}>Win INR</span>
                  </div>
                  {(prevRound?.bets ?? []).slice(0, 18).map((b, i) => (
                    <div key={i} style={S.betRow2}>
                      <div style={{ ...S.avatarCircle, backgroundColor: AVATAR_COLORS[b.avatar % AVATAR_COLORS.length] }}>
                        <span style={S.avatarText}>{AVATAR_EMOJI[b.avatar % AVATAR_EMOJI.length]}</span>
                      </div>
                      <span style={{ ...S.betUser2, flex: 1.4 }}>{b.user}</span>
                      <span style={{ ...S.betAmt2, flex: 1.5 }}>₹{b.amount.toLocaleString("en-IN")}</span>
                      <span style={{ ...S.betMult, flex: 0.9, color: b.cashout ? multColor(b.cashout) : "#555" }}>
                        {b.cashout ? `${b.cashout.toFixed(2)}x` : "—"}
                      </span>
                      <span style={{ ...S.betWin, flex: 1.5, color: b.winAmount > 0 ? "#00C853" : "#555" }}>
                        {b.winAmount > 0 ? `₹${b.winAmount.toLocaleString("en-IN")}` : "0.00"}
                      </span>
                    </div>
                  ))}
                  {!prevRound && <p style={S.emptyMsg}>No previous round data yet</p>}
                </div>
              )}

              {/* ── TOP ── */}
              {betsTab === "top" && (
                <div>
                  {/* Sort row */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {(["X", "Win", "Rounds"] as const).map(f => (
                      <button key={f} onClick={() => setTopSort(f)} style={{ flex: 1, padding: "5px 0", borderRadius: 8, backgroundColor: topSort === f ? "rgba(255,255,255,0.12)" : "transparent", border: `1px solid ${topSort === f ? C.border : "transparent"}`, color: topSort === f ? C.text : C.textMuted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{f}</button>
                    ))}
                  </div>
                  {/* Time row */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {(["Day", "Month", "Year"] as const).map(f => (
                      <button key={f} onClick={() => setTopTime(f)} style={{ flex: 1, padding: "5px 0", borderRadius: 8, backgroundColor: topTime === f ? "rgba(255,255,255,0.12)" : "transparent", border: `1px solid ${topTime === f ? C.border : "transparent"}`, color: topTime === f ? C.text : C.textMuted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{f}</button>
                    ))}
                  </div>

                  {/* X sub-tab */}
                  {topSort === "X" && (() => {
                    const cutoff = topTime === "Day" ? 86400000 : topTime === "Month" ? 30 * 86400000 : 365 * 86400000;
                    const rows = topHistory.filter((h: any) => Date.now() - new Date(h.date).getTime() < cutoff);
                    return (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={S.topTableHeaderTxt}>Date & Time</span>
                          <span style={S.topTableHeaderTxt}>X</span>
                        </div>
                        {rows.map((h: any, i: number) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid rgba(255,30,60,0.06)` }}>
                            <span style={S.topTableDate}>{fmtDate(h.date)}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={S.topTableMult}>{fmtMult(h.mult)}</span>
                              <div style={S.topShieldBadge}><span style={S.topShieldTxt}>✓</span></div>
                            </div>
                          </div>
                        ))}
                        {rows.length === 0 && <p style={S.emptyMsg}>No records for this period</p>}
                      </div>
                    );
                  })()}

                  {/* Win sub-tab */}
                  {topSort === "Win" && (() => {
                    const cutoff = topTime === "Day" ? 86400000 : topTime === "Month" ? 30 * 86400000 : 365 * 86400000;
                    const rows = topBets.filter(t => Date.now() - new Date(t.date).getTime() < cutoff);
                    return (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={S.topTableHeaderTxt}>Player</span>
                          <span style={S.topTableHeaderTxt}>Win INR</span>
                        </div>
                        {rows.map((t, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid rgba(255,30,60,0.06)` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ ...S.avatarCircle, backgroundColor: AVATAR_COLORS[t.avatar % AVATAR_COLORS.length], width: 28, height: 28 }}>
                                <span style={{ fontSize: 12 }}>{AVATAR_EMOJI[t.avatar % AVATAR_EMOJI.length]}</span>
                              </div>
                              <div>
                                <div style={S.topTableUser}>{t.user}</div>
                                <div style={{ fontSize: 10, color: multColor(t.mult) }}>{t.mult.toFixed(2)}x</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ color: "#00C853", fontSize: 13, fontWeight: 600 }}>₹{t.win.toLocaleString("en-IN")}</span>
                              <div style={S.topShieldBadge}><span style={S.topShieldTxt}>✓</span></div>
                            </div>
                          </div>
                        ))}
                        {rows.length === 0 && <p style={S.emptyMsg}>No records for this period</p>}
                      </div>
                    );
                  })()}

                  {/* Rounds sub-tab */}
                  {topSort === "Rounds" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={S.topTableHeaderTxt}>Player</span>
                        <span style={S.topTableHeaderTxt}>Rounds</span>
                      </div>
                      {ROUNDS_DATA.map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid rgba(255,30,60,0.06)` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ ...S.avatarCircle, backgroundColor: AVATAR_COLORS[r.avatar % AVATAR_COLORS.length], width: 28, height: 28 }}>
                              <span style={{ fontSize: 12 }}>{AVATAR_EMOJI[r.avatar % AVATAR_EMOJI.length]}</span>
                            </div>
                            <span style={S.topTableUser}>{r.user}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.rounds.toLocaleString()}</div>
                              <div style={{ fontSize: 10, color: C.textMuted, textAlign: "right" }}>{r.wins} wins</div>
                            </div>
                            <div style={S.topShieldBadge}><span style={S.topShieldTxt}>✓</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
    </div>
  );

  // ── Shared header content ─────────────────────────────────────────────────
  const headerContent = (
    <>
      <div style={{ backgroundColor: C.bgCard, borderRadius: 10, padding: "6px 10px", border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: C.textMuted, letterSpacing: 1.5 }}>BALANCE</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>₹{(user?.balance ?? 0).toLocaleString("en-IN")}</div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.red, letterSpacing: 4 }}>BLAZE</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!user && (
          <button onClick={onAuthOpen} style={{ background: C.red, color: "#fff", border: "none", borderRadius: 9, padding: "7px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", letterSpacing: 0.5 }}>Login</button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: C.bgCard, borderRadius: 10, padding: "6px 9px", border: `1px solid ${C.border}` }}>
          <div style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: connected ? "#00E676" : "#FF1A3A" }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted }}>{connected ? "LIVE" : "OFFLINE"}</span>
        </div>
      </div>
    </>
  );

  // ── Cashout toast ─────────────────────────────────────────────────────────
  const toast = cashoutPopup && (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", backgroundColor: "rgba(10,5,20,0.96)", border: `1px solid rgba(0,200,83,0.3)`, borderRadius: 14, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, zIndex: 1000, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
      <span style={{ fontSize: 22 }}>🚀</span>
      <div>
        <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{cashoutPopup.mult.toFixed(2)}x  ·  WIN</div>
        <div style={{ color: "#00C853", fontSize: 16, fontWeight: 700 }}>+₹{cashoutPopup.payout.toLocaleString("en-IN")}</div>
      </div>
      <div style={{ backgroundColor: "rgba(0,200,83,0.15)", borderRadius: 6, padding: "2px 6px" }}>
        <span style={{ color: "#00C853", fontSize: 11, fontWeight: 700 }}>✓</span>
      </div>
    </div>
  );

  // ── MOBILE layout (< 768px) — exact expo look ────────────────────────────
  if (!isDesktop) {
    return (
      <div style={{ flex: 1, backgroundColor: C.bg, minHeight: "100vh", fontFamily: "Inter,sans-serif", position: "relative" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ paddingBottom: 24 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 10px" }}>
              {headerContent}
            </div>
            <div style={{ padding: "0 16px" }}>
              {historyChips}
              <GameCanvas phase={phase} mult={mult} countdown={countdown} elapsed={elapsedSec} synced={synced} />
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {renderBetPanel(0)}
                {renderBetPanel(1)}
              </div>
              {betsPanel}
            </div>
          </div>
        </div>
        {toast}
      </div>
    );
  }

  // ── DESKTOP layout (≥ 768px) — 2-column wide layout ─────────────────────
  return (
    <div style={{ flex: 1, backgroundColor: C.bg, minHeight: "100vh", fontFamily: "Inter,sans-serif", position: "relative" }}>
      {/* Desktop header */}
      <div style={{ backgroundColor: C.bgCard, borderBottom: `1px solid ${C.border}`, padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        {headerContent}
      </div>

      {/* Main 2-column layout */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 24px", display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* LEFT COLUMN — game area (62%) */}
        <div style={{ flex: "0 0 62%", minWidth: 0 }}>
          {historyChips}
          <GameCanvas phase={phase} mult={mult} countdown={countdown} elapsed={elapsedSec} synced={synced} />
          {/* Bet panels side by side */}
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {renderBetPanel(0)}
            {renderBetPanel(1)}
          </div>
        </div>

        {/* RIGHT COLUMN — bets (38%) */}
        <div style={{ flex: "0 0 38%", minWidth: 0, position: "sticky", top: 80, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
          {betsPanel}
        </div>
      </div>

      {toast}
    </div>
  );
}
