/* Canonical Studies Academy web app (Phases 1 and 2): accounts, onboarding, cohorts, dashboard, course map, lesson reader,
   notes and highlights, private journal, language centre, Bible, class page, profile and the founder's admin.
   Data access is enforced by row level security in Supabase; this file never holds secrets.
   Scripture text is only ever read from the database (World English Bible); nothing here generates it. */
(function () {
  'use strict';
  const C = window.ACADEMY_CONFIG;
  const sb = supabase.createClient(C.url, C.key, { auth: { storageKey: 'mret-academy', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  window.__academy = { sb };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const heb = s => s.replace(/([֐-׿][֐-׿\s־]*[֐-׿]|[֐-׿])/g, '<span class="heb">$1</span>');
  const paras = s => String(s || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => '<p>' + heb(esc(p)).replace(/\n/g, '<br>') + '</p>').join('');
  const TZ = 'Africa/Johannesburg';
  const fmtD = d => d ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(d)) : '';
  const fmtDS = d => d ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(d)) : '';
  const fmtDT = d => d ? new Intl.DateTimeFormat('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(new Date(d)) : '';
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const SS = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} } };
  let toastT; const toast = m => { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = m; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3200); };
  const friendly = e => { const m = (e && (e.message || e.error_description || e.msg)) || String(e); if (/row-level security|permission denied/i.test(m)) return 'You do not have permission to do that.'; if (/JWT|session/i.test(m) && /expired|invalid/i.test(m)) return 'Your session has expired. Please sign in again.'; if (/duplicate key/i.test(m)) return 'That already exists.'; if (/check constraint/i.test(m)) return 'One of the values is not valid. Please check the form.'; return m.replace(/^.*?ERROR:\s*/, ''); };
  const field = (label, html, cls) => '<label class="f' + (cls ? ' ' + cls : '') + '">' + label + html + '</label>';
  const inp = (name, v, attrs) => '<input class="inp" name="' + name + '" value="' + esc(v == null ? '' : v) + '"' + (attrs || '') + '>';
  const area = (name, v, attrs) => '<textarea class="inp" name="' + name + '"' + (attrs || '') + '>' + esc(v == null ? '' : v) + '</textarea>';
  const sel = (name, opts, v) => '<select class="inp" name="' + name + '">' + opts.map(o => { const [k, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(k) + '"' + (String(k) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
  const formData = f => { const o = {}; new FormData(f).forEach((v, k) => { v = String(v).trim(); o[k] = v === '' ? null : v; }); f.querySelectorAll('input[type=checkbox]').forEach(c => { o[c.name] = c.checked; }); return o; };
  const busy = async (btn, fn) => { if (btn) btn.disabled = true; try { return await fn(); } finally { if (btn) btn.disabled = false; } };
  const route = () => { const h = (location.hash || '#/').slice(2); const [path, qs] = h.split('?'); return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') }; };
  const go = h => { if (location.hash === h) render(); else location.hash = h; };
  const ic = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const I = {
    home: ic('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    course: ic('<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>'),
    journal: ic('<path d="M6 3h11a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-3 2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6"/>'),
    words: ic('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>'),
    bible: ic('<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h12M12 7v6M9.5 9.5h5"/>'),
    notes: ic('<path d="M7 4h10v17l-5-3-5 3z"/>'),
    cls: ic('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>'),
    user: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    admin: ic('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>'),
    menu: ic('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    sun: ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    lock: ic('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    tick: ic('<path d="M20 6L9 17l-5-5"/>'),
    more: ic('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>')
  };
  const S = { session: null, user: null, roles: [], profile: null, dash: null, courses: null, timer: null };
  const isStaff = () => S.roles.includes('founder') || S.roles.includes('lecturer');
  const isFounder = () => S.roles.includes('founder');
  const FOCUS = { teaching: 'Teaching', context: 'Historical context', language: 'Original languages', exegesis: 'Exegesis', assessment: 'Assessment', intensive: 'Intensive' };
  const DAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MODE = { cohort: 'Class calendar', catchup: 'Catch-up', self: 'Self-paced' };
  const JKIND = { reflection: 'Reflection', prayer: 'Prayer', meditation: 'Meditation', question: 'Question', obedience: 'Step of obedience', lesson: 'Lesson learned', goal: 'Goal', testimony: 'Testimony' };
  const SECTIONS = [['opening_prayer', 'Opening prayer'], ['teaching', 'Teaching'], ['historical', 'Historical context'], ['literary', 'Literary context'], ['language', 'Original language'], ['exegesis', 'Exegesis'], ['canonical', 'Canonical connections'], ['perspectives', 'Christian traditions'], ['errors', 'Common errors to avoid'], ['application', 'Application'], ['assignment', 'Assignment'], ['reflection', 'Reflection'], ['closing_prayer', 'Closing prayer'], ['next', 'Coming next']];
  const STATUS = { outline: ['Outline', ''], draft: ['Draft', 'warn'], in_review: ['In review', 'info'], published: ['Published', 'ok'] };

  /* ---------------- dialog helpers ---------------- */
  function dlg(title, body, foot) {
    const d = $('dlg'); d.innerHTML = '<div class="dh"><h3>' + esc(title) + '</h3><button class="icon-btn" data-x aria-label="Close">&times;</button></div><div class="db">' + body + '</div>' + (foot ? '<div class="df">' + foot + '</div>' : '');
    d.querySelector('[data-x]').onclick = () => d.close(); if (!d.open) d.showModal(); return d;
  }
  const confirmDlg = (title, msg, okLabel, danger) => new Promise(res => {
    const d = dlg(title, '<p>' + msg + '</p>', '<button class="btn" data-n>Cancel</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" data-y>' + esc(okLabel || 'Confirm') + '</button>');
    d.querySelector('[data-n]').onclick = () => { d.close(); res(false); }; d.querySelector('[data-y]').onclick = () => { d.close(); res(true); };
    d.addEventListener('close', () => res(false), { once: true });
  });

  /* ---------------- theme ---------------- */
  const THEMES = ['light', 'sepia', 'dark'];
  function cycleTheme() { const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); const nx = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]; document.documentElement.dataset.theme = nx; LS.set('academy.theme', nx); try { localStorage.setItem('academy.theme', nx); } catch (e) {} toast({ light: 'Light theme', sepia: 'Sepia theme', dark: 'Dark theme' }[nx]); }

  /* ---------------- boot ---------------- */
  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    S.session = session; S.user = session && session.user;
    if (S.user) {
      const b = await sb.rpc('ac_bootstrap');
      if (b.error) { $('root').innerHTML = authShell('Something went wrong', '<p class="err">' + esc(friendly(b.error)) + '</p><button class="btn" id="so">Sign out</button>'); $('so').onclick = signOut; return; }
      S.roles = b.data.roles || []; S.profile = b.data.profile || {};
      await loadDash();
    }
    render();
  }
  async function loadDash() { const r = await sb.rpc('ac_dashboard'); S.dash = r.data || { enrolled: false }; }
  async function signOut() { clearTimer(); await sb.auth.signOut(); S.user = null; S.roles = []; S.profile = null; S.dash = null; go('#/login'); }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { SS.set('academy.reset', '1'); go('#/new-password'); } });
  window.addEventListener('hashchange', render);

  // invitation links: /academy/app/?invite=CODE, #/join/CODE or #/register?invite=CODE
  (function captureInvite() {
    const u = new URL(location.href); const code = u.searchParams.get('invite'); if (code) { SS.set('academy.invite', code.toUpperCase()); u.searchParams.delete('invite'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    const r = route(); if (r.q.get('invite')) SS.set('academy.invite', r.q.get('invite').toUpperCase()); if (r.parts[0] === 'join' && r.parts[1]) SS.set('academy.invite', r.parts[1].toUpperCase());
  })();

  function render() {
    clearTimer();
    const r = route(); const p = r.parts; document.body.classList.remove('nav-open');
    if (p[0] === 'new-password') return vNewPassword();
    if (!S.user) {
      if (p[0] === 'register') return vRegister(); if (p[0] === 'forgot') return vForgot(); if (p[0] === 'magic') return vMagic(); if (p[0] === 'verify') return vVerify();
      if (p[0] === 'join') return vJoinPublic(); return vLogin();
    }
    if (!S.profile.onboarded_at && p[0] !== 'onboarding') return go('#/onboarding');
    if (p[0] === 'onboarding') return vOnboarding();
    const inv = SS.get('academy.invite'); if (inv && p[0] !== 'join') return go('#/join/' + encodeURIComponent(inv));
    const V = { join: vJoin, dashboard: vDashboard, course: vCourse, lesson: vLesson, journal: vJournal, notes: vNotes, words: vWords, bible: vBible, class: vClass, profile: vProfile, admin: vAdmin };
    const fn = V[p[0] || 'dashboard'] || vDashboard; fn(r);
  }

  /* ---------------- auth screens ---------------- */
  const BRAND = (light) => '<a class="brand" href="/academy/"' + (light ? ' style="color:#fff"' : '') + '><img class="seal" src="/academy/assets/icon.svg" alt=""><span>Canonical Studies<small>Academy</small></span></a>';
  const authShell = (title, body, foot) => '<div class="auth"><aside class="auth-art">' + BRAND(true) + '<div><blockquote>Your word is a lamp to my feet, and a light for my path.</blockquote><cite>PSALM 119:105, WORLD ENGLISH BIBLE</cite></div><div class="fine">Independent theological education. A certificate of completion is not an accredited qualification.</div></aside><div class="auth-main"><div class="auth-card"><div style="margin-bottom:22px">' + BRAND() + '</div><h2>' + title + '</h2>' + body + (foot ? '<p class="small muted" style="margin-top:22px">' + foot + '</p>' : '') + '</div></div></div>';
  const invNote = () => { const c = SS.get('academy.invite'); return c ? '<div class="notice info" style="margin-bottom:14px">You have an invitation to join a class (code ' + esc(c) + '). Sign in or create an account to accept it.</div>' : ''; };
  const google = () => C.google ? '<div class="ornament tiny">or</div><button class="btn lg" style="width:100%" id="gg" type="button">Continue with Google</button>' : '';
  const wireGoogle = () => { const g = $('gg'); if (g) g.onclick = () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: C.appUrl } }); };
  function vLogin() {
    $('root').innerHTML = authShell('Sign in', invNote() + '<form id="f" class="grid" novalidate>' + field('Email', inp('email', SS.get('academy.email') || '', ' type="email" autocomplete="email" required')) + field('Password', inp('password', '', ' type="password" autocomplete="current-password" required')) + '<button class="btn primary lg">Sign in</button><p class="err" id="e"></p></form>' + google() + '<div class="row between small" style="margin-top:14px"><a href="#/magic">Email me a sign-in link</a><a href="#/forgot">Forgot password?</a></div>', 'New here? <a href="#/register">Create an account</a>. <a href="/academy/">Back to the website</a>');
    wireGoogle();
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); $('e').textContent = ''; await busy(ev.submitter, async () => { const { error } = await sb.auth.signInWithPassword({ email: d.email || '', password: d.password || '' }); if (error) { $('e').textContent = /confirm/i.test(error.message) ? 'Please confirm your email first: open the link we sent you.' : /invalid/i.test(error.message) ? 'Email or password is incorrect.' : friendly(error); return; } await boot(); }); };
  }
  function vRegister() {
    $('root').innerHTML = authShell('Create your account', invNote() + '<form id="f" class="grid" novalidate>' + field('Full name', inp('full_name', '', ' autocomplete="name" required maxlength="120"')) + field('Email', inp('email', '', ' type="email" autocomplete="email" required')) + field('Password <span class="hint">at least 10 characters</span>', inp('password', '', ' type="password" autocomplete="new-password" required minlength="10"')) + '<label class="check"><input type="checkbox" name="consent"> <span>I agree to the <a href="/academy/terms/" target="_blank">terms of use</a> and the <a href="/academy/privacy/" target="_blank">privacy notice</a>, and I consent to the Academy processing my information to run my studies.</span></label><button class="btn primary lg">Create account</button><p class="err" id="e"></p></form>' + google(), 'Already have an account? <a href="#/login">Sign in</a>');
    wireGoogle();
    $('f').onsubmit = async ev => {
      ev.preventDefault(); const d = formData(ev.target), e = $('e'); e.textContent = '';
      if (!d.full_name) return (e.textContent = 'Please give your full name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) return (e.textContent = 'Please give a valid email address.');
      if ((d.password || '').length < 10) return (e.textContent = 'Use a password of at least 10 characters.');
      if (!d.consent) return (e.textContent = 'Please accept the terms and privacy notice to continue.');
      await busy(ev.submitter, async () => {
        const { data, error } = await sb.auth.signUp({ email: d.email, password: d.password, options: { emailRedirectTo: C.appUrl, data: { full_name: d.full_name, consent_at: new Date().toISOString() } } });
        if (error) return (e.textContent = /registered/i.test(error.message) ? 'An account with that email exists. Sign in instead.' : friendly(error));
        SS.set('academy.email', d.email);
        if (data.session) return boot();
        go('#/verify');
      });
    };
  }
  function vVerify() {
    const em = SS.get('academy.email') || '';
    $('root').innerHTML = authShell('Check your email', '<p>We sent a confirmation link to <b>' + esc(em || 'your email address') + '</b>. Open it to confirm your address and you will be signed in.</p><p class="muted small">Check your spam folder if it has not arrived in a few minutes.</p><div class="row"><button class="btn" id="rs">Send the link again</button><a class="btn primary" href="#/login">I have confirmed, sign in</a></div><p class="err" id="e"></p>');
    $('rs').onclick = ev => busy(ev.target, async () => { if (!em) return ($('e').textContent = 'Go back and register again.'); const { error } = await sb.auth.resend({ type: 'signup', email: em, options: { emailRedirectTo: C.appUrl } }); $('e').textContent = error ? friendly(error) : ''; if (!error) toast('Sent again'); });
  }
  function vMagic() {
    $('root').innerHTML = authShell('Sign in with a link', invNote() + '<p class="muted">We will email you a one-time link. Open it on this device to sign in.</p><form id="f" class="grid">' + field('Email', inp('email', SS.get('academy.email') || '', ' type="email" autocomplete="email" required')) + '<button class="btn primary lg">Email me a link</button><p class="err" id="e"></p></form>', '<a href="#/login">Sign in with a password instead</a>');
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); await busy(ev.submitter, async () => { const { error } = await sb.auth.signInWithOtp({ email: d.email || '', options: { emailRedirectTo: C.appUrl, shouldCreateUser: false } }); if (error && !/not found|signups/i.test(error.message)) return ($('e').textContent = friendly(error)); $('f').outerHTML = '<div class="notice ok">If an account exists for that address, a sign-in link is on its way.</div>'; }); };
  }
  function vForgot() {
    $('root').innerHTML = authShell('Reset your password', '<form id="f" class="grid">' + field('Email', inp('email', '', ' type="email" autocomplete="email" required')) + '<button class="btn primary lg">Send reset link</button><p class="err" id="e"></p></form>', '<a href="#/login">Back to sign in</a>');
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); await busy(ev.submitter, async () => { await sb.auth.resetPasswordForEmail(d.email || '', { redirectTo: C.appUrl + '#/new-password' }); $('f').outerHTML = '<div class="notice ok">If an account exists for that address, a reset link is on its way.</div>'; }); };
  }
  function vNewPassword() {
    $('root').innerHTML = authShell('Choose a new password', '<form id="f" class="grid">' + field('New password <span class="hint">at least 10 characters</span>', inp('password', '', ' type="password" autocomplete="new-password" required minlength="10"')) + '<button class="btn primary lg">Save password</button><p class="err" id="e"></p></form>');
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); if ((d.password || '').length < 10) return ($('e').textContent = 'Use at least 10 characters.'); await busy(ev.submitter, async () => { const { error } = await sb.auth.updateUser({ password: d.password }); if (error) return ($('e').textContent = friendly(error)); toast('Password changed'); SS.set('academy.reset', null); location.hash = '#/dashboard'; await boot(); }); };
  }
  async function vJoinPublic() {
    const code = SS.get('academy.invite') || ''; const { data } = await sb.rpc('ac_invite_preview', { code });
    if (!data) { SS.set('academy.invite', null); $('root').innerHTML = authShell('Invitation not found', '<p>That invitation code was not found. Check the link you were sent.</p><a class="btn" href="#/login">Sign in</a>'); return; }
    $('root').innerHTML = authShell('Join ' + esc(data.cohort), '<p>You are invited to <b>' + esc(data.course) + '</b>, running from ' + esc(fmtD(data.starts_on)) + (data.ends_on ? ' to ' + esc(fmtD(data.ends_on)) : '') + '.</p><div class="row"><a class="btn primary" href="#/register">Create an account</a><a class="btn" href="#/login">Sign in</a></div>');
  }

  /* ---------------- app shell ---------------- */
  const NAV = [['dashboard', 'Today', 'home'], ['course', 'Course', 'course'], ['journal', 'Journal', 'journal'], ['notes', 'Notes and bookmarks', 'notes'], ['words', 'Language centre', 'words'], ['bible', 'Bible', 'bible'], ['class', 'My class', 'cls'], ['profile', 'Profile', 'user']];
  function shell(title, body, actions) {
    const cur = route().parts[0] || 'dashboard';
    const nav = NAV.map(([k, l, i]) => '<a class="nv' + (cur === k ? ' on' : '') + '" href="#/' + k + '">' + I[i] + '<span>' + l + '</span></a>').join('') +
      (isStaff() ? '<div class="sg">Administration</div><a class="nv' + (cur === 'admin' ? ' on' : '') + '" href="#/admin">' + I.admin + '<span>Founder admin</span></a>' : '');
    const tabs = [['dashboard', 'Today', 'home'], ['course', 'Course', 'course'], ['journal', 'Journal', 'journal'], ['words', 'Words', 'words'], ['profile', 'More', 'more']];
    $('root').innerHTML = '<div class="shell"><aside class="side" aria-label="Main">' + BRAND(true) + nav + '<div class="foot">' + esc(S.profile.full_name || S.user.email) + '<br><a href="#" id="so">Sign out</a></div></aside><div class="main"><header class="top"><div class="row" style="gap:12px;flex-wrap:nowrap;min-width:0"><button class="icon-btn nav-btn" id="nb" aria-label="Menu">' + I.menu + '</button><h1>' + title + '</h1></div><div class="row" style="flex-wrap:nowrap">' + (actions || '') + '<button class="icon-btn" id="th" aria-label="Change theme" title="Light, sepia or dark">' + I.sun + '</button></div></header><div class="page" id="pg">' + body + '</div></div></div><nav class="tabbar" aria-label="Quick">' + tabs.map(([k, l, i]) => '<a class="' + (cur === k || (k === 'profile' && ['notes', 'bible', 'class', 'admin'].includes(cur)) ? 'on' : '') + '" href="#/' + (k === 'profile' ? 'profile' : k) + '">' + I[i] + l + '</a>').join('') + '</nav>';
    $('so').onclick = e => { e.preventDefault(); signOut(); };
    $('th').onclick = cycleTheme; $('nb').onclick = () => document.body.classList.toggle('nav-open');
    document.querySelector('.side').addEventListener('click', e => { if (e.target.closest('a.nv')) document.body.classList.remove('nav-open'); });
    window.scrollTo(0, 0);
  }
  const loading = t => shell(t, '<p class="muted">Loading...</p>');

  /* ---------------- onboarding ---------------- */
  async function vOnboarding() {
    const p = S.profile; const priv = (await sb.from('ac_profile_private').select('denomination').eq('user_id', S.user.id).maybeSingle()).data || {};
    $('root').innerHTML = '<div class="auth-main" style="min-height:100vh"><div class="card" style="width:min(680px,100%)"><div style="margin-bottom:10px">' + BRAND() + '</div><span class="eyebrow">Welcome</span><h2>Tell us how you will study</h2><p class="muted">This helps us show the right times and reminders. Only your name is required.</p>' +
      '<form id="f" class="grid g2">' + field('Full name', inp('full_name', p.full_name || S.user.user_metadata.full_name || '', ' required maxlength="120"'), 'span2') + field('Country', inp('country', p.country || 'South Africa', ' maxlength="80"')) + field('Time zone', sel('time_zone', ['Africa/Johannesburg', 'Africa/Harare', 'Africa/Lagos', 'Africa/Nairobi', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Australia/Sydney'], p.time_zone || 'Africa/Johannesburg')) +
      field('When will you usually study? <span class="hint">optional</span>', inp('schedule', p.schedule || '', ' maxlength="200" placeholder="For example: weekdays at 05:30"'), 'span2') +
      field('What do you hope to gain from this course? <span class="hint">optional</span>', area('objectives', p.objectives || '', ' maxlength="1000" rows="3"'), 'span2') +
      field('Previous theological study <span class="hint">optional</span>', inp('prior_education', p.prior_education || '', ' maxlength="200" placeholder="For example: none, Bible school, seminary"'), 'span2') +
      field('Denominational background <span class="hint">optional and private: only you can see this</span>', inp('denomination', priv.denomination || '', ' maxlength="120"'), 'span2') +
      '<label class="check span2"><input type="checkbox" name="show_in_cohort"' + (p.show_in_cohort !== false ? ' checked' : '') + '> <span>Show my name and general progress on my class list</span></label>' +
      '<label class="check span2"><input type="checkbox" name="email_reminders"' + (p.email_reminders !== false ? ' checked' : '') + '> <span>Send me course reminders by email</span></label>' +
      '<div class="span2 row"><button class="btn primary lg">Continue</button></div><p class="err span2" id="e"></p></form></div></div>';
    $('f').onsubmit = async ev => {
      ev.preventDefault(); const d = formData(ev.target); if (!d.full_name) return ($('e').textContent = 'Please give your name.');
      await busy(ev.submitter, async () => {
        const up = { full_name: d.full_name, country: d.country, time_zone: d.time_zone, schedule: d.schedule, objectives: d.objectives, prior_education: d.prior_education, show_in_cohort: d.show_in_cohort, email_reminders: d.email_reminders, onboarded_at: new Date().toISOString() };
        const r = await sb.from('ac_profiles').update(up).eq('user_id', S.user.id); if (r.error) return ($('e').textContent = friendly(r.error));
        if (d.denomination || priv.denomination) await sb.from('ac_profile_private').upsert({ user_id: S.user.id, denomination: d.denomination, updated_at: new Date().toISOString() });
        Object.assign(S.profile, up); go(SS.get('academy.invite') ? '#/join/' + SS.get('academy.invite') : '#/dashboard');
      });
    };
  }

  /* ---------------- joining a class ---------------- */
  async function vJoin(r) {
    const code = (r.parts[1] || SS.get('academy.invite') || '').toUpperCase(); loading('Join a class');
    const { data } = await sb.rpc('ac_invite_preview', { code });
    if (!data) { SS.set('academy.invite', null); return shell('Join a class', '<div class="card"><p>That invitation code was not found.</p>' + joinForm() + '</div>', ''), wireJoinForm(); }
    shell('Join a class', '<div class="card" style="max-width:640px"><span class="eyebrow">Invitation</span><h2>' + esc(data.cohort) + '</h2><p>' + esc(data.course) + ', ' + esc(fmtD(data.starts_on)) + (data.ends_on ? ' to ' + esc(fmtD(data.ends_on)) : '') + '. Lessons open at 06:00 South African time, Monday to Friday.</p>' +
      (new Date(data.starts_on) < new Date(today()) ? '<div class="notice info" style="margin-bottom:14px">This class has already started. You will join in catch-up mode: every lesson released so far is open to you, and you can work through them at your own pace.</div>' : '') +
      (data.open ? '<div class="row"><button class="btn primary lg" id="jn">Join this class</button><button class="btn" id="nn">Not now</button></div>' : '<div class="notice warn">This class is not taking new students.</div>') + '<p class="err" id="e"></p></div>');
    const nn = $('nn'); if (nn) nn.onclick = () => { SS.set('academy.invite', null); go('#/dashboard'); };
    const jn = $('jn'); if (jn) jn.onclick = ev => busy(ev.target, async () => { const x = await sb.rpc('ac_join_cohort', { code }); if (x.error) return ($('e').textContent = friendly(x.error)); SS.set('academy.invite', null); await loadDash(); toast('Welcome to the class'); go('#/dashboard'); });
  }
  const joinForm = () => '<form id="jf" class="row" style="margin-top:12px"><input class="inp" name="code" placeholder="Invitation code" style="max-width:220px;text-transform:uppercase" maxlength="20" required><button class="btn primary">Join</button></form>';
  const wireJoinForm = () => { const f = $('jf'); if (f) f.onsubmit = ev => { ev.preventDefault(); const c = formData(ev.target).code; if (c) go('#/join/' + encodeURIComponent(c.toUpperCase())); }; };

  /* ---------------- dashboard ---------------- */
  async function loadCourses() { if (S.courses) return S.courses; const r = await sb.from('ac_courses').select('id, slug, title, subtitle, weeks, lessons_per_week, is_published').order('sort'); S.courses = r.data || []; return S.courses; }
  async function vDashboard() {
    loading('Today'); await loadDash(); const D = S.dash; const first = (S.profile.full_name || '').split(' ')[0];
    if (!D.enrolled) {
      const cs = (await loadCourses()).filter(c => c.is_published);
      shell('Today', '<h2>Welcome' + (first ? ', ' + esc(first) : '') + '</h2><div class="grid g2"><div class="card"><span class="eyebrow">Join a class</span><h3>Study with the founding class</h3><p class="muted">Enter the invitation code you were given, for example FOUNDING.</p>' + joinForm() + '</div>' +
        cs.map(c => '<div class="card"><span class="eyebrow">Study on your own</span><h3>' + esc(c.title) + '</h3><p class="muted">' + esc(c.subtitle || '') + '. Self-paced: each lesson opens when you finish the one before.</p><button class="btn" data-enrol="' + c.id + '">Start self-paced</button></div>').join('') + '</div>' + staffNote());
      wireJoinForm();
      document.querySelectorAll('[data-enrol]').forEach(b => b.onclick = ev => busy(ev.target, async () => { const x = await sb.rpc('ac_enrol_self', { course: b.dataset.enrol }); if (x.error) return toast(friendly(x.error)); await loadDash(); go('#/course'); }));
      return;
    }
    const [map, ann] = await Promise.all([sb.rpc('ac_course_map', { course: D.course.id }), sb.from('ac_announcements').select('title, body, created_at').order('created_at', { ascending: false }).limit(3)]);
    const M = map.data || []; const weeks = {}; M.forEach(l => { const w = weeks[l.week_no] = weeks[l.week_no] || { n: 0, d: 0, open: 0 }; w.n++; if (l.completed_at) w.d++; if (l.is_open) w.open++; });
    const curWeek = D.next ? D.next.week : (Object.keys(weeks).filter(k => weeks[k].open).pop() || 1);
    const behind = M.filter(l => l.is_open && !l.completed_at).length;
    const upcoming = M.find(l => !l.is_open && l.opens_at && new Date(l.opens_at) > new Date());
    const nextCard = D.next ? '<div class="card next-card"><span class="eyebrow">' + (D.mode === 'self' ? 'Your next lesson' : 'Up next') + '</span><h2>' + esc(D.next.title) + '</h2><p class="muted">Week ' + D.next.week + ', lesson ' + D.next.seq + ' of ' + D.lessons_total + '</p><a class="btn gold lg" href="#/lesson/' + D.next.id + '">Open the lesson</a></div>'
      : '<div class="card next-card"><span class="eyebrow">Up next</span><h2>' + (D.lessons_done >= D.lessons_total ? 'Course complete' : 'You are up to date') + '</h2><p class="muted">' + (upcoming ? 'The next lesson opens ' + esc(fmtDT(upcoming.opens_at)) + '.' : 'New lessons appear here as soon as they are released.') + '</p><a class="btn gold" href="#/course">See the course</a></div>';
    shell('Today', '<p class="muted" style="margin-top:-6px">' + (first ? 'Grace and peace, ' + esc(first) + '. ' : '') + esc(D.course.title) + ' <span class="pill gold">' + esc(MODE[D.mode]) + '</span></p>' +
      '<div class="grid" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:16px" id="dg">' + nextCard +
      '<div class="grid g2"><div class="card kpi"><div class="l">Lessons</div><div class="v">' + D.lessons_done + '<span class="muted" style="font-size:18px"> / ' + D.lessons_total + '</span></div><div class="bar"><i style="width:' + D.pct + '%"></i></div></div><div class="card kpi"><div class="l">Hours studied</div><div class="v">' + (Math.round(D.minutes / 6) / 10) + '</div><div class="small muted">of ' + D.lessons_total + ' scheduled</div></div><div class="card kpi"><div class="l">Study days</div><div class="v">' + D.study_days_14 + '</div><div class="small muted">in the last 14 days</div></div><div class="card kpi"><div class="l">Open to do</div><div class="v">' + behind + '</div><div class="small muted">' + (behind > 5 ? 'catch up gently, one a day' : 'released, not yet finished') + '</div></div></div></div>' +
      '<div class="card" style="margin-top:16px"><div class="row between"><h3 style="margin:0">Your 24 weeks</h3><a class="small" href="#/course">Open the course map</a></div><div class="weeks" style="margin-top:14px">' + Array.from({ length: D.course.weeks }, (_, i) => { const w = weeks[i + 1] || { n: 5, d: 0 }; const done = w.n && w.d === w.n; return '<a class="wk-cell' + (done ? ' done' : '') + (String(i + 1) === String(curWeek) ? ' now' : '') + '" href="#/course?w=' + (i + 1) + '" title="Week ' + (i + 1) + ': ' + w.d + ' of ' + w.n + ' lessons"><i style="height:' + (w.n ? w.d / w.n * 100 : 0) + '%"></i><span style="position:relative">' + (i + 1) + '</span></a>'; }).join('') + '</div></div>' +
      ((ann.data || []).length ? '<div class="card" style="margin-top:16px"><h3>Announcements</h3>' + ann.data.map(a => '<div class="note-item"><b>' + esc(a.title) + '</b> <span class="tiny muted">' + esc(fmtDS(a.created_at)) + '</span><div class="small" style="margin-top:4px">' + paras(a.body) + '</div></div>').join('') + '</div>' : '') + staffNote());
    if (matchMedia('(max-width: 900px)').matches) $('dg').style.gridTemplateColumns = '1fr';
  }
  const staffNote = () => isStaff() ? '<div class="notice info" style="margin-top:16px">You are signed in as ' + (isFounder() ? 'the founder' : 'a lecturer') + '. Lessons still being prepared are visible to you but not to students. <a href="#/admin">Open the founder admin</a>.</div>' : '';

  /* ---------------- course map ---------------- */
  async function vCourse(r) {
    loading('Course'); await loadDash();
    let cid = S.dash.enrolled ? S.dash.course.id : null;
    if (!cid && isStaff()) { const cs = await loadCourses(); cid = cs[0] && cs[0].id; }
    if (!cid) return shell('Course', '<div class="card empty">You are not enrolled yet. <a href="#/dashboard">Join a class or start self-paced</a>.</div>');
    const m = await sb.rpc('ac_course_map', { course: cid }); if (m.error) return shell('Course', '<p class="err">' + esc(friendly(m.error)) + '</p>');
    const W = {}; (m.data || []).forEach(l => (W[l.week_no] = W[l.week_no] || { title: l.week_title, ls: [] }).ls.push(l));
    const mode = S.dash.mode;
    const body = '<div class="row between" style="margin-bottom:18px"><p class="muted" style="margin:0">' + (mode === 'self' ? 'Self-paced: each lesson opens when you complete the one before it.' : mode ? 'Lessons open at 06:00 South African time on their day. Released lessons stay open.' : '') + '</p>' + (S.dash.enrolled ? '<div class="seg" role="group" aria-label="Study mode"><button data-m="cohort" class="' + (mode !== 'self' ? 'on' : '') + '">Class calendar</button><button data-m="self" class="' + (mode === 'self' ? 'on' : '') + '">Self-paced</button></div>' : '') + '</div>' +
      Object.keys(W).map(n => '<section class="wk" id="w' + n + '"><h3><span class="n">Week ' + n + '</span>' + esc(W[n].title) + '</h3><div class="ls">' + W[n].ls.map(l => {
        const st = l.completed_at ? 'done' : l.is_open ? 'open' : 'locked';
        const sub = DAY[l.day_no] + ', ' + FOCUS[l.focus] + (l.readings ? ' &middot; ' + l.readings_done + '/' + l.readings + ' readings' : '');
        const right = l.completed_at ? '<span class="pill ok">Completed</span>' : l.is_open ? (l.status !== 'published' ? '<span class="pill warn">' + STATUS[l.status][0] + ' (staff view)</span>' : '<span class="pill gold">Open</span>') : l.status !== 'published' ? '<span class="pill">Being prepared</span>' : l.opens_at ? '<span class="pill">Opens ' + esc(fmtDS(l.opens_at)) + '</span>' : '<span class="pill">' + I.lock.replace('<svg', '<svg width="12" height="12"') + ' Finish the previous lesson</span>';
        const inner = '<span class="dot">' + (l.completed_at ? I.tick.replace('<svg', '<svg width="15" height="15"') : l.seq) + '</span><span><span class="t">' + esc(l.title) + '</span><br><span class="s">' + sub + '</span></span>' + right;
        return l.is_open ? '<a class="li ' + st + '" href="#/lesson/' + l.lesson_id + '">' + inner + '</a>' : '<div class="li ' + st + '">' + inner + '</div>';
      }).join('') + '</div></section>').join('');
    shell('Course', '<h2 style="margin-bottom:4px">' + esc(S.dash.enrolled ? S.dash.course.title : 'Course structure') + '</h2>' + body);
    document.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => { if (b.classList.contains('on')) return; const ok = await confirmDlg(b.dataset.m === 'self' ? 'Study self-paced?' : 'Follow the class calendar?', b.dataset.m === 'self' ? 'Each lesson will open when you complete the one before it, instead of on its release date. You can switch back at any time.' : 'Lessons will open on the class calendar. Anything already released stays open.', 'Switch'); if (!ok) return; const x = await sb.rpc('ac_set_mode', { course: cid, m: b.dataset.m }); if (x.error) return toast(friendly(x.error)); toast('Study mode: ' + MODE[x.data]); render(); });
    const w = r.q.get('w') || (S.dash.next && S.dash.next.week); if (w && $('w' + w)) $('w' + w).scrollIntoView({ block: 'start' });
  }

  /* ---------------- lesson reader ---------------- */
  function clearTimer() { if (S.timer) { clearInterval(S.timer.iv); S.timer.save && S.timer.save(); S.timer = null; } document.querySelectorAll('.hl-pop').forEach(x => x.remove()); }
  async function passageHtml(refs) {
    const rs = await Promise.all(refs.map(ref => sb.rpc('ac_passage', { ref })));
    return refs.map((ref, i) => { const v = rs[i].data || []; if (!v.length) return '<div class="ref">' + esc(ref) + '</div><p class="small muted">This reference could not be found.</p>'; let ch = null; return '<div class="ref">' + esc(ref) + '</div><p>' + v.map(x => { const lab = (ch !== x.chapter && v[0].chapter !== v[v.length - 1].chapter) ? x.chapter + ':' + x.verse : x.verse; ch = x.chapter; return '<sup>' + lab + '</sup>' + esc(x.text) + ' '; }).join('') + '</p>'; }).join('');
  }
  async function vLesson(r) {
    const lid = r.parts[1]; loading('Lesson');
    const L = (await sb.from('ac_lessons').select('id, course_id, week_id, seq, day_no, focus, title, minutes, objectives, readings, memory_verse, status, ai_assisted, reviewed_at').eq('id', lid).maybeSingle()).data;
    if (!L) return shell('Lesson', '<div class="card empty">That lesson was not found.</div>');
    const c = await sb.rpc('ac_lesson_content', { lid });
    const wk = (await sb.from('ac_weeks').select('week_no, title').eq('id', L.week_id).maybeSingle()).data || {};
    if (c.error) return shell('Lesson ' + L.seq, '<div class="card" style="max-width:640px"><span class="eyebrow">Week ' + esc(wk.week_no) + ', lesson ' + L.seq + '</span><h2>' + esc(L.title) + '</h2><p class="muted">' + (L.status !== 'published' ? 'This lesson is still being prepared. It will appear here once it has been reviewed and released.' : 'This lesson is not open for you yet.') + '</p><a class="btn" href="#/course">Back to the course</a></div>');
    const K = c.data || {};
    const [prog, notes, nav] = await Promise.all([
      sb.from('ac_lesson_progress').select('*').eq('user_id', S.user.id).eq('lesson_id', lid).maybeSingle(),
      sb.from('ac_notes').select('*').eq('lesson_id', lid).order('created_at'),
      sb.from('ac_lessons').select('id, seq').eq('course_id', L.course_id).in('seq', [L.seq - 1, L.seq + 1])]);
    const P = prog.data || { readings_done: [], minutes: 0, position: 0 }; const N = notes.data || [];
    const prev = (nav.data || []).find(x => x.seq === L.seq - 1), next = (nav.data || []).find(x => x.seq === L.seq + 1);
    const bm = N.find(n => n.kind === 'bookmark');
    const secHtml = SECTIONS.filter(([k]) => K[k]).map(([k, lab]) => '<div class="sec-t">' + lab + '<span class="sec-tools"><button data-note="' + k + '" title="Add a note to this section">Note</button></span></div><div class="txt' + (k.endsWith('prayer') ? ' prayer' : '') + '" data-sec="' + k + '">' + paras(K[k]) + '</div>').join('');
    const refs = (K.references || []).length ? '<div class="sec-t">Further reading</div><ul class="refs">' + K.references.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '';
    const staffBar = isStaff() && L.status !== 'published' ? '<div class="notice warn no-print" style="margin-bottom:16px"><b>' + STATUS[L.status][0] + '.</b> Students cannot see this lesson yet.' + (L.ai_assisted ? ' It was prepared with AI assistance and needs your review.' : '') + ' <a href="#/admin/lesson/' + L.id + '">Review and publish</a></div>' : '';
    const done = !!P.completed_at;
    const body = staffBar + '<div class="reader"><article class="lesson" id="art"><div class="meta"><span class="pill gold">Week ' + esc(wk.week_no) + ' &middot; ' + DAY[L.day_no] + '</span><span class="pill">' + FOCUS[L.focus] + '</span><span class="pill">About ' + L.minutes + ' minutes</span>' + (done ? '<span class="pill ok">Completed</span>' : '') + '<button class="pill gold m-only no-print" id="toR" style="border:0;cursor:pointer">Go to readings</button></div><h1>' + esc(L.title) + '</h1>' +
      (L.objectives.length ? '<div class="sec-t">By the end of this lesson you should be able to</div><ul class="obj">' + L.objectives.map(o => '<li>' + esc(o) + '</li>').join('') + '</ul>' : '') + secHtml + refs +
      (L.ai_assisted ? '<p class="disclaimer">This lesson was drafted with the help of AI tools and reviewed by the Academy before release. Scripture is quoted from the World English Bible. If you notice an error, please tell us.</p>' : '<p class="disclaimer">Scripture is quoted from the World English Bible.</p>') +
      '<div class="row between no-print" style="margin-top:26px">' + (prev ? '<a class="btn" href="#/lesson/' + prev.id + '">Previous lesson</a>' : '<span></span>') + '<div class="row">' + (done ? '<button class="btn" id="undo">Mark as not complete</button>' : '<button class="btn primary lg" id="cmp">Complete this lesson</button>') + (next ? '<a class="btn" href="#/lesson/' + next.id + '">Next lesson</a>' : '') + '</div></div></article>' +
      '<aside class="panel no-print"><div class="card"><h4>Today\'s readings</h4>' + (L.readings.length ? L.readings.map(x => '<label class="chk"><input type="checkbox" data-rd="' + esc(x) + '"' + (P.readings_done.includes(x) ? ' checked' : '') + '> <span>' + esc(x) + '</span><button class="btn ghost sm" data-show="' + esc(x) + '">Read</button></label>').join('') : '<p class="small muted">No set readings today.</p>') +
      (L.memory_verse ? '<div style="margin-top:12px" class="small"><b>Memory verse:</b> <a href="#" data-show="' + esc(L.memory_verse) + '">' + esc(L.memory_verse) + '</a></div>' : '') + '</div>' +
      '<div class="card scripture" id="scr"><p class="small muted" style="font-family:var(--sans)">Loading Scripture...</p></div>' +
      '<div class="card" id="pwc"><h4>Pronounce a word</h4><form id="pwf" class="row" style="flex-wrap:nowrap;gap:6px"><input class="inp" name="w" id="pwi" placeholder="Type or paste a word" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Word to pronounce" maxlength="60"><button class="btn primary">Pronounce</button></form><div id="pwr"></div><p class="tiny muted" style="margin:10px 0 0">Greek, Hebrew or an English spelling, such as a name. Tip: select a word in the lesson and choose Pronounce.</p></div>' +
      '<div class="card"><div class="row between"><h4 style="margin:0">Your notes</h4><div class="row" style="gap:4px"><button class="btn sm" id="bm">' + (bm ? 'Bookmarked' : 'Bookmark') + '</button><button class="btn sm" id="an">Add note</button></div></div><div id="nl"></div><p class="tiny muted" style="margin-top:10px">Select any text in the lesson to highlight it. Only you can see your notes and highlights.</p></div>' +
      '<div class="card row between"><span class="small">Text size</span><div class="row" style="gap:4px"><button class="btn sm" data-fs="-1" aria-label="Smaller text">A-</button><button class="btn sm" data-fs="1" aria-label="Larger text">A+</button><button class="btn sm" onclick="window.print()">Print</button></div></div></aside></div>';
    shell('Lesson ' + L.seq, body);
    LS.set('academy.last', { id: L.id, seq: L.seq, title: L.title });
    const art = $('art');
    $('toR').onclick = () => document.querySelector('.panel').scrollIntoView({ behavior: 'smooth' });
    // Scripture panel
    const show = async refsArr => { $('scr').innerHTML = await passageHtml(refsArr); };
    show(L.readings.length ? L.readings : L.memory_verse ? [L.memory_verse] : []).then(() => { if (!L.readings.length && !L.memory_verse) $('scr').innerHTML = '<p class="small muted">No Scripture set for today.</p>'; });
    document.querySelectorAll('[data-show]').forEach(b => b.onclick = e => { e.preventDefault(); show([b.dataset.show]); if (matchMedia('(max-width: 1100px)').matches) $('scr').scrollIntoView({ behavior: 'smooth' }); });
    // progress saving
    const base = P.minutes || 0; const t0 = Date.now(); let active = 0, last = Date.now();
    const mins = () => Math.min(1440, base + Math.round(active / 60000));
    const save = async extra => { const row = Object.assign({ user_id: S.user.id, lesson_id: lid, readings_done: P.readings_done, minutes: mins(), position: Math.round(scrollPct()), updated_at: new Date().toISOString() }, extra || {}); if (P.completed_at && !('completed_at' in (extra || {}))) row.completed_at = P.completed_at; const x = await sb.from('ac_lesson_progress').upsert(row); if (x.error) toast(friendly(x.error)); return x; };
    const scrollPct = () => { const h = document.documentElement.scrollHeight - innerHeight; return h > 0 ? Math.max(0, Math.min(100, scrollY / h * 100)) : 0; };
    S.timer = { iv: setInterval(() => { const n = Date.now(); if (document.visibilityState === 'visible' && n - last < 90000) active += n - last; last = n; if ((n - t0) % 120000 < 15000 && active > 30000) save(); }, 15000), save: () => { if (active > 30000) save(); } };
    ['scroll', 'pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { const n = Date.now(); if (document.visibilityState === 'visible' && n - last < 90000) active += n - last; last = n; }, { passive: true }));
    if (P.position > 3) setTimeout(() => { const h = document.documentElement.scrollHeight - innerHeight; scrollTo(0, h * P.position / 100); toast('Back where you left off'); }, 60);
    document.querySelectorAll('[data-rd]').forEach(ch => ch.onchange = async () => { const k = ch.dataset.rd; P.readings_done = ch.checked ? Array.from(new Set(P.readings_done.concat(k))) : P.readings_done.filter(x => x !== k); await save(); });
    const cmp = $('cmp'); if (cmp) cmp.onclick = ev => busy(ev.target, async () => {
      if (L.readings.length && P.readings_done.length < L.readings.length) { const ok = await confirmDlg('Complete without all the readings?', 'You have ticked ' + P.readings_done.length + ' of ' + L.readings.length + ' readings. The readings are the heart of each lesson.', 'Complete anyway'); if (!ok) return; }
      const now = new Date().toISOString(); const x = await save({ completed_at: now, minutes: Math.max(mins(), 1) }); if (x.error) return; P.completed_at = now;
      const d = dlg('Lesson complete', '<p>Well done. Take a moment to write what you learned while it is fresh.</p>' + (K.reflection ? '<blockquote class="note-item" style="border:0"><blockquote>' + esc(K.reflection.split(/\n\s*\n/)[0]) + '</blockquote></blockquote>' : ''), '<button class="btn" data-l>Later</button><a class="btn primary" href="#/journal/new?lesson=' + lid + '">Write a reflection</a>' + (next ? '<a class="btn" href="#/lesson/' + next.id + '">Next lesson</a>' : ''));
      d.querySelector('[data-l]').onclick = () => { d.close(); render(); }; d.querySelectorAll('a').forEach(a => a.onclick = () => d.close());
    });
    const undo = $('undo'); if (undo) undo.onclick = ev => busy(ev.target, async () => { await save({ completed_at: null }); P.completed_at = null; render(); });
    // font size
    document.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => { const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--read')) || 19; const nx = Math.max(15, Math.min(28, cur + Number(b.dataset.fs) * 2)); document.documentElement.style.setProperty('--read', nx + 'px'); try { localStorage.setItem('academy.read', nx); } catch (e) {} });
    // notes, highlights, bookmark
    const drawNotes = () => {
      const items = N.filter(n => n.kind !== 'bookmark');
      $('nl').innerHTML = items.length ? items.map(n => '<div class="note-item">' + (n.quote ? '<blockquote>' + esc(n.quote) + '</blockquote>' : '') + (n.body ? '<div class="small">' + esc(n.body) + '</div>' : '') + '<div class="row between tiny muted" style="margin-top:4px"><span>' + esc((SECTIONS.find(s => s[0] === n.section) || [0, n.kind === 'highlight' ? 'Highlight' : 'Note'])[1]) + '</span><button class="btn ghost sm" data-del="' + n.id + '">Remove</button></div></div>').join('') : '<p class="small muted" style="margin:8px 0 0">No notes yet.</p>';
      $('nl').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { const x = await sb.from('ac_notes').delete().eq('id', b.dataset.del); if (x.error) return toast(friendly(x.error)); const i = N.findIndex(n => n.id === b.dataset.del); N.splice(i, 1); paint(); drawNotes(); });
    };
    const paint = () => {
      art.querySelectorAll('mark.hl').forEach(m => m.replaceWith(document.createTextNode(m.textContent))); art.normalize();
      N.filter(n => n.quote && n.section).forEach(n => { const el = art.querySelector('[data-sec="' + n.section + '"]'); if (!el) return; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { const i = t.data.indexOf(n.quote); if (i >= 0) { const rg = document.createRange(); rg.setStart(t, i); rg.setEnd(t, i + n.quote.length); const m = document.createElement('mark'); m.className = 'hl'; rg.surroundContents(m); break; } } });
    };
    const addNote = async (kind, section, quote, body) => { const x = await sb.from('ac_notes').insert({ lesson_id: lid, kind, section, quote, body }).select().single(); if (x.error) return toast(friendly(x.error)); N.push(x.data); paint(); drawNotes(); toast(kind === 'highlight' ? 'Highlighted' : 'Note saved'); };
    const noteDlg = (section, quote) => { const d = dlg('Add a note', (quote ? '<blockquote class="note-item" style="border:0"><blockquote>' + esc(quote) + '</blockquote></blockquote>' : '') + '<form id="nf" class="grid">' + area('body', '', ' rows="5" maxlength="8000" placeholder="Write your thought, question or response"') + '</form>', '<button class="btn" data-c>Cancel</button><button class="btn primary" data-s>Save note</button>'); d.querySelector('[data-c]').onclick = () => d.close(); d.querySelector('[data-s]').onclick = async () => { const b = d.querySelector('textarea').value.trim(); if (!b && !quote) return; d.close(); await addNote(quote ? 'highlight' : 'note', section, quote, b || null); }; d.querySelector('textarea').focus(); };
    paint(); drawNotes();
    // Greek and Hebrew words from the word list become tappable: tap to hear and practise them
    const vocP = sb.from('ac_vocab').select('lemma, language, translit, gloss, syll, pron_note, audio_url, verified').then(r => r.data || []);
    const showPron = async (text, speak) => {
      const w = pronLookup(text, await vocP); const box = $('pwr'); if (!box) return;
      if (!w) { box.innerHTML = '<p class="small muted" style="margin:10px 0 0">Type a word to hear it.</p>'; return; }
      const nat = PR.hasNative(w.language);
      box.innerHTML = '<div class="pw-res">' + (w.language !== 'english' ? lmHtml(w, 'pw-lem') : '<div class="pw-lem">' + esc(w.lemma) + '</div>') +
        '<div class="row" style="gap:6px;margin:6px 0">' + (w.source === 'list' ? '<span class="pill ok">From the word list</span>' + (w.verified ? '' : '<span class="pill warn">Under review</span>') : w.source === 'auto' ? '<span class="pill warn">Automatic guide</span>' : '<span class="pill">English voice</span>') + '</div>' +
        (w.source === 'list' ? '<div class="small"><b>' + esc(w.translit) + '</b>: ' + esc(w.gloss) + '</div>' : '') + ((w.syll || []).length ? '<div class="pr-syl" style="margin:8px 0">' + sylHtml(w) + '</div>' : '') +
        (PR.can() ? '<div class="row" style="gap:6px;flex-wrap:wrap">' + (w.unpointed ? '' : '<button class="btn sm primary" data-pw="normal">' + SPK + ' Listen</button><button class="btn sm" data-pw="slow">Slowly</button>') + ((w.syll || []).length ? '<button class="btn sm" data-pw="syll">Syllables</button>' : '') + (nat ? '<button class="btn sm" data-pw="native">' + (w.language === 'greek' ? 'Modern Greek voice' : 'Hebrew voice') + '</button>' : '') + (w.language !== 'english' && !w.unpointed ? '<button class="btn sm ghost" data-pw="practise">Practise</button>' : '') + '</div>' : '<p class="tiny muted">This browser cannot speak aloud; follow the written guide.</p>') +
        (w.pron_note && w.source !== 'list' ? '<p class="tiny muted" style="margin:8px 0 0">' + esc(w.pron_note) + '</p>' : '') + '</div>';
      box.querySelectorAll('[data-pw]').forEach(b => b.onclick = () => b.dataset.pw === 'practise' ? practise([w]) : PR.play(w, b.dataset.pw));
      if (speak && PR.can() && !w.unpointed) PR.play(w, 'normal');
    };
    $('pwf').onsubmit = e => { e.preventDefault(); showPron($('pwi').value, true); };
    vocP.then(data => {
      const W = (data || []).filter(w => w.lemma); if (!W.length) return;
      const by = {}; W.forEach(w => { by[w.lemma.normalize('NFC')] = w; });
      const pat = Object.keys(by).sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const test = new RegExp(pat), split = new RegExp('(' + pat + ')');
      art.querySelectorAll('.txt').forEach(sec => {
        const tw = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT); const nodes = []; let t;
        while ((t = tw.nextNode())) if (test.test(t.data.normalize('NFC')) && !t.parentElement.closest('.pron-w')) nodes.push(t);
        nodes.forEach(n => { const frag = document.createDocumentFragment(); n.data.normalize('NFC').split(split).forEach((part, k) => { if (k % 2) { const b = document.createElement('button'); b.type = 'button'; b.className = 'pron-w'; b.dataset.w = part; b.title = 'Hear how to say ' + by[part].translit; b.textContent = part; frag.appendChild(b); } else if (part) frag.appendChild(document.createTextNode(part)); }); n.replaceWith(frag); });
      });
      art.addEventListener('click', e => { const b = e.target.closest('.pron-w'); if (b && by[b.dataset.w]) practise([by[b.dataset.w]]); });
    });
    $('an').onclick = () => noteDlg(null, null);
    art.querySelectorAll('[data-note]').forEach(b => b.onclick = () => noteDlg(b.dataset.note, null));
    $('bm').onclick = async ev => busy(ev.target, async () => { const b = N.find(n => n.kind === 'bookmark'); if (b) { await sb.from('ac_notes').delete().eq('id', b.id); N.splice(N.indexOf(b), 1); ev.target.textContent = 'Bookmark'; toast('Bookmark removed'); } else { const x = await sb.from('ac_notes').insert({ lesson_id: lid, kind: 'bookmark' }).select().single(); if (!x.error) { N.push(x.data); ev.target.textContent = 'Bookmarked'; toast('Bookmarked'); } } });
    const pop = document.createElement('div'); pop.className = 'hl-pop card'; pop.style.cssText = 'position:fixed;z-index:50;padding:6px;display:none;gap:4px;border-radius:999px'; pop.innerHTML = '<button class="btn sm gold" data-h>Highlight</button><button class="btn sm" data-n>Note</button><button class="btn sm" data-sp>Pronounce</button>'; document.body.appendChild(pop);
    let pick = null;
    const onSel = () => setTimeout(() => {
      const s = getSelection(); const q = s && String(s).trim(); if (!q || q.length > 1500 || (q.length < 3 && !/[\u0370-\u03ff\u1f00-\u1fff\u0590-\u05ff]/.test(q))) { pop.style.display = 'none'; return; }
      const a = s.anchorNode && s.anchorNode.parentElement && s.anchorNode.parentElement.closest('[data-sec]'), f = s.focusNode && s.focusNode.parentElement && s.focusNode.parentElement.closest('[data-sec]');
      if (!a || a !== f || s.anchorNode !== s.focusNode) { pop.style.display = 'none'; return; }
      pick = { section: a.dataset.sec, quote: q }; pop.querySelector('[data-sp]').style.display = /^\S{1,40}$/.test(q.replace(/[.,;:!?"'()\[\]“”‘’]/g, '')) ? '' : 'none'; const rc = s.getRangeAt(0).getBoundingClientRect(); pop.style.display = 'flex'; pop.style.top = Math.max(8, rc.top - 52) + 'px'; pop.style.left = Math.min(innerWidth - 200, Math.max(8, rc.left + rc.width / 2 - 90)) + 'px';
    }, 10);
    document.addEventListener('pointerdown', e => { if (!pop.contains(e.target)) pop.style.display = 'none'; });
    art.addEventListener('mouseup', onSel); art.addEventListener('touchend', onSel); addEventListener('scroll', () => { pop.style.display = 'none'; }, { passive: true });
    pop.querySelector('[data-h]').onclick = async () => { pop.style.display = 'none'; if (pick) { getSelection().removeAllRanges(); await addNote('highlight', pick.section, pick.quote, null); } };
    pop.querySelector('[data-sp]').onclick = () => { pop.style.display = 'none'; if (!pick) return; getSelection().removeAllRanges(); $('pwi').value = pick.quote.replace(/[.,;:!?"'()\[\]“”‘’]/g, ''); showPron(pick.quote, true); $('pwc').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    pop.querySelector('[data-n]').onclick = () => { pop.style.display = 'none'; if (pick) { getSelection().removeAllRanges(); noteDlg(pick.section, pick.quote); } };
  }

  /* ---------------- journal ---------------- */
  async function vJournal(r) {
    const id = r.parts[1];
    if (id) return vJournalEdit(id, r.q.get('lesson'));
    loading('Journal');
    const kind = r.q.get('k') || ''; const qy = r.q.get('q') || '';
    let qb = sb.from('ac_journal').select('id, kind, title, body, created_at, lesson_id').order('created_at', { ascending: false }).limit(200);
    if (kind) qb = qb.eq('kind', kind); if (qy) qb = qb.or('title.ilike.%' + qy.replace(/[%,()]/g, '') + '%,body.ilike.%' + qy.replace(/[%,()]/g, '') + '%');
    const { data } = await qb; const E = data || [];
    shell('Journal', '<div class="notice info" style="margin-bottom:16px">Your journal is private. It is protected in the database so that only you can read it, not the founder, lecturers or classmates.</div>' +
      '<form id="jf" class="row" style="margin-bottom:16px"><input class="inp" name="q" value="' + esc(qy) + '" placeholder="Search your journal" style="max-width:280px">' + sel('k', [['', 'All entries']].concat(Object.entries(JKIND)), kind).replace('class="inp"', 'class="inp" style="max-width:200px"') + '<button class="btn">Search</button></form>' +
      (E.length ? '<div class="grid">' + E.map(e => '<a class="card flat" style="text-decoration:none;color:inherit;display:block" href="#/journal/' + e.id + '"><div class="row between"><b style="font-family:var(--serif);font-size:20px">' + esc(e.title || JKIND[e.kind]) + '</b><span class="pill">' + esc(JKIND[e.kind]) + '</span></div><div class="small muted">' + esc(fmtD(e.created_at)) + '</div><p class="small" style="margin:8px 0 0">' + esc(e.body.slice(0, 220)) + (e.body.length > 220 ? '...' : '') + '</p></a>').join('') + '</div>' : '<div class="card empty">No entries yet. Write your first reflection, prayer or question.</div>'),
      '<a class="btn primary" href="#/journal/new">New entry</a>');
    $('jf').onsubmit = ev => { ev.preventDefault(); const d = formData(ev.target); const p = new URLSearchParams(); if (d.q) p.set('q', d.q); if (d.k) p.set('k', d.k); go('#/journal' + (p.toString() ? '?' + p : '')); };
  }
  async function vJournalEdit(id, lessonId) {
    loading('Journal'); const isNew = id === 'new';
    const E = isNew ? { kind: lessonId ? 'reflection' : 'reflection', title: '', body: '', lesson_id: lessonId || null } : (await sb.from('ac_journal').select('*').eq('id', id).maybeSingle()).data;
    if (!E) return shell('Journal', '<div class="card empty">Entry not found.</div>');
    let lt = null; if (E.lesson_id) lt = (await sb.from('ac_lessons').select('seq, title').eq('id', E.lesson_id).maybeSingle()).data;
    if (isNew && lt) E.title = 'Lesson ' + lt.seq + ': ' + lt.title;
    shell(isNew ? 'New journal entry' : 'Journal entry', '<form id="f" class="card grid" style="max-width:820px">' + (lt ? '<div class="small muted">Linked to lesson ' + lt.seq + ': <a href="#/lesson/' + E.lesson_id + '">' + esc(lt.title) + '</a></div>' : '') +
      '<div class="grid g2">' + field('Kind of entry', sel('kind', Object.entries(JKIND), E.kind)) + field('Title <span class="hint">optional</span>', inp('title', E.title, ' maxlength="200"')) + '</div>' + field('Entry', area('body', E.body, ' rows="14" maxlength="20000" required style="font:400 18px/1.7 var(--serif)"')) +
      '<div class="row between"><div class="row"><button class="btn primary">Save</button><a class="btn" href="#/journal">Back</a></div>' + (isNew ? '' : '<button class="btn danger" type="button" id="del">Delete entry</button>') + '</div><p class="err" id="e"></p>' + (isNew ? '' : '<p class="tiny muted">Written ' + esc(fmtDT(E.created_at)) + (E.updated_at !== E.created_at ? ', edited ' + esc(fmtDT(E.updated_at)) : '') + '</p>') + '</form>');
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); if (!d.body) return ($('e').textContent = 'Write something first.'); await busy(ev.submitter, async () => {
      const row = { kind: d.kind, title: d.title, body: d.body, lesson_id: E.lesson_id || null, updated_at: new Date().toISOString() };
      const x = isNew ? await sb.from('ac_journal').insert(row).select('id').single() : await sb.from('ac_journal').update(row).eq('id', id).select('id').single();
      if (x.error) return ($('e').textContent = friendly(x.error)); toast('Saved'); go('#/journal/' + x.data.id); }); };
    const del = $('del'); if (del) del.onclick = async () => { if (!(await confirmDlg('Delete this entry?', 'This journal entry will be removed for good. It cannot be recovered.', 'Delete', true))) return; const x = await sb.from('ac_journal').delete().eq('id', id); if (x.error) return toast(friendly(x.error)); toast('Deleted'); go('#/journal'); };
  }

  /* ---------------- notes and bookmarks ---------------- */
  async function vNotes() {
    loading('Notes and bookmarks');
    const { data } = await sb.from('ac_notes').select('id, kind, section, quote, body, created_at, lesson_id, ac_lessons(seq, title)').order('created_at', { ascending: false }).limit(500);
    const Nn = data || []; const bms = Nn.filter(n => n.kind === 'bookmark'), rest = Nn.filter(n => n.kind !== 'bookmark');
    shell('Notes and bookmarks', '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:16px" id="ng"><div class="card"><h3>Bookmarks</h3>' + (bms.length ? bms.map(b => '<div class="note-item"><a href="#/lesson/' + b.lesson_id + '">Lesson ' + esc(b.ac_lessons && b.ac_lessons.seq) + ': ' + esc(b.ac_lessons && b.ac_lessons.title) + '</a></div>').join('') : '<p class="small muted">Bookmark a lesson to find it here.</p>') + '</div>' +
      '<div class="card"><h3>Notes and highlights</h3>' + (rest.length ? rest.map(n => '<div class="note-item">' + (n.quote ? '<blockquote>' + esc(n.quote) + '</blockquote>' : '') + (n.body ? '<div class="small">' + esc(n.body) + '</div>' : '') + '<div class="tiny muted" style="margin-top:4px">' + (n.lesson_id ? '<a href="#/lesson/' + n.lesson_id + '">Lesson ' + esc(n.ac_lessons && n.ac_lessons.seq) + '</a> &middot; ' : '') + esc(fmtDS(n.created_at)) + '</div></div>').join('') : '<p class="small muted">Select text in any lesson to highlight it or add a note.</p>') + '</div></div>');
    if (matchMedia('(max-width: 900px)').matches) $('ng').style.gridTemplateColumns = '1fr';
  }

  /* ---------------- pronunciation ----------------
     The written syllable guide is the teaching standard (Erasmian Greek, Israeli-based Hebrew). The audio is the device's own
     speech voice reading that guide, so it is a helper, not an authority. A recorded human file (audio_url) is preferred when present.
     "Record yourself" keeps the recording in this browser only; nothing is uploaded. */
  const PR = {
    ok: typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined',
    voices: [],
    load() { if (!this.ok) return; const set = () => { this.voices = speechSynthesis.getVoices() || []; }; set(); try { speechSynthesis.addEventListener('voiceschanged', set); } catch (e) {} },
    guide() { return this.voices.find(v => /^en[-_](ZA|GB)/i.test(v.lang)) || this.voices.find(v => /^en/i.test(v.lang)) || null; },
    native(lang) { const p = lang === 'greek' ? /^el/i : /^(he|iw)/i; return this.voices.find(v => p.test(v.lang)) || null; },
    say(text, o) { o = o || {}; return new Promise(res => { if (!this.ok) return res(); const u = new SpeechSynthesisUtterance(text); const v = o.voice || this.guide(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB'; u.rate = o.rate || 0.85; u.pitch = o.pitch || 1; u.volume = o.volume == null ? 1 : o.volume; let done = false; const fin = () => { if (!done) { done = true; res(); } }; u.onend = fin; u.onerror = fin; setTimeout(fin, 8000); speechSynthesis.speak(u); }); },
    stop() { if (this.ok) speechSynthesis.cancel(); if (this.audio) { this.audio.pause(); this.audio = null; } },
    stressed: s => /[A-Z]/.test(s) && s === s.toUpperCase(),
    async play(w, mode) {
      this.stop(); const syl = w.syll || [];
      if (mode === 'normal' && w.audio_url) { this.audio = new Audio(w.audio_url); return this.audio.play().catch(() => {}); }
      if (!this.cloudOff) { try { if (await cloudPlay(w, mode)) return; } catch (e) { /* network trouble: use the device voice */ } }
      if (!this.ok) { toast('Sound is not available on this device right now. Follow the written guide: the part in capitals is stressed.'); return; }
      if (mode === 'native') { const v = this.native(w.language); return v ? this.say(w.lemma, { voice: v, rate: 0.7 }) : null; }
      if (!syl.length) return this.say(w.translit, { rate: mode === 'slow' ? 0.5 : 0.85 });
      if (mode === 'syll') { for (const s of syl) { const st = this.stressed(s); await this.say(s.toLowerCase(), { rate: 0.55, pitch: st ? 1.3 : 0.9, volume: st ? 1 : 0.75 }); await new Promise(r => setTimeout(r, 260)); } return; }
      return this.say(syl.map(s => s.toLowerCase()).join(mode === 'slow' ? ' ' : '-'), { rate: mode === 'slow' ? 0.5 : 0.85 });
    }
  };
  PR.load();
  // human-sounding neural voice from the server (Google), with the device voice as the fallback
  PR.cloudOff = !C.voice || !C.functionsUrl; const VC = {}; let warned = false;
  PR.can = () => PR.ok || !PR.cloudOff;
  PR.hasNative = lang => lang !== 'english' && (!PR.cloudOff || !!PR.native(lang));
  async function cloudPlay(w, mode) {
    const lang = w.language === 'english' ? 'english' : w.language === 'greek' ? 'greek' : 'hebrew';
    const body = mode === 'native' ? { mode, lang, word: w.lemma } : lang === 'english' ? { mode: mode === 'slow' ? 'slow' : 'normal', lang, word: w.translit } : (w.syll || []).length ? { mode, lang, syll: w.syll } : null;
    if (!body) return false;
    const k = JSON.stringify(body); let url = VC[k];
    if (!url) {
      const { data: { session } } = await sb.auth.getSession(); if (!session) return false;
      const r = await fetch(C.functionsUrl + '/ac-voice', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.key, Authorization: 'Bearer ' + session.access_token }, body: k });
      let j = {}; try { j = await r.json(); } catch (e) {}
      if (!r.ok || !j.url) { if (r.status === 503) PR.cloudOff = true; if (!warned && r.status !== 503) { warned = true; toast(j.message || 'Using your device voice for now.'); } return false; }
      url = VC[k] = j.url;
    }
    await new Promise(res => { const a = new Audio(url); PR.audio = a; a.onended = res; a.onerror = res; a.play().catch(res); });
    return true;
  }
  const sylHtml = w => (w.syll && w.syll.length) ? '<span class="syl" aria-label="Say it: ' + esc(w.syll.join('-')) + '">' + w.syll.map(s => PR.stressed(s) ? '<b>' + esc(s) + '</b>' : esc(s)).join('<i>&middot;</i>') + '</span>' : '';
  const lmHtml = (w, cls) => '<span class="' + (cls || 'lm') + (w.language !== 'greek' ? ' heb' : '') + '"' + (w.language !== 'greek' ? ' dir="rtl" lang="he"' : ' lang="grc"') + '>' + esc(w.lemma) + '</span>';
  const SPK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  // practice card for one word (or a run of words when list is given)
  function practise(list, start) {
    let i = start || 0, rec = null, mine = null, chunks = [], stopT;
    const nat = w => PR.hasNative(w.language);
    const draw = () => {
      const w = list[i]; PR.stop();
      const body = '<div class="pr-card"><div class="center">' + lmHtml(w, 'lem') + '<div class="small muted" style="margin-top:6px">' + esc(w.translit) + (w.gloss ? ' &middot; ' + esc(w.gloss) : '') + '</div><div class="pr-syl">' + (sylHtml(w) || '<span class="muted small">No guide yet</span>') + '</div>' + (w.pron_note ? '<p class="small" style="max-width:420px;margin:0 auto 12px">' + esc(w.pron_note) + '</p>' : '') + '</div>' +
        (PR.can() ? '<div class="pr-btns"><button class="btn primary" data-p="normal">' + SPK + ' Listen</button><button class="btn" data-p="slow">Slowly</button>' + ((w.syll || []).length ? '<button class="btn" data-p="syll">Syllable by syllable</button>' : '') + (nat(w) ? '<button class="btn" data-p="native">' + (w.language === 'greek' ? 'Modern Greek voice' : 'Hebrew voice') + '</button>' : '') + '</div>' : '<div class="notice warn small">This browser cannot speak aloud. Follow the syllable guide: the part in capitals is stressed.</div>') +
        '<div class="pr-rec"><b class="small">Your turn</b><p class="tiny muted" style="margin:2px 0 8px">Say the word aloud, slowly, then at normal speed. Record yourself to compare. Your recording stays on this device and is never uploaded.</p><div class="row"><button class="btn" id="rc">Record myself</button><button class="btn" id="pm" disabled>Play mine</button><button class="btn" id="cmp2" disabled>Guide, then mine</button></div><p class="err" id="re"></p></div>' +
        '<p class="tiny muted" style="margin-top:12px">The voice reads the syllable guide; where they differ, trust the written guide.' + (nat(w) ? ' The ' + (w.language === 'greek' ? 'modern Greek' : 'modern Hebrew') + ' voice uses today\'s pronunciation, which differs in places from the academic system taught here.' : '') + (w.verified || w.auto ? '' : ' This entry is still under review by the Academy.') + '</p></div>';
      const d = dlg(list.length > 1 ? 'Pronunciation ' + (i + 1) + ' of ' + list.length : 'Pronunciation', body, (list.length > 1 ? '<button class="btn" data-prev' + (i === 0 ? ' disabled' : '') + '>Previous</button><button class="btn primary" data-next>' + (i === list.length - 1 ? 'Finish' : 'Next word') + '</button>' : '<button class="btn primary" data-done>Done</button>'));
      d.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { d.querySelectorAll('[data-p]').forEach(x => x.classList.remove('on')); b.classList.add('on'); await PR.play(w, b.dataset.p); b.classList.remove('on'); });
      const rc = d.querySelector('#rc'), pm = d.querySelector('#pm'), c2 = d.querySelector('#cmp2'), re = d.querySelector('#re');
      const playMine = () => new Promise(res => { if (!mine) return res(); const a = new Audio(mine); a.onended = res; a.onerror = res; a.play().catch(res); });
      if (mine) { pm.disabled = false; c2.disabled = false; }
      rc.onclick = async () => {
        if (rec && rec.state === 'recording') { rec.stop(); return; }
        if (!navigator.mediaDevices || !window.MediaRecorder) { re.textContent = 'Recording is not supported in this browser.'; return; }
        try {
          PR.stop(); const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = []; rec = new MediaRecorder(stream);
          rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
          rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearTimeout(stopT); if (mine) URL.revokeObjectURL(mine); mine = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); rc.textContent = 'Record again'; rc.classList.remove('rec'); pm.disabled = false; c2.disabled = false; };
          rec.start(); rc.textContent = 'Stop'; rc.classList.add('rec'); re.textContent = ''; stopT = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 6000);
        } catch (e) { re.textContent = 'Microphone access was not allowed, so recording is off. You can still practise aloud.'; }
      };
      pm.onclick = playMine;
      c2.onclick = async () => { await PR.play(w, 'normal'); await new Promise(r => setTimeout(r, 400)); await playMine(); };
      const clean = () => { PR.stop(); if (rec && rec.state === 'recording') rec.stop(); };
      const nx = d.querySelector('[data-next]'), pv = d.querySelector('[data-prev]'), dn = d.querySelector('[data-done]');
      if (nx) nx.onclick = () => { clean(); if (mine) { URL.revokeObjectURL(mine); mine = null; } if (i < list.length - 1) { i++; draw(); } else d.close(); };
      if (pv) pv.onclick = () => { clean(); if (mine) { URL.revokeObjectURL(mine); mine = null; } i--; draw(); };
      if (dn) dn.onclick = () => { clean(); d.close(); };
      d.addEventListener('close', clean, { once: true });
    };
    draw();
  }

  /* automatic pronunciation guides for words not in the word list, worked out from the spelling.
     Greek: Erasmian values; stress from the accent mark. Hebrew: needs vowel points; stress is usually on the last syllable,
     on the one before when the word ends in a segol syllable or a furtive patach. Always labelled as automatic. */
  const GK_ONSET = new Set(['βδ', 'βλ', 'βρ', 'γλ', 'γν', 'γρ', 'δρ', 'θλ', 'θν', 'θρ', 'κλ', 'κν', 'κρ', 'κτ', 'μν', 'πλ', 'πν', 'πρ', 'πτ', 'σβ', 'σθ', 'σκ', 'σμ', 'σπ', 'στ', 'σφ', 'σχ', 'τμ', 'τρ', 'φθ', 'φλ', 'φρ', 'χθ', 'χλ', 'χρ', 'στρ', 'σκλ', 'σπλ']);
  const GK_C = { β: 'b', γ: 'g', δ: 'd', ζ: 'dz', θ: 'th', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', φ: 'f', χ: 'kh', ψ: 'ps' };
  const GK_V = { α: 'ah', ε: 'eh', η: 'ay', ι: 'ee', ο: 'oh', υ: 'oo', ω: 'oh', αι: 'eye', ει: 'ay', οι: 'oy', αυ: 'ow', ευ: 'yoo', ηυ: 'ayoo', ου: 'oo', υι: 'wee' };
  function autoGreek(word) {
    const d = word.normalize('NFD').toLowerCase(); const L = []; // letters with their marks
    for (const ch of d) { if (/[̀-ͯ]/.test(ch)) { if (L.length) L[L.length - 1].m += ch; } else if (/[α-ως]/.test(ch)) L.push({ c: ch, m: '' }); }
    if (!L.length) return null;
    const units = []; // {v:true, s, stress, rough} or {v:false, c}
    for (let i = 0; i < L.length; i++) {
      const a = L[i], b = L[i + 1];
      if ('αεηιουω'.includes(a.c)) {
        const pair = b && GK_V[a.c + b.c] && !/̈/.test(b.m) ? a.c + b.c : null;
        const marks = a.m + (pair ? b.m : '');
        units.push({ v: true, long: !!pair || a.c === 'ω' || a.c === 'η', s: GK_V[pair || a.c], stress: /[́̀͂]/.test(marks), rough: /̔/.test(marks) });
        if (pair) i++;
      } else if ((a.c === 'ξ' || a.c === 'ψ') && units.some(u => u.v) && b && 'αεηιουω'.includes(b.c)) { units.push({ v: false, c: a.c === 'ξ' ? 'κ' : 'π' }, { v: false, c: 'σ' }); }
      else units.push({ v: false, c: a.c });
    }
    const nuc = units.map((u, i) => u.v ? i : -1).filter(i => i >= 0); if (!nuc.length) return null;
    const syl = nuc.map(() => ({ on: [], v: null, coda: [] }));
    units.slice(0, nuc[0]).forEach(u => syl[0].on.push(u.c));
    nuc.forEach((n, k) => {
      syl[k].v = units[n];
      const next = nuc[k + 1], cl = units.slice(n + 1, next == null ? units.length : next).map(u => u.c);
      if (next == null) { syl[k].coda = cl; return; }
      let split = cl.length ? cl.length - 1 : 0; // keep the longest cluster that can begin a word with the next syllable
      for (let j = 0; j < cl.length - 1; j++) if (GK_ONSET.has(cl.slice(j).join(''))) { split = j; break; }
      syl[k].coda = cl.slice(0, split); syl[k + 1].on = cl.slice(split);
    });
    let stressed = syl.findIndex(s => s.v.stress); if (stressed < 0) stressed = Math.max(0, syl.length - 2);
    const conS = (c, nextC) => c === 'γ' && /[γκξχ]/.test(nextC || '') ? 'n' : GK_C[c] || '';
    return syl.map((s, k) => {
      let out = (s.v.rough && !s.on.length && k === 0 ? 'h' : '') + s.on.map((c, j) => conS(c, s.on[j + 1])).join('');
      let v = s.v.s; if (s.coda.length && !s.v.long) v = ({ ah: 'a', eh: 'e', ee: 'i', oh: 'o' })[v] || v; // short vowel in a closed syllable
      out += v + s.coda.map((c, j) => conS(c, s.coda[j + 1] || ((syl[k + 1] && syl[k + 1].on[0]) || ''))).join('');
      if (k === syl.length - 1 && /os$/i.test(out)) out += 's'; // "-oss", so it is not read as "-ose"
      return k === stressed ? out.toUpperCase() : out;
    });
  }
  function autoHebrew(word) {
    const d = word.normalize('NFD'); const L = [];
    for (const ch of d) { if (/[א-ת]/.test(ch)) L.push({ c: ch, m: '' }); else if (/[֑-ׇ]/.test(ch) && L.length) L[L.length - 1].m += ch; }
    if (!L.length) return null;
    const has = (x, re) => re.test(x.m);
    const V = m => /ַ|ָ|ֲ/.test(m) ? 'ah' : /ֳ/.test(m) ? 'oh' : /ֵ/.test(m) ? 'ay' : /ֶ|ֱ/.test(m) ? 'eh' : /ִ/.test(m) ? 'ee' : /ֻ/.test(m) ? 'oo' : /ֹ/.test(m) ? 'oh' : null;
    const C = (x, last) => {
      const dg = has(x, /ּ/); const c = x.c;
      if ('אע'.includes(c)) return ''; if (c === 'ה') return last && !dg ? '' : 'h';
      if (c === 'ש') return has(x, /ׂ/) ? 's' : 'sh';
      return ({ ב: dg ? 'b' : 'v', ג: 'g', ד: 'd', ו: 'v', ז: 'z', ח: 'kh', ט: 't', י: 'y', כ: dg ? 'k' : 'kh', ך: 'kh', ל: 'l', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's', פ: dg ? 'p' : 'f', ף: 'f', צ: 'ts', ץ: 'ts', ק: 'k', ר: 'r', ת: 't' })[c] || '';
    };
    const syl = []; let cur = null, furtive = false, segolEnd = false;
    for (let i = 0; i < L.length; i++) {
      const x = L[i], last = i === L.length - 1, prev = L[i - 1];
      // vav as a vowel letter: holem or shureq
      if (x.c === 'ו' && !V(x.m.replace(/ֹ/, '')) && (has(x, /ֹ/) || (has(x, /ּ/) && (!prev || !V(prev.m))))) {
        const vv = has(x, /ֹ/) ? 'oh' : 'oo';
        if (cur && !cur.v && cur.on !== null) cur.v = vv; else if (cur && !cur.v) cur.v = vv; else { cur = { on: '', v: vv, coda: '' }; syl.push(cur); }
        continue;
      }
      // yod after hireq, tsere or segol with no vowel of its own is a silent vowel letter
      if (x.c === 'י' && !V(x.m) && prev && /ִ|ֵ|ֶ/.test(prev.m)) continue;
      const v = V(x.m);
      if (last && v === 'ah' && /[חעה]/.test(x.c) && /ַ/.test(x.m) && syl.length) { furtive = true; syl.push({ on: '', v: 'a', coda: C(x, false) }); continue; }
      const vocalShewa = /ְ/.test(x.m) && (i === 0 || (prev && /ְ/.test(prev.m)));
      if (v || vocalShewa) { cur = { on: C(x, false), v: v || 'eh', coda: '' }; syl.push(cur); if (last && /ֶ/.test(x.m)) segolEnd = true; }
      else {
        const nx = L[i + 1];
        if (nx && nx.c === 'ו' && !V(nx.m.replace(/\u05b9/, '')) && /\u05b9|\u05bc/.test(nx.m)) { cur = { on: C(x, false), v: /\u05b9/.test(nx.m) ? 'oh' : 'oo', coda: '' }; syl.push(cur); i++; continue; }
        if (cur) cur.coda += C(x, last); else { cur = { on: C(x, last), v: null, coda: '' }; syl.push(cur); }
      }
    }
    const S = syl.filter(s => s.v).map(s => s.on + (s.coda && s.v === 'eh' ? 'e' : s.v) + s.coda); if (!S.length) return null;
    const segolate = S.length > 1 && syl.filter(s => s.v).slice(-1)[0].v === 'eh' && syl.filter(s => s.v).slice(-2)[0].v === 'eh';
    const st = S.length > 1 && (furtive || segolate || segolEnd) ? S.length - 2 : S.length - 1;
    return S.map((s, k) => k === st ? s.toUpperCase() : s);
  }
  const plain = s => String(s || '').normalize('NFD').replace(/[̀-֑ͯ-ׇ]/g, '').toLowerCase().trim();
  // find a word: the checked word list first, then an automatic guide
  function pronLookup(input, vocab) {
    const q = String(input || '').trim().split(/\s+/)[0].replace(/[.,;:!?"'()\[\]“”‘’]/g, ''); if (!q) return null;
    const hit = (vocab || []).find(w => w.lemma.normalize('NFC') === q.normalize('NFC') || plain(w.lemma) === plain(q) || plain(w.translit) === plain(q));
    if (hit) return Object.assign({ source: 'list' }, hit);
    if (/[Ͱ-Ͽἀ-῿]/.test(q)) { const s = autoGreek(q); return s && { lemma: q, language: 'greek', translit: s.join('-').toLowerCase(), gloss: '', syll: s, auto: true, source: 'auto', pron_note: 'Worked out from the spelling (Erasmian pronunciation). Check it against your grammar or lexicon.' }; }
    if (/[֐-׿]/.test(q)) {
      const pointed = /[ְ-ּ]/.test(q); const s = pointed ? autoHebrew(q) : [];
      return s && { lemma: q, language: 'hebrew', translit: pointed ? s.join('-').toLowerCase() : '', gloss: '', syll: s, auto: true, source: 'auto', unpointed: !pointed, pron_note: pointed ? 'Worked out from the spelling and vowel points. Hebrew stress varies, so check it against your grammar or lexicon.' : 'This word has no vowel points, so the vowels cannot be known from the spelling. Paste it with its vowel points for a reliable guide.' };
    }
    return { lemma: q, language: 'english', translit: q, gloss: '', syll: [], auto: true, source: 'english', pron_note: 'Read by your device\'s English voice. Syllable guides are worked out for Greek and Hebrew words.' };
  }
  window.__academy.pron = { autoGreek, autoHebrew, pronLookup };

  /* ---------------- language centre ---------------- */
  const ABC_GRK = [['Α α', 'alpha', 'a as in "father"'], ['Β β', 'beta', 'b'], ['Γ γ', 'gamma', 'g as in "go"; before γ, κ, ξ, χ it is "ng"'], ['Δ δ', 'delta', 'd'], ['Ε ε', 'epsilon', 'e as in "bet"'], ['Ζ ζ', 'zeta', 'dz as in "adze"'], ['Η η', 'eta', 'ay as in "obey"'], ['Θ θ', 'theta', 'th as in "thin"'], ['Ι ι', 'iota', 'i as in "machine" (long) or "pit" (short)'], ['Κ κ', 'kappa', 'k'], ['Λ λ', 'lambda', 'l'], ['Μ μ', 'mu', 'm'], ['Ν ν', 'nu', 'n'], ['Ξ ξ', 'xi', 'x as in "box"'], ['Ο ο', 'omicron', 'o as in "lot"'], ['Π π', 'pi', 'p'], ['Ρ ρ', 'rho', 'r, lightly rolled'], ['Σ σ ς', 'sigma', 's (ς is used at the end of a word)'], ['Τ τ', 'tau', 't'], ['Υ υ', 'upsilon', 'French "u"; often simplified to "oo"'], ['Φ φ', 'phi', 'f'], ['Χ χ', 'chi', 'ch as in Scottish "loch"'], ['Ψ ψ', 'psi', 'ps as in "lips"'], ['Ω ω', 'omega', 'oh as in "tone"']];
  const ABC_GRK2 = [['αι', 'ai as in "aisle"'], ['ει', 'ay as in "eight"'], ['οι', 'oi as in "oil"'], ['αυ', 'ow as in "how"'], ['ευ', 'eu as in "feud"'], ['ου', 'oo as in "soup"'], ['υι', 'wee'], ['῾ (rough breathing)', 'an h sound before the vowel'], ['᾿ (smooth breathing)', 'no sound'], ['´ ` ῀ (accents)', 'mark the stressed syllable']];
  const ABC_HEB = [['א', 'aleph', 'silent; carries a vowel'], ['ב', 'bet', 'b with a dot (בּ), v without (ב)'], ['ג', 'gimel', 'g as in "go"'], ['ד', 'dalet', 'd'], ['ה', 'he', 'h; silent at the end of a word'], ['ו', 'vav', 'v; also a vowel letter (וֹ "o", וּ "u")'], ['ז', 'zayin', 'z'], ['ח', 'chet', 'ch as in Scottish "loch"'], ['ט', 'tet', 't'], ['י', 'yod', 'y'], ['כ ך', 'kaf', 'k with a dot (כּ), kh without; ך at the end of a word'], ['ל', 'lamed', 'l'], ['מ ם', 'mem', 'm; ם at the end of a word'], ['נ ן', 'nun', 'n; ן at the end of a word'], ['ס', 'samekh', 's'], ['ע', 'ayin', 'silent in the pronunciation taught here'], ['פ ף', 'pe', 'p with a dot (פּ), f without; ף at the end of a word'], ['צ ץ', 'tsade', 'ts as in "cats"; ץ at the end of a word'], ['ק', 'qof', 'k'], ['ר', 'resh', 'r'], ['שׁ שׂ', 'shin / sin', 'sh with the dot on the right (שׁ), s with the dot on the left (שׂ)'], ['ת', 'tav', 't']];
  const ABC_HEB2 = [['בַ  בָ', 'patach, qamets', 'a as in "father"'], ['בֵ', 'tsere', 'ay as in "they"'], ['בֶ', 'segol', 'e as in "bet"'], ['בִ', 'hireq', 'i as in "machine"'], ['בֹ  בוֹ', 'holem', 'o as in "go"'], ['בֻ  בוּ', 'qibbuts, shureq', 'u as in "rule"'], ['בְ', 'shewa', 'a very short "e", or silent']];
  async function vWords(r) {
    loading('Language centre');
    const tab = r.q.get('t') || 'words';
    if (tab === 'abc') {
      const row = (a, b, c) => '<tr><td class="abc-l">' + esc(a) + '</td><td>' + (b ? esc(b) + (PR.can() ? ' <button class="icon-btn sm-i" data-say="' + esc(b) + '" aria-label="Say ' + esc(b) + '">' + SPK + '</button>' : '') : '') + '</td><td>' + esc(c) + '</td></tr>';
      shell('Language centre', wordsTabs('abc') + '<p class="muted small">How the letters sound in the academic pronunciation used in this course. The speaker button says the letter\'s name.</p><div class="grid g2" style="align-items:start"><div class="card"><h3>Greek</h3><div class="tbl-wrap"><table class="tbl abc"><thead><tr><th>Letter</th><th>Name</th><th>Sound</th></tr></thead><tbody>' + ABC_GRK.map(x => row(x[0], x[1], x[2])).join('') + '</tbody></table></div><h4 style="margin-top:18px">Vowel pairs and marks</h4><div class="tbl-wrap"><table class="tbl abc"><tbody>' + ABC_GRK2.map(x => row(x[0], '', x[1])).join('') + '</tbody></table></div></div>' +
        '<div class="card"><h3>Hebrew</h3><p class="small muted">Hebrew reads from right to left. The vowels are small marks below, above or beside the letters, shown here on the letter ב.</p><div class="tbl-wrap"><table class="tbl abc heb-t"><thead><tr><th>Letter</th><th>Name</th><th>Sound</th></tr></thead><tbody>' + ABC_HEB.map(x => row(x[0], x[1], x[2])).join('') + '</tbody></table></div><h4 style="margin-top:18px">Vowels</h4><div class="tbl-wrap"><table class="tbl abc heb-t"><tbody>' + ABC_HEB2.map(x => '<tr><td class="abc-l">' + esc(x[0]) + '</td><td>' + esc(x[1]) + '</td><td>' + esc(x[2]) + '</td></tr>').join('') + '</tbody></table></div></div></div>');
      wireWordsTabs(); document.querySelectorAll('[data-say]').forEach(b => b.onclick = () => PR.play({ language: 'english', lemma: b.dataset.say, translit: b.dataset.say, syll: [] }, 'normal'));
      return;
    }
    const [v, f] = await Promise.all([sb.from('ac_vocab').select('*').order('sort'), sb.from('ac_flash').select('*').eq('user_id', S.user.id)]);
    const V = v.data || [], F = {}; (f.data || []).forEach(x => (F[x.vocab_id] = x));
    const lang = r.q.get('l') || '';
    const list = V.filter(w => !lang || w.language === lang);
    const due = V.filter(w => !F[w.id] || (!F[w.id].mastered && F[w.id].due_on <= today()));
    const mastered = V.filter(w => F[w.id] && F[w.id].mastered).length;
    shell('Language centre', wordsTabs('words') + '<div class="grid g3" style="margin-bottom:16px"><div class="card kpi"><div class="l">Words</div><div class="v">' + V.length + '</div></div><div class="card kpi"><div class="l">Due for review</div><div class="v">' + due.length + '</div></div><div class="card kpi"><div class="l">Mastered</div><div class="v">' + mastered + '</div></div></div>' +
      '<div class="row between" style="margin-bottom:12px"><div class="seg">' + [['', 'All'], ['hebrew', 'Hebrew'], ['aramaic', 'Aramaic'], ['greek', 'Greek']].map(([k, l]) => '<button data-l="' + k + '" class="' + (lang === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div><div class="row">' + (list.length ? '<button class="btn" id="dr">Practise pronunciation</button>' : '') + (due.length ? '<button class="btn primary" id="rv">Review ' + due.length + ' card' + (due.length === 1 ? '' : 's') + '</button>' : '<span class="pill ok">All caught up</span>') + '</div></div>' +
      '<div class="card">' + list.map((w, k) => '<div class="vocab-row">' + lmHtml(w) + '<div><b>' + esc(w.translit) + '</b>: ' + esc(w.gloss) + '<div class="pr-line">' + sylHtml(w) + (PR.can() && (w.syll || []).length ? '<button class="icon-btn sm-i" data-hear="' + k + '" aria-label="Hear ' + esc(w.translit) + '">' + SPK + '</button>' : '') + '<button class="btn ghost sm" data-pr="' + k + '">Pronounce</button></div><div class="small muted">' + esc(w.grammar || '') + (w.refs.length ? ' &middot; ' + w.refs.map(x => '<a href="#/bible?r=' + encodeURIComponent(x) + '">' + esc(x) + '</a>').join(', ') : '') + '</div>' + (w.notes ? '<div class="small" style="margin-top:4px">' + esc(w.notes) + '</div>' : '') + '</div><div>' + (F[w.id] && F[w.id].mastered ? '<span class="pill ok">Mastered</span>' : F[w.id] ? '<span class="pill">Box ' + F[w.id].box + ' of 5</span>' : '<span class="pill">New</span>') + (w.verified ? '' : ' <span class="pill warn" title="This entry has not yet been checked by the Academy">Under review</span>') + '</div></div>').join('') + '</div>');
    wireWordsTabs();
    document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => go('#/words' + (b.dataset.l ? '?l=' + b.dataset.l : '')));
    document.querySelectorAll('[data-hear]').forEach(b => b.onclick = () => PR.play(list[+b.dataset.hear], 'normal'));
    document.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => practise(list, +b.dataset.pr));
    const dr = $('dr'); if (dr) dr.onclick = () => practise(list, 0);
    const rv = $('rv'); if (rv) rv.onclick = () => review(due.slice(), F);
  }
  const wordsTabs = t => '<div class="seg" style="margin-bottom:16px"><button data-wt="words" class="' + (t === 'words' ? 'on' : '') + '">Words and flashcards</button><button data-wt="abc" class="' + (t === 'abc' ? 'on' : '') + '">Alphabets and sounds</button></div>';
  const wireWordsTabs = () => document.querySelectorAll('[data-wt]').forEach(b => b.onclick = () => go('#/words' + (b.dataset.wt === 'abc' ? '?t=abc' : '')));
  function review(cards, F) {
    const STEP = [0, 1, 2, 4, 8, 16]; let i = 0, shown = false, right = 0;
    const draw = () => {
      PR.stop();
      if (i >= cards.length) { const d = dlg('Review finished', '<p>You reviewed ' + cards.length + ' card' + (cards.length === 1 ? '' : 's') + ' and knew ' + right + '.</p>', '<button class="btn primary" data-x2>Done</button>'); d.querySelector('[data-x2]').onclick = () => { d.close(); render(); }; return; }
      const w = cards[i];
      const d = dlg('Card ' + (i + 1) + ' of ' + cards.length, '<div class="flash"><div class="face" id="fc">' + (shown ? '<div>' + lmHtml(w, 'lem') + '<h3 style="margin:14px 0 4px">' + esc(w.translit) + '</h3><div class="pr-syl" style="margin:4px 0 10px">' + sylHtml(w) + (PR.can() && (w.syll || []).length ? ' <button class="icon-btn sm-i" id="fh" aria-label="Hear it">' + SPK + '</button>' : '') + '</div><p style="font-size:18px;margin:0">' + esc(w.gloss) + '</p><p class="small muted">' + esc(w.grammar || '') + '</p></div>' : '<div>' + lmHtml(w, 'lem') + '<p class="small muted" style="margin-top:16px">Say the word aloud and give its meaning, then tap to check</p></div>') + '</div></div>', shown ? '<button class="btn" data-a>Again</button><button class="btn primary" data-k>I knew it</button>' : '<button class="btn primary" data-s>Show answer</button>');
      const flip = () => { shown = true; draw(); if (PR.can() && (w.syll || []).length) PR.play(w, 'normal'); }; d.querySelector('#fc').onclick = e => { if (!shown) flip(); }; const s = d.querySelector('[data-s]'); if (s) s.onclick = flip;
      const fh = d.querySelector('#fh'); if (fh) fh.onclick = e => { e.stopPropagation(); PR.play(w, 'normal'); };
      const grade = async ok => { const cur = F[w.id] || { box: 1 }; const box = ok ? Math.min(5, cur.box + (F[w.id] ? 1 : 0)) : 1; const row = { user_id: S.user.id, vocab_id: w.id, box, due_on: addDays(today(), ok ? STEP[box] : 0), mastered: ok && cur.box === 5, reviewed_at: new Date().toISOString() }; if (ok) right++; const x = await sb.from('ac_flash').upsert(row); if (x.error) toast(friendly(x.error)); F[w.id] = row; i++; shown = false; draw(); };
      const a = d.querySelector('[data-a]'), k = d.querySelector('[data-k]'); if (a) a.onclick = () => grade(false); if (k) k.onclick = () => grade(true);
    };
    draw();
  }

  /* ---------------- Bible ---------------- */
  let BOOKS = null;
  async function vBible(r) {
    loading('Bible'); if (!BOOKS) BOOKS = (await sb.from('ac_books').select('*').order('no')).data || [];
    const ref = r.q.get('r') || LS.get('academy.bible', 'John 1');
    shell('Bible', '<form id="bf" class="row" style="margin-bottom:16px"><input class="inp" name="r" value="' + esc(ref) + '" placeholder="For example: John 1:1-14, Gen 1, 2 Tim 3:16" style="max-width:360px" aria-label="Passage"><button class="btn primary">Read</button><select class="inp" id="bk" style="max-width:220px" aria-label="Book"><option value="">Choose a book</option>' + BOOKS.map(b => '<option value="' + esc(b.name) + '">' + esc(b.name) + '</option>').join('') + '</select></form><div class="grid" style="grid-template-columns:minmax(0,1fr);max-width:820px"><div class="card scripture" id="bt"><p class="muted">Loading...</p></div><div class="row between" id="bn"></div><p class="tiny muted">World English Bible (public domain).</p></div>');
    $('bf').onsubmit = ev => { ev.preventDefault(); const v = formData(ev.target).r; if (v) go('#/bible?r=' + encodeURIComponent(v)); };
    $('bk').onchange = e => { if (e.target.value) go('#/bible?r=' + encodeURIComponent(e.target.value + ' 1')); };
    const { data } = await sb.rpc('ac_passage', { ref }); const v = data || [];
    if (!v.length) { $('bt').innerHTML = '<p>That passage was not found. Try a form like <b>John 3:16</b>, <b>Ps 23</b> or <b>Rom 8:1-11</b>.</p>'; return; }
    LS.set('academy.bible', ref);
    const multi = v[0].chapter !== v[v.length - 1].chapter;
    $('bt').innerHTML = '<h3 style="font-size:28px">' + esc(ref) + '</h3><p style="font-size:var(--read);line-height:1.75">' + v.map(x => '<sup>' + (multi ? x.chapter + ':' : '') + x.verse + '</sup>' + esc(x.text) + ' ').join('') + '</p>';
    const b = BOOKS.find(x => x.name === v[0].book); const ch = v[0].chapter;
    if (b && !multi) $('bn').innerHTML = (ch > 1 ? '<a class="btn" href="#/bible?r=' + encodeURIComponent(b.name + ' ' + (ch - 1)) + '">' + esc(b.name) + ' ' + (ch - 1) + '</a>' : '<span></span>') + (ch < b.chapters ? '<a class="btn" href="#/bible?r=' + encodeURIComponent(b.name + ' ' + (ch + 1)) + '">' + esc(b.name) + ' ' + (ch + 1) + '</a>' : '');
  }

  /* ---------------- my class ---------------- */
  async function vClass() {
    loading('My class'); await loadDash();
    if (!S.dash.cohort_id) return shell('My class', '<div class="card"><h3>You are not in a class</h3><p class="muted">Join a class with its invitation code to study alongside others.</p>' + joinForm() + '</div>'), wireJoinForm();
    const [c, roll, ann] = await Promise.all([sb.from('ac_cohorts').select('name, starts_on, ends_on, release_time').eq('id', S.dash.cohort_id).maybeSingle(), sb.rpc('ac_cohort_roll', { cid: S.dash.cohort_id }), sb.from('ac_announcements').select('title, body, created_at').order('created_at', { ascending: false }).limit(20)]);
    const K = c.data || {}; const R = roll.data || [];
    shell('My class', '<div class="card" style="margin-bottom:16px"><span class="eyebrow">Your class</span><h2>' + esc(K.name) + '</h2><p class="muted" style="margin:0">' + esc(fmtD(K.starts_on)) + (K.ends_on ? ' to ' + esc(fmtD(K.ends_on)) : '') + '. Lessons open at ' + esc(String(K.release_time || '06:00').slice(0, 5)) + ' South African time.</p></div>' +
      '<div class="grid g2"><div class="card"><h3>Announcements</h3>' + ((ann.data || []).length ? ann.data.map(a => '<div class="note-item"><b>' + esc(a.title) + '</b> <span class="tiny muted">' + esc(fmtDS(a.created_at)) + '</span><div class="small" style="margin-top:4px">' + paras(a.body) + '</div></div>').join('') : '<p class="small muted">No announcements yet.</p>') + '</div>' +
      '<div class="card"><h3>Classmates</h3><p class="tiny muted">Only students who chose to appear are listed. Change your choice in your profile.</p>' + (R.length ? R.map(x => '<div class="row between note-item"><span>' + esc(x.full_name || 'Student') + '</span><span class="small muted">' + x.lessons_done + ' lessons</span></div>').join('') : '<p class="small muted">No one to show yet.</p>') + '</div></div>');
  }

  /* ---------------- profile ---------------- */
  async function vProfile() {
    loading('Profile'); await loadDash();
    const p = S.profile; const priv = (await sb.from('ac_profile_private').select('denomination').eq('user_id', S.user.id).maybeSingle()).data || {};
    shell('Profile', '<div class="grid g2" style="align-items:start"><form id="f" class="card grid"><h3>Your details</h3>' + field('Full name', inp('full_name', p.full_name, ' required maxlength="120"')) + '<div class="grid g2">' + field('Country', inp('country', p.country, ' maxlength="80"')) + field('Time zone', sel('time_zone', ['Africa/Johannesburg', 'Africa/Harare', 'Africa/Lagos', 'Africa/Nairobi', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Australia/Sydney'], p.time_zone)) + '</div>' +
      field('Usual study time', inp('schedule', p.schedule, ' maxlength="200"')) + field('Your goals for this course', area('objectives', p.objectives, ' rows="3" maxlength="1000"')) + field('Previous theological study', inp('prior_education', p.prior_education, ' maxlength="200"')) +
      field('Denominational background <span class="hint">private: only you can see this</span>', inp('denomination', priv.denomination, ' maxlength="120"')) +
      '<label class="check"><input type="checkbox" name="show_in_cohort"' + (p.show_in_cohort ? ' checked' : '') + '> <span>Show my name and general progress on my class list</span></label><label class="check"><input type="checkbox" name="email_reminders"' + (p.email_reminders ? ' checked' : '') + '> <span>Send me course reminders by email</span></label><div class="row"><button class="btn primary">Save</button></div><p class="err" id="e"></p></form>' +
      '<div class="grid"><div class="card"><h3>Account</h3><p class="small muted">Signed in as ' + esc(S.user.email) + '</p><p class="small">Roles: ' + S.roles.map(x => '<span class="pill">' + esc(x) + '</span>').join(' ') + '</p>' + (S.dash.enrolled ? '<p class="small">Study mode: <b>' + esc(MODE[S.dash.mode]) + '</b>. Change it on the <a href="#/course">course page</a>.</p>' : '') + '<div class="row"><button class="btn" id="pw">Change password</button><button class="btn" id="so2">Sign out</button></div></div>' +
      '<div class="card"><h3>Your information</h3><p class="small muted">Download a copy of your profile, progress, notes and journal. Under POPIA you may also ask for your information to be corrected or deleted.</p><button class="btn" id="ex">Download my information</button></div>' +
      '<div class="card"><h3>Quick links</h3><div class="grid" style="gap:6px"><a href="#/notes">Notes and bookmarks</a><a href="#/bible">Bible</a><a href="#/class">My class</a>' + (isStaff() ? '<a href="#/admin">Founder admin</a>' : '') + '<a href="/academy/privacy/" target="_blank">Privacy notice</a><a href="/academy/terms/" target="_blank">Terms of use</a></div></div></div></div>');
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); if (!d.full_name) return ($('e').textContent = 'Please give your name.'); await busy(ev.submitter, async () => {
      const up = { full_name: d.full_name, country: d.country, time_zone: d.time_zone, schedule: d.schedule, objectives: d.objectives, prior_education: d.prior_education, show_in_cohort: d.show_in_cohort, email_reminders: d.email_reminders };
      const x = await sb.from('ac_profiles').update(up).eq('user_id', S.user.id); if (x.error) return ($('e').textContent = friendly(x.error));
      await sb.from('ac_profile_private').upsert({ user_id: S.user.id, denomination: d.denomination, updated_at: new Date().toISOString() });
      Object.assign(S.profile, up); toast('Saved'); }); };
    $('so2').onclick = signOut;
    $('pw').onclick = () => { const d = dlg('Change password', '<form class="grid">' + field('New password <span class="hint">at least 10 characters</span>', inp('pw', '', ' type="password" autocomplete="new-password" minlength="10"')) + '<p class="err"></p></form>', '<button class="btn" data-c>Cancel</button><button class="btn primary" data-s>Save</button>'); d.querySelector('[data-c]').onclick = () => d.close(); d.querySelector('[data-s]').onclick = async () => { const v = d.querySelector('input').value; if (v.length < 10) return (d.querySelector('.err').textContent = 'Use at least 10 characters.'); const x = await sb.auth.updateUser({ password: v }); if (x.error) return (d.querySelector('.err').textContent = friendly(x.error)); d.close(); toast('Password changed'); }; };
    $('ex').onclick = ev => busy(ev.target, async () => {
      const [a, b, c, dd, e] = await Promise.all([sb.from('ac_profiles').select('*').eq('user_id', S.user.id), sb.from('ac_profile_private').select('*'), sb.from('ac_lesson_progress').select('*'), sb.from('ac_notes').select('*'), sb.from('ac_journal').select('*')]);
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), email: S.user.email, profile: a.data, private: b.data, progress: c.data, notes: dd.data, journal: e.data }, null, 2)], { type: 'application/json' });
      const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = 'canonical-studies-my-information.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
    });
  }

  /* ---------------- founder admin ---------------- */
  const ATABS = [['', 'Overview'], ['lessons', 'Lessons'], ['cohorts', 'Classes and invitations'], ['students', 'Students'], ['announcements', 'Announcements'], ['words', 'Words']];
  const atabs = cur => '<div class="seg" style="margin-bottom:18px;flex-wrap:wrap;border-radius:14px">' + ATABS.filter(([k]) => isFounder() || !['cohorts', 'announcements'].includes(k)).map(([k, l]) => '<button data-at="' + k + '" class="' + (cur === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>';
  const wireTabs = () => document.querySelectorAll('[data-at]').forEach(b => b.onclick = () => go('#/admin' + (b.dataset.at ? '/' + b.dataset.at : '')));
  async function vAdmin(r) {
    if (!isStaff()) return shell('Admin', '<div class="card empty">This area is for the Academy\'s staff.</div>');
    const t = r.parts[1] || '';
    if (t === 'lesson') return aLesson(r.parts[2]);
    if (t === 'lessons') return aLessons(r); if (t === 'cohorts') return aCohorts(); if (t === 'students') return aStudents(); if (t === 'announcements') return aAnnouncements(); if (t === 'words') return aWords();
    loading('Founder admin'); const { data: O, error } = await sb.rpc('ac_admin_overview'); if (error) return shell('Founder admin', '<p class="err">' + esc(friendly(error)) + '</p>');
    const st = (l, v, s) => '<div class="card kpi"><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (s ? '<div class="small muted">' + s + '</div>' : '') + '</div>';
    shell('Founder admin', atabs('') + '<div class="stat-row">' + st('Students', O.students, O.new_7d + ' new this week') + st('Enrolled', O.enrolments) + st('Active this week', O.active_7d) + st('Lessons completed', O.lessons_completed) + st('Awaiting your review', O.awaiting_review, 'drafts and in review') + st('Published', O.published, 'of 125 lessons') + st('Outlines', O.outline, 'title and readings only') + '</div>' +
      '<div class="grid g2" style="margin-top:16px"><div class="card"><h3>Review before release</h3><p class="small muted">Students can only read published lessons. Weeks 1 and 2 have full drafts prepared with AI assistance, waiting for your review. Every other lesson is an outline: its title, readings and place in the schedule are set, and its content still has to be written.</p><a class="btn primary" href="#/admin/lessons?s=draft">Review drafts</a></div>' +
      '<div class="card"><h3>Privacy by design</h3><p class="small muted">You can see names, emails, enrolment and progress. Students\' journals, private notes and denominational background are blocked from every staff account by the database itself.</p></div></div>');
    wireTabs();
  }
  async function aLessons(r) {
    loading('Lessons'); const cs = await loadCourses(); const cid = r.q.get('c') || (cs[0] && cs[0].id); const s = r.q.get('s') || '';
    let q = sb.from('ac_lessons').select('id, seq, day_no, focus, title, status, ai_assisted, reviewed_at, readings, ac_weeks(week_no)').eq('course_id', cid).order('seq'); if (s) q = q.eq('status', s);
    const { data } = await q; const Ls = data || [];
    shell('Lessons', atabs('lessons') + '<div class="row" style="margin-bottom:14px"><select class="inp" id="cc" style="max-width:360px">' + cs.map(c => '<option value="' + c.id + '"' + (c.id === cid ? ' selected' : '') + '>' + esc(c.title) + (c.is_published ? '' : ' (not published)') + '</option>').join('') + '</select><div class="seg">' + [['', 'All'], ['outline', 'Outline'], ['draft', 'Draft'], ['in_review', 'In review'], ['published', 'Published']].map(([k, l]) => '<button data-s="' + k + '" class="' + (s === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Week</th><th>Lesson</th><th>Status</th><th></th></tr></thead><tbody>' + (Ls.length ? Ls.map(l => '<tr><td>' + l.seq + '</td><td>' + esc(l.ac_weeks && l.ac_weeks.week_no) + ' &middot; ' + DAY[l.day_no].slice(0, 3) + '</td><td><a href="#/admin/lesson/' + l.id + '">' + esc(l.title) + '</a><div class="tiny muted">' + FOCUS[l.focus] + (l.readings.length ? ' &middot; ' + esc(l.readings.join(', ')) : '') + '</div></td><td><span class="pill ' + STATUS[l.status][1] + '">' + STATUS[l.status][0] + '</span>' + (l.ai_assisted ? ' <span class="pill info">AI-assisted</span>' : '') + '</td><td><a class="btn sm" href="#/admin/lesson/' + l.id + '">Open</a></td></tr>').join('') : '<tr><td colspan="5" class="empty">No lessons with that status.</td></tr>') + '</tbody></table></div>');
    wireTabs(); $('cc').onchange = e => go('#/admin/lessons?c=' + e.target.value + (s ? '&s=' + s : ''));
    document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => go('#/admin/lessons?c=' + cid + (b.dataset.s ? '&s=' + b.dataset.s : '')));
  }
  async function aLesson(lid) {
    loading('Edit lesson');
    const L = (await sb.from('ac_lessons').select('id, course_id, seq, day_no, focus, title, minutes, objectives, readings, memory_verse, status, ai_assisted, reviewed_at, reviewed_by').eq('id', lid).maybeSingle()).data;
    if (!L) return shell('Edit lesson', '<div class="card empty">Lesson not found.</div>');
    const K = (await sb.rpc('ac_lesson_content', { lid })).data || {};
    const refsAll = L.readings.concat(L.memory_verse ? [L.memory_verse] : []);
    const chk = await Promise.all(refsAll.map(x => sb.rpc('ac_passage', { ref: x })));
    const bad = refsAll.filter((x, i) => !(chk[i].data || []).length);
    const empty = SECTIONS.filter(([k]) => ['teaching', 'historical', 'exegesis', 'application'].includes(k) && !K[k]).map(s => s[1]);
    shell('Lesson ' + L.seq, atabs('lessons') + '<div class="row between" style="margin-bottom:12px"><div class="row"><span class="pill ' + STATUS[L.status][1] + '">' + STATUS[L.status][0] + '</span>' + (L.ai_assisted ? '<span class="pill info">AI-assisted draft</span>' : '') + (L.reviewed_at ? '<span class="pill ok">Reviewed ' + esc(fmtDS(L.reviewed_at)) + '</span>' : '') + '</div><div class="row"><a class="btn" href="#/lesson/' + L.id + '">Preview as a student</a>' +
      (L.status !== 'published' ? (L.status !== 'in_review' ? '<button class="btn" data-st="in_review">Mark in review</button>' : '') + '<button class="btn primary" id="pub">Publish</button>' : '<button class="btn" data-st="draft">Unpublish</button>') + '</div></div>' +
      (bad.length ? '<div class="notice bad" style="margin-bottom:12px">These references do not resolve to Scripture text: ' + esc(bad.join(', ')) + '. Fix them before publishing.</div>' : '<div class="notice ok" style="margin-bottom:12px">All ' + refsAll.length + ' Scripture references resolve to World English Bible text.</div>') +
      (empty.length ? '<div class="notice warn" style="margin-bottom:12px">Still to write: ' + esc(empty.join(', ')) + '.</div>' : '') +
      '<form id="f" class="grid"><div class="card grid"><h3>Lesson details</h3>' + field('Title', inp('title', L.title, ' maxlength="200" required')) + '<div class="grid g2">' + field('Readings <span class="hint">one reference per line, for example John 1:1-14</span>', area('readings', L.readings.join('\n'), ' rows="4"')) + field('Objectives <span class="hint">one per line</span>', area('objectives', L.objectives.join('\n'), ' rows="4"')) + '</div><div class="grid g2">' + field('Memory verse', inp('memory_verse', L.memory_verse, ' maxlength="40"')) + field('Minutes', inp('minutes', L.minutes, ' type="number" min="5" max="600"')) + '</div></div>' +
      '<div class="card"><h3>Sections</h3><p class="small muted">Plain text. Leave a blank line between paragraphs. Do not type Scripture text from memory: cite the reference, and the reader shows the World English Bible text.</p>' + SECTIONS.map(([k, lab]) => '<details class="section-edit"' + (K[k] ? '' : '') + '><summary>' + lab + (K[k] ? ' <span class="tiny muted">(' + K[k].split(/\s+/).length + ' words)</span>' : ' <span class="tiny muted">(empty)</span>') + '</summary><div style="margin-top:10px">' + area('s_' + k, K[k] || '', ' rows="' + (['teaching', 'exegesis', 'historical'].includes(k) ? 12 : 5) + '"') + '</div></details>').join('') +
      '<details class="section-edit"><summary>Further reading <span class="tiny muted">(one source per line, no page numbers unless checked)</span></summary><div style="margin-top:10px">' + area('references', (K.references || []).join('\n'), ' rows="6"') + '</div></details></div>' +
      '<div class="row"><button class="btn primary lg">Save changes</button><a class="btn" href="#/admin/lessons?c=' + L.course_id + '">Back to lessons</a></div><p class="err" id="e"></p></form>');
    wireTabs();
    $('f').onsubmit = async ev => { ev.preventDefault(); const fd = new FormData(ev.target); const lines = k => String(fd.get(k) || '').split('\n').map(x => x.trim()).filter(Boolean);
      const content = {}; SECTIONS.forEach(([k]) => { const v = String(fd.get('s_' + k) || '').trim(); if (v) content[k] = v; }); const refs = lines('references'); if (refs.length) content.references = refs;
      const up = { title: String(fd.get('title')).trim(), readings: lines('readings'), objectives: lines('objectives'), memory_verse: String(fd.get('memory_verse') || '').trim() || null, minutes: Number(fd.get('minutes')) || 60, content, updated_at: new Date().toISOString() };
      if (L.status === 'outline' && Object.keys(content).length) up.status = 'draft';
      await busy(ev.submitter, async () => { const x = await sb.from('ac_lessons').update(up).eq('id', lid); if (x.error) return ($('e').textContent = friendly(x.error)); toast('Saved'); aLesson(lid); }); };
    document.querySelectorAll('[data-st]').forEach(b => b.onclick = ev => busy(ev.target, async () => { const x = await sb.rpc('ac_set_lesson_status', { lid, st: b.dataset.st }); if (x.error) return toast(friendly(x.error)); toast(STATUS[b.dataset.st][0]); aLesson(lid); }));
    const pub = $('pub'); if (pub) pub.onclick = () => {
      if (bad.length) return toast('Fix the Scripture references first.');
      const d = dlg('Publish lesson ' + L.seq + '?', '<p>Once published, students can read this lesson from its release date.</p><label class="check"><input type="checkbox" id="c1"> <span>I have read the whole lesson and I am satisfied it is accurate and fair.</span></label><label class="check" style="margin-top:8px"><input type="checkbox" id="c2"> <span>Scripture is cited by reference, and any words quoted from Scripture match the World English Bible.</span></label><label class="check" style="margin-top:8px"><input type="checkbox" id="c3"> <span>The sources under further reading are real works and are cited correctly.</span></label><p class="err" id="pe"></p>', '<button class="btn" data-c>Cancel</button><button class="btn primary" data-p>Publish</button>');
      d.querySelector('[data-c]').onclick = () => d.close();
      d.querySelector('[data-p]').onclick = async () => { if (!['c1', 'c2', 'c3'].every(i => d.querySelector('#' + i).checked)) return (d.querySelector('#pe').textContent = 'Please confirm all three.'); const x = await sb.rpc('ac_set_lesson_status', { lid, st: 'published' }); if (x.error) return (d.querySelector('#pe').textContent = friendly(x.error)); d.close(); toast('Published'); aLesson(lid); };
    };
  }
  async function aCohorts() {
    loading('Classes'); const cs = await loadCourses();
    const [c, m, iv] = await Promise.all([sb.from('ac_cohorts').select('*, ac_courses(title)').order('starts_on', { ascending: false }), sb.from('ac_cohort_members').select('cohort_id'), sb.from('ac_invitations').select('*').order('created_at', { ascending: false })]);
    const cnt = {}; (m.data || []).forEach(x => (cnt[x.cohort_id] = (cnt[x.cohort_id] || 0) + 1));
    const link = code => C.appUrl + '#/join/' + code;
    shell('Classes and invitations', atabs('cohorts') + (c.data || []).map(k => '<div class="card" style="margin-bottom:14px"><div class="row between"><div><h3 style="margin:0">' + esc(k.name) + '</h3><div class="small muted">' + esc(k.ac_courses && k.ac_courses.title) + ' &middot; ' + esc(fmtD(k.starts_on)) + (k.ends_on ? ' to ' + esc(fmtD(k.ends_on)) : '') + ' &middot; opens ' + esc(String(k.release_time).slice(0, 5)) + ' ' + esc(k.time_zone) + '</div></div><div class="row"><span class="pill gold">' + (cnt[k.id] || 0) + ' students</span><span class="pill ' + (k.is_open ? 'ok' : '') + '">' + (k.is_open ? 'Open to join' : 'Closed') + '</span><button class="btn sm" data-tog="' + k.id + '" data-v="' + (k.is_open ? '0' : '1') + '">' + (k.is_open ? 'Close' : 'Reopen') + '</button></div></div>' +
      '<div class="row" style="margin-top:12px"><span class="small">Invitation code <b>' + esc(k.invite_code) + '</b></span><input class="inp" readonly value="' + esc(link(k.invite_code)) + '" style="max-width:420px;font-size:13px" onclick="this.select()"><button class="btn sm" data-copy="' + esc(link(k.invite_code)) + '">Copy link</button><button class="btn sm" data-inv="' + k.id + '" data-code="' + esc(k.invite_code) + '">Record invitations</button></div>' +
      ((iv.data || []).filter(x => x.cohort_id === k.id).length ? '<details style="margin-top:10px"><summary class="small">Invitations recorded (' + iv.data.filter(x => x.cohort_id === k.id).length + ')</summary><div class="small" style="margin-top:6px">' + iv.data.filter(x => x.cohort_id === k.id).map(x => esc(x.email || 'link') + ' ' + (x.accepted_at ? '<span class="pill ok">joined</span>' : '<span class="pill">invited</span>')).join('<br>') + '</div></details>' : '') + '</div>').join('') +
      '<form id="nf" class="card grid"><h3>New class</h3><div class="grid g2">' + field('Name', inp('name', '', ' required maxlength="160" placeholder="Canonical Studies: Class of 2027"')) + field('Course', sel('course_id', cs.map(x => [x.id, x.title]), cs[0] && cs[0].id)) + field('Starts on <span class="hint">a Monday</span>', inp('starts_on', '', ' type="date" required')) + field('Ends on', inp('ends_on', '', ' type="date"')) + field('Lessons open at', inp('release_time', '06:00', ' type="time" required')) + '</div><div class="row"><button class="btn primary">Create class</button></div><p class="err" id="e"></p></form>');
    wireTabs();
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Link copied'); } catch (e) { toast('Select the link and copy it'); } });
    document.querySelectorAll('[data-tog]').forEach(b => b.onclick = async () => { const x = await sb.from('ac_cohorts').update({ is_open: b.dataset.v === '1' }).eq('id', b.dataset.tog); if (x.error) return toast(friendly(x.error)); aCohorts(); });
    document.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => {
      const d = dlg('Record invitations', '<p class="small muted">Add the email addresses you are inviting, one per line. Nothing is sent from here: you send the link yourself, and the Academy marks each person as joined when they sign up with that address.</p>' + area('em', '', ' rows="6" placeholder="name@example.com"') + '<p class="err"></p>', '<button class="btn" data-c>Cancel</button><button class="btn primary" data-s>Save</button>');
      d.querySelector('[data-c]').onclick = () => d.close();
      d.querySelector('[data-s]').onclick = async () => { const ems = d.querySelector('textarea').value.split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean); const badE = ems.filter(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)); if (badE.length) return (d.querySelector('.err').textContent = 'Not valid: ' + badE.join(', ')); if (!ems.length) return d.close(); const x = await sb.from('ac_invitations').insert(ems.map(e => ({ cohort_id: b.dataset.inv, email: e }))); if (x.error) return (d.querySelector('.err').textContent = friendly(x.error)); d.close(); toast(ems.length + ' recorded'); aCohorts(); };
    });
    $('nf').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); if (new Date(d.starts_on + 'T12:00:00Z').getUTCDay() !== 1) return ($('e').textContent = 'The start date must be a Monday, so lessons fall Monday to Friday.'); await busy(ev.submitter, async () => { const x = await sb.from('ac_cohorts').insert({ name: d.name, course_id: d.course_id, starts_on: d.starts_on, ends_on: d.ends_on, release_time: d.release_time, created_by: S.user.id }); if (x.error) return ($('e').textContent = friendly(x.error)); toast('Class created'); aCohorts(); }); };
  }
  async function aStudents() {
    loading('Students'); const { data, error } = await sb.rpc('ac_admin_students'); if (error) return shell('Students', '<p class="err">' + esc(friendly(error)) + '</p>');
    const R = data || [];
    shell('Students', atabs('students') + '<p class="small muted">Journals, private notes and denominational background are not available here, by design.</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Class and mode</th><th>Lessons</th><th>Last active</th><th>Roles</th></tr></thead><tbody>' + (R.length ? R.map(s => '<tr><td><b>' + esc(s.full_name || '(no name yet)') + '</b><div class="tiny muted">' + esc(s.email) + '</div><div class="tiny muted">Joined ' + esc(fmtDS(s.joined)) + '</div></td><td>' + esc(s.cohort || (s.mode ? 'No class' : 'Not enrolled')) + (s.mode ? '<div class="tiny muted">' + esc(MODE[s.mode]) + '</div>' : '') + '</td><td>' + s.lessons_done + '</td><td>' + (s.last_active ? esc(fmtDS(s.last_active)) : '<span class="muted">never</span>') + '</td><td>' + s.roles.map(x => '<span class="pill' + (x === 'founder' ? ' gold' : '') + '">' + esc(x) + '</span>').join(' ') + (isFounder() && !s.roles.includes('founder') ? '<div class="row" style="gap:4px;margin-top:6px">' + ['lecturer', 'moderator'].map(rl => '<button class="btn sm" data-role="' + rl + '" data-u="' + s.user_id + '" data-on="' + (s.roles.includes(rl) ? '0' : '1') + '">' + (s.roles.includes(rl) ? 'Remove ' : 'Make ') + rl + '</button>').join('') + '</div>' : '') + '</td></tr>').join('') : '<tr><td colspan="5" class="empty">No students yet.</td></tr>') + '</tbody></table></div>');
    wireTabs();
    document.querySelectorAll('[data-role]').forEach(b => b.onclick = async () => { const on = b.dataset.on === '1'; if (!(await confirmDlg((on ? 'Make this person a ' : 'Remove the ') + b.dataset.role + (on ? '?' : ' role?'), on && b.dataset.role === 'lecturer' ? 'Lecturers can read and edit every lesson, including drafts, and see every student\'s name, email and progress.' : 'You can change this again at any time.', on ? 'Confirm' : 'Remove'))) return; const x = await sb.rpc('ac_set_role', { target: b.dataset.u, r: b.dataset.role, on_off: on }); if (x.error) return toast(friendly(x.error)); toast('Updated'); aStudents(); });
  }
  async function aAnnouncements() {
    loading('Announcements'); const [a, c] = await Promise.all([sb.from('ac_announcements').select('*, ac_cohorts(name)').order('created_at', { ascending: false }), sb.from('ac_cohorts').select('id, name')]);
    shell('Announcements', atabs('announcements') + '<form id="f" class="card grid" style="margin-bottom:16px"><h3>New announcement</h3>' + field('Title', inp('title', '', ' required maxlength="200"')) + field('Message', area('body', '', ' rows="5" maxlength="4000" required')) + field('Who sees it', sel('cohort_id', [['', 'Everyone']].concat((c.data || []).map(x => [x.id, x.name])), '')) + '<p class="small muted" style="margin:0">Announcements appear on students\' dashboards and class pages. Nothing is emailed.</p><div class="row"><button class="btn primary">Post</button></div><p class="err" id="e"></p></form>' +
      ((a.data || []).map(x => '<div class="card flat" style="margin-bottom:10px"><div class="row between"><b>' + esc(x.title) + '</b><div class="row"><span class="tiny muted">' + esc(x.ac_cohorts ? x.ac_cohorts.name : 'Everyone') + ' &middot; ' + esc(fmtDS(x.created_at)) + '</span><button class="btn sm danger" data-del="' + x.id + '">Delete</button></div></div><div class="small" style="margin-top:6px">' + paras(x.body) + '</div></div>').join('') || '<div class="card empty">No announcements yet.</div>'));
    wireTabs();
    $('f').onsubmit = async ev => { ev.preventDefault(); const d = formData(ev.target); if (!d.title || !d.body) return ($('e').textContent = 'Give a title and a message.'); await busy(ev.submitter, async () => { const x = await sb.from('ac_announcements').insert({ title: d.title, body: d.body, cohort_id: d.cohort_id }); if (x.error) return ($('e').textContent = friendly(x.error)); toast('Posted'); aAnnouncements(); }); };
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!(await confirmDlg('Delete this announcement?', 'Students will no longer see it. This cannot be undone.', 'Delete', true))) return; const x = await sb.from('ac_announcements').delete().eq('id', b.dataset.del); if (x.error) return toast(friendly(x.error)); aAnnouncements(); });
  }
  async function aWords() {
    loading('Words'); const { data } = await sb.from('ac_vocab').select('*').order('sort'); const D = data || [];
    shell('Words', atabs('words') + '<p class="small muted">Starter vocabulary for the language centre. Check each entry, including its pronunciation guide, against a standard lexicon and grammar, then mark it as checked. Students see unchecked entries labelled "Under review".</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Word</th><th>Meaning</th><th>Pronunciation</th><th></th></tr></thead><tbody>' + D.map((w, k) => '<tr><td>' + lmHtml(w, 'lm') + '<div class="tiny muted">' + esc(w.translit) + ' &middot; ' + esc(w.language) + '</div></td><td>' + esc(w.gloss) + '<div class="tiny muted">' + esc(w.grammar || '') + ' &middot; ' + esc(w.refs.join(', ')) + '</div></td><td>' + (sylHtml(w) || '<span class="muted small">none</span>') + (PR.can() ? ' <button class="icon-btn sm-i" data-hear="' + k + '" aria-label="Hear it">' + SPK + '</button>' : '') + '<div><button class="btn ghost sm" data-ed="' + k + '">Edit pronunciation</button></div></td><td>' + (w.verified ? '<span class="pill ok">Checked</span> <button class="btn sm" data-v="' + w.id + '" data-on="0">Undo</button>' : '<button class="btn sm primary" data-v="' + w.id + '" data-on="1">Mark checked</button>') + '</td></tr>').join('') + '</tbody></table></div>');
    wireTabs();
    document.querySelectorAll('[data-hear]').forEach(b => b.onclick = () => PR.play(D[+b.dataset.hear], 'normal'));
    document.querySelectorAll('[data-v]').forEach(b => b.onclick = async () => { const x = await sb.from('ac_vocab').update({ verified: b.dataset.on === '1' }).eq('id', b.dataset.v); if (x.error) return toast(friendly(x.error)); aWords(); });
    document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => {
      const w = D[+b.dataset.ed];
      const d = dlg('Pronunciation: ' + w.translit, '<div class="center" style="margin-bottom:10px">' + lmHtml(w, 'lem') + '</div><form class="grid">' + field('Syllables <span class="hint">separated by hyphens; write the stressed syllable in capitals, for example kah-NOHN</span>', inp('syll', (w.syll || []).join('-'), ' maxlength="80"')) + field('Note for students', area('pron_note', w.pron_note, ' rows="3" maxlength="400"')) + field('Recorded audio <span class="hint">optional https link to a human recording; played instead of the computer voice</span>', inp('audio_url', w.audio_url, ' maxlength="500" placeholder="https://"')) + '<p class="err"></p></form>', '<button class="btn" data-t>Try it</button><button class="btn" data-c>Cancel</button><button class="btn primary" data-s>Save</button>');
      const read = () => { const f = d.querySelector('form'); const sy = f.syll.value.split(/[-\s·]+/).map(x => x.trim()).filter(Boolean); return { syll: sy, pron_note: f.pron_note.value.trim() || null, audio_url: f.audio_url.value.trim() || null }; };
      d.querySelector('[data-t]').onclick = () => PR.play(Object.assign({}, w, read()), 'normal');
      d.querySelector('[data-c]').onclick = () => d.close();
      d.querySelector('[data-s]').onclick = async () => { const v = read(); if (v.audio_url && !/^https:\/\//.test(v.audio_url)) return (d.querySelector('.err').textContent = 'The audio link must start with https://'); if (v.syll.length && !v.syll.some(PR.stressed)) return (d.querySelector('.err').textContent = 'Write the stressed syllable in capitals.'); const x = await sb.from('ac_vocab').update(Object.assign(v, { verified: false })).eq('id', w.id); if (x.error) return (d.querySelector('.err').textContent = friendly(x.error)); d.close(); toast('Saved. Mark it as checked when you are happy with it.'); aWords(); };
    });
  }


  boot();
})();
