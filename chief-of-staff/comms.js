/* MRET Sales OS: Messages (due-now queue, WhatsApp, email, AI writer, templates, log) and the Deal tracker
   (listing and deal checklists, documents, what is left behind). Records live in re_comms, re_tasks and re_templates,
   owner-only by row level security. Nothing is sent automatically: each message opens ready-written in WhatsApp or
   Gmail and you press send, so every message goes out from you. */
(function () {
  const X = () => window.SalesOS.ctx();
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const M = { mode: LS.get('cos.comms.mode', 'due'), focus: '', flowFilter: LS.get('cos.flow.filter', 'open'), ai: null };
  const me = () => Object.assign({ name: 'Uhuru', full: 'Uhuru Matlhaji', company: 'KW Edge', phone: '' }, LS.get('cos.comms.me', {}));
  const first = n => (String(n || '').trim().split(/\s+/)[0] || '').replace(/^./, c => c.toUpperCase()) || 'there';
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  const pick = (arr, seed) => arr[hash(seed) % arr.length];
  const waNum = p => { let d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('0')) d = '27' + d.slice(1); else if (d.length === 9) d = '27' + d; return d; };
  const monday = t => { const x = new Date(t + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const words = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] || String(n);
  const plural = (n, w) => words(n) + ' ' + w + (n === 1 ? '' : 's');
  const dayName = d => new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(String(d).slice(0, 10) + 'T12:00:00Z'));
  const whenTxt = ts => new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts));

  /* ---------- message templates (South African English, several versions each, no AI needed) ---------- */
  // Each body is written without greeting or sign-off; those are added per channel and varied so no two messages read the same.
  const T = {
    lead_first_response: { label: 'First response to a new lead', for: 'lead', subject: 'Your property enquiry', v: [
      'Thanks for reaching out {interest}. I would love to help. When is a good time for a quick call today or tomorrow?',
      'It\'s {my_name} from {company} here. Thank you for your enquiry {interest}. Do you have five minutes later today so I can understand exactly what you are looking for?',
      'Thank you for getting in touch {interest}. I have a few ideas I would like to share with you. Would a short call this afternoon suit you?'] },
    appt_confirm: { label: 'Appointment confirmation', for: 'lead', subject: 'Confirming our appointment', v: [
      'Just confirming our {appt_kind} on {when}{at_address}. If anything changes on your side, just let me know. Looking forward to it.',
      'A quick note to confirm I will see you on {when}{at_address} for our {appt_kind}. Please shout if the time no longer works.',
      'Looking forward to our {appt_kind} on {when}{at_address}. Is there anything you would like me to bring or prepare beforehand?'] },
    viewing_thanks: { label: 'Thank you after a viewing', for: 'lead', subject: 'Thank you for viewing {address}', v: [
      'Thank you for viewing {address} {view_day}. What did you think? Whatever stood out, good or bad, I would really like to hear it.',
      'It was good to show you {address} {view_day}. How did it feel compared to what you have seen so far? Happy to answer any questions or arrange a second look.',
      'Thanks for making the time to see {address} {view_day}. Could you see yourselves living there? If it is not quite right, tell me what was missing and I will keep looking for you.'] },
    seller_feedback: { label: 'Weekly seller feedback', for: 'seller', subject: 'Your weekly update: {address}', v: [
      'Here is your update on {address}. {feedback_lines} {next_line}',
      'A quick update on {address} for this week. {feedback_lines} {next_line}',
      'Your weekly report on {address}. {feedback_lines} {next_line}'] },
    offer_congrats_buyer: { label: 'OTP accepted: buyer', for: 'buyer', subject: 'Congratulations, your offer on {address} was accepted', v: [
      'Great news: your offer on {address} has been accepted. Congratulations! Next we get the bond and paperwork moving, and I will guide you through each step. {bond_line}',
      'Congratulations, {address} is yours subject to the conditions in the offer. I will be in touch about the next steps and the documents we need. {bond_line}',
      'Wonderful news, the seller has accepted your offer on {address}. Well done. I will keep you posted every step of the way. {bond_line}'] },
    offer_congrats_seller: { label: 'OTP accepted: seller', for: 'seller', subject: 'Your offer on {address} is accepted', v: [
      'Good news: the offer on {address} is signed and accepted. From here I will keep a close eye on the bond and transfer and update you as things move.',
      'We have a signed offer on {address}. Congratulations! I will manage the process with the buyer, the bank and the conveyancer, and keep you updated.',
      'Well done, {address} is sold subject to the conditions in the offer. I will keep you up to date as the bond and transfer progress.'] },
    bond_reminder: { label: 'Bond approval reminder', for: 'buyer', subject: 'Bond approval for {address}', v: [
      'Just checking in on the bond for {address}. Approval is due by {bond_due}, so we have {bond_days} left. Has the bank or originator come back to you yet? Anything you need from my side?',
      'A quick reminder that the bond approval date for {address} is {bond_due}. Please let me know where the application stands so we can stay ahead of it.',
      'How is the bond application for {address} going? The deadline in the offer is {bond_due}. If the bank needs anything else, send it through and I will help where I can.'] },
    mandate_extension: { label: 'Mandate extension', for: 'seller', subject: 'Next steps for {address}', v: [
      'Your mandate on {address} runs until {expiry}. I would like to sit down with you to go through the feedback so far and agree on the plan for the next few weeks. Would this week suit you?',
      'With the mandate on {address} ending on {expiry}, I would like to meet to review what buyers have said and how we get it sold. When could we get together?',
      'I have put together the full feedback on {address} and some ideas for the next stretch. The mandate ends on {expiry}, so can we find a time this week to talk it through?'] },
    registered_congrats: { label: 'Registration congratulations', for: 'lead', subject: 'Registered: {address}', v: [
      'Great news, the transfer of {address} registered today. Congratulations! It has been a pleasure working with you.',
      'It is official: {address} has registered in the Deeds Office. Congratulations and thank you for trusting me with it.',
      'Registration of {address} came through. Congratulations! Thank you for being such a pleasure to work with.'] },
    testimonial_request: { label: 'Testimonial and referral request', for: 'lead', subject: 'A small favour', v: [
      'It was a real pleasure helping you with {address}. If you were happy with my service, would you mind writing me a short review? It makes a big difference. And if anyone you know is thinking of buying or selling, I would be grateful for an introduction.',
      'I hope you are settling in well after {address}. Could I ask a small favour? A few lines about your experience would mean a lot to me. And if friends or family need help with property, please pass on my number.',
      'Thank you again for {address}. If you have a moment, a short testimonial about working with me would really help my business grow. I also look after referrals personally, so please send anyone my way.'] },
    nurture_checkin: { label: 'Check-in (nurture)', for: 'lead', subject: 'Checking in', v: [
      'It has been a while, so I wanted to check in. {nurture_line} Is anything changing on your side with your property plans?',
      'I hope all is well with you. {nurture_line} Let me know if there is anything I can help with.',
      'Just touching base. {nurture_line} Are you still thinking about a move this year?'] },
    doc_request: { label: 'Document request', for: 'lead', subject: 'Documents still needed: {address}', v: [
      'To keep {address} moving, I still need the following from you:\n{doc_list}\nClear photos or scans are fine, here or by email. Thank you!',
      'We are making good progress on {address}. The only things outstanding from your side are:\n{doc_list}\nCould you send these through when you get a moment?',
      'A quick one on {address}. Please could you send me:\n{doc_list}\nThat will let the conveyancer carry on without delays.'] },
    custom: { label: 'Blank message', for: 'lead', subject: '', v: [''] }
  };
  const GREET = ['Hi', 'Hello', 'Good day'];
  const SIGN_WA = n => [n, 'Kind regards, ' + n, 'Thanks, ' + n];
  const fill = (s, v) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => v[k] != null ? v[k] : '');

  function vars(c) {
    const { D, R, fmtD, today, days, lab } = X(), m = me();
    const lead = c.lead_id && D.leadById[c.lead_id], ls = c.listing_id && D.lstById[c.listing_id], of = c.offer_id && D.offerById[c.offer_id];
    const lst = ls || (of && of.listing_id && D.lstById[of.listing_id]);
    const address = lst ? lst.address : of ? of.property_text || 'the property' : 'the property';
    const v = { first_name: first(lead && lead.name), my_name: m.name, my_full: m.full, company: m.company, address, area: (lead && lead.area) || (lst && lst.suburb) || '' };
    v.interest = lead ? (lead.kind === 'seller' || lead.kind === 'landlord' ? 'about selling your property' : 'about finding a home') + (lead.area ? ' in ' + lead.area : '') : '';
    const ap = c.appt_id && D.appts.find(a => a.id === c.appt_id);
    if (ap) { v.appt_kind = lab(ap.kind).toLowerCase(); v.when = whenTxt(ap.scheduled_at); const al = ap.listing_id && D.lstById[ap.listing_id]; v.at_address = al ? ' at ' + al.address : ''; }
    const vw = c.viewing_id && D.views.find(x => x.id === c.viewing_id);
    if (vw) { const d = days(window.SalesOS.ctx().ymd(vw.viewed_at), today()); v.view_day = d <= 0 ? 'today' : d === 1 ? 'yesterday' : 'on ' + dayName(vw.viewed_at); }
    if (lst) {
      const wk = monday(today()), vs = D.views.filter(x => x.listing_id === lst.id), w = vs.filter(x => window.SalesOS.ctx().ymd(x.viewed_at) >= wk || window.SalesOS.ctx().ymd(x.viewed_at) >= X().addDays(today(), -7));
      const grp = a => a.reduce((t, x) => t + (x.groups || 1), 0), hot = w.filter(x => x.interest === 'hot').length, high = w.filter(x => x.price_feedback === 'too_high').length, fair = w.filter(x => ['fair', 'good_value'].includes(x.price_feedback)).length;
      const quotes = w.filter(x => x.feedback).slice(0, 3).map(x => '"' + x.feedback.trim().replace(/\s+/g, ' ') + '"');
      const lines = [];
      lines.push(grp(w) ? 'In the last seven days we had ' + plural(grp(w), 'viewing') + (grp(vs) > grp(w) ? ', ' + grp(vs) + ' in total since we listed.' : ', the first since we listed.') : 'We had no viewings in the last seven days (' + grp(vs) + ' in total since we listed).');
      if (hot) lines.push(words(hot).replace(/^./, c2 => c2.toUpperCase()) + (hot === 1 ? ' buyer was' : ' buyers were') + ' really keen.');
      if (high || fair) lines.push('On price, ' + (fair ? words(fair) + ' felt it was fair' : '') + (fair && high ? ' and ' : '') + (high ? words(high) + ' felt it was on the high side' : '') + '.');
      if (quotes.length) lines.push('What buyers said: ' + quotes.join('; ') + '.');
      const offers = D.offers.filter(o => o.listing_id === lst.id && ['submitted', 'countered'].includes(o.status));
      if (offers.length) lines.push('There ' + (offers.length === 1 ? 'is one offer' : 'are ' + words(offers.length) + ' offers') + ' on the table.');
      v.feedback_lines = lines.join(' ');
      v.next_line = !grp(w) || high >= 2 ? 'I would like to chat about how we position the price and the marketing for the next two weeks. When suits you?' : 'I will keep the momentum going this week. Call me any time if you have questions.';
      v.price = R(lst.list_price); v.expiry = lst.mandate_expiry ? fmtD(lst.mandate_expiry) : '';
    }
    if (of) { v.bond_due = of.bond_due_date ? dayName(of.bond_due_date) : ''; const bd = of.bond_due_date ? days(today(), of.bond_due_date) : null; v.bond_days = bd == null ? '' : plural(Math.max(bd, 0), 'day'); v.bond_line = of.finance && of.finance !== 'cash' && of.bond_due_date ? 'The bond needs to be approved by ' + dayName(of.bond_due_date) + '.' : ''; }
    v.nurture_line = lead ? (['seller', 'landlord', 'investor'].includes(lead.kind) ? 'Prices' + (v.area ? ' in ' + v.area : '') + ' have been moving, so if you would like an updated value on your home, I am happy to do one.' : 'I have seen a few new homes' + (v.area ? ' in ' + v.area : '') + ' that made me think of you.') : '';
    v.doc_list = c.doc_list || '';
    return v;
  }
  function compose(code, channel, c, variant) {
    const t = T[code] || T.custom, v = vars(c), m = me(), seed = (c.rule_key || code + (c.lead_id || '') + (c.listing_id || '')) + ':' + (variant || 0);
    const own = X().D.tpls.find(x => x.code === code && x.channel === channel);
    if (own) return { subject: fill(own.subject || t.subject, v), body: fill(own.body, v).trim() };
    const core = fill(pick(t.v, seed), v).replace(/ +\./g, '.').replace(/ {2,}/g, ' ').trim();
    const g = pick(GREET, seed + 'g') + ' ' + v.first_name;
    if (channel === 'whatsapp') return { subject: '', body: (g + (core ? ', ' + (/^(I\b|[A-Z]{2})/.test(core) ? core : core.replace(/^./, c2 => c2.toLowerCase())) : ',')).trim() + '\n\n' + pick(SIGN_WA(m.name), seed + 's') };
    return { subject: fill(t.subject, v), body: g + ',\n\n' + core + '\n\nKind regards\n' + m.full + '\n' + m.company + (m.phone ? '\n' + m.phone : '') };
  }

  /* ---------- due-now rules: what should go out today, nothing twice ---------- */
  function dueItems() {
    const { D, today, addDays, days, ymd, fmtD } = X(), t = today(), sent = new Set(D.comms.map(c => c.rule_key).filter(Boolean)), out = [];
    const add = (key, code, c, title, why, pri) => { if (!sent.has(key)) out.push(Object.assign({ key, code, title, why, pri }, c)); };
    const nm = id => id && X().D.leadById[id] ? X().D.leadById[id].name : '';
    D.leads.filter(l => l.status === 'new' && !l.first_contact_at).forEach(l => add('first:' + l.id, 'lead_first_response', { lead_id: l.id }, 'First response: ' + l.name, 'New ' + l.kind + ' lead from ' + X().lab(l.source) + ', received ' + X().fmtDT(l.received_at) + '. Speed wins this one.', 100));
    const soon = Date.now() + 36 * 3600e3;
    D.appts.filter(a => a.status === 'booked' && a.lead_id && new Date(a.scheduled_at).getTime() > Date.now() && new Date(a.scheduled_at).getTime() < soon).forEach(a => add('appt:' + a.id, 'appt_confirm', { lead_id: a.lead_id, listing_id: a.listing_id, appt_id: a.id }, 'Confirm appointment: ' + nm(a.lead_id), X().lab(a.kind) + ' on ' + X().fmtDT(a.scheduled_at) + '.', 90));
    D.views.filter(v => v.lead_id && ymd(v.viewed_at) >= addDays(t, -3)).forEach(v => add('vthanks:' + v.id, 'viewing_thanks', { lead_id: v.lead_id, listing_id: v.listing_id, viewing_id: v.id }, 'Thank you after viewing: ' + nm(v.lead_id), (D.lstById[v.listing_id] ? D.lstById[v.listing_id].address : '') + ', ' + X().lab(v.interest).toLowerCase() + ' interest.', 80));
    const wk = monday(t);
    D.listings.filter(l => l.status === 'active' && l.seller_lead_id && l.mandate_start <= addDays(t, -5)).forEach(l => add('sfb:' + l.id + ':' + wk, 'seller_feedback', { lead_id: l.seller_lead_id, listing_id: l.id }, 'Weekly seller feedback: ' + l.address, 'Sellers who hear from you every week stay loyal and accept price advice sooner.', 70));
    D.offers.filter(o => ['accepted', 'registered'].includes(o.status) && o.accepted_date && o.accepted_date >= addDays(t, -14)).forEach(o => {
      const ls = o.listing_id && D.lstById[o.listing_id];
      if (o.buyer_lead_id) add('otpb:' + o.id, 'offer_congrats_buyer', { lead_id: o.buyer_lead_id, listing_id: o.listing_id, offer_id: o.id }, 'Congratulate buyer: ' + nm(o.buyer_lead_id), 'OTP accepted ' + fmtD(o.accepted_date) + '.', 85);
      if (ls && ls.seller_lead_id) add('otps:' + o.id, 'offer_congrats_seller', { lead_id: ls.seller_lead_id, listing_id: ls.id, offer_id: o.id }, 'Update seller: offer accepted on ' + ls.address, 'OTP accepted ' + fmtD(o.accepted_date) + '.', 85);
    });
    D.offers.filter(o => o.status === 'accepted' && o.buyer_lead_id && o.bond_due_date && !o.bond_approved_date && days(t, o.bond_due_date) <= 7).forEach(o => add('bond:' + o.id + ':' + o.bond_due_date, 'bond_reminder', { lead_id: o.buyer_lead_id, listing_id: o.listing_id, offer_id: o.id }, 'Bond reminder: ' + nm(o.buyer_lead_id), 'Bond approval due ' + fmtD(o.bond_due_date) + ' (' + days(t, o.bond_due_date) + ' days).', 95));
    D.listings.filter(l => l.status === 'active' && l.seller_lead_id && l.mandate_expiry && days(t, l.mandate_expiry) <= 30 && days(t, l.mandate_expiry) >= -7).forEach(l => add('mext:' + l.id + ':' + l.mandate_expiry, 'mandate_extension', { lead_id: l.seller_lead_id, listing_id: l.id }, 'Mandate extension: ' + l.address, 'Mandate ends ' + fmtD(l.mandate_expiry) + '.', 75));
    D.offers.filter(o => o.registration_date).forEach(o => {
      const ls = o.listing_id && D.lstById[o.listing_id], d = days(o.registration_date, t), parties = [['b', o.buyer_lead_id], ['s', ls && ls.seller_lead_id]].filter(p => p[1]);
      parties.forEach(([k, id]) => {
        if (d <= 14) add('reg' + k + ':' + o.id, 'registered_congrats', { lead_id: id, listing_id: o.listing_id, offer_id: o.id }, 'Registration congratulations: ' + nm(id), 'Registered ' + fmtD(o.registration_date) + '.', 80);
        if (d >= 7 && d <= 90) add('testi' + k + ':' + o.id, 'testimonial_request', { lead_id: id, listing_id: o.listing_id, offer_id: o.id }, 'Ask for a testimonial and referrals: ' + nm(id), 'Registered ' + d + ' days ago. Happy clients refer when asked.', 60);
      });
    });
    const lastTouch = {}; D.comms.forEach(c => { if (c.lead_id && c.status !== 'skipped' && (!lastTouch[c.lead_id] || c.at > lastTouch[c.lead_id])) lastTouch[c.lead_id] = c.at; });
    const mon = t.slice(0, 7), cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
    D.leads.filter(l => (l.status === 'nurture' || l.status === 'qualified') && (lastTouch[l.id] || l.first_contact_at || l.received_at) < cutoff && (l.phone || l.email)).slice(0, 12).forEach(l => add('nurt:' + l.id + ':' + mon, 'nurture_checkin', { lead_id: l.id }, 'Check in: ' + l.name, 'No contact for more than 30 days.', 40));
    // outstanding documents per party, once a week
    groupDocs().forEach(g => add('docs:' + g.lead_id + ':' + (g.listing_id || g.ent) + ':' + wk, 'doc_request', { lead_id: g.lead_id, listing_id: g.listing_id, offer_id: g.offer_id, doc_list: g.items.map(x => '- ' + x.title).join('\n'), task_ids: g.items.concat(g.dupes || []).map(x => x.id) }, 'Request documents from ' + nm(g.lead_id), g.items.length + ' document' + (g.items.length === 1 ? '' : 's') + ' outstanding for ' + g.address + '.', g.overdue ? 88 : 65));
    return out.sort((a, b) => b.pri - a.pri);
  }
  function groupDocs() {
    const { D } = X(), g = {};
    D.tasks.filter(x => x.is_document && ['open', 'requested'].includes(x.status) && ['seller', 'buyer'].includes(x.responsible)).forEach(x => {
      const ent = entOf(x); if (!ent || !ent.live) return;
      const lead_id = x.responsible === 'seller' ? ent.seller : ent.buyer; if (!lead_id) return;
      const k = lead_id + ':' + (ent.listing_id || ent.key); const grp = g[k] = g[k] || { ent: ent.key, ents: [], party: x.responsible, lead_id, listing_id: ent.listing_id, offer_id: ent.offer_id, address: ent.address, items: [], overdue: false };
      if (!grp.ents.includes(ent.key)) grp.ents.push(ent.key); if (ent.offer_id) grp.offer_id = ent.offer_id;
      if (!grp.items.some(y => y.title === x.title)) grp.items.push(x); else (grp.dupes = grp.dupes || []).push(x);
      if (x.due_date && x.due_date < X().today()) g[k].overdue = true;
    });
    return Object.values(g);
  }

  /* ---------- checklists ---------- */
  const CL = {
    listing: [
      ['Mandate', 'mandate_signed', 'Mandate signed by all registered owners', 1, 'me', 0],
      ['Mandate', 'disclosure', 'Mandatory disclosure form signed by the seller', 1, 'seller', 2],
      ['Mandate', 'seller_fica', 'Seller FICA: ID and proof of address', 1, 'seller', 3],
      ['Mandate', 'title_deed', 'Title deed copy or deeds search', 1, 'me', 3],
      ['Mandate', 'rates_account', 'Latest rates account (and levy statement if sectional title)', 1, 'seller', 5],
      ['Marketing', 'photos', 'Professional photos and video done', 0, 'me', 5],
      ['Marketing', 'listing_live', 'Live on KW Homes and the portals', 0, 'me', 7],
      ['Marketing', 'launch', 'Launch: database, WhatsApp groups and social posts', 0, 'me', 8],
      ['Compliance', 'coc_electrical', 'Electrical certificate of compliance', 1, 'seller', 30],
      ['Compliance', 'beetle', 'Beetle certificate (if the buyer or bank needs it)', 1, 'seller', 30],
      ['Compliance', 'gas_coc', 'Gas certificate (if gas is installed)', 1, 'seller', 30],
      ['Compliance', 'fence_coc', 'Electric fence certificate (if fitted)', 1, 'seller', 30]],
    deal: [
      ['Offer', 'otp_signed', 'OTP signed by all parties, every page initialled', 1, 'me', 0],
      ['Offer', 'otp_sent', 'Signed OTP sent to conveyancer, originator and both parties', 0, 'me', 1],
      ['Offer', 'deposit', 'Deposit paid into trust (if applicable)', 0, 'buyer', 3],
      ['Offer', 'buyer_fica', 'Buyer FICA: ID, proof of address and income', 1, 'buyer', 3],
      ['Offer', 'seller_fica_deal', 'Seller FICA and bank details to the conveyancer', 1, 'seller', 5],
      ['Finance', 'bond_applied', 'Bond application submitted', 0, 'buyer', 3, 'bond'],
      ['Finance', 'bond_approval', 'Bond approval received', 1, 'originator', null, 'bond'],
      ['Finance', 'guarantees', 'Guarantees issued', 0, 'conveyancer', null, 'bond'],
      ['Transfer', 'conveyancer', 'Conveyancer instructed', 0, 'me', 2],
      ['Transfer', 'compliance_certs', 'Compliance certificates delivered to the conveyancer', 1, 'seller', 21],
      ['Transfer', 'commission_invoice', 'Commission invoice sent to the conveyancer', 1, 'me', 7],
      ['Transfer', 'rates_clearance', 'Rates clearance figures and certificate', 1, 'conveyancer', 21],
      ['Transfer', 'transfer_duty', 'Transfer duty paid (SARS receipt)', 1, 'conveyancer', 30],
      ['Transfer', 'lodgement', 'Lodged at the Deeds Office', 0, 'conveyancer', 45],
      ['Transfer', 'registration', 'Registered', 0, 'conveyancer', 60],
      ['Handover', 'keys', 'Keys, remotes and manuals handed over', 0, 'me', 62],
      ['Handover', 'testimonial', 'Testimonial and referrals asked', 0, 'me', 70]]
  };
  function entOf(x) {
    const { D } = X();
    if (x.offer_id) { const o = D.offerById[x.offer_id]; if (!o) return null; const ls = o.listing_id && D.lstById[o.listing_id]; return { key: 'deal:' + o.id, kind: 'deal', offer_id: o.id, listing_id: o.listing_id, address: ls ? ls.address : o.property_text || 'Deal', seller: ls && ls.seller_lead_id, buyer: o.buyer_lead_id, live: o.status === 'accepted' || (o.status === 'registered' && o.registration_date >= X().addDays(X().today(), -60)), rec: o }; }
    if (x.listing_id) { const l = D.lstById[x.listing_id]; if (!l) return null; return { key: 'listing:' + l.id, kind: 'listing', listing_id: l.id, address: l.address, seller: l.seller_lead_id, live: ['active', 'under_offer'].includes(l.status), rec: l }; }
    return null;
  }
  // Creates any missing checklist items for live listings and accepted deals, and ticks items the deal record already proves.
  async function sync() {
    const { D, sb, addDays, today } = X(), have = new Set(D.tasks.map(x => (x.offer_id || x.listing_id || x.lead_id) + ':' + x.code)), ins = [], upd = [];
    const sixty = addDays(today(), -60);
    D.listings.filter(l => ['active', 'under_offer'].includes(l.status)).forEach(l => CL.listing.forEach(([stage, code, title, doc, resp, off], i) => { if (!have.has(l.id + ':' + code)) ins.push({ listing_id: l.id, flow: 'listing', stage, code, title, is_document: !!doc, responsible: resp, sort: i, due_date: off == null || !l.mandate_start ? null : addDays(l.mandate_start, off) }); }));
    D.offers.filter(o => o.status === 'accepted' || (o.status === 'registered' && (o.registration_date || '') >= sixty)).forEach(o => {
      const base = o.accepted_date || o.offer_date, cash = o.finance === 'cash';
      CL.deal.forEach(([stage, code, title, doc, resp, off, need], i) => {
        if (have.has(o.id + ':' + code)) return;
        let due = off == null ? null : addDays(base, off);
        if (code === 'bond_approval') due = o.bond_due_date || null; if (code === 'guarantees' && o.bond_due_date) due = addDays(o.bond_due_date, 14);
        ins.push({ offer_id: o.id, listing_id: o.listing_id || null, flow: 'deal', stage, code, title, is_document: !!doc, responsible: resp, sort: i, due_date: due, status: need === 'bond' && cash ? 'not_needed' : 'open' });
      });
    });
    // facts already on the deal record
    const proof = { conveyancer: o => !!o.conveyancer, bond_approval: o => !!o.bond_approved_date, lodgement: o => !!o.lodgement_date, registration: o => !!o.registration_date, otp_signed: o => ['accepted', 'registered'].includes(o.status) };
    D.tasks.filter(x => x.offer_id && proof[x.code] && ['open', 'requested'].includes(x.status) && D.offerById[x.offer_id] && proof[x.code](D.offerById[x.offer_id])).forEach(x => upd.push(x.id));
    if (!ins.length && !upd.length) return false;
    if (ins.length) {
      const r = await sb.from('re_tasks').insert(ins);
      if (r.error) for (const row of ins) await sb.from('re_tasks').insert(row); // one by one so a single duplicate cannot block the rest
    }
    if (upd.length) await sb.from('re_tasks').update({ status: 'done' }).in('id', upd);
    // new deals also tick their proven items on this pass
    return true;
  }

  /* ---------- AI writer (Supabase edge function ai-write; falls back to templates) ---------- */
  async function aiWrite(channel, c, draft, instruction) {
    const { sb } = X(), v = vars(c), t = T[c.code] || T.custom;
    const facts = Object.entries(v).filter(([k, x]) => x && !['my_full', 'interest', 'nurture_line'].includes(k)).map(([k, x]) => k.replace(/_/g, ' ') + ': ' + x).join('\n');
    const r = await sb.functions.invoke('ai-write', { body: { channel, purpose: t.label, facts, draft, instruction } });
    if (r.error) { let msg = r.error.message || String(r.error); try { const j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) {} throw new Error(msg); }
    if (r.data && r.data.error) throw new Error(r.data.error === 'not_configured' ? 'not_configured' : r.data.message || r.data.error);
    return r.data;
  }

  /* ---------- composer ---------- */
  async function logComm(c, row) {
    const { sb } = X();
    const rec = Object.assign({ lead_id: c.lead_id || null, listing_id: c.listing_id || null, offer_id: c.offer_id || null, template_code: c.code || null, rule_key: c.rule_key || null }, row);
    const r = await sb.from('re_comms').insert(rec); if (r.error) throw new Error(r.error.message);
    if (c.code === 'lead_first_response' && c.lead_id && row.status !== 'skipped') { const l = X().D.leadById[c.lead_id]; if (l && !l.first_contact_at) await X().save('re_leads', { first_contact_at: new Date().toISOString(), status: l.status === 'new' ? 'contacted' : l.status }, l.id); }
    if (c.task_ids && c.task_ids.length && row.status !== 'skipped') await sb.from('re_tasks').update({ status: 'requested' }).in('id', c.task_ids).eq('status', 'open');
    if (c.code === 'testimonial_request' && c.offer_id && row.status !== 'skipped') await sb.from('re_tasks').update({ status: 'done' }).eq('offer_id', c.offer_id).eq('code', 'testimonial').in('status', ['open', 'requested']);
  }
  function openCompose(c) {
    const { D, esc, $ } = X(), dlg = $('soDlg'); if (!dlg) return;
    const lead = c.lead_id && D.leadById[c.lead_id];
    let channel = c.channel || (lead && !lead.phone && lead.email ? 'email' : 'whatsapp'), variant = 0;
    c.code = c.code || (lead && lead.status === 'new' ? 'lead_first_response' : 'custom');
    const tplOpts = Object.entries(T).map(([k, t]) => '<option value="' + k + '"' + (k === c.code ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('');
    const leadSel = '<select class="inp" id="cmLead"><option value="">Choose a person</option>' + D.leads.map(l => '<option value="' + l.id + '"' + (l.id === c.lead_id ? ' selected' : '') + '>' + esc(l.name) + '</option>').join('') + '</select>';
    dlg.innerHTML = '<div class="soform"><div class="dh"><h3>' + esc(c.title || 'New message') + '</h3><button class="btn sm" id="cmX">Close</button></div>'
      + '<div class="grid g3 fg">' + '<label class="f">To' + leadSel + '</label>' + '<label class="f">Message<select class="inp" id="cmTpl">' + tplOpts + '</select></label>'
      + '<label class="f">Send by<div class="seg" id="cmCh"><button data-ch="whatsapp">WhatsApp</button><button data-ch="email">Email</button></div></label>'
      + '<label class="f" id="cmToW">Number or address<input class="inp" id="cmTo"></label>'
      + '<label class="f wide" id="cmSubjW">Subject<input class="inp" id="cmSubj"></label>'
      + '<label class="f wide">Text<textarea class="inp" id="cmBody" rows="10"></textarea></label></div>'
      + '<div class="row cmai"><button class="btn" id="cmAi">Write with AI</button><button class="btn" id="cmWarm">More personal</button><button class="btn" id="cmShort">Shorter</button><button class="btn" id="cmAlt">Another version</button><span class="small muted" id="cmAiMsg"></span></div>'
      + '<div class="row" style="margin-top:10px"><button class="btn red" id="cmSend"></button><button class="btn" id="cmMail">Email app</button><button class="btn" id="cmCopy">Copy</button><button class="btn" id="cmLog">Log as sent</button>' + (c.rule_key ? '<button class="btn" id="cmSkip" style="margin-left:auto">Not needed</button>' : '') + '</div>'
      + '<p class="err" id="cmErr"></p><div id="cmHist"></div></div>';
    if (!dlg.open) dlg.showModal();
    const body = $('cmBody'), subj = $('cmSubj'), to = $('cmTo');
    const setTo = () => { const l = c.lead_id && D.leadById[c.lead_id]; to.value = l ? (channel === 'whatsapp' ? l.phone || '' : l.email || '') : ''; };
    const fillText = () => { const m = compose(c.code, channel, c, variant); body.value = m.body; subj.value = m.subject; };
    const paint = () => { dlg.querySelectorAll('#cmCh button').forEach(b => b.setAttribute('aria-pressed', b.dataset.ch === channel)); $('cmSubjW').style.display = channel === 'email' ? '' : 'none'; $('cmMail').style.display = channel === 'email' ? '' : 'none'; $('cmSend').textContent = channel === 'whatsapp' ? 'Open in WhatsApp' : 'Open in Gmail'; $('cmHist').innerHTML = historyHtml({ lead_id: c.lead_id }); };
    setTo(); fillText(); paint();
    $('cmX').onclick = () => dlg.close();
    $('cmLead').onchange = e => { c.lead_id = e.target.value || null; setTo(); fillText(); paint(); };
    $('cmTpl').onchange = e => { c.code = e.target.value; fillText(); };
    dlg.querySelectorAll('#cmCh button').forEach(b => b.onclick = () => { channel = b.dataset.ch; setTo(); fillText(); paint(); });
    $('cmAlt').onclick = () => { variant++; fillText(); };
    const ai = async (instruction, btn) => {
      const msg = $('cmAiMsg'); btn.disabled = true; msg.textContent = 'Writing...';
      try { const r = await aiWrite(channel, c, body.value, instruction); if (r.body) body.value = r.body; if (r.subject && channel === 'email') subj.value = r.subject; msg.textContent = 'Read it through, then send.'; }
      catch (e) { msg.textContent = /not_configured/.test(e.message) ? 'AI writing is not switched on yet (see Templates). The template text is ready to use.' : 'AI could not write this one: ' + e.message + '. The template text is ready to use.'; }
      btn.disabled = false;
    };
    $('cmAi').onclick = e => ai('Write this message fresh from the facts, in my voice.', e.target);
    $('cmWarm').onclick = e => ai('Make this warmer and more personal, as if I wrote it myself on my phone. Keep every fact.', e.target);
    $('cmShort').onclick = e => ai('Make this shorter and simpler. Keep the key facts and the question.', e.target);
    const done = async (row, label) => { try { await logComm(c, Object.assign({ channel, recipient: to.value.trim() || null, subject: channel === 'email' ? subj.value : null, body: body.value }, row)); dlg.close(); X().toast(label); await X().refresh(); } catch (e) { $('cmErr').textContent = e.message; } };
    $('cmSend').onclick = () => {
      const txt = body.value.trim(); if (!txt) { $('cmErr').textContent = 'Write the message first.'; return; }
      if (channel === 'whatsapp') window.open('https://wa.me/' + waNum(to.value) + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
      else window.open('https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to.value.trim()) + '&su=' + encodeURIComponent(subj.value) + '&body=' + encodeURIComponent(txt), '_blank', 'noopener');
      done({ status: 'sent' }, channel === 'whatsapp' ? 'Opened in WhatsApp and logged' : 'Opened in Gmail and logged');
    };
    $('cmMail').onclick = () => { location.href = 'mailto:' + encodeURIComponent(to.value.trim()) + '?subject=' + encodeURIComponent(subj.value) + '&body=' + encodeURIComponent(body.value); done({ status: 'sent' }, 'Opened in your email app and logged'); };
    $('cmCopy').onclick = async () => { try { await navigator.clipboard.writeText((channel === 'email' && subj.value ? subj.value + '\n\n' : '') + body.value); X().toast('Copied'); } catch (e) { $('cmErr').textContent = 'Copy failed. Select the text and copy it.'; } };
    $('cmLog').onclick = () => done({ status: 'logged' }, 'Logged');
    if ($('cmSkip')) $('cmSkip').onclick = () => done({ status: 'skipped', body: null }, 'Marked as not needed');
  }
  function historyHtml(f) {
    const { D, esc, fmtDT, lab } = X();
    const rows = D.comms.filter(c => c.status !== 'skipped' && (f.lead_id ? c.lead_id === f.lead_id : f.listing_id ? c.listing_id === f.listing_id : f.offer_id ? c.offer_id === f.offer_id : false)).slice(0, 8);
    if (!rows.length) return f.listing_id ? '<h3 style="margin-top:14px">Messages</h3><div class="empty">Nothing sent about this property yet.</div>' : '';
    return '<h3 style="margin-top:14px">Messages' + (f.lead_id ? ' with this person' : '') + '</h3><ul class="list">' + rows.map(c => '<li><span>' + fmtDT(c.at) + ' · ' + lab(c.channel) + ' · ' + esc(T[c.template_code] ? T[c.template_code].label : lab(c.template_code || c.status)) + (c.lead_id && D.leadById[c.lead_id] && !f.lead_id ? ' · ' + esc(D.leadById[c.lead_id].name) : '') + '</span><span class="small muted">' + esc(String(c.body || '').slice(0, 110)) + '</span></li>').join('') + '</ul>';
  }

  /* ---------- Messages view ---------- */
  function vComms() {
    const { D, esc, fmtDT, lab, kpi, today } = X(), due = dueItems(), t = today();
    const wk = D.comms.filter(c => c.status !== 'skipped' && c.at >= new Date(Date.now() - 7 * 864e5).toISOString());
    const head = '<div class="grid g4">' + kpi('Due now', due.length, due.filter(x => x.pri >= 85).length + ' urgent') + kpi('Sent this week', wk.length, wk.filter(c => c.channel === 'whatsapp').length + ' WhatsApp, ' + wk.filter(c => c.channel === 'email').length + ' email') + kpi('Sellers updated this week', new Set(D.comms.filter(c => c.template_code === 'seller_feedback' && c.status !== 'skipped' && c.at.slice(0, 10) >= monday(t)).map(c => c.listing_id)).size + ' of ' + D.listings.filter(l => l.status === 'active' && l.seller_lead_id).length, 'Active listings with a seller linked') + kpi('Documents outstanding', D.tasks.filter(x => x.is_document && ['open', 'requested'].includes(x.status) && entOf(x) && entOf(x).live).length, 'Across live listings and deals') + '</div>';
    const modes = '<div class="seg" style="margin:14px 0">' + [['due', 'Due now'], ['log', 'Sent'], ['tpl', 'Templates and AI']].map(m => '<button data-cm="' + m[0] + '" aria-pressed="' + (M.mode === m[0]) + '">' + m[1] + '</button>').join('') + '</div><button class="btn red" id="cmNew" style="margin-left:10px">New message</button>';
    let body = '';
    if (M.mode === 'due') body = due.length ? '<div class="card"><ul class="list due">' + due.map((x, i) => '<li><span><b>' + esc(x.title) + '</b><div class="small muted">' + esc(x.why) + '</div></span><span class="act"><button class="btn sm red" data-due="' + i + '">Prepare</button><button class="btn sm" data-dskip="' + i + '">Not needed</button></span></li>').join('') + '</ul></div>' : '<div class="card"><div class="empty">Nothing due. Every lead, client and seller is up to date.</div></div>';
    if (M.mode === 'log') { const rows = D.comms.slice(0, 150); body = '<div class="card wrap">' + (rows.length ? '<table><thead><tr><th>When</th><th>To</th><th>Channel</th><th>Message</th><th>Status</th><th>Text</th></tr></thead><tbody>' + rows.map(c => '<tr><td>' + fmtDT(c.at) + '</td><td>' + esc(c.lead_id && D.leadById[c.lead_id] ? D.leadById[c.lead_id].name : c.recipient || '') + (c.listing_id && D.lstById[c.listing_id] ? '<div class="small muted">' + esc(D.lstById[c.listing_id].address) + '</div>' : '') + '</td><td>' + lab(c.channel) + '</td><td>' + esc(T[c.template_code] ? T[c.template_code].label : lab(c.template_code || '')) + '</td><td>' + lab(c.status) + '</td><td class="small">' + esc(String(c.body || '').slice(0, 140)) + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty">Nothing sent yet.</div>') + '</div>'; }
    if (M.mode === 'tpl') body = vTemplates();
    return head + '<div class="row">' + modes + '</div>' + body;
  }
  function vTemplates() {
    const { D, esc } = X(), m = me(), ai = M.ai;
    const sig = '<div class="card"><h3>Your details on every message</h3><div class="grid g4"><label class="f">First name<input class="inp" id="tmN" value="' + esc(m.name) + '"></label><label class="f">Full name<input class="inp" id="tmF" value="' + esc(m.full) + '"></label><label class="f">Company<input class="inp" id="tmC" value="' + esc(m.company) + '"></label><label class="f">Phone (email signature)<input class="inp" id="tmP" value="' + esc(m.phone) + '"></label></div><div class="row" style="margin-top:10px"><button class="btn" id="tmSave">Save details</button><span class="small muted">Stored in this browser.</span></div></div>';
    const aiCard = '<div class="card" style="margin-top:12px"><h3>AI writing</h3><p class="small">"Write with AI", "More personal" and "Shorter" rewrite a message from your real data, in a warm South African voice, without emojis and without sounding automated. You always read it before it goes. <span id="aiState">' + (ai === true ? '<span class="up">Switched on.</span>' : ai === false ? '<span class="down">Not switched on yet.</span>' : '') + '</span></p><p class="small muted">To switch it on: Supabase dashboard, project mret-agent-intelligence, Edge Functions, Secrets, add <code>ANTHROPIC_API_KEY</code> with your key from console.anthropic.com. Until then every message uses the templates below, which already read as written by you.</p><button class="btn" id="aiTest">Check AI status</button></div>';
    const rows = Object.entries(T).filter(([k]) => k !== 'custom').map(([k, t]) => { const own = ['whatsapp', 'email'].map(ch => D.tpls.find(x => x.code === k && x.channel === ch)); return '<li><span><b>' + esc(t.label) + '</b><div class="small muted">' + (own[0] || own[1] ? 'Your own wording for ' + [own[0] && 'WhatsApp', own[1] && 'email'].filter(Boolean).join(' and ') : 'Built in: ' + t.v.length + ' versions, rotated so messages do not repeat') + '</div></span><span class="act"><button class="btn sm" data-tpl="' + k + ':whatsapp">WhatsApp wording</button><button class="btn sm" data-tpl="' + k + ':email">Email wording</button></span></li>'; }).join('');
    return sig + aiCard + '<h2>Messages</h2><div class="card"><ul class="list due">' + rows + '</ul><p class="small muted">Placeholders you can use: {first_name}, {address}, {my_name}, {company}, {when}, {expiry}, {bond_due}, {feedback_lines}, {doc_list}, {area}.</p></div>';
  }
  function editTemplate(code, channel) {
    const { D, esc, $, sb } = X(), dlg = $('soDlg'), t = T[code], own = D.tpls.find(x => x.code === code && x.channel === channel);
    const ph = channel === 'whatsapp' ? 'Hi {first_name}, ' + t.v[0] + '\n\n{my_name}' : 'Hi {first_name},\n\n' + t.v[0] + '\n\nKind regards\n{my_full}\n{company}';
    dlg.innerHTML = '<div class="soform"><div class="dh"><h3>' + esc(t.label) + ' (' + (channel === 'whatsapp' ? 'WhatsApp' : 'email') + ')</h3><button class="btn sm" id="teX">Close</button></div>'
      + (channel === 'email' ? '<label class="f wide">Subject<input class="inp" id="teS" value="' + esc(own ? own.subject || '' : t.subject) + '"></label>' : '')
      + '<label class="f wide">Wording<textarea class="inp" id="teB" rows="10">' + esc(own ? own.body : ph) + '</textarea></label><p class="small muted">' + (own ? 'This is your own wording.' : 'This is the built-in wording. Save to make it yours; the built-in versions rotate, your own wording is used every time.') + '</p><p class="err" id="teErr"></p>'
      + '<div class="row"><button class="btn red" id="teSave">Save my wording</button>' + (own ? '<button class="btn" id="teReset" style="margin-left:auto">Back to built-in</button>' : '') + '</div></div>';
    if (!dlg.open) dlg.showModal();
    $('teX').onclick = () => dlg.close();
    $('teSave').onclick = async () => { try { const row = { code, channel, body: $('teB').value.trim(), subject: $('teS') ? $('teS').value.trim() || null : null }; if (!row.body) throw new Error('Write the wording first.'); const r = own ? await sb.from('re_templates').update(row).eq('id', own.id) : await sb.from('re_templates').insert(row); if (r.error) throw new Error(r.error.message); dlg.close(); X().toast('Wording saved'); await X().refresh(); } catch (e) { $('teErr').textContent = e.message; } };
    if ($('teReset')) $('teReset').onclick = async () => { const r = await sb.from('re_templates').delete().eq('id', own.id); if (r.error) { $('teErr').textContent = r.error.message; return; } dlg.close(); X().toast('Back to built-in wording'); await X().refresh(); };
  }

  /* ---------- Deal tracker view ---------- */
  const ST = ['open', 'requested', 'received', 'done', 'not_needed'], DONE = ['received', 'done', 'not_needed'];
  function entities() {
    const { D } = X(), m = {};
    D.tasks.forEach(x => { const e = entOf(x); if (!e) return; (m[e.key] = m[e.key] || Object.assign(e, { items: [] })).items.push(x); });
    return Object.values(m).map(e => { e.items.sort((a, b) => a.sort - b.sort); const n = e.items.filter(x => x.status !== 'not_needed'); e.pct = n.length ? Math.round(n.filter(x => DONE.includes(x.status)).length / n.length * 100) : 100; e.overdue = e.items.filter(x => !DONE.includes(x.status) && x.due_date && x.due_date < X().today()); return e; });
  }
  function vFlow() {
    const { esc, fmtD, lab, kpi, today, D } = X(), t = today(), all = entities(), live = all.filter(e => e.live);
    const deals = live.filter(e => e.kind === 'deal'), behind = live.flatMap(e => e.overdue.map(x => ({ x, e }))).sort((a, b) => a.x.due_date < b.x.due_date ? -1 : 1);
    const docs = live.flatMap(e => e.items.filter(x => x.is_document && !DONE.includes(x.status)));
    const head = '<div class="grid g4">' + kpi('Deals in progress', deals.length, deals.length ? 'average ' + Math.round(deals.reduce((s, e) => s + e.pct, 0) / deals.length) + '% complete' : 'Accepted OTPs appear here') + kpi('Listings being set up', live.filter(e => e.kind === 'listing' && e.pct < 100).length, live.filter(e => e.kind === 'listing').length + ' live listing' + (live.filter(e => e.kind === 'listing').length === 1 ? '' : 's') + ' tracked') + kpi('Left behind', behind.length, 'Items past their date') + kpi('Documents outstanding', docs.length, docs.filter(x => x.status === 'requested').length + ' requested, waiting') + '</div>';
    const pctBar = p => '<div class="funnel"><div class="bar"><div style="width:' + p + '%"></div></div></div>';
    const left = '<h2>What is left behind</h2><div class="card">' + (behind.length ? '<ul class="list due">' + behind.slice(0, 40).map(({ x, e }) => '<li><span><b>' + esc(x.title) + '</b><div class="small"><span class="down">Due ' + fmtD(x.due_date) + '</span> · ' + esc(e.address) + ' · ' + (e.kind === 'deal' ? 'Deal' : 'Listing') + ' · ' + lab(x.responsible) + (x.status === 'requested' ? ' · requested, waiting' : '') + '</div></span><span class="act">' + reqBtn(x, e) + '<button class="btn sm" data-tdone="' + x.id + '">' + (x.is_document ? 'Received' : 'Done') + '</button></span></li>').join('') + '</ul>' : '<div class="empty">Nothing overdue. Every live listing and deal is on schedule.</div>') + '</div>';
    const filt = '<div class="seg" style="margin:16px 0 8px">' + [['open', 'Live'], ['all', 'All, including closed']].map(m => '<button data-ff="' + m[0] + '" aria-pressed="' + (M.flowFilter === m[0]) + '">' + m[1] + '</button>').join('') + '</div>';
    const list = (M.flowFilter === 'open' ? live : all).sort((a, b) => (a.key === M.focus ? -1 : b.key === M.focus ? 1 : 0) || (a.kind === b.kind ? a.pct - b.pct : a.kind === 'deal' ? -1 : 1));
    const card = e => {
      const stages = [...new Set(e.items.map(x => x.stage))];
      return '<details class="card flow" id="fl-' + e.key.replace(':', '-') + '"' + (e.key === M.focus || (list.length <= 3) ? ' open' : '') + '><summary><span><b>' + esc(e.address) + '</b> <span class="chip' + (e.kind === 'deal' ? ' ok' : '') + '">' + (e.kind === 'deal' ? 'Deal' : 'Listing') + '</span>' + (e.overdue.length ? ' <span class="chip bad">' + e.overdue.length + ' overdue</span>' : '') + '<div class="small muted">' + (e.kind === 'deal' ? (e.buyer && D.leadById[e.buyer] ? 'Buyer ' + esc(D.leadById[e.buyer].name) + ' · ' : '') + 'Accepted ' + fmtD(e.rec.accepted_date) + (e.rec.bond_due_date && !e.rec.bond_approved_date ? ' · bond due ' + fmtD(e.rec.bond_due_date) : '') : 'Mandate ' + fmtD(e.rec.mandate_start) + (e.seller && D.leadById[e.seller] ? ' · seller ' + esc(D.leadById[e.seller].name) : '')) + '</div></span><span class="pc"><b>' + e.pct + '%</b>' + pctBar(e.pct) + '</span></summary>'
        + stages.map(sg => '<h3>' + esc(sg) + '</h3><table class="tk"><tbody>' + e.items.filter(x => x.stage === sg).map(x => '<tr class="' + (DONE.includes(x.status) ? 'dn' : x.due_date && x.due_date < t ? 'od' : '') + '"><td>' + esc(x.title) + (x.is_document ? ' <span class="chip">Document</span>' : '') + '</td><td class="small">' + lab(x.responsible) + '</td><td><input class="inp sm" type="date" data-tdue="' + x.id + '" value="' + (x.due_date || '') + '"></td><td><select class="inp sm" data-tst="' + x.id + '">' + ST.map(s => '<option value="' + s + '"' + (s === x.status ? ' selected' : '') + '>' + lab(s) + '</option>').join('') + '</select></td><td class="act">' + (DONE.includes(x.status) ? '' : reqBtn(x, e)) + '</td></tr>').join('') + '</tbody></table>').join('')
        + '<div class="row" style="margin-top:10px">' + (e.seller ? '<button class="btn sm" data-fmsg="' + e.key + ':seller">Message seller</button>' : '') + (e.buyer ? '<button class="btn sm" data-fmsg="' + e.key + ':buyer">Message buyer</button>' : '') + '<button class="btn sm" data-fcopy="' + e.key + '">Copy status update</button></div>' + historyHtml(e.kind === 'deal' ? { offer_id: e.offer_id } : { listing_id: e.listing_id }) + '</details>';
    };
    return head + left + filt + (list.length ? list.map(card).join('') : '<div class="card"><div class="empty">No checklists yet. They are created automatically for every active listing and every accepted OTP.</div></div>');
  }
  function reqBtn(x, e) { if (!x.is_document || !['seller', 'buyer'].includes(x.responsible)) return ''; const lid = x.responsible === 'seller' ? e.seller : e.buyer; return lid ? '<button class="btn sm" data-treq="' + e.key + ':' + x.responsible + '">Request</button>' : ''; }

  /* ---------- binding ---------- */
  function bind(host) {
    const { $, sb, D } = X();
    let due = null;
    host.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => { M.mode = b.dataset.cm; LS.set('cos.comms.mode', M.mode); X().draw(); });
    if ($('cmNew')) $('cmNew').onclick = () => openCompose({ title: 'New message' });
    host.querySelectorAll('[data-due]').forEach(b => b.onclick = () => { due = due || dueItems(); const it = Object.assign({ rule_key: due[+b.dataset.due].key }, due[+b.dataset.due]); openCompose(it); });
    host.querySelectorAll('[data-dskip]').forEach(b => b.onclick = async () => { due = due || dueItems(); const it = due[+b.dataset.dskip]; b.disabled = true; try { await logComm(Object.assign({ rule_key: it.key }, it), { channel: 'note', status: 'skipped' }); await X().refresh(); } catch (e) { X().toast(e.message); } });
    host.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => { const [c, ch] = b.dataset.tpl.split(':'); editTemplate(c, ch); });
    if ($('tmSave')) $('tmSave').onclick = () => { LS.set('cos.comms.me', { name: $('tmN').value.trim() || 'Uhuru', full: $('tmF').value.trim(), company: $('tmC').value.trim(), phone: $('tmP').value.trim() }); X().toast('Details saved'); };
    if ($('aiTest')) $('aiTest').onclick = async () => { const s = $('aiState'); s.textContent = 'Checking...'; try { await sb.functions.invoke('ai-write', { body: { ping: true } }).then(r => { if (r.error) throw r.error; if (r.data && r.data.error) throw new Error(r.data.error === 'not_configured' ? 'not_configured' : r.data.message || r.data.error); }); M.ai = true; s.innerHTML = '<span class="up">Switched on.</span>'; } catch (e) { let m = e.message || ''; try { const j = await e.context.json(); m = j.error || m; } catch (x) {} M.ai = /not_configured/.test(m) ? false : null; s.innerHTML = M.ai === false ? '<span class="down">Not switched on yet.</span>' : '<span class="down">Could not reach it: ' + X().esc(m) + '</span>'; } };
    // tracker
    host.querySelectorAll('[data-ff]').forEach(b => b.onclick = () => { M.flowFilter = b.dataset.ff; LS.set('cos.flow.filter', M.flowFilter); X().draw(); });
    const setTask = async (id, row) => { const r = await sb.from('re_tasks').update(row).eq('id', id); if (r.error) { X().toast(r.error.message); return; } const tk = D.tasks.find(x => x.id === id); if (tk) Object.assign(tk, row); };
    host.querySelectorAll('[data-tst]').forEach(s => s.onchange = async () => { await setTask(s.dataset.tst, { status: s.value }); X().toast('Updated'); await X().refresh(); });
    host.querySelectorAll('[data-tdue]').forEach(s => s.onchange = async () => { await setTask(s.dataset.tdue, { due_date: s.value || null }); X().toast('Date saved'); });
    host.querySelectorAll('[data-tdone]').forEach(b => b.onclick = async () => { b.disabled = true; const tk = D.tasks.find(x => x.id === b.dataset.tdone); await setTask(tk.id, { status: tk.is_document ? 'received' : 'done' }); await X().refresh(); });
    const docMsg = (key, party) => { const g = groupDocs().find(x => x.ents.includes(key) && x.party === party); const e = entities().find(x => x.key === key); if (!e) return; const lid = party === 'seller' ? e.seller : e.buyer; openCompose({ title: 'Request documents', code: 'doc_request', lead_id: lid, listing_id: e.listing_id, offer_id: e.offer_id, doc_list: g ? g.items.map(x => '- ' + x.title).join('\n') : '', task_ids: g ? g.items.concat(g.dupes || []).map(x => x.id) : [] }); };
    host.querySelectorAll('[data-treq]').forEach(b => b.onclick = () => { const p = b.dataset.treq.split(':'); docMsg(p[0] + ':' + p[1], p[2]); });
    host.querySelectorAll('[data-fmsg]').forEach(b => b.onclick = () => { const p = b.dataset.fmsg.split(':'), e = entities().find(x => x.key === p[0] + ':' + p[1]); if (!e) return; openCompose({ lead_id: p[2] === 'seller' ? e.seller : e.buyer, listing_id: e.listing_id, offer_id: e.offer_id, code: 'custom' }); });
    host.querySelectorAll('[data-fcopy]').forEach(b => b.onclick = async () => { const e = entities().find(x => x.key === b.dataset.fcopy); if (!e) return; const { lab, fmtD } = X(); const txt = ['Status: ' + e.address, e.pct + '% complete', ''].concat([...new Set(e.items.map(x => x.stage))].map(sg => sg + ':\n' + e.items.filter(x => x.stage === sg && x.status !== 'not_needed').map(x => (DONE.includes(x.status) ? '[x] ' : '[ ] ') + x.title + (DONE.includes(x.status) ? '' : x.due_date ? ' (due ' + fmtD(x.due_date) + ', ' + lab(x.responsible).toLowerCase() + ')' : '')).join('\n'))).join('\n'); try { await navigator.clipboard.writeText(txt); X().toast('Status update copied'); } catch (x) { X().toast('Copy failed'); } });
    if (M.focus) { const el = document.getElementById('fl-' + M.focus.replace(':', '-')); if (el) { el.open = true; el.scrollIntoView({ block: 'start' }); } M.focus = ''; }
  }

  // styles for the new pieces (inherit the page tokens)
  const st = document.createElement('style');
  st.textContent = '.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}.seg button{background:var(--card);border:0;padding:8px 12px;font:600 13px Inter,sans-serif;color:var(--ink2);cursor:pointer}.seg button+button{border-left:1px solid var(--line)}.seg button[aria-pressed=true]{background:var(--char);color:#fff}'
    + 'ul.due li{display:flex;justify-content:space-between;gap:12px;align-items:center}ul.due .act{white-space:nowrap}ul.due .act .btn{margin-left:4px}.cmai{margin-top:6px;gap:8px;flex-wrap:wrap}'
    + 'details.flow{margin-top:10px}details.flow summary{display:flex;justify-content:space-between;gap:16px;cursor:pointer;list-style:none}details.flow summary::-webkit-details-marker{display:none}details.flow .pc{min-width:120px;text-align:right}details.flow h3{margin:14px 0 6px;font-size:14px;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em}'
    + 'table.tk{width:100%}table.tk td{padding:6px 6px;border-bottom:1px solid var(--line);vertical-align:middle}table.tk tr.dn td:first-child{color:var(--ink3);text-decoration:line-through}table.tk tr.od td:first-child{color:var(--red);font-weight:600}.inp.sm{padding:5px 6px;font-size:13px;width:auto}'
    + '.f .seg{display:flex;width:max-content;margin-top:6px}'
    + '@media(min-width:701px){table.tk{table-layout:fixed}table.tk td:nth-child(2){width:110px}table.tk td:nth-child(3){width:160px}table.tk td:nth-child(4){width:140px}table.tk td:nth-child(5){width:90px}}'
    + '@media(max-width:700px){ul.due li{flex-direction:column;align-items:flex-start}table.tk,table.tk tbody{display:block}table.tk tr{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:8px 0;border-bottom:1px solid var(--line)}table.tk td{border:0;padding:0}table.tk td:first-child{flex-basis:100%}table.tk td.act{margin-left:auto}details.flow summary{flex-direction:column;gap:6px}details.flow .pc{text-align:left}}';
  document.head.appendChild(st);

  window.SalesComms = {
    view: s => s === 'comms' ? vComms() : vFlow(), bind, sync, historyHtml,
    compose: c => openCompose(Object.assign({}, c)),
    focus: k => { M.focus = k; },
    stats() { try { const d = dueItems(), live = entities().filter(e => e.live); return { due: d.length, urgent: d.filter(x => x.pri >= 85).length, sellerDue: d.filter(x => x.code === 'seller_feedback').length, overdue: live.reduce((s, e) => s + e.overdue.length, 0), docs: live.reduce((s, e) => s + e.items.filter(x => x.is_document && !DONE.includes(x.status)).length, 0), behind: live.filter(e => e.overdue.length).map(e => e.address) }; } catch (e) { return null; } },
    _compose: compose, _due: dueItems, _T: T
  };
})();
