/* MRET RENT OS web app (Phase 1): accounts, onboarding, agency workspace, branding, team, plans and billing, properties,
   audit, security (MFA) and the MRET Technologies super admin. Data access is enforced by row level security in Supabase;
   this file never holds secrets. */
(function () {
  'use strict';
  const C = window.RENTOS_CONFIG;
  const sb = supabase.createClient(C.url, C.key, { auth: { storageKey: 'mret-rent-os', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  window.__rentos = { sb };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const R = c => c == null ? '–' : 'R ' + (Number(c) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const R0 = c => c == null ? '–' : 'R ' + Math.round(Number(c) / 100).toLocaleString('en-ZA');
  const N = n => Number(n || 0).toLocaleString('en-ZA');
  const fmtD = d => d ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' }).format(new Date(d)) : '–';
  const fmtDT = d => d ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Johannesburg' }).format(new Date(d)) : '–';
  const daysTo = d => Math.ceil((new Date(d) - Date.now()) / 864e5);
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const SS = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} } };
  let toastT; const toast = m => { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = m; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3500); };
  const friendly = e => { const m = (e && (e.message || e.error_description || e.msg)) || String(e); if (/row-level security|permission denied/i.test(m)) return 'You do not have permission to do that.'; if (/JWT|session/i.test(m) && /expired|invalid/i.test(m)) return 'Your session has expired. Please sign in again.'; if (/duplicate key/i.test(m)) return 'That already exists.'; if (/check constraint/i.test(m)) return 'One of the values is not valid. Please check the form.'; return m.replace(/^.*?ERROR:\s*/, ''); };
  const ROLE = { agency_owner: 'Agency owner', agency_admin: 'Agency administrator', branch_manager: 'Branch manager', rental_agent: 'Rental agent', financial_admin: 'Financial administrator', property_manager: 'Property manager', auditor: 'Auditor (read only)' };
  const PERMS = {}; // role -> [permissions], loaded once
  const S = { session: null, user: null, profile: null, agencies: [], agency: null, ov: null, plans: null, admin: null, aal: null, factors: [] };
  const can = p => !!(S.agency && PERMS[S.agency.role] && PERMS[S.agency.role].includes(p));
  const writable = () => S.ov && S.ov.access === 'full';
  const route = () => { const h = (location.hash || '#/').slice(2); const [path, qs] = h.split('?'); return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') }; };
  const go = h => { if (location.hash === h) render(); else location.hash = h; };
  const field = (label, html, cls) => '<label class="f' + (cls ? ' ' + cls : '') + '">' + label + html + '</label>';
  const inp = (name, v, attrs) => '<input class="inp" name="' + name + '" value="' + esc(v == null ? '' : v) + '"' + (attrs || '') + '>';
  const formData = f => { const o = {}; new FormData(f).forEach((v, k) => { v = String(v).trim(); o[k] = v === '' ? null : v; }); return o; };
  const busy = async (btn, fn) => { if (btn) btn.disabled = true; try { return await fn(); } finally { if (btn) btn.disabled = false; } };
  const THEME_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const toggleTheme = () => { const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; LS.set('rentos.theme', nx); try { localStorage.setItem('rentos.theme', nx); } catch (e) {} };

  /* ---------------- data loading ---------------- */
  async function loadAll() {
    const { data: { session } } = await sb.auth.getSession();
    S.session = session; S.user = session && session.user;
    if (!S.user) return;
    const [prof, ag, adm, aal, fac, rp, mi, mp] = await Promise.all([
      sb.from('user_profiles').select('*').eq('id', S.user.id).maybeSingle(),
      sb.rpc('my_agencies'),
      sb.from('platform_admins').select('role').eq('user_id', S.user.id).maybeSingle(),
      sb.auth.mfa.getAuthenticatorAssuranceLevel(),
      sb.auth.mfa.listFactors(),
      sb.from('role_permissions').select('role_key, permission_key'), sb.rpc('my_invitations'), sb.rpc('my_portals')]);
    S.invites = (mi && mi.data) || []; S.portals = (mp && mp.data) || [];
    S.profile = prof.data; S.agencies = ag.data || []; S.admin = adm.data ? adm.data.role : null;
    S.aal = aal.data || {}; S.factors = (fac.data && fac.data.totp) || [];
    (rp.data || []).forEach(x => (PERMS[x.role_key] = PERMS[x.role_key] || []).push(x.permission_key));
    const want = LS.get('rentos.agency', null) || (S.profile && S.profile.last_agency_id);
    S.agency = S.agencies.find(a => a.agency_id === want) || S.agencies[0] || null;
    if (S.agency) await loadOverview();
  }
  async function loadOverview() {
    if (!S.agency) { S.ov = null; return; }
    const r = await sb.rpc('agency_overview', { a: S.agency.agency_id }); S.ov = r.data || null;
    const b = await sb.from('agency_branding').select('display_name, logo_data, icon_data, primary_color, accent_color').eq('agency_id', S.agency.agency_id).maybeSingle();
    S.brand = b.data || {};
    const ag = await sb.from('agencies').select('onboarding, status').eq('id', S.agency.agency_id).maybeSingle();
    if (ag.data) { S.agency.onboarding = ag.data.onboarding; S.agency.status = ag.data.status; }
  }
  async function loadPlans() { if (S.plans) return S.plans; const r = await sb.from('subscription_plans').select('*, plan_features(feature_key,label,enabled)').eq('active', true).order('sort'); S.plans = r.data || []; return S.plans; }
  async function switchAgency(id) { LS.set('rentos.agency', id); S.agency = S.agencies.find(a => a.agency_id === id); await sb.from('user_profiles').update({ last_agency_id: id }).eq('id', S.user.id); await loadOverview(); go('#/dashboard'); }

  /* ---------------- auth screens ---------------- */
  const authShell = (title, body, foot) => '<div class="auth-wrap"><div class="auth-card"><a class="logo" href="/rent-os/" style="margin-bottom:18px"><span class="mark">RO</span><span>MRET <b>RENT OS</b></span></a><div class="card"><h2 style="font-size:24px">' + title + '</h2>' + body + '</div>' + (foot ? '<p class="small muted" style="text-align:center;margin-top:14px">' + foot + '</p>' : '') + '</div></div>';
  function vLogin() {
    const inv = SS.get('rentos.invite');
    $('root').innerHTML = authShell('Log in', (inv ? '<div class="notice info" style="margin-bottom:12px">Log in to accept your invitation.</div>' : '') + '<form id="f" class="grid" novalidate>' + field('Email', inp('email', SS.get('rentos.email') || '', ' type="email" autocomplete="email" required')) + field('Password', inp('password', '', ' type="password" autocomplete="current-password" required')) + '<button class="btn primary lg">Log in</button><p class="err" id="e"></p></form><div class="row" style="justify-content:space-between"><a href="#/forgot">Forgot password?</a><a href="#/register">Create an account</a></div>', '<a href="/rent-os/">Back to the website</a>');
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); $('e').textContent = ''; await busy(ev.submitter, async () => { const { error } = await sb.auth.signInWithPassword({ email: d.email || '', password: d.password || '' }); if (error) { $('e').textContent = /confirm/i.test(error.message) ? 'Please verify your email first. Check your inbox for the link.' : /invalid/i.test(error.message) ? 'Email or password is incorrect.' : friendly(error); return; } await boot(); }); };
  }
  function vRegister(q) {
    const inviteEmail = SS.get('rentos.email') || '';
    $('root').innerHTML = authShell('Create your account', '<p class="muted small">Step 1 of 8. Free for 14 days, no card needed.</p><form id="f" class="grid g2" novalidate>' + field('First name', inp('first_name', '', ' autocomplete="given-name" required maxlength="80"')) + field('Surname', inp('surname', '', ' autocomplete="family-name" required maxlength="80"')) + field('Email', inp('email', inviteEmail, ' type="email" autocomplete="email" required'), 'span2') + field('South African mobile', inp('mobile', '', ' type="tel" autocomplete="tel" placeholder="082 123 4567" required'), 'span2') + field('Password <span class="hint">at least 10 characters</span>', inp('password', '', ' type="password" autocomplete="new-password" required minlength="10"'), 'span2') + '<label class="check span2"><input type="checkbox" name="terms" value="1"> <span>I accept the <a href="/rent-os/legal/terms/" target="_blank">terms of service</a> and the <a href="/rent-os/legal/privacy/" target="_blank">privacy policy</a>.</span></label><button class="btn primary lg span2">Create account</button><p class="err span2" id="e"></p></form>', 'Already registered? <a href="#/login">Log in</a>');
    if (q.get('plan')) SS.set('rentos.plan', q.get('plan'));
    $('f').onsubmit = async ev => {
      ev.preventDefault(); const d = formData(ev.target), e = $('e'); e.textContent = '';
      const mobile = (d.mobile || '').replace(/[\s-]/g, '');
      if (!d.first_name || !d.surname) return (e.textContent = 'Please give your first name and surname.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) return (e.textContent = 'Please give a valid email address.');
      if (!/^(\+27|0)[0-9]{9}$/.test(mobile)) return (e.textContent = 'Please give a South African mobile number, for example 082 123 4567.');
      if ((d.password || '').length < 10) return (e.textContent = 'Use a password of at least 10 characters.');
      if (!d.terms) return (e.textContent = 'Please accept the terms and privacy policy.');
      await busy(ev.submitter, async () => {
        const { data, error } = await sb.auth.signUp({ email: d.email, password: d.password, options: { emailRedirectTo: C.appUrl, data: { first_name: d.first_name, surname: d.surname, mobile } } });
        if (error) return (e.textContent = /registered/i.test(error.message) ? 'An account with that email exists. Log in instead.' : friendly(error));
        SS.set('rentos.email', d.email);
        if (data.session) return boot();
        go('#/verify');
      });
    };
  }
  function vVerify() {
    const em = SS.get('rentos.email') || '';
    $('root').innerHTML = authShell('Check your email', '<p>We sent a verification link to <b>' + esc(em || 'your email address') + '</b>. Open it to confirm your address, then log in.</p><p class="muted small">Step 2 of 8. The link expires in 24 hours. Check your spam folder if it has not arrived in a few minutes.</p><div class="row"><button class="btn" id="rs">Send the link again</button><a class="btn primary" href="#/login">I have verified, log in</a></div><p class="err" id="e"></p>');
    $('rs').onclick = async ev => busy(ev.target, async () => { if (!em) return ($('e').textContent = 'Go back and register again.'); const { error } = await sb.auth.resend({ type: 'signup', email: em, options: { emailRedirectTo: C.appUrl } }); $('e').textContent = error ? friendly(error) : ''; if (!error) toast('Sent again'); });
  }
  function vForgot() {
    $('root').innerHTML = authShell('Reset your password', '<form id="f" class="grid">' + field('Email', inp('email', '', ' type="email" autocomplete="email" required')) + '<button class="btn primary lg">Send reset link</button><p class="err" id="e"></p></form>', '<a href="#/login">Back to log in</a>');
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); await busy(ev.submitter, async () => { await sb.auth.resetPasswordForEmail(d.email || '', { redirectTo: C.appUrl + '?reset=1' }); $('f').outerHTML = '<div class="notice ok">If an account exists for that address, a reset link is on its way.</div>'; }); };
  }
  function vNewPassword() {
    $('root').innerHTML = authShell('Choose a new password', '<form id="f" class="grid">' + field('New password <span class="hint">at least 10 characters</span>', inp('password', '', ' type="password" autocomplete="new-password" required minlength="10"')) + '<button class="btn primary lg">Save password</button><p class="err" id="e"></p></form>');
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); if ((d.password || '').length < 10) return ($('e').textContent = 'Use at least 10 characters.'); await busy(ev.submitter, async () => { const { error } = await sb.auth.updateUser({ password: d.password }); if (error) return ($('e').textContent = friendly(error)); toast('Password changed'); history.replaceState(null, '', C.appUrl.replace(/^https?:\/\/[^/]+/, '') + '#/dashboard'); await boot(); }); };
  }
  async function vInvite(tok) {
    SS.set('rentos.invite', tok);
    const { data } = await sb.rpc('invitation_preview', { tok });
    const p = data && data[0];
    if (!p) { $('root').innerHTML = authShell('Invitation not found', '<p>This invitation link is not valid. Ask the person who invited you for a new one.</p>'); SS.set('rentos.invite', null); return; }
    if (p.expired) { $('root').innerHTML = authShell('Invitation expired', '<p>This invitation has expired or was already used. Ask <b>' + esc(p.agency_name) + '</b> for a new one.</p>'); SS.set('rentos.invite', null); return; }
    SS.set('rentos.email', p.email);
    if (!S.user) { $('root').innerHTML = authShell('Join ' + esc(p.agency_name), '<p>You have been invited to join <b>' + esc(p.agency_name) + '</b> on MRET RENT OS as <b>' + esc(p.role_label) + '</b>.</p><p class="small muted">The invitation is for ' + esc(p.email) + '. Create an account or log in with that address.</p><div class="row"><a class="btn primary" href="#/register">Create account</a><a class="btn" href="#/login">Log in</a></div>'); return; }
    $('root').innerHTML = authShell('Join ' + esc(p.agency_name), '<p>Join <b>' + esc(p.agency_name) + '</b> as <b>' + esc(p.role_label) + '</b>?</p><div class="row"><button class="btn primary" id="acc">Accept invitation</button><a class="btn" href="#/dashboard">Not now</a></div><p class="err" id="e"></p>');
    $('acc').onclick = ev => busy(ev.target, async () => { const r = await sb.rpc('accept_invitation', { tok }); if (r.error) return ($('e').textContent = friendly(r.error)); SS.set('rentos.invite', null); LS.set('rentos.agency', r.data); toast('Welcome to ' + p.agency_name); await loadAll(); go('#/dashboard'); });
  }

  /* ---------------- shell ---------------- */
  const NAV = [
    ['dashboard', 'Dashboard', null], ['properties', 'Properties', 'properties.read'],
    ['landlords', 'Landlords', 'properties.read'], ['tenants', 'Tenants', 'properties.read'], ['leases', 'Leases', 'properties.read'],
    ['g', 'Money'], ['invoices', 'Invoices', 'finance.read'], ['payments', 'Payments', 'finance.read'], ['arrears', 'Arrears', 'finance.read'], ['statements', 'Landlord statements', 'finance.read'],
    ['g', 'Agency'], ['team', 'Team', null], ['branding', 'Branding', 'branding.manage'], ['subscription', 'Subscription', 'billing.manage'], ['settings', 'Agency settings', 'agency.manage'], ['audit', 'Audit log', 'audit.read'],
    ['g', 'You'], ['account', 'Account and security', null]];
  function shell(active, title, body, actions) {
    const brandName = (S.brand && S.brand.display_name) || (S.agency && S.agency.trading_name) || 'MRET RENT OS';
    if (S.brand && S.brand.primary_color) document.documentElement.style.setProperty('--brand', S.brand.primary_color);
    const nav = NAV.filter(n => n[0] === 'g' || !n[2] || can(n[2])).map(n => n[0] === 'g' ? '<div class="grp">' + n[1] + '</div>' : '<a href="#/' + n[0] + '"' + (active === n[0] ? ' aria-current="page"' : '') + '>' + n[1] + '</a>').join('')
      + (S.admin ? '<div class="grp">MRET Technologies</div><a href="#/admin"' + (active === 'admin' ? ' aria-current="page"' : '') + '>Super admin</a>' : '');
    const switcher = S.agencies.length > 1 ? '<select class="inp" id="agSw" style="width:auto;min-height:34px;padding:4px 8px" aria-label="Switch agency">' + S.agencies.map(a => '<option value="' + a.agency_id + '"' + (S.agency && a.agency_id === S.agency.agency_id ? ' selected' : '') + '>' + esc(a.trading_name) + '</option>').join('') + '</select>' : '';
    $('root').innerHTML = '<header class="app-head"><div class="in"><button class="btn sm nav-btn" id="navB" aria-label="Menu">Menu</button><div class="agency">' + (S.brand && S.brand.logo_data ? '<img src="' + esc(S.brand.logo_data) + '" alt="">' : '<span class="logo"><span class="mark">RO</span></span>') + '<span class="nm">' + esc(brandName) + '</span></div>' + switcher + '<span class="sp"></span><button class="btn sm ghost theme-btn" id="thB" aria-label="Light or dark">' + THEME_SVG + '</button><span class="small muted" style="display:none" id="who">' + esc(S.user.email) + '</span><button class="btn sm" id="outB">Sign out</button></div></header>'
      + '<div class="shell"><nav class="side" aria-label="Workspace">' + nav + '</nav><main class="main">' + banner() + '<div class="page-head"><h1>' + title + '</h1><div class="row">' + (actions || '') + '</div></div>' + body + '</main></div>';
    $('navB').onclick = () => document.body.classList.toggle('nav-open');
    document.querySelectorAll('.side a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('nav-open')));
    $('outB').onclick = async () => { await sb.auth.signOut(); LS.set('rentos.agency', null); location.hash = '#/login'; location.reload(); };
    $('thB').onclick = toggleTheme;
    if ($('agSw')) $('agSw').onchange = e => switchAgency(e.target.value);
  }
  function banner() {
    const o = S.ov; if (!o) return '';
    const s = o.subscription;
    if (o.access === 'read_only') return '<div class="notice bad" style="margin-bottom:16px"><b>Read-only.</b> ' + (s && s.status === 'suspended' && s.trial_ends_at ? 'Your free trial has ended.' : 'Your subscription is not active.') + ' All your records are kept. ' + (can('billing.manage') ? '<a href="#/subscription">Choose a plan to continue</a>.' : 'Ask your agency owner to renew.') + '</div>';
    if (o.access === 'setup') return '<div class="notice info" style="margin-bottom:16px">Finish setting up your agency. <a href="#/onboarding">Continue setup</a></div>';
    if (s && s.status === 'trialing') { const d = daysTo(s.trial_ends_at); return d <= 5 ? '<div class="notice warn" style="margin-bottom:16px">Your free trial ends in ' + d + ' day' + (d === 1 ? '' : 's') + '. ' + (can('billing.manage') ? '<a href="#/subscription">Choose how to pay</a>.' : '') + '</div>' : ''; }
    if (s && s.status === 'past_due') return '<div class="notice warn" style="margin-bottom:16px">Your last payment did not go through. Access continues until ' + fmtD(s.grace_ends_at) + '. ' + (can('billing.manage') ? '<a href="#/subscription">Update payment</a>.' : '') + '</div>';
    return '';
  }

  /* ---------------- onboarding ---------------- */
  const STEPS = [['account', 'Account'], ['verify', 'Verify email'], ['agency', 'Agency'], ['plan', 'Plan'], ['branding', 'Branding'], ['team', 'Team'], ['property', 'First property'], ['done', 'Launch']];
  function nextStep() { const o = (S.agency && S.agency.onboarding) || {}; if (!S.agency) return 'agency'; for (const k of ['plan', 'branding', 'team', 'property', 'done']) if (!o[k]) return k; return null; }
  function stepper(cur) { const o = (S.agency && S.agency.onboarding) || {}; const done = k => k === 'account' || k === 'verify' || (k === 'agency' && S.agency) || o[k]; return '<div class="stepper" aria-label="Setup progress">' + STEPS.map(([k, l]) => '<span class="' + (k === cur ? 'cur' : done(k) ? 'done' : '') + '">' + l + '</span>').join('') + '</div>'; }
  const obShell = (cur, title, body) => { $('root').innerHTML = '<div class="wrap" style="max-width:880px;padding-top:28px;padding-bottom:48px"><div class="row" style="margin-bottom:14px"><a class="logo" href="/rent-os/"><span class="mark">RO</span><span>MRET <b>RENT OS</b></span></a><span class="sp" style="flex:1"></span>' + (S.agency && S.agency.onboarding && S.agency.onboarding.plan ? '<a class="btn sm" href="#/dashboard">Skip to dashboard</a>' : '') + '<button class="btn sm" id="outB">Sign out</button></div>' + stepper(cur) + '<div class="card"><h2>' + title + '</h2>' + body + '</div></div>'; $('outB').onclick = async () => { await sb.auth.signOut(); location.hash = '#/login'; location.reload(); }; };
  function vPendingInvites(fromOnboarding) {
    obShell('agency', 'You have been invited', '<p class="ink2">Your email address has an invitation waiting. Accept it to join that agency\'s workspace.</p>' + S.invites.map(i => '<div class="card row" style="margin-top:10px"><div style="flex:1"><b>' + esc(i.agency_name) + '</b><div class="small muted">' + esc(i.role_label) + ', expires ' + fmtD(i.expires_at) + '</div></div><button class="btn primary" data-acc="' + i.invitation_id + '">Accept and join</button></div>').join('') + '<p class="err" id="e"></p>' + (fromOnboarding ? '<p style="margin-top:18px"><button class="btn ghost" id="own">No, I want to register my own agency</button></p>' : ''));
    document.querySelectorAll('[data-acc]').forEach(b => b.onclick = ev => busy(ev.target, async () => { const r = await sb.rpc('accept_invitation_by_id', { inv: b.dataset.acc }); if (r.error) return ($('e').textContent = friendly(r.error)); SS.set('rentos.invite', null); LS.set('rentos.agency', r.data); toast('Welcome to the team'); await loadAll(); go('#/dashboard'); }));
    if ($('own')) $('own').onclick = () => { S.skipInvites = true; render(); };
  }
  async function vOnboarding() {
    if (!S.agency && S.invites && S.invites.length && !S.skipInvites) return vPendingInvites(true);
    if (!S.agency && (S.portals || []).length && !S.skipInvites) return go('#/portal');
    const step = nextStep();
    if (!step) return go('#/dashboard');
    if (S.agency && S.agency.role !== 'agency_owner' && S.agency.role !== 'agency_admin') return go('#/dashboard');
    if (step === 'agency') return obAgency();
    if (step === 'plan') return obPlan();
    if (step === 'branding') return obBranding();
    if (step === 'team') return obTeam();
    if (step === 'property') return obProperty();
    if (step === 'done') return obDone();
  }
  const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  function agencyForm(a) {
    return field('Agency trading name', inp('trading_name', a.trading_name, ' required maxlength="120"')) + field('Registered business name', inp('legal_name', a.legal_name, ' maxlength="160"'))
      + field('Company registration number <span class="hint">if registered</span>', inp('registration_no', a.registration_no, ' maxlength="40" placeholder="2020/123456/07"')) + field('PPRA firm registration (FFC) number <span class="hint">where applicable</span>', inp('ppra_firm_no', a.ppra_firm_no, ' maxlength="40"'))
      + field('Physical business address', inp('address', a.address, ' maxlength="300"'), 'span2') + field('Business email', inp('business_email', a.business_email, ' type="email" maxlength="160"')) + field('Business phone', inp('phone', a.phone, ' type="tel" maxlength="30"'));
  }
  function obAgency() {
    obShell('agency', 'Tell us about your agency', '<form id="f" class="grid g2" novalidate>' + agencyForm({}) + field('Workspace ID <span class="hint">lower-case letters, numbers and dashes; used for your web address later</span>', inp('slug', '', ' required maxlength="40" pattern="[a-z0-9-]+"'), 'span2') + '<p class="small muted span2">Primary business owner: ' + esc(((S.profile && S.profile.first_name) || '') + ' ' + ((S.profile && S.profile.surname) || '')) + ' (' + esc(S.user.email) + '). You can add more people later.</p><div class="span2 row"><button class="btn primary lg">Create agency workspace</button><p class="err" id="e"></p></div></form>');
    const f = $('f'); let touched = false;
    f.trading_name.oninput = () => { if (!touched) f.slug.value = slugify(f.trading_name.value); };
    f.slug.oninput = () => { touched = true; };
    f.onsubmit = async ev => { ev.preventDefault(); const d = formData(f); $('e').textContent = '';
      if (!d.trading_name || d.trading_name.length < 2) return ($('e').textContent = 'Give your agency\'s trading name.');
      d.slug = slugify(d.slug || d.trading_name); if (d.slug.length < 3) return ($('e').textContent = 'The workspace ID needs at least 3 letters or numbers.');
      await busy(ev.submitter, async () => { const r = await sb.rpc('create_agency', { p_trading_name: d.trading_name, p_slug: d.slug, p_legal_name: d.legal_name, p_registration_no: d.registration_no, p_ppra_firm_no: d.ppra_firm_no, p_address: d.address, p_business_email: d.business_email, p_phone: d.phone });
        if (r.error) return ($('e').textContent = friendly(r.error)); LS.set('rentos.agency', r.data); await loadAll(); go('#/onboarding'); }); };
  }
  async function planGrid(current) {
    const plans = await loadPlans(); const cyc = LS.get('rentos.cycle', 'monthly'); const pre = SS.get('rentos.plan') || (current && current.plan_code) || 'professional';
    return '<div class="seg row" style="margin:6px 0 16px" role="radiogroup" aria-label="Billing cycle"><button type="button" class="btn sm' + (cyc === 'monthly' ? ' dark' : '') + '" data-cyc="monthly">Monthly</button><button type="button" class="btn sm' + (cyc === 'annual' ? ' dark' : '') + '" data-cyc="annual">Yearly</button></div><div class="grid g4" id="pg">'
      + plans.map(p => { const price = cyc === 'annual' ? p.annual_price_cents : p.monthly_price_cents; const f = (p.max_users ? ['Up to ' + p.max_users + ' user' + (p.max_users === 1 ? '' : 's')] : []).concat(p.max_properties ? ['Up to ' + p.max_properties + ' properties'] : [], (p.plan_features || []).filter(x => x.enabled).slice(0, 5).map(x => x.label));
        return '<label class="card price-card' + (p.code === pre ? ' feat' : '') + '" style="cursor:' + (p.is_custom_pricing ? 'default' : 'pointer') + '">' + (p.is_custom_pricing ? '' : '<input type="radio" name="plan" value="' + p.code + '"' + (p.code === pre ? ' checked' : '') + ' style="accent-color:var(--brand)">') + '<h3 style="margin-top:6px">' + esc(p.name) + '</h3>' + (p.is_custom_pricing ? '<div class="amt" style="font-size:24px">Custom</div>' : '<div class="amt" style="font-size:24px">' + R0(price) + '<span class="small muted"> / ' + (cyc === 'annual' ? 'year' : 'month') + '</span></div>') + '<ul class="small">' + f.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (p.is_custom_pricing ? '<a class="btn sm" href="/rent-os/demo/" target="_blank">Talk to us</a>' : '') + '</label>'; }).join('') + '</div>';
  }
  function bindPlanGrid(rerender) {
    document.querySelectorAll('[data-cyc]').forEach(b => b.onclick = () => { LS.set('rentos.cycle', b.dataset.cyc); rerender(); });
    document.querySelectorAll('#pg input[name=plan]').forEach(i => i.onchange = () => { SS.set('rentos.plan', i.value); document.querySelectorAll('#pg .price-card').forEach(c => c.classList.toggle('feat', c.contains(i) && i.checked)); });
  }
  const chosenPlan = () => { const i = document.querySelector('#pg input[name=plan]:checked'); return i && i.value; };
  async function obPlan() {
    obShell('plan', 'Choose a plan', '<p class="ink2">Start with a free 14-day trial of any plan. No card needed. You can change plan during the trial.</p>' + await planGrid(null) + '<div class="row" style="margin-top:18px"><button class="btn primary lg" id="trial">Start free trial</button><button class="btn lg" id="pay">Pay now instead</button><p class="err" id="e"></p></div>');
    bindPlanGrid(obPlan);
    $('trial').onclick = ev => busy(ev.target, async () => { const p = chosenPlan(); if (!p) return ($('e').textContent = 'Choose a plan.'); const r = await sb.rpc('start_trial', { a: S.agency.agency_id, plan_code: p, cycle: LS.get('rentos.cycle', 'monthly') }); if (r.error) return ($('e').textContent = friendly(r.error)); SS.set('rentos.plan', null); toast('Your 14-day trial has started'); await loadAll(); go('#/onboarding'); });
    $('pay').onclick = ev => busy(ev.target, async () => { const p = chosenPlan(); if (!p) return ($('e').textContent = 'Choose a plan.'); await checkout(p, LS.get('rentos.cycle', 'monthly'), null, $('e')); });
  }
  async function checkout(plan, cycle, coupon, errEl) {
    const { data: { session } } = await sb.auth.getSession();
    let res, body;
    try { res = await fetch(C.functionsUrl + '/billing-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, apikey: C.key }, body: JSON.stringify({ agency_id: S.agency.agency_id, plan_code: plan, cycle, coupon }) }); body = await res.json(); }
    catch (e) { errEl.textContent = 'Could not reach the payment service. Please try again.'; return; }
    if (!res.ok) { errEl.textContent = body.message || 'Payment could not be started.'; return; }
    const f = document.createElement('form'); f.method = 'post'; f.action = body.action; f.style.display = 'none';
    Object.entries(body.fields).forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); });
    document.body.appendChild(f); toast('Opening the secure PayFast payment page...'); f.submit();
  }
  async function brandingForm(container, done) {
    const r = await sb.from('agency_branding').select('*').eq('agency_id', S.agency.agency_id).single(); const b = r.data || {};
    const ag = (await sb.from('agencies').select('*').eq('id', S.agency.agency_id).single()).data || {};
    container.innerHTML = '<div class="grid g2" style="align-items:start"><form id="bf" class="grid" novalidate>'
      + field('Name on documents', inp('display_name', b.display_name || ag.trading_name, ' maxlength="120"'))
      + '<div class="grid g2"><div>' + field('Logo <span class="hint">PNG, JPG, WebP or SVG</span>', '<input class="inp" type="file" id="logoF" accept="image/png,image/jpeg,image/webp,image/svg+xml">') + '</div><div>' + field('Square icon', '<input class="inp" type="file" id="iconF" accept="image/png,image/jpeg,image/webp,image/svg+xml">') + '</div></div>'
      + '<div class="row">' + field('Primary colour', '<input type="color" class="swatch" name="primary_color" value="' + esc(b.primary_color || '#1f6f5c') + '">') + field('Accent colour', '<input type="color" class="swatch" name="accent_color" value="' + esc(b.accent_color || '#1d1f22') + '">') + (b.logo_data ? '<button type="button" class="btn sm" id="rmLogo">Remove logo</button>' : '') + '</div>'
      + '<details><summary class="small" style="cursor:pointer;font-weight:600">Contact and registration details</summary><div class="grid g2" style="margin-top:10px">' + field('Address', inp('address', b.address, ' maxlength="300"'), 'span2') + field('Email', inp('email', b.email, ' maxlength="160"')) + field('Phone', inp('phone', b.phone, ' maxlength="30"')) + field('Second phone', inp('phone_alt', b.phone_alt, ' maxlength="30"')) + field('WhatsApp', inp('whatsapp', b.whatsapp, ' maxlength="30"')) + field('Website', inp('website', b.website, ' maxlength="200"'), 'span2') + field('Registration information', inp('registration_info', b.registration_info, ' maxlength="200"')) + field('PPRA details', inp('ppra_info', b.ppra_info, ' maxlength="200"')) + field('VAT number', inp('vat_no', b.vat_no, ' maxlength="30"')) + '</div></details>'
      + '<details><summary class="small" style="cursor:pointer;font-weight:600">Footers, signature and payment instructions</summary><div class="grid" style="margin-top:10px">' + field('Invoice footer', '<textarea class="inp" name="invoice_footer" rows="2" maxlength="600">' + esc(b.invoice_footer || '') + '</textarea>') + field('Statement footer', '<textarea class="inp" name="statement_footer" rows="2" maxlength="600">' + esc(b.statement_footer || '') + '</textarea>') + field('Email signature', '<textarea class="inp" name="email_signature" rows="3" maxlength="800">' + esc(b.email_signature || '') + '</textarea>') + field('Payment instructions shown to tenants', '<textarea class="inp" name="payment_instructions" rows="3" maxlength="800">' + esc(b.payment_instructions || '') + '</textarea>') + '</div></details>'
      + '<div class="row"><button class="btn primary">' + (done ? 'Save and continue' : 'Save branding') + '</button><p class="err" id="be"></p></div></form>'
      + '<div><div class="small muted" style="margin-bottom:6px">Live preview: rental invoice</div><div class="doc-preview" id="pv"></div></div></div>';
    const f = $('bf'); let logo = b.logo_data || null, icon = b.icon_data || null;
    const paint = () => { const d = formData(f); const pv = $('pv'); pv.style.setProperty('--bp', d.primary_color || '#1f6f5c');
      pv.innerHTML = '<div class="dh"><div>' + (logo ? '<img src="' + esc(logo) + '" alt="">' : '<h4>' + esc(d.display_name || ag.trading_name) + '</h4>') + '<div style="margin-top:6px;color:#555">' + esc(d.address || '') + (d.phone ? '<br>' + esc(d.phone) : '') + (d.email ? ' · ' + esc(d.email) : '') + '</div></div><div style="text-align:right"><h4>INVOICE</h4><div>INV-000123</div><div>Due 1 Dec 2026</div></div></div>'
        + '<div style="margin-top:12px"><b>Bill to</b><br>Example Tenant<br>Unit 4, Example Court</div><table><tr><th>Description</th><th style="text-align:right">Amount</th></tr><tr><td>Rent, December 2026</td><td style="text-align:right">R 9 500,00</td></tr><tr><td>Water and electricity</td><td style="text-align:right">R 650,00</td></tr><tr class="tot"><td>Amount due</td><td style="text-align:right;color:' + esc(d.primary_color) + '">R 10 150,00</td></tr></table>'
        + (d.payment_instructions ? '<div style="margin-bottom:10px"><b>How to pay</b><br><span style="white-space:pre-line">' + esc(d.payment_instructions) + '</span></div>' : '') + '<div class="ft">' + esc(d.invoice_footer || 'Your invoice footer appears here.') + (d.vat_no ? '\nVAT no. ' + esc(d.vat_no) : '') + (d.ppra_info ? '\n' + esc(d.ppra_info) : '') + '</div><div style="font-size:11px;color:#888;margin-top:8px">Example data for the preview.</div>'; };
    f.oninput = paint; paint();
    const readImg = (file, maxPx, maxLen) => new Promise((res, rej) => { if (!file) return res(null); if (file.size > 3e6) return rej(new Error('Choose an image under 3 MB.'));
      const rd = new FileReader(); rd.onerror = () => rej(new Error('Could not read the file.'));
      rd.onload = () => { const url = rd.result; if (file.type === 'image/svg+xml') { if (/<script|on\w+=|javascript:/i.test(atob(url.split(',')[1]))) return rej(new Error('That SVG contains scripts and cannot be used.')); return url.length > maxLen ? rej(new Error('That SVG is too large.')) : res(url); }
        const im = new Image(); im.onload = () => { const s = Math.min(1, maxPx / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); let out = c.toDataURL('image/png'); if (out.length > maxLen) out = c.toDataURL('image/webp', 0.85); out.length > maxLen ? rej(new Error('That image is too detailed. Try a smaller file.')) : res(out); }; im.onerror = () => rej(new Error('That file is not an image we can read.')); im.src = url; }; rd.readAsDataURL(file); });
    $('logoF').onchange = async e => { try { logo = await readImg(e.target.files[0], 600, 390000); paint(); } catch (x) { $('be').textContent = x.message; } };
    $('iconF').onchange = async e => { try { icon = await readImg(e.target.files[0], 256, 115000); } catch (x) { $('be').textContent = x.message; } };
    if ($('rmLogo')) $('rmLogo').onclick = () => { logo = null; paint(); };
    f.onsubmit = async ev => { ev.preventDefault(); const d = formData(f); d.logo_data = logo; d.icon_data = icon; $('be').textContent = '';
      await busy(ev.submitter, async () => { const r = await sb.from('agency_branding').update(d).eq('agency_id', S.agency.agency_id).select('agency_id'); if (r.error) return ($('be').textContent = friendly(r.error)); if (!r.data || !r.data.length) return ($('be').textContent = 'You do not have permission to change branding.');
        toast('Branding saved'); await loadOverview(); if (done) done(); else render(); }); };
  }
  async function obBranding() { obShell('branding', 'Make it yours', '<p class="ink2">Your logo and colours appear on invoices, statements, portals and emails. You can change them any time.</p><div id="bh"></div><p style="margin-top:12px"><button class="btn ghost" id="skip">Skip for now</button></p>'); await brandingForm($('bh'), async () => { await sb.rpc('mark_onboarding', { a: S.agency.agency_id, step: 'branding' }); await loadAll(); go('#/onboarding'); }); $('skip').onclick = async () => { await sb.rpc('mark_onboarding', { a: S.agency.agency_id, step: 'branding' }); await loadAll(); go('#/onboarding'); }; }
  function inviteForm(after) {
    return { html: '<form id="invF" class="grid g3" novalidate>' + field('Email address', inp('email', '', ' type="email" required maxlength="160"')) + field('Role', '<select class="inp" name="role">' + Object.entries(ROLE).filter(([k]) => k !== 'agency_owner').map(([k, l]) => '<option value="' + k + '"' + (k === 'rental_agent' ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>') + '<div style="align-self:end"><button class="btn primary">Create invitation</button></div><p class="err" id="ie" style="grid-column:1/-1"></p></form><div id="invOut"></div>',
      bind() { $('invF').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); $('ie').textContent = ''; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) return ($('ie').textContent = 'Give a valid email address.');
        await busy(ev.submitter, async () => { const r = await sb.rpc('invite_member', { a: S.agency.agency_id, p_email: d.email, p_role: d.role }); if (r.error) return ($('ie').textContent = friendly(r.error));
          const link = C.appUrl + '#/invite/' + r.data, agName = (S.brand && S.brand.display_name) || S.agency.trading_name;
          const msg = 'Hi, I have invited you to join ' + agName + ' on MRET RENT OS as ' + ROLE[d.role] + '. Accept here (valid for 7 days): ' + link;
          $('invOut').innerHTML = '<div class="notice ok" style="margin-top:12px"><b>Invitation ready for ' + esc(d.email) + '.</b> Send them this personal link. It works once, for that email address, for 7 days.<div class="row" style="margin-top:10px"><input class="inp" id="invL" readonly value="' + esc(link) + '" style="flex:1;min-width:220px"><button class="btn sm" id="cpL">Copy link</button><a class="btn sm" href="mailto:' + encodeURIComponent(d.email) + '?subject=' + encodeURIComponent('Join ' + agName + ' on MRET RENT OS') + '&body=' + encodeURIComponent(msg) + '">Email it</a><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(msg) + '">WhatsApp it</a></div></div>';
          $('cpL').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch (e) { $('invL').select(); } };
          ev.target.reset(); if (after) after(); }); }; } };
  }
  function obTeam() {
    const iv = inviteForm(); obShell('team', 'Invite your team', '<p class="ink2">Give each person their own login and the right role. Your plan sets how many users you can have.</p>' + iv.html + '<div class="row" style="margin-top:18px"><button class="btn primary" id="cont">Continue</button></div>');
    iv.bind(); $('cont').onclick = async () => { await sb.rpc('mark_onboarding', { a: S.agency.agency_id, step: 'team' }); await loadAll(); go('#/onboarding'); };
  }
  const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];
  function propertyFields(p) {
    return field('Property name', inp('name', p.name, ' required maxlength="120" placeholder="e.g. Unit 4, Oak Court"'), 'span2') + field('Street address', inp('address_line', p.address_line, ' required maxlength="200"'), 'span2') + field('Suburb', inp('suburb', p.suburb, ' maxlength="80"')) + field('City', inp('city', p.city, ' maxlength="80"'))
      + field('Province', '<select class="inp" name="province"><option value="">Choose</option>' + PROVINCES.map(x => '<option' + (p.province === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>') + field('Postal code', inp('postal_code', p.postal_code, ' maxlength="4" inputmode="numeric"'))
      + field('Type', '<select class="inp" name="property_type">' + ['residential', 'commercial', 'industrial', 'mixed'].map(x => '<option value="' + x + '"' + ((p.property_type || 'residential') === x ? ' selected' : '') + '>' + x[0].toUpperCase() + x.slice(1) + '</option>').join('') + '</select>') + field('Occupancy', '<select class="inp" name="occupancy">' + [['vacant', 'Vacant'], ['occupied', 'Occupied'], ['notice', 'Tenant on notice'], ['unavailable', 'Unavailable']].map(([k, l]) => '<option value="' + k + '"' + ((p.occupancy || 'vacant') === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>')
      + field('Complex or building', inp('complex_name', p.complex_name, ' maxlength="120"')) + field('Unit number', inp('unit_no', p.unit_no, ' maxlength="20"'))
      + field('Bedrooms', inp('bedrooms', p.bedrooms, ' type="number" min="0" step="0.5"')) + field('Bathrooms', inp('bathrooms', p.bathrooms, ' type="number" min="0" step="0.5"')) + field('Parking bays', inp('parking', p.parking, ' type="number" min="0"')) + field('Floor area (m²)', inp('floor_area_m2', p.floor_area_m2, ' type="number" min="0" step="0.01"'))
      + field('Monthly rental (R)', inp('rental', p.rental_cents != null ? (p.rental_cents / 100).toFixed(2) : '', ' inputmode="decimal" placeholder="9500.00"')) + field('Notes', '<textarea class="inp" name="notes" rows="2" maxlength="2000">' + esc(p.notes || '') + '</textarea>', 'span2');
  }
  function propertyRow(d) {
    const cents = d.rental ? (/^\d+(\.\d{1,2})?$/.test(d.rental.replace(/[\s,]/g, '')) ? Math.round(Number(d.rental.replace(/[\s,]/g, '')) * 100) : NaN) : null;
    if (Number.isNaN(cents)) throw new Error('Monthly rental must be a number such as 9500 or 9500.50.');
    if (d.postal_code && !/^\d{4}$/.test(d.postal_code)) throw new Error('Postal codes have four digits.');
    if (!d.name || !d.address_line) throw new Error('Give the property a name and an address.');
    const r = Object.assign({}, d); delete r.rental; r.rental_cents = cents; ['bedrooms', 'bathrooms', 'parking', 'floor_area_m2'].forEach(k => { if (r[k] != null) r[k] = Number(r[k]); }); return r;
  }
  function obProperty() {
    obShell('property', 'Add your first property', '<p class="ink2">You can add the rest, and their landlords, tenants and leases, from your dashboard.</p><form id="pf" class="grid g2" novalidate>' + propertyFields({}) + '<div class="span2 row"><button class="btn primary lg">Add property</button><button type="button" class="btn ghost" id="skip">Skip for now</button><p class="err" id="e"></p></div></form>');
    const finish = async () => { await sb.rpc('mark_onboarding', { a: S.agency.agency_id, step: 'property' }); await loadAll(); go('#/onboarding'); };
    $('skip').onclick = finish;
    $('pf').onsubmit = async ev => { ev.preventDefault(); try { const row = propertyRow(formData(ev.target)); row.agency_id = S.agency.agency_id; await busy(ev.submitter, async () => { const r = await sb.from('properties').insert(row); if (r.error) throw r.error; toast('Property added'); await finish(); }); } catch (x) { $('e').textContent = friendly(x); } };
  }
  function obDone() {
    obShell('done', 'You are ready', '<p class="ink2">Your workspace for <b>' + esc((S.brand && S.brand.display_name) || S.agency.trading_name) + '</b> is set up.</p><ul class="ink2"><li>Your trial or plan is active.</li><li>Your branding is applied to documents and portals.</li><li>Your team can accept their invitations.</li></ul><button class="btn primary lg" id="go">Open my dashboard</button>');
    $('go').onclick = ev => busy(ev.target, async () => { await sb.rpc('mark_onboarding', { a: S.agency.agency_id, step: 'done' }); await loadAll(); go('#/dashboard'); });
  }

  /* ---------------- workspace pages ---------------- */
  function kpi(l, v, s) { return '<div class="card kpi"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + (s || '') + '</div></div>'; }
  async function vDashboard() {
    await loadOverview(); const o = S.ov || {}, s = o.subscription;
    const ob = nextStep();
    const subTxt = !s ? 'No plan yet' : s.status === 'trialing' ? 'Free trial, ' + Math.max(0, daysTo(s.trial_ends_at)) + ' days left' : s.status === 'active' ? 'Active, renews ' + fmtD(s.current_period_end) : s.status === 'past_due' ? 'Payment overdue' : s.status === 'suspended' ? 'Suspended' : s.status;
    shell('dashboard', 'Dashboard', (ob && ob !== 'done' && can('agency.manage') ? '<div class="notice info" style="margin-bottom:16px">Setup is not finished. <a href="#/onboarding">Continue where you left off</a></div>' : '')
      + ((S.invites || []).length ? '<div class="notice info" style="margin-bottom:16px">You have ' + S.invites.length + ' invitation' + (S.invites.length === 1 ? '' : 's') + ' to join another agency (' + S.invites.map(i => esc(i.agency_name)).join(', ') + '). <a href="#/invites">View</a></div>' : '')
      + '<div class="grid g4">' + kpi('Properties', N(o.properties), N(o.occupied) + ' occupied, ' + N(o.vacant) + ' vacant') + kpi('Occupancy', o.properties ? Math.round(o.occupied / o.properties * 100) + '%' : '–', 'Occupied out of active properties') + kpi('Monthly rent roll', R0(o.rent_roll_cents), 'Captured rent on occupied properties') + kpi('Team', N(o.users) + (s && s.max_users ? ' of ' + s.max_users : ''), N(o.pending_invites) + ' invitation' + (o.pending_invites === 1 ? '' : 's') + ' pending') + '</div>'
      + '<div class="grid g2" style="margin-top:16px"><div class="card"><h3>Your plan</h3><p><span class="chip ' + (o.access === 'full' ? 'ok' : o.access === 'read_only' ? 'bad' : 'info') + '">' + esc(subTxt) + '</span> ' + (s ? '<b>' + esc(s.plan) + '</b> ' + R(s.price_cents) + ' per ' + (s.cycle === 'annual' ? 'year' : 'month') : '') + '</p>' + (s && s.max_properties ? '<div class="small muted">Properties ' + N(o.properties) + ' of ' + s.max_properties + '</div><div class="bar-meter" style="margin:6px 0 12px"><div style="width:' + Math.min(100, Math.round(o.properties / s.max_properties * 100)) + '%"></div></div>' : '') + (can('billing.manage') ? '<a class="btn sm" href="#/subscription">Manage subscription</a>' : '') + '</div>'
      + '<div class="card" id="dashX"><h3>Rentals this month</h3><p class="muted small">Loading...</p></div></div>'
      + '<p class="small muted" style="margin-top:16px">How these numbers are worked out: invoiced counts this month\'s rent invoices; collected counts only verified payments allocated to them; arrears are unpaid amounts past their due date. properties and occupancy count active (not archived) properties; rent roll adds the monthly rental captured on occupied properties; team counts active staff who use a seat.</p>');
    fillDash();
  }
  async function fillDash() { const el = $('dashX'); if (!el || !window.RentOSPages) return; try { el.innerHTML = await window.RentOSPages.dashCard(); } catch (e) { el.innerHTML = '<p class="muted small">' + esc(friendly(e)) + '</p>'; } }
  async function vProperties(q) {
    const filt = q.get('f') || 'all', search = q.get('s') || '';
    let qr = sb.from('properties').select('*').is('archived_at', null).eq('agency_id', S.agency.agency_id).order('created_at', { ascending: false }).limit(500);
    if (filt !== 'all') qr = qr.eq('occupancy', filt);
    if (search) qr = qr.or('name.ilike.%' + search.replace(/[%,()]/g, '') + '%,address_line.ilike.%' + search.replace(/[%,()]/g, '') + '%,suburb.ilike.%' + search.replace(/[%,()]/g, '') + '%');
    const { data, error } = await qr;
    const canW = can('properties.write') && writable();
    shell('properties', 'Properties', '<div class="row" style="margin-bottom:12px"><input class="inp" id="ps" placeholder="Search name, address or suburb" value="' + esc(search) + '" style="max-width:320px"><select class="inp" id="pfl" style="width:auto">' + [['all', 'All'], ['occupied', 'Occupied'], ['vacant', 'Vacant'], ['notice', 'On notice'], ['unavailable', 'Unavailable']].map(([k, l]) => '<option value="' + k + '"' + (k === filt ? ' selected' : '') + '>' + l + '</option>').join('') + '</select><span class="small muted">' + (data ? data.length : 0) + ' shown</span></div>'
      + (error ? '<div class="notice bad">' + esc(friendly(error)) + '</div>' : data.length ? '<div class="card tw" style="padding:0"><table class="t"><thead><tr><th>Property</th><th>Suburb</th><th>Type</th><th>Occupancy</th><th class="n">Rental</th><th></th></tr></thead><tbody>' + data.map(p => '<tr><td><b>' + esc(p.name) + '</b><div class="small muted">' + esc(p.address_line) + '</div></td><td>' + esc(p.suburb || '') + '</td><td>' + esc(p.property_type) + '</td><td><span class="chip ' + (p.occupancy === 'occupied' ? 'ok' : p.occupancy === 'vacant' ? 'warn' : '') + '">' + esc(p.occupancy) + '</span></td><td class="n">' + R(p.rental_cents) + '</td><td class="n">' + (canW ? '<button class="btn sm" data-ed="' + p.id + '">Edit</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">No properties yet.' + (canW ? ' Add your first one.' : '') + '</div>'),
      canW ? '<button class="btn primary" id="addP">Add property</button>' : '');
    let t; $('ps').oninput = e => { clearTimeout(t); t = setTimeout(() => go('#/properties?f=' + filt + '&s=' + encodeURIComponent(e.target.value)), 350); };
    $('pfl').onchange = e => go('#/properties?f=' + e.target.value + '&s=' + encodeURIComponent(search));
    const edit = p => { const d = $('dlg'); d.innerHTML = '<div class="in"><div class="hd"><h2>' + (p.id ? 'Edit property' : 'Add property') + '</h2><button class="btn sm" id="dx">Close</button></div><form id="pf" class="grid g2" novalidate>' + propertyFields(p) + '<div class="span2 row"><button class="btn primary">Save</button>' + (p.id ? '<button type="button" class="btn danger" id="arc" style="margin-left:auto">Archive</button>' : '') + '<p class="err" id="e"></p></div></form></div>'; d.showModal(); $('dx').onclick = () => d.close();
      $('pf').onsubmit = async ev => { ev.preventDefault(); try { const row = propertyRow(formData(ev.target)); await busy(ev.submitter, async () => { const r = p.id ? await sb.from('properties').update(row).eq('id', p.id) : await sb.from('properties').insert(Object.assign(row, { agency_id: S.agency.agency_id })); if (r.error) throw r.error; d.close(); toast('Saved'); render(); }); } catch (x) { $('e').textContent = friendly(x); } };
      if ($('arc')) $('arc').onclick = async () => { if (!confirm('Archive this property? It stays in your records and reports history.')) return; const r = await sb.from('properties').update({ archived_at: new Date().toISOString() }).eq('id', p.id); if (r.error) return ($('e').textContent = friendly(r.error)); d.close(); toast('Archived'); render(); }; };
    if ($('addP')) $('addP').onclick = () => edit({});
    document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => edit(data.find(x => x.id === b.dataset.ed)));
  }
  async function vTeam() {
    const [m, inv] = await Promise.all([sb.rpc('team_members', { a: S.agency.agency_id }), can('team.manage') ? sb.from('agency_invitations').select('*').eq('agency_id', S.agency.agency_id).is('accepted_at', null).is('revoked_at', null).order('created_at', { ascending: false }) : { data: [] }]);
    const mg = can('team.manage') && writable(), iv = inviteForm(() => setTimeout(render, 1500));
    const pend = (inv.data || []).filter(i => new Date(i.expires_at) > new Date());
    shell('team', 'Team', '<div class="card tw" style="padding:0"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody>' + (m.data || []).map(x => '<tr><td>' + esc(((x.first_name || '') + ' ' + (x.surname || '')).trim() || '–') + '</td><td>' + esc(x.email) + '</td><td>' + (mg && x.role !== 'agency_owner' && x.user_id !== S.user.id ? '<select class="inp" data-role="' + x.membership_id + '" style="min-height:34px;padding:4px 8px">' + Object.entries(ROLE).filter(([k]) => k !== 'agency_owner').map(([k, l]) => '<option value="' + k + '"' + (x.role === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>' : esc(ROLE[x.role] || x.role)) + '</td><td>' + (mg && x.role !== 'agency_owner' && x.user_id !== S.user.id ? '<button class="btn sm" data-st="' + x.membership_id + ':' + (x.status === 'active' ? 'suspended' : 'active') + '">' + (x.status === 'active' ? 'Suspend' : 'Reactivate') + '</button> <button class="btn sm danger" data-rm="' + x.membership_id + '">Remove</button>' : '<span class="chip ' + (x.status === 'active' ? 'ok' : 'warn') + '">' + x.status + '</span>') + '</td><td>' + fmtD(x.joined) + '</td></tr>').join('') + '</tbody></table></div>'
      + (mg ? '<div class="card" style="margin-top:16px"><h3>Invite someone</h3>' + iv.html + '</div>' : '')
      + (pend.length ? '<div class="card" style="margin-top:16px"><h3>Pending invitations</h3><table class="t"><tbody>' + pend.map(i => '<tr><td>' + esc(i.email) + '</td><td>' + esc(ROLE[i.role]) + '</td><td class="small muted">expires ' + fmtD(i.expires_at) + '</td><td class="n">' + (mg ? '<button class="btn sm" data-rv="' + i.id + '">Revoke</button>' : '') + '</td></tr>').join('') + '</tbody></table><p class="small muted">For security we do not keep invitation links. If someone lost theirs, revoke it and invite them again.</p></div>' : ''));
    if (mg) iv.bind();
    const act = async (p) => { const r = await p; if (r.error) toast(friendly(r.error)); else { toast('Updated'); render(); } };
    document.querySelectorAll('[data-role]').forEach(s => s.onchange = () => act(sb.from('agency_memberships').update({ role: s.value }).eq('id', s.dataset.role)));
    document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const [id, st] = b.dataset.st.split(':'); act(sb.from('agency_memberships').update({ status: st }).eq('id', id)); });
    document.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { if (confirm('Remove this person from the agency? They lose access immediately.')) act(sb.from('agency_memberships').delete().eq('id', b.dataset.rm)); });
    document.querySelectorAll('[data-rv]').forEach(b => b.onclick = () => act(sb.from('agency_invitations').update({ revoked_at: new Date().toISOString() }).eq('id', b.dataset.rv)));
  }
  async function vBranding() { shell('branding', 'Branding', '<div id="bh"><p class="muted">Loading...</p></div>'); await brandingForm($('bh')); }
  async function vSubscription(q) {
    await loadOverview(); const o = S.ov || {}, s = o.subscription;
    const inv = await sb.from('subscription_invoices').select('*').eq('agency_id', S.agency.agency_id).order('issued_at', { ascending: false }).limit(50);
    const grants = await sb.from('support_access_grants').select('*').eq('agency_id', S.agency.agency_id).order('created_at', { ascending: false }).limit(10);
    const ret = q.get('checkout');
    shell('subscription', 'Subscription', (ret === 'return' ? '<div class="notice info" id="retN" style="margin-bottom:16px">Thank you. PayFast has your payment. Your plan activates as soon as PayFast confirms it to us, usually within a minute. This page updates by itself.</div>' : ret === 'cancelled' ? '<div class="notice warn" style="margin-bottom:16px">The payment was cancelled. Nothing was charged.</div>' : '')
      + '<div class="grid g3">' + kpi('Plan', s ? esc(s.plan) : 'None', s ? R(s.price_cents) + ' per ' + (s.cycle === 'annual' ? 'year' : 'month') : '') + kpi('Status', s ? esc(s.status === 'trialing' ? 'Free trial' : (s.status.charAt(0).toUpperCase() + s.status.slice(1)).replace('_', ' ')) : 'Setup', s ? (s.status === 'trialing' ? 'ends ' + fmtD(s.trial_ends_at) : s.current_period_end ? (s.cancel_at_period_end ? 'ends ' : 'renews ') + fmtD(s.current_period_end) : '') : '') + kpi('Usage', N(o.users) + ' user' + (o.users === 1 ? '' : 's') + ', ' + N(o.properties) + ' propert' + (o.properties === 1 ? 'y' : 'ies'), s ? 'Plan allows ' + (s.max_users || 'unlimited') + ' users and ' + (s.max_properties || 'unlimited') + ' properties' : '') + '</div>'
      + '<div class="card" style="margin-top:16px"><h3>' + (s && s.status === 'active' ? 'Change plan' : 'Choose a plan') + '</h3><div id="pgw"></div><div class="row" style="margin-top:14px">' + (s && s.status === 'trialing' ? '<button class="btn" id="chg">Switch trial to this plan</button>' : '') + '' + (s && s.status === 'active' && !s.cancel_at_period_end ? '<p class="small ink2">Your paid plan is running. To change plan or billing cycle, <a href="/rent-os/contact/">contact MRET support</a> so the current PayFast billing is stopped first and you are never charged twice.</p>' : '<input class="inp" id="cpn" placeholder="Discount code" maxlength="20" style="max-width:180px"><button class="btn primary" id="pay">Pay securely with PayFast</button>') + '<p class="err" id="e"></p></div><p class="small muted">Payments are processed by PayFast. MRET never sees your card details. Your plan renews automatically; you can cancel at any time from the PayFast email receipt or by contacting MRET.</p></div>'
      + '<div class="card" style="margin-top:16px"><h3>Invoices</h3>' + ((inv.data || []).length ? '<div class="tw"><table class="t"><thead><tr><th>Number</th><th>Description</th><th>Date</th><th>Status</th><th class="n">Total</th></tr></thead><tbody>' + inv.data.map(i => '<tr><td>' + esc(i.number) + '</td><td>' + esc(i.description) + '</td><td>' + fmtD(i.issued_at) + '</td><td><span class="chip ' + (i.status === 'paid' ? 'ok' : i.status === 'failed' ? 'bad' : '') + '">' + esc(i.status) + '</span></td><td class="n">' + R(i.total_cents) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">No invoices yet.</p>') + '</div>'
      + (S.agency.role === 'agency_owner' ? '<div class="card" style="margin-top:16px"><h3>Support access</h3><p class="small ink2">MRET support cannot see your records unless you allow it. Access is read-only, limited in time and logged.</p><form id="saF" class="grid g3">' + field('Support email', inp('email', '', ' type="email" required')) + field('Reason', inp('reason', '', ' required minlength="5" maxlength="300"')) + field('Hours', inp('hours', '24', ' type="number" min="1" max="72"')) + '<div><button class="btn">Grant access</button></div><p class="err" id="se"></p></form>' + ((grants.data || []).length ? '<table class="t" style="margin-top:10px"><tbody>' + grants.data.map(g => '<tr><td>' + esc(g.reason) + '</td><td class="small muted">until ' + fmtDT(g.expires_at) + '</td><td>' + (g.revoked_at ? 'revoked' : new Date(g.expires_at) > new Date() ? '<span class="chip ok">active</span>' : 'expired') + '</td></tr>').join('') + '</tbody></table>' : '') + '</div>' : ''));
    const draw = async () => { $('pgw').innerHTML = await planGrid(s); bindPlanGrid(draw); };
    await draw();
    if ($('chg')) $('chg').onclick = ev => busy(ev.target, async () => { const p = chosenPlan(); const r = await sb.rpc('change_plan', { a: S.agency.agency_id, plan_code: p, cycle: LS.get('rentos.cycle', 'monthly') }); if (r.error) return ($('e').textContent = friendly(r.error)); toast('Trial switched'); render(); });
    if ($('pay')) $('pay').onclick = ev => busy(ev.target, async () => { const p = chosenPlan(); if (!p) return ($('e').textContent = 'Choose a plan.'); await checkout(p, LS.get('rentos.cycle', 'monthly'), $('cpn').value.trim() || null, $('e')); });
    if ($('saF')) $('saF').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); await busy(ev.submitter, async () => { const r = await sb.rpc('grant_support_access', { a: S.agency.agency_id, to_email: d.email || '', why: d.reason || '', hours: Number(d.hours || 24) }); if (r.error) return ($('se').textContent = friendly(r.error)); toast('Support access granted'); render(); }); };
    if (ret === 'return' && !(s && s.status === 'active')) { let n = 0; const iv = setInterval(async () => { n++; await loadOverview(); if ((S.ov.subscription || {}).status === 'active') { clearInterval(iv); toast('Your plan is active'); go('#/subscription'); } else if (n > 20) { clearInterval(iv); if ($('retN')) $('retN').textContent = 'We have not had confirmation from PayFast yet. If you were charged, it will show here shortly; nothing more is needed from you.'; } }, 4000); }
  }
  async function vSettings() {
    const ag = (await sb.from('agencies').select('*').eq('id', S.agency.agency_id).single()).data || {};
    shell('settings', 'Agency settings', '<form id="f" class="card grid g2" novalidate>' + agencyForm(ag) + '<p class="small muted span2">Workspace ID: <b>' + esc(ag.slug) + '</b>. Created ' + fmtD(ag.created_at) + '.</p><div class="span2 row"><button class="btn primary">Save</button><p class="err" id="e"></p></div></form>');
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); await busy(ev.submitter, async () => { const r = await sb.from('agencies').update(d).eq('id', S.agency.agency_id).select('id'); if (r.error || !r.data.length) return ($('e').textContent = r.error ? friendly(r.error) : 'You do not have permission, or your workspace is read-only.'); toast('Saved'); await loadAll(); render(); }); };
  }
  async function vAudit() {
    const r = await sb.from('audit_logs').select('*').eq('agency_id', S.agency.agency_id).order('at', { ascending: false }).limit(200);
    const people = {}; ((await sb.rpc('team_members', { a: S.agency.agency_id })).data || []).forEach(m => people[m.user_id] = m.email);
    shell('audit', 'Audit log', '<p class="small muted">Every change to your agency, team, branding, subscription and properties. Entries cannot be edited or deleted.</p><div class="card tw" style="padding:0"><table class="t"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead><tbody>' + (r.data || []).map(a => '<tr><td>' + fmtDT(a.at) + '</td><td>' + esc(a.actor_user_id ? people[a.actor_user_id] || 'Former member or MRET' : 'System') + '</td><td>' + esc(a.action) + ' ' + esc(a.entity || '') + '</td><td class="small">' + esc(Object.entries(a.details || {}).map(([k, v]) => k + ': ' + (v && typeof v === 'object' && 'to' in v ? JSON.stringify(v.from) + ' to ' + JSON.stringify(v.to) : JSON.stringify(v))).join('; ').slice(0, 300)) + '</td></tr>').join('') + '</tbody></table></div>');
  }
  function vSoon(which) {
    const t = { landlords: 'Landlords', tenants: 'Tenants', leases: 'Leases', invoices: 'Invoices and payments' }[which] || 'Coming next';
    shell('soon/' + which, t, '<div class="card"><p>This module is in the next build phase of MRET RENT OS. It will use the properties you capture now, so nothing needs to be redone.</p><p class="small muted">Order of delivery: landlords, tenants, leases and mandates with rental invoicing; then payments, reconciliation, landlord statements and arrears; then maintenance, documents and automation.</p></div>');
  }
  async function vAccount() {
    await loadAll(); const p = S.profile || {}; const f = S.factors.filter(x => x.status === 'verified');
    shell('account', 'Account and security', '<div class="grid g2" style="align-items:start"><form id="pf" class="card grid" novalidate><h3>Your details</h3>' + field('First name', inp('first_name', p.first_name, ' maxlength="80"')) + field('Surname', inp('surname', p.surname, ' maxlength="80"')) + field('Mobile', inp('mobile', p.mobile, ' maxlength="13"')) + '<p class="small muted">Email: ' + esc(S.user.email) + '</p><div class="row"><button class="btn primary">Save</button><p class="err" id="e"></p></div></form>'
      + '<div class="card"><h3>Two-step sign-in</h3><p class="small ink2">Use an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password) for a second code when you sign in. Required for MRET administrators, recommended for agency owners.</p>' + (f.length ? '<p><span class="chip ok">On</span> since ' + fmtD(f[0].created_at) + '</p><button class="btn danger" id="mfaOff">Turn off</button>' : '<button class="btn primary" id="mfaOn">Set up</button>') + '<div id="mfaBox"></div></div></div>');
    $('pf').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); if (d.mobile) d.mobile = d.mobile.replace(/[\s-]/g, ''); if (d.mobile && !/^(\+27|0)[0-9]{9}$/.test(d.mobile)) return ($('e').textContent = 'Give a South African mobile number.'); await busy(ev.submitter, async () => { const r = await sb.from('user_profiles').update(d).eq('id', S.user.id); if (r.error) return ($('e').textContent = friendly(r.error)); toast('Saved'); }); };
    if ($('mfaOn')) $('mfaOn').onclick = () => mfaEnrol($('mfaBox'), () => render());
    if ($('mfaOff')) $('mfaOff').onclick = async () => { if (S.aal.currentLevel !== 'aal2') return mfaChallenge($('mfaBox'), () => render()); if (!confirm('Turn off two-step sign-in?')) return; const r = await sb.auth.mfa.unenroll({ factorId: f[0].id }); if (r.error) return toast(friendly(r.error)); toast('Two-step sign-in is off'); render(); };
  }
  async function mfaEnrol(box, done) {
    (S.factors || []).filter(x => x.status !== 'verified').forEach(x => sb.auth.mfa.unenroll({ factorId: x.id }));
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator ' + new Date().toISOString().slice(0, 10) });
    if (error) { box.innerHTML = '<p class="err">' + esc(friendly(error)) + '</p>'; return; }
    box.innerHTML = '<div style="margin-top:12px"><p class="small">Scan this with your authenticator app, then enter the 6-digit code.</p><img src="' + esc(data.totp.qr_code) + '" alt="QR code" width="180" height="180" style="background:#fff;border-radius:8px;padding:6px"><p class="small muted">Or enter this key: <code>' + esc(data.totp.secret) + '</code></p><div class="row"><input class="inp" id="mfaC" inputmode="numeric" maxlength="6" placeholder="123456" style="max-width:140px"><button class="btn primary" id="mfaV">Verify</button></div><p class="err" id="mfaE"></p></div>';
    $('mfaV').onclick = ev => busy(ev.target, async () => { const r = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: $('mfaC').value.trim() }); if (r.error) return ($('mfaE').textContent = 'That code did not work. Try the newest one.'); toast('Two-step sign-in is on'); await loadAll(); done(); });
  }
  function mfaChallenge(box, done) {
    const f = S.factors.find(x => x.status === 'verified');
    box.innerHTML = '<div style="margin-top:12px"><p class="small">Enter the 6-digit code from your authenticator app.</p><div class="row"><input class="inp" id="mfaC" inputmode="numeric" maxlength="6" placeholder="123456" style="max-width:140px"><button class="btn primary" id="mfaV">Continue</button></div><p class="err" id="mfaE"></p></div>';
    $('mfaV').onclick = ev => busy(ev.target, async () => { const r = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: $('mfaC').value.trim() }); if (r.error) return ($('mfaE').textContent = 'That code did not work.'); await loadAll(); done(); });
  }

  /* ---------------- super admin ---------------- */
  async function vAdmin(q) {
    if (!S.admin) return go('#/dashboard');
    const tab = q.get('t') || 'overview';
    const needMfa = S.aal.currentLevel !== 'aal2';
    const tabs = [['overview', 'Overview'], ['agencies', 'Agencies'], ['plans', 'Plans and pricing'], ['discounts', 'Discount codes'], ['requests', 'Demo and contact'], ['billing', 'Billing events'], ['settings', 'Platform settings']];
    const head = '<div class="row" style="margin-bottom:16px">' + tabs.map(([k, l]) => '<a class="btn sm' + (k === tab ? ' dark' : '') + '" href="#/admin?t=' + k + '">' + l + '</a>').join('') + '</div>' + (needMfa ? '<div class="notice warn" style="margin-bottom:16px">Changes to prices, plans, agencies and settings need two-step sign-in. <span id="mfaBox"></span> ' + (S.factors.some(f => f.status === 'verified') ? '<button class="btn sm" id="mfaGo">Enter code</button>' : '<a href="#/account">Set it up first</a>') + '</div>' : '');
    const body = { overview: adminOverview, agencies: adminAgencies, plans: adminPlans, discounts: adminDiscounts, requests: adminRequests, billing: adminBilling, settings: adminSettings }[tab] || adminOverview;
    shell('admin', 'MRET Technologies', head + '<div id="adm"><p class="muted">Loading...</p></div>');
    if ($('mfaGo')) $('mfaGo').onclick = () => mfaChallenge($('mfaBox'), () => render());
    await body($('adm'), q);
  }
  async function adminOverview(el) {
    const r = await sb.rpc('platform_overview'); if (r.error) { el.innerHTML = '<div class="notice bad">' + esc(friendly(r.error)) + '</div>'; return; } const o = r.data;
    el.innerHTML = '<div class="grid g4">' + kpi('Agencies', N(o.agencies), N(o.new_30d) + ' new in 30 days') + kpi('MRR', R0(o.mrr_cents), 'Monthly recurring, paying and past-due plans; annual plans divided by 12') + kpi('ARR', R0(o.arr_cents), 'MRR × 12') + kpi('ARPA', R0(o.arpa_cents), N(o.paying) + ' paying accounts') + '</div><div class="grid g4" style="margin-top:16px">' + kpi('Active', N(o.active), 'paid and current') + kpi('Trials', N(o.trialing), 'running now') + kpi('Past due / suspended', N(o.past_due) + ' / ' + N(o.suspended), 'need attention') + kpi('Collected, 30 days', R0(o.collected_30d_cents), 'confirmed subscription payments') + '</div><div class="grid g4" style="margin-top:16px">' + kpi('Platform users', N(o.users), 'active memberships') + kpi('Properties', N(o.properties), 'across all agencies') + kpi('Open invoices', N(o.open_invoices), 'checkouts not completed') + kpi('New requests', N(o.inbound_new), '<a href="#/admin?t=requests">demo and contact</a>') + '</div><div class="card" style="margin-top:16px"><h3>Subscriptions by plan</h3>' + (Object.keys(o.by_plan || {}).length ? Object.entries(o.by_plan).map(([k, v]) => '<span class="chip" style="margin-right:6px">' + esc(k) + ': ' + v + '</span>').join('') : '<p class="muted">None yet.</p>') + '<p class="small muted" style="margin-top:10px">Churn: ' + N(o.cancelled_30d) + ' cancellations in the last 30 days. Once-off fees are excluded from MRR.</p></div>';
  }
  async function adminAgencies(el, q) {
    const s = q.get('s') || ''; const r = await sb.rpc('platform_agencies', { q: s || null }); if (r.error) { el.innerHTML = '<div class="notice bad">' + esc(friendly(r.error)) + '</div>'; return; }
    el.innerHTML = '<div class="row" style="margin-bottom:10px"><input class="inp" id="as" value="' + esc(s) + '" placeholder="Search agency, ID or owner email" style="max-width:320px"></div><div class="card tw" style="padding:0"><table class="t"><thead><tr><th>Agency</th><th>Owner</th><th>Plan</th><th>Status</th><th class="n">Users</th><th class="n">Properties</th><th>Setup</th><th></th></tr></thead><tbody>' + r.data.map(a => '<tr><td><b>' + esc(a.trading_name) + '</b><div class="small muted">' + esc(a.slug) + ' · ' + fmtD(a.created_at) + '</div></td><td class="small">' + esc(a.owner_email) + '</td><td>' + esc(a.plan || '–') + (a.price_cents != null ? '<div class="small muted">' + R(a.price_cents) + ' ' + esc(a.cycle || '') + '</div>' : '') + '</td><td><span class="chip ' + (a.sub_status === 'active' ? 'ok' : a.sub_status === 'trialing' ? 'info' : a.sub_status ? 'warn' : '') + '">' + esc(a.sub_status || 'no plan') + '</span>' + (a.agency_status === 'suspended' ? ' <span class="chip bad">suspended</span>' : '') + '<div class="small muted">' + (a.trial_ends_at ? 'trial to ' + fmtD(a.trial_ends_at) : a.period_end ? 'to ' + fmtD(a.period_end) : '') + '</div></td><td class="n">' + a.users + '</td><td class="n">' + a.properties + '</td><td class="small">' + ['plan', 'branding', 'team', 'property', 'done'].filter(k => (a.onboarding || {})[k]).length + ' of 5</td><td class="n"><button class="btn sm" data-ext="' + a.agency_id + '">Extend trial</button> <button class="btn sm" data-sus="' + a.agency_id + ':' + (a.agency_status === 'suspended' ? 'active' : 'suspended') + '">' + (a.agency_status === 'suspended' ? 'Reactivate' : 'Suspend') + '</button></td></tr>').join('') + '</tbody></table></div><p class="small muted">This list shows commercial details only. Agency records (tenants, landlords, bank details) are visible only if the agency owner grants support access.</p>';
    let t; $('as').oninput = e => { clearTimeout(t); t = setTimeout(() => go('#/admin?t=agencies&s=' + encodeURIComponent(e.target.value)), 400); };
    document.querySelectorAll('[data-ext]').forEach(b => b.onclick = async () => { const d = prompt('Extend the trial by how many days (1 to 60)?', '7'); if (!d) return; const why = prompt('Reason (kept in the audit log)'); if (!why) return; const r2 = await sb.rpc('platform_extend_trial', { a: b.dataset.ext, extra_days: Number(d), why }); toast(r2.error ? friendly(r2.error) : 'Trial extended'); if (!r2.error) render(); });
    document.querySelectorAll('[data-sus]').forEach(b => b.onclick = async () => { const [id, st] = b.dataset.sus.split(':'); const why = prompt((st === 'suspended' ? 'Suspend' : 'Reactivate') + ' this agency. Reason (kept in the audit log):'); if (!why) return; const r2 = await sb.rpc('platform_set_agency_status', { a: id, new_status: st, why }); toast(r2.error ? friendly(r2.error) : 'Done'); if (!r2.error) render(); });
  }
  async function adminPlans(el) {
    const plans = (await sb.from('subscription_plans').select('*, plan_features(*)').order('sort')).data || []; S.plans = null;
    el.innerHTML = plans.map(p => '<form class="card grid g4" data-plan="' + p.id + '"><div class="span2"><h3>' + esc(p.name) + ' <span class="chip">' + esc(p.code) + '</span></h3></div><label class="check"><input type="checkbox" name="active"' + (p.active ? ' checked' : '') + '> Available</label><label class="check"><input type="checkbox" name="is_public"' + (p.is_public ? ' checked' : '') + '> On the pricing page</label>'
      + field('Name', inp('name', p.name)) + field('Monthly price (R)', inp('monthly', p.monthly_price_cents != null ? p.monthly_price_cents / 100 : '', ' inputmode="decimal"')) + field('Yearly price (R)', inp('annual', p.annual_price_cents != null ? p.annual_price_cents / 100 : '', ' inputmode="decimal"')) + field('Description', inp('description', p.description))
      + field('Max users <span class="hint">blank = unlimited</span>', inp('max_users', p.max_users, ' type="number" min="1"')) + field('Max properties', inp('max_properties', p.max_properties, ' type="number" min="1"')) + field('Features <span class="hint">one per line</span>', '<textarea class="inp" name="features" rows="4">' + esc((p.plan_features || []).filter(f => f.enabled).map(f => f.label).join('\n')) + '</textarea>', 'span2') + '<div class="row" style="grid-column:1/-1"><button class="btn primary">Save ' + esc(p.name) + '</button><span class="small muted">Existing subscribers keep their locked price until they change plan.</span><p class="err"></p></div></form>').join('');
    el.querySelectorAll('form[data-plan]').forEach(f => f.onsubmit = async ev => { ev.preventDefault(); const d = formData(f), e = f.querySelector('.err'); const cents = v => v == null ? null : /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : NaN;
      const row = { name: d.name, description: d.description, monthly_price_cents: cents(d.monthly), annual_price_cents: cents(d.annual), max_users: d.max_users ? Number(d.max_users) : null, max_properties: d.max_properties ? Number(d.max_properties) : null, active: f.active.checked, is_public: f.is_public.checked };
      if (Number.isNaN(row.monthly_price_cents) || Number.isNaN(row.annual_price_cents)) return (e.textContent = 'Prices must be numbers such as 299 or 299.00.');
      await busy(ev.submitter, async () => { const r = await sb.from('subscription_plans').update(row).eq('id', f.dataset.plan).select('id'); if (r.error || !r.data.length) return (e.textContent = r.error ? friendly(r.error) : 'Not saved: two-step sign-in is needed for price changes.');
        const labels = (d.features || '').split('\n').map(x => x.trim()).filter(Boolean); const key = l => l.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'feature';
        await sb.from('plan_features').delete().eq('plan_id', f.dataset.plan); if (labels.length) { const seen = {}; const rows = labels.map(l => { let k = key(l); while (seen[k]) k = (k + '_x').slice(0, 40); seen[k] = 1; return { plan_id: f.dataset.plan, feature_key: k, label: l, enabled: true }; }); const r2 = await sb.from('plan_features').insert(rows); if (r2.error) return (e.textContent = friendly(r2.error)); }
        toast('Plan saved'); }); });
  }
  async function adminDiscounts(el) {
    const r = await sb.from('discount_codes').select('*').order('code');
    el.innerHTML = '<form id="dF" class="card grid g4" novalidate>' + field('Code', inp('code', '', ' maxlength="20" placeholder="LAUNCH20"')) + field('Percent off', inp('percent_off', '', ' type="number" min="1" max="100"')) + field('Or rand off', inp('amount_off', '', ' inputmode="decimal"')) + field('Valid until', inp('valid_until', '', ' type="date"')) + field('Max uses', inp('max_redemptions', '', ' type="number" min="1"')) + '<div style="align-self:end"><button class="btn primary">Add code</button></div><p class="err" id="e" style="grid-column:1/-1"></p><p class="small muted" style="grid-column:1/-1">Discounts apply to the first payment only.</p></form>'
      + '<div class="card tw" style="padding:0;margin-top:16px"><table class="t"><thead><tr><th>Code</th><th>Discount</th><th>Valid until</th><th class="n">Used</th><th></th></tr></thead><tbody>' + (r.data || []).map(c => '<tr><td><b>' + esc(c.code) + '</b></td><td>' + (c.percent_off ? c.percent_off + '%' : R(c.amount_off_cents)) + '</td><td>' + (c.valid_until ? fmtD(c.valid_until) : 'no end') + '</td><td class="n">' + c.redeemed + (c.max_redemptions ? ' of ' + c.max_redemptions : '') + '</td><td class="n"><button class="btn sm" data-tg="' + esc(c.code) + ':' + (!c.active) + '">' + (c.active ? 'Disable' : 'Enable') + '</button></td></tr>').join('') + '</tbody></table></div>';
    $('dF').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); const row = { code: (d.code || '').toUpperCase(), percent_off: d.percent_off ? Number(d.percent_off) : null, amount_off_cents: d.amount_off ? Math.round(Number(d.amount_off) * 100) : null, valid_until: d.valid_until, max_redemptions: d.max_redemptions ? Number(d.max_redemptions) : null };
      await busy(ev.submitter, async () => { const r2 = await sb.from('discount_codes').insert(row); if (r2.error) return ($('e').textContent = friendly(r2.error)); toast('Code added'); render(); }); };
    el.querySelectorAll('[data-tg]').forEach(b => b.onclick = async () => { const [c, v] = b.dataset.tg.split(':'); const r2 = await sb.from('discount_codes').update({ active: v === 'true' }).eq('code', c); toast(r2.error ? friendly(r2.error) : 'Updated'); render(); });
  }
  async function adminRequests(el) {
    const r = await sb.from('inbound_requests').select('*').order('created_at', { ascending: false }).limit(200);
    el.innerHTML = (r.data || []).length ? '<div class="card tw" style="padding:0"><table class="t"><thead><tr><th>When</th><th>Type</th><th>From</th><th>Company</th><th>Message</th><th>Status</th></tr></thead><tbody>' + r.data.map(x => '<tr><td>' + fmtDT(x.created_at) + '</td><td>' + esc(x.kind) + '</td><td>' + esc(x.name) + '<div class="small"><a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a> ' + esc(x.phone || '') + '</div></td><td>' + esc(x.company || '') + (x.properties_managed != null ? '<div class="small muted">' + x.properties_managed + ' properties</div>' : '') + '</td><td class="small">' + esc(x.message || '') + '</td><td><select class="inp" data-rq="' + x.id + '" style="min-height:32px;padding:4px">' + ['new', 'contacted', 'closed'].map(s => '<option' + (s === x.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">No demo or contact requests yet.</div>';
    el.querySelectorAll('[data-rq]').forEach(s => s.onchange = async () => { const r2 = await sb.from('inbound_requests').update({ status: s.value }).eq('id', s.dataset.rq); toast(r2.error ? friendly(r2.error) : 'Updated'); });
  }
  async function adminBilling(el) {
    const r = await sb.from('billing_events').select('*').order('received_at', { ascending: false }).limit(200);
    el.innerHTML = (r.data || []).length ? '<div class="card tw" style="padding:0"><table class="t"><thead><tr><th>Received</th><th>Provider</th><th>Event</th><th>Outcome</th><th class="n">Amount</th></tr></thead><tbody>' + r.data.map(x => '<tr><td>' + fmtDT(x.received_at) + '</td><td>' + esc(x.provider) + '</td><td class="small">' + esc(x.event_key) + '</td><td><span class="chip ' + (x.outcome === 'activated' ? 'ok' : /mismatch|bad|not_|unknown/.test(x.outcome) ? 'bad' : '') + '">' + esc(x.outcome) + '</span></td><td class="n">' + esc((x.payload || {}).amount_gross || '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">No payment notifications received yet.</div>';
  }
  async function adminSettings(el) {
    const r = await sb.from('platform_settings').select('*').order('key');
    const lab = { owner_email: 'Platform owner email', trial_days: 'Free trial length (days)', grace_days: 'Grace period after a failed payment (days)', vat_rate_bp: 'VAT rate (basis points, 1500 = 15%)', vat_registered: 'MRET Technologies is VAT registered (true/false)', require_admin_mfa: 'Require two-step sign-in for platform changes (true/false)' };
    el.innerHTML = '<div class="card grid">' + (r.data || []).map(s => '<form class="row" data-k="' + esc(s.key) + '"><label class="f" style="flex:1">' + esc(lab[s.key] || s.key) + inp('v', typeof s.value === 'string' ? s.value : JSON.stringify(s.value)) + '</label><button class="btn sm" style="align-self:end">Save</button></form>').join('') + '</div>';
    el.querySelectorAll('form[data-k]').forEach(f => f.onsubmit = async ev => { ev.preventDefault(); let v = f.v.value.trim(); let val; try { val = JSON.parse(v); } catch (e) { val = v; }
      const r2 = await sb.from('platform_settings').update({ value: val }).eq('key', f.dataset.k).select('key'); toast(r2.error ? friendly(r2.error) : r2.data.length ? 'Saved' : 'Not saved: two-step sign-in is needed'); });
  }

  /* ---------------- router ---------------- */
  async function render() {
    const { parts, q } = route(); const p0 = parts[0] || '';
    document.body.classList.remove('nav-open');
    if (p0 === 'invite' && parts[1]) return vInvite(parts[1]);
    if (!S.user) { if (p0 === 'register') return vRegister(q); if (p0 === 'verify') return vVerify(); if (p0 === 'forgot') return vForgot(); return vLogin(); }
    if (SS.get('rentos.invite') && p0 !== 'invite') return vInvite(SS.get('rentos.invite'));
    if (['login', 'register', 'verify', 'forgot', ''].includes(p0)) return go(S.agency ? (nextStep() && can('agency.manage') && !(S.agency.onboarding || {}).plan ? '#/onboarding' : '#/dashboard') : S.admin ? '#/admin' : '#/onboarding');
    if (p0 === 'admin') return vAdmin(q);
    if (p0 === 'portal' && window.RentOSPages) return window.RentOSPages.portal(q, parts);
    if (!S.agency && (S.portals || []).length && !S.admin && !['onboarding', 'account'].includes(p0)) return go('#/portal');
    if (p0 === 'invites') return (S.invites || []).length ? vPendingInvites(false) : go('#/dashboard');
    if (p0 === 'account') return vAccount();
    if (!S.agency || p0 === 'onboarding') { if (!S.agency && p0 !== 'onboarding') return go('#/onboarding'); return vOnboarding(); }
    try {
      if (p0 === 'dashboard') return await vDashboard();
      if (p0 === 'properties') return await vProperties(q);
      if (p0 === 'team') return await vTeam();
      if (p0 === 'branding' && can('branding.manage')) return await vBranding();
      if (p0 === 'subscription' && can('billing.manage')) return await vSubscription(q);
      if (p0 === 'settings' && can('agency.manage')) return await vSettings();
      if (p0 === 'audit' && can('audit.read')) return await vAudit();
      if (p0 === 'soon') return vSoon(parts[1]);
      if (window.RentOSPages && window.RentOSPages[p0] && p0 !== 'portal') return await window.RentOSPages[p0](q, parts);
      return go('#/dashboard');
    } catch (e) { shell('', 'Something went wrong', '<div class="notice bad">' + esc(friendly(e)) + '</div><p><a href="#/dashboard">Back to the dashboard</a></p>'); }
  }
  window.RentOS = { sb, S, C, $, esc, R, R0, N, fmtD, fmtDT, daysTo, shell, kpi, field, inp, formData, busy, toast, friendly, can, writable, go, render: () => render(), loadAll, authShell: (t, b, f) => authShell(t, b, f), PROVINCES: null };
  let booted = false;
  async function boot() {
    const qs = new URLSearchParams(location.search);
    if (qs.get('error_description')) { history.replaceState(null, '', location.pathname + location.hash); await loadAll(); if (!S.user) { $('root').innerHTML = authShell('Email verified', '<p>Your email address is confirmed. Log in to continue.</p><a class="btn primary" href="#/login">Log in</a>'); return; } }
    await loadAll();
    if (qs.get('reset') && S.user) { history.replaceState(null, '', location.pathname); return vNewPassword(); }
    if (qs.get('code')) history.replaceState(null, '', location.pathname + location.hash);
    if (!booted) { booted = true; window.addEventListener('hashchange', render); sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') vNewPassword(); if (ev === 'SIGNED_OUT') { S.user = null; } }); }
    render();
  }
  boot();
})();
