import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable } from "@workspace/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { getEngineSnapshot, setForcedCrash, setCrashQueue, getCrashQueue, getOnlineUserIds, getOnlineStats } from "../lib/gameEngine";

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
  .online-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 5px var(--green);margin-right:5px;vertical-align:middle}
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
  .wd-pending{background:rgba(255,215,0,0.18);color:var(--gold);padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700}
  .wd-approved{background:rgba(0,200,83,0.18);color:var(--green);padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700}
  .wd-rejected{background:rgba(255,26,58,0.18);color:var(--red);padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700}
  .bet-active{background:rgba(255,215,0,0.15);color:var(--gold);padding:2px 6px;border-radius:5px;font-size:10px;font-weight:700}
  .bet-cashed{background:rgba(0,200,83,0.15);color:var(--green);padding:2px 6px;border-radius:5px;font-size:10px;font-weight:700}
  .bet-crashed{background:rgba(255,26,58,0.15);color:var(--red);padding:2px 6px;border-radius:5px;font-size:10px;font-weight:700}
  .action-row{display:flex;gap:6px}
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
    <div class="tab" onclick="switchTab('withdrawals')">Withdrawals <span id="wdBadge" style="background:var(--red);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:4px;display:none"></span></div>
    <div class="tab" onclick="switchTab('game')">Game Control</div>
  </div>

  <div class="content">

    <!-- OVERVIEW -->
    <div class="section active" id="tab-overview">
      <div class="stats-row" id="overviewStats">
        <div class="stat-card"><div class="stat-val" id="st-users">—</div><div class="stat-lbl">Total Users</div></div>
        <div class="stat-card"><div class="stat-val" id="st-online" style="color:var(--green)">—</div><div class="stat-lbl">🟢 Online Now</div></div>
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
          <thead><tr><th>#</th><th>Status</th><th>Username</th><th>Email</th><th>Balance</th><th>Wins</th><th>Losses</th><th>Wagered</th><th>VIP</th><th>Joined</th><th>Action</th></tr></thead>
          <tbody id="userTable"><tr><td colspan="11" class="empty">Loading...</td></tr></tbody>
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

    <!-- WITHDRAWALS -->
    <div class="section" id="tab-withdrawals">
      <div class="card">
        <div class="card-header">
          <span class="card-title">💸 Withdrawal Requests</span>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="wdFilter" onchange="loadWithdrawals()" style="background:#111;border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:#f0e6f0;font-size:12px">
              <option value="all">All</option>
              <option value="pending" selected>Pending Only</option>
              <option value="completed">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button class="btn-sm blue" onclick="loadWithdrawals()" style="padding:6px 14px">Refresh</button>
          </div>
        </div>
        <table>
          <thead><tr><th>#</th><th>User</th><th>Amount</th><th>UPI ID</th><th>Status</th><th>Requested</th><th>Action</th></tr></thead>
          <tbody id="wdTable"><tr><td colspan="7" class="empty">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- GAME CONTROL -->
    <div class="section" id="tab-game">
      <div class="game-grid">

        <!-- ROUND SCHEDULER -->
        <div class="card" style="grid-column:1/-1">
          <div class="card-header" style="justify-content:space-between">
            <span class="card-title">🗓️ Round Scheduler — Agle 10 Rounds</span>
            <span id="queueStatus" style="font-size:12px;color:var(--muted)">Queue: 0 rounds</span>
          </div>
          <div style="padding:18px">
            <p style="color:var(--muted);font-size:12px;margin-bottom:16px">Har round ka blast point set karo. Blank rounds auto (random) honge. Save karne ke baad queue active ho jaata hai.</p>

            <div id="schedulerRows" style="display:flex;flex-direction:column;gap:10px"></div>

            <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">
              <button onclick="saveSchedule()" style="flex:1;min-width:140px;background:var(--red);color:#fff;border:none;border-radius:10px;padding:13px 20px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.5px">✅ Save &amp; Queue</button>
              <button onclick="clearSchedule()" style="background:rgba(255,255,255,0.07);color:var(--muted);border:1px solid var(--border);border-radius:10px;padding:13px 20px;font-size:13px;font-weight:600;cursor:pointer">🗑️ Clear All</button>
            </div>
            <div id="scheduleMsg" style="margin-top:10px;font-size:13px;font-weight:600"></div>
          </div>
        </div>

        <!-- LIVE GAME -->
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

        <!-- CURRENT QUEUE PREVIEW -->
        <div class="card">
          <div class="card-header"><span class="card-title">📋 Active Queue</span></div>
          <div style="padding:18px">
            <div id="activeQueueList" style="display:flex;flex-direction:column;gap:6px">
              <div style="color:var(--muted);font-size:12px">Loading...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- LIVE BETS -->
      <div class="card" style="margin-top:16px">
        <div class="card-header">
          <span class="card-title">🎯 Live Bets This Round</span>
          <span style="color:var(--muted);font-size:11px" id="liveBetsCount">0 bets</span>
        </div>
        <table>
          <thead><tr><th>Player</th><th>Bet Amount</th><th>Status</th><th>Cashout At</th><th>Win Amount</th></tr></thead>
          <tbody id="liveBetsTable"><tr><td colspan="5" class="empty">Waiting for bets...</td></tr></tbody>
        </table>
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
    loadOverview(); loadUsers(); loadTransactions(); loadWithdrawalsBadge();
    buildSchedulerRows(); loadQueueStatus();
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
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', ['overview','users','transactions','withdrawals','game'][i]===name));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if (name === 'withdrawals') loadWithdrawals();
  if (name === 'game') loadQueueStatus();
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
    document.getElementById('st-online').textContent = stats.onlineUsers ?? snap.clientCount ?? 0;
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
    <td style="color:#666;font-size:11px">#\${u.id}</td>
    <td>\${u.online ? '<span class="online-dot"></span><span style="color:var(--green);font-size:10px;font-weight:700">ONLINE</span>' : '<span style="color:#555;font-size:10px">offline</span>'}</td>
    <td style="font-weight:700">\${u.username}</td>
    <td style="color:#aaa;font-size:11px;font-family:monospace">\${u.email || '—'}</td>
    <td style="color:var(--gold);font-weight:700">\${fmtAmt(u.balance)}</td>
    <td style="color:var(--green)">\${u.totalWins}</td>
    <td style="color:var(--red)">\${u.totalLosses}</td>
    <td style="color:#aaa">\${fmtAmt(u.totalWagered)}</td>
    <td><span class="badge badge-\${u.vipLevel.toLowerCase()}">\${u.vipLevel}</span></td>
    <td style="color:#666;font-size:11px">\${timeAgo(u.createdAt)}</td>
    <td>
      <input class="edit-bal" type="number" id="bal_\${u.id}" placeholder="±amount" />
      <button class="btn-sm green" onclick="adjustBalance(\${u.id}, '\${u.username}')">Adjust</button>
    </td>
  </tr>\`).join('') : '<tr><td colspan="11" class="empty">No users found</td></tr>';
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

async function loadWithdrawalsBadge() {
  try {
    const rows = await api('/api/admin/withdrawals?status=pending');
    const badge = document.getElementById('wdBadge');
    if (rows.length > 0) { badge.textContent = rows.length; badge.style.display = 'inline'; }
    else { badge.style.display = 'none'; }
  } catch(_){}
}

async function loadWithdrawals() {
  const filter = document.getElementById('wdFilter')?.value || 'pending';
  const url = filter === 'all' ? '/api/admin/withdrawals' : \`/api/admin/withdrawals?status=\${filter}\`;
  try {
    const rows = await api(url);
    const tbody = document.getElementById('wdTable');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No withdrawal requests found</td></tr>'; return; }
    tbody.innerHTML = rows.map(w => {
      const upi = (w.note || '').replace('Withdrawal to ', '') || '—';
      const actions = w.status === 'pending' ? \`<div class="action-row">
        <button class="btn-sm green" onclick="approveWithdraw(\${w.id})">✓ Approve</button>
        <button class="btn-sm" style="background:#555" onclick="rejectWithdraw(\${w.id})">✗ Reject</button>
      </div>\` : '—';
      const statusCls = w.status === 'pending' ? 'wd-pending' : w.status === 'completed' ? 'wd-approved' : 'wd-rejected';
      const statusLabel = w.status === 'pending' ? '⏳ Pending' : w.status === 'completed' ? '✓ Approved' : '✗ Rejected';
      return \`<tr>
        <td style="color:#666">#\${w.id}</td>
        <td style="font-weight:700">\${w.username || '#'+w.userId}</td>
        <td style="color:var(--gold);font-weight:700">\${fmtAmt(w.amount)}</td>
        <td style="color:#aaa;font-family:monospace;font-size:12px">\${upi}</td>
        <td><span class="\${statusCls}">\${statusLabel}</span></td>
        <td style="color:#666;font-size:11px">\${timeAgo(w.createdAt)}</td>
        <td>\${actions}</td>
      </tr>\`;
    }).join('');
    loadWithdrawalsBadge();
  } catch(e) { toast(e.message, true); }
}

async function approveWithdraw(id) {
  if (!confirm('Approve this withdrawal? Money will be sent to the user UPI.')) return;
  try {
    await api(\`/api/admin/withdrawals/\${id}/approve\`, { method: 'POST' });
    toast('✓ Withdrawal approved'); loadWithdrawals();
  } catch(e) { toast(e.message, true); }
}

async function rejectWithdraw(id) {
  if (!confirm('Reject this withdrawal? Balance will be REFUNDED to user.')) return;
  try {
    await api(\`/api/admin/withdrawals/\${id}/reject\`, { method: 'POST' });
    toast('Withdrawal rejected — balance refunded'); loadWithdrawals();
  } catch(e) { toast(e.message, true); }
}

// ── Round Scheduler ──────────────────────────────────────────────────────
const PRESETS = [
  { label:'1.01x', v:'1.01', c:'var(--red)' },
  { label:'1.5x',  v:'1.50', c:'var(--red)' },
  { label:'2x',    v:'2.00', c:'#FF6B00' },
  { label:'5x',    v:'5.00', c:'#FF6B00' },
  { label:'10x',   v:'10.00',c:'var(--green)' },
  { label:'25x',   v:'25.00',c:'var(--green)' },
  { label:'50x',   v:'50.00',c:'var(--blue)' },
  { label:'100x',  v:'100.00',c:'var(--blue)' },
];

function multColor(v) {
  if (!v || isNaN(v)) return 'var(--muted)';
  if (v < 2)   return 'var(--red)';
  if (v < 10)  return '#FF6B00';
  if (v < 50)  return 'var(--green)';
  return 'var(--blue)';
}

function buildSchedulerRows() {
  const container = document.getElementById('schedulerRows');
  container.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:10px 12px;flex-wrap:wrap';
    const label = document.createElement('div');
    label.style.cssText = 'min-width:64px;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase';
    label.textContent = 'Round ' + (i+1);
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = '0.01'; inp.min = '1.01';
    inp.id = 'sched_' + i;
    inp.placeholder = 'Auto (random)';
    inp.style.cssText = 'width:130px;background:#111;border:1.5px solid var(--border);border-radius:8px;padding:7px 10px;color:#f0e6f0;font-size:14px;font-weight:700;outline:none';
    inp.addEventListener('input', () => {
      const val = parseFloat(inp.value);
      inp.style.color = multColor(val);
      inp.style.borderColor = isNaN(val) ? 'var(--border)' : multColor(val);
    });
    const presetWrap = document.createElement('div');
    presetWrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;flex:1';
    PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.textContent = p.label;
      btn.style.cssText = \`background:\${p.c}22;color:\${p.c};border:1px solid \${p.c}55;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer\`;
      btn.onclick = () => { inp.value = p.v; inp.style.color = p.c; inp.style.borderColor = p.c; };
      presetWrap.appendChild(btn);
    });
    const clrBtn = document.createElement('button');
    clrBtn.textContent = '✕';
    clrBtn.title = 'Clear';
    clrBtn.style.cssText = 'background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:4px 9px;font-size:12px;cursor:pointer';
    clrBtn.onclick = () => { inp.value=''; inp.style.color=''; inp.style.borderColor='var(--border)'; };
    row.append(label, inp, presetWrap, clrBtn);
    container.appendChild(row);
  }
}

async function saveSchedule() {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const v = parseFloat(document.getElementById('sched_'+i).value);
    if (!isNaN(v) && v >= 1.01) points.push(Math.round(v*100)/100);
    else points.push(null);
  }
  const nonNull = points.filter(x => x !== null);
  try {
    await api('/api/admin/crash-queue', { method:'POST', body: JSON.stringify({ queue: nonNull }) });
    const msg = document.getElementById('scheduleMsg');
    msg.innerHTML = \`<span style="color:var(--green)">✅ Queued \${nonNull.length} round(s): \${nonNull.map(x=>x+'x').join(', ') || '—'}</span>\`;
    toast('Schedule saved — ' + nonNull.length + ' rounds queued');
    await loadQueueStatus();
  } catch(e) { toast(e.message, true); }
}

async function clearSchedule() {
  try {
    await api('/api/admin/crash-queue', { method:'POST', body: JSON.stringify({ queue: [] }) });
    document.getElementById('scheduleMsg').innerHTML = '<span style="color:var(--muted)">Queue cleared — rounds will be random.</span>';
    toast('Queue cleared');
    await loadQueueStatus();
  } catch(e) { toast(e.message, true); }
}

async function loadQueueStatus() {
  try {
    const d = await api('/api/admin/crash-queue');
    const q = d.queue || [];
    document.getElementById('queueStatus').textContent = 'Queue: ' + q.length + ' round' + (q.length!==1?'s':'');
    const list = document.getElementById('activeQueueList');
    if (!q.length) {
      list.innerHTML = '<div style="color:var(--muted);font-size:12px">No scheduled rounds — all auto (random)</div>';
      return;
    }
    list.innerHTML = q.map((v,i) => {
      const c = multColor(v);
      return \`<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid \${c}">
        <span style="color:var(--muted);font-size:11px;min-width:60px">Round \${i+1}</span>
        <span style="font-size:16px;font-weight:800;color:\${c}">\${v.toFixed(2)}x</span>
      </div>\`;
    }).join('');
  } catch(_){}
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
      renderLiveBets(snap.allBets || []);
    } catch(_){}
  }
  function renderLiveBets(bets) {
    const tbody = document.getElementById('liveBetsTable');
    const count = document.getElementById('liveBetsCount');
    if (!bets || !bets.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No bets this round</td></tr>';
      count.textContent = '0 bets'; return;
    }
    count.textContent = bets.length + ' bet' + (bets.length !== 1 ? 's' : '');
    tbody.innerHTML = bets.map(b => {
      const stCls = b.status === 'active' ? 'bet-active' : b.status === 'cashed' ? 'bet-cashed' : 'bet-crashed';
      const stLabel = b.status === 'active' ? '🟡 Flying' : b.status === 'cashed' ? '✅ Cashed' : '💥 Crashed';
      const cashoutAt = b.cashout ? b.cashout.toFixed(2) + 'x' : '—';
      const winAmt = b.winAmount > 0 ? '<span style="color:var(--green)">+' + fmtAmt(b.winAmount) + '</span>' : '—';
      return \`<tr>
        <td style="font-weight:700">\${b.user}</td>
        <td style="color:var(--gold)">\${fmtAmt(b.amount)}</td>
        <td><span class="\${stCls}">\${stLabel}</span></td>
        <td style="color:#4DA6FF;font-weight:700">\${cashoutAt}</td>
        <td>\${winAmt}</td>
      </tr>\`;
    }).join('');
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

    const onlineIds = getOnlineUserIds();
    res.json({
      totalUsers: rows[0]?.totalUsers ?? 0,
      totalBalance: Number(rows[0]?.totalBalance ?? 0),
      totalWagered: Number(rows[0]?.totalWagered ?? 0),
      totalDeposits: Number(depRows[0]?.totalDeposits ?? 0),
      onlineUsers: onlineIds.size,
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
    const onlineIds = getOnlineUserIds();
    const result = rows.map(r => ({ ...r, online: onlineIds.has(r.id) }));
    res.json(result);
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

router.get("/admin/withdrawals", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const status = req.query.status as string | undefined;
  try {
    const rows = await db
      .select({
        id: transactionsTable.id,
        userId: transactionsTable.userId,
        amount: transactionsTable.amount,
        note: transactionsTable.note,
        status: transactionsTable.status,
        createdAt: transactionsTable.createdAt,
        username: usersTable.username,
      })
      .from(transactionsTable)
      .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
      .where(
        status && status !== "all"
          ? and(eq(transactionsTable.type, "withdraw"), eq(transactionsTable.status, status))
          : eq(transactionsTable.type, "withdraw")
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(200);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/withdrawals/:id/approve", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const txId = parseInt(req.params.id);
  try {
    const rows = await db
      .update(transactionsTable)
      .set({ status: "completed" })
      .where(and(eq(transactionsTable.id, txId), eq(transactionsTable.status, "pending")))
      .returning({ id: transactionsTable.id });
    if (!rows.length) return res.status(404).json({ error: "Withdrawal not found or already processed" });
    res.json({ ok: true, message: "Withdrawal approved" });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/withdrawals/:id/reject", async (req, res) => {
  if (!checkAuth(req, res)) return;
  const txId = parseInt(req.params.id);
  try {
    const result = await db.transaction(async (tx) => {
      const [txRow] = await tx
        .select({ userId: transactionsTable.userId, amount: transactionsTable.amount, status: transactionsTable.status })
        .from(transactionsTable)
        .where(and(eq(transactionsTable.id, txId), eq(transactionsTable.type, "withdraw")));
      if (!txRow) throw new Error("Withdrawal not found");
      if (txRow.status !== "pending") throw new Error("Already processed");
      await tx.update(transactionsTable).set({ status: "rejected" }).where(eq(transactionsTable.id, txId));
      await tx.update(usersTable)
        .set({ balance: sql`balance + ${txRow.amount}` })
        .where(eq(usersTable.id, txRow.userId));
      await tx.insert(transactionsTable).values({
        userId: txRow.userId,
        type: "deposit",
        amount: txRow.amount,
        note: `Refund: withdrawal #${txId} rejected`,
        status: "completed",
      });
      return { ok: true };
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Server error" });
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

router.get("/admin/crash-queue", (req, res) => {
  if (!checkAuth(req, res)) return;
  res.json({ queue: getCrashQueue() });
});

router.post("/admin/crash-queue", (req, res) => {
  if (!checkAuth(req, res)) return;
  const { queue } = req.body as { queue?: unknown[] };
  if (!Array.isArray(queue)) return res.status(400).json({ error: "queue must be an array" });
  const valid = queue
    .map(v => parseFloat(String(v)))
    .filter(v => Number.isFinite(v) && v >= 1.01)
    .map(v => Math.round(v * 100) / 100)
    .slice(0, 10);
  setCrashQueue(valid);
  res.json({ ok: true, queued: valid.length, queue: valid });
});

export default router;
