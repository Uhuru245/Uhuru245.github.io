/* MRET RENT OS rentals: landlords, tenants, leases, invoices, payments, arrears, landlord statements, and the tenant and
   landlord portals. All rules (permissions, state changes, totals, allocation) are enforced in the database; this file
   only presents them. */
(function () {
  'use strict';
  const X = () => window.RentOS;
  const toCents = v => { const t = String(v == null ? '' : v).replace(/[\sR,]/g, ''); if (t === '') return null; if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN; const [a, b] = t.split('.'); return parseInt(a, 10) * 100 + parseInt((b || '0').padEnd(2, '0'), 10); };
  const money = v => { const c = toCents(v); if (Number.isNaN(c)) throw new Error('Amounts must be numbers such as 9500 or 9500.50.'); return c; };
  const pct = bp => (bp / 100).toFixed(2).replace(/\.00$/, '') + '%';
  const mask = s => s ? String(s).slice(0, 2) + '*'.repeat(Math.max(0, String(s).length - 4)) + String(s).slice(-2) : '';
  const chip = (st) => '<span class="chip ' + ({ active: 'ok', paid: 'ok', verified: 'ok', notice: 'warn', partially_paid: 'warn', recorded: 'info', draft: 'info', issued: 'info', ended: '', terminated: 'bad', void: '', reversed: 'bad', archived: '' }[st] || '') + '">' + String(st).replace('_', ' ') + '</span>';
  const LEASE_ACTIONS = { draft: [['active', 'Activate (signed)'], ['archived', 'Archive draft']], active: [['notice', 'Notice given'], ['ended', 'End lease'], ['terminated', 'Terminate']], notice: [['active', 'Withdraw notice'], ['ended', 'End lease'], ['terminated', 'Terminate']], ended: [['archived', 'Archive']], terminated: [['archived', 'Archive']] };
  const dlg = (title, html) => { const d = X().$('dlg'); d.innerHTML = '<div class="in"><div class="hd"><h2>' + title + '</h2><button class="btn sm" id="dx">Close</button></div>' + html + '</div>'; if (!d.open) d.showModal(); X().$('dx').onclick = () => d.close(); return d; };
  const A = () => X().S.agency.agency_id;
  const sel = (name, opts, v, blank) => '<select class="inp" name="' + name + '">' + (blank ? '<option value="">' + blank + '</option>' : '') + opts.map(([k, l]) => '<option value="' + X().esc(k) + '"' + (String(v) === String(k) ? ' selected' : '') + '>' + X().esc(l) + '</option>').join('') + '</select>';
  const q = async (p) => { const r = await p; if (r.error) throw r.error; return r.data; };
  const monthStr = d => new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00Z'));
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());

  /* ---------- printable documents (agency-branded) ---------- */
  function printDoc(title, inner, brand) {
    const w = window.open('', '_blank'); if (!w) { X().toast('Allow pop-ups to print'); return; }
    const c = (brand && brand.primary_color) || '#1f6f5c';
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + X().esc(title) + '</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Instrument+Serif&display=swap" rel="stylesheet"><style>@page{margin:18mm}body{font:13px/1.55 Inter,Arial,sans-serif;color:#1b211f;margin:0;padding:40px 44px;border-top:6px solid ' + c + '}h1{color:' + c + ';margin:0;font:400 30px/1.1 "Instrument Serif",Georgia,serif;letter-spacing:-.01em}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:9px 4px;border-bottom:1px solid #eceae4;text-align:left}th{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:#7a817e;font-weight:600}.n{text-align:right;font-variant-numeric:tabular-nums}.hd{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #e3e1da;padding-bottom:18px;margin-bottom:8px}.hd img{max-height:60px;max-width:200px}.tot td{font-weight:700;border:0}.muted{color:#6b726f}code{font-family:ui-monospace,Menlo,monospace}.ft{color:#5d6562;font-size:12px;border-top:1px solid #e3e1da;padding-top:12px;margin-top:20px;white-space:pre-line}button{font:600 13px Inter,Arial,sans-serif;padding:10px 16px;border-radius:9px;border:1px solid #c9c6bd;background:#fff;cursor:pointer;margin-top:18px}@media print{button{display:none}body{padding:0;border:0}}</style></head><body>' + inner + '<p><button onclick="print()">Print or save as PDF</button></p></body></html>');
    w.document.close();
  }
  async function brand(agencyId) { return (await X().sb.from('agency_branding').select('*').eq('agency_id', agencyId).maybeSingle()).data || {}; }
  function brandHead(b, right) { const e = X().esc; return '<div class="hd"><div>' + (b.logo_data ? '<img src="' + e(b.logo_data) + '" alt="">' : '<h1>' + e(b.display_name || '') + '</h1>') + '<div class="muted">' + e(b.address || '') + (b.phone ? '<br>' + e(b.phone) : '') + (b.email ? ' · ' + e(b.email) : '') + (b.vat_no ? '<br>VAT ' + e(b.vat_no) : '') + '</div></div><div style="text-align:right">' + right + '</div></div>'; }
  async function invoiceHtml(inv) {
    const e = X().esc, R = X().R;
    const [lines, lease, b] = await Promise.all([q(X().sb.from('rental_invoice_lines').select('*').eq('invoice_id', inv.id).order('sort')), q(X().sb.from('leases').select('*, properties(name, address_line, suburb, city), lease_participants(role, tenants(name, email))').eq('id', inv.lease_id).single()), brand(inv.agency_id)]);
    const tn = (lease.lease_participants || []).filter(p => p.role !== 'guarantor').map(p => p.tenants && p.tenants.name).filter(Boolean).join(', ');
    return { b, html: brandHead(b, '<h1>INVOICE</h1><div>' + e(inv.number) + '</div><div>Issued ' + X().fmtD(inv.issue_date) + '</div><div><b>Due ' + X().fmtD(inv.due_date) + '</b></div>')
      + '<p><b>Bill to</b><br>' + e(tn) + '<br>' + e(lease.properties.name) + ', ' + e(lease.properties.address_line) + (lease.properties.suburb ? ', ' + e(lease.properties.suburb) : '') + '</p>'
      + '<table><tr><th>Description</th><th class="n">Amount</th></tr>' + lines.map(l => '<tr><td>' + e(l.description) + '</td><td class="n">' + R(l.amount_cents) + '</td></tr>').join('') + '<tr class="tot"><td>Total</td><td class="n">' + R(inv.total_cents) + '</td></tr><tr><td>Paid</td><td class="n">' + R(inv.paid_cents) + '</td></tr><tr class="tot"><td>Amount due</td><td class="n" style="color:' + e(b.primary_color || '#1f6f5c') + '">' + R(inv.total_cents - inv.paid_cents) + '</td></tr></table>'
      + '<p><b>Payment reference: ' + e(lease.payment_reference) + '</b>' + (b.payment_instructions ? '<br><span style="white-space:pre-line">' + e(b.payment_instructions) + '</span>' : '') + '</p><div class="ft">' + e(b.invoice_footer || '') + '</div>' };
  }
  async function statementHtml(agencyId, landlordId, from, to) {
    const e = X().esc, R = X().R;
    const s = await q(X().sb.rpc('landlord_statement', { a: agencyId, ll: landlordId, from_d: from, to_d: to }));
    const b = { display_name: s.agency.name, logo_data: s.agency.logo, primary_color: s.agency.color, address: s.agency.address, email: s.agency.email, phone: s.agency.phone, vat_no: s.agency.vat_no };
    const t = s.totals;
    return { s, b, html: brandHead(b, '<h1>STATEMENT</h1><div>' + X().fmtD(from) + ' to ' + X().fmtD(to) + '</div>') + '<p><b>' + e(s.landlord.name) + '</b>' + (s.landlord.address ? '<br>' + e(s.landlord.address) : '') + '</p>'
      + '<table><tr><th>Property</th><th>Lease</th><th class="n">Your share</th><th class="n">Rent invoiced</th><th class="n">Collected</th><th class="n">Management fee</th><th class="n">VAT on fee</th></tr>' + s.lines.map(l => '<tr><td>' + e(l.property) + '</td><td>' + e(l.reference) + '</td><td class="n">' + l.share_pct + '%</td><td class="n">' + R(l.invoiced_cents) + '</td><td class="n">' + R(l.collected_cents) + '</td><td class="n">' + R(l.fee_cents) + '</td><td class="n">' + R(l.fee_vat_cents) + '</td></tr>').join('')
      + '<tr class="tot"><td colspan="3">Totals</td><td class="n">' + R(t.invoiced_cents) + '</td><td class="n">' + R(t.collected_cents) + '</td><td class="n">' + R(t.fee_cents) + '</td><td class="n">' + R(t.fee_vat_cents) + '</td></tr><tr class="tot"><td colspan="6">Amount due to you for the period</td><td class="n" style="color:' + e(b.primary_color || '#1f6f5c') + '">' + R(t.due_to_landlord_cents) + '</td></tr></table>'
      + '<p class="muted">Collected means payments received into the agency\'s account, verified and allocated to rent invoices in the period. Payouts to you are made by the agency and shown on its remittance advice.</p><div class="ft">' + e(s.agency.footer || '') + '</div>' };
  }

  /* ---------- landlords ---------- */
  async function landlords() {
    const x = X(), e = x.esc;
    const [rows, rel, props] = await Promise.all([q(x.sb.from('landlords').select('*').eq('agency_id', A()).is('archived_at', null).order('name')), q(x.sb.from('landlord_property_relationships').select('*').eq('agency_id', A())), q(x.sb.from('properties').select('id, name').eq('agency_id', A()).is('archived_at', null).order('name'))]);
    const w = x.can('properties.write') && x.writable();
    x.shell('landlords', 'Landlords', rows.length ? '<div class="card tw" style="padding:0"><table class="t"><thead><tr><th>Name</th><th>Contact</th><th>ID / registration</th><th>Properties</th><th>Portal</th><th></th></tr></thead><tbody>' + rows.map(l => { const rp = rel.filter(r => r.landlord_id === l.id); return '<tr><td><b>' + e(l.name) + '</b><div class="small muted">' + e(l.kind) + '</div></td><td class="small">' + e(l.email || '') + '<br>' + e(l.phone || '') + '</td><td class="small">' + e(mask(l.id_or_reg_no)) + '</td><td class="small">' + rp.map(r => e((props.find(p => p.id === r.property_id) || {}).name || '') + ' (' + r.share_pct + '%)').join('<br>') + '</td><td>' + (l.portal_enabled ? '<span class="chip ok">on</span>' : '<span class="chip">off</span>') + '</td><td class="n">' + (w ? '<button class="btn sm" data-ed="' + l.id + '">Edit</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">No landlords yet.</div>', w ? '<button class="btn primary" id="add">Add landlord</button>' : '');
    const edit = l => {
      const rp = rel.filter(r => r.landlord_id === l.id);
      const d = dlg(l.id ? 'Edit landlord' : 'Add landlord', '<form id="f" class="grid g2" novalidate>' + x.field('Type', sel('kind', [['individual', 'Individual'], ['company', 'Company'], ['trust', 'Trust']], l.kind || 'individual')) + x.field('Full or registered name', x.inp('name', l.name, ' required maxlength="160"')) + x.field('Email <span class="hint">needed for the portal</span>', x.inp('email', l.email, ' type="email"')) + x.field('Phone', x.inp('phone', l.phone)) + x.field('ID or registration number', x.inp('id_or_reg_no', l.id_or_reg_no, ' maxlength="40" autocomplete="off"')) + x.field('Tax number', x.inp('tax_no', l.tax_no)) + x.field('Address', x.inp('address', l.address), 'span2') + x.field('Where the details came from (POPIA)', x.inp('contact_basis', l.contact_basis || 'Mandate with the agency'), 'span2')
        + '<label class="check span2"><input type="checkbox" name="portal_enabled"' + (l.portal_enabled ? ' checked' : '') + '> Give this landlord access to the landlord portal (they sign up with the email above)</label>' + x.field('Notes', '<textarea class="inp" name="notes" rows="2">' + e(l.notes || '') + '</textarea>', 'span2')
        + (l.id ? '<div class="span2"><b>Owns</b>' + rp.map(r => '<div class="row" style="margin-top:6px"><span style="flex:1">' + e((props.find(p => p.id === r.property_id) || {}).name || '') + ' · ' + r.share_pct + '%</span><button type="button" class="btn sm danger" data-un="' + r.property_id + '">Remove</button></div>').join('') + '<div class="row" style="margin-top:8px">' + sel('own_prop', props.map(p => [p.id, p.name]), '', 'Add a property') + '<input class="inp" name="own_share" value="100" style="width:90px" inputmode="decimal"> %</div></div>' : '<p class="small muted span2">Save first, then link the properties this landlord owns.</p>')
        + '<div class="span2 row"><button class="btn primary">Save</button>' + (l.id ? '<button type="button" class="btn danger" id="arc" style="margin-left:auto">Archive</button>' : '') + '<p class="err" id="e"></p></div></form>');
      d.querySelector('#f').onsubmit = async ev => { ev.preventDefault(); const f = x.formData(ev.target); const row = { kind: f.kind, name: f.name, email: f.email, phone: f.phone, id_or_reg_no: f.id_or_reg_no, tax_no: f.tax_no, address: f.address, contact_basis: f.contact_basis || 'Mandate with the agency', portal_enabled: !!ev.target.portal_enabled.checked, notes: f.notes };
        if (row.portal_enabled && !row.email) return (x.$('e').textContent = 'Add an email address for portal access.');
        try { await x.busy(ev.submitter, async () => { if (l.id) await q(x.sb.from('landlords').update(row).eq('id', l.id).select('id')); else { row.agency_id = A(); l = (await q(x.sb.from('landlords').insert(row).select().single())); }
          if (f.own_prop) { const sh = Number(String(f.own_share || '100').replace(',', '.')); await q(x.sb.from('landlord_property_relationships').insert({ agency_id: A(), landlord_id: l.id, property_id: f.own_prop, share_pct: sh })); }
          d.close(); x.toast('Saved'); x.render(); }); } catch (er) { x.$('e').textContent = /portals/i.test(er.message || '') || /row-level/i.test(er.message || '') && row.portal_enabled ? 'Portals are part of the Professional plan and up.' : x.friendly(er); } };
      d.querySelectorAll('[data-un]').forEach(b => b.onclick = async () => { try { await q(x.sb.from('landlord_property_relationships').delete().eq('landlord_id', l.id).eq('property_id', b.dataset.un)); d.close(); x.render(); } catch (er) { x.$('e').textContent = x.friendly(er); } });
      if (x.$('arc')) x.$('arc').onclick = async () => { if (!confirm('Archive this landlord? Their history is kept.')) return; try { await q(x.sb.from('landlords').update({ archived_at: new Date().toISOString() }).eq('id', l.id).select('id')); d.close(); x.render(); } catch (er) { x.$('e').textContent = x.friendly(er); } };
    };
    if (x.$('add')) x.$('add').onclick = () => edit({});
    document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => edit(rows.find(r => r.id === b.dataset.ed)));
  }

  /* ---------- tenants ---------- */
  async function tenants() {
    const x = X(), e = x.esc;
    const [rows, parts] = await Promise.all([q(x.sb.from('tenants').select('*').eq('agency_id', A()).is('archived_at', null).order('name')), q(x.sb.from('lease_participants').select('tenant_id, leases(status, payment_reference, properties(name))').eq('agency_id', A()))]);
    const w = x.can('properties.write') && x.writable();
    x.shell('tenants', 'Tenants', rows.length ? '<div class="card tw" style="padding:0"><table class="t"><thead><tr><th>Name</th><th>Contact</th><th>Lease</th><th>Portal</th><th></th></tr></thead><tbody>' + rows.map(t => { const lp = parts.filter(p => p.tenant_id === t.id && p.leases && ['active', 'notice', 'draft'].includes(p.leases.status)); return '<tr><td><b>' + e(t.name) + '</b><div class="small muted">ID ' + e(mask(t.id_or_reg_no) || '–') + '</div></td><td class="small">' + e(t.email || '') + '<br>' + e(t.phone || '') + '</td><td class="small">' + (lp.map(p => e(p.leases.properties.name) + ' ' + chip(p.leases.status)).join('<br>') || '<span class="muted">none</span>') + '</td><td>' + (t.portal_enabled ? '<span class="chip ok">on</span>' : '<span class="chip">off</span>') + '</td><td class="n">' + (w ? '<button class="btn sm" data-ed="' + t.id + '">Edit</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">No tenants yet.</div>', w ? '<button class="btn primary" id="add">Add tenant</button>' : '');
    const edit = t => { const d = dlg(t.id ? 'Edit tenant' : 'Add tenant', '<form id="f" class="grid g2" novalidate>' + x.field('Type', sel('kind', [['individual', 'Individual'], ['company', 'Company']], t.kind || 'individual')) + x.field('Full or registered name', x.inp('name', t.name, ' required')) + x.field('Email <span class="hint">needed for the portal</span>', x.inp('email', t.email, ' type="email"')) + x.field('Phone', x.inp('phone', t.phone)) + x.field('ID or registration number', x.inp('id_or_reg_no', t.id_or_reg_no, ' autocomplete="off"')) + x.field('Employer', x.inp('employer', t.employer)) + x.field('Where the details came from (POPIA)', x.inp('contact_basis', t.contact_basis || 'Lease application by the tenant'), 'span2') + '<label class="check span2"><input type="checkbox" name="portal_enabled"' + (t.portal_enabled ? ' checked' : '') + '> Give this tenant access to the tenant portal (they sign up with the email above)</label>' + x.field('Notes', '<textarea class="inp" name="notes" rows="2">' + e(t.notes || '') + '</textarea>', 'span2') + '<div class="span2 row"><button class="btn primary">Save</button>' + (t.id ? '<button type="button" class="btn danger" id="arc" style="margin-left:auto">Archive</button>' : '') + '<p class="err" id="e"></p></div></form>');
      d.querySelector('#f').onsubmit = async ev => { ev.preventDefault(); const f = x.formData(ev.target); const row = { kind: f.kind, name: f.name, email: f.email, phone: f.phone, id_or_reg_no: f.id_or_reg_no, employer: f.employer, contact_basis: f.contact_basis || 'Lease application by the tenant', portal_enabled: !!ev.target.portal_enabled.checked, notes: f.notes };
        if (row.portal_enabled && !row.email) return (x.$('e').textContent = 'Add an email address for portal access.');
        try { await x.busy(ev.submitter, async () => { if (t.id) { const r = await q(x.sb.from('tenants').update(row).eq('id', t.id).select('id')); if (!r.length) throw new Error('Not saved. Portals are part of the Professional plan and up.'); } else { row.agency_id = A(); await q(x.sb.from('tenants').insert(row)); } d.close(); x.toast('Saved'); x.render(); }); } catch (er) { x.$('e').textContent = /row-level/i.test(er.message || '') && row.portal_enabled ? 'Portals are part of the Professional plan and up.' : x.friendly(er); } };
      if (x.$('arc')) x.$('arc').onclick = async () => { if (!confirm('Archive this tenant? Their history is kept.')) return; await q(x.sb.from('tenants').update({ archived_at: new Date().toISOString() }).eq('id', t.id).select('id')); d.close(); x.render(); }; };
    if (x.$('add')) x.$('add').onclick = () => edit({});
    document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => edit(rows.find(r => r.id === b.dataset.ed)));
  }

  /* ---------- leases ---------- */
  async function leases(qs) {
    const x = X(), e = x.esc, R = x.R;
    const st = qs.get('s') || 'live';
    let qr = x.sb.from('leases').select('*, properties(name), lease_participants(role, tenants(name))').eq('agency_id', A()).order('start_date', { ascending: false });
    if (st === 'live') qr = qr.in('status', ['draft', 'active', 'notice']); else if (st !== 'all') qr = qr.eq('status', st);
    const rows = await q(qr);
    const w = x.can('properties.write') && x.writable();
    x.shell('leases', 'Leases', '<div class="row" style="margin-bottom:12px">' + [['live', 'Current'], ['draft', 'Drafts'], ['ended', 'Ended'], ['all', 'All']].map(([k, l]) => '<a class="btn sm' + (k === st ? ' dark' : '') + '" href="#/leases?s=' + k + '">' + l + '</a>').join('') + '</div>'
      + (rows.length ? '<div class="card tw" style="padding:0"><table class="t"><thead><tr><th>Property</th><th>Tenants</th><th>Term</th><th class="n">Rent</th><th>Reference</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(l => '<tr><td><b>' + e(l.properties.name) + '</b></td><td class="small">' + e((l.lease_participants || []).filter(p => p.role !== 'guarantor').map(p => p.tenants.name).join(', ')) + '</td><td class="small">' + x.fmtD(l.start_date) + ' to ' + (l.end_date ? x.fmtD(l.end_date) : 'month to month') + (l.end_date && ['active', 'notice'].includes(l.status) && x.daysTo(l.end_date) <= 60 ? '<br><span class="chip warn">ends in ' + x.daysTo(l.end_date) + ' days</span>' : '') + '</td><td class="n">' + R(l.rent_cents) + (l.escalation_bp ? '<div class="small muted">+' + pct(l.escalation_bp) + ' yearly</div>' : '') + '</td><td><code>' + e(l.payment_reference) + '</code></td><td>' + chip(l.status) + '</td><td class="n"><button class="btn sm" data-op="' + l.id + '">Open</button></td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">No leases here.' + (w ? ' Create one with New lease.' : '') + '</div>'),
      w ? '<button class="btn primary" id="add">New lease</button>' : '');
    if (x.$('add')) x.$('add').onclick = () => newLease();
    document.querySelectorAll('[data-op]').forEach(b => b.onclick = () => openLease(b.dataset.op));
  }
  async function newLease() {
    const x = X(), e = x.esc;
    const [props, tens, lls, mands] = await Promise.all([q(x.sb.from('properties').select('id, name, rental_cents').eq('agency_id', A()).is('archived_at', null).order('name')), q(x.sb.from('tenants').select('id, name').eq('agency_id', A()).is('archived_at', null).order('name')), q(x.sb.from('landlords').select('id, name').eq('agency_id', A()).is('archived_at', null).order('name')), q(x.sb.from('management_mandates').select('*').eq('agency_id', A()).eq('status', 'active'))]);
    if (!props.length || !tens.length) return dlg('New lease', '<p>Add ' + (!props.length ? 'a property' : '') + (!props.length && !tens.length ? ' and ' : '') + (!tens.length ? 'a tenant' : '') + ' first.</p>');
    const d = dlg('New lease', '<form id="f" class="grid g2" novalidate>' + x.field('Property', sel('property_id', props.map(p => [p.id, p.name]), '', 'Choose')) + x.field('Landlord (for the mandate)', sel('landlord_id', lls.map(l => [l.id, l.name]), '', lls.length ? 'Choose' : 'Add a landlord first'))
      + x.field('Management fee % of rent collected', x.inp('fee', '10', ' inputmode="decimal"')) + x.field('Mandate type', sel('mkind', [['full_management', 'Full management'], ['rent_collection', 'Rent collection'], ['letting_only', 'Letting only']], 'full_management'))
      + '<div class="span2"><b>Tenants</b><div class="grid g2" style="margin-top:6px">' + tens.map(t => '<label class="check"><input type="checkbox" name="t_' + t.id + '"> ' + e(t.name) + '</label>').join('') + '</div><p class="small muted">The first ticked tenant is the main tenant; others are co-tenants.</p></div>'
      + x.field('Start date', x.inp('start_date', '', ' type="date" required')) + x.field('End date <span class="hint">blank = month to month</span>', x.inp('end_date', '', ' type="date"'))
      + x.field('Monthly rent (R)', x.inp('rent', '', ' inputmode="decimal" required')) + x.field('Deposit (R)', x.inp('deposit', '', ' inputmode="decimal"')) + x.field('Rent due on day', x.inp('due_day', '1', ' type="number" min="1" max="28"')) + x.field('Yearly escalation %', x.inp('esc', '0', ' inputmode="decimal"')) + x.field('Notice period (days)', x.inp('notice_days', '30', ' type="number" min="0"'))
      + '<div class="span2 row"><button class="btn primary">Create draft lease</button><p class="err" id="e"></p></div></form>');
    const f = d.querySelector('#f');
    f.property_id.onchange = () => { const p = props.find(pp => pp.id === f.property_id.value); if (p && p.rental_cents && !f.rent.value) f.rent.value = (p.rental_cents / 100).toFixed(2); };
    f.onsubmit = async ev => { ev.preventDefault(); const v = x.formData(f); const err = m => (x.$('e').textContent = m);
      try {
        const tIds = tens.filter(t => f['t_' + t.id].checked).map(t => t.id);
        if (!v.property_id) return err('Choose the property.'); if (!tIds.length) return err('Tick at least one tenant.'); if (!v.start_date) return err('Give the start date.');
        const rent = money(v.rent); if (!rent) return err('Give the monthly rent.');
        const esc = Math.round(Number(String(v.esc || '0').replace(',', '.')) * 100), fee = Math.round(Number(String(v.fee || '0').replace(',', '.')) * 100);
        if (!(esc >= 0 && esc <= 3000)) return err('Escalation must be between 0% and 30%.'); if (!(fee >= 0 && fee <= 5000)) return err('Fee must be between 0% and 50%.');
        await x.busy(ev.submitter, async () => {
          let mandate = mands.find(m => m.property_id === v.property_id && (!v.landlord_id || m.landlord_id === v.landlord_id));
          if (!mandate && v.landlord_id) { mandate = await q(x.sb.from('management_mandates').insert({ agency_id: A(), property_id: v.property_id, landlord_id: v.landlord_id, kind: v.mkind, start_date: v.start_date, fee_bp: fee }).select().single());
            const own = await q(x.sb.from('landlord_property_relationships').select('landlord_id').eq('property_id', v.property_id)); if (!own.length) await q(x.sb.from('landlord_property_relationships').insert({ agency_id: A(), landlord_id: v.landlord_id, property_id: v.property_id, share_pct: 100 })); }
          const l = await q(x.sb.from('leases').insert({ agency_id: A(), property_id: v.property_id, mandate_id: mandate ? mandate.id : null, start_date: v.start_date, end_date: v.end_date, rent_cents: rent, deposit_cents: money(v.deposit) || 0, due_day: Number(v.due_day || 1), escalation_bp: esc, notice_days: Number(v.notice_days || 30) }).select().single());
          await q(x.sb.from('lease_participants').insert(tIds.map((t, i) => ({ lease_id: l.id, tenant_id: t, agency_id: A(), role: i === 0 ? 'tenant' : 'co_tenant' }))));
          d.close(); x.toast('Draft lease ' + l.payment_reference + ' created'); openLease(l.id);
        });
      } catch (er) { err(x.friendly(er)); } };
  }
  async function openLease(id) {
    const x = X(), e = x.esc, R = x.R;
    const [l, inv, ev, bal] = await Promise.all([q(x.sb.from('leases').select('*, properties(name, address_line), lease_participants(role, tenants(name, email, phone)), management_mandates(fee_bp, kind)').eq('id', id).single()), q(x.sb.from('rental_invoices').select('*').eq('lease_id', id).order('period_start', { ascending: false })), q(x.sb.from('lease_events').select('*').eq('lease_id', id).order('at')), x.sb.rpc('lease_balance', { l: id })]);
    const w = x.can('properties.write') && x.writable();
    const d = dlg(e(l.properties.name) + ' ' + chip(l.status), '<div class="grid g3"><div><div class="small muted">Payment reference</div><b style="font-size:18px"><code>' + e(l.payment_reference) + '</code></b></div><div><div class="small muted">Rent</div><b>' + R(l.rent_cents) + '</b> due day ' + l.due_day + (l.escalation_bp ? ', +' + pct(l.escalation_bp) + ' yearly' : '') + '</div><div><div class="small muted">Balance</div><b class="' + (bal.data > 0 ? 'down' : '') + '">' + R(bal.data) + (bal.data < 0 ? ' credit' : '') + '</b></div></div>'
      + '<p class="small">' + x.fmtD(l.start_date) + ' to ' + (l.end_date ? x.fmtD(l.end_date) : 'month to month') + ' · deposit ' + R(l.deposit_cents) + ' · notice ' + l.notice_days + ' days' + (l.management_mandates ? ' · fee ' + pct(l.management_mandates.fee_bp) : '') + '</p>'
      + '<p class="small"><b>Tenants:</b> ' + (l.lease_participants || []).map(p => e(p.tenants.name) + ' (' + e(p.role.replace('_', '-')) + ')' + (p.tenants.email ? ' ' + e(p.tenants.email) : '')).join('; ') + '</p>'
      + (w && LEASE_ACTIONS[l.status] ? '<div class="row" style="margin:10px 0">' + LEASE_ACTIONS[l.status].map(([s, t]) => '<button class="btn sm' + (s === 'active' ? ' primary' : s === 'terminated' ? ' danger' : '') + '" data-st="' + s + '">' + t + '</button>').join('') + '</div>' : '')
      + '<h3 style="margin-top:14px">Invoices</h3>' + (inv.length ? '<table class="t"><tbody>' + inv.map(i => '<tr><td>' + e(i.number) + '</td><td>' + monthStr(i.period_start) + '</td><td class="n">' + R(i.total_cents) + '</td><td class="n">' + R(i.paid_cents) + '</td><td>' + chip(i.status) + '</td></tr>').join('') + '</tbody></table>' : '<p class="muted small">No invoices yet. Activate the lease, then create the month\'s invoices on the Invoices page.</p>')
      + '<h3 style="margin-top:14px">History</h3><ul class="small">' + ev.map(v => '<li>' + x.fmtDT(v.at) + ': ' + e(v.from_status || 'created') + ' to ' + e(v.to_status) + '</li>').join('') + '</ul><p class="err" id="e"></p>');
    d.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => {
      const s = b.dataset.st; const row = { status: s };
      if (s === 'terminated') { const why = prompt('Reason for terminating (kept on record):'); if (!why) return; row.termination_reason = why; }
      if (s === 'active' && l.status === 'draft' && !confirm('Activate this lease? Rent, dates and due day are locked once active.')) return;
      try { await q(x.sb.from('leases').update(row).eq('id', id).select('id')); x.toast('Lease updated'); d.close(); x.render(); } catch (er) { x.$('e').textContent = x.friendly(er); }
    });
  }

  /* ---------- invoices ---------- */
  async function invoices(qs) {
    const x = X(), e = x.esc, R = x.R;
    const st = qs.get('s') || 'open', m = qs.get('m') || today().slice(0, 7);
    let qr = x.sb.from('rental_invoices').select('*, leases(payment_reference, properties(name))').eq('agency_id', A()).order('due_date', { ascending: false }).limit(500);
    if (st === 'open') qr = qr.in('status', ['issued', 'partially_paid']); else if (st === 'month') qr = qr.eq('period_start', m + '-01'); else if (st !== 'all') qr = qr.eq('status', st);
    const rows = await q(qr);
    const w = x.can('finance.write') && x.writable();
    x.shell('invoices', 'Invoices', (w ? '<div class="card row" style="margin-bottom:16px"><b>Monthly invoice run</b><input class="inp" type="month" id="mon" value="' + e(m) + '" style="width:auto"><button class="btn primary" id="run">Create invoices for this month</button><span class="small muted">One invoice per current lease. Running it again never duplicates.</span><span class="err" id="e"></span></div>' : '')
      + '<div class="row" style="margin-bottom:12px">' + [['open', 'Unpaid'], ['month', 'Month above'], ['paid', 'Paid'], ['void', 'Void'], ['all', 'All']].map(([k, l]) => '<a class="btn sm' + (k === st ? ' dark' : '') + '" href="#/invoices?s=' + k + '&m=' + m + '">' + l + '</a>').join('') + '</div>'
      + (rows.length ? '<div class="card tw" style="padding:0"><table class="t"><thead><tr><th>Number</th><th>Property</th><th>Period</th><th>Due</th><th class="n">Total</th><th class="n">Paid</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(i => '<tr><td>' + e(i.number) + '</td><td>' + e(i.leases.properties.name) + '<div class="small muted">' + e(i.leases.payment_reference) + '</div></td><td>' + monthStr(i.period_start) + '</td><td>' + x.fmtD(i.due_date) + '</td><td class="n">' + R(i.total_cents) + '</td><td class="n">' + R(i.paid_cents) + '</td><td>' + chip(i.status) + '</td><td class="n"><button class="btn sm" data-pr="' + i.id + '">View</button>' + (w && i.status !== 'void' && i.status !== 'paid' ? ' <button class="btn sm" data-ch="' + i.id + '">Add charge</button>' : '') + (w && i.status === 'issued' ? ' <button class="btn sm danger" data-vd="' + i.id + '">Void</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">No invoices here.</div>'));
    if (x.$('run')) x.$('run').onclick = ev => x.busy(ev.target, async () => { try { const r = await q(x.sb.rpc('generate_rent_invoices', { a: A(), month: x.$('mon').value + '-01' })); x.toast(r.created + ' invoice' + (r.created === 1 ? '' : 's') + ' created' + (r.already_invoiced ? ', ' + r.already_invoiced + ' already existed' : '')); x.go('#/invoices?s=month&m=' + x.$('mon').value); } catch (er) { x.$('e').textContent = x.friendly(er); } });
    document.querySelectorAll('[data-pr]').forEach(b => b.onclick = async () => { const i = rows.find(r => r.id === b.dataset.pr); const h = await invoiceHtml(i); printDoc(i.number, h.html, h.b); });
    document.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { const d = dlg('Add a line', '<form id="f" class="grid g2">' + x.field('Type', sel('kind', [['charge', 'Charge (e.g. utilities)'], ['credit', 'Credit'], ['adjustment', 'Adjustment']], 'charge')) + x.field('Amount (R)', x.inp('amt', '', ' inputmode="decimal" required')) + x.field('Description', x.inp('description', '', ' required maxlength="200"'), 'span2') + '<div class="span2 row"><button class="btn primary">Add</button><p class="err" id="e2"></p></div></form>');
      d.querySelector('#f').onsubmit = async ev => { ev.preventDefault(); const v = x.formData(ev.target); try { let c = money(v.amt); if (!c) throw new Error('Give an amount.'); if (v.kind === 'credit') c = -Math.abs(c); await q(x.sb.from('rental_invoice_lines').insert({ invoice_id: b.dataset.ch, agency_id: A(), kind: v.kind, description: v.description, amount_cents: c, sort: 5 })); d.close(); x.toast('Added'); x.render(); } catch (er) { x.$('e2').textContent = x.friendly(er); } }; });
    document.querySelectorAll('[data-vd]').forEach(b => b.onclick = async () => { const why = prompt('Reason for voiding this invoice (kept on record):'); if (!why) return; try { await q(x.sb.rpc('void_rent_invoice', { inv: b.dataset.vd, why })); x.toast('Invoice voided'); x.render(); } catch (er) { x.toast(x.friendly(er)); } });
  }

  /* ---------- payments ---------- */
  async function payments(qs) {
    const x = X(), e = x.esc, R = x.R;
    const st = qs.get('s') || 'recorded';
    let qr = x.sb.from('rental_payments').select('*, leases(payment_reference, properties(name))').eq('agency_id', A()).order('received_on', { ascending: false }).limit(500);
    if (st !== 'all') qr = qr.eq('status', st);
    const [rows, ls] = await Promise.all([q(qr), q(x.sb.from('leases').select('id, payment_reference, properties(name)').eq('agency_id', A()).in('status', ['active', 'notice', 'ended']).order('payment_reference'))]);
    const w = x.can('finance.write') && x.writable();
    x.shell('payments', 'Payments', '<div class="notice info" style="margin-bottom:16px">Rent is paid into your agency\'s own bank account. Capture or import each deposit from your bank statement, then <b>verify</b> it once you have checked it on the statement. Only verified payments reduce what tenants owe; a proof of payment on its own never does.</div>'
      + (w ? '<div class="grid g2" style="margin-bottom:16px"><form id="pf" class="card grid g2" novalidate><h3 class="span2" style="margin:0">Capture a payment</h3>' + x.field('Date received', x.inp('received_on', today(), ' type="date"')) + x.field('Amount (R)', x.inp('amt', '', ' inputmode="decimal"')) + x.field('Reference on the deposit', x.inp('reference', '', ' placeholder="e.g. L00012"')) + x.field('Bank transaction ID <span class="hint">stops double capture</span>', x.inp('bank_reference', '')) + x.field('Method', sel('method', [['eft', 'EFT'], ['payshap', 'PayShap'], ['cash_deposit', 'Cash deposit'], ['card', 'Card'], ['other', 'Other']], 'eft')) + x.field('Lease <span class="hint">blank = match by reference</span>', sel('lease_id', ls.map(l => [l.id, l.payment_reference + ' · ' + l.properties.name]), '', 'Match automatically')) + '<div class="span2 row"><button class="btn primary">Capture</button><p class="err" id="e"></p></div></form>'
        + '<form id="imp" class="card grid" novalidate><h3 style="margin:0">Import from a bank statement</h3><p class="small muted" style="margin:0">Paste deposits as CSV lines: <code>date,amount,description</code> (e.g. <code>2026-12-03,9500.00,L00012 T MOKOENA</code>). Each line is captured once and matched by the lease reference.</p><textarea class="inp" name="csv" rows="5" placeholder="2026-12-03,9500.00,L00012 T MOKOENA"></textarea><div class="row"><button class="btn">Import lines</button><p class="err" id="ie"></p></div></form></div>' : '')
      + '<div class="row" style="margin-bottom:12px">' + [['recorded', 'To verify'], ['verified', 'Verified'], ['reversed', 'Reversed'], ['all', 'All']].map(([k, l]) => '<a class="btn sm' + (k === st ? ' dark' : '') + '" href="#/payments?s=' + k + '">' + l + '</a>').join('') + '</div>'
      + (rows.length ? '<div class="card tw" style="padding:0"><table class="t"><thead><tr><th>Received</th><th>Reference</th><th>Lease</th><th class="n">Amount</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(p => '<tr><td>' + x.fmtD(p.received_on) + '<div class="small muted">' + e(p.method) + '</div></td><td class="small">' + e(p.reference || '') + '<br>' + e(p.bank_reference || '') + '</td><td>' + (p.leases ? e(p.leases.payment_reference) + ' · ' + e(p.leases.properties.name) : (w && p.status === 'recorded' ? sel('m_' + p.id, ls.map(l => [l.id, l.payment_reference + ' · ' + l.properties.name]), '', 'Choose lease').replace('<select ', '<select data-ml="' + p.id + '" style="min-height:32px;padding:4px" ') : '<span class="muted">unmatched</span>')) + '</td><td class="n">' + R(p.amount_cents) + '</td><td>' + chip(p.status) + (p.reversed_reason ? '<div class="small muted">' + e(p.reversed_reason) + '</div>' : '') + '</td><td class="n">' + (w && p.status === 'recorded' && p.lease_id ? '<button class="btn sm primary" data-vf="' + p.id + '">Verify</button>' : '') + (w && p.status === 'verified' ? '<button class="btn sm danger" data-rv="' + p.id + '">Reverse</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">Nothing here.</div>'));
    const capture = async (row) => { const r = await q(x.sb.from('rental_payments').insert(Object.assign({ agency_id: A() }, row)).select('id, lease_id').single()); if (!r.lease_id) await x.sb.rpc('match_rent_payment', { p: r.id }); return r; };
    if (x.$('pf')) x.$('pf').onsubmit = async ev => { ev.preventDefault(); const v = x.formData(ev.target); try { const c = money(v.amt); if (!c) throw new Error('Give the amount.'); await x.busy(ev.submitter, async () => { await capture({ received_on: v.received_on, amount_cents: c, reference: v.reference, bank_reference: v.bank_reference, method: v.method, lease_id: v.lease_id }); x.toast('Payment captured. Verify it once checked on the statement.'); x.render(); }); } catch (er) { x.$('e').textContent = /bank_ref|duplicate/i.test(er.message || '') ? 'That bank transaction was already captured.' : x.friendly(er); } };
    if (x.$('imp')) x.$('imp').onsubmit = async ev => { ev.preventDefault(); const lines = String(ev.target.csv.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean); let ok = 0, dup = 0, bad = 0;
      await x.busy(ev.submitter, async () => { for (const ln of lines) { const m = /^(\d{4}-\d{2}-\d{2})\s*[,;]\s*"?([\d\s.,]+)"?\s*[,;]\s*(.+)$/.exec(ln); if (!m) { bad++; continue; } const c = toCents(m[2].replace(/\s/g, '')); if (!c || Number.isNaN(c)) { bad++; continue; }
        try { await capture({ received_on: m[1], amount_cents: c, reference: m[3].slice(0, 80), bank_reference: (m[1] + '|' + c + '|' + m[3]).slice(0, 120), method: 'eft' }); ok++; } catch (er) { /duplicate|bank_ref/i.test(er.message || '') ? dup++ : bad++; } } });
      x.$('ie').textContent = ''; x.toast(ok + ' imported' + (dup ? ', ' + dup + ' already captured' : '') + (bad ? ', ' + bad + ' lines not understood' : '')); x.render(); };
    document.querySelectorAll('[data-ml]').forEach(s => s.onchange = async () => { try { await q(x.sb.rpc('set_payment_lease', { p: s.dataset.ml, l: s.value })); x.render(); } catch (er) { x.toast(x.friendly(er)); } });
    document.querySelectorAll('[data-vf]').forEach(b => b.onclick = async () => { if (!confirm('Have you seen this amount on your bank statement? Verifying applies it to the tenant\'s invoices.')) return; try { const r = await q(x.sb.rpc('verify_rent_payment', { p: b.dataset.vf })); x.toast('Verified' + (r.unallocated_cents > 0 ? '. ' + x.R(r.unallocated_cents) + ' kept as credit.' : '')); x.render(); } catch (er) { x.toast(x.friendly(er)); } });
    document.querySelectorAll('[data-rv]').forEach(b => b.onclick = async () => { const why = prompt('Why is this payment being reversed? (kept on record)'); if (!why) return; try { await q(x.sb.rpc('reverse_rent_payment', { p: b.dataset.rv, why })); x.toast('Reversed'); x.render(); } catch (er) { x.toast(x.friendly(er)); } });
  }

  /* ---------- arrears ---------- */
  async function arrears() {
    const x = X(), e = x.esc, R = x.R;
    const [rows, parts, b] = await Promise.all([q(x.sb.rpc('arrears_report', { a: A() })), q(x.sb.from('lease_participants').select('lease_id, role, tenants(name, email, phone)').eq('agency_id', A())), brand(A())]);
    const sum = k => rows.reduce((t, r) => t + Number(r[k] || 0), 0);
    x.shell('arrears', 'Arrears', '<div class="grid g4">' + x.kpi('Total in arrears', R(sum('total_cents')), rows.length + ' lease' + (rows.length === 1 ? '' : 's')) + x.kpi('Under 30 days', R(sum('current_cents')), '') + x.kpi('30 to 89 days', R(sum('d30_cents') + sum('d60_cents')), '') + x.kpi('90 days and more', R(sum('d90_cents')), 'needs escalation') + '</div>'
      + (rows.length ? '<div class="card tw" style="padding:0;margin-top:16px"><table class="t"><thead><tr><th>Lease</th><th>Tenants</th><th class="n">Under 30</th><th class="n">30-59</th><th class="n">60-89</th><th class="n">90+</th><th class="n">Total</th><th></th></tr></thead><tbody>' + rows.map(r => { const t = parts.filter(p => p.lease_id === r.lease_id && p.role !== 'guarantor').map(p => p.tenants); return '<tr><td><b>' + e(r.property) + '</b><div class="small muted">' + e(r.payment_reference) + ' · oldest due ' + x.fmtD(r.oldest_due) + '</div></td><td class="small">' + e(r.tenants || '') + '</td><td class="n">' + R(r.current_cents) + '</td><td class="n">' + R(r.d30_cents) + '</td><td class="n">' + R(r.d60_cents) + '</td><td class="n">' + R(r.d90_cents) + '</td><td class="n"><b>' + R(r.total_cents) + '</b></td><td class="n">' + reminder(r, t, b) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty" style="margin-top:16px">No arrears. Every issued invoice that is due has been paid.</div>')
      + '<p class="small muted">Reminders open in your email or WhatsApp with the message written out; you press send.</p>');
  }
  function reminder(r, ts, b) {
    const t = ts[0] || {}, first = String(t.name || '').split(' ')[0] || 'there', ag = b.display_name || '';
    const msg = 'Hi ' + first + ', this is a reminder from ' + ag + ' that the rent account for ' + r.property + ' shows ' + X().R(r.total_cents) + ' outstanding since ' + X().fmtD(r.oldest_due) + '. Please pay using reference ' + r.payment_reference + (b.payment_instructions ? '. ' + b.payment_instructions : '') + '. If you have already paid, please send us the proof so we can match it. Thank you.';
    const wa = t.phone ? 'https://wa.me/' + String(t.phone).replace(/\D/g, '').replace(/^0/, '27') + '?text=' + encodeURIComponent(msg) : null;
    return (t.email ? '<a class="btn sm" href="mailto:' + encodeURIComponent(t.email) + '?subject=' + encodeURIComponent('Rent account ' + r.payment_reference) + '&body=' + encodeURIComponent(msg) + '">Email</a> ' : '') + (wa ? '<a class="btn sm" target="_blank" rel="noopener" href="' + wa + '">WhatsApp</a>' : '');
  }

  /* ---------- landlord statements ---------- */
  async function statements(qs) {
    const x = X(), e = x.esc;
    const lls = await q(x.sb.from('landlords').select('id, name').eq('agency_id', A()).is('archived_at', null).order('name'));
    const t = today(), from = qs.get('from') || t.slice(0, 8) + '01', to = qs.get('to') || t, ll = qs.get('l') || (lls[0] && lls[0].id) || '';
    x.shell('statements', 'Landlord statements', lls.length ? '<form id="sf" class="card row"><label class="f">Landlord' + sel('l', lls.map(l => [l.id, l.name]), ll) + '</label><label class="f">From' + x.inp('from', from, ' type="date"') + '</label><label class="f">To' + x.inp('to', to, ' type="date"') + '</label><button class="btn primary" style="align-self:end">Show statement</button></form><div id="st" style="margin-top:16px"></div>' : '<div class="empty">Add landlords and link them to properties first.</div>');
    if (!lls.length) return;
    x.$('sf').onsubmit = ev => { ev.preventDefault(); const v = x.formData(ev.target); x.go('#/statements?l=' + v.l + '&from=' + v.from + '&to=' + v.to); };
    try { const h = await statementHtml(A(), ll, from, to); x.$('st').innerHTML = '<div class="doc-preview tw">' + h.html + '</div><div class="row" style="margin-top:10px"><button class="btn" id="pr">Open printable statement</button></div>'; x.$('pr').onclick = () => printDoc('Statement ' + h.s.landlord.name, h.html, h.b); }
    catch (er) { x.$('st').innerHTML = '<div class="notice bad">' + e(x.friendly(er)) + '</div>'; }
  }

  /* ---------- dashboard card ---------- */
  async function dashCard() {
    const x = X(), R = x.R0; const o = await q(x.sb.rpc('rental_overview', { a: A() })); if (!o) return '';
    const rate = o.invoiced_month_cents ? Math.round(o.collected_month_cents / o.invoiced_month_cents * 100) + '%' : '–';
    return '<h3>Rentals this month</h3><div class="grid g2" style="gap:10px"><div><div class="small muted">Invoiced</div><b>' + R(o.invoiced_month_cents) + '</b></div><div><div class="small muted">Collected (verified)</div><b>' + R(o.collected_month_cents) + '</b> <span class="small muted">' + rate + '</span></div><div><div class="small muted">Arrears</div><b class="' + (o.arrears_cents > 0 ? 'down' : '') + '">' + R(o.arrears_cents) + '</b></div><div><div class="small muted">Active leases</div><b>' + o.leases_active + '</b>' + (o.leases_ending_60 ? ' <span class="chip warn">' + o.leases_ending_60 + ' ending in 60 days</span>' : '') + '</div></div>' + (o.unverified_payments ? '<p class="small" style="margin-top:10px"><a href="#/payments">' + o.unverified_payments + ' payment' + (o.unverified_payments === 1 ? '' : 's') + ' waiting to be verified</a></p>' : '') + '<div class="row" style="margin-top:10px"><a class="btn sm" href="#/leases">Leases</a><a class="btn sm" href="#/invoices">Invoices</a><a class="btn sm" href="#/arrears">Arrears</a></div>';
  }

  /* ---------- portal (tenants and landlords) ---------- */
  async function portal(qs) {
    const x = X(), e = x.esc, R = x.R;
    const ps = x.S.portals || [];
    if (!ps.length) return x.go('#/dashboard');
    const cur = ps.find(p => p.record_id === qs.get('r')) || ps[0];
    const b = await brand(cur.agency_id);
    if (b.primary_color) document.documentElement.style.setProperty('--brand', b.primary_color);
    let body = '';
    if (cur.kind === 'tenant') {
      const ls = await q(x.sb.from('leases').select('*, properties(name, address_line)').in('status', ['active', 'notice', 'ended']).order('start_date', { ascending: false }));
      const inv = await q(x.sb.from('rental_invoices').select('*').order('period_start', { ascending: false }).limit(60));
      body = ls.map(l => { const li = inv.filter(i => i.lease_id === l.id); const due = li.filter(i => ['issued', 'partially_paid'].includes(i.status)).reduce((t, i) => t + i.total_cents - i.paid_cents, 0);
        return '<div class="grid g3">' + x.kpi('Amount due', R(due), due > 0 ? 'Pay using reference ' + e(l.payment_reference) : 'Up to date') + x.kpi('Monthly rent', R(l.rent_cents), 'due on day ' + l.due_day) + x.kpi('Lease', chip(l.status), x.fmtD(l.start_date) + ' to ' + (l.end_date ? x.fmtD(l.end_date) : 'month to month')) + '</div>'
          + '<div class="card" style="margin-top:16px"><h3>How to pay</h3><p>Reference: <b><code>' + e(l.payment_reference) + '</code></b></p><p style="white-space:pre-line">' + e(b.payment_instructions || 'Ask your agency for its bank details.') + '</p><p class="small muted">Your payment shows here once the agency has confirmed it on its bank statement.</p></div>'
          + '<div class="card" style="margin-top:16px"><h3>' + e(l.properties.name) + ': invoices</h3>' + (li.length ? '<div class="tw"><table class="t"><tbody>' + li.map(i => '<tr><td>' + e(i.number) + '<div class="small muted">' + monthStr(i.period_start) + '</div></td><td class="n">' + R(i.total_cents) + '</td><td>' + chip(i.status) + '</td><td class="n"><button class="btn sm" data-pr="' + i.id + '">View</button></td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">No invoices yet.</p>') + '</div>'; }).join('') || '<div class="empty">No current lease is linked to your email yet.</div>';
      x.shell('portal', 'Tenant portal', body);
      document.querySelectorAll('[data-pr]').forEach(bt => bt.onclick = async () => { const i = inv.find(r => r.id === bt.dataset.pr); const h = await invoiceHtml(i); printDoc(i.number, h.html, h.b); });
    } else {
      const props = await q(x.sb.from('properties').select('id, name, address_line, occupancy'));
      const ls = await q(x.sb.from('leases').select('property_id, status, start_date, end_date, rent_cents').in('status', ['active', 'notice']));
      const t = today(), from = qs.get('from') || t.slice(0, 5) + '01-01', to = qs.get('to') || t;
      body = '<div class="card tw"><h3>Your properties</h3><table class="t"><tbody>' + props.map(p => { const l = ls.find(z => z.property_id === p.id); return '<tr><td><b>' + e(p.name) + '</b><div class="small muted">' + e(p.address_line) + '</div></td><td>' + chip(p.occupancy) + '</td><td class="small">' + (l ? 'Lease ' + chip(l.status) + ' to ' + (l.end_date ? x.fmtD(l.end_date) : 'month to month') + ', rent ' + R(l.rent_cents) : 'No current lease') + '</td></tr>'; }).join('') + '</tbody></table></div>'
        + '<form id="sf" class="card row" style="margin-top:16px"><b>Statement</b><label class="f">From' + x.inp('from', from, ' type="date"') + '</label><label class="f">To' + x.inp('to', to, ' type="date"') + '</label><button class="btn primary" style="align-self:end">Show</button></form><div id="st" style="margin-top:16px"></div>';
      x.shell('portal', 'Landlord portal', body);
      x.$('sf').onsubmit = ev => { ev.preventDefault(); const v = x.formData(ev.target); x.go('#/portal?r=' + cur.record_id + '&from=' + v.from + '&to=' + v.to); };
      try { const h = await statementHtml(cur.agency_id, cur.record_id, from, to); x.$('st').innerHTML = '<div class="doc-preview tw">' + h.html + '</div><button class="btn" id="pr" style="margin-top:10px">Open printable statement</button>'; x.$('pr').onclick = () => printDoc('Statement', h.html, h.b); } catch (er) { x.$('st').innerHTML = '<div class="notice bad">' + e(x.friendly(er)) + '</div>'; }
    }
    // portal header: agency brand, nav limited to the portal
    const side = document.querySelector('.side-nav') || document.querySelector('.side'); if (side) side.innerHTML = '<div class="grp">' + e(cur.agency_name) + '</div>' + ps.map(p => '<a href="#/portal?r=' + p.record_id + '"' + (p.record_id === cur.record_id ? ' aria-current="page"' : '') + '><span>' + (p.kind === 'tenant' ? 'Tenant' : 'Landlord') + ': ' + e(p.agency_name) + '</span></a>').join('') + '<div class="grp">You</div><a href="#/account">Account and security</a>';
    const nm = document.querySelector('.app-head .nm'); if (nm) nm.textContent = b.display_name || cur.agency_name;
    const lg = document.querySelector('.app-head .agency'); if (lg && b.logo_data && !lg.querySelector('img')) lg.insertAdjacentHTML('afterbegin', '<img src="' + e(b.logo_data) + '" alt="">');
  }

  window.RentOSPages = { landlords, tenants, leases, invoices, payments, arrears, statements, portal, dashCard };
})();
