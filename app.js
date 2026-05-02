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
let isDark = false;
function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
  document.getElementById('themeColorMeta').content = isDark ? '#0d1117' : '#f0f4f8';
}

// ── Screen navigation ──────────────────────────────────────
function showScreen(name) {
  if (name === 'request') {
    const ce = document.getElementById('checkEmail').value.trim();
    if (ce) setTimeout(() => { document.getElementById('reqEmail').value = ce; }, 50);
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

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
  adminAuthed = false;
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
