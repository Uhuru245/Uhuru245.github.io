/* MRET Sales OS: leads, appointments, listings (with commission), viewings, OTPs and daily prospecting, with conversion
   and growth stats. Data lives in the owner-only re_* tables in Supabase (row level security: only you can read or write). */
(function () {
  let sb = window.__cosSb; const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const R = n => n == null || isNaN(n) ? '–' : 'R ' + Math.round(Number(n)).toLocaleString('en-ZA');
  const N = n => n == null || isNaN(n) ? '–' : Math.round(Number(n)).toLocaleString('en-ZA');
  const P = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
  const TZ = 'Africa/Johannesburg', today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const ymd = ts => ts ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts)) : '';
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const days = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
  const fmtD = d => d ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(String(d).slice(0, 10) + 'T12:00:00Z')) : '–';
  const fmtDT = d => d ? new Intl.DateTimeFormat('en-ZA', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d)) : '–';
  const lab = s => String(s || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  const toast = m => window.__cosToast ? window.__cosToast(m) : alert(m);
  const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

  const OPT = {
    kind: ['buyer', 'seller', 'landlord', 'tenant', 'investor', 'other'],
    source: ['property24', 'private_property', 'kw_homes', 'referral', 'sphere', 'past_client', 'signboard', 'show_day', 'social_media', 'walk_in', 'cold_call', 'door_knocking', 'website', 'other'],
    leadStatus: ['new', 'contacted', 'qualified', 'appointment', 'client', 'nurture', 'lost'],
    apptKind: ['listing_presentation', 'valuation', 'buyer_consultation', 'rental_consultation', 'follow_up', 'other'],
    apptStatus: ['booked', 'held', 'no_show', 'cancelled', 'rescheduled'],
    apptOutcome: ['pending', 'mandate_signed', 'buyer_signed', 'follow_up', 'thinking', 'lost', 'not_applicable'],
    ptype: ['house', 'townhouse', 'cluster', 'apartment', 'vacant_land', 'farm', 'commercial', 'industrial', 'other'],
    dealType: ['sale', 'rental'], mandate: ['sole', 'open', 'dual', 'joint'],
    listStatus: ['active', 'under_offer', 'sold', 'withdrawn', 'expired', 'rented'],
    vKind: ['private', 'show_day', 'virtual'], interest: ['hot', 'warm', 'cold'], priceFb: ['too_high', 'fair', 'good_value', 'unknown'],
    side: ['listing', 'selling', 'both'], offerStatus: ['submitted', 'countered', 'accepted', 'declined', 'lapsed', 'cancelled', 'registered'],
    finance: ['bond', 'cash', 'bond_and_cash', 'subject_to_sale']
  };
  const S = { sub: localStorage.getItem('cos.sales.sub') || 'dash', period: localStorage.getItem('cos.sales.period') || 'month', q: '', listingFilter: '' };
  let D = null;

  /* ---------- commission (KW Edge cost of sale) ---------- */
  function comm(price, pct, incl, share, ref) {
    const gross = (Number(price) || 0) * (Number(pct) || 0) / 100 / (incl ? 1.15 : 1);
    const gci = gross * (Number(share == null ? 100 : share) / 100) * (1 - (Number(ref) || 0) / 100);
    const me = window.__cosMe || {}, pc = !!me.pc, capped = !!me.capped;
    const net = gci * (pc ? 0.9 : 1) * 0.92 * (capped ? 1 : 0.7) * 0.8;
    return { gross, gci, net };
  }
  const offerComm = o => { const l = o.listing_id && D.lstById[o.listing_id]; return comm(o.offer_price, o.commission_pct != null ? o.commission_pct : l ? l.commission_pct : 0, o.commission_pct != null ? o.commission_incl_vat : l ? l.commission_incl_vat : true, o.my_share_pct, o.referral_fee_pct); };

  /* ---------- data ---------- */
  async function load() {
    const q = (t, o) => sb.from(t).select('*').order(o, { ascending: false }).range(0, 4999).then(r => { if (r.error) throw r.error; return r.data || []; });
    const [leads, listings, hist, appts, views, offers, daily] = await Promise.all([q('re_leads', 'received_at'), q('re_listings', 'mandate_start'), q('re_listing_history', 'at'), q('re_appointments', 'scheduled_at'), q('re_viewings', 'viewed_at'), q('re_offers', 'offer_date'), q('re_daily', 'day')]);
    const soft = (t, o) => q(t, o).catch(() => []);
    const [comms, tasks, tpls] = await Promise.all([soft('re_comms', 'at'), soft('re_tasks', 'created_at'), soft('re_templates', 'updated_at')]);
    D = { leads, listings, hist, appts, views, offers, daily, comms, tasks, tpls, leadById: {}, lstById: {}, offerById: {} };
    leads.forEach(l => D.leadById[l.id] = l); listings.forEach(l => D.lstById[l.id] = l); offers.forEach(o => D.offerById[o.id] = o);
    if (window.SalesComms) { try { if (await window.SalesComms.sync()) D.tasks = await soft('re_tasks', 'created_at'); } catch (e) { console.warn('checklist sync', e); } }
  }
  async function save(table, row, id) {
    const r = id ? await sb.from(table).update(row).eq('id', id).select().single() : await sb.from(table).insert(row).select().single();
    if (r.error) throw new Error(friendly(r.error.message)); return r.data;
  }
  const friendly = m => /row-level security|not yours/i.test(m) ? 'That record is not yours.' : /re_daily_owner_user_id_day_key|duplicate/i.test(m) ? 'There is already an entry for that day.' : /check constraint/i.test(m) ? 'One of the values is not allowed. Check the numbers and dates.' : m;

  /* ---------- periods ---------- */
  function range(p) {
    const t = today(), m0 = t.slice(0, 8) + '01';
    if (p === 'month') return [m0, t, 'This month'];
    if (p === 'last_month') { const e = addDays(m0, -1); return [e.slice(0, 8) + '01', e, 'Last month']; }
    if (p === '90') return [addDays(t, -89), t, 'Last 90 days'];
    if (p === 'ytd') return [t.slice(0, 5) + '01-01', t, 'Year to date'];
    return [addDays(t, -364), t, 'Last 12 months'];
  }
  const prevRange = ([a, b]) => { const n = days(a, b) + 1; return [addDays(a, -n), addDays(a, -1)]; };
  const inR = (d, [a, b]) => d && d >= a && d <= b;

  /* ---------- metrics ---------- */
  function metrics(r) {
    const m = {};
    m.leads = D.leads.filter(l => inR(ymd(l.received_at), r));
    m.contacted = m.leads.filter(l => l.first_contact_at);
    m.respH = m.contacted.map(l => (new Date(l.first_contact_at) - new Date(l.received_at)) / 36e5).filter(h => h >= 0);
    m.apptsBooked = D.appts.filter(a => inR(ymd(a.created_at), r));
    m.apptsDue = D.appts.filter(a => inR(ymd(a.scheduled_at), r));
    m.held = m.apptsDue.filter(a => a.status === 'held'); m.noShow = m.apptsDue.filter(a => a.status === 'no_show');
    m.listAppts = m.held.filter(a => a.kind === 'listing_presentation' || a.kind === 'valuation');
    m.mandates = D.listings.filter(l => inR(l.mandate_start, r));
    m.viewings = D.views.filter(v => inR(ymd(v.viewed_at), r));
    m.viewGroups = m.viewings.reduce((t, v) => t + (v.groups || 1), 0);
    m.otps = D.offers.filter(o => inR(o.offer_date, r));
    m.accepted = D.offers.filter(o => inR(o.accepted_date, r));
    m.registered = D.offers.filter(o => o.status === 'registered' && inR(o.registration_date, r));
    m.fell = D.offers.filter(o => o.accepted_date && ['cancelled', 'lapsed'].includes(o.status) && inR(o.accepted_date, r));
    m.gciReg = m.registered.reduce((t, o) => t + offerComm(o).gci, 0);
    m.netReg = m.registered.reduce((t, o) => t + offerComm(o).net, 0);
    m.gciAcc = m.accepted.reduce((t, o) => t + offerComm(o).gci, 0);
    m.daily = D.daily.filter(x => inR(x.day, r));
    m.contacts = m.daily.reduce((t, x) => t + x.contacts, 0); m.convos = m.daily.reduce((t, x) => t + x.conversations, 0); m.hours = m.daily.reduce((t, x) => t + x.lead_gen_minutes, 0) / 60;
    // listings that reached an accepted offer in the period: days on market and list-to-sale ratio
    const sold = m.accepted.filter(o => o.listing_id && D.lstById[o.listing_id]);
    m.dom = sold.map(o => days(D.lstById[o.listing_id].mandate_start, o.accepted_date)).filter(x => x >= 0);
    m.l2s = sold.map(o => o.offer_price / (D.lstById[o.listing_id].original_price || D.lstById[o.listing_id].list_price));
    m.acc2reg = m.registered.filter(o => o.accepted_date).map(o => days(o.accepted_date, o.registration_date));
    return m;
  }
  function pipeline() {
    const pend = D.offers.filter(o => o.status === 'accepted');
    return { pend, gci: pend.reduce((t, o) => t + offerComm(o).gci, 0), net: pend.reduce((t, o) => t + offerComm(o).net, 0), active: D.listings.filter(l => l.status === 'active' || l.status === 'under_offer'), stock: D.listings.filter(l => l.status === 'active').reduce((t, l) => t + comm(l.list_price, l.commission_pct, l.commission_incl_vat, l.my_share_pct, l.referral_fee_pct).gci, 0) };
  }
  const chg = (a, b) => { if (b == null) return ''; if (!b) return a ? '<span class="up">new</span>' : ''; const p = Math.round((a - b) / b * 100); return '<span class="' + (p >= 0 ? 'up' : 'down') + '">' + (p >= 0 ? '+' : '') + p + '%</span> vs ' + N(b); };
  const kpi = (l, v, s) => '<div class="card kpi"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + (s || '') + '</div></div>';

  /* ---------- dashboard ---------- */
  function vDash() {
    const r = range(S.period), pr = prevRange(r), m = metrics(r), p = metrics(pr), pl = pipeline();
    const per = '<div class="row" style="margin:6px 0 4px">' + [['month', 'This month'], ['last_month', 'Last month'], ['90', 'Last 90 days'], ['ytd', 'Year to date'], ['12m', 'Last 12 months']].map(x => '<button class="btn' + (S.period === x[0] ? ' red' : '') + '" data-period="' + x[0] + '">' + x[1] + '</button>').join('') + '</div><p class="small muted">' + fmtD(r[0]) + ' to ' + fmtD(r[1]) + ', compared with ' + fmtD(pr[0]) + ' to ' + fmtD(pr[1]) + '.</p>';
    let h = per + '<div class="grid g4">' + kpi('Leads', N(m.leads.length), chg(m.leads.length, p.leads.length)) + kpi('Appointments held', N(m.held.length), chg(m.held.length, p.held.length)) + kpi('Listings taken', N(m.mandates.length), chg(m.mandates.length, p.mandates.length)) + kpi('Viewings', N(m.viewings.length), chg(m.viewings.length, p.viewings.length))
      + kpi('OTPs written', N(m.otps.length), chg(m.otps.length, p.otps.length)) + kpi('OTPs accepted', N(m.accepted.length), chg(m.accepted.length, p.accepted.length)) + kpi('Registrations', N(m.registered.length), chg(m.registered.length, p.registered.length)) + kpi('GCI registered', R(m.gciReg), 'Take-home about ' + R(m.netReg)) + '</div>';
    h += '<div class="grid g4" style="margin-top:12px">' + kpi('Pending GCI', R(pl.gci), pl.pend.length + ' accepted OTP' + (pl.pend.length === 1 ? '' : 's') + ', take-home about ' + R(pl.net)) + kpi('Commission in stock', R(pl.stock), D.listings.filter(l => l.status === 'active').length + ' active listings at list price') + kpi('Prospecting', N(m.contacts) + ' contacts', N(m.convos) + ' conversations, ' + (Math.round(m.hours * 10) / 10) + ' lead-gen hours') + kpi('Lead response', m.respH.length ? (median(m.respH) < 1 ? Math.round(median(m.respH) * 60) + ' min' : (Math.round(median(m.respH) * 10) / 10) + ' h') : '–', 'Median time from lead to first contact') + '</div>';
    const stages = [
      ['Leads received', m.leads.length, '', ''],
      ['Contacted', m.contacted.length, P(m.contacted.length, m.leads.length), 'of leads'],
      ['Appointments held', m.held.length, P(m.held.length, m.leads.length), 'of leads'],
      ['Listings taken', m.mandates.length, P(m.mandates.length, m.listAppts.length), 'of listing appointments held'],
      ['Viewings', m.viewings.length, m.mandates.length || D.listings.length ? (m.viewings.length / Math.max(1, pl.active.length)).toFixed(1) : '–', 'per active listing'],
      ['OTPs written', m.otps.length, m.otps.length ? (m.viewings.length / m.otps.length).toFixed(1) : '–', 'viewings per OTP'],
      ['OTPs accepted', m.accepted.length, P(m.accepted.length, m.otps.length), 'of OTPs written'],
      ['Registered', m.registered.length, P(m.registered.length, m.registered.length + m.fell.length), 'of accepted deals that closed (fell through: ' + m.fell.length + ')']
    ];
    const max = Math.max(1, ...stages.map(s => s[1]));
    h += '<h2>Conversion funnel</h2><div class="card"><table class="funnel"><thead><tr><th>Stage</th><th class="n">Count</th><th>Conversion</th><th style="width:34%"></th></tr></thead><tbody>' + stages.map(s => '<tr><td>' + s[0] + '</td><td class="n"><b>' + N(s[1]) + '</b></td><td>' + (s[2] ? '<b>' + s[2] + '</b> <span class="small muted">' + s[3] + '</span>' : '') + '</td><td><div class="bar"><div style="width:' + Math.max(2, s[1] / max * 100) + '%"></div></div></td></tr>').join('') + '</tbody></table></div>';
    h += '<h2>Quality and speed</h2><div class="grid g4">' + kpi('Appointment show rate', P(m.held.length, m.held.length + m.noShow.length), m.noShow.length + ' no-shows') + kpi('Average days on market', m.dom.length ? N(avg(m.dom)) : '–', 'Mandate to accepted OTP') + kpi('List-to-sale price', m.l2s.length ? Math.round(avg(m.l2s) * 1000) / 10 + '%' : '–', 'Accepted price vs original list price') + kpi('Accepted to registered', m.acc2reg.length ? N(avg(m.acc2reg)) + ' days' : '–', 'Average transfer time') + '</div>';
    h += vSources(r) + vHistory() + vNeed();
    return h;
  }
  function vSources(r) {
    const rows = OPT.source.map(src => {
      const L = D.leads.filter(l => l.source === src && inR(ymd(l.received_at), r)), ids = new Set(L.map(l => l.id));
      const allIds = new Set(D.leads.filter(l => l.source === src).map(l => l.id));
      const ap = D.appts.filter(a => a.lead_id && ids.has(a.lead_id) && a.status === 'held').length;
      const ls = D.listings.filter(l => l.seller_lead_id && allIds.has(l.seller_lead_id) && inR(l.mandate_start, r)).length;
      const deals = D.offers.filter(o => inR(o.accepted_date, r) && ((o.buyer_lead_id && allIds.has(o.buyer_lead_id)) || (o.listing_id && D.lstById[o.listing_id] && allIds.has(D.lstById[o.listing_id].seller_lead_id))));
      return { src, leads: L.length, ap, ls, deals: deals.length, gci: deals.reduce((t, o) => t + offerComm(o).gci, 0) };
    }).filter(x => x.leads || x.ls || x.deals).sort((a, b) => b.gci - a.gci || b.leads - a.leads);
    return '<h2>Lead sources</h2><div class="card wrap">' + (rows.length ? '<table><thead><tr><th>Source</th><th class="n">Leads</th><th class="n">Appointments held</th><th class="n">Listings</th><th class="n">Deals accepted</th><th class="n">Lead to deal</th><th class="n">GCI</th></tr></thead><tbody>' + rows.map(x => '<tr><td>' + lab(x.src) + '</td><td class="n">' + x.leads + '</td><td class="n">' + x.ap + '</td><td class="n">' + x.ls + '</td><td class="n">' + x.deals + '</td><td class="n">' + P(x.deals, x.leads) + '</td><td class="n">' + R(x.gci) + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty">Add leads with their source to see which sources pay.</div>') + '</div>';
  }
  function vHistory() {
    const t = today(), months = []; for (let i = 11; i >= 0; i--) { const d = new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1 - i, 1)); months.push(d.toISOString().slice(0, 7)); }
    const rows = months.map(mo => { const e = new Date(Date.UTC(Number(mo.slice(0, 4)), Number(mo.slice(5, 7)), 0)).toISOString().slice(0, 10), m = metrics([mo + '-01', e]); return { mo, leads: m.leads.length, held: m.held.length, lst: m.mandates.length, view: m.viewings.length, otp: m.otps.length, acc: m.accepted.length, reg: m.registered.length, gci: m.gciReg, contacts: m.contacts }; });
    const cols = [['leads', 'Leads'], ['held', 'Appts held'], ['lst', 'Listings'], ['view', 'Viewings'], ['otp', 'OTPs'], ['acc', 'Accepted'], ['reg', 'Registered'], ['gci', 'GCI'], ['contacts', 'Contacts']];
    const spark = k => { const v = rows.map(r => r[k]), mx = Math.max(1, ...v); return '<svg viewBox="0 0 120 26" class="spark" preserveAspectRatio="none">' + v.map((x, i) => '<rect x="' + (i * 10 + 1) + '" y="' + (26 - Math.max(1, x / mx * 24)) + '" width="8" height="' + Math.max(1, x / mx * 24) + '" rx="1"' + (i === 11 ? ' class="cur"' : '') + '></rect>').join('') + '</svg>'; };
    const last = rows[11], prev = rows[10], best = k => Math.max(...rows.slice(0, 11).map(r => r[k]));
    return '<h2>Growth: last 12 months</h2><div class="grid g3" style="margin-bottom:12px">' + cols.slice(0, 9).map(([k, l]) => '<div class="card kpi"><div class="l">' + l + '</div><div class="v">' + (k === 'gci' ? R(last[k]) : N(last[k])) + '</div><div class="s">This month ' + chg(last[k], prev[k]) + ' last month' + (last[k] > best(k) && last[k] > 0 ? ' <b class="up">Best month</b>' : '') + '</div>' + spark(k) + '</div>').join('') + '</div>'
      + '<div class="card wrap"><table><thead><tr><th>Month</th>' + cols.map(c => '<th class="n">' + c[1] + '</th>').join('') + '</tr></thead><tbody>' + rows.slice().reverse().map(r => '<tr><td>' + new Intl.DateTimeFormat('en-ZA', { month: 'short', year: 'numeric' }).format(new Date(r.mo + '-15T12:00:00Z')) + '</td>' + cols.map(c => '<td class="n">' + (c[0] === 'gci' ? R(r[c[0]]) : N(r[c[0]])) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function vNeed() {
    const T = window.__cosTargets || { dealTarget: 4 }, m = metrics([addDays(today(), -364), today()]);
    const rate = (a, b, d) => b >= 5 && a > 0 ? a / b : d;
    const reg = rate(m.registered.length, m.registered.length + m.fell.length, 0.8), acc = rate(m.accepted.length, m.otps.length, 0.6), vpo = m.otps.length >= 3 ? m.viewings.length / m.otps.length : 8, apl = rate(m.held.length, m.leads.length, 0.25);
    const own = m.otps.length >= 5 && m.leads.length >= 20;
    const otpsN = Math.ceil(T.dealTarget / reg / acc), viewsN = Math.ceil(otpsN * vpo), deals = T.dealTarget;
    return '<h2>What it takes to close ' + deals + ' deals a month</h2><div class="card"><p class="small muted" style="margin-top:0">Worked backwards from ' + (own ? 'your own conversion rates over the last 12 months' : 'starter ratios (80% of accepted deals register, 60% of OTPs accepted, 8 viewings per OTP, 25% of leads to appointments) until you have enough history; it switches to your own rates automatically') + '.</p><div class="grid g4">' + kpi('OTPs to write', otpsN, 'a month') + kpi('Viewings', viewsN, 'a month, about ' + Math.ceil(viewsN / 4.3) + ' a week') + kpi('Appointments held', Math.ceil(deals / Math.max(0.05, rate(m.accepted.length, m.held.length, 0.3))), 'a month') + kpi('Leads', Math.ceil(deals / Math.max(0.02, rate(m.accepted.length, m.leads.length, 0.05))), 'a month, at ' + Math.round(apl * 100) + '% to appointment') + '</div></div>';
  }

  /* ---------- lists ---------- */
  const search = () => '<input class="inp" id="soQ" placeholder="Search" value="' + esc(S.q) + '" style="max-width:260px">';
  const match = (o, ...f) => !S.q || f.some(x => String(x || '').toLowerCase().includes(S.q.toLowerCase()));
  function vLeads() {
    const t = today(), rows = D.leads.filter(l => match(l, l.name, l.phone, l.email, l.area, l.source, l.status));
    const overdue = D.leads.filter(l => l.next_action_date && l.next_action_date < t && !['client', 'lost'].includes(l.status)).length;
    return '<div class="row"><button class="btn red" data-new="lead">Add lead</button>' + search() + '<span class="small muted">' + D.leads.length + ' leads, ' + D.leads.filter(l => l.status === 'new').length + ' not yet contacted, ' + overdue + ' follow-ups overdue</span></div>'
      + '<div class="card wrap" style="margin-top:12px">' + (rows.length ? '<table><thead><tr><th>Received</th><th>Name</th><th>Type</th><th>Source</th><th>Area / budget</th><th>Status</th><th>Next action</th><th></th></tr></thead><tbody>' + rows.map(l => '<tr><td>' + fmtD(l.received_at) + '</td><td><b>' + esc(l.name) + '</b><div class="small muted">' + esc(l.phone || '') + '</div></td><td>' + lab(l.kind) + '</td><td>' + lab(l.source) + '</td><td>' + esc(l.area || '') + (l.budget ? '<div class="small muted">' + R(l.budget) + '</div>' : '') + '</td><td>' + lab(l.status) + '</td><td' + (l.next_action_date && l.next_action_date < t && !['client', 'lost'].includes(l.status) ? ' class="down"' : '') + '>' + esc(l.next_action || '') + (l.next_action_date ? '<div class="small">' + fmtD(l.next_action_date) + '</div>' : '') + '</td><td class="act"><button class="btn sm" data-msg="lead:' + l.id + '">Message</button>' + (l.first_contact_at ? '' : '<button class="btn sm" data-contacted="' + l.id + '">Contacted now</button>') + '<button class="btn sm" data-edit="lead:' + l.id + '">Edit</button></td></tr>').join('') + '</tbody></table>' : '<div class="empty">No leads yet. Add every enquiry here, with its source, so you can see which sources pay.</div>') + '</div>';
  }
  function vAppts() {
    const now = new Date().toISOString(), up = D.appts.filter(a => a.scheduled_at >= now && a.status === 'booked').sort((a, b) => a.scheduled_at < b.scheduled_at ? -1 : 1), past = D.appts.filter(a => !(a.scheduled_at >= now && a.status === 'booked'));
    const row = a => '<tr><td>' + fmtDT(a.scheduled_at) + '</td><td>' + lab(a.kind) + '</td><td>' + esc(a.lead_id && D.leadById[a.lead_id] ? D.leadById[a.lead_id].name : '') + (a.listing_id && D.lstById[a.listing_id] ? '<div class="small muted">' + esc(D.lstById[a.listing_id].address) + '</div>' : '') + '</td><td>' + lab(a.status) + '</td><td>' + lab(a.outcome) + '</td><td class="act">' + (a.status === 'booked' ? '<button class="btn sm" data-held="' + a.id + '">Held</button><button class="btn sm" data-noshow="' + a.id + '">No-show</button>' : '') + '<button class="btn sm" data-edit="appt:' + a.id + '">Edit</button></td></tr>';
    const tbl = list => '<table><thead><tr><th>When</th><th>Type</th><th>With</th><th>Status</th><th>Outcome</th><th></th></tr></thead><tbody>' + list.map(row).join('') + '</tbody></table>';
    return '<div class="row"><button class="btn red" data-new="appt">Book appointment</button></div><h2>Upcoming</h2><div class="card wrap">' + (up.length ? tbl(up) : '<div class="empty">Nothing booked ahead.</div>') + '</div><h2>Past</h2><div class="card wrap">' + (past.length ? tbl(past) : '<div class="empty">No past appointments yet.</div>') + '</div>';
  }
  function lstStats(l) {
    const v = D.views.filter(x => x.listing_id === l.id), o = D.offers.filter(x => x.listing_id === l.id), cuts = D.hist.filter(h => h.listing_id === l.id && h.event === 'price_change' && Number(h.new_price) < Number(h.old_price)).length;
    const dom = days(l.mandate_start, ['active', 'under_offer'].includes(l.status) ? today() : ymd(l.status_changed_at) || today());
    const c = comm(l.list_price, l.commission_pct, l.commission_incl_vat, l.my_share_pct, l.referral_fee_pct);
    return { v, o, cuts, dom, c, exp: l.mandate_expiry ? days(today(), l.mandate_expiry) : null, groups: v.reduce((t, x) => t + (x.groups || 1), 0) };
  }
  function vListings() {
    const rows = D.listings.filter(l => (!S.listingFilter || l.status === S.listingFilter) && match(l, l.ref, l.address, l.suburb, l.status));
    const f = '<select class="inp" id="soLF" style="width:auto"><option value="">All statuses</option>' + OPT.listStatus.map(s => '<option value="' + s + '"' + (S.listingFilter === s ? ' selected' : '') + '>' + lab(s) + '</option>').join('') + '</select>';
    return '<div class="row"><button class="btn red" data-new="listing">Add listing</button>' + search() + f + '</div>'
      + '<div class="card wrap" style="margin-top:12px">' + (rows.length ? '<table><thead><tr><th>Listing</th><th class="n">Price</th><th>Mandate</th><th class="n">Days on market</th><th class="n">Viewings</th><th class="n">Offers</th><th class="n">My GCI</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(l => { const s = lstStats(l); return '<tr><td><b>' + esc(l.address) + '</b><div class="small muted">' + esc([l.ref, l.suburb, lab(l.property_type)].filter(Boolean).join(' · ')) + '</div></td><td class="n">' + R(l.list_price) + (s.cuts ? '<div class="small down">' + s.cuts + ' reduction' + (s.cuts === 1 ? '' : 's') + ' from ' + R(l.original_price) + '</div>' : '') + '</td><td>' + lab(l.mandate_type) + (s.exp != null ? '<div class="small ' + (s.exp < 0 ? 'down' : s.exp <= 30 ? 'warn' : 'muted') + '">' + (s.exp < 0 ? 'Expired ' + (-s.exp) + ' days ago' : 'Expires in ' + s.exp + ' days') + '</div>' : '') + '</td><td class="n">' + s.dom + '</td><td class="n">' + s.v.length + '</td><td class="n">' + s.o.length + '</td><td class="n">' + R(s.c.gci) + '<div class="small muted">' + l.commission_pct + '%' + (l.commission_incl_vat ? ' incl VAT' : '') + (l.my_share_pct < 100 ? ', my share ' + l.my_share_pct + '%' : '') + '</div></td><td>' + lab(l.status) + '</td><td class="act"><button class="btn sm" data-open="' + l.id + '">Open</button></td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No listings yet. Add each mandate with its commission so the system can work out your income and stock.</div>') + '</div>';
  }
  function vViewings() {
    const rows = D.views.filter(v => (!S.listingFilter || v.listing_id === S.listingFilter) && match(v, v.viewer_name, v.feedback, D.lstById[v.listing_id] && D.lstById[v.listing_id].address));
    const f = '<select class="inp" id="soVF" style="width:auto"><option value="">All listings</option>' + D.listings.map(l => '<option value="' + l.id + '"' + (S.listingFilter === l.id ? ' selected' : '') + '>' + esc(l.address) + '</option>').join('') + '</select>';
    return '<div class="row"><button class="btn red" data-new="viewing">Record viewing</button>' + search() + f + '</div>'
      + '<div class="card wrap" style="margin-top:12px">' + (rows.length ? '<table><thead><tr><th>When</th><th>Property</th><th>Viewer</th><th>Type</th><th>Interest</th><th>Price feedback</th><th>Feedback</th><th></th></tr></thead><tbody>' + rows.map(v => '<tr><td>' + fmtDT(v.viewed_at) + '</td><td>' + esc(D.lstById[v.listing_id] ? D.lstById[v.listing_id].address : '') + '</td><td>' + esc(v.lead_id && D.leadById[v.lead_id] ? D.leadById[v.lead_id].name : v.viewer_name || '') + (v.groups > 1 ? '<div class="small muted">' + v.groups + ' groups</div>' : '') + '</td><td>' + lab(v.kind) + '</td><td class="' + (v.interest === 'hot' ? 'up' : v.interest === 'cold' ? 'muted' : '') + '">' + lab(v.interest) + '</td><td>' + lab(v.price_feedback) + '</td><td class="small">' + esc(v.feedback || '') + '</td><td class="act"><button class="btn sm" data-edit="viewing:' + v.id + '">Edit</button></td></tr>').join('') + '</tbody></table>' : '<div class="empty">No viewings recorded. Record every viewing against its property: it drives your seller feedback reports and your viewings-per-offer ratio.</div>') + '</div>';
  }
  function vOffers() {
    const t = today(), open = D.offers.filter(o => ['submitted', 'countered', 'accepted'].includes(o.status)), closed = D.offers.filter(o => !['submitted', 'countered', 'accepted'].includes(o.status));
    const name = o => o.listing_id && D.lstById[o.listing_id] ? D.lstById[o.listing_id].address : o.property_text || '';
    const row = o => { const c = offerComm(o), bd = o.status === 'accepted' && o.bond_due_date && !o.bond_approved_date ? days(t, o.bond_due_date) : null; return '<tr><td>' + fmtD(o.offer_date) + '</td><td><b>' + esc(name(o)) + '</b><div class="small muted">' + lab(o.side) + ' side' + (o.buyer_lead_id && D.leadById[o.buyer_lead_id] ? ', buyer ' + esc(D.leadById[o.buyer_lead_id].name) : '') + '</div></td><td class="n">' + R(o.offer_price) + '</td><td>' + lab(o.status) + (o.accepted_date ? '<div class="small muted">Accepted ' + fmtD(o.accepted_date) + '</div>' : '') + '</td><td>' + lab(o.finance) + (bd != null ? '<div class="small ' + (bd < 0 ? 'down' : bd <= 7 ? 'warn' : 'muted') + '">' + (bd < 0 ? 'Bond overdue ' + (-bd) + ' days' : 'Bond due in ' + bd + ' days') + '</div>' : o.bond_approved_date ? '<div class="small up">Bond approved ' + fmtD(o.bond_approved_date) + '</div>' : '') + '</td><td>' + (o.registration_date ? 'Registered ' + fmtD(o.registration_date) : o.lodgement_date ? 'Lodged ' + fmtD(o.lodgement_date) : '') + '</td><td class="n">' + R(c.gci) + '<div class="small muted">take-home ' + R(c.net) + '</div></td><td class="act">' + (['accepted', 'registered'].includes(o.status) ? '<button class="btn sm" data-flow="' + o.id + '">Checklist</button>' : '') + '<button class="btn sm" data-edit="offer:' + o.id + '">Update</button></td></tr>'; };
    const tbl = l => '<table><thead><tr><th>Date</th><th>Property</th><th class="n">Offer</th><th>Status</th><th>Finance</th><th>Transfer</th><th class="n">My GCI</th><th></th></tr></thead><tbody>' + l.map(row).join('') + '</tbody></table>';
    const pl = pipeline();
    return '<div class="row"><button class="btn red" data-new="offer">Record OTP</button><span class="small muted">Pending (accepted, not yet registered): ' + pl.pend.length + ' deals, ' + R(pl.gci) + ' GCI, about ' + R(pl.net) + ' take-home</span></div><h2>Open</h2><div class="card wrap">' + (open.length ? tbl(open) : '<div class="empty">No open offers.</div>') + '</div><h2>Closed</h2><div class="card wrap">' + (closed.length ? tbl(closed) : '<div class="empty">None yet.</div>') + '</div>';
  }
  function vDaily() {
    const t = today(), me = D.daily.find(x => x.day === t) || {}, last = D.daily.slice(0, 28);
    const wk = []; for (let i = 7; i >= 0; i--) { const s = addDays(t, -((new Date(t).getDay() + 6) % 7) - i * 7), e = addDays(s, 6), r = D.daily.filter(x => x.day >= s && x.day <= e); wk.push({ s, c: r.reduce((a, x) => a + x.contacts, 0), v: r.reduce((a, x) => a + x.conversations, 0), h: r.reduce((a, x) => a + x.lead_gen_minutes, 0) / 60 }); }
    return '<div class="card"><h3>Today, ' + fmtD(t) + '</h3><div class="grid g4"><label class="f">Contacts made<input class="inp" type="number" min="0" id="dC" value="' + (me.contacts || 0) + '"></label><label class="f">Conversations<input class="inp" type="number" min="0" id="dV" value="' + (me.conversations || 0) + '"></label><label class="f">Lead-gen minutes<input class="inp" type="number" min="0" step="15" id="dM" value="' + (me.lead_gen_minutes || 0) + '"></label><label class="f">Note<input class="inp" id="dN" value="' + esc(me.notes || '') + '"></label></div><div class="row" style="margin-top:10px"><button class="btn red" id="dSave">Save today</button><span class="small muted">Target: 20 contacts and 3 hours of lead generation a day.</span></div></div>'
      + '<h2>Last 8 weeks</h2><div class="card wrap"><table><thead><tr><th>Week of</th><th class="n">Contacts</th><th class="n">Conversations</th><th class="n">Conversation rate</th><th class="n">Lead-gen hours</th></tr></thead><tbody>' + wk.slice().reverse().map(w => '<tr><td>' + fmtD(w.s) + '</td><td class="n">' + w.c + '</td><td class="n">' + w.v + '</td><td class="n">' + P(w.v, w.c) + '</td><td class="n">' + Math.round(w.h * 10) / 10 + '</td></tr>').join('') + '</tbody></table></div>'
      + '<h2>Recent days</h2><div class="card wrap">' + (last.length ? '<table><thead><tr><th>Day</th><th class="n">Contacts</th><th class="n">Conversations</th><th class="n">Minutes</th><th>Note</th></tr></thead><tbody>' + last.map(x => '<tr><td>' + fmtD(x.day) + '</td><td class="n">' + x.contacts + '</td><td class="n">' + x.conversations + '</td><td class="n">' + x.lead_gen_minutes + '</td><td class="small">' + esc(x.notes || '') + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty">Log today above.</div>') + '</div>';
  }

  /* ---------- forms ---------- */
  const sel = (name, opts, v, blank) => '<select class="inp" name="' + name + '">' + (blank ? '<option value="">' + blank + '</option>' : '') + opts.map(o => Array.isArray(o) ? '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>' : '<option value="' + o + '"' + (v === o ? ' selected' : '') + '>' + lab(o) + '</option>').join('') + '</select>';
  const inp = (name, v, type, extra) => '<input class="inp" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(v == null ? '' : v) + '"' + (extra || '') + '>';
  const fld = (l, h, wide) => '<label class="f' + (wide ? ' wide' : '') + '">' + l + h + '</label>';
  const leadOpts = kinds => D.leads.filter(l => !kinds || kinds.includes(l.kind)).map(l => [l.id, l.name + (l.area ? ' (' + l.area + ')' : '')]);
  const lstOpts = () => D.listings.map(l => [l.id, l.address + (l.ref ? ' · ' + l.ref : '')]);
  const localDT = ts => { if (!ts) return ''; const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  const nowLocal = () => localDT(new Date().toISOString());
  const FORMS = {
    lead: (x = {}) => ['re_leads', 'Lead', fld('Name', inp('name', x.name, 'text', ' required maxlength="120"')) + fld('Phone', inp('phone', x.phone)) + fld('Email', inp('email', x.email, 'email')) + fld('Type', sel('kind', OPT.kind, x.kind || 'buyer')) + fld('Source', sel('source', OPT.source, x.source || 'property24')) + fld('Area', inp('area', x.area)) + fld('Budget or value (R)', inp('budget', x.budget, 'number', ' min="0"')) + fld('Status', sel('status', OPT.leadStatus, x.status || 'new')) + fld('Received', inp('received_at', localDT(x.received_at) || nowLocal(), 'datetime-local')) + fld('First contacted', inp('first_contact_at', localDT(x.first_contact_at), 'datetime-local')) + fld('Next action', inp('next_action', x.next_action)) + fld('Next action date', inp('next_action_date', x.next_action_date, 'date')) + fld('Where the details came from (POPIA)', inp('contact_basis', x.contact_basis || 'Enquiry made by the person'), true) + fld('Lost reason', inp('lost_reason', x.lost_reason), true) + fld('Notes', '<textarea class="inp" name="notes" rows="3">' + esc(x.notes || '') + '</textarea>', true)],
    appt: (x = {}) => ['re_appointments', 'Appointment', fld('Type', sel('kind', OPT.apptKind, x.kind || 'listing_presentation')) + fld('When', inp('scheduled_at', localDT(x.scheduled_at) || nowLocal(), 'datetime-local', ' required')) + fld('Lead', sel('lead_id', leadOpts(), x.lead_id, 'None')) + fld('Listing', sel('listing_id', lstOpts(), x.listing_id, 'None')) + fld('Status', sel('status', OPT.apptStatus, x.status || 'booked')) + fld('Outcome', sel('outcome', OPT.apptOutcome, x.outcome || 'pending')) + fld('Notes', '<textarea class="inp" name="notes" rows="3">' + esc(x.notes || '') + '</textarea>', true)],
    listing: (x = {}) => ['re_listings', 'Listing', fld('Address', inp('address', x.address, 'text', ' required'), true) + fld('MAPP ref (KWL)', inp('ref', x.ref)) + fld('Suburb', inp('suburb', x.suburb)) + fld('Property type', sel('property_type', OPT.ptype, x.property_type || 'house')) + fld('Sale or rental', sel('deal_type', OPT.dealType, x.deal_type || 'sale')) + fld('Bedrooms', inp('beds', x.beds, 'number', ' min="0" step="0.5"')) + fld('Bathrooms', inp('baths', x.baths, 'number', ' min="0" step="0.5"')) + fld('List price (R)', inp('list_price', x.list_price, 'number', ' required min="1"')) + fld('Seller', sel('seller_lead_id', leadOpts(['seller', 'landlord', 'investor', 'other']), x.seller_lead_id, 'None')) + fld('Mandate', sel('mandate_type', OPT.mandate, x.mandate_type || 'sole')) + fld('Mandate start', inp('mandate_start', x.mandate_start || today(), 'date', ' required')) + fld('Mandate expiry', inp('mandate_expiry', x.mandate_expiry, 'date')) + fld('Commission %', inp('commission_pct', x.commission_pct == null ? 5 : x.commission_pct, 'number', ' min="0" max="20" step="0.01"')) + fld('Commission includes VAT', sel('commission_incl_vat', [['true', 'Yes'], ['false', 'No']], String(x.commission_incl_vat == null ? true : x.commission_incl_vat))) + fld('My share %', inp('my_share_pct', x.my_share_pct == null ? 100 : x.my_share_pct, 'number', ' min="0" max="100"')) + fld('Referral fee % (of my share)', inp('referral_fee_pct', x.referral_fee_pct || 0, 'number', ' min="0" max="100"')) + fld('Status', sel('status', OPT.listStatus, x.status || 'active')) + fld('Portal refs (P24, PP)', inp('portal_refs', x.portal_refs)) + fld('Notes', '<textarea class="inp" name="notes" rows="2">' + esc(x.notes || '') + '</textarea>', true)],
    viewing: (x = {}) => ['re_viewings', 'Viewing', fld('Property', sel('listing_id', lstOpts(), x.listing_id || S.listingFilter, D.listings.length ? null : 'Add a listing first')) + fld('When', inp('viewed_at', localDT(x.viewed_at) || nowLocal(), 'datetime-local')) + fld('Buyer (from leads)', sel('lead_id', leadOpts(['buyer', 'tenant', 'investor', 'other']), x.lead_id, 'Not in leads')) + fld('Or viewer name', inp('viewer_name', x.viewer_name)) + fld('Type', sel('kind', OPT.vKind, x.kind || 'private')) + fld('Groups (show day)', inp('groups', x.groups || 1, 'number', ' min="1"')) + fld('Interest', sel('interest', OPT.interest, x.interest || 'warm')) + fld('Price feedback', sel('price_feedback', OPT.priceFb, x.price_feedback || 'unknown')) + fld('Feedback', '<textarea class="inp" name="feedback" rows="3">' + esc(x.feedback || '') + '</textarea>', true)],
    offer: (x = {}) => ['re_offers', 'Offer to purchase (OTP)', fld('Listing', sel('listing_id', lstOpts(), x.listing_id, 'Not one of my listings')) + fld('Or property (selling side)', inp('property_text', x.property_text)) + fld('Buyer', sel('buyer_lead_id', leadOpts(['buyer', 'investor', 'tenant', 'other']), x.buyer_lead_id, 'None')) + fld('Side', sel('side', OPT.side, x.side || 'listing')) + fld('Offer date', inp('offer_date', x.offer_date || today(), 'date', ' required')) + fld('Offer price (R)', inp('offer_price', x.offer_price, 'number', ' required min="1"')) + fld('Status', sel('status', OPT.offerStatus, x.status || 'submitted')) + fld('Accepted date', inp('accepted_date', x.accepted_date, 'date')) + fld('Finance', sel('finance', OPT.finance, x.finance || 'bond')) + fld('Bond due date', inp('bond_due_date', x.bond_due_date, 'date')) + fld('Bond approved', inp('bond_approved_date', x.bond_approved_date, 'date')) + fld('Conveyancer', inp('conveyancer', x.conveyancer)) + fld('Lodged', inp('lodgement_date', x.lodgement_date, 'date')) + fld('Registered', inp('registration_date', x.registration_date, 'date')) + fld('Commission % (blank = listing\'s)', inp('commission_pct', x.commission_pct, 'number', ' min="0" max="20" step="0.01"')) + fld('Commission includes VAT', sel('commission_incl_vat', [['true', 'Yes'], ['false', 'No']], String(x.commission_incl_vat == null ? true : x.commission_incl_vat))) + fld('My share %', inp('my_share_pct', x.my_share_pct == null ? 100 : x.my_share_pct, 'number', ' min="0" max="100"')) + fld('Referral fee %', inp('referral_fee_pct', x.referral_fee_pct || 0, 'number', ' min="0" max="100"')) + fld('If it fell through, why', inp('fell_through_reason', x.fell_through_reason), true) + fld('Notes', '<textarea class="inp" name="notes" rows="2">' + esc(x.notes || '') + '</textarea>', true)]
  };
  const NUM = ['budget', 'beds', 'baths', 'list_price', 'commission_pct', 'my_share_pct', 'referral_fee_pct', 'offer_price', 'groups'];
  const TS = ['received_at', 'first_contact_at', 'scheduled_at', 'viewed_at'];
  function openForm(kind, rec, after) {
    const [table, title, body] = FORMS[kind](rec || {});
    const dlg = $('soDlg');
    dlg.innerHTML = '<form method="dialog" class="soform"><div class="dh"><h3>' + (rec ? 'Edit ' : 'New ') + title.toLowerCase() + '</h3><button class="btn sm" value="cancel" formnovalidate>Close</button></div><div class="grid g3 fg">' + body + '</div><p class="err" id="soErr"></p><div class="row"><button class="btn red" value="save">Save</button>' + (rec ? '<button class="btn" value="delete" formnovalidate style="margin-left:auto">Delete</button>' : '') + '</div></form>';
    dlg.showModal();
    const form = dlg.querySelector('form');
    form.onsubmit = async ev => {
      const act = ev.submitter && ev.submitter.value; if (act === 'cancel') return;
      ev.preventDefault();
      try {
        if (act === 'delete') { if (!confirm('Delete this ' + title.toLowerCase() + '? This cannot be undone.')) return; const r = await sb.from(table).delete().eq('id', rec.id); if (r.error) throw new Error(friendly(r.error.message)); dlg.close(); toast('Deleted'); return refresh(); }
        const row = {}; new FormData(form).forEach((v, k) => { v = String(v).trim(); row[k] = v === '' ? null : NUM.includes(k) ? Number(v) : TS.includes(k) ? new Date(v).toISOString() : v === 'true' ? true : v === 'false' ? false : v; });
        if (table === 're_leads') { row.contact_basis = row.contact_basis || 'Enquiry made by the person'; if (row.status !== 'new' && !row.first_contact_at && !(rec && rec.first_contact_at)) row.first_contact_at = new Date().toISOString(); if (['client'].includes(row.status) && !(rec && rec.converted_at)) row.converted_at = new Date().toISOString(); }
        if (table === 're_offers') { if (['accepted', 'registered'].includes(row.status) && !row.accepted_date) row.accepted_date = row.offer_date; if (row.status === 'registered' && !row.registration_date) row.registration_date = today(); }
        if (table === 're_viewings' && !row.listing_id) throw new Error('Choose the property.');
        const saved = await save(table, row, rec && rec.id);
        if (table === 're_offers' && saved.listing_id && D.lstById[saved.listing_id]) { const ls = D.lstById[saved.listing_id], want = saved.status === 'registered' ? 'sold' : saved.status === 'accepted' ? 'under_offer' : null; if (want && ls.status !== want && ls.status !== 'rented') await save('re_listings', { status: want }, ls.id); }
        if (table === 're_appointments' && saved.lead_id && saved.status === 'held' && D.leadById[saved.lead_id] && ['new', 'contacted', 'qualified'].includes(D.leadById[saved.lead_id].status)) await save('re_leads', { status: 'appointment', first_contact_at: D.leadById[saved.lead_id].first_contact_at || new Date().toISOString() }, saved.lead_id);
        dlg.close(); toast('Saved'); await refresh(); if (after) after(saved);
      } catch (e) { $('soErr').textContent = e.message; }
    };
  }
  function openListing(id) {
    const l = D.lstById[id], s = lstStats(l), h = D.hist.filter(x => x.listing_id === id).sort((a, b) => a.at < b.at ? -1 : 1);
    const hot = s.v.filter(v => v.interest === 'hot').length, high = s.v.filter(v => v.price_feedback === 'too_high').length;
    const dlg = $('soDlg');
    dlg.innerHTML = '<div class="soform"><div class="dh"><h3>' + esc(l.address) + '</h3><button class="btn sm" id="soX">Close</button></div>'
      + '<div class="grid g4">' + kpi('Price', R(l.list_price), s.cuts ? 'from ' + R(l.original_price) : 'Original price') + kpi('Days on market', s.dom, 'since ' + fmtD(l.mandate_start)) + kpi('Viewings', s.v.length, hot + ' hot, ' + high + ' said too high') + kpi('My GCI at list', R(s.c.gci), 'take-home about ' + R(s.c.net)) + '</div>'
      + '<div class="row" style="margin:12px 0"><button class="btn red" id="soAddV">Record viewing</button><button class="btn" id="soAddO">Record OTP</button><button class="btn" id="soEditL">Edit listing</button><button class="btn" id="soRep">Copy seller report</button>' + (l.seller_lead_id ? '<button class="btn" id="soMsgS">Message seller</button>' : '') + '<button class="btn" id="soFlowL">Checklist</button></div>'
      + '<h3>Viewings</h3>' + (s.v.length ? '<ul class="list">' + s.v.map(v => '<li><span>' + fmtDT(v.viewed_at) + ' · ' + esc(v.lead_id && D.leadById[v.lead_id] ? D.leadById[v.lead_id].name : v.viewer_name || 'Viewer') + ' · ' + lab(v.interest) + ', price ' + lab(v.price_feedback).toLowerCase() + '</span><span class="small muted">' + esc(v.feedback || '') + '</span></li>').join('') + '</ul>' : '<div class="empty">No viewings yet.</div>')
      + '<h3 style="margin-top:14px">Offers</h3>' + (s.o.length ? '<ul class="list">' + s.o.map(o => '<li><span>' + fmtD(o.offer_date) + ' · ' + R(o.offer_price) + ' · ' + lab(o.status) + '</span><span class="small muted">' + Math.round(o.offer_price / (l.original_price || l.list_price) * 1000) / 10 + '% of original price</span></li>').join('') + '</ul>' : '<div class="empty">No offers yet.</div>')
      + (window.SalesComms ? window.SalesComms.historyHtml({ listing_id: id }) : '')
      + '<h3 style="margin-top:14px">History</h3><ul class="list">' + h.map(x => '<li><span>' + fmtD(x.at) + ' · ' + (x.event === 'created' ? 'Listed at ' + R(x.new_price) : x.event === 'price_change' ? 'Price ' + R(x.old_price) + ' to ' + R(x.new_price) : 'Status ' + lab(x.old_status) + ' to ' + lab(x.new_status)) + '</span></li>').join('') + '</ul></div>';
    dlg.showModal();
    $('soX').onclick = () => dlg.close();
    $('soAddV').onclick = () => { dlg.close(); S.listingFilter = id; openForm('viewing', { listing_id: id }); };
    $('soAddO').onclick = () => { dlg.close(); openForm('offer', { listing_id: id, commission_pct: null }); };
    $('soEditL').onclick = () => { dlg.close(); openForm('listing', l); };
    if ($('soMsgS')) $('soMsgS').onclick = () => { dlg.close(); window.SalesComms.compose({ code: 'seller_feedback', lead_id: l.seller_lead_id, listing_id: id }); };
    $('soFlowL').onclick = () => { dlg.close(); window.SalesComms.focus('listing:' + id); S.sub = 'flow'; localStorage.setItem('cos.sales.sub', 'flow'); draw(); };
    $('soRep').onclick = async () => {
      const txt = ['Seller feedback: ' + l.address, fmtD(today()), '', 'On the market ' + s.dom + ' days at ' + R(l.list_price) + (s.cuts ? ' (originally ' + R(l.original_price) + ')' : '') + '.', 'Viewings: ' + s.v.length + ' (' + s.groups + ' groups), ' + hot + ' strongly interested.', 'Price feedback: ' + s.v.filter(v => v.price_feedback === 'too_high').length + ' too high, ' + s.v.filter(v => v.price_feedback === 'fair').length + ' fair, ' + s.v.filter(v => v.price_feedback === 'good_value').length + ' good value.', 'Offers: ' + s.o.length + (s.o.length ? ', highest ' + R(Math.max(...s.o.map(o => o.offer_price))) : '') + '.', '', 'What buyers said:'].concat(s.v.filter(v => v.feedback).slice(0, 10).map(v => '- ' + fmtD(v.viewed_at) + ': ' + v.feedback)).join('\n');
      try { await navigator.clipboard.writeText(txt); toast('Seller report copied'); } catch (e) { toast('Copy failed'); }
    };
  }

  /* ---------- shell ---------- */
  const SUBS = [['dash', 'Stats and growth'], ['comms', 'Messages'], ['flow', 'Deal tracker'], ['leads', 'Leads'], ['appts', 'Appointments'], ['listings', 'Listings'], ['viewings', 'Viewings'], ['offers', 'OTPs and deals'], ['daily', 'Daily activity']];
  let host = null;
  async function refresh() { await load(); draw(); }
  function draw() {
    if (!host) return;
    const ext = window.SalesComms && ['comms', 'flow'].includes(S.sub);
    const body = ext ? window.SalesComms.view(S.sub) : S.sub === 'leads' ? vLeads() : S.sub === 'appts' ? vAppts() : S.sub === 'listings' ? vListings() : S.sub === 'viewings' ? vViewings() : S.sub === 'offers' ? vOffers() : S.sub === 'daily' ? vDaily() : vDash();
    host.innerHTML = '<div class="subtabs">' + SUBS.map(x => '<button data-sub="' + x[0] + '" aria-selected="' + (S.sub === x[0]) + '">' + x[1] + '</button>').join('') + '</div><div id="soBody">' + body + '</div><dialog id="soDlg" class="sodlg"></dialog>';
    host.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { S.sub = b.dataset.sub; S.q = ''; if (S.sub !== 'viewings' && S.sub !== 'listings') S.listingFilter = ''; localStorage.setItem('cos.sales.sub', S.sub); draw(); });
    host.querySelectorAll('[data-period]').forEach(b => b.onclick = () => { S.period = b.dataset.period; localStorage.setItem('cos.sales.period', S.period); draw(); });
    host.querySelectorAll('[data-new]').forEach(b => b.onclick = () => openForm(b.dataset.new));
    host.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.edit.split(':'), src = { lead: D.leads, appt: D.appts, viewing: D.views, offer: D.offers }[k]; openForm(k, src.find(x => x.id === id)); });
    host.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openListing(b.dataset.open));
    host.querySelectorAll('[data-contacted]').forEach(b => b.onclick = async () => { b.disabled = true; try { const l = D.leadById[b.dataset.contacted]; await save('re_leads', { first_contact_at: new Date().toISOString(), status: l.status === 'new' ? 'contacted' : l.status }, l.id); await refresh(); toast('Contact recorded'); } catch (e) { toast(e.message); } });
    host.querySelectorAll('[data-held]').forEach(b => b.onclick = () => openForm('appt', Object.assign({}, D.appts.find(a => a.id === b.dataset.held), { status: 'held' })));
    host.querySelectorAll('[data-noshow]').forEach(b => b.onclick = async () => { try { await save('re_appointments', { status: 'no_show', outcome: 'not_applicable' }, b.dataset.noshow); await refresh(); } catch (e) { toast(e.message); } });
    const q = $('soQ'); if (q) q.oninput = () => { S.q = q.value; const pos = q.selectionStart; draw(); const n = $('soQ'); n.focus(); n.setSelectionRange(pos, pos); };
    const lf = $('soLF'); if (lf) lf.onchange = () => { S.listingFilter = lf.value; draw(); };
    const vf = $('soVF'); if (vf) vf.onchange = () => { S.listingFilter = vf.value; draw(); };
    host.querySelectorAll('[data-msg]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.msg.split(':'); window.SalesComms.compose(k === 'lead' ? { lead_id: id } : { listing_id: id }); });
    host.querySelectorAll('[data-flow]').forEach(b => b.onclick = () => { window.SalesComms.focus('deal:' + b.dataset.flow); S.sub = 'flow'; localStorage.setItem('cos.sales.sub', 'flow'); draw(); });
    if (ext) window.SalesComms.bind(host);
    const ds = $('dSave'); if (ds) ds.onclick = async () => { ds.disabled = true; try { const t = today(), ex = D.daily.find(x => x.day === t), row = { day: t, contacts: Number($('dC').value) || 0, conversations: Number($('dV').value) || 0, lead_gen_minutes: Number($('dM').value) || 0, notes: $('dN').value.trim() || null }; await save('re_daily', row, ex && ex.id); await refresh(); toast('Today saved'); } catch (e) { toast(e.message); ds.disabled = false; } };
  }
  window.SalesOS = {
    async render(el) {
      host = el; sb = window.__cosSb;
      const s = await sb.auth.getSession();
      if (!s.data || !s.data.session) { el.innerHTML = '<div class="empty">Sign in to <a href="/agent-intelligence/">Agent Intelligence</a> in this browser to use the Sales OS.</div>'; return; }
      el.innerHTML = '<p class="muted">Loading your pipeline...</p>';
      try { await load(); draw(); } catch (e) { el.innerHTML = '<div class="empty">Could not load the Sales OS: ' + esc(e.message || e) + '</div>'; }
    },
    stats() { if (!D) return null; const m = metrics(range('month')), pl = pipeline(); return { leads: m.leads.length, held: m.held.length, listings: m.mandates.length, viewings: m.viewings.length, otps: m.otps.length, accepted: m.accepted.length, registered: m.registered.length, gciReg: m.gciReg, netReg: m.netReg, pendGci: pl.gci, pendNet: pl.net, pend: pl.pend, overdueLeads: D.leads.filter(l => l.next_action_date && l.next_action_date < today() && !['client', 'lost'].includes(l.status)).length, newLeads: D.leads.filter(l => l.status === 'new').length, expiring: D.listings.filter(l => l.status === 'active' && l.mandate_expiry && days(today(), l.mandate_expiry) <= 30 && days(today(), l.mandate_expiry) >= 0), bondsDue: D.offers.filter(o => o.status === 'accepted' && o.bond_due_date && !o.bond_approved_date && days(today(), o.bond_due_date) <= 7), comms: window.SalesComms ? window.SalesComms.stats() : null }; },
    ctx: () => ({ D, S, sb, save, refresh, draw, toast, esc, R, N, P, fmtD, fmtDT, today, addDays, days, lab, comm, offerComm, kpi, ymd, $ }),
    async load() { sb = window.__cosSb; await load(); }
  };
})();
