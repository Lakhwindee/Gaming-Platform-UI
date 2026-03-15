import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getEngineSnapshot, setForcedCrash } from "../lib/gameEngine";

const router = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || "blaze-admin-2025";

function checkAuth(req: any, res: any): boolean {
  const key = req.headers["x-admin-key"] || req.query.key;
  if (key !== ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ── Admin Dashboard HTML ──────────────────────────────────────────────
router.get("/admin", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Blaze Admin</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0010;color:#f0e6f0;min-height:100vh}
  :root{--red:#FF1A3A;--gold:#FFD700;--green:#00C853;--blue:#4DA6FF;--pink:#FF4DFF;--card:rgba(180,0,40,0.13);--border:rgba(255,30,60,0.22);--muted:#AA7788}
  #login{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .login-box{background:rgba(255,26,58,0.08);border:1px solid var(--border);border-radius:20px;padding:40px;width:100%;max-width:380px;text-align:center}
  .login-box h1{font-size:28px;color:var(--red);margin-bottom:6px;letter-spacing:2px}
  .login-box p{color:var(--muted);font-size:13px;margin-bottom:28px}
  .logo{font-size:48px;margin-bottom:16px}
  input{width:100%;background:rgba(0,0,0,0.4);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;color:#f0e6f0;font-size:15px;outline:none;margin-bottom:14px}
  input:focus{border-color:var(--red)}
  button{width:100%;background:var(--red);color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:1px}
  button:hover{opacity:0.9} button:disabled{opacity:0.5;cursor:not-allowed}
  .err{color:var(--red);font-size:12px;margin-top:8px}
  #app{display:none;min-height:100vh}
  .topbar{background:rgba(0,0,0,0.6);border-bottom:1px solid var(--border);padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:56px;position:sticky;top:0;z-index:100;backdrop-filter:blur(8px)}
  .topbar h1{font-size:18px;color:var(--red);letter-spacing:1px}
  .topbar-right{display:flex;align-items:center;gap:12px}
  .live-dot{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .phase-badge{background:rgba(0,200,83,0.15);border:1px solid rgba(0,200,83,0.3);color:var(--green);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase}
  .logout-btn{background:transparent;border:1px solid var(--border);width:auto;padding:6px 14px;font-size:12px;border-radius:8px;color:var(--muted)}
  .tabs{display:flex;gap:0;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.3);padding:0 20px}
  .tab{padding:14px 20px;cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);border-bottom:2px solid transparent;transition:all 0.2s}
  .tab.active{color:var(--red);border-bottom-color:var(--red)}
  .tab:hover:not(.active){color:#f0e6f0}
  .content{padding:20px;max-width:1100px;margin:0 auto}
  .section{display:none}.section.active{display:block}
  .stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
  .stat-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
  .stat-val{font-size:26px;font-weight:700;color:var(--gold)}
  .stat-lbl{font-size:11px;color:var(--muted);margin-top:4px;letter-spacing:1px;text-transform:uppercase}
  .card{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px}
  .card-header{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
  .card-title{font-size:13px;font-weight:700;color:#f0e6f0;letter-spacing:1px;text-transform:uppercase}
  table{width:100%;border-collapse:collapse}
  th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid var(--border)}
  td{padding:12px 14px;font-size:13px;border-bottom:1px solid rgba(255,30,60,0.08)}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:rgba(255,26,58,0.05)}
  .badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase}
  .badge-bronze{background:rgba(205,127,50,0.2);color:#CD7F32}
  .badge-silver{background:rgba(192,192,192,0.2);color:#C0C0C0}
  .badge-gold{background:rgba(255,215,0,0.2);color:var(--gold)}
  .badge-platinum{background:rgba(0,207,255,0.2);color:#00CFFF}
  .badge-diamond{background:rgba(191,0,255,0.2);color:#BF00FF}
  .edit-bal{background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:#f0e6f0;font-size:12px;width:90px;margin-right:6px}
  .btn-sm{background:var(--red);border:none;border-radius:6px;padding:5px 12px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;width:auto}
  .btn-sm.green{background:var(--green)}
  .btn-sm.blue{background:var(--blue)}
  .btn-sm:hover{opacity:0.85}
  .search-row{display:flex;gap:10px;margin-bottom:16px}
  .search-row input{margin:0;flex:1}
  .game-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:600px){.game-grid{grid-template-columns:1fr}}
  .big-val{font-size:42px;font-weight:700;text-align:center;padding:20px 0}
  .control-row{display:flex;gap:10px;align-items:center;margin-bottom:12px}
  .control-row input{margin:0;flex:1}
  .control-row button{width:auto;padding:14px 20px}
  .toast{position:fixed;bottom:20px;right:20px;background:#222;border:1px solid var(--green);border-radius:10px;padding:12px 18px;font-size:13px;color:var(--green);z-index:999;transform:translateY(100px);transition:transform 0.3s}
  .toast.show{transform:translateY(0)}
  .toast.err{border-color:var(--red);color:var(--red)}
  .tx-type{padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase}
  .tx-deposit{background:rgba(0,200,83,0.15);color:var(--green)}
  .tx-withdraw{background:rgba(255,107,0,0.15);color:#FF6B00}
  .tx-bonus{background:rgba(255,215,0,0.15);color:var(--gold)}
  .tx-bet{background:rgba(255,26,58,0.15);color:var(--red)}
  .empty{text-align:center;padding:40px;color:var(--muted);font-size:13px}
  .spinner{border:2px solid rgba(255,26,58,0.2);border-top-color:var(--red);border-radius:50%;width:20px;height:20px;animation:spin 0.7s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<div id="login">
  <div class="login-box">
    <div class="logo">🚀</div>
    <h1>BLAZE</h1>
    <p>Admin Control Panel</p>
    <input type="password" id="pw" placeholder="Enter admin secret key" onkeydown="if(event.key==='Enter')doLogin()"/>
    <button onclick="doLogin()" id="loginBtn">SIGN IN</button>
    <div class="err" id="loginErr"></div>
  </div>
</div>

<div id="app">
  <div class="topbar">
    <h1>🚀 BLAZE ADMIN</h1>
    <div class="topbar-right">
      <div class="live-dot"></div>
      <span class="phase-badge" id="phaseBadge">WAITING</span>
      <span style="color:var(--muted);font-size:13px" id="liveMultText">—</span>
      <button class="logout-btn" onclick="doLogout()">Sign Out</button>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" onclick="switchTab('overview')">Overview</div>
    <div class="tab" onclick="switchTab('users')">Users</div>
    <div class="tab" onclick="switchTab('transactions')">Transactions</div>
    <div class="tab" onclick="switchTab('game')">Game Control</div>
  </div>

  <div class="content">

    <!-- OVERVIEW -->
    <div class="section active" id="tab-overview">
      <div class="stats-row" id="overviewStats">
        <div class="stat-card"><div class="stat-val" id="st-users">—</div><div class="stat-lbl">Total Users</div></div>
        <div class="stat-card"><div class="stat-val" id="st-balance">—</div><div class="stat-lbl">Total Balance</div></div>
        <div class="stat-card"><div class="stat-val" id="st-wagered">—</div><div class="stat-lbl">Total Wagered</div></div>
        <div class="stat-card"><div class="stat-val" id="st-deposits">—</div><div class="stat-lbl">Total Deposits</div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Live Game State</span><button class="btn-sm blue" onclick="loadOverview()">Refresh</button></div>
        <div style="padding:20px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center">
            <div><div style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Phase</div><div style="font-size:18px;font-weight:700;color:var(--gold)" id="gamePhase">—</div></div>
            <div><div style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Multiplier</div><div style="font-size:18px;font-weight:700;color:var(--red)" id="gameMult">—</div></div>
            <div><div style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Active Bets</div><div style="font-size:18px;font-weight:700;color:var(--green)" id="gameActiveBets">—</div></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Transactions</span></div>
        <table><thead><tr><th>User</th><th>Type</th><th>Amount</th><th>Note</th><th>Time</th></tr></thead>
        <tbody id="recentTxTable"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody></table>
      </div>
    </div>

    <!-- USERS -->
    <div class="section" id="tab-users">
      <div class="search-row">
        <input type="text" id="userSearch" placeholder="Search by username..." oninput="filterUsers()" />
        <button class="btn-sm blue" onclick="loadUsers()" style="padding:14px 18px">Refresh</button>
      </div>
      <div class="card">
        <table>
          <thead><tr><th>#</th><th>Username</th><th>Balance</th><th>Wins</th><th>Wagered</th><th>VIP</th><th>Joined</th><th>Action</th></tr></thead>
          <tbody id="userTable"><tr><td colspan="8" class="empty">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- TRANSACTIONS -->
    <div class="section" id="tab-transactions">
      <div class="card">
        <div class="card-header"><span class="card-title">All Transactions</span><button class="btn-sm blue" onclick="loadTransactions()">Refresh</button></div>
        <table>
          <thead><tr><th>ID</th><th>User ID</th><th>Type</th><th>Amount</th><th>Note</th><th>Status</th><th>Time</th></tr></thead>
          <tbody id="txTable"><tr><td colspan="7" class="empty">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- GAME CONTROL -->
    <div class="section" id="tab-game">
      <div class="game-grid">
        <div class="card">
          <div class="card-header"><span class="card-title">Force Next Crash</span></div>
          <div style="padding:18px">
            <p style="color:var(--muted);font-size:12px;margin-bottom:14px">Set the multiplier at which the NEXT round will crash. Takes effect on next round start.</p>
            <div class="control-row">
              <input type="number" id="crashInput" placeholder="e.g. 1.50" step="0.01" min="1.01" />
              <button onclick="forceCrash()" class="btn-sm" style="padding:14px 18px;font-size:13px">SET</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              <div style="width:100%;font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">🔴 Very Low</div>
              <button class="btn-sm" onclick="setC('1.01')">1.01x</button>
              <button class="btn-sm" onclick="setC('1.20')">1.20x</button>
              <button class="btn-sm" onclick="setC('1.30')">1.30x</button>
              <button class="btn-sm" onclick="setC('1.50')">1.50x</button>
              <button class="btn-sm" onclick="setC('1.75')">1.75x</button>
              <button class="btn-sm" onclick="setC('2.00')">2.00x</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
              <div style="width:100%;font-size:10px;color:#FF6B00;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">🟠 Low–Medium</div>
              <button class="btn-sm" style="background:#FF6B00" onclick="setC('2.50')">2.50x</button>
              <button class="btn-sm" style="background:#FF6B00" onclick="setC('3.00')">3.00x</button>
              <button class="btn-sm" style="background:#FF6B00" onclick="setC('4.00')">4.00x</button>
              <button class="btn-sm" style="background:#FF6B00" onclick="setC('5.00')">5.00x</button>
              <button class="btn-sm" style="background:#FF6B00" onclick="setC('7.00')">7.00x</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
              <div style="width:100%;font-size:10px;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">🟢 Medium–High</div>
              <button class="btn-sm green" onclick="setC('10.00')">10x</button>
              <button class="btn-sm green" onclick="setC('12.00')">12x</button>
              <button class="btn-sm green" onclick="setC('15.00')">15x</button>
              <button class="btn-sm green" onclick="setC('20.00')">20x</button>
              <button class="btn-sm green" onclick="setC('25.00')">25x</button>
              <button class="btn-sm green" onclick="setC('30.00')">30x</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
              <div style="width:100%;font-size:10px;color:var(--blue);letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">🔵 High</div>
              <button class="btn-sm blue" onclick="setC('50.00')">50x</button>
              <button class="btn-sm blue" onclick="setC('75.00')">75x</button>
              <button class="btn-sm blue" onclick="setC('100.00')">100x</button>
              <button class="btn-sm blue" onclick="setC('150.00')">150x</button>
              <button class="btn-sm blue" onclick="setC('200.00')">200x</button>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
              <div style="width:100%;font-size:10px;color:var(--pink);letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">🩷 Extreme</div>
              <button class="btn-sm" style="background:var(--pink)" onclick="setC('500.00')">500x</button>
              <button class="btn-sm" style="background:var(--pink)" onclick="setC('1000.00')">1000x</button>
            </div>
            <div id="forcedCrashStatus" style="margin-top:12px;font-size:12px;color:var(--muted)"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Live Game</span></div>
          <div style="padding:18px">
            <div id="liveGameCard">
              <div class="big-val" id="liveMult" style="color:var(--red)">—</div>
              <div style="text-align:center;color:var(--muted);font-size:12px;margin-bottom:16px" id="livePhaseText">—</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center">
                <div><div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:1px">Round ID</div><div style="font-weight:700;font-size:15px" id="liveRoundId">—</div></div>
                <div><div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:1px">Crash Point</div><div style="font-weight:700;font-size:15px;color:var(--red)" id="liveCrashPoint">—</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>

<div class="toast" id="toast"></div>

<script>
let AKEY = '';
let users = [];

function toast(msg, isErr=false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast' + (isErr?' err':'');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function api(path, opts={}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type':'application/json', 'x-admin-key': AKEY, ...(opts.headers||{}) } });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || 'Request failed');
  return d;
}

async function doLogin() {
  const pw = document.getElementById('pw').value.trim();
  const btn = document.getElementById('loginBtn');
  if (!pw) return;
  btn.disabled = true; btn.textContent = 'Verifying...';
  AKEY = pw;
  try {
    await api('/api/admin/ping');
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    loadOverview(); loadUsers(); loadTransactions();
    startLivePoll();
  } catch(e) {
    document.getElementById('loginErr').textContent = 'Wrong secret key';
    AKEY = '';
  }
  btn.disabled = false; btn.textContent = 'SIGN IN';
}

function doLogout() {
  AKEY = '';
  document.getElementById('login').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', ['overview','users','transactions','game'][i]===name));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
}

function fmtAmt(n) {
  if (n>=100000) return '₹'+(n/100000).toFixed(1)+'L';
  if (n>=1000) return '₹'+(n/1000).toFixed(1)+'K';
  return '₹'+n;
}
function timeAgo(iso) {
  const d = Math.floor((Date.now()-new Date(iso).getTime())/1000);
  if(d<60) return d+'s ago'; if(d<3600) return Math.floor(d/60)+'m ago';
  if(d<86400) return Math.floor(d/3600)+'h ago'; return Math.floor(d/86400)+'d ago';
}

async function loadOverview() {
  try {
    const [stats, snap, txs] = await Promise.all([
      api('/api/admin/stats'), api('/api/admin/game'), api('/api/admin/transactions?limit=8')
    ]);
    document.getElementById('st-users').textContent = stats.totalUsers;
    document.getElementById('st-balance').textContent = fmtAmt(stats.totalBalance);
    document.getElementById('st-wagered').textContent = fmtAmt(stats.totalWagered);
    document.getElementById('st-deposits').textContent = fmtAmt(stats.totalDeposits);
    document.getElementById('gamePhase').textContent = snap.phase.toUpperCase();
    document.getElementById('gameMult').textContent = snap.mult.toFixed(2)+'x';
    document.getElementById('gameActiveBets').textContent = snap.activeBets;
    const tbody = document.getElementById('recentTxTable');
    tbody.innerHTML = txs.length ? txs.map(t => \`<tr>
      <td style="color:#aaa">#\${t.userId}</td>
      <td><span class="tx-type tx-\${t.type}">\${t.type}</span></td>
      <td style="color:var(--gold)">\${fmtAmt(t.amount)}</td>
      <td style="color:#aaa;font-size:11px">\${t.note||'—'}</td>
      <td style="color:#666;font-size:11px">\${timeAgo(t.createdAt)}</td>
    </tr>\`).join('') : '<tr><td colspan="5" class="empty">No transactions</td></tr>';
  } catch(e) { toast(e.message, true); }
}

async function loadUsers() {
  try {
    users = await api('/api/admin/users');
    renderUsers(users);
  } catch(e) { toast(e.message, true); }
}

function renderUsers(list) {
  const tbody = document.getElementById('userTable');
  tbody.innerHTML = list.length ? list.map(u => \`<tr>
    <td style="color:#666">\${u.id}</td>
    <td style="font-weight:600">\${u.username}</td>
    <td style="color:var(--gold)">\${fmtAmt(u.balance)}</td>
    <td style="color:var(--green)">\${u.totalWins}</td>
    <td style="color:#aaa">\${fmtAmt(u.totalWagered)}</td>
    <td><span class="badge badge-\${u.vipLevel.toLowerCase()}">\${u.vipLevel}</span></td>
    <td style="color:#666;font-size:11px">\${timeAgo(u.createdAt)}</td>
    <td>
      <input class="edit-bal" type="number" id="bal_\${u.id}" placeholder="±amount" />
      <button class="btn-sm green" onclick="adjustBalance(\${u.id}, '\${u.username}')">Adjust</button>
    </td>
  </tr>\`).join('') : '<tr><td colspan="8" class="empty">No users</td></tr>';
}

function filterUsers() {
  const q = document.getElementById('userSearch').value.toLowerCase();
  renderUsers(users.filter(u => u.username.toLowerCase().includes(q)));
}

async function adjustBalance(userId, username) {
  const val = parseFloat(document.getElementById('bal_'+userId).value);
  if (isNaN(val) || val === 0) { toast('Enter a non-zero amount', true); return; }
  if (!confirm(\`\${val>0?'Add':'Deduct'} ₹\${Math.abs(val)} \${val>0?'to':'from'} \${username}?\`)) return;
  try {
    const r = await api('/api/admin/users/'+userId+'/balance', { method:'PATCH', body: JSON.stringify({ delta: val }) });
    toast(\`Done! New balance: \${fmtAmt(r.balance)}\`);
    loadUsers();
  } catch(e) { toast(e.message, true); }
}

async function loadTransactions() {
  try {
    const txs = await api('/api/admin/transactions?limit=50');
    const tbody = document.getElementById('txTable');
    tbody.innerHTML = txs.length ? txs.map(t => \`<tr>
      <td style="color:#666">#\${t.id}</td>
      <td style="color:#aaa">#\${t.userId}</td>
      <td><span class="tx-type tx-\${t.type}">\${t.type}</span></td>
      <td style="color:var(--gold);font-weight:700">\${fmtAmt(t.amount)}</td>
      <td style="color:#888;font-size:11px">\${t.note||'—'}</td>
      <td><span class="badge" style="background:rgba(0,200,83,0.15);color:var(--green)">\${t.status}</span></td>
      <td style="color:#666;font-size:11px">\${timeAgo(t.createdAt)}</td>
    </tr>\`).join('') : '<tr><td colspan="7" class="empty">No transactions</td></tr>';
  } catch(e) { toast(e.message, true); }
}

function setC(v) {
  document.getElementById('crashInput').value = v;
  forceCrash();
}
async function forceCrash() {
  const v = parseFloat(document.getElementById('crashInput').value);
  if (isNaN(v) || v < 1.01) { toast('Enter a valid multiplier (min 1.01)', true); return; }
  try {
    await api('/api/admin/game/force-crash', { method:'POST', body: JSON.stringify({ crashPoint: v }) });
    document.getElementById('forcedCrashStatus').innerHTML = \`<span style="color:var(--green)">✓ Next round will crash at \${v.toFixed(2)}x</span>\`;
    toast('Force crash set: '+v.toFixed(2)+'x');
  } catch(e) { toast(e.message, true); }
}

function startLivePoll() {
  async function poll() {
    try {
      const snap = await api('/api/admin/game');
      const col = snap.phase==='flying' ? 'var(--red)' : snap.phase==='crashed' ? '#FF6B00' : 'var(--muted)';
      document.getElementById('liveMult').style.color = col;
      document.getElementById('liveMult').textContent = snap.mult.toFixed(2)+'x';
      document.getElementById('livePhaseText').textContent = snap.phase.toUpperCase() + (snap.phase==='waiting'?' — '+snap.countdown+'s':'');
      document.getElementById('liveRoundId').textContent = snap.roundId;
      document.getElementById('liveCrashPoint').textContent = snap.crashPoint ? snap.crashPoint.toFixed(2)+'x' : '—';
      document.getElementById('phaseBadge').textContent = snap.phase.toUpperCase();
      document.getElementById('phaseBadge').style.color = col;
      document.getElementById('liveMultText').textContent = snap.mult.toFixed(2)+'x';
    } catch(_){}
  }
  poll(); setInterval(poll, 1000);
}
</script>
</body>
</html>`);
});

// ── Admin API endpoints ──────────────────────────────────────────────
router.get("/admin/ping", (req, res) => {
  if (!checkAuth(req, res)) return;
  res.json({ ok: true });
});

router.get("/admin/stats", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const rows = await db.select({
      totalUsers: sql<number>`count(*)::int`,
      totalBalance: sql<number>`coalesce(sum(balance),0)::bigint`,
      totalWagered: sql<number>`coalesce(sum(total_wagered),0)::bigint`,
    }).from(usersTable);

    const depRows = await db.select({
      totalDeposits: sql<number>`coalesce(sum(amount),0)::bigint`,
    }).from(transactionsTable).where(eq(transactionsTable.type, "deposit"));

    res.json({
      totalUsers: rows[0]?.totalUsers ?? 0,
      totalBalance: Number(rows[0]?.totalBalance ?? 0),
      totalWagered: Number(rows[0]?.totalWagered ?? 0),
      totalDeposits: Number(depRows[0]?.totalDeposits ?? 0),
    });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/users", async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const rows = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      balance: usersTable.balance,
      totalWins: usersTable.totalWins,
      totalLosses: usersTable.totalLosses,
      totalWagered: usersTable.totalWagered,
      vipLevel: usersTable.vipLevel,
      createdAt: usersTable.createdAt,
    }).from(usersTable).orderBy(desc(usersTable.createdAt));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/users/:id/balance", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const userId = parseInt(req.params.id);
  const { delta } = req.body as { delta?: number };
  if (!delta || !Number.isFinite(delta)) return res.status(400).json({ error: "Invalid delta" });

  try {
    const rows = await db
      .update(usersTable)
      .set({ balance: sql`GREATEST(0, balance + ${Math.floor(delta)})` })
      .where(eq(usersTable.id, userId))
      .returning({ balance: usersTable.balance });

    if (!rows.length) return res.status(404).json({ error: "User not found" });

    await db.insert(transactionsTable).values({
      userId,
      type: delta > 0 ? "deposit" : "withdraw",
      amount: Math.abs(Math.floor(delta)),
      note: `Admin adjustment: ${delta > 0 ? "+" : ""}${Math.floor(delta)}`,
      status: "completed",
    });

    res.json({ balance: rows[0].balance });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/transactions", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
  try {
    const rows = await db.select().from(transactionsTable)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/game", (req, res) => {
  if (!checkAuth(req, res)) return;
  res.json(getEngineSnapshot());
});

router.post("/admin/game/force-crash", (req, res) => {
  if (!checkAuth(req, res)) return;
  const { crashPoint } = req.body as { crashPoint?: number };
  if (!crashPoint || crashPoint < 1.01 || !Number.isFinite(crashPoint))
    return res.status(400).json({ error: "Invalid crash point (min 1.01)" });
  setForcedCrash(Math.round(crashPoint * 100) / 100);
  res.json({ ok: true, nextCrash: crashPoint });
});

export default router;
