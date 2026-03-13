import { useEffect, useRef, useState } from 'react';
import { useGame, makeId } from '../context/GameContext';

type Phase = 'waiting' | 'flying' | 'crashed';

const HISTORY_ITEMS = [2.14, 1.01, 8.56, 3.22, 1.01, 15.4, 2.87, 1.01, 4.12, 1.01, 22.8, 1.01, 1.63, 5.5, 1.01];
const HOUSE_COLORS = ['#F4A88A', '#8EC88E', '#A898E8', '#F0D86A', '#D898E0', '#72C8DC', '#F0B46A', '#88D0A8'];
const ROOF_COLORS  = ['#922210', '#225E22', '#383898', '#906A00', '#701858', '#005468', '#823A08', '#0A4840'];

function getMultiplier(elapsedSec: number): number {
  return Math.floor(Math.pow(Math.E, 0.077 * elapsedSec) * 100) / 100;
}

// ────────────────────────────────────────────────────────────────────────────
// BACKGROUND HELPERS
// ────────────────────────────────────────────────────────────────────────────
function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ([ [0,0,s*0.55], [s*0.45,s*0.12,s*0.40], [-s*0.45,s*0.14,s*0.35], [s*0.22,-s*0.2,s*0.45] ] as [number,number,number][])
    .forEach(([dx,dy,r]) => { ctx.beginPath(); ctx.arc(x+dx,y+dy,r,0,Math.PI*2); ctx.fill(); });
}

function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, wc: string, rc: string) {
  const W=130, H=92;
  ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(x+6,y+H+1,W,5);
  ctx.fillStyle=wc; ctx.beginPath(); ctx.rect(x,y,W,H); ctx.fill();
  ctx.fillStyle=rc; ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x+W/2,y-50); ctx.lineTo(x+W+10,y); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(x-10,y); ctx.lineTo(x+W/2,y-50); ctx.stroke();
  ctx.fillStyle='#6B3410'; ctx.beginPath(); ctx.rect(x+48,y+H-40,34,40); ctx.fill();
  ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(x+77,y+H-20,3.5,0,Math.PI*2); ctx.fill();
  [x+10, x+W-42].forEach(wx => {
    ctx.fillStyle='#B0D8F0'; ctx.fillRect(wx,y+18,32,28);
    ctx.fillStyle='rgba(255,255,150,0.22)'; ctx.fillRect(wx,y+18,32,28);
    ctx.strokeStyle='#fff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(wx+16,y+18); ctx.lineTo(wx+16,y+46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx,y+32); ctx.lineTo(wx+32,y+32); ctx.stroke();
  });
  ctx.fillStyle='#8B5A2B'; ctx.fillRect(x+W-28,y-58,14,28);
  ctx.fillStyle='rgba(160,160,160,0.5)';
  ctx.beginPath(); ctx.arc(x+W-21,y-65,7,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+W-17,y-75,5,0,Math.PI*2); ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, gy: number) {
  ctx.fillStyle='#7B5030'; ctx.fillRect(x-5,gy-45,10,45);
  [ ['#1E7A1E', 28], ['#28A028', 24], ['#3CC03C', 18] ].forEach(([c,r],i) => {
    ctx.fillStyle = c as string;
    ctx.beginPath(); ctx.arc(x, gy - 45 - i * 12, r as number, 0, Math.PI*2); ctx.fill();
  });
}

// ────────────────────────────────────────────────────────────────────────────
// DUST PUFF
// ────────────────────────────────────────────────────────────────────────────
type Puff = { x:number; y:number; r:number; life:number; vx:number; vy:number };

// ────────────────────────────────────────────────────────────────────────────
// JERRY — cartoon quality (big head, large eyes, squash & stretch)
// ────────────────────────────────────────────────────────────────────────────
function drawJerry(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, mode: 'run'|'walk'|'scared') {
  const speed = mode==='run' ? 12 : mode==='walk' ? 5 : 0;
  const ph = t * speed;           // running phase
  const v  = Math.cos(ph);        // -1..1 vertical
  const bob = mode==='run' ? Math.abs(v)*-10 : Math.abs(Math.sin(t*3))*-3;

  // squash/stretch: squash when foot hits (v≈1), stretch when airborne (v≈-1)
  const sqAmt = mode==='run' ? (v*0.5+0.5)*0.22 : 0;
  const sx = 1 + sqAmt*0.6;      // wider when squashed
  const sy = 1 - sqAmt;          // shorter when squashed

  ctx.save();
  ctx.translate(cx, cy + bob);
  if (mode==='run') ctx.rotate(-0.13);
  if (mode==='walk') ctx.rotate(-0.04);

  // ── TAIL (spring bezier) ──────────────────────────────────────────────────
  const tw1 = Math.sin(t*9)*18, tw2 = Math.cos(t*7)*12;
  ctx.strokeStyle='#B07028'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-5,-22);
  ctx.bezierCurveTo(-18,-42+tw1*0.4, -32+tw2*0.6,-62+tw1, -24+tw2*0.5,-80+tw1*0.8);
  ctx.stroke();
  const tipX=-24+tw2*0.5, tipY=-80+tw1*0.8;
  const tg=ctx.createRadialGradient(tipX,tipY,0,tipX,tipY,9);
  tg.addColorStop(0,'#fff'); tg.addColorStop(1,'#eee');
  ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(tipX,tipY,9,0,Math.PI*2); ctx.fill();

  // ── BACK LEG ─────────────────────────────────────────────────────────────
  jLeg(ctx, 6,-10, ph+Math.PI, '#A06828', true);

  // ── BODY (squash/stretch applied) ─────────────────────────────────────────
  ctx.save(); ctx.translate(0,-28); ctx.scale(sx,sy);
  const bg=ctx.createRadialGradient(-6,-10,2,0,0,20);
  bg.addColorStop(0,'#EEC070'); bg.addColorStop(0.6,'#C8903C'); bg.addColorStop(1,'#9C6818');
  ctx.fillStyle=bg; ctx.beginPath(); ctx.ellipse(0,0,16,20,0,0,Math.PI*2); ctx.fill();
  const belly=ctx.createRadialGradient(4,5,1,4,7,12);
  belly.addColorStop(0,'#F4D8A8'); belly.addColorStop(1,'#D4AE70');
  ctx.fillStyle=belly; ctx.beginPath(); ctx.ellipse(4,6,8,13,0.15,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // ── BACK ARM ─────────────────────────────────────────────────────────────
  const baSwing=Math.sin(ph+Math.PI)*0.7;
  ctx.strokeStyle='#C09050'; ctx.lineWidth=7; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(9,-38);
  ctx.quadraticCurveTo(18+Math.cos(baSwing)*8,-30+Math.sin(baSwing)*12, 16,-20+Math.sin(baSwing)*14);
  ctx.stroke();

  // ── FRONT LEG ─────────────────────────────────────────────────────────────
  jLeg(ctx, -6,-10, ph, '#B07828', false);

  // ── FRONT ARM ─────────────────────────────────────────────────────────────
  const faSwing=Math.sin(ph)*0.7;
  ctx.strokeStyle='#C09050'; ctx.lineWidth=7; ctx.lineCap='round';
  if (mode==='scared') {
    // arms thrown up in panic
    ctx.beginPath(); ctx.moveTo(-10,-40); ctx.lineTo(-22,-56+Math.sin(t*8)*4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10,-40); ctx.lineTo(22,-56+Math.cos(t*8)*4); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-10,-40);
    ctx.quadraticCurveTo(-18+Math.cos(faSwing)*8,-32+Math.sin(faSwing)*12, -16,-22+Math.sin(faSwing)*14);
    ctx.stroke();
  }

  // ── HEAD ─────────────────────────────────────────────────────────────────
  ctx.translate(2,-76);

  // Ear shadows
  ctx.fillStyle='rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.arc(-20,-20,20,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(20,-20,20,0,Math.PI*2); ctx.fill();

  // LEFT EAR
  const leg=ctx.createRadialGradient(-20,-20,2,-20,-20,20);
  leg.addColorStop(0,'#E8B860'); leg.addColorStop(0.7,'#C89040'); leg.addColorStop(1,'#906018');
  ctx.fillStyle=leg; ctx.beginPath(); ctx.arc(-20,-20,20,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#F4C888'; ctx.beginPath(); ctx.arc(-20,-20,12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFBBA8'; ctx.beginPath(); ctx.arc(-20,-20,7,0,Math.PI*2); ctx.fill();

  // RIGHT EAR
  const reg=ctx.createRadialGradient(20,-20,2,20,-20,20);
  reg.addColorStop(0,'#E8B860'); reg.addColorStop(0.7,'#C89040'); reg.addColorStop(1,'#906018');
  ctx.fillStyle=reg; ctx.beginPath(); ctx.arc(20,-20,20,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#F4C888'; ctx.beginPath(); ctx.arc(20,-20,12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFBBA8'; ctx.beginPath(); ctx.arc(20,-20,7,0,Math.PI*2); ctx.fill();

  // HEAD main
  const hg=ctx.createRadialGradient(-8,-8,3,0,0,32);
  hg.addColorStop(0,'#F0C878'); hg.addColorStop(0.55,'#CC9840'); hg.addColorStop(1,'#A07020');
  ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(0,0,32,0,Math.PI*2); ctx.fill();

  // Muzzle cheek area
  const mg=ctx.createRadialGradient(5,14,2,5,16,20);
  mg.addColorStop(0,'#F2D0A0'); mg.addColorStop(1,'#D4AC70');
  ctx.fillStyle=mg; ctx.beginPath(); ctx.ellipse(5,16,20,15,0,0,Math.PI*2); ctx.fill();

  // ── EYES ─────────────────────────────────────────────────────────────────
  const eyeH = mode==='scared' ? 14 : mode==='run' ? 10 : 12;
  [[-11,-6],[11,-6]].forEach(([ex,ey],i) => {
    // white
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.ellipse(ex,ey,9,eyeH,i===0?0.1:-0.1,0,Math.PI*2); ctx.fill();
    // shadow at top of eye
    ctx.fillStyle='rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.ellipse(ex,ey-4,9,6,0,0,Math.PI*2); ctx.fill();
    // pupil
    ctx.fillStyle='#1a0800';
    ctx.beginPath(); ctx.arc(ex+(mode==='run'?1.5:0),ey,5,0,Math.PI*2); ctx.fill();
    // iris color
    ctx.fillStyle='#3A2800';
    ctx.beginPath(); ctx.arc(ex+(mode==='run'?1.5:0),ey,3.5,0,Math.PI*2); ctx.fill();
    // shine (big)
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(ex+(mode==='run'?3:2),ey-2.5,2.5,0,Math.PI*2); ctx.fill();
    // shine (small)
    ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(ex-2+(mode==='run'?1:0),ey+2,1.2,0,Math.PI*2); ctx.fill();
  });

  // Eyebrows (raised = scared, normal = running)
  ctx.strokeStyle='#8B5818'; ctx.lineWidth=2.5; ctx.lineCap='round';
  if (mode==='scared') {
    ctx.beginPath(); ctx.moveTo(-18,-18); ctx.quadraticCurveTo(-11,-24,-4,-18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4,-18); ctx.quadraticCurveTo(11,-24,18,-18); ctx.stroke();
  }

  // NOSE
  const ng=ctx.createRadialGradient(5,10,1,5,12,7);
  ng.addColorStop(0,'#FF9898'); ng.addColorStop(1,'#DC5858');
  ctx.fillStyle=ng; ctx.beginPath(); ctx.ellipse(5,12,6,4,0,0,Math.PI*2); ctx.fill();

  // MOUTH
  ctx.strokeStyle='#8B5818'; ctx.lineWidth=2.2; ctx.lineCap='round';
  if (mode==='scared') {
    ctx.fillStyle='#CC3030';
    ctx.beginPath(); ctx.ellipse(5,22,9,7,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.ellipse(5,22,5,3,0,0,Math.PI*2); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-4,20); ctx.bezierCurveTo(2,24,10,23,14,19);
    ctx.stroke();
  }

  ctx.restore();
}

function jLeg(ctx: CanvasRenderingContext2D, ox: number, oy: number, ph: number, col: string, back: boolean) {
  // Thigh
  const thighA = Math.sin(ph) * 0.65;
  const tx = ox + Math.sin(thighA)*18;
  const ty = oy + Math.cos(thighA)*18;
  // Calf (knee bends forward during swing)
  const calfA = thighA + Math.max(0, Math.sin(ph+0.5))*0.9;
  const fx = tx + Math.sin(calfA)*16;
  const fy = ty + Math.cos(calfA)*16;
  ctx.strokeStyle=col; ctx.lineCap='round';
  ctx.lineWidth=back?8:9;
  ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(tx,ty); ctx.stroke();
  ctx.lineWidth=back?7:8;
  ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(fx,fy); ctx.stroke();
  // Foot
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.ellipse(fx+(Math.sin(calfA)*4),fy+2,10,5,calfA*0.3,0,Math.PI*2); ctx.fill();
}

// ────────────────────────────────────────────────────────────────────────────
// TOM — bigger, angular cat face, angry eyes, reaching arm
// ────────────────────────────────────────────────────────────────────────────
function drawTom(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, mode: 'run'|'walk'|'catch') {
  const speed = mode==='run' ? 11 : mode==='walk' ? 4.5 : 0;
  const ph = t * speed + 0.4;
  const v  = Math.cos(ph);
  const bob= mode==='run' ? Math.abs(v)*-9 : Math.abs(Math.sin(t*3+0.4))*-2;
  const sqAmt = mode==='run' ? (v*0.5+0.5)*0.18 : 0;
  const sx=1+sqAmt*0.5, sy=1-sqAmt;

  ctx.save();
  ctx.translate(cx, cy + bob);
  if (mode==='run') ctx.rotate(-0.18);
  if (mode==='walk') ctx.rotate(-0.05);

  // ── TAIL ─────────────────────────────────────────────────────────────────
  const tw1=Math.sin(t*8)*22, tw2=Math.cos(t*6)*14;
  ctx.strokeStyle='#607898'; ctx.lineWidth=7; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-8,-22);
  ctx.bezierCurveTo(-28,-48+tw1*0.4, -40+tw2*0.7,-75+tw1, -32+tw2*0.5,-92+tw1*0.9);
  ctx.stroke();
  const ttX=-32+tw2*0.5, ttY=-92+tw1*0.9;
  const ttg=ctx.createRadialGradient(ttX,ttY,0,ttX,ttY,10);
  ttg.addColorStop(0,'#fff'); ttg.addColorStop(1,'#eee');
  ctx.fillStyle=ttg; ctx.beginPath(); ctx.arc(ttX,ttY,10,0,Math.PI*2); ctx.fill();

  // ── BACK LEG ─────────────────────────────────────────────────────────────
  tLeg(ctx, 8,-12, ph+Math.PI, '#4A6878', true);

  // ── BODY ─────────────────────────────────────────────────────────────────
  ctx.save(); ctx.translate(0,-34); ctx.scale(sx,sy);
  const tbg=ctx.createRadialGradient(-8,-12,4,0,0,24);
  tbg.addColorStop(0,'#88A8C0'); tbg.addColorStop(0.5,'#607890'); tbg.addColorStop(1,'#3A5060');
  ctx.fillStyle=tbg; ctx.beginPath(); ctx.ellipse(0,0,20,26,0,0,Math.PI*2); ctx.fill();
  // Belly
  const tbelly=ctx.createRadialGradient(5,8,2,5,10,15);
  tbelly.addColorStop(0,'#F0E4CC'); tbelly.addColorStop(1,'#D8C8A0');
  ctx.fillStyle=tbelly; ctx.beginPath(); ctx.ellipse(5,10,10,16,0.1,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // ── BACK ARM ─────────────────────────────────────────────────────────────
  const baS=Math.sin(ph+Math.PI)*0.65;
  ctx.strokeStyle='#607890'; ctx.lineWidth=10; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(12,-44);
  ctx.quadraticCurveTo(22+Math.cos(baS)*10,-34+Math.sin(baS)*14, 20,-24+Math.sin(baS)*16);
  ctx.stroke();

  // ── FRONT LEG ─────────────────────────────────────────────────────────────
  tLeg(ctx,-8,-12, ph, '#507080', false);

  // ── FRONT ARM / REACHING ─────────────────────────────────────────────────
  ctx.strokeStyle='#6888A0'; ctx.lineWidth=11; ctx.lineCap='round';
  if (mode==='catch') {
    // Both arms lunge forward wrapping around
    ctx.beginPath(); ctx.moveTo(18,-48);
    ctx.bezierCurveTo(40,-40,55,-28,50,-16); ctx.stroke();
    // Paw
    const pawG=ctx.createRadialGradient(50,-16,0,50,-16,10);
    pawG.addColorStop(0,'#88A8C0'); pawG.addColorStop(1,'#607890');
    ctx.fillStyle=pawG; ctx.beginPath(); ctx.arc(50,-16,10,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18,-44);
    ctx.bezierCurveTo(38,-32,52,-14,46,-2); ctx.stroke();
    ctx.fillStyle=pawG; ctx.beginPath(); ctx.arc(46,-2,9,0,Math.PI*2); ctx.fill();
  } else {
    // Running arm + reaching forward
    const faS=Math.sin(ph)*0.65;
    ctx.beginPath(); ctx.moveTo(-14,-46);
    ctx.quadraticCurveTo(-24+Math.cos(faS)*10,-36+Math.sin(faS)*14,-22,-26+Math.sin(faS)*16);
    ctx.stroke();
    // Main reaching arm
    ctx.strokeStyle='#6888A0'; ctx.lineWidth=12;
    ctx.beginPath(); ctx.moveTo(18,-48);
    ctx.bezierCurveTo(34,-42, 50,-34, 56,-22+Math.sin(t*11)*4); ctx.stroke();
    // Paw with claws
    const pawG=ctx.createRadialGradient(56,-22,1,56,-22,10);
    pawG.addColorStop(0,'#90B0C8'); pawG.addColorStop(1,'#607890');
    ctx.fillStyle=pawG; ctx.beginPath(); ctx.arc(56,-22+Math.sin(t*11)*4,10,0,Math.PI*2); ctx.fill();
    // Claws
    ctx.strokeStyle='#D0D8E0'; ctx.lineWidth=2; ctx.lineCap='round';
    for(let c=0;c<3;c++){
      const ca=(c/2-0.5)*0.7;
      ctx.beginPath();
      ctx.moveTo(56+Math.cos(ca)*8,-22+Math.sin(t*11)*4+Math.sin(ca)*8);
      ctx.lineTo(56+Math.cos(ca)*16,-22+Math.sin(t*11)*4+Math.sin(ca)*16);
      ctx.stroke();
    }
  }

  // ── HEAD ─────────────────────────────────────────────────────────────────
  ctx.translate(2,-88 + bob*0.15);

  // EARS (pointy, triangular)
  const earColors=[['#4A6878','#FF9999'],['#4A6878','#FF9999']];
  [[-16,-12],[ 16,-12]].forEach(([ex,ey],i) => {
    const dir=i===0?-1:1;
    ctx.fillStyle=earColors[i][0];
    ctx.beginPath();
    ctx.moveTo(ex,ey+6);
    ctx.lineTo(ex+dir*4,ey-22);
    ctx.lineTo(ex+dir*14,ey+2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=earColors[i][1];
    ctx.beginPath();
    ctx.moveTo(ex+dir*1,ey+4);
    ctx.lineTo(ex+dir*4,ey-16);
    ctx.lineTo(ex+dir*10,ey+2);
    ctx.closePath(); ctx.fill();
  });

  // Head main
  const thg=ctx.createRadialGradient(-9,-9,3,0,0,28);
  thg.addColorStop(0,'#90B0C8'); thg.addColorStop(0.55,'#688898'); thg.addColorStop(1,'#3A5868');
  ctx.fillStyle=thg; ctx.beginPath(); ctx.arc(0,0,28,0,Math.PI*2); ctx.fill();

  // Cheek fur (lighter sides)
  ctx.fillStyle='rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.ellipse(-18,8,12,16,0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(18,8,12,16,-0.3,0,Math.PI*2); ctx.fill();

  // Muzzle
  const tmg=ctx.createRadialGradient(4,12,2,4,14,18);
  tmg.addColorStop(0,'#E8D8BC'); tmg.addColorStop(1,'#C8B890');
  ctx.fillStyle=tmg; ctx.beginPath(); ctx.ellipse(4,14,18,14,0,0,Math.PI*2); ctx.fill();

  // ── TOM EYES (angry, slanted) ─────────────────────────────────────────────
  const tEyeH = mode==='catch' ? 8 : 11;
  [[-10,-5],[10,-5]].forEach(([ex,ey],i) => {
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.ellipse(ex,ey,9,tEyeH,i===0?0.15:-0.15,0,Math.PI*2); ctx.fill();
    // Angry shadow (dark at top)
    ctx.fillStyle='rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(ex,ey-5,9,6,0,0,Math.PI*2); ctx.fill();
    // Pupil (green eyes — cats have green eyes)
    ctx.fillStyle='#1a3800';
    ctx.beginPath(); ctx.arc(ex+(i===0?1.5:-1.5),ey,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2a6000';
    ctx.beginPath(); ctx.arc(ex+(i===0?1.5:-1.5),ey,3.5,0,Math.PI*2); ctx.fill();
    // Vertical cat pupil slit
    ctx.fillStyle='#0a0a00';
    ctx.beginPath(); ctx.ellipse(ex+(i===0?1.5:-1.5),ey,1.5,3.5,0,0,Math.PI*2); ctx.fill();
    // Shine
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(ex+(i===0?3:1),ey-2,2,0,Math.PI*2); ctx.fill();
  });

  // ANGRY BROWS (slanted inward)
  ctx.strokeStyle='#2A3848'; ctx.lineWidth=3.5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-18,-17); ctx.lineTo(-4,-13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(18,-17); ctx.lineTo(4,-13); ctx.stroke();

  // NOSE
  const tng=ctx.createRadialGradient(4,10,1,4,12,7);
  tng.addColorStop(0,'#FF8888'); tng.addColorStop(1,'#CC4444');
  ctx.fillStyle=tng; ctx.beginPath(); ctx.ellipse(4,12,6,4.5,0,0,Math.PI*2); ctx.fill();

  // WHISKERS
  ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.8; ctx.lineCap='round';
  [[-6,-26,-12],[-6,-28,-14],[ 14,-26, 20],[ 14,-28, 22]].forEach(([x1,y1,x2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1+38); ctx.lineTo(x2,y1+36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1,y1+40); ctx.lineTo(x2,y1+42); ctx.stroke();
  });

  // MOUTH
  ctx.strokeStyle='#2A3848'; ctx.lineWidth=2.5; ctx.lineCap='round';
  if (mode==='catch') {
    // Big grin
    ctx.beginPath();
    ctx.moveTo(-10,24); ctx.bezierCurveTo(-6,32, 14,32, 18,24); ctx.stroke();
    ctx.fillStyle='#CC2828';
    ctx.beginPath(); ctx.moveTo(-10,24); ctx.bezierCurveTo(-6,32,14,32,18,24); ctx.lineTo(18,24); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.ellipse(4,28,8,4,0,0,Math.PI*2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-8,24); ctx.bezierCurveTo(-4,28,12,27,16,22); ctx.stroke();
  }

  ctx.restore();
}

function tLeg(ctx: CanvasRenderingContext2D, ox: number, oy: number, ph: number, col: string, back: boolean) {
  const thighA=Math.sin(ph)*0.6;
  const tx=ox+Math.sin(thighA)*20, ty=oy+Math.cos(thighA)*20;
  const calfA=thighA+Math.max(0,Math.sin(ph+0.5))*1.0;
  const fx=tx+Math.sin(calfA)*18, fy=ty+Math.cos(calfA)*18;
  ctx.strokeStyle=col; ctx.lineCap='round';
  ctx.lineWidth=back?11:13;
  ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(tx,ty); ctx.stroke();
  ctx.lineWidth=back?9:11;
  ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(fx,fy); ctx.stroke();
  // Paw/foot
  ctx.fillStyle=back?'#3A5060':'#4A6070';
  ctx.beginPath(); ctx.ellipse(fx+Math.sin(calfA)*5,fy+3,13,6,calfA*0.25,0,Math.PI*2); ctx.fill();
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────
export default function CrashGame() {
  const { state, navigate, addHistory, addNotification } = useGame();

  const [phase,       setPhase      ] = useState<Phase>('waiting');
  const [multiplier,  setMultiplier ] = useState(1.0);
  const [betAmount,   setBetAmount  ] = useState(100);
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [hasActiveBet,setHasActiveBet]=useState(false);
  const [cashedOutAt, setCashedOutAt] = useState<number|null>(null);
  const [countdown,   setCountdown  ] = useState(5);
  const [history,     setHistory    ] = useState(HISTORY_ITEMS);
  const [resultMsg,   setResultMsg  ] = useState<{text:string;win:boolean}|null>(null);
  const [crashPoint, setCrashPoint] = useState(0);
  const [bets, setBets] = useState([
    {user:'Player1',  amount:250,  status:'active', cashout:null as number|null},
    {user:'CryptoKing',amount:1000,status:'active', cashout:null as number|null},
    {user:'NeonBlade', amount:750, status:'active', cashout:null as number|null},
    {user:'StarDust',  amount:500, status:'active', cashout:null as number|null},
  ]);

  const intervalRef    = useRef<ReturnType<typeof setInterval>|null>(null);
  const countdownRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const animRef        = useRef<number>(0);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const startTimeRef   = useRef(0);
  const crashPointRef  = useRef(0);
  const multiplierRef  = useRef(1.0);
  const phaseRef       = useRef<Phase>('waiting');
  const hasActiveBetRef= useRef(false);
  const cashedOutRef   = useRef<number|null>(null);
  const scrollRef      = useRef(0);
  const crashTimeRef   = useRef(0);
  const puffsRef       = useRef<Puff[]>([]);
  const lastStepRef    = useRef(0);

  function generateCrashPoint() {
    const r=Math.random();
    if(r<0.28) return 1.00+Math.random()*0.05;
    if(r<0.50) return 1.1 +Math.random()*0.6;
    if(r<0.70) return 1.8 +Math.random()*1.5;
    if(r<0.85) return 3.5 +Math.random()*6;
    if(r<0.94) return 10  +Math.random()*20;
    if(r<0.99) return 30  +Math.random()*70;
    return 100+Math.random()*900;
  }

  function startCountdown() {
    phaseRef.current='waiting'; setPhase('waiting');
    setMultiplier(1.0); multiplierRef.current=1.0;
    setCashedOutAt(null); cashedOutRef.current=null;
    setResultMsg(null);
    hasActiveBetRef.current=false; setHasActiveBet(false);
    puffsRef.current=[];
    setBets([
      {user:'Player1',  amount:250 +Math.floor(Math.random()*750), status:'active',cashout:null},
      {user:'CryptoKing',amount:500+Math.floor(Math.random()*1500),status:'active',cashout:null},
      {user:'NeonBlade', amount:250+Math.floor(Math.random()*1000),status:'active',cashout:null},
      {user:'StarDust',  amount:100+Math.floor(Math.random()*500), status:'active',cashout:null},
    ]);
    const cp=generateCrashPoint(); setCrashPoint(cp); crashPointRef.current=cp;
    let tt=5; setCountdown(tt);
    if(countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current=setInterval(()=>{
      tt--; setCountdown(tt);
      if(tt<=0){ clearInterval(countdownRef.current!); startFlight(); }
    },1000);
  }

  function startFlight() {
    phaseRef.current='flying'; setPhase('flying');
    startTimeRef.current=Date.now();
    if(intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current=setInterval(()=>{
      const elapsed=(Date.now()-startTimeRef.current)/1000;
      const m=getMultiplier(elapsed);
      multiplierRef.current=m; setMultiplier(m);
      setBets(prev=>prev.map(b=>{
        if(b.status==='active'&&Math.random()<0.003&&m>1.2)
          return{...b,status:'cashed',cashout:m};
        return b;
      }));
      if(hasActiveBetRef.current&&autoCashout>1&&m>=autoCashout&&!cashedOutRef.current){doCashout(m);return;}
      if(m>=crashPointRef.current) doCrash(m);
    },100);
  }

  function doCashout(atMult:number){
    if(!hasActiveBetRef.current||cashedOutRef.current) return;
    cashedOutRef.current=atMult; setCashedOutAt(atMult);
    hasActiveBetRef.current=false; setHasActiveBet(false);
    const payout=Math.floor(betAmount*atMult), profit=payout-betAmount;
    setResultMsg({text:`Escaped at ${atMult.toFixed(2)}x! +₹${profit.toLocaleString()}`,win:true});
    if(state.user){
      addHistory({id:makeId(),game:'crash',wager:betAmount,multiplier:atMult,payout,won:true,timestamp:Date.now()});
      addNotification(`🐭 Jerry escaped at ${atMult.toFixed(2)}x! +₹${profit.toLocaleString()}`,'win');
    }
  }

  function doCrash(finalMult:number){
    if(intervalRef.current) clearInterval(intervalRef.current);
    phaseRef.current='crashed'; setPhase('crashed');
    crashTimeRef.current=Date.now();
    setHistory(prev=>[Math.floor(finalMult*100)/100,...prev].slice(0,15));
    if(hasActiveBetRef.current&&!cashedOutRef.current){
      setResultMsg({text:`Tom caught Jerry at ${finalMult.toFixed(2)}x! Lost ₹${betAmount.toLocaleString()}`,win:false});
      if(state.user)
        addHistory({id:makeId(),game:'crash',wager:betAmount,multiplier:finalMult,payout:0,won:false,timestamp:Date.now()});
      hasActiveBetRef.current=false; setHasActiveBet(false);
    }
    puffsRef.current=[];
    setBets(prev=>prev.map(b=>b.status==='active'?{...b,status:'crashed'}:b));
    setTimeout(()=>startCountdown(),4200);
  }

  function placeBet(){
    if(!state.user){navigate('profile');return;}
    if(state.user.balance<betAmount){alert('Insufficient balance!');return;}
    if(phase!=='waiting'){alert('Wait for next round!');return;}
    hasActiveBetRef.current=true; setHasActiveBet(true);
    setBets(prev=>[{user:state.user!.username,amount:betAmount,status:'active',cashout:null},...prev]);
  }
  function cashOut(){
    if(!hasActiveBetRef.current||phaseRef.current!=='flying'||cashedOutRef.current) return;
    doCashout(multiplierRef.current);
  }

  // ── CANVAS LOOP ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!;
    const W=canvas.width, H=canvas.height;
    const GY=278; // ground Y (characters' feet)

    function draw(){
      ctx.clearRect(0,0,W,H);
      const t=Date.now()/1000;
      const phase=phaseRef.current;
      const m=multiplierRef.current;
      const iscrashed=phase==='crashed';
      const isflying =phase==='flying';

      // Scroll speed
      const spd=isflying ? 2.5+(m-1)*2.2 : iscrashed ? 0.5 : 1.0;
      scrollRef.current+=spd;
      const sc=scrollRef.current;

      // ── SKY ──────────────────────────────────────────────────────────────
      const sky=ctx.createLinearGradient(0,0,0,GY);
      sky.addColorStop(0,'#1A72D0'); sky.addColorStop(0.5,'#4EB0F4'); sky.addColorStop(1,'#A0D8F8');
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,GY);

      // ── SUN ──────────────────────────────────────────────────────────────
      const sunX=W-100, sunY=58;
      ctx.shadowColor='#FFE844'; ctx.shadowBlur=40;
      const sunG=ctx.createRadialGradient(sunX,sunY,5,sunX,sunY,38);
      sunG.addColorStop(0,'#FFF080'); sunG.addColorStop(0.6,'#FFE030'); sunG.addColorStop(1,'#FFB800');
      ctx.fillStyle=sunG; ctx.beginPath(); ctx.arc(sunX,sunY,36,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(255,230,50,0.4)'; ctx.lineWidth=3;
      for(let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2+t*0.25;
        ctx.beginPath(); ctx.moveTo(sunX+Math.cos(a)*42,sunY+Math.sin(a)*42);
        ctx.lineTo(sunX+Math.cos(a)*58,sunY+Math.sin(a)*58); ctx.stroke();
      }

      // ── CLOUDS ───────────────────────────────────────────────────────────
      [[90,50,60],[300,36,45],[520,58,40],[700,42,52]].forEach(([bx,by,s])=>{
        const cx2=((bx-sc*0.15)%(W+160)+W+160)%(W+160);
        drawCloud(ctx,cx2,by,s);
      });

      // ── HILLS ────────────────────────────────────────────────────────────
      const hillG=ctx.createLinearGradient(0,GY-40,0,GY);
      hillG.addColorStop(0,'#5AB55A'); hillG.addColorStop(1,'#3A8A3A');
      ctx.fillStyle=hillG; ctx.beginPath(); ctx.moveTo(0,GY);
      for(let x=0;x<=W;x+=4){
        const hx=((x-sc*0.28)%900+900)%900;
        ctx.lineTo(x, GY-28+Math.sin(hx*0.014)*18+Math.sin(hx*0.028)*10);
      }
      ctx.lineTo(W,GY); ctx.closePath(); ctx.fill();

      // ── HOUSES ───────────────────────────────────────────────────────────
      const HS=220, NH=Math.ceil(W/HS)+3;
      for(let i=0;i<NH;i++){
        const hx=((i*HS-sc*1.6)%(NH*HS)+NH*HS)%(NH*HS);
        if(hx<W+160) drawHouse(ctx,hx-20,GY-115,HOUSE_COLORS[i%HOUSE_COLORS.length],ROOF_COLORS[i%ROOF_COLORS.length]);
      }

      // ── TREES ────────────────────────────────────────────────────────────
      const TS=150, NT=Math.ceil(W/TS)+3;
      for(let i=0;i<NT;i++){
        const tx=((i*TS+50-sc*2.8)%(NT*TS)+NT*TS)%(NT*TS);
        if(tx<W+60) drawTree(ctx,tx,GY);
      }

      // ── FENCE ────────────────────────────────────────────────────────────
      ctx.fillStyle='#F2E8D0';
      const FP=30, NP=Math.ceil(W/FP)+3;
      for(let i=0;i<NP;i++){
        const fx=((i*FP-sc*3.8)%(NP*FP)+NP*FP)%(NP*FP);
        if(fx<W+10){ ctx.fillRect(fx,GY-40,5,32); ctx.fillRect(fx-2,GY-42,9,7); }
      }
      ctx.fillRect(0,GY-26,W,5); ctx.fillRect(0,GY-15,W,5);

      // ── SIDEWALK ─────────────────────────────────────────────────────────
      const swG=ctx.createLinearGradient(0,GY,0,GY+32);
      swG.addColorStop(0,'#D0C8B8'); swG.addColorStop(1,'#B8B0A0');
      ctx.fillStyle=swG; ctx.fillRect(0,GY,W,32);
      ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=1;
      for(let i=0;i<12;i++){
        const slx=((i*80-sc*3)%(12*80)+12*80)%(12*80);
        if(slx<W){ ctx.beginPath(); ctx.moveTo(slx,GY); ctx.lineTo(slx,GY+32); ctx.stroke(); }
      }

      // ── ROAD ─────────────────────────────────────────────────────────────
      const rdG=ctx.createLinearGradient(0,GY+32,0,H);
      rdG.addColorStop(0,'#4A4A4A'); rdG.addColorStop(1,'#363636');
      ctx.fillStyle=rdG; ctx.fillRect(0,GY+32,W,H-GY-32);
      ctx.strokeStyle='#FFDD00'; ctx.lineWidth=3;
      ctx.setLineDash([36,20]); ctx.lineDashOffset=-(sc*3.8)%56;
      ctx.beginPath(); ctx.moveTo(0,GY+40); ctx.lineTo(W,GY+40); ctx.stroke();
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=5;
      ctx.setLineDash([48,32]); ctx.lineDashOffset=-(sc*5)%80;
      ctx.beginPath(); ctx.moveTo(0,GY+80); ctx.lineTo(W,GY+80); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset=0;

      // ── DUST PUFFS ───────────────────────────────────────────────────────
      // Spawn puffs when running
      if(isflying && Date.now()-lastStepRef.current > 120){
        lastStepRef.current=Date.now();
        const jerryX=Math.round(W*0.60);
        const tomX  =Math.round(W*0.38);
        [jerryX, tomX].forEach(px=>{
          puffsRef.current.push({x:px+(-10+Math.random()*20),y:GY+2,r:6+Math.random()*6,life:1,vx:-spd*0.3+Math.random()*2-1,vy:-1.5-Math.random()*1.5});
        });
      }
      // Update & draw puffs
      puffsRef.current=puffsRef.current.filter(p=>p.life>0).map(p=>{
        p.x+=p.vx; p.y+=p.vy; p.r*=1.06; p.life-=0.06;
        ctx.globalAlpha=p.life*0.55;
        ctx.fillStyle='#D8D0C0';
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
        return p;
      });

      // ── CHARACTERS ───────────────────────────────────────────────────────
      const jerryX=Math.round(W*0.60);
      const tomX  =Math.round(W*0.38);

      if(iscrashed){
        const cTime=(Date.now()-crashTimeRef.current)/1000;
        const prog=Math.min(cTime/0.45,1);
        const easeOut=(v:number)=>1-(1-v)*(1-v);
        const tomCX=tomX+(jerryX-40-tomX)*easeOut(prog);
        const jLift=easeOut(Math.min(cTime/0.45,1))*18;

        drawJerry(ctx,jerryX+14,GY-jLift,t,'scared');
        drawTom  (ctx,tomCX,GY,t,'catch');

        // Spin stars
        if(cTime>0.35){
          const starC=['#FFD700','#FF4444','#44FF44','#FF44FF','#44FFFF','#FF8800'];
          for(let s=0;s<7;s++){
            const sa=(s/7)*Math.PI*2+cTime*5;
            const sr=44+Math.sin(cTime*9+s)*9;
            const sx2=(tomCX+jerryX)/2+10+Math.cos(sa)*sr;
            const sy2=GY-50+Math.sin(sa)*sr*0.38;
            ctx.fillStyle=starC[s%starC.length];
            ctx.beginPath();
            for(let k=0;k<10;k++){
              const ka=(k/10)*Math.PI*2-Math.PI/2;
              const kr=k%2===0?12+s*1.5:5;
              if(k===0) ctx.moveTo(sx2+Math.cos(ka)*kr,sy2+Math.sin(ka)*kr);
              else ctx.lineTo(sx2+Math.cos(ka)*kr,sy2+Math.sin(ka)*kr);
            }
            ctx.closePath(); ctx.fill();
          }
        }
        if(cTime>0.8){
          ctx.save();
          ctx.font='bold 26px Impact,sans-serif';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          const bx=(tomCX+jerryX)/2+8, by=GY-105+Math.sin(cTime*5)*4;
          ctx.strokeStyle='#8B0000'; ctx.lineWidth=5;
          ctx.strokeText('GOTCHA! 🐱',bx,by);
          ctx.fillStyle='#FFD700';
          ctx.fillText('GOTCHA! 🐱',bx,by);
          ctx.restore();
        }

      } else if(isflying){
        drawJerry(ctx,jerryX,GY,t,'run');
        drawTom  (ctx,tomX,GY,t,'run');
        // Speed lines at high multiplier
        if(m>2.5){
          const alpha=Math.min((m-2.5)/6,0.4);
          ctx.globalAlpha=alpha; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
          for(let sl=0;sl<14;sl++){
            const slY=80+sl*14+((sl*41+sc*2)%55)-25;
            const slX=((sl*79+sc*6)%(W+100))-50;
            const len=30+sl*4;
            ctx.beginPath(); ctx.moveTo(slX,slY); ctx.lineTo(slX+len,slY); ctx.stroke();
          }
          ctx.globalAlpha=1;
        }
      } else {
        // Waiting — walk slowly
        drawJerry(ctx,jerryX-25,GY,t,'walk');
        drawTom  (ctx,tomX-45,GY,t,'walk');
      }

      // ── MULTIPLIER HUD ───────────────────────────────────────────────────
      if(isflying){
        const mColor=m>=5?'#00FF88':m>=3?'#FFD700':m>=2?'#FF9900':'#22EEFF';
        ctx.fillStyle='rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.roundRect(W/2-90,8,180,66,14); ctx.fill();
        ctx.strokeStyle=mColor+'99'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.roundRect(W/2-90,8,180,66,14); ctx.stroke();
        ctx.font='bold 52px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillStyle=mColor; ctx.shadowColor=mColor; ctx.shadowBlur=28;
        ctx.fillText(`${m.toFixed(2)}x`,W/2,14);
        ctx.shadowBlur=0;
      } else if(!iscrashed){
        ctx.fillStyle='rgba(0,0,0,0.62)';
        ctx.beginPath(); ctx.roundRect(W/2-120,8,240,58,14); ctx.fill();
        ctx.font='bold 13px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillStyle='#aaa'; ctx.fillText('RACE STARTS IN',W/2,14);
        ctx.font='bold 30px Inter,sans-serif'; ctx.fillStyle='#22EEFF';
        ctx.shadowColor='#22EEFF'; ctx.shadowBlur=14;
        ctx.fillText(`${countdown}s`,W/2,34);
        ctx.shadowBlur=0;
      }

      animRef.current=requestAnimationFrame(draw);
    }

    animRef.current=requestAnimationFrame(draw);
    return ()=>{ cancelAnimationFrame(animRef.current); };
  },[]);

  useEffect(()=>{
    startCountdown();
    return ()=>{
      if(intervalRef.current)  clearInterval(intervalRef.current);
      if(countdownRef.current) clearInterval(countdownRef.current);
    };
  },[]);

  const multColor=phase==='crashed'?'var(--neon-red)':multiplier>=3?'var(--neon-green)':multiplier>=2?'var(--neon-gold)':'var(--neon-blue)';

  return (
    <div style={{maxWidth:'1200px',margin:'0 auto',padding:'24px',animation:'slideIn 0.3s ease'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px',flexWrap:'wrap'}}>
        <button onClick={()=>navigate('fastgames')} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'10px',padding:'8px 16px',color:'var(--text2)',cursor:'pointer',fontSize:'14px'}}>← Back</button>
        <h1 style={{fontWeight:800,fontSize:'24px'}}>🐭 Crash — Tom & Jerry</h1>
        <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
          {history.slice(0,12).map((v,i)=>(
            <div key={i} style={{background:v<=1.5?'var(--neon-red)20':v>=10?'var(--neon-gold)20':'var(--neon-green)20',color:v<=1.5?'var(--neon-red)':v>=10?'var(--neon-gold)':'var(--neon-green)',borderRadius:'8px',padding:'4px 10px',fontSize:'12px',fontWeight:700}}>{v.toFixed(2)}x</div>
          ))}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'20px'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <div style={{background:'#1A72D0',borderRadius:'var(--radius-lg)',border:'1px solid var(--border)',position:'relative',overflow:'hidden'}}>
            <canvas ref={canvasRef} width={720} height={370} style={{width:'100%',display:'block'}}/>

            {phase==='crashed'&&(
              <div style={{position:'absolute',top:'52%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center',pointerEvents:'none',animation:'scaleIn 0.3s ease'}}>
                <div style={{fontSize:'50px',fontWeight:900,color:'var(--neon-red)',textShadow:'0 0 40px var(--neon-red)',lineHeight:1}}>CAUGHT!</div>
                <div style={{color:'var(--neon-red)',fontWeight:700,fontSize:'18px',marginTop:'6px'}}>Tom got Jerry at {multiplier.toFixed(2)}x</div>
              </div>
            )}
          </div>

          {resultMsg&&(
            <div style={{padding:'16px 20px',borderRadius:'var(--radius)',background:resultMsg.win?'var(--neon-green)15':'var(--neon-red)15',border:`1px solid ${resultMsg.win?'var(--neon-green)40':'var(--neon-red)40'}`,color:resultMsg.win?'var(--neon-green)':'var(--neon-red)',fontWeight:700,fontSize:'18px',textAlign:'center',animation:'scaleIn 0.3s ease'}}>
              {resultMsg.win?'🐭 Jerry escaped!':'🐱 Tom caught Jerry!'} {resultMsg.text}
            </div>
          )}

          <div style={{background:'var(--bg2)',borderRadius:'var(--radius-lg)',border:'1px solid var(--border)',overflow:'hidden'}}>
            <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:'14px'}}>👥 Live Bets</span>
              <span style={{color:'var(--text3)',fontSize:'13px'}}>{bets.length} players</span>
            </div>
            <div style={{maxHeight:'150px',overflowY:'auto'}}>
              {bets.map((b,i)=>(
                <div key={i} style={{padding:'10px 18px',borderBottom:i<bets.length-1?'1px solid var(--border)':'none',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:b.status==='crashed'?'var(--neon-red)':b.status==='cashed'?'var(--neon-green)':'var(--neon-blue)',animation:b.status==='active'?'pulse 1.5s infinite':'none'}}/>
                    <span style={{fontWeight:600,fontSize:'14px'}}>{b.user}</span>
                  </div>
                  <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
                    <span style={{color:'var(--text2)',fontSize:'13px'}}>₹{b.amount.toLocaleString()}</span>
                    {b.status==='cashed' &&<span style={{color:'var(--neon-green)',fontWeight:700,fontSize:'13px'}}>🐭 {b.cashout?.toFixed(2)}x</span>}
                    {b.status==='crashed'&&<span style={{color:'var(--neon-red)',fontWeight:700,fontSize:'13px'}}>🐱 Caught</span>}
                    {b.status==='active' &&<span style={{color:'var(--neon-blue)',fontSize:'12px',fontStyle:'italic'}}>Running…</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{background:'var(--bg2)',borderRadius:'var(--radius-lg)',border:'1px solid var(--border)',padding:'24px'}}>
            <h3 style={{fontWeight:700,marginBottom:'20px',fontSize:'16px'}}>🎯 Place Bet</h3>
            <label style={{display:'block',color:'var(--text2)',fontSize:'12px',fontWeight:700,marginBottom:'8px',letterSpacing:'1px'}}>BET AMOUNT</label>
            <input type="number" value={betAmount} onChange={e=>setBetAmount(Number(e.target.value))} disabled={phase!=='waiting'} style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'12px 14px',color:'var(--text)',fontSize:'16px',fontWeight:700,marginBottom:'8px'}}/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px',marginBottom:'16px'}}>
              {[100,250,500,1000].map(v=>(
                <button key={v} onClick={()=>setBetAmount(v)} disabled={phase!=='waiting'} style={{background:betAmount===v?'var(--neon-blue)20':'var(--bg3)',border:`1px solid ${betAmount===v?'var(--neon-blue)':'var(--border)'}`,color:betAmount===v?'var(--neon-blue)':'var(--text2)',borderRadius:'8px',padding:'8px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>{v}</button>
              ))}
            </div>
            <label style={{display:'block',color:'var(--text2)',fontSize:'12px',fontWeight:700,marginBottom:'8px',letterSpacing:'1px'}}>AUTO CASHOUT AT</label>
            <input type="number" value={autoCashout} step="0.1" min="1.1" onChange={e=>setAutoCashout(Number(e.target.value))} style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'12px 14px',color:'var(--text)',fontSize:'15px',fontWeight:700,marginBottom:'20px'}}/>

            {!hasActiveBet?(
              <button onClick={placeBet} disabled={phase!=='waiting'} style={{width:'100%',background:phase==='waiting'?'linear-gradient(135deg,#FF6B35,#FF3B8A)':'var(--bg3)',color:phase==='waiting'?'#fff':'var(--text2)',border:'none',borderRadius:'var(--radius)',padding:'16px',fontWeight:800,fontSize:'16px',cursor:phase==='waiting'?'pointer':'not-allowed'}}>
                {phase==='waiting'?`🐭 Help Jerry! ₹${betAmount.toLocaleString()}`:'🏃 Race in progress…'}
              </button>
            ):(
              <button onClick={cashOut} disabled={phase!=='flying'||!!cashedOutAt} style={{width:'100%',background:!cashedOutAt&&phase==='flying'?'var(--neon-green)':'var(--bg3)',color:!cashedOutAt&&phase==='flying'?'#000':'var(--text2)',border:'none',borderRadius:'var(--radius)',padding:'16px',fontWeight:800,fontSize:'16px',cursor:!cashedOutAt&&phase==='flying'?'pointer':'not-allowed',animation:!cashedOutAt&&phase==='flying'?'neonPulse 1.5s infinite':'none'}}>
                {cashedOutAt?`✅ Jerry escaped at ${cashedOutAt.toFixed(2)}x`:`🐭 Escape! ₹${Math.floor(betAmount*multiplier).toLocaleString()}`}
              </button>
            )}

            {phase==='flying'&&(
              <div style={{marginTop:'14px',padding:'14px',borderRadius:'12px',textAlign:'center',background:'var(--bg3)',border:`1px solid ${multColor}40`}}>
                <div style={{color:'var(--text3)',fontSize:'11px',fontWeight:700,letterSpacing:'1px',marginBottom:'4px'}}>MULTIPLIER</div>
                <div style={{fontSize:'36px',fontWeight:900,color:multColor,textShadow:`0 0 20px ${multColor}`,lineHeight:1}}>{multiplier.toFixed(2)}x</div>
                {hasActiveBet&&!cashedOutAt&&<div style={{color:'var(--neon-green)',fontSize:'14px',fontWeight:700,marginTop:'6px'}}>→ ₹{Math.floor(betAmount*multiplier).toLocaleString()}</div>}
              </div>
            )}

            {state.user&&(
              <div style={{marginTop:'12px',padding:'12px',borderRadius:'10px',background:'var(--bg3)',border:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
                <span style={{color:'var(--text2)',fontSize:'13px'}}>Balance</span>
                <span style={{fontWeight:700,color:'var(--neon-gold)',fontSize:'14px'}}>₹{state.user.balance.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div style={{background:'var(--bg2)',borderRadius:'var(--radius-lg)',border:'1px solid var(--border)',padding:'20px'}}>
            <h3 style={{fontWeight:700,marginBottom:'14px',fontSize:'14px'}}>🏁 Race History</h3>
            <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
              {history.map((v,i)=>(
                <div key={i} style={{background:v<=1.5?'var(--neon-red)15':v>=10?'var(--neon-gold)15':'var(--neon-green)15',color:v<=1.5?'var(--neon-red)':v>=10?'var(--neon-gold)':'var(--neon-green)',borderRadius:'8px',padding:'5px 10px',fontSize:'12px',fontWeight:700}}>{v.toFixed(2)}x</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
