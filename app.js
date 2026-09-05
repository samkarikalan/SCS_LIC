/* ============================================================
   SCS License Portal — app.js
   Hosted: https://samkarikalan.github.io/SCS_LIC/
   All API calls proxied via Cloudflare Worker (no keys exposed)
============================================================ */

const WORKER_URL = 'https://scs-app.karikalan-indo.workers.dev';

async function wPost(path, body) {
  try {
    const res = await fetch(WORKER_URL + path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch(e) { return null; }
}

// ── Theme ──────────────────────────────────────────────────
let isDark = document.documentElement.getAttribute('data-theme') === 'dark';
function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
  document.getElementById('themeColorMeta').content = isDark ? '#0d1117' : '#f0f4f8';
}

// ── Screen navigation ──────────────────────────────────────
const ADMIN_AUTH_KEY = 'scsLicAdminAuthed';

function isAdminRemembered() {
  return localStorage.getItem(ADMIN_AUTH_KEY) === '1';
}

function rememberAdminLogin() {
  localStorage.setItem(ADMIN_AUTH_KEY, '1');
}

function forgetAdminLogin() {
  localStorage.removeItem(ADMIN_AUTH_KEY);
}

function applyRememberedAdminAuth(name) {
  if (!isAdminRemembered()) return;

  adminAuthed = true;
  clubsAuthed = true;
  subsAuthed  = true;
  liveAuthed  = true;

  if (name === 'admin') {
    document.getElementById('adminLoginSection').style.display = 'none';
    document.getElementById('adminDashSection').style.display  = '';
    adminLoadRequests();
  } else if (name === 'clubs') {
    document.getElementById('clubsAuthGate').style.display = 'none';
    document.getElementById('clubsContent').style.display  = '';
    loadClubs();
  } else if (name === 'subscribers') {
    document.getElementById('subsAuthGate').style.display = 'none';
    document.getElementById('subsContent').style.display  = '';
    loadSubscribers();
  } else if (name === 'live') {
    document.getElementById('liveAuthGate').style.display = 'none';
    document.getElementById('liveContent').style.display  = '';
    loadLiveSessions();
  }
}

function showScreen(name) {
  if (name === 'request') {
    const ce = document.getElementById('checkEmail').value.trim();
    if (ce) setTimeout(() => { document.getElementById('reqEmail').value = ce; }, 50);
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  const navSection = name === 'club-detail' ? 'clubs' : (name === 'check' || name === 'request' ? 'home' : name);
  document.querySelectorAll('.app-bottom-nav button').forEach(button => {
    const active = button.dataset.screen === navSection;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  window.scrollTo(0, 0);
  applyRememberedAdminAuth(name);
  if (name === 'home') loadHomeHealth();
}

async function loadHomeHealth() {
  const gate = document.getElementById('homeHealthGate');
  const content = document.getElementById('homeHealthContent');
  if (!gate || !content) return;
  if (!isAdminRemembered()) {
    gate.style.display = '';
    content.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  content.style.display = '';
  const started = performance.now();
  ['dbHealthDot','appHealthDot'].forEach(id => {
    document.getElementById(id).className = 'health-dot checking';
  });
  try {
    const [usersResult, clubsResult, playersResult, sessionsResult] = await Promise.all([
      _dbGet('user_accounts', 'select=id,nickname,email,auth_provider,created_at&order=created_at.desc&limit=250'),
      _dbGet('clubs', 'select=id,name&limit=1000'),
      _dbGet('players', 'select=id&limit=1000'),
      _dbGet('sessions', 'select=id,club_id,status,created_at,updated_at&order=updated_at.desc&limit=1000')
    ]);
    if (!usersResult || !clubsResult || !playersResult || !sessionsResult) throw new Error('Health query failed');
    const users = _rows(usersResult);
    const clubs = _rows(clubsResult);
    const players = _rows(playersResult);
    const sessions = _rows(sessionsResult);
    const live = sessions.filter(session => !['completed','ended','closed','finished'].includes(String(session.status || '').toLowerCase()));
    const latency = Math.max(1, Math.round(performance.now() - started));
    const displayCount = (rows, limit) => rows.length >= limit ? limit.toLocaleString() + '+' : rows.length.toLocaleString();
    document.getElementById('healthUsers').textContent = displayCount(users, 250);
    document.getElementById('healthClubs').textContent = displayCount(clubs, 1000);
    document.getElementById('healthPlayers').textContent = displayCount(players, 1000);
    document.getElementById('healthSessions').textContent = displayCount(sessions, 1000);
    document.getElementById('healthLive').textContent = live.length;
    document.getElementById('healthUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    document.getElementById('dbHealthValue').textContent = 'Healthy';
    document.getElementById('dbHealthMeta').textContent = 'All data checks passed';
    document.getElementById('appHealthValue').textContent = 'Operational';
    document.getElementById('appHealthMeta').textContent = latency + ' ms API response';
    document.getElementById('dbHealthDot').className = 'health-dot healthy';
    document.getElementById('appHealthDot').className = 'health-dot healthy';
    const clubNames = new Map(clubs.map(club => [club.id, club.name || 'Unnamed club']));
    const usageCounts = sessions.reduce((counts, session) => {
      if (session.club_id && clubNames.has(session.club_id)) counts.set(session.club_id, (counts.get(session.club_id) || 0) + 1);
      return counts;
    }, new Map());
    const topClubs = [...usageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topUsage = topClubs.length ? topClubs[0][1] : 1;
    document.getElementById('healthClubUsage').innerHTML = topClubs.length ? topClubs.map(([clubId, count], index) => {
      const width = Math.max(8, Math.round((count / topUsage) * 100));
      return `<div class="health-club-row"><div class="health-club-rank">${index + 1}</div><div class="health-club-main"><div class="health-club-label"><strong>${escHtml(clubNames.get(clubId) || 'Unknown club')}</strong><span>${count} session${count === 1 ? '' : 's'}</span></div><div class="health-club-track"><i style="width:${width}%"></i></div></div></div>`;
    }).join('') : '<div class="no-requests">No club session usage found.</div>';
    const recentUsers = users.slice(0, 8);
    document.getElementById('healthUserHistory').innerHTML = recentUsers.length ? recentUsers.map(user => {
      const when = user.created_at ? new Date(user.created_at) : null;
      const whenText = when && !Number.isNaN(when.getTime())
        ? when.toLocaleDateString([], {day:'numeric',month:'short'}) + ' · ' + when.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
        : 'Date unavailable';
      const name = user.nickname || user.email || 'SCS user';
      return `<div class="health-user-row"><div class="health-user-initial">${escHtml(String(name).charAt(0).toUpperCase() || 'U')}</div><div class="health-user-main"><strong>${escHtml(name)}</strong><span>${escHtml(user.auth_provider || 'account')} · ${escHtml(whenText)}</span></div></div>`;
    }).join('') : '<div class="no-requests">No user registrations found.</div>';
  } catch (error) {
    document.getElementById('dbHealthValue').textContent = 'Unavailable';
    document.getElementById('dbHealthMeta').textContent = 'Database check failed';
    document.getElementById('appHealthValue').textContent = 'Degraded';
    document.getElementById('appHealthMeta').textContent = 'API did not respond';
    document.getElementById('dbHealthDot').className = 'health-dot unhealthy';
    document.getElementById('appHealthDot').className = 'health-dot unhealthy';
    document.getElementById('healthClubUsage').innerHTML = '<div class="no-requests">Could not load club usage.</div>';
    document.getElementById('healthUserHistory').innerHTML = '<div class="no-requests">Could not load user activity.</div>';
  }
}

document.addEventListener('DOMContentLoaded', loadHomeHealth);

// ── Toast ──────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.display = 'none', 3000);
}

// ── CHECK STATUS ───────────────────────────────────────────
function resetCheck() {
  document.getElementById('statusResult').classList.remove('visible');
  document.getElementById('notFoundCard').classList.remove('visible');
  document.getElementById('checkRequestBtn').style.display = 'none';
}

async function checkStatus() {
  const email = document.getElementById('checkEmail').value.trim().toLowerCase();
  if (!email) { toast('Please enter your email'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Please enter a valid email'); return; }

  const btn = document.getElementById('checkBtn');
  btn.innerHTML = '<span class="inline-spinner"></span>';
  btn.disabled  = true;
  resetCheck();

  try {
    const data = await wPost('/sub/restore', { email });

    if (!data || !data.restored) {
      document.getElementById('notFoundCard').classList.add('visible');
      document.getElementById('checkRequestBtn').style.display = 'flex';
    } else {
      const plan    = data.plan || 'basic';
      const expiry  = data.expires_at;
      const expired = expiry && new Date(expiry) < new Date();

      const iconMap  = { pro: '⚡', basic: '👁', trial: '⏳' };
      const bgMap    = { pro: 'rgba(16,185,129,.12)', basic: 'rgba(14,165,233,.1)', trial: 'rgba(245,158,11,.1)' };
      const badgeMap = { pro: 'badge-pro', basic: 'badge-basic', trial: 'badge-trial' };
      const nameMap  = { pro: 'Pro', basic: 'Basic', trial: 'Trial' };

      document.getElementById('statusResultIcon').textContent      = iconMap[plan]  || '🔑';
      document.getElementById('statusResultIcon').style.background = bgMap[plan]    || 'var(--bg2)';
      document.getElementById('statusPlanName').textContent        = nameMap[plan]  || plan;
      document.getElementById('statusPlanBadge').innerHTML         =
        '<span class="plan-badge ' + (badgeMap[plan] || '') + '">' + (nameMap[plan] || plan) + '</span>';
      document.getElementById('statusEmail').textContent = email;

      const sEl = document.getElementById('statusActive');
      sEl.textContent = expired ? '⚠️ Expired' : '✅ Active';
      sEl.className   = 'sr-val ' + (expired ? 'red' : 'green');

      const eEl = document.getElementById('statusExpiry');
      if (!expiry) {
        eEl.textContent = '∞ Never';
        eEl.className   = 'sr-val green';
      } else {
        eEl.textContent = new Date(expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        eEl.className   = 'sr-val' + (expired ? ' red' : '');
      }

      document.getElementById('statusResult').classList.add('visible');
      if (expired) document.getElementById('checkRequestBtn').style.display = 'flex';
    }
  } catch(e) {
    toast('Could not reach server. Please try again.');
  } finally {
    btn.innerHTML = '🔍 Check Status';
    btn.disabled  = false;
  }
}

// ── REQUEST UPGRADE ────────────────────────────────────────
let selectedPlan = 'pro';

function selectPlan(plan) {
  selectedPlan = plan;
  document.querySelectorAll('.plan-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('chip-' + plan).classList.add('selected');
}

function resetRequest() {
  document.getElementById('requestSuccess').classList.remove('visible');
  document.getElementById('requestForm').style.display = 'block';
  document.getElementById('reqEmail').value            = '';
  document.getElementById('reqName').value             = '';
  document.getElementById('reqMessage').value          = '';
  document.getElementById('submitError').textContent   = '';
  selectPlan('pro');
}

async function submitRequest() {
  const email   = document.getElementById('reqEmail').value.trim().toLowerCase();
  const name    = document.getElementById('reqName').value.trim();
  const message = document.getElementById('reqMessage').value.trim();
  const errEl   = document.getElementById('submitError');

  errEl.textContent = '';

  if (!email) { errEl.textContent = 'Email is required'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Please enter a valid email'; return; }

  const btn = document.getElementById('submitBtn');
  btn.innerHTML = '<span class="inline-spinner"></span> Sending…';
  btn.disabled  = true;

  try {
    // Check for existing pending request
    const status = await wPost('/sub/purchase-status', { email });
    if (status && status.found) {
      errEl.textContent = 'You already have a pending ' + (status.plan || '') + ' request (' + status.hrsLeft + 'hrs remaining). Admin will activate it soon.';
      return;
    }

    // Submit request via Worker
    const result = await wPost('/sub/purchase-request', { email, plan: selectedPlan });

    if (!result || !result.success) {
      errEl.textContent = 'Failed to submit. Please try again.';
      return;
    }

    // Show success
    document.getElementById('requestForm').style.display = 'none';
    document.getElementById('requestSuccess').classList.add('visible');

  } catch(e) {
    errEl.textContent = 'Could not reach server. Please try again.';
  } finally {
    btn.innerHTML = '⬆️ Submit Request';
    btn.disabled  = false;
  }
}

// ── ADMIN ──────────────────────────────────────────────────

// Admin password is fetched from worker (/sub/app-config key: admin_password)
// Falls back to checking against Supabase club admin_password via worker

let adminAuthed     = false;
let activateTarget  = null; // { email, plan, requestId }
let modalDuration   = '1m';
let directDuration  = '1m';
let directPlan      = 'pro';

function adminReset() {
  adminAuthed = false;
  document.getElementById('adminLoginSection').style.display  = '';
  document.getElementById('adminDashSection').style.display   = 'none';
  document.getElementById('adminPwInput').value               = '';
  document.getElementById('adminLoginError').textContent      = '';
}

async function adminLogin() {
  const pw    = document.getElementById('adminPwInput').value.trim();
  const errEl = document.getElementById('adminLoginError');
  errEl.textContent = '';
  if (!pw) { errEl.textContent = 'Password required'; return; }

  const btn = event.target;
  btn.innerHTML = '<span class="inline-spinner"></span>'; btn.disabled = true;

  try {
    // Validate against app_config admin_password stored in Supabase via worker
    const cfg = await wPost('/sub/app-config', {});
    if (!cfg) { errEl.textContent = 'Could not reach server'; return; }

    const adminPw = cfg.admin_password || cfg.adminPassword;
    if (!adminPw) { errEl.textContent = 'Admin password not configured'; return; }
    if (pw !== adminPw) { errEl.textContent = 'Incorrect password'; return; }

    adminAuthed = true;
    clubsAuthed = true;
    subsAuthed  = true;
    liveAuthed  = true;
    rememberAdminLogin();
    document.getElementById('adminLoginSection').style.display = 'none';
    document.getElementById('adminDashSection').style.display  = '';
    adminLoadRequests();
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
  } finally {
    btn.innerHTML = '🔐 Login'; btn.disabled = false;
  }
}

function adminLogout() {
  forgetAdminLogin();
  adminAuthed = false;
  clubsAuthed = false;
  subsAuthed  = false;
  liveAuthed  = false;
  document.getElementById('clubsAuthGate').style.display = '';
  document.getElementById('clubsContent').style.display  = 'none';
  document.getElementById('subsAuthGate').style.display  = '';
  document.getElementById('subsContent').style.display   = 'none';
  document.getElementById('liveAuthGate').style.display  = '';
  document.getElementById('liveContent').style.display   = 'none';
  showScreen('home');
  adminReset();
}

// ── Load pending requests ──────────────────────────────────

async function adminLoadRequests() {
  if (!adminAuthed) return;
  const listEl = document.getElementById('adminRequestsList');
  listEl.innerHTML = '<div class="no-requests">Loading...</div>';

  const data = await wPost('/sub/admin-requests', {});
  if (!data || !data.requests || !data.requests.length) {
    listEl.innerHTML = '<div class="no-requests">✅ No pending requests</div>';
    return;
  }

  listEl.innerHTML = data.requests.map(req => {
    const planClass = req.plan === 'pro' ? 'req-plan-pro' : 'req-plan-basic';
    const planLabel = req.plan === 'pro' ? '⚡ Pro' : '👁 Basic';
    const timeAgo   = _timeAgo(req.created_at);
    return `<div class="req-card" id="reqcard-${req.id}">
      <div class="req-card-header">
        <div>
          <div class="req-email">${req.email}</div>
          <div class="req-meta">${timeAgo}</div>
        </div>
        <span class="req-plan-badge ${planClass}">${planLabel}</span>
      </div>
      <div class="req-actions">
        <button class="btn-activate" onclick="openActivateModal('${req.id}','${req.email}','${req.plan}',this)">⚡ Activate</button>
        <button class="btn-dismiss"  onclick="dismissRequest('${req.id}',this)">✕</button>
      </div>
    </div>`;
  }).join('');
}

function _timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

async function dismissRequest(requestId, btn) {
  btn.disabled = true; btn.textContent = '...';
  const res = await wPost('/sub/purchase-cancel-by-id', { requestId });
  if (res && res.ok) {
    document.getElementById('reqcard-' + requestId)?.remove();
    const listEl = document.getElementById('adminRequestsList');
    if (!listEl.querySelector('.req-card')) {
      listEl.innerHTML = '<div class="no-requests">✅ No pending requests</div>';
    }
  } else {
    btn.disabled = false; btn.textContent = '✕';
    toast('Failed to dismiss');
  }
}

// ── Activate modal ─────────────────────────────────────────

function openActivateModal(requestId, email, plan, btn) {
  activateTarget = { requestId, email, plan };
  modalDuration  = '1m';
  document.getElementById('modalSubText').textContent   = `${plan === 'pro' ? '⚡ Pro' : '👁 Basic'} plan for ${email}`;
  document.getElementById('modalKeyResult').classList.remove('visible');
  document.getElementById('modalError').textContent     = '';
  document.getElementById('modalActivateBtn').textContent = '⚡ Generate & Activate';
  document.getElementById('modalActivateBtn').disabled  = false;
  // Reset duration chips
  ['1m','6m','1y','life'].forEach(d => {
    document.getElementById('mdur-' + d).classList.toggle('selected', d === '1m');
  });
  document.getElementById('activateModal').style.display = '';
}

function closeActivateModal(e) {
  if (e && e.target !== document.querySelector('#activateModal .modal-overlay')) return;
  document.getElementById('activateModal').style.display = 'none';
  activateTarget = null;
}
// Override for button click
window.closeActivateModal = function(e) {
  document.getElementById('activateModal').style.display = 'none';
  activateTarget = null;
};

function selectModalDuration(d) {
  modalDuration = d;
  ['1m','6m','1y','life'].forEach(k => {
    document.getElementById('mdur-' + k).classList.toggle('selected', k === d);
  });
}

async function modalActivate() {
  if (!activateTarget) return;
  const btn   = document.getElementById('modalActivateBtn');
  const errEl = document.getElementById('modalError');
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = '⏳ Activating...';

  try {
    const expiresAt = _calcExpiry(modalDuration);
    const res = await wPost('/sub/admin-activate', {
      email:     activateTarget.email,
      plan:      activateTarget.plan,
      expiresAt: expiresAt,
      requestId: activateTarget.requestId
    });

    if (!res || !res.success) {
      errEl.textContent = res?.error || 'Activation failed';
      btn.disabled = false; btn.textContent = '⚡ Generate & Activate';
      return;
    }

    // Show key
    document.getElementById('modalKeyValue').textContent  = res.key || '—';
    document.getElementById('modalKeyExpiry').textContent =
      expiresAt ? 'Expires: ' + new Date(expiresAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
                : 'Lifetime — no expiry';
    document.getElementById('modalKeyResult').classList.add('visible');
    btn.textContent = '✅ Activated';

    // Remove from list
    document.getElementById('reqcard-' + activateTarget.requestId)?.remove();
    const listEl = document.getElementById('adminRequestsList');
    if (!listEl.querySelector('.req-card')) {
      listEl.innerHTML = '<div class="no-requests">✅ No pending requests</div>';
    }
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
    btn.disabled = false; btn.textContent = '⚡ Generate & Activate';
  }
}

function copyKey() {
  const key = document.getElementById('modalKeyValue').textContent;
  navigator.clipboard.writeText(key).then(() => toast('✅ Key copied!')).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = key; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast('✅ Key copied!');
  });
}

// ── Direct Activate ────────────────────────────────────────

function selectDirectPlan(plan) {
  directPlan = plan;
  ['pro','basic'].forEach(p => {
    document.getElementById('dchip-' + p).classList.toggle('selected', p === plan);
  });
}

function selectDirectDuration(d) {
  directDuration = d;
  ['1m','6m','1y','life'].forEach(k => {
    document.getElementById('ddur-' + k).classList.toggle('selected', k === d);
  });
}

async function directActivate() {
  const email = document.getElementById('directEmail').value.trim().toLowerCase();
  const errEl = document.getElementById('directError');
  errEl.textContent = '';
  if (!email) { errEl.textContent = 'Email required'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Invalid email'; return; }

  const btn = document.getElementById('directActivateBtn');
  btn.innerHTML = '<span class="inline-spinner"></span> Activating…'; btn.disabled = true;

  try {
    const expiresAt = _calcExpiry(directDuration);
    const res = await wPost('/sub/admin-activate', {
      email, plan: directPlan, expiresAt, requestId: null
    });

    if (!res || !res.success) {
      errEl.textContent = res?.error || 'Activation failed';
      return;
    }

    // Show result inline
    const expiryText = expiresAt
      ? new Date(expiresAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : 'Lifetime';
    toast(`✅ ${email} activated (${directPlan}, ${expiryText})`);
    if (res.key) {
      navigator.clipboard.writeText(res.key).catch(() => {});
      toast(`✅ Activated! Key copied: ${res.key}`);
    }
    document.getElementById('directEmail').value = '';
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
  } finally {
    btn.innerHTML = '⚡ Activate Plan'; btn.disabled = false;
  }
}

// ── Expiry calculator ──────────────────────────────────────

function _calcExpiry(duration) {
  if (duration === 'life') return null;
  const now = new Date();
  if (duration === '1m')   now.setDate(now.getDate() + 30);
  if (duration === '6m')   now.setDate(now.getDate() + 180);
  if (duration === '1y')   now.setDate(now.getDate() + 365);
  return now.toISOString();
}

// ── LIVE SESSIONS ──────────────────────────────────────────

let liveAuthed = false;
let liveLoading = false;

async function liveAuthLogin() {
  const pw    = document.getElementById('liveAuthPw').value.trim();
  const errEl = document.getElementById('liveAuthError');
  errEl.textContent = '';
  if (!pw) { errEl.textContent = 'Password required'; return; }

  const btn = event.target;
  btn.innerHTML = '<span class="inline-spinner"></span>'; btn.disabled = true;
  try {
    const cfg = await wPost('/sub/app-config', {});
    if (!cfg) { errEl.textContent = 'Could not reach server'; return; }
    const adminPw = cfg.admin_password || cfg.adminPassword;
    if (!adminPw || pw !== adminPw) { errEl.textContent = 'Incorrect password'; return; }

    liveAuthed = true;
    adminAuthed = true;
    clubsAuthed = true;
    subsAuthed = true;
    rememberAdminLogin();
    document.getElementById('liveAuthGate').style.display = 'none';
    document.getElementById('liveContent').style.display  = '';
    loadLiveSessions();
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
  } finally {
    btn.innerHTML = '🔐 Login'; btn.disabled = false;
  }
}

async function _dbGet(table, query) {
  return await wPost('/db/get', { table, query: query || 'select=*' });
}

async function _dbDelete(table, query) {
  return await wPost('/db/delete', { table, query });
}

function _firstValue(row, keys, fallback='—') {
  for (const key of keys) {
    const value = row && row[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function _asCount(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  if (value && typeof value === 'object') return Object.keys(value).length;
  return '—';
}

function _liveDate(row) {
  const raw = _firstValue(row, ['updated_at','last_seen_at','last_seen','heartbeat_at','started_at','created_at'], null);
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

async function loadLiveSessions() {
  if (!liveAuthed || liveLoading) return;
  liveLoading = true;
  const listEl = document.getElementById('liveSessionsList');
  const countEl = document.getElementById('liveCount');
  const updatedEl = document.getElementById('liveUpdated');
  listEl.innerHTML = '<div class="no-requests">Loading live sessions…</div>';
  updatedEl.textContent = 'Refreshing…';

  try {
    // Global admin feed: use the current SCS `sessions` table as the source of truth.
    // An active session is any session that has not been completed/ended and
    // still has recent activity. No club/member/organizer filter is applied.
    const [rowsResult, clubsResult] = await Promise.all([
      _dbGet('sessions', 'status=neq.completed&select=*&order=updated_at.desc&limit=500'),
      _dbGet('clubs', 'select=*&limit=500')
    ]);

    const allRows = Array.isArray(rowsResult) ? rowsResult : (rowsResult && Array.isArray(rowsResult.data) ? rowsResult.data : []);
    const staleBefore = Date.now() - (3 * 60 * 60 * 1000);
    const rows = allRows.filter(row => {
      const status = String(row && row.status || '').toLowerCase();
      if (status === 'completed' || status === 'ended' || status === 'closed' || status === 'finished') return false;
      const d = _liveDate(row);
      return !d || d.getTime() >= staleBefore;
    });
    const clubs = Array.isArray(clubsResult) ? clubsResult : (clubsResult && Array.isArray(clubsResult.data) ? clubsResult.data : []);
    const clubMap = new Map(clubs.map(c => [String(c.id), c.name || c.club_name || c.title || '']));

    rows.sort((a,b) => ((_liveDate(b)?.getTime() || 0) - (_liveDate(a)?.getTime() || 0)));
    countEl.textContent = rows.length;
    updatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    if (!rows.length) {
      listEl.innerHTML = '<div class="live-empty"><div class="live-empty-icon">📡</div><strong>No SCS sessions are active now</strong><br><span>Active sessions appear here until they are ended or become inactive.</span></div>';
      return;
    }

    listEl.innerHTML = rows.map(row => {
      const clubId = _firstValue(row, ['club_id','clubId'], '');
      const clubName = _firstValue(row, ['club_name','club','name'], clubMap.get(String(clubId)) || 'SCS Club');
      const owner = _firstValue(row, ['started_by','organizer_name','organizer','owner_name','created_by_name','owner_email','email'], '—');
      const roundsData = Array.isArray(row.rounds_data) ? row.rounds_data : [];
      const rounds = roundsData.length || _asCount(_firstValue(row, ['round_count','rounds_count','current_round','round_no','rounds'], null));
      const players = _asCount(_firstValue(row, ['players','player_count','players_count','active_player_count','activeplayers'], null));
      const latestRound = roundsData.length ? roundsData[roundsData.length - 1] : null;
      const latestGames = latestRound && Array.isArray(latestRound.games) ? latestRound.games : null;
      const courts = latestGames ? latestGames.length : _asCount(_firstValue(row, ['court_count','courts_count','num_courts','courts'], null));
      const date = _liveDate(row);
      const timeText = date ? _timeAgo(date.toISOString()) : 'Live now';
      const sessionId = _firstValue(row, ['session_id','id'], '—');

      return `<div class="live-session-card">
        <div class="live-card-head">
          <span class="live-status-pill">LIVE</span>
          <div class="live-club-name">${escHtml(String(clubName))}</div>
          <div class="live-card-time">${escHtml(timeText)}</div>
        </div>
        <div class="live-meta-grid">
          <div class="live-meta"><div class="live-meta-value">${escHtml(String(players))}</div><div class="live-meta-label">Players</div></div>
          <div class="live-meta"><div class="live-meta-value">${escHtml(String(rounds))}</div><div class="live-meta-label">Rounds</div></div>
          <div class="live-meta"><div class="live-meta-value">${escHtml(String(courts))}</div><div class="live-meta-label">Courts</div></div>
        </div>
        <div class="live-card-foot"><span>👤 ${escHtml(String(owner))}</span><span># ${escHtml(String(sessionId).slice(0,12))}</span></div>
      </div>`;
    }).join('');
  } catch(e) {
    countEl.textContent = '—';
    updatedEl.textContent = 'Could not refresh';
    listEl.innerHTML = '<div class="live-empty"><div class="live-empty-icon">⚠️</div><strong>Could not load live sessions</strong><br><span>Please try Refresh.</span></div>';
  } finally {
    liveLoading = false;
  }
}

// ── ALL CLUBS ──────────────────────────────────────────────

let clubsAuthed = false;
let allClubsData = [];

async function clubsAuthLogin() {
  const pw    = document.getElementById('clubsAuthPw').value.trim();
  const errEl = document.getElementById('clubsAuthError');
  errEl.textContent = '';
  if (!pw) { errEl.textContent = 'Password required'; return; }

  const btn = event.target;
  btn.innerHTML = '<span class="inline-spinner"></span>'; btn.disabled = true;

  try {
    const cfg = await wPost('/sub/app-config', {});
    if (!cfg) { errEl.textContent = 'Could not reach server'; return; }
    const adminPw = cfg.admin_password || cfg.adminPassword;
    if (!adminPw || pw !== adminPw) { errEl.textContent = 'Incorrect password'; return; }

    clubsAuthed = true;
    adminAuthed = true;
    subsAuthed  = true;
    liveAuthed  = true;
    rememberAdminLogin();
    document.getElementById('clubsAuthGate').style.display = 'none';
    document.getElementById('clubsContent').style.display  = '';
    loadClubs();
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
  } finally {
    btn.innerHTML = '🔐 Login'; btn.disabled = false;
  }
}

async function loadClubs() {
  if (!clubsAuthed) return;
  const listEl  = document.getElementById('clubsList');
  const countEl = document.getElementById('clubsCount');
  listEl.innerHTML = '<div class="no-requests">Loading clubs…</div>';

  const data = await wPost('/sub/admin-clubs', {});
  if (!data || !data.clubs) {
    listEl.innerHTML = '<div class="no-requests">Failed to load clubs.</div>';
    return;
  }

  allClubsData = data.clubs;
  renderClubs(allClubsData);
}

function renderClubs(clubs) {
  const listEl  = document.getElementById('clubsList');
  const countEl = document.getElementById('clubsCount');
  countEl.textContent = clubs.length + ' club' + (clubs.length !== 1 ? 's' : '');

  if (!clubs.length) {
    listEl.innerHTML = '<div class="no-requests">No clubs found.</div>';
    return;
  }

  listEl.innerHTML = clubs.map((c, index) => {
    const created = c.created_at
      ? new Date(c.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : '—';
    const owner = c.owner_email || c.owner || '—';
    return `<div class="club-card" role="button" tabindex="0" onclick="openClubDetail(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openClubDetail(${index})}">
      <div class="club-card-name">🏢 ${escHtml(c.name || c.club_name || 'Unnamed')}</div>
      <div class="club-card-meta">Created: ${created}</div>
      <div class="club-card-owner">👤 ${escHtml(owner)}</div>
      <div class="club-card-view">VIEW MEMBERS & SESSIONS</div>
    </div>`;
  }).join('');
}

let selectedClub = null;

function _rows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

function _clubDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

async function openClubDetail(index) {
  selectedClub = allClubsData[index] || null;
  if (!selectedClub) return;
  showScreen('club-detail');
  document.getElementById('clubDetailHeader').textContent = 'Club';
  await loadClubDetail();
}

async function reloadClubDetail() {
  if (selectedClub) await loadClubDetail();
}

async function loadClubDetail() {
  const club = selectedClub;
  if (!club) return;
  const clubId = club.id;
  const name = club.name || club.club_name || 'Unnamed Club';
  const owner = club.owner_email || club.owner || '—';
  document.getElementById('clubDetailHeader').textContent = name;
  document.getElementById('clubDetailSummary').innerHTML = `
    <div class="club-detail-name">🏢 ${escHtml(name)}</div>
    <div class="club-detail-owner">👤 ${escHtml(owner)}</div>
    <div class="club-detail-created">Created ${escHtml(_clubDate(club.created_at))}</div>
    <div class="club-detail-id">Club ID: ${escHtml(String(clubId || '—'))}</div>`;

  const playersEl = document.getElementById('clubDetailMembers');
  const sessionsEl = document.getElementById('clubDetailSessions');
  const playerCountEl = document.getElementById('clubDetailMemberCount');
  const sessionCountEl = document.getElementById('clubDetailSessionCount');
  playersEl.innerHTML = '<div class="no-requests">Loading players…</div>';
  sessionsEl.innerHTML = '<div class="no-requests">Loading sessions…</div>';
  playerCountEl.textContent = '—';
  sessionCountEl.textContent = '—';

  try {
    // Club membership lives in `memberships`; `players` contains the shared
    // player profile and therefore has no club_id column of its own.
    const [playerResult, sessionResult] = await Promise.all([
      _dbGet(
        'memberships',
        'club_id=eq.' + encodeURIComponent(clubId) +
          '&select=id,nickname,club_rating,club_points,is_playing,player_id,user_account_id,players(id,name,gender,global_rating,global_points,wins,losses,user_account_id)'
      ),
      _dbGet('sessions', 'club_id=eq.' + encodeURIComponent(clubId) + '&select=*&order=created_at.desc&limit=100')
    ]);

    const players = _rows(playerResult).map(membership => {
      const profile = membership && membership.players ? membership.players : {};
      return {
        ...profile,
        membership_id: membership.id,
        player_id: membership.player_id || profile.id,
        name: membership.nickname || profile.name || '',
        nickname: membership.nickname || profile.name || '',
        club_rating: membership.club_rating,
        club_points: membership.club_points,
        is_playing: membership.is_playing,
        user_account_id: membership.user_account_id || profile.user_account_id || null
      };
    }).sort((a, b) => {
      const an = String(_firstValue(a, ['name','player_name','nickname','display_name'], '') || '');
      const bn = String(_firstValue(b, ['name','player_name','nickname','display_name'], '') || '');
      return an.localeCompare(bn, undefined, { sensitivity: 'base', numeric: true });
    });

    playerCountEl.textContent = players.length;
    if (!players.length) {
      playersEl.innerHTML = '<div class="no-requests">No players found.</div>';
    } else {
      playersEl.innerHTML = players.map((p, index) => {
        const playerName = _firstValue(p, ['name','player_name','nickname','display_name'], 'Player ' + (index + 1));
        const gender = _firstValue(p, ['gender','sex'], '');
        const rating = _firstValue(p, ['club_rating','clubRating','rating'], '');
        const genderClass = String(gender).toLowerCase() === 'female' ? 'female' : 'male';
        const genderIcon = genderClass === 'female' ? 'female.png' : 'male.png';
        return `<div class="club-member-row ${genderClass}">
          <div class="club-member-number">${index + 1}</div>
          <div class="club-member-avatar"><img src="${genderIcon}" alt="${escHtml(String(gender || genderClass))}"></div>
          <div class="club-member-main">
            <div class="club-member-name">${escHtml(String(playerName))}</div>
          </div>
          ${rating !== '' && rating != null ? `<div class="club-member-rating">${escHtml(Number(rating).toFixed(1))}</div>` : ''}
        </div>`;
      }).join('');
    }

    const sessions = _rows(sessionResult).map(r => {
      const status = String(r && r.status || '').toLowerCase();
      return {...r, __live: status !== 'completed' && status !== 'ended' && status !== 'closed' && status !== 'finished'};
    }).sort((a,b) => {
      const ad = new Date(a.updated_at || a.started_at || a.created_at || 0).getTime() || 0;
      const bd = new Date(b.updated_at || b.started_at || b.created_at || 0).getTime() || 0;
      return bd-ad;
    });

    sessionCountEl.textContent = sessions.length;
    if (!sessions.length) {
      sessionsEl.innerHTML = '<div class="no-requests">No sessions found for this club.</div>';
    } else {
      sessionsEl.innerHTML = sessions.map(r => {
        const title = _firstValue(r, ['title','session_name','slot_name','venue_name','venue','location'], 'SCS Session');
        const dateRaw = _firstValue(r, ['updated_at','started_at','session_date','date','created_at'], null);
        const d = dateRaw ? new Date(dateRaw) : null;
        const dateText = d && !Number.isNaN(d.getTime()) ? d.toLocaleString([], {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
        const players = _asCount(_firstValue(r, ['player_count','players_count','active_player_count','players','activeplayers'], null));
        const rounds = _asCount(_firstValue(r, ['round_count','rounds_count','current_round','round_no','rounds'], null));
        const id = _firstValue(r, ['session_id','id'], '');
        return `<div class="club-session-row">
          <div class="club-session-top">
            ${r.__live ? '<span class="club-live-mini">LIVE</span>' : ''}
            <div class="club-session-title">${escHtml(String(title))}</div>
            <div class="club-session-date">${escHtml(dateText)}</div>
          </div>
          <div class="club-session-meta">
            ${players !== '—' ? `<span>👥 ${escHtml(String(players))}</span>` : ''}
            ${rounds !== '—' ? `<span>🔄 ${escHtml(String(rounds))} rounds</span>` : ''}
            ${id ? `<span># ${escHtml(String(id).slice(0,12))}</span>` : ''}
          </div>
        </div>`;
      }).join('');
    }
  } catch (e) {
    playersEl.innerHTML = '<div class="no-requests">Could not load players.</div>';
    sessionsEl.innerHTML = '<div class="no-requests">Could not load sessions.</div>';
  }
}

async function deleteSelectedClub() {
  if (!selectedClub || !isAdminRemembered()) return;
  const name = selectedClub.name || selectedClub.club_name || 'this club';
  const typed = window.prompt(`Delete “${name}”?\n\nThis permanently removes the club. Type DELETE to confirm.`);
  if (typed !== 'DELETE') return;

  const btn = document.getElementById('deleteClubBtn');
  btn.disabled = true;
  btn.textContent = 'Deleting…';
  try {
    const result = await _dbDelete('clubs', 'id=eq.' + encodeURIComponent(selectedClub.id));
    if (!result || result.ok !== true) throw new Error('Delete failed');
    toast('Club deleted');
    selectedClub = null;
    showScreen('clubs');
    await loadClubs();
  } catch (e) {
    toast('Could not delete club');
  } finally {
    btn.disabled = false;
    btn.textContent = '🗑 Delete this club';
  }
}

// ── SUBSCRIBERS ────────────────────────────────────────────

let subsAuthed    = false;
let allSubsData   = [];
let subsCurrentFilter = 'all';

async function subsAuthLogin() {
  const pw    = document.getElementById('subsAuthPw').value.trim();
  const errEl = document.getElementById('subsAuthError');
  errEl.textContent = '';
  if (!pw) { errEl.textContent = 'Password required'; return; }

  const btn = event.target;
  btn.innerHTML = '<span class="inline-spinner"></span>'; btn.disabled = true;

  try {
    const cfg = await wPost('/sub/app-config', {});
    if (!cfg) { errEl.textContent = 'Could not reach server'; return; }
    const adminPw = cfg.admin_password || cfg.adminPassword;
    if (!adminPw || pw !== adminPw) { errEl.textContent = 'Incorrect password'; return; }

    subsAuthed = true;
    adminAuthed = true;
    clubsAuthed = true;
    rememberAdminLogin();
    document.getElementById('subsAuthGate').style.display = 'none';
    document.getElementById('subsContent').style.display  = '';
    loadSubscribers();
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
  } finally {
    btn.innerHTML = '🔐 Login'; btn.disabled = false;
  }
}

async function loadSubscribers() {
  if (!subsAuthed) return;
  const listEl  = document.getElementById('subsList');
  const countEl = document.getElementById('subsCount');
  listEl.innerHTML = '<div class="no-requests">Loading subscribers…</div>';

  const data = await wPost('/sub/admin-subscribers', {});
  if (!data || !data.subscribers) {
    listEl.innerHTML = '<div class="no-requests">Failed to load subscribers.</div>';
    return;
  }

  allSubsData = data.subscribers;
  renderSubs(allSubsData);
}

function subsFilter(plan, btn) {
  subsCurrentFilter = plan;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const filtered = plan === 'all'
    ? allSubsData
    : allSubsData.filter(s => (s.plan || 'trial') === plan);
  renderSubs(filtered);
}

function renderSubs(subs) {
  const listEl  = document.getElementById('subsList');
  const countEl = document.getElementById('subsCount');
  countEl.textContent = subs.length + ' user' + (subs.length !== 1 ? 's' : '');

  if (!subs.length) {
    listEl.innerHTML = '<div class="no-requests">No subscribers found.</div>';
    return;
  }

  const iconMap  = { pro: '⚡', basic: '👁', trial: '⏳' };
  const nameMap  = { pro: 'Pro', basic: 'Basic', trial: 'Trial' };
  const badgeMap = { pro: 'badge-pro', basic: 'badge-basic', trial: 'badge-trial' };

  listEl.innerHTML = subs.map(s => {
    const plan    = s.plan || 'trial';
    const expiry  = s.expires_at;
    const expired = expiry && new Date(expiry) < new Date();
    const expiryTxt = !expiry ? '∞ Lifetime'
      : (expired ? '⚠️ Expired ' : '') +
        new Date(expiry).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    const expiryClass = !expiry ? 'green' : expired ? 'red' : '';

    return `<div class="sub-card">
      <div class="sub-card-left">
        <div class="sub-card-email">${escHtml(s.email || '—')}</div>
        <div class="sub-card-expiry ${expiryClass}">${expiryTxt}</div>
      </div>
      <span class="plan-badge ${badgeMap[plan] || ''}">${iconMap[plan] || '🔑'} ${nameMap[plan] || plan}</span>
    </div>`;
  }).join('');
}

// ── Helpers ────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
