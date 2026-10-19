/* Smart Agent Series - Training Studio (private). Talks to the studio's Apps Script web app. */
(function () {
  'use strict';
  // The studio's Apps Script web app address (set when the backend is deployed).
  var API_URL = 'https://script.google.com/macros/s/AKfycbx9dEC3FRyHrjxsVoKG-SW230E_h2LaYEc8aPiu3ubkiLKv1F2HGuBO6H9Z2OHIgkb-/exec';
  var API = (function () { try { return localStorage.getItem('studio.api') || API_URL; } catch (e) { return API_URL; } })();
  var MAX_SOURCE = 45000;
  var PARTS = [['plan', 'Session plan and timings'], ['slides', 'Slides and talk track'], ['demo', 'Live demonstration script'], ['practice', 'Activities, quiz and handout']];

  var $ = function (id) { return document.getElementById(id); };
  var ss = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { sessionStorage.removeItem(k); } catch (e) {} } };
  var ls = { get: function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }, del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };

  var token = ss.get('studio.token'), keySet = true, T = null, dirty = false, tab = 'plan', genFrom = 0;

  // ---------- small helpers ----------
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'class') el.className = attrs[k];
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function get(path) { var o = T; for (var i = 0; i < path.length; i++) { if (o == null) return undefined; o = o[path[i]]; } return o; }
  function set(path, v) { var o = T; for (var i = 0; i < path.length - 1; i++) { if (o[path[i]] == null) o[path[i]] = typeof path[i + 1] === 'number' ? [] : {}; o = o[path[i]]; } o[path[path.length - 1]] = v; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function show(v) { ['vLogin', 'vLib', 'vFeed', 'vGen', 'vWork'].forEach(function (id) { $(id).hidden = id !== v; }); $('signOut').hidden = v === 'vLogin'; window.scrollTo(0, 0); }
  function stamp(iso) { try { var d = new Date(iso); return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function markDirty() { dirty = true; $('savedState').textContent = 'Unsaved changes'; ls.set('studio.draft', T); }
  function markSaved(when) { dirty = false; var d = when ? new Date(when) : null; $('savedState').textContent = 'Saved' + (d ? ' ' + (d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : stamp(when)) : ''); ls.del('studio.draft'); }

  // ---------- talking to the backend ----------
  function post(action, data, waitSecs) {
    if (!API) return Promise.reject(new Error('The studio backend is not connected yet.'));
    var body = Object.assign({}, data || {}, { action: action, token: token });
    var ctl = window.AbortController ? new AbortController() : null, timer = ctl && setTimeout(function () { ctl.abort(); }, (waitSecs || 60) * 1000);
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .catch(function (e) { throw new Error(e && e.name === 'AbortError' ? 'Claude took too long to answer.' : 'The studio could not be reached. Check your connection.'); })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('The studio could not be reached (' + r.status + ').'); return r.json(); })
      .then(function (j) {
        if (j && j.error === 'signin') { token = null; ss.del('studio.token'); showLogin(); throw new Error('Please sign in again.'); }
        if (!j || !j.ok) throw new Error((j && (j.message || j.error)) || 'Something went wrong.');
        return j;
      });
  }

  // ---------- sign in ----------
  function showLogin() {
    show('vLogin'); $('pin').value = '';
    var note = $('setupNote');
    if (!API) { note.hidden = false; note.textContent = 'The studio backend is not connected yet. It will work once the studio web app is deployed.'; return; }
    $('setupForm').hidden = true; $('loginForm').hidden = false;
    post('status').then(function (s) {
      keySet = s.keySet;
      if (!s.pinSet) { $('loginForm').hidden = true; $('setupForm').hidden = false; $('newPin').focus(); }
    }).catch(function () {});
  }
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); $('loginErr').textContent = ''; $('loginBtn').disabled = true;
    post('login', { pin: $('pin').value }).then(function (j) {
      token = j.token; keySet = j.keySet; ss.set('studio.token', token); $('pin').value = ''; openLibrary();
    }).catch(function (err) { $('loginErr').textContent = err.message; }).then(function () { $('loginBtn').disabled = false; });
  });
  $('setupForm').addEventListener('submit', function (e) {
    e.preventDefault(); var a = $('newPin').value.trim(), b = $('newPin2').value.trim(), err = $('setupErr'); err.textContent = '';
    if (!/^\d{4,12}$/.test(a)) { err.textContent = 'Use 4 to 12 digits.'; return; }
    if (a !== b) { err.textContent = 'The two PINs do not match.'; return; }
    $('setupBtn').disabled = true;
    post('setup', { pin: a }).then(function (j) {
      token = j.token; keySet = j.keySet; ss.set('studio.token', token); $('newPin').value = ''; $('newPin2').value = ''; openLibrary();
    }).catch(function (er) { err.textContent = er.message; if (/already set/.test(er.message)) { $('setupForm').hidden = true; $('loginForm').hidden = false; } })
      .then(function () { $('setupBtn').disabled = false; });
  });
  $('keyWarn').addEventListener('submit', function (e) {
    e.preventDefault(); var k = $('apiKey').value.trim(), err = $('keyErr'); err.textContent = '';
    if (!/^sk-ant-/.test(k)) { err.textContent = 'An Anthropic key starts with sk-ant-.'; return; }
    $('keyBtn').disabled = true; $('keyBtn').textContent = 'Testing the key...';
    post('setkey', { key: k }).then(function () { keySet = true; $('apiKey').value = ''; $('keyWarn').hidden = true; })
      .catch(function (er) { err.textContent = er.message; }).then(function () { $('keyBtn').disabled = false; $('keyBtn').textContent = 'Test and save the key'; });
  });
  $('signOut').onclick = function () {
    if (dirty && !confirm('You have unsaved changes on this training. Sign out anyway? They stay on this device as a draft.')) return;
    post('logout').catch(function () {}); token = null; ss.del('studio.token'); showLogin();
  };

  // ---------- library ----------
  function openLibrary() {
    show('vLib'); $('keyWarn').hidden = keySet !== false;
    oneCall('oneStatus');
    post('status').then(function (s) { keySet = s.keySet; $('keyWarn').hidden = keySet !== false; }).catch(function () {});
    var list = $('libList'); list.innerHTML = ''; list.appendChild(h('p', { class: 'empty', text: 'Loading your trainings...' }));
    var draft = ls.get('studio.draft');
    post('list').then(function (j) {
      list.innerHTML = '';
      if (draft && (draft.plan || (draft.sources && draft.sources.length))) {
        list.appendChild(h('button', { type: 'button', class: 'libitem', onclick: function () { T = draft; dirty = true; T.plan ? openWork() : openFeed(); } }, [
          h('i', { text: '*' }), h('div', {}, [h('b', { text: 'Unsaved draft: ' + ((draft.plan && draft.plan.title) || (draft.brief && draft.brief.topic) || 'Untitled') }), h('span', { text: 'Kept on this device. Open it and press Save.' })])]));
      }
      if (!j.items.length && !draft) list.appendChild(h('p', { class: 'empty', text: 'No trainings yet. Press New training, feed it your content, and it builds the session for you.' }));
      j.items.forEach(function (it) {
        list.appendChild(h('button', { type: 'button', class: 'libitem', onclick: function () { load(it.id); } }, [
          h('i', { text: (it.title || '?').charAt(0).toUpperCase() }), h('div', {}, [h('b', { text: it.title }), h('span', { text: 'Updated ' + stamp(it.updated) })])]));
      });
    }).catch(function (err) { list.innerHTML = ''; list.appendChild(h('p', { class: 'empty', text: err.message })); });
  }
  // ---------- smart 1-on-1 bookings ----------
  function oneDraw(st) {
    $('oneErr').textContent = '';
    var pill = $('onePill'); pill.className = 'pill ' + (st.on ? st.mode : ''); pill.textContent = !st.on ? 'Off' : st.mode === 'live' ? 'Live' : 'Test mode';
    $('oneState').textContent = !st.on ? 'Off. Turn it on to start watching your bookings.' : st.mode === 'live' ? 'Live: agents receive the emails.' : 'On in test mode: every email comes only to you.';
    $('oneOn').hidden = st.on; $('oneOff').hidden = !st.on; $('oneLive').hidden = !st.on || st.mode === 'live'; $('oneTest').hidden = false;
    $('oneLive').textContent = 'Go live'; if (st.on && st.mode === 'live') { $('oneLive').hidden = false; $('oneLive').textContent = 'Back to test mode'; }
    var list = $('oneList'); list.innerHTML = '';
    (st.sessions || []).slice(0, 12).forEach(function (x) {
      var marks = [['Booked', x.booked], ['Day before', x.dayBefore], ['2 hours', x.soon], ['After', x.after], ['Week', x.week]];
      list.appendChild(h('div', { class: 'sess' }, [
        h('div', {}, [h('b', { text: x.name + (x.status === 'Cancelled' ? ' (cancelled)' : '') }), h('span', { class: 't', text: x.start + (x.topics && x.topics.length ? ' · ' + x.topics.join(', ') : ' · no prep form yet') }), x.goal ? h('span', { class: 't', style: 'display:block', text: 'Goal: ' + x.goal }) : null]),
        h('div', { class: 'm' }, marks.map(function (m) { var done = m[1] && m[1] !== 'skipped' && m[1] !== 'failed'; return h('i', { class: done ? 'y' : '', title: m[1] || 'not yet', text: m[0] }); }))]));
    });
    if (st.on && !(st.sessions || []).length) list.appendChild(h('p', { class: 'note', text: 'No bookings seen yet. New bookings show here within 15 minutes.' }));
  }
  function oneCall(action, extra, btn) {
    if (btn) btn.disabled = true; $('oneErr').textContent = '';
    return post(action, extra || {}, 90).then(function (j) { if (j.sessions) oneDraw(j); return j; })
      .catch(function (e) { $('oneErr').textContent = /permission|authori/i.test(e.message) ? 'The studio needs your permission for Calendar and email first. Open the Smart Agent Studio project in Apps Script and approve it.' : e.message; })
      .then(function (j) { if (btn) btn.disabled = false; return j; });
  }
  $('oneOn').onclick = function () { oneCall('oneSetup', { on: true }, this); };
  $('oneOff').onclick = function () { oneCall('oneSetup', { on: false }, this); };
  $('oneLive').onclick = function () {
    var live = this.textContent === 'Go live';
    if (live && !confirm('Go live? From now on agents who book "I Help You To Win" receive these emails directly from you.')) return;
    oneCall('oneMode', { mode: live ? 'live' : 'test' }, this);
  };
  $('oneTest').onclick = function () { var b = this; oneCall('oneTest', {}, b).then(function (j) { if (j && j.sent) $('oneErr').textContent = 'Sent 5 sample emails to ' + j.to + '. Check your inbox.'; }); };

  function load(id) {
    $('libList').prepend(h('p', { class: 'note', text: 'Opening...' }));
    post('load', { id: id }).then(function (j) { T = j.training; T.id = id; markSaved(T.updated); openWork(); }).catch(function (err) { alert(err.message); });
  }
  $('newBtn').onclick = function () {
    if (dirty && T && !confirm('Start a new training? Your unsaved draft stays on this device until you start generating.')) return;
    T = { brief: {}, sources: [], created: new Date().toISOString() }; dirty = false; $('savedState').textContent = ''; openFeed();
  };
  document.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { var g = b.dataset.go; if (g === 'lib') openLibrary(); if (g === 'feed') openFeed(); }; });

  // ---------- feeding content ----------
  var BRIEF = { topic: 'bTopic', platform: 'bPlatform', level: 'bLevel', minutes: 'bMinutes', format: 'bFormat', notes: 'bNotes' };
  function openFeed() {
    show('vFeed'); $('feedErr').textContent = '';
    var b = T.brief || {};
    Object.keys(BRIEF).forEach(function (k) { if (b[k] != null && b[k] !== '') $(BRIEF[k]).value = b[k]; else if (k === 'topic' || k === 'notes') $(BRIEF[k]).value = ''; });
    renderSources();
    $('genBtn').textContent = T.plan ? 'Regenerate the training' : 'Generate the training';
  }
  function readBrief() { T.brief = {}; Object.keys(BRIEF).forEach(function (k) { T.brief[k] = $(BRIEF[k]).value.trim(); }); T.brief.minutes = Number(T.brief.minutes) || 60; }
  Object.keys(BRIEF).forEach(function (k) { $(BRIEF[k]).addEventListener('change', function () { if (T) { readBrief(); ls.set('studio.draft', T); } }); });
  document.querySelectorAll('.ft').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('.ft').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      document.querySelectorAll('.ftp').forEach(function (p) { p.hidden = p.dataset.ftp !== b.dataset.ft; });
    };
  });
  function sourceText() {
    return arr(T.sources).map(function (s) { return '=== ' + s.kind.toUpperCase() + ': ' + s.title + ' ===' + (s.url ? '\nLink: ' + s.url : '') + '\n' + s.text; }).join('\n\n');
  }
  function renderSources() {
    var ul = $('sources'); ul.innerHTML = '';
    var total = sourceText().length;
    $('srcCount').textContent = T.sources.length ? '(' + T.sources.length + ', ' + total.toLocaleString('en-ZA') + ' characters' + (total > MAX_SOURCE ? '; only the first ' + MAX_SOURCE.toLocaleString('en-ZA') + ' are used' : '') + ')' : '';
    if (!T.sources.length) ul.appendChild(h('li', { class: 'none', text: 'Nothing added yet. You can still generate from the brief alone, but it will be general.' }));
    T.sources.forEach(function (s, i) {
      ul.appendChild(h('li', {}, [h('span', { class: 'kind', text: s.kind }), h('div', {}, [h('b', { text: s.title }), h('span', { text: s.text.length.toLocaleString('en-ZA') + ' characters' + (s.url ? ' · ' + s.url : '') })]),
        h('button', { type: 'button', class: 'x', 'aria-label': 'Remove ' + s.title, text: '×', onclick: function () { T.sources.splice(i, 1); renderSources(); ls.set('studio.draft', T); } })]));
    });
  }
  function addSource(s) { s.text = String(s.text || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); T.sources.push(s); renderSources(); ls.set('studio.draft', T); }
  $('addNotes').onclick = function () {
    var t = $('nText').value.trim(); if (t.length < 10) { $('feedErr').textContent = 'Paste a little more text first.'; return; }
    $('feedErr').textContent = ''; addSource({ kind: 'notes', title: $('nTitle').value.trim() || 'Notes ' + (T.sources.length + 1), text: t }); $('nText').value = ''; $('nTitle').value = '';
  };
  $('addVideo').onclick = function () {
    var url = $('vUrl').value.trim(), txt = $('vText').value.trim();
    if (!/^https?:\/\/\S+$/.test(url)) { $('feedErr').textContent = 'Paste the full video link, starting with https://'; return; }
    if (txt.length < 20) { $('feedErr').textContent = 'Describe what happens in the video, or paste its transcript. Claude can\'t watch the video itself.'; return; }
    $('feedErr').textContent = '';
    var s = { kind: 'video', title: 'Video', url: url, text: txt }; addSource(s); $('vUrl').value = ''; $('vText').value = '';
    post('video', { url: url }).then(function (j) { if (j.title) { s.title = j.title; renderSources(); ls.set('studio.draft', T); } }).catch(function () {});
  };

  var libs = {};
  function lib(src) { return libs[src] || (libs[src] = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { delete libs[src]; rej(new Error('Could not load the file reader. Check your connection.')); }; document.head.appendChild(s); })); }
  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  function readPdf(buf) {
    return lib(CDN + 'pdf.js/3.11.174/pdf.min.js').then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + 'pdf.js/3.11.174/pdf.worker.min.js';
      return window.pdfjsLib.getDocument({ data: buf }).promise;
    }).then(function (pdf) {
      var pages = []; var chain = Promise.resolve();
      for (var i = 1; i <= Math.min(pdf.numPages, 120); i++) (function (n) {
        chain = chain.then(function () { return pdf.getPage(n); }).then(function (p) { return p.getTextContent(); }).then(function (tc) {
          var line = '', out = [], lastY = null;
          tc.items.forEach(function (it) { var y = it.transform && it.transform[5]; if (lastY !== null && Math.abs(y - lastY) > 4) { out.push(line); line = ''; } line += it.str + (it.hasEOL ? '' : ' '); lastY = y; });
          out.push(line); pages.push('[Page ' + n + ']\n' + out.map(function (l) { return l.trim(); }).filter(Boolean).join('\n'));
        });
      })(i);
      return chain.then(function () { return pages.join('\n\n'); });
    });
  }
  function readDocx(buf) { return lib(CDN + 'mammoth/1.6.0/mammoth.browser.min.js').then(function () { return window.mammoth.extractRawText({ arrayBuffer: buf }); }).then(function (r) { return r.value; }); }
  function readPptx(buf) {
    return lib(CDN + 'jszip/3.10.1/jszip.min.js').then(function () { return window.JSZip.loadAsync(buf); }).then(function (zip) {
      var num = function (n) { return Number((/(\d+)\.xml$/.exec(n) || [])[1] || 0); };
      var slides = Object.keys(zip.files).filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/.test(n); }).sort(function (a, b) { return num(a) - num(b); });
      var text = function (xml) { var doc = new DOMParser().parseFromString(xml, 'application/xml'); return [].map.call(doc.getElementsByTagNameNS('*', 'p'), function (p) { return [].map.call(p.getElementsByTagNameNS('*', 't'), function (t) { return t.textContent; }).join(''); }).filter(function (s) { return s.trim(); }).join('\n'); };
      return Promise.all(slides.map(function (n) {
        var notes = 'ppt/notesSlides/notesSlide' + num(n) + '.xml';
        return Promise.all([zip.file(n).async('string'), zip.file(notes) ? zip.file(notes).async('string') : '']).then(function (r) {
          var nt = r[1] ? text(r[1]).split('\n').filter(function (l) { return !/^\d+$/.test(l.trim()); }).join('\n') : '';
          return '[Slide ' + num(n) + ']\n' + text(r[0]) + (nt ? '\nSpeaker notes: ' + nt : '');
        });
      })).then(function (parts) { return parts.join('\n\n'); });
    });
  }
  function readFile(f) {
    var ext = (/\.(\w+)$/.exec(f.name.toLowerCase()) || [])[1];
    if (['txt', 'md', 'csv'].indexOf(ext) >= 0) return f.text();
    return f.arrayBuffer().then(function (buf) {
      if (ext === 'pdf') return readPdf(buf);
      if (ext === 'docx') return readDocx(buf);
      if (ext === 'pptx') return readPptx(buf);
      throw new Error(f.name + ': this file type is not supported. Use PDF, .docx, .pptx or text.');
    });
  }
  function takeFiles(files) {
    $('feedErr').textContent = '';
    [].slice.call(files).forEach(function (f) {
      if (f.size > 40 * 1024 * 1024) { $('feedErr').textContent = f.name + ' is larger than 40 MB.'; return; }
      var kind = /\.pptx$/i.test(f.name) ? 'slides' : 'document';
      var li = h('li', {}, [h('span', { class: 'kind', text: kind }), h('div', {}, [h('b', { text: f.name }), h('span', { text: 'Reading...' })])]);
      $('sources').appendChild(li);
      readFile(f).then(function (txt) {
        li.remove();
        if (!txt || txt.replace(/\s|\[(Page|Slide) \d+\]/g, '').length < 20) { $('feedErr').textContent = f.name + ' has no readable text. If it is scanned or images only, paste the key steps as notes instead.'; return; }
        addSource({ kind: kind, title: f.name, text: txt });
      }).catch(function (err) { li.remove(); $('feedErr').textContent = err.message || ('Could not read ' + f.name + '.'); });
    });
  }
  $('fileIn').addEventListener('change', function () { takeFiles(this.files); this.value = ''; });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) takeFiles(e.dataTransfer.files); });

  // ---------- generating ----------
  $('genBtn').onclick = function () {
    readBrief();
    if (!T.brief.topic) { $('feedErr').textContent = 'Give the training a topic or title first.'; $('bTopic').focus(); return; }
    if (keySet === false) { $('feedErr').textContent = 'Claude is not connected yet. Go back to Your trainings and use Connect Claude first.'; return; }
    if (T.plan && !confirm('This rewrites the plan, slides, demonstration and practice from your content. Any edits you made will be replaced. Continue?')) return;
    genFrom = 0; runGen();
  };
  $('genRetry').onclick = runGen;
  // Builds each part in turn. Each part gets two tries; if the demonstration or the practice still fails,
  // the training opens anyway with what was made, and that tab offers to generate the missing part.
  function genPart(part, src, tries) {
    return post('generate', { part: part, brief: T.brief, source: src, plan: part === 'plan' ? null : T.plan }, 170)
      .catch(function (err) { if (tries > 1 && !/sign in/i.test(err.message)) return genPart(part, src, tries - 1); throw err; });
  }
  function runGen() {
    show('vGen'); $('genErr').textContent = ''; $('genNav').hidden = true; $('genTitle').textContent = 'Building: ' + T.brief.topic;
    var ol = $('prog'); ol.innerHTML = '';
    var lis = PARTS.map(function (p, i) { var li = h('li', { class: i < genFrom ? 'ok' : '' }, [h('i'), h('span', { text: p[1] })]); ol.appendChild(li); return li; });
    var src = sourceText(), failed = [];
    var step = function (i) {
      if (i >= PARTS.length) return done(failed);
      genFrom = i; lis[i].className = 'run';
      var part = PARTS[i][0];
      return genPart(part, src, 2).then(function (j) {
        T[part] = j.data; if (j.cut) failed.push(part + ':cut');
        lis[i].className = 'ok'; ls.set('studio.draft', T); return step(i + 1);
      }, function (err) {
        if (part === 'plan') throw err;           // nothing can be built without a plan
        lis[i].className = 'bad'; lis[i].lastChild.textContent = PARTS[i][1] + ': skipped for now, you can generate it later';
        failed.push(part); return step(i + 1);
      });
    };
    step(genFrom).catch(function (err) {
      var li = ol.querySelector('.run'); if (li) li.className = 'bad';
      $('genErr').textContent = err.message + ' Your progress is kept: press Try again to carry on from this step.'; $('genNav').hidden = false;
    });
  }
  function done(failed) {
    genFrom = 0; markDirty();
    var missing = (failed || []).filter(function (f) { return f.indexOf(':') < 0; });
    tab = missing[0] || 'plan'; openWork();
    if (missing.length) $('redoErr').textContent = '';
    return save(true);
  }
  function missingPart(b, part, label) {
    var box = h('div', { class: 'blk check' }, [h('h3', { text: label + ' did not generate yet' }),
      h('p', { class: 'sub', text: 'Claude took too long or its answer was cut off. The rest of your training is ready. Press the button to try just this part again.' })]);
    var err = h('p', { class: 'err' });
    var btn = h('button', { type: 'button', class: 'btn primary', style: 'margin-top:10px', text: 'Generate ' + label.toLowerCase() + ' now', onclick: function () {
      btn.disabled = true; btn.textContent = 'Generating... (up to two minutes)'; err.textContent = '';
      genPart(part, sourceText(), 2).then(function (j) { T[part] = j.data; markDirty(); renderTab(); save(true); })
        .catch(function (e) { err.textContent = e.message + ' Try again in a minute.'; btn.disabled = false; btn.textContent = 'Generate ' + label.toLowerCase() + ' now'; });
    } });
    box.appendChild(btn); box.appendChild(err); b.appendChild(box);
  }

  // ---------- workspace ----------
  function ed(tag, path, cls, ph) {
    var v = get(path);
    var el = h(tag, { class: cls || null, contenteditable: 'true', spellcheck: 'true', 'data-ph': ph || null, text: v == null ? '' : String(v) });
    el.addEventListener('input', function () { var t = el.innerText.replace(/\n+$/, ''); set(path, typeof v === 'number' ? (Number(t.replace(/[^\d.]/g, '')) || 0) : t); markDirty(); if (path[1] === 'title' && path[0] === 'plan') document.title = t + ' · Training Studio'; });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && tag !== 'p' && tag !== 'div') { e.preventDefault(); el.blur(); } });
    el.addEventListener('paste', function (e) { e.preventDefault(); var t = (e.clipboardData || window.clipboardData).getData('text'); document.execCommand('insertText', false, t); });
    return el;
  }
  function delBtn(path, label) { return h('button', { type: 'button', class: 'del', 'aria-label': 'Delete ' + label, title: 'Delete', text: '×', onclick: function () { if (!confirm('Delete this ' + label + '?')) return; var p = path.slice(0, -1), i = path[path.length - 1]; get(p).splice(i, 1); markDirty(); renderTab(); } }); }
  function list(path, ordered, cls) {
    var items = arr(get(path)); var el = h(ordered ? 'ol' : 'ul', { class: cls || null });
    items.forEach(function (_, i) { el.appendChild(ed('li', path.concat(i))); });
    return el;
  }
  function lab(t) { return h('span', { class: 'lab', text: t }); }
  function segName(id) { var s = arr(T.plan && T.plan.outline).filter(function (x) { return x.id === id; })[0]; return s ? s.title : ''; }

  function openWork() {
    show('vWork'); if (!dirty) $('savedState').textContent = T.updated ? 'Saved ' + stamp(T.updated) : '';
    var p = T.plan || {};
    var nh = ed('h1', ['plan', 'title']); nh.id = 'wTitle'; $('wTitle').replaceWith(nh);
    var sub = $('wSub'); var ns = ed('p', ['plan', 'subtitle'], 'lede'); ns.id = 'wSub'; sub.replaceWith(ns);
    $('wMeta').textContent = [T.brief && T.brief.platform, (p.minutes || (T.brief && T.brief.minutes) || '') + ' minutes', p.audience].filter(Boolean).join(' · ');
    document.title = (p.title || 'Training') + ' · Training Studio';
    $('delBtn').hidden = !T.id;
    renderTab();
  }
  document.querySelectorAll('#wTabs button').forEach(function (b) { b.onclick = function () { tab = b.dataset.tab; renderTab(); }; });
  function renderTab() {
    document.querySelectorAll('#wTabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    var body = $('wBody'); body.innerHTML = ''; $('redo').hidden = tab === 'sources'; $('redoErr').textContent = '';
    ({ plan: tPlan, slides: tSlides, demo: tDemo, practice: tPractice, sources: tSources })[tab](body);
  }
  function tPlan(b) {
    var p = T.plan; if (!p) { b.appendChild(h('p', { class: 'empty', text: 'No plan yet.' })); return; }
    if (arr(p.checkWithSource).filter(Boolean).length) b.appendChild(h('div', { class: 'blk check' }, [h('h3', { text: 'Check these before you present' }), h('p', { class: 'sub', text: 'Things Claude could not confirm from your content.' }), list(['plan', 'checkWithSource'])]));
    b.appendChild(h('div', { class: 'blk' }, [h('h3', { text: 'By the end, agents can' }), list(['plan', 'objectives'])]));
    var o = h('div', { class: 'outline' });
    var total = 0;
    arr(p.outline).forEach(function (s, i) {
      total += Number(s.minutes) || 0;
      o.appendChild(h('div', { class: 'oseg' }, [h('span', { class: 'tag ' + (s.type || '') , text: s.type || 'part' }), h('div', {}, [ed('b', ['plan', 'outline', i, 'title']), ed('p', ['plan', 'outline', i, 'summary'])]),
        h('span', { class: 'm' }, [ed('span', ['plan', 'outline', i, 'minutes']), ' min'])]));
    });
    b.appendChild(h('div', { class: 'blk' }, [h('h3', { text: 'Running order (' + total + ' minutes)' }), o]));
    b.appendChild(h('div', { class: 'blk' }, [h('h3', { text: 'Before the session' }), lab('Agents need'), list(['plan', 'prerequisites']), lab('Have ready'), list(['plan', 'materials'])]));
  }
  function tSlides(b) {
    var s = arr(T.slides && T.slides.slides);
    if (!s.length) { missingPart(b, 'slides', 'The slides'); return; }
    s.forEach(function (sl, i) {
      var P = ['slides', 'slides', i];
      b.appendChild(h('div', { class: 'blk' }, [delBtn(P, 'slide'), h('span', { class: 'lab', text: 'Slide ' + (i + 1) + (segName(sl.segment) ? ' · ' + segName(sl.segment) : '') }), ed('h3', P.concat('heading')), list(P.concat('bullets')),
        lab('Talk track'), ed('p', P.concat('notes')), sl.visual ? lab('Visual') : null, sl.visual ? ed('p', P.concat('visual'), 'sub') : null]));
    });
  }
  function tDemo(b) {
    var d = arr(T.demo && T.demo.demos);
    if (!d.length) { missingPart(b, 'demo', 'The demonstration'); return; }
    d.forEach(function (dm, i) {
      var P = ['demo', 'demos', i];
      var steps = h('ol', { class: 'steps' });
      arr(dm.steps).forEach(function (st, j) {
        var S = P.concat('steps', j);
        steps.appendChild(h('li', {}, [delBtn(S, 'step'), ed('b', S.concat('do')), h('span', { class: 'say' }, ['Say: ', ed('span', S.concat('say'))]), h('span', { class: 'look' }, ['They should notice: ', ed('span', S.concat('look'))]), st.tip ? h('span', { class: 'look' }, ['Tip: ', ed('span', S.concat('tip'))]) : null]));
      });
      var wrong = h('ul');
      arr(dm.ifItGoesWrong).forEach(function (w, j) { wrong.appendChild(h('li', {}, [ed('b', P.concat('ifItGoesWrong', j, 'problem')), ': ', ed('span', P.concat('ifItGoesWrong', j, 'fix'))])); });
      b.appendChild(h('div', { class: 'blk' }, [delBtn(P, 'demonstration'), h('span', { class: 'tag demo', text: 'Demo' + (segName(dm.segment) ? ' · ' + segName(dm.segment) : '') }), ed('h3', P.concat('title')), ed('p', P.concat('goal'), 'sub'),
        lab('Have open before you start'), list(P.concat('setup')), lab('Steps'), steps, arr(dm.ifItGoesWrong).length ? lab('If it goes wrong') : null, arr(dm.ifItGoesWrong).length ? wrong : null, lab('Checkpoint question'), ed('p', P.concat('checkpoint'))]));
    });
  }
  function tPractice(b) {
    var pr = T.practice; if (!pr) { missingPart(b, 'practice', 'The practice'); return; }
    arr(pr.activities).forEach(function (a, i) {
      var P = ['practice', 'activities', i];
      b.appendChild(h('div', { class: 'blk' }, [delBtn(P, 'activity'), h('span', { class: 'tag activity', text: 'Activity · ' + (a.minutes || '?') + ' min' }), ed('h3', P.concat('title')), list(P.concat('instructions'), true),
        lab('Done right when'), ed('p', P.concat('success')), lab('While they work, you'), ed('p', P.concat('helper'))]));
    });
    arr(pr.quiz).forEach(function (q, i) {
      var P = ['practice', 'quiz', i];
      var ol = h('ol', { class: 'opts' });
      arr(q.options).forEach(function (_, j) {
        var li = h('li', { class: q.answer === j ? 'right' : '' }, [ed('span', P.concat('options', j))]);
        li.appendChild(h('button', { type: 'button', class: 'btn ghost small', style: 'margin-left:8px;min-height:30px', text: q.answer === j ? 'Correct answer' : 'Make correct', onclick: function () { q.answer = j; markDirty(); renderTab(); } }));
        ol.appendChild(li);
      });
      b.appendChild(h('div', { class: 'blk' }, [delBtn(P, 'question'), h('span', { class: 'tag quiz', text: 'Quiz ' + (i + 1) }), ed('h3', P.concat('q')), ol, lab('Why'), ed('p', P.concat('why'), 'sub')]));
    });
    var ho = pr.handout || {};
    if (!pr.handout) pr.handout = ho;
    b.appendChild(h('div', { class: 'blk' }, [h('span', { class: 'tag', text: 'Agent handout' }), ed('p', ['practice', 'handout', 'summary']), lab('Checklist'), list(['practice', 'handout', 'checklist']), lab('Next steps'), list(['practice', 'handout', 'nextSteps']), arr(ho.resources).length ? lab('Resources') : null, arr(ho.resources).length ? list(['practice', 'handout', 'resources']) : null]));
  }
  function tSources(b) {
    var br = T.brief || {};
    b.appendChild(h('div', { class: 'blk' }, [h('h3', { text: 'The brief' }), h('p', { class: 'sub', text: [br.topic, br.platform, br.level, br.minutes + ' minutes', br.format].filter(Boolean).join(' · ') }), br.notes ? h('p', { text: br.notes }) : null,
      h('button', { type: 'button', class: 'btn small', style: 'margin-top:10px', text: 'Add content or change the brief', onclick: openFeed })]));
    arr(T.sources).forEach(function (s) {
      var pre = h('p', { class: 'sub', style: 'white-space:pre-wrap;max-height:260px;overflow:auto', text: s.text.slice(0, 6000) + (s.text.length > 6000 ? '\n...' : '') });
      b.appendChild(h('details', { class: 'blk' }, [h('summary', {}, [h('span', { class: 'kind', text: s.kind }), ' ', s.title, s.url ? ' · ' : '', s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener', text: 'open link' }) : null]), pre]));
    });
    if (!arr(T.sources).length) b.appendChild(h('p', { class: 'empty', text: 'No content was added. Everything was generated from the brief, so check it carefully.' }));
  }

  $('redoBtn').onclick = function () {
    var part = tab, txt = $('redoText').value.trim();
    if (!txt) { $('redoErr').textContent = 'Say what you would like changed.'; return; }
    var btn = this; btn.disabled = true; btn.textContent = 'Rewriting... (up to a minute)'; $('redoErr').textContent = '';
    post('generate', { part: part, brief: T.brief, source: sourceText(), plan: part === 'plan' ? null : T.plan, current: T[part], adjust: txt }, 170).then(function (j) {
      T[part] = j.data; $('redoText').value = ''; markDirty(); if (part === 'plan') openWork(); else renderTab();
    }).catch(function (err) { $('redoErr').textContent = err.message; }).then(function () { btn.disabled = false; btn.textContent = 'Rewrite this part'; });
  };

  function save(quiet) {
    $('savedState').textContent = 'Saving...';
    return post('save', { training: T }).then(function (j) { T.id = j.id; T.updated = j.updated; markSaved(j.updated); $('delBtn').hidden = false; })
      .catch(function (err) { $('savedState').textContent = 'Not saved'; if (!quiet) alert('Could not save: ' + err.message); else $('savedState').textContent = 'Not saved yet: press Save'; });
  }
  $('saveBtn').onclick = function () { save(false); };
  $('moreBtn').onclick = function (e) { e.stopPropagation(); $('pdfPop').hidden = true; var p = $('morePop'); p.hidden = !p.hidden; this.setAttribute('aria-expanded', String(!p.hidden)); };
  $('pdfBtn').onclick = function (e) { e.stopPropagation(); $('morePop').hidden = true; var p = $('pdfPop'); p.hidden = !p.hidden; this.setAttribute('aria-expanded', String(!p.hidden)); };
  document.addEventListener('click', function (e) { if (!e.target.closest('.menu')) { ['morePop', 'pdfPop'].forEach(function (id) { $(id).hidden = true; }); $('moreBtn').setAttribute('aria-expanded', 'false'); $('pdfBtn').setAttribute('aria-expanded', 'false'); } });
  document.querySelectorAll('[data-pdf]').forEach(function (b) {
    b.onclick = function () {
      $('pdfPop').hidden = true; var btn = $('pdfBtn'), was = btn.lastChild.textContent;
      btn.disabled = true; btn.lastChild.textContent = 'Making PDF...';
      makePdf(b.dataset.pdf).catch(function (err) { alert('The PDF could not be made: ' + err.message); }).then(function () { btn.disabled = false; btn.lastChild.textContent = was; });
    };
  });

  // ---------- PDF downloads (made on this device with jsPDF) ----------
  function clean(t) {
    // jsPDF's built-in fonts cover Western European text; swap or drop anything else so nothing prints as gibberish.
    return String(t == null ? '' : t).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u2026/g, '...')
      .replace(/[\u2022\u25CF]/g, '-').replace(/\u00A0/g, ' ').replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '');
  }
  function makePdf(kind) {
    return lib(CDN + 'jspdf/2.5.1/jspdf.umd.min.js').then(function () {
      var J = window.jspdf.jsPDF, p = T.plan || {}, pr = T.practice || {}, ho = pr.handout || {};
      var title = clean(p.title || (T.brief && T.brief.topic) || 'Training');
      var RED = [194, 39, 45], INK = [22, 24, 27], MUTED = [95, 99, 106], LINE = [222, 219, 212];
      var doc = new J({ unit: 'pt', format: 'a4', orientation: kind === 'slides' ? 'landscape' : 'portrait' });
      var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 50, y = M, part = '';
      function newPage() { doc.addPage('a4', 'portrait'); y = M; }
      function room(h) { if (y + h > H - M) newPage(); }
      function text(t, size, style, color, gap, indent) {
        indent = indent || 0; doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); doc.setTextColor.apply(doc, color || INK);
        var lines = doc.splitTextToSize(clean(t), W - 2 * M - indent), lh = size * 1.38;
        lines.forEach(function (ln) { room(lh); doc.text(ln, M + indent, y + size); y += lh; });
        y += gap == null ? 4 : gap;
      }
      function h1(t) { room(60); text(t, 22, 'bold', INK, 2); }
      function h2(t) { room(46); y += 10; doc.setDrawColor.apply(doc, RED); doc.setLineWidth(2); doc.line(M, y, M + 26, y); y += 8; text(t, 14.5, 'bold', INK, 4); }
      function h3(t) { room(30); y += 4; text(t, 11.5, 'bold', INK, 2); }
      function para(t, muted) { if (t) text(t, 10.5, 'normal', muted ? MUTED : INK, 6); }
      function list(items, numbered, box) {
        (items || []).filter(Boolean).forEach(function (it, i) {
          var mark = box ? '' : numbered ? (i + 1) + '.' : '-';
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
          var lines = doc.splitTextToSize(clean(it), W - 2 * M - 18), lh = 14.5; room(lh * Math.min(lines.length, 2));
          if (box) { doc.setDrawColor.apply(doc, MUTED); doc.setLineWidth(.8); doc.rect(M + 1, y + 2.5, 9, 9); }
          else { doc.setTextColor.apply(doc, RED); doc.text(mark, M, y + 10.5); }
          doc.setTextColor.apply(doc, INK);
          lines.forEach(function (ln) { room(lh); doc.text(ln, M + 18, y + 10.5); y += lh; });
          y += 3;
        });
        y += 4;
      }
      function rule() { room(14); doc.setDrawColor.apply(doc, LINE); doc.setLineWidth(.6); doc.line(M, y + 4, W - M, y + 4); y += 12; }
      function cover(sub) {
        doc.setFillColor.apply(doc, RED); doc.rect(0, 0, W, 6, 'F');
        text('KW EDGE  -  SMART AGENT SERIES', 9, 'bold', RED, 8);
        h1(title); if (p.subtitle) para(p.subtitle, true);
        para([T.brief && T.brief.platform, (p.minutes || (T.brief && T.brief.minutes) || '') + ' minutes', p.audience, sub].filter(Boolean).join('  |  '), true);
        rule();
      }
      function trainer() {
        part = 'Trainer pack'; cover('Trainer pack');
        if ((p.checkWithSource || []).filter(Boolean).length) { h2('Check before you present'); list(p.checkWithSource); }
        h2('By the end, agents can'); list(p.objectives);
        h2('Running order');
        (p.outline || []).forEach(function (s) { h3((s.minutes || '?') + ' min  -  ' + (s.title || '') + '  (' + (s.type || '') + ')'); para(s.summary, true); });
        if ((p.prerequisites || []).length || (p.materials || []).length) { h2('Before the session'); list((p.prerequisites || []).concat(p.materials || [])); }
        var sl = (T.slides && T.slides.slides) || [];
        if (sl.length) { h2('Slides and talk track'); sl.forEach(function (s, i) { h3((i + 1) + '. ' + (s.heading || '')); list(s.bullets); if (s.notes) para('Say: ' + s.notes, true); }); }
        ((T.demo && T.demo.demos) || []).forEach(function (d) {
          h2('Live demonstration: ' + (d.title || '')); para(d.goal);
          if ((d.setup || []).length) { h3('Have open before you start'); list(d.setup); }
          h3('Steps');
          (d.steps || []).forEach(function (st, i) { room(40); text((i + 1) + '.  ' + (st.do || ''), 10.5, 'bold', INK, 1, 0); if (st.say) text('Say: ' + st.say, 10, 'normal', MUTED, 1, 16); if (st.look) text('They should notice: ' + st.look, 10, 'normal', MUTED, 1, 16); if (st.tip) text('Tip: ' + st.tip, 10, 'normal', MUTED, 1, 16); y += 4; });
          if ((d.ifItGoesWrong || []).length) { h3('If it goes wrong'); list(d.ifItGoesWrong.map(function (w) { return w.problem + ': ' + w.fix; })); }
          if (d.checkpoint) para('Checkpoint: ' + d.checkpoint);
        });
        (pr.activities || []).forEach(function (a) { h2('Activity: ' + (a.title || '') + ' (' + (a.minutes || '?') + ' min)'); list(a.instructions, true); if (a.success) para('Done right when: ' + a.success); if (a.helper) para('While they work, you: ' + a.helper, true); });
        if ((pr.quiz || []).length) { h2('Quiz with answers'); pr.quiz.forEach(function (q, i) { h3((i + 1) + '. ' + q.q); list((q.options || []).map(function (o, j) { return String.fromCharCode(65 + j) + ') ' + o + (j === q.answer ? '   (correct)' : ''); })); if (q.why) para(q.why, true); }); }
      }
      function handout() {
        part = 'Agent handout'; cover('Agent handout');
        if (ho.summary) para(ho.summary);
        h2('What you can now do'); list(p.objectives);
        if ((ho.checklist || []).length) { h2('Checklist'); list(ho.checklist, false, true); }
        (pr.activities || []).forEach(function (a) { h2('Practice: ' + (a.title || '')); list(a.instructions, true); });
        if ((ho.nextSteps || []).length) { h2('Your next steps'); list(ho.nextSteps, true); }
        if ((ho.resources || []).length) { h2('Resources'); list(ho.resources); }
        if ((pr.quiz || []).length) { h2('Test yourself'); pr.quiz.forEach(function (q, i) { h3((i + 1) + '. ' + q.q); list((q.options || []).map(function (o, j) { return String.fromCharCode(65 + j) + ') ' + o; })); }); }
        rule(); para('Need help with your tech? Log a ticket at www.mret.co.za/smart-agent-series/tickets', true);
      }
      function slides(first) {
        var sl = (T.slides && T.slides.slides) || [];
        var pages = [{ k: 'KW EDGE  -  SMART AGENT SERIES', h: title, b: [p.subtitle].concat((p.objectives || []).map(function (o) { return 'By the end: ' + o; })).filter(Boolean) }]
          .concat(sl.map(function (s) { return { k: '', h: s.heading, b: s.bullets || [], n: s.notes }; }));
        pages.forEach(function (pg, i) {
          if (i > 0 || !first) doc.addPage('a4', 'landscape');
          var w = doc.internal.pageSize.getWidth(), hgt = doc.internal.pageSize.getHeight();
          doc.setFillColor(14, 15, 13); doc.rect(0, 0, w, hgt, 'F'); doc.setFillColor.apply(doc, RED); doc.rect(0, 0, w, 8, 'F');
          var yy = 80;
          if (pg.k || i) { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(240, 140, 143); doc.text(clean(pg.k || title).toUpperCase(), 60, yy); yy += 34; }
          doc.setFont('helvetica', 'bold'); doc.setFontSize(i ? 32 : 40); doc.setTextColor(243, 239, 230);
          doc.splitTextToSize(clean(pg.h || ''), w - 120).forEach(function (ln) { doc.text(ln, 60, yy); yy += i ? 40 : 48; });
          yy += 14; doc.setFont('helvetica', 'normal'); doc.setFontSize(19); doc.setTextColor(207, 203, 193);
          (pg.b || []).slice(0, 6).forEach(function (bl) { doc.splitTextToSize(clean(bl), w - 150).forEach(function (ln, k) { if (yy > hgt - 70) return; doc.text((k ? '   ' : '-  ') + ln, 70, yy); yy += 27; }); yy += 6; });
          doc.setFontSize(9); doc.setTextColor(140, 138, 130); doc.text('www.mret.co.za  |  ' + (i + 1) + ' / ' + pages.length, w - 60, hgt - 26, { align: 'right' });
        });
      }
      if (kind === 'slides') slides(true);
      else if (kind === 'handout') handout();
      else if (kind === 'trainer') trainer();
      else { trainer(); newPage(); handout(); slides(false); }
      // footer on portrait pages
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) {
        doc.setPage(i); var ps = doc.internal.pageSize; if (ps.getWidth() > ps.getHeight()) continue;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, MUTED);
        doc.text(title + '  |  KW Edge Smart Agent Series', M, ps.getHeight() - 24); doc.text('Page ' + i + ' of ' + n, ps.getWidth() - M, ps.getHeight() - 24, { align: 'right' });
      }
      var name = title.replace(/[^\w -]+/g, '').trim().replace(/\s+/g, ' ') || 'Training';
      doc.save(name + ' - ' + { trainer: 'Trainer pack', handout: 'Agent handout', slides: 'Slides', all: 'Complete' }[kind] + '.pdf');
    });
  }
  $('delBtn').onclick = function () {
    if (!T.id || !confirm('Move "' + ((T.plan && T.plan.title) || 'this training') + '" to your Google Drive bin? You can restore it from the bin for 30 days.')) return;
    post('remove', { id: T.id }).then(function () { T = null; dirty = false; ls.del('studio.draft'); $('savedState').textContent = ''; openLibrary(); }).catch(function (err) { alert(err.message); });
  };
  $('dlBtn').onclick = function () {
    var blob = new Blob([JSON.stringify(T, null, 2)], { type: 'application/json' });
    var a = h('a', { href: URL.createObjectURL(blob), download: ((T.plan && T.plan.title) || 'training').replace(/[^\w -]+/g, '').trim() + '.json' });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  window.addEventListener('beforeunload', function (e) { if (dirty && !$('vWork').hidden) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- printing ----------
  document.querySelectorAll('[data-print]').forEach(function (b) { b.onclick = function () { $('morePop').hidden = true; printPack(b.dataset.print); }; });
  function printPack(kind) {
    var pa = $('printArea'); pa.innerHTML = '';
    var p = T.plan || {}, pr = T.practice || {}, ho = pr.handout || {};
    var add = function (el) { pa.appendChild(el); return el; };
    var ul = function (items, ordered) { var l = h(ordered ? 'ol' : 'ul'); arr(items).forEach(function (t) { l.appendChild(h('li', { text: t })); }); return l; };
    add(h('h1', { text: p.title || 'Training' }));
    add(h('p', { class: 'muted', text: [p.subtitle, 'KW Edge · Smart Agent Series'].filter(Boolean).join(' · ') }));
    if (kind === 'handout') {
      if (ho.summary) add(h('p', { text: ho.summary }));
      add(h('h2', { text: 'What you can now do' })); add(ul(p.objectives));
      add(h('h2', { text: 'Checklist' })); var c = add(h('div')); arr(ho.checklist).forEach(function (t) { c.appendChild(h('p', {}, [h('span', { class: 'box' }), t])); });
      arr(pr.activities).forEach(function (a) { var d = add(h('div', { class: 'pblock' })); d.appendChild(h('h3', { text: 'Practice: ' + a.title })); d.appendChild(ul(a.instructions, true)); });
      if (arr(ho.nextSteps).length) { add(h('h2', { text: 'Your next steps' })); add(ul(ho.nextSteps, true)); }
      if (arr(ho.resources).length) { add(h('h2', { text: 'Resources' })); add(ul(ho.resources)); }
      if (arr(pr.quiz).length) { add(h('h2', { text: 'Test yourself' })); arr(pr.quiz).forEach(function (q, i) { var d = add(h('div', { class: 'pblock' })); d.appendChild(h('h3', { text: (i + 1) + '. ' + q.q })); var o = h('ol', { style: 'list-style:upper-alpha' }); arr(q.options).forEach(function (t) { o.appendChild(h('li', { text: t })); }); d.appendChild(o); }); }
      add(h('p', { class: 'muted', text: 'Need help? Log a ticket at www.mret.co.za/smart-agent-series/tickets' }));
    } else {
      add(h('p', { text: [T.brief && T.brief.platform, (p.minutes || '') + ' minutes', p.audience].filter(Boolean).join(' · ') }));
      if (arr(p.checkWithSource).length) { add(h('h2', { text: 'Check before presenting' })); add(ul(p.checkWithSource)); }
      add(h('h2', { text: 'Objectives' })); add(ul(p.objectives));
      add(h('h2', { text: 'Running order' })); add(ul(arr(p.outline).map(function (s) { return s.minutes + ' min · ' + s.type + ' · ' + s.title + (s.summary ? ': ' + s.summary : ''); }), true));
      add(h('h2', { text: 'Prepare' })); add(ul(arr(p.prerequisites).concat(arr(p.materials))));
      add(h('h2', { text: 'Slides and talk track' }));
      arr(T.slides && T.slides.slides).forEach(function (s, i) { var d = add(h('div', { class: 'pblock' })); d.appendChild(h('h3', { text: (i + 1) + '. ' + s.heading })); d.appendChild(ul(s.bullets)); if (s.notes) d.appendChild(h('p', { class: 'muted', text: 'Say: ' + s.notes })); });
      arr(T.demo && T.demo.demos).forEach(function (dm) {
        add(h('h2', { text: 'Demonstration: ' + dm.title })); if (dm.goal) add(h('p', { text: dm.goal }));
        if (arr(dm.setup).length) { add(h('h3', { text: 'Have open' })); add(ul(dm.setup)); }
        var o = add(h('ol')); arr(dm.steps).forEach(function (st) { o.appendChild(h('li', { class: 'pblock' }, [h('b', { text: st.do }), h('br'), h('span', { class: 'muted', text: 'Say: ' + (st.say || '') + (st.look ? ' | Notice: ' + st.look : '') + (st.tip ? ' | Tip: ' + st.tip : '') })])); });
        if (arr(dm.ifItGoesWrong).length) { add(h('h3', { text: 'If it goes wrong' })); add(ul(dm.ifItGoesWrong.map(function (w) { return w.problem + ': ' + w.fix; }))); }
        if (dm.checkpoint) add(h('p', { text: 'Checkpoint: ' + dm.checkpoint }));
      });
      arr(pr.activities).forEach(function (a) { add(h('h2', { text: 'Activity: ' + a.title + ' (' + a.minutes + ' min)' })); add(ul(a.instructions, true)); add(h('p', { text: 'Done right when: ' + (a.success || '') })); add(h('p', { class: 'muted', text: 'You: ' + (a.helper || '') })); });
      if (arr(pr.quiz).length) { add(h('h2', { text: 'Quiz with answers' })); arr(pr.quiz).forEach(function (q, i) { add(h('p', { class: 'pblock', text: (i + 1) + '. ' + q.q + '  Answer: ' + String.fromCharCode(65 + (q.answer || 0)) + ') ' + arr(q.options)[q.answer || 0] + (q.why ? '. ' + q.why : '') })); }); }
    }
    setTimeout(function () { window.print(); }, 50);
  }

  // ---------- presenting ----------
  var P = { items: [], i: 0, start: 0, timer: null, reveal: false, notes: true };
  function buildDeck() {
    var p = T.plan || {}, slides = arr(T.slides && T.slides.slides), demos = arr(T.demo && T.demo.demos), acts = arr(T.practice && T.practice.activities), quiz = arr(T.practice && T.practice.quiz);
    var used = { s: {}, d: {}, a: {} }, quizDone = false, items = [{ kind: 'title' }], planned = 0;
    var push = function (it, seg) { it.seg = seg; it.until = planned; items.push(it); };
    var addDemo = function (d, j, seg) { used.d[j] = 1; push({ kind: 'demoIntro', d: d }, seg); arr(d.steps).forEach(function (st, k) { push({ kind: 'step', d: d, st: st, k: k }, seg); }); if (d.checkpoint) push({ kind: 'check', d: d }, seg); };
    var addQuiz = function (seg) { quizDone = true; quiz.forEach(function (q, k) { push({ kind: 'quiz', q: q, k: k }, seg); }); };
    arr(p.outline).forEach(function (seg) {
      planned += Number(seg.minutes) || 0;
      slides.forEach(function (s, j) { if (s.segment === seg.id && !used.s[j]) { used.s[j] = 1; push({ kind: 'slide', s: s }, seg); } });
      demos.forEach(function (d, j) { if (d.segment === seg.id && !used.d[j]) addDemo(d, j, seg); });
      acts.forEach(function (a, j) { if (a.segment === seg.id && !used.a[j]) { used.a[j] = 1; push({ kind: 'activity', a: a }, seg); } });
      if (seg.type === 'quiz' && !quizDone) addQuiz(seg);
    });
    slides.forEach(function (s, j) { if (!used.s[j]) push({ kind: 'slide', s: s }, null); });
    demos.forEach(function (d, j) { if (!used.d[j]) addDemo(d, j, null); });
    acts.forEach(function (a, j) { if (!used.a[j]) push({ kind: 'activity', a: a }, null); });
    if (!quizDone && quiz.length) addQuiz(null);
    push({ kind: 'end' }, null);
    return items;
  }
  function videos() { return arr(T.sources).filter(function (s) { return s.url; }); }
  function embed(url) {
    var y = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(url); if (y) return 'https://www.youtube-nocookie.com/embed/' + y[1];
    var l = /loom\.com\/(?:share|embed)\/([\w]+)/.exec(url); if (l) return 'https://www.loom.com/embed/' + l[1];
    return '';
  }
  $('presentBtn').onclick = function () {
    if (!T.plan) return;
    P.items = buildDeck(); P.i = 0; P.reveal = false; P.start = Date.now();
    $('present').hidden = false; document.body.style.overflow = 'hidden';
    var v = videos(); $('pVideo').hidden = !v.length;
    var sel = $('pVideoSel'); sel.innerHTML = ''; v.forEach(function (s, i) { sel.appendChild(h('option', { value: i, text: s.title })); });
    try { if (document.documentElement.requestFullscreen && matchMedia('(min-width: 900px)').matches) document.documentElement.requestFullscreen().catch(function () {}); } catch (e) {}
    clearInterval(P.timer); P.timer = setInterval(tick, 1000); tick(); draw();
  };
  function closePresent() { $('present').hidden = true; document.body.style.overflow = ''; clearInterval(P.timer); closeVideo(); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} }
  $('pClose').onclick = closePresent;
  function tick() {
    var s = Math.floor((Date.now() - P.start) / 1000), it = P.items[P.i] || {};
    $('pTime').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    $('pTime').classList.toggle('over', !!(it.until && s > it.until * 60));
    $('pTime').title = it.until ? 'Planned to finish this part by ' + it.until + ' minutes' : '';
  }
  function draw() {
    var it = P.items[P.i], st = $('pStage'), p = T.plan || {}; st.innerHTML = ''; var notes = [];
    var sl = h('div', { class: 'slide' }); st.appendChild(sl); st.scrollTop = 0;
    var segs = arr(p.outline); var si = it.seg ? segs.indexOf(it.seg) : -1;
    $('pSeg').textContent = it.seg ? 'Part ' + (si + 1) + ' of ' + segs.length + ' · ' + it.seg.title + ' · ' + (it.seg.minutes || '?') + ' min' : (p.title || '');
    if (it.kind === 'title') {
      sl.className = 'slide title'; sl.appendChild(h('div', { class: 'k', text: 'KW Edge · Smart Agent Series' })); sl.appendChild(h('h2', { text: p.title || '' })); if (p.subtitle) sl.appendChild(h('p', { text: p.subtitle }));
      if (arr(p.objectives).length) { sl.appendChild(h('div', { class: 'k', style: 'margin-top:28px', text: 'By the end of this session you can' })); var u = h('ul'); arr(p.objectives).forEach(function (o) { u.appendChild(h('li', { text: o })); }); sl.appendChild(u); }
      notes.push(['Before you start', arr(p.materials).join('; ')]);
    } else if (it.kind === 'slide') {
      sl.appendChild(h('div', { class: 'k', text: it.seg ? it.seg.title : '' })); sl.appendChild(h('h2', { text: it.s.heading || '' }));
      var ul = h('ul'); arr(it.s.bullets).forEach(function (b) { ul.appendChild(h('li', { text: b })); }); sl.appendChild(ul);
      notes.push(['Say', it.s.notes]); notes.push(['Visual', it.s.visual]);
    } else if (it.kind === 'demoIntro') {
      sl.appendChild(h('div', { class: 'k', text: 'Live demonstration' })); sl.appendChild(h('h2', { text: it.d.title || '' })); if (it.d.goal) sl.appendChild(h('p', { class: 'big', text: it.d.goal }));
      sl.appendChild(h('p', { class: 'say', text: 'Watch first. You will do it yourself straight after.' }));
      notes.push(['Have open', arr(it.d.setup).join('; ')]);
    } else if (it.kind === 'step') {
      sl.appendChild(h('div', { class: 'k', text: (it.d.title || 'Demonstration') + ' · Step ' + (it.k + 1) + ' of ' + arr(it.d.steps).length }));
      sl.appendChild(h('div', { style: 'display:flex;gap:18px;align-items:flex-start;margin-top:14px' }, [h('span', { class: 'stepn', text: String(it.k + 1) }), h('p', { class: 'big', style: 'margin:0', text: it.st.do || '' })]));
      if (it.st.look) sl.appendChild(h('p', { class: 'say', text: 'Notice: ' + it.st.look }));
      notes.push(['Say', it.st.say]); notes.push(['Tip', it.st.tip]);
      if (it.k === arr(it.d.steps).length - 1) notes.push(['If it goes wrong', arr(it.d.ifItGoesWrong).map(function (w) { return w.problem + ': ' + w.fix; }).join(' | ')]);
    } else if (it.kind === 'check') {
      sl.appendChild(h('div', { class: 'k', text: 'Checkpoint' })); sl.appendChild(h('h2', { text: it.d.checkpoint }));
      notes.push(['Do', 'Ask the room. Wait for hands up before moving on.']);
    } else if (it.kind === 'activity') {
      sl.appendChild(h('div', { class: 'k', text: 'Your turn · ' + (it.a.minutes || '?') + ' minutes' })); sl.appendChild(h('h2', { text: it.a.title || '' }));
      var ol = h('ul'); arr(it.a.instructions).forEach(function (x) { ol.appendChild(h('li', { text: x })); }); sl.appendChild(ol);
      if (it.a.success) sl.appendChild(h('p', { class: 'say', text: 'Done right when: ' + it.a.success }));
      notes.push(['While they work', it.a.helper]);
    } else if (it.kind === 'quiz') {
      sl.appendChild(h('div', { class: 'k', text: 'Quick quiz · ' + (it.k + 1) })); sl.appendChild(h('h2', { text: it.q.q || '' }));
      var qo = h('ol', { class: 'qopts' }); arr(it.q.options).forEach(function (o, j) { qo.appendChild(h('li', { class: P.reveal && j === it.q.answer ? 'right' : '', text: o })); }); sl.appendChild(qo);
      if (P.reveal && it.q.why) sl.appendChild(h('p', { class: 'say', text: it.q.why }));
      notes.push(['Answer', String.fromCharCode(65 + (it.q.answer || 0)) + '. ' + (it.q.why || '')]); notes.push(['Next', P.reveal ? 'Press Next for the next question.' : 'Press Next to reveal the answer.']);
    } else {
      var ho = (T.practice && T.practice.handout) || {};
      sl.appendChild(h('div', { class: 'k', text: 'Wrap up' })); sl.appendChild(h('h2', { text: 'Your next steps' }));
      var ns = h('ul'); arr(ho.nextSteps).forEach(function (x) { ns.appendChild(h('li', { text: x })); }); sl.appendChild(ns);
      sl.appendChild(h('p', { class: 'say', text: 'Need help after today? Log a ticket at www.mret.co.za/smart-agent-series/tickets' }));
      notes.push(['Close', ho.summary]);
    }
    var nb = $('pNotesBox'); nb.innerHTML = '';
    notes.filter(function (n) { return n[1]; }).forEach(function (n) { nb.appendChild(h('p', { style: 'margin:0 0 6px' }, [h('b', { text: n[0] + ' ' }), ' ', n[1]])); });
    nb.hidden = !P.notes || !nb.childNodes.length;
    $('pCount').textContent = (P.i + 1) + ' of ' + P.items.length;
    $('pFill').style.width = ((P.i + 1) / P.items.length * 100) + '%';
    $('pPrev').disabled = P.i === 0; $('pNext').textContent = P.i === P.items.length - 1 ? 'Finish' : it.kind === 'quiz' && !P.reveal ? 'Reveal' : 'Next';
    tick();
  }
  function next() {
    var it = P.items[P.i];
    if (it.kind === 'quiz' && !P.reveal) { P.reveal = true; return draw(); }
    if (P.i >= P.items.length - 1) return closePresent();
    P.i++; P.reveal = false; draw();
  }
  function prev() { if (P.i > 0) { P.i--; P.reveal = false; draw(); } }
  $('pNext').onclick = next; $('pPrev').onclick = prev;
  $('pNotes').onclick = function () { P.notes = !P.notes; this.setAttribute('aria-pressed', String(P.notes)); draw(); };
  function openVideo() {
    var v = videos()[Number($('pVideoSel').value) || 0]; if (!v) return;
    var f = $('pVideoFrame'); f.innerHTML = ''; var src = embed(v.url);
    f.appendChild(src ? h('iframe', { src: src, allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: 'true', title: v.title }) : h('p', {}, ['This link can\'t play here. ', h('a', { href: v.url, target: '_blank', rel: 'noopener', text: 'Open it in a new tab' })]));
    $('pVideoBox').hidden = false;
  }
  function closeVideo() { $('pVideoBox').hidden = true; $('pVideoFrame').innerHTML = ''; }
  $('pVideo').onclick = openVideo; $('pVideoSel').onchange = openVideo; $('pVideoClose').onclick = closeVideo;
  document.addEventListener('keydown', function (e) {
    if ($('present').hidden) return;
    if (!$('pVideoBox').hidden) { if (e.key === 'Escape') closeVideo(); return; }
    if (['ArrowRight', 'PageDown', ' '].indexOf(e.key) >= 0) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp'].indexOf(e.key) >= 0) { e.preventDefault(); prev(); }
    else if (e.key === 'n' || e.key === 'N') $('pNotes').click();
    else if (e.key === 'Escape') closePresent();
  });

  // ---------- start ----------
  if (token) openLibrary(); else showLogin();
})();
