// Booking wizard for Timeless Entry Garage Doors
(() => {
  'use strict';

  // PREVIEW MODE: this form is a demo. Nothing is sent, emailed, or saved
  // anywhere — "Confirm Booking" only shows the confirmation screen.
  const CONFIG = {
    daysAhead: 90,
    leadHours: 1, // same-day windows must start at least this many hours from now
  };

  const SERVICES = [
    { id: 'spring', name: 'Broken Spring', desc: 'Torsion or extension spring snapped', icon: 'spring', hot: true, pop: 'Most booked' },
    { id: 'opener', name: 'Opener Repair / Install', desc: 'Motor, remote, keypad, or sensors', icon: 'remote' },
    { id: 'install', name: 'New Door Install', desc: 'Replace or add a garage door', icon: 'install' },
    { id: 'cable', name: 'Cables, Rollers & Tracks', desc: 'Frayed cable, noisy rollers, bent track', icon: 'roller' },
    { id: 'offtrack', name: 'Door Off Track', desc: 'Crooked, jammed, or hanging door', icon: 'alert', hot: true },
    { id: 'trailer', name: 'Trailer Spring & Cable', desc: 'Enclosed trailer ramp door', icon: 'trailer' },
    { id: 'commercial', name: 'Commercial Door', desc: 'Shops, warehouses, storefronts', icon: 'building' },
    { id: 'tuneup', name: 'Tune-Up & Safety Check', desc: 'Lube, balance, adjust, inspect', icon: 'wrench' },
    { id: 'other', name: 'Not Sure', desc: "Describe it — we'll diagnose", icon: 'help' },
  ];

  const SLOTS = [
    { h: 8, label: '8 – 10 AM', part: 'Morning' },
    { h: 10, label: '10 AM – 12 PM', part: 'Morning' },
    { h: 12, label: '12 – 2 PM', part: 'Afternoon' },
    { h: 14, label: '2 – 4 PM', part: 'Afternoon' },
    { h: 16, label: '4 – 6 PM', part: 'Evening' },
    { h: 18, label: '6 – 8 PM', part: 'Evening', tag: 'After-hours' },
  ];

  const ISSUES = ['Loud bang or noise', "Won't open", "Won't close", 'Spring looks broken', 'Cable snapped', 'Remote / keypad dead', 'Door is crooked', 'Opener runs, door stays put'];
  const STEPS = ['Service', 'Details', 'Date & Time', 'Your Info', 'Review'];
  const KEY = 'te-booking-draft-v1';
  const LAST = STEPS.length - 1;

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const icon = id => `<svg class="i" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const fmt = (s, opts) => new Intl.DateTimeFormat('en-US', opts).format(parseISO(s));
  const fmtLong = s => fmt(s, { weekday: 'long', month: 'long', day: 'numeric' });
  const digits = s => String(s || '').replace(/\D/g, '');
  const svcById = id => SERVICES.find(s => s.id === id);
  const slotByH = h => SLOTS.find(s => s.h === h);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- state ---------- */
  const state = {
    step: 0, maxStep: 0,
    service: null, emergency: false,
    property: 'Residential', doors: 1, brand: '', tags: [], issue: '',
    date: '', slot: null,
    name: '', phone: '', email: '', address: '', city: '', zip: '', contact: 'Text', consent: true,
  };
  let photos = [];

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') Object.assign(state, saved);
  } catch { /* storage unavailable */ }
  state.step = 0;
  if (!Array.isArray(state.tags)) state.tags = [];
  if (state.date && parseISO(state.date) < today()) { state.date = ''; state.slot = null; }
  const qs = new URLSearchParams(location.search).get('service');
  if (qs && svcById(qs)) {
    state.service = qs;
    if (qs === 'trailer') state.property = 'Enclosed Trailer';
    if (qs === 'commercial') state.property = 'Commercial';
  }

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  };

  /* ---------- elements ---------- */
  const wizard = $('#wizard');
  const steps = $$('.step');
  const stepper = $('#stepper');
  const progressBar = $('#progressBar');
  const meter = $('#meter');
  const backBtn = $('#backBtn');
  const nextBtn = $('#nextBtn');
  const footHint = $('#footHint');

  /* ---------- stepper ---------- */
  stepper.innerHTML = STEPS.map((label, i) =>
    `<button type="button" data-go="${i}"><span class="dot"><span>${i + 1}</span>${icon('check')}</span><span class="lbl">${label}</span></button>`
  ).join('');
  stepper.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b && !b.disabled) go(Number(b.dataset.go));
  });

  /* ---------- step 1: services ---------- */
  const svcGrid = $('#svcGrid');
  svcGrid.innerHTML = SERVICES.map(s => `
    <button type="button" class="svc${s.hot ? ' hot' : ''}" data-id="${s.id}" aria-pressed="false">
      ${s.pop ? `<span class="pop">${s.pop}</span>` : ''}
      <span class="svc-ico">${icon(s.icon)}</span>
      <span class="svc-name">${esc(s.name)}</span>
      <span class="svc-desc">${esc(s.desc)}</span>
      <span class="tick">${icon('check')}</span>
    </button>`).join('');
  svcGrid.addEventListener('click', e => {
    const b = e.target.closest('.svc');
    if (!b) return;
    state.service = b.dataset.id;
    if (state.service === 'trailer') state.property = 'Enclosed Trailer';
    else if (state.service === 'commercial') state.property = 'Commercial';
    else if (state.property !== 'Residential' && state.maxStep < 1) state.property = 'Residential';
    hideErr('service');
    sync();
    nextBtn.classList.remove('pulse'); void nextBtn.offsetWidth; nextBtn.classList.add('pulse');
  });

  const emergency = $('#emergency');
  const emergencyAlert = $('#emergencyAlert');
  emergency.addEventListener('change', () => { state.emergency = emergency.checked; sync(); });

  /* ---------- step 2: details ---------- */
  $$('input[name="property"]').forEach(r => r.addEventListener('change', () => { state.property = r.value; sync(); }));
  $$('[data-doors]').forEach(b => b.addEventListener('click', () => {
    state.doors = Math.min(6, Math.max(1, state.doors + Number(b.dataset.doors)));
    sync();
  }));

  const chips = $('#issueChips');
  chips.innerHTML = ISSUES.map(t => `<button type="button" aria-pressed="false" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
  chips.addEventListener('click', e => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    const t = b.dataset.tag;
    state.tags = state.tags.includes(t) ? state.tags.filter(x => x !== t) : [...state.tags, t];
    sync();
  });

  // Photos
  const photoInput = $('#photos');
  const thumbs = $('#thumbs');
  const dropzone = $('#dropzone');
  const addPhotos = files => {
    [...files].filter(f => f.type.startsWith('image/')).forEach(f => {
      if (photos.length < 6) photos.push({ file: f, url: URL.createObjectURL(f) });
    });
    renderThumbs();
  };
  const renderThumbs = () => {
    thumbs.innerHTML = photos.map((p, i) =>
      `<div class="thumb"><img src="${p.url}" alt="Photo ${i + 1}"><button type="button" data-rm="${i}" aria-label="Remove photo ${i + 1}">${icon('x')}</button></div>`
    ).join('');
  };
  photoInput.addEventListener('change', () => { addPhotos(photoInput.files); photoInput.value = ''; });
  thumbs.addEventListener('click', e => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    const [removed] = photos.splice(Number(b.dataset.rm), 1);
    URL.revokeObjectURL(removed.url);
    renderThumbs();
  });
  ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, () => dropzone.classList.remove('drag')));
  dropzone.addEventListener('drop', e => { e.preventDefault(); addPhotos(e.dataTransfer.files); });

  /* ---------- step 3: calendar ---------- */
  const calGrid = $('#calGrid');
  const calTitle = $('#calTitle');
  const calPrev = $('#calPrev');
  const calNext = $('#calNext');
  const slotsEl = $('#slots');
  const slotsTitle = $('#slotsTitle');
  const maxDate = () => { const d = today(); d.setDate(d.getDate() + CONFIG.daysAhead); return d; };
  let view = (() => { const d = state.date ? parseISO(state.date) : today(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

  const slotOpen = (iso, h) => {
    if (iso !== toISO(today())) return true;
    const now = new Date();
    return h >= now.getHours() + now.getMinutes() / 60 + CONFIG.leadHours;
  };
  const dayHasSlots = iso => SLOTS.some(s => slotOpen(iso, s.h));

  function renderCal() {
    const y = view.getFullYear(), m = view.getMonth();
    calTitle.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(view);
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const t0 = today(), tMax = maxDate(), todayISO = toISO(t0);
    let html = '';
    for (let i = 0; i < first; i++) html += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m, d);
      const iso = toISO(date);
      const disabled = date < t0 || date > tMax || !dayHasSlots(iso);
      const label = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
      html += `<button type="button" class="cal-day${iso === todayISO ? ' today' : ''}${disabled ? '' : ' avail'}" data-date="${iso}" aria-label="${label}${iso === todayISO ? ' (today)' : ''}" aria-pressed="${iso === state.date}" ${disabled ? 'disabled' : ''}>${d}</button>`;
    }
    calGrid.innerHTML = html;
    calPrev.disabled = y === t0.getFullYear() && m === t0.getMonth();
    calNext.disabled = new Date(y, m + 1, 1) > tMax;
  }

  function renderSlots() {
    if (!state.date) {
      slotsTitle.textContent = 'Pick a date';
      slotsEl.innerHTML = `<div class="slots-empty"><div>${icon('calendar')}<br>Choose a day on the calendar to see arrival windows.</div></div>`;
      return;
    }
    slotsTitle.textContent = fmtLong(state.date);
    slotsEl.innerHTML = SLOTS.map(s => {
      const open = slotOpen(state.date, s.h);
      return `<button type="button" class="slot" data-slot="${s.h}" aria-pressed="${state.slot === s.h}" ${open ? '' : 'disabled'}>
        <span>${s.label}</span>${s.tag ? `<span class="tagx">${s.tag}</span>` : `<small>${s.part}</small>`}
      </button>`;
    }).join('');
  }

  calGrid.addEventListener('click', e => {
    const b = e.target.closest('[data-date]');
    if (!b || b.disabled) return;
    state.date = b.dataset.date;
    if (state.slot != null && !slotOpen(state.date, state.slot)) state.slot = null;
    hideErr('date');
    sync();
  });
  slotsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-slot]');
    if (!b || b.disabled) return;
    state.slot = Number(b.dataset.slot);
    hideErr('slot');
    sync();
    nextBtn.classList.remove('pulse'); void nextBtn.offsetWidth; nextBtn.classList.add('pulse');
  });
  calPrev.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); });
  calNext.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); });

  /* ---------- step 4: contact ---------- */
  const formatPhone = v => {
    const d = digits(v).slice(0, 10);
    if (d.length < 4) return d;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };
  $$('[data-bind]').forEach(el => {
    const key = el.dataset.bind;
    const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      if (el.type === 'checkbox') state[key] = el.checked;
      else {
        if (key === 'phone') el.value = formatPhone(el.value);
        if (key === 'zip') el.value = digits(el.value).slice(0, 5);
        state[key] = el.value;
      }
      if (el.getAttribute('aria-invalid') === 'true') fieldErr(key, '');
      save();
      renderSummary();
    });
  });
  $$('input[name="contact"]').forEach(r => r.addEventListener('change', () => { state.contact = r.value; sync(); }));

  /* ---------- validation ---------- */
  function showErr(key) {
    const el = $(`[data-err="${key}"]`);
    if (!el) return;
    el.hidden = false;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }
  function hideErr(key) { const el = $(`[data-err="${key}"]`); if (el) el.hidden = true; }
  function fieldErr(key, msg) {
    const input = $(`[data-bind="${key}"]`);
    const out = $(`[data-msg="${key}"]`);
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (out) out.textContent = msg;
    return !msg;
  }

  function validate(step) {
    if (step === 0) {
      if (!state.service) { showErr('service'); return false; }
    }
    if (step === 2) {
      if (!state.date) { showErr('date'); return false; }
      if (state.slot == null || !slotOpen(state.date, state.slot)) { state.slot = null; renderSlots(); showErr('slot'); return false; }
    }
    if (step === 3) {
      const checks = [
        fieldErr('name', state.name.trim().length < 2 ? 'Please enter your name.' : ''),
        fieldErr('phone', digits(state.phone).length !== 10 ? 'Enter a 10-digit phone number.' : ''),
        fieldErr('email', state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email) ? 'That email looks off.' : ''),
        fieldErr('address', state.address.trim().length < 4 ? 'Where should we show up?' : ''),
        fieldErr('zip', digits(state.zip).length !== 5 ? '5-digit ZIP' : ''),
      ];
      if (state.contact === 'Email' && !state.email) checks.push(fieldErr('email', 'Add an email, or pick Text or Call.'));
      if (checks.includes(false)) {
        const firstBad = $('[aria-invalid="true"]');
        firstBad?.focus();
        return false;
      }
    }
    return true;
  }

  /* ---------- navigation ---------- */
  function go(n) {
    n = Math.max(0, Math.min(LAST, n));
    if (n > state.step) {
      for (let s = state.step; s < n; s++) {
        if (!validate(s)) { if (s !== state.step) setStep(s); return; }
      }
    }
    setStep(n);
  }

  function setStep(n) {
    const backwards = n < state.step;
    state.step = n;
    state.maxStep = Math.max(state.maxStep, n);
    save();
    steps.forEach(sec => {
      const active = Number(sec.dataset.step) === n;
      sec.classList.toggle('active', active);
      sec.classList.toggle('back', active && backwards);
    });
    if (n === LAST) renderReview();
    if (n === 2) { renderCal(); renderSlots(); }
    renderChrome();
    const top = wizard.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 100, behavior: reduceMotion ? 'auto' : 'smooth' });
    $(`#s${n}-title`)?.focus({ preventScroll: true });
  }

  function renderChrome() {
    $$('button', stepper).forEach((b, i) => {
      b.classList.toggle('current', i === state.step);
      b.classList.toggle('done', i < state.step || (i <= state.maxStep && i !== state.step && isComplete(i)));
      b.disabled = i > state.maxStep;
      b.setAttribute('aria-current', i === state.step ? 'step' : 'false');
    });
    progressBar.style.width = `${(state.step / LAST) * 100}%`;
    backBtn.style.visibility = state.step === 0 ? 'hidden' : 'visible';
    nextBtn.querySelector('.label').textContent = state.step === LAST ? 'Confirm Booking' : state.step === LAST - 1 ? 'Review' : 'Continue';
    footHint.innerHTML = hint();
  }

  function isComplete(i) {
    if (i === 0) return !!state.service;
    if (i === 2) return !!state.date && state.slot != null;
    if (i === 3) return state.name.trim().length > 1 && digits(state.phone).length === 10 && state.address.trim().length > 3 && digits(state.zip).length === 5;
    return true;
  }

  function hint() {
    const svc = svcById(state.service);
    switch (state.step) {
      case 0: return svc ? `Selected: <strong>${esc(svc.name)}</strong>` : 'Choose one to continue';
      case 1: return 'Everything here is optional';
      case 2: return state.date && state.slot != null ? `<strong>${esc(fmt(state.date, { weekday: 'short', month: 'short', day: 'numeric' }))}</strong> · ${esc(slotByH(state.slot).label)}` : 'Pick a day and a window';
      case 3: return 'We never share your info';
      default: return 'No payment needed to book';
    }
  }

  backBtn.addEventListener('click', () => go(state.step - 1));
  nextBtn.addEventListener('click', () => (state.step === LAST ? submit() : go(state.step + 1)));
  $('#bookingForm').addEventListener('submit', e => { e.preventDefault(); nextBtn.click(); });
  $('#bookingForm').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); nextBtn.click(); }
  });

  /* ---------- summary (sidebar) ---------- */
  function setRow(key, val, sub, urgent) {
    const li = $(`[data-row="${key}"]`);
    li.classList.toggle('filled', !!val);
    li.classList.toggle('urgent', !!urgent);
    $('.val', li).textContent = val || 'Not set yet';
    $('.sub', li).textContent = sub || '';
  }

  function renderSummary() {
    const svc = svcById(state.service);
    const slot = slotByH(state.slot);
    setRow('service', svc?.name, state.emergency ? '⚡ Emergency' : '', state.emergency);
    setRow('details', state.maxStep >= 1 ? `${state.property} · ${state.doors} door${state.doors > 1 ? 's' : ''}` : '', [state.brand, ...state.tags].filter(Boolean).join(', '));
    setRow('when', state.date ? fmtLong(state.date) : '', slot ? `${slot.label} (Mountain)` : '');
    setRow('where', state.address.trim(), [state.city, state.zip].filter(Boolean).join(', '));
    setRow('who', state.name.trim(), [state.phone, state.contact && state.phone ? `prefers ${state.contact.toLowerCase()}` : ''].filter(Boolean).join(' · '));
    const done = [!!svc, state.maxStep >= 1, !!state.date && !!slot, !!state.address.trim(), !!state.name.trim() && digits(state.phone).length === 10].filter(Boolean).length;
    meter.style.width = `${(done / 5) * 100}%`;
  }

  /* ---------- review ---------- */
  function renderReview() {
    const svc = svcById(state.service);
    const slot = slotByH(state.slot);
    const rows = [
      { ico: svc?.icon || 'wrench', label: 'Service', main: svc?.name + (state.emergency ? ' — Emergency' : ''), sub: svc?.desc, go: 0 },
      { ico: 'clipboard', label: 'Details', main: `${state.property} · ${state.doors} door${state.doors > 1 ? 's' : ''}${state.brand ? ' · ' + state.brand : ''}`, sub: [state.tags.join(', '), state.issue.trim(), photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' — ') || 'No notes added', go: 1 },
      { ico: 'calendar', label: 'Arrival window', main: state.date ? fmtLong(state.date) : '', sub: slot ? `${slot.label} · Mountain Time · 2-hr window` : '', go: 2 },
      { ico: 'pin', label: 'Service address', main: state.address, sub: [state.city, 'CO', state.zip].filter(Boolean).join(', '), go: 3 },
      { ico: 'user', label: 'Contact', main: state.name, sub: [state.phone, state.email, `prefers ${state.contact.toLowerCase()}`].filter(Boolean).join(' · '), go: 3 },
    ];
    $('#review').innerHTML = rows.map(r => `
      <div class="review-row">
        <span class="ico">${icon(r.ico)}</span>
        <div><small>${esc(r.label)}</small><strong>${esc(r.main)}</strong><span>${esc(r.sub)}</span></div>
        <button type="button" class="edit" data-go="${r.go}">Edit</button>
      </div>`).join('');
  }
  $('#review').addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) go(Number(b.dataset.go));
  });

  /* ---------- confirm (preview only — nothing is sent anywhere) ---------- */
  function submit() {
    for (let s = 0; s < LAST; s++) { if (!validate(s)) { setStep(s); return; } }
    const svc = svcById(state.service);
    const slot = slotByH(state.slot);
    $('#bookingForm').hidden = true;
    stepper.hidden = true;
    $('.progress').hidden = true;
    $('#wizFoot').hidden = true;
    $('#success').classList.add('show');
    const rows = [
      ['Service', svc.name + (state.emergency ? ' (Emergency)' : '')],
      ['Date', fmtLong(state.date)],
      ['Arrival window', `${slot.label} MT`],
      ['Address', [state.address.trim(), state.city.trim()].filter(Boolean).join(', ')],
      ['We\'ll reach you by', `${state.contact} · ${state.phone}`],
    ];
    $('#successTicket').innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    wizard.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    $('#successTitle').focus({ preventScroll: true });
    if (!reduceMotion) confetti();
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }

  function confetti() {
    const box = $('#confetti');
    const colors = ['#e11d3f', '#0479b3', '#0a2233', '#f5f0e8', '#e2d6c2'];
    box.innerHTML = Array.from({ length: 70 }, () => {
      const x = (Math.random() - 0.5) * 360;
      return `<i style="left:${Math.random() * 100}%;background:${colors[Math.floor(Math.random() * colors.length)]};--x:${x}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.5}s;animation-duration:${2 + Math.random() * 1.6}s"></i>`;
    }).join('');
    setTimeout(() => { box.innerHTML = ''; }, 4500);
  }

  /* ---------- sync all UI from state ---------- */
  function sync() {
    save();
    $$('.svc', svcGrid).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === state.service)));
    emergency.checked = state.emergency;
    emergencyAlert.hidden = !state.emergency;
    $$('input[name="property"]').forEach(r => { r.checked = r.value === state.property; });
    $('#doorsOut').textContent = state.doors;
    $$('[data-tag]', chips).forEach(b => b.setAttribute('aria-pressed', String(state.tags.includes(b.dataset.tag))));
    $$('input[name="contact"]').forEach(r => { r.checked = r.value === state.contact; });
    renderCal();
    renderSlots();
    renderSummary();
    renderChrome();
  }

  // initial fill of bound inputs
  $$('[data-bind]').forEach(el => {
    const v = state[el.dataset.bind];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
  });
  sync();
})();
