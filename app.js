const SUPABASE_URL = 'https://hplkoxdorbfjhwbvqatn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbGtveGRvcmJmamh3YnZxYXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTcyOTgsImV4cCI6MjA5MDE5MzI5OH0.G-04VeYkUGMF93qw61ryTaQ0Q7xK3dOAHLDvG6l31vc';
const H = {'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=representation'};

async function api(method, path, body) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {method, headers:H, body: body ? JSON.stringify(body) : undefined});
  if (!res.ok) throw new Error(await res.text());
  return method === 'DELETE' ? null : res.json();
}

let isDark = false;
function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
  document.getElementById('themeColorMeta').content = isDark ? '#0d1117' : '#f0f4f8';
}

function showScreen(name) {
  if (name === 'request') {
    const ce = document.getElementById('checkEmail').value.trim();
    if (ce) setTimeout(() => { document.getElementById('reqEmail').value = ce; }, 50);
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(el._t); el._t = setTimeout(() => el.style.display = 'none', 2800);
}

function resetCheck() {
  document.getElementById('statusResult').classList.remove('visible');
  document.getElementById('notFoundCard').classList.remove('visible');
  document.getElementById('checkRequestBtn').style.display = 'none';
}

async function checkStatus() {
  const email = document.getElementById('checkEmail').value.trim().toLowerCase();
  if (!email) { toast('Please enter your email'); return; }
  const btn = document.getElementById('checkBtn');
  btn.innerHTML = '<span class="inline-spinner"></span>';
  btn.disabled = true;
  resetCheck();
  try {
    const data = await api('GET', 'licenses?email=eq.' + encodeURIComponent(email) + '&select=*');
    if (!data || !data.length) {
      document.getElementById('notFoundCard').classList.add('visible');
      document.getElementById('checkRequestBtn').style.display = 'flex';
    } else {
      const l = data[0];
      const expired = l.expires_at && new Date(l.expires_at) < new Date();
      const plan = l.plan || 'basic';
      const iconMap  = {pro:'⚡', basic:'👁', trial:'⏳'};
      const bgMap    = {pro:'rgba(16,185,129,.12)', basic:'rgba(14,165,233,.1)', trial:'rgba(245,158,11,.1)'};
      const badgeMap = {pro:'badge-pro', basic:'badge-basic', trial:'badge-trial'};
      const nameMap  = {pro:'Pro', basic:'Basic', trial:'Trial'};
      document.getElementById('statusResultIcon').textContent      = iconMap[plan] || '🔑';
      document.getElementById('statusResultIcon').style.background = bgMap[plan]   || 'var(--bg2)';
      document.getElementById('statusPlanName').textContent        = nameMap[plan] || plan;
      document.getElementById('statusPlanBadge').innerHTML         = '<span class="plan-badge ' + (badgeMap[plan]||'badge-none') + '">' + (nameMap[plan]||plan) + '</span>';
      document.getElementById('statusEmail').textContent           = l.email || email;
      const sEl = document.getElementById('statusActive');
      sEl.textContent = expired ? '⚠️ Expired' : '✅ Active';
      sEl.className   = 'sr-val ' + (expired ? 'red' : 'green');
      const eEl = document.getElementById('statusExpiry');
      if (!l.expires_at) { eEl.textContent = '∞ Never'; eEl.className = 'sr-val green'; }
      else { eEl.textContent = new Date(l.expires_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); eEl.className = 'sr-val' + (expired?' red':''); }
      document.getElementById('statusResult').classList.add('visible');
      if (expired) document.getElementById('checkRequestBtn').style.display = 'flex';
    }
  } catch(e) { toast('Error: ' + e.message); }
  finally { btn.innerHTML = '🔍 Check Status'; btn.disabled = false; }
}

let selectedPlan = 'pro';
function selectPlan(plan) {
  selectedPlan = plan;
  document.querySelectorAll('.plan-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('chip-' + plan).classList.add('selected');
}
function resetRequest() {
  document.getElementById('requestSuccess').classList.remove('visible');
  document.getElementById('requestForm').style.display = 'block';
  document.getElementById('reqEmail').value = '';
  document.getElementById('reqName').value = '';
  document.getElementById('reqMessage').value = '';
  selectPlan('pro');
}
async function submitRequest() {
  const email   = document.getElementById('reqEmail').value.trim().toLowerCase();
  const name    = document.getElementById('reqName').value.trim();
  const message = document.getElementById('reqMessage').value.trim();
  if (!email) { toast('Email is required'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Please enter a valid email'); return; }
  const btn = document.getElementById('submitBtn');
  btn.innerHTML = '<span class="inline-spinner"></span> Sending…';
  btn.disabled = true;
  try {
    const existing = await api('GET', 'purchase_requests?email=eq.' + encodeURIComponent(email) + '&status=eq.pending&select=id');
    if (existing && existing.length) { toast('You already have a pending request'); return; }
    await api('POST', 'purchase_requests', {
      email, plan: selectedPlan, status: 'pending',
      notes: [name, message].filter(Boolean).join(' · ') || null,
      created_at: new Date().toISOString()
    });
    document.getElementById('requestForm').style.display = 'none';
    document.getElementById('requestSuccess').classList.add('visible');
  } catch(e) { toast('Error: ' + e.message); }
  finally { btn.innerHTML = '⬆️ Submit Request'; btn.disabled = false; }
}
