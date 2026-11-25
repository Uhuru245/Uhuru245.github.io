/* MRET Universe core: Supabase client, shell (header, footer, theme), first-party analytics, helpers.
   Every page loads config.js, supabase-js and this file, then calls UV.page({...}). */
(function () {
  const C = window.UV_CONFIG;
  const sb = window.supabase.createClient(C.url, C.key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, storageKey: 'mret-universe-auth' } });
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));
  const url = p => C.base + (p || '');
  const qs = new URLSearchParams(location.search);

  // ---------- theme ----------
  function applyTheme() { const t = store.get('uv.theme', null); if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  applyTheme();
  function toggleTheme() {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    store.set('uv.theme', dark ? 'light' : 'dark'); applyTheme();
  }

  // ---------- first-party analytics (no third-party trackers) ----------
  let anon = store.get('uv.anon', null); if (!anon) { anon = uuid(); store.set('uv.anon', anon); }
  let sess; try { sess = sessionStorage.getItem('uv.s') || uuid(); sessionStorage.setItem('uv.s', sess); } catch (e) { sess = uuid(); }
  // remember where someone came from, so registrations can be attributed (kept on this device only)
  const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const utm = {}; UTM.forEach(k => { if (qs.get(k)) utm[k] = qs.get(k).slice(0, 80); });
  if (Object.keys(utm).length) store.set('uv.utm', Object.assign(utm, { landed: location.pathname, at: new Date().toISOString() }));
  if (qs.get('ref')) store.set('uv.ref', qs.get('ref').slice(0, 20));
  if (!store.get('uv.first', null)) store.set('uv.first', { path: location.pathname, referrer: document.referrer ? new URL(document.referrer).hostname : null });
  const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || store.get('uv.analytics', true) === false;
  function track(name, props, business) {
    if (dnt && name === 'page_viewed') return;
    const body = { event_id: uuid(), name, anon_id: dnt ? null : anon, session_id: dnt ? null : sess, props: props || {}, path: location.pathname + (location.search.length < 120 ? location.search : ''),
      referrer: document.referrer ? new URL(document.referrer).hostname : null, utm: store.get('uv.utm', {}) };
    if (business) body.business = business;
    sb.rpc('uv_track', { p: body }).then(() => {}, () => {});
  }

  // ---------- data helpers ----------
  const MESSAGES = { '42501': 'You do not have permission to do that.', 'PGRST301': 'Please sign in again.', '28000': 'Please sign in first.' };
  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw new Error(error.message && !/^(JWT|permission denied)/.test(error.message) ? error.message : (MESSAGES[error.code] || 'Something went wrong. Please try again.'));
    return data;
  }
  async function q(promise) { const { data, error } = await promise; if (error) throw new Error(error.message); return data; }
  let meCache;
  async function me(force) {
    if (meCache && !force) return meCache;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return (meCache = null);
    try { meCache = await rpc('uv_me'); } catch (e) { meCache = null; }
    return meCache;
  }
  let catCache;
  async function categories() { if (!catCache) catCache = await q(sb.from('uv_categories').select('slug,name,related,sort').eq('active', true).order('sort')); return catCache; }
  let flagCache;
  async function flags() { if (!flagCache) { const rows = await q(sb.from('uv_feature_flags').select('key,enabled')); flagCache = {}; rows.forEach(r => flagCache[r.key] = r.enabled); } return flagCache; }
  const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];

  // ---------- formatting ----------
  const num = n => new Intl.NumberFormat('en-GB').format(n || 0);
  const date = d => d ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '';
  const ago = d => { if (!d) return ''; const s = (Date.now() - new Date(d)) / 1000; if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; if (s < 604800) return Math.round(s / 86400) + ' d ago'; return date(d); };
  const founding = n => n ? 'Founding member No. ' + String(n).padStart(4, '0') : '';
  const initials = n => esc((n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase());
  const waLink = (n, text) => { let d = String(n || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '27' + d.slice(1); return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : ''); };
  const safeUrl = u => { try { const x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
  const bizUrl = slug => url('business/' + encodeURIComponent(slug));

  // ---------- ui ----------
  function toast(msg, ms) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms || 3200); }
  async function busy(btn, fn) { const b = btn; if (b) b.classList.add('busy'); try { return await fn(); } finally { if (b) b.classList.remove('busy'); } }
  function dialog(title, bodyHtml, actions) {
    const d = document.createElement('dialog');
    d.innerHTML = `<div class="dh"><h3>${esc(title)}</h3><button class="iconbtn right" data-x aria-label="Close">${ICON.x}</button></div><div class="db">${bodyHtml}</div>${actions ? `<div class="df">${actions}</div>` : ''}`;
    document.body.appendChild(d); d.showModal(); d.addEventListener('close', () => d.remove());
    $('[data-x]', d).onclick = () => d.close(); return d;
  }
  function confirmBox(title, text, okLabel) {
    return new Promise(res => { const d = dialog(title, `<p>${esc(text)}</p>`, `<button class="btn" data-c>Cancel</button><button class="btn primary" data-o>${esc(okLabel || 'Confirm')}</button>`);
      $('[data-c]', d).onclick = () => { d.close(); res(false); }; $('[data-o]', d).onclick = () => { d.close(); res(true); }; d.addEventListener('cancel', () => res(false)); });
  }
  const ICON = {
    mark: '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="4.2" fill="currentColor"/><ellipse cx="16" cy="16" rx="13" ry="5.2" stroke="currentColor" stroke-width="1.4" transform="rotate(-28 16 16)"/><circle cx="27" cy="10.4" r="1.6" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V20H4z"/><path d="M10 20v-6h4v6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
    paper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 2 2.3 4.2 4.5 4.6l1-1 1.7.8c-.2 1-1 1.6-2 1.6-3.2 0-6.3-3-6.3-6.3 0-1 .6-1.8 1.6-2l.8 1.7z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>'
  };
  const orbitSvg = '<svg class="orbit" viewBox="0 0 720 720" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1"><ellipse cx="360" cy="360" rx="340" ry="128" transform="rotate(-24 360 360)" opacity=".5"/><ellipse cx="360" cy="360" rx="250" ry="92" transform="rotate(-24 360 360)" opacity=".4"/><ellipse cx="360" cy="360" rx="160" ry="60" transform="rotate(-24 360 360)" opacity=".35"/></g><g fill="currentColor"><circle cx="360" cy="360" r="5"/><circle cx="672" cy="221" r="4"/><circle cx="148" cy="451" r="3"/><circle cx="560" cy="300" r="2.5"/><circle cx="230" cy="420" r="2"/></g></svg>';

  function bizCard(b) {
    const cov = b.cover_url ? `<img src="${esc(b.cover_url)}" alt="" loading="lazy">` : '';
    const logo = b.logo_url ? `<img src="${esc(b.logo_url)}" alt="" loading="lazy">` : initials(b.name);
    return `<a class="biz" href="${bizUrl(b.slug)}"><div class="cov" ${b.brand_color && !b.cover_url ? `style="background:${esc(b.brand_color)}"` : ''}>${cov}<div class="logo">${logo}</div></div>
      <div class="body"><div class="row" style="gap:6px"><span class="name">${esc(b.name)}</span>${b.verified ? `<span class="chip ok tiny" title="Verified by MRET">${ICON.check} Verified</span>` : ''}</div>
      ${b.tagline ? `<div class="tag">${esc(b.tagline)}</div>` : ''}
      <div class="row tiny muted" style="gap:8px;margin-top:4px">${b.category ? `<span>${esc(b.category.name)}</span>` : ''}${b.city ? `<span>· ${esc(b.suburb ? b.suburb + ', ' : '')}${esc(b.city)}</span>` : ''}</div>
      ${b.founding_no ? `<div><span class="chip gold tiny">${ICON.star} Founding ${String(b.founding_no).padStart(4, '0')}</span></div>` : ''}</div></a>`;
  }

  // ---------- shell ----------
  const NAV = [['discover/', 'Discover'], ['founding-1000/', 'Founding 1,000'], ['connect/', 'Connect'], ['labs/', 'Labs'], ['press/', 'The Universe Times'], ['about/', 'About']];
  async function shell(opts) {
    const active = opts.nav || '';
    const header = document.createElement('header'); header.className = 'top';
    header.innerHTML = `<div class="wrap"><a class="brand" href="${url()}" aria-label="MRET Universe home"><span style="color:var(--accent)">${ICON.mark}</span><span>MRET <b>UNIVERSE</b></span></a>
      <nav class="nav" aria-label="Main">${NAV.map(([h, l]) => `<a href="${url(h)}" ${active === h ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
      <div class="acts"><button class="iconbtn" id="uvTheme" aria-label="Switch light or dark">${ICON.moon}</button><span id="uvAcct"></span>
      <button class="iconbtn menu-btn" id="uvMenu" aria-label="Menu" aria-expanded="false">${ICON.menu}</button></div></div>
      <nav class="drawer" id="uvDrawer" aria-label="Menu">${NAV.map(([h, l]) => `<a href="${url(h)}">${l}</a>`).join('')}<a href="${url('join/')}">Join the Founding 1,000</a><a href="${url('login/')}">Sign in</a></nav>`;
    document.body.prepend(header);
    $('#uvTheme').onclick = toggleTheme;
    $('#uvMenu').onclick = () => { const d = $('#uvDrawer'); d.classList.toggle('open'); $('#uvMenu').setAttribute('aria-expanded', d.classList.contains('open')); };
    const foot = document.createElement('footer'); foot.className = 'foot';
    foot.innerHTML = `<div class="wrap"><div class="cols">
      <div><a class="brand" href="${url()}" style="margin-bottom:10px"><span style="color:var(--accent)">${ICON.mark}</span><span>MRET <b>UNIVERSE</b></span></a><p>Every entrepreneur deserves a home.<br>One Universe. Endless opportunities.</p></div>
      <div><h4>Explore</h4><a href="${url('discover/')}">Discover businesses</a><a href="${url('press/')}">The Universe Times</a><a href="${url('labs/')}">Universe Labs</a><a href="${url('connect/')}">Universe Connect</a></div>
      <div><h4>Entrepreneurs</h4><a href="${url('founding-1000/')}">The Founding 1,000</a><a href="${url('join/')}">Create your business home</a><a href="${url('dashboard/')}">Your dashboard</a></div>
      <div><h4>MRET</h4><a href="${url('about/')}">About MRET Universe</a><a href="${url('about/#founder')}">The founder</a><a href="${url('privacy/')}">Privacy notice</a><a href="${url('terms/')}">Terms of use</a><a href="${C.site}/">mret.co.za</a></div>
    </div><p class="tiny" style="margin-top:28px">© ${new Date().getFullYear()} MRET. MRET Universe is in its pilot phase. Membership is free and does not represent equity, ownership or investment rights.</p></div>`;
    document.body.appendChild(foot);
    const m = await me();
    $('#uvAcct').innerHTML = m ? `<a class="btn sm" href="${url(m.role ? 'command/' : 'dashboard/')}">${m.role ? 'Command' : 'Dashboard'}</a>` : `<a class="btn sm ghost" href="${url('login/')}">Sign in</a><a class="btn sm gold" href="${url('join/')}" style="margin-left:4px">Join</a>`;
    return m;
  }

  async function page(opts) {
    opts = opts || {};
    const m = await shell(opts);
    if (opts.flag) { const f = await flags().catch(() => ({})); if (f[opts.flag] === false) { $('main').innerHTML = `<div class="wrap app"><div class="empty"><h3>Coming soon</h3><p>This part of MRET Universe is not open yet.</p><a class="btn" href="${url()}">Back to MRET Universe</a></div></div>`; return null; } }
    if (opts.auth && !m) { location.replace(url('login/?next=' + encodeURIComponent(location.pathname + location.search))); return null; }
    if (opts.track !== false) track('page_viewed');
    return m;
  }

  // ---------- media ----------
  async function resizeImage(file, max) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { if (file.type === 'image/gif' && file.size < 5e6) return file; throw new Error('Please choose a JPG, PNG or WebP image.'); }
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That image could not be read.')); i.src = URL.createObjectURL(file); });
    const s = Math.min(1, (max || 1600) / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.84));
  }
  async function upload(prefix, file, max) {
    const blob = await resizeImage(file, max);
    const path = prefix + '/' + uuid() + (blob.type === 'image/gif' ? '.gif' : '.jpg');
    const { error } = await sb.storage.from(C.bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000', upsert: false });
    if (error) throw new Error(error.message);
    return sb.storage.from(C.bucket).getPublicUrl(path).data.publicUrl;
  }
  let qrLib;
  async function qr(el, text, size) {
    if (!qrLib) qrLib = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    await qrLib; el.innerHTML = ''; new window.QRCode(el, { text, width: size || 180, height: size || 180, colorDark: '#0A0A0B', colorLight: '#FFFFFF', correctLevel: window.QRCode.CorrectLevel.M });
  }
  async function share(title, link) {
    track('share_clicked', { what: title.slice(0, 40) });
    if (navigator.share) { try { await navigator.share({ title, url: link }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch (e) { prompt('Copy this link', link); }
  }
  function spark(points, key, h) {
    const W = 600, H = h || 120, P = 22; const vals = points.map(p => p[key] || 0); const mx = Math.max(1, ...vals);
    const x = i => P + (W - 2 * P) * (points.length < 2 ? 0 : i / (points.length - 1)); const y = v => H - P - (H - 2 * P) * v / mx;
    const line = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const area = line + ` L${x(vals.length - 1).toFixed(1)} ${H - P} L${x(0).toFixed(1)} ${H - P} Z`;
    const first = points[0] ? points[0].d : '', last = points.length ? points[points.length - 1].d : '';
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(key)} per day, highest ${mx}"><line class="ax" x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}"/><path class="ar" d="${area}"/><path class="ln" d="${line}"/>
      <text x="${P}" y="${H - 4}">${esc(date(first))}</text><text x="${W - P}" y="${H - 4}" text-anchor="end">${esc(date(last))}</text><text x="${P}" y="14">${mx}</text></svg>`;
  }
  function bars(rows, label, value) {
    const mx = Math.max(1, ...rows.map(r => r[value] || 0));
    return rows.length ? `<div class="bars">${rows.map(r => `<div class="b"><span class="lab" title="${esc(r[label])}">${esc(r[label])}</span><span class="t"><i style="width:${(100 * (r[value] || 0) / mx).toFixed(1)}%"></i></span><span class="val">${num(r[value])}</span></div>`).join('')}</div>` : '<p class="muted small">No data in this period yet.</p>';
  }
  function formData(form) { const d = {}; new FormData(form).forEach((v, k) => { d[k] = typeof v === 'string' ? v.trim() : v; }); return d; }

  window.UV = { C, sb, $, $$, esc, store, uuid, url, qs, track, rpc, q, me, categories, flags, PROVINCES, num, date, ago, founding, initials, waLink, safeUrl, bizUrl,
    toast, busy, dialog, confirmBox, ICON, orbitSvg, bizCard, page, upload, qr, share, spark, bars, formData, anon: () => anon };
})();
