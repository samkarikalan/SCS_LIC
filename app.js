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
