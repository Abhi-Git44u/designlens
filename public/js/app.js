/**
 * DesignLens – Full-featured Frontend
 * public/js/app.js
 */
'use strict';

/* ── State ────────────────────────────────────────────────────── */
let currentScan = null;        // most recent scan result object
let allIssues   = [];          // flat issue array for explorer
let scanHistory = loadHistory(); // array of history entries

/* ── Fix Guidance (before/after code) ────────────────────────── */
const FIX_GUIDANCE = {
  'image-alt': {
    why: 'Screen readers announce images to blind users by reading the alt attribute. Without it, users hear only the filename or nothing at all.',
    who: 'People who are blind or have low vision.',
    before: '<img src="chart.png">',
    after:  '<img src="chart.png" alt="Bar chart showing monthly sales from Jan–Dec 2024">',
    explain: 'Add a concise, descriptive alt attribute. Use alt="" for decorative images.'
  },
  'color-contrast': {
    why: 'Low contrast makes text hard to read for people with low vision or colour blindness.',
    who: 'People with low vision, colour blindness, or who use screens in bright environments.',
    before: '<p style="color:#aaa; background:#fff">Light grey text</p>',
    after:  '<p style="color:#374151; background:#fff">Dark text — contrast ratio ≥ 4.5:1</p>',
    explain: 'Increase the difference between the text colour and background. Use the Colour Contrast Checker tool above.'
  },
  'heading-order': {
    why: 'Screen-reader users navigate pages by headings. Skipping levels (e.g. h1 → h3) breaks the logical structure.',
    who: 'Screen-reader users and keyboard-only users.',
    before: '<h1>Page Title</h1>\n<h3>Section</h3>  <!-- skipped h2 -->',
    after:  '<h1>Page Title</h1>\n<h2>Section</h2>',
    explain: 'Use headings in sequential order. Never skip levels.'
  },
  'label': {
    why: 'Form inputs without labels are not announced correctly by screen readers.',
    who: 'Blind users and screen-reader users.',
    before: '<input type="email" placeholder="Email">',
    after:  '<label for="email">Email address</label>\n<input type="email" id="email" placeholder="you@example.com">',
    explain: 'Link each input to a visible label using matching for/id attributes. As a fallback use aria-label.'
  },
  'button-name': {
    why: 'Buttons without accessible names are announced as "button" only — users cannot tell what they do.',
    who: 'Screen-reader and voice-control users.',
    before: '<button><img src="close.png"></button>',
    after:  '<button aria-label="Close dialog"><img src="close.png" alt=""></button>',
    explain: 'Add visible text, an aria-label, or an aria-labelledby to every button.'
  },
  'link-name': {
    why: 'Generic link text like "click here" does not tell users where the link goes.',
    who: 'Screen-reader users who navigate by links.',
    before: '<a href="/report">Click here</a>',
    after:  '<a href="/report">Download accessibility report</a>',
    explain: 'Use descriptive link text that makes sense out of context.'
  },
  'html-has-lang': {
    why: 'Without a language declaration, screen readers may use the wrong language voice or pronunciation.',
    who: 'All screen-reader users.',
    before: '<html>',
    after:  '<html lang="en">',
    explain: 'Set the lang attribute on the root <html> element to the page\'s primary language code.'
  },
  'document-title': {
    why: 'The page title is the first thing screen readers announce. Missing titles disorient users.',
    who: 'Screen-reader users and all users with many browser tabs.',
    before: '<title></title>',
    after:  '<title>Contact Us – My Company Website</title>',
    explain: 'Write a unique, descriptive <title> for every page.'
  },
  'duplicate-id': {
    why: 'Duplicate IDs confuse aria-labelledby and other ARIA references.',
    who: 'Screen-reader users relying on ARIA relationships.',
    before: '<div id="banner">...</div>\n<div id="banner">...</div>',
    after:  '<div id="main-banner">...</div>\n<div id="promo-banner">...</div>',
    explain: 'Each id value must appear exactly once per page.'
  },
  'bypass': {
    why: 'Without a skip link, keyboard users must Tab through the entire navigation on every page.',
    who: 'Keyboard-only users and screen-reader users.',
    before: '<!-- no skip link -->',
    after:  '<a href="#main-content" class="skip-link">Skip to main content</a>',
    explain: 'Place a "Skip to main content" link as the very first focusable element on the page. It may be visually hidden until focused.'
  },
  'frame-title': {
    why: 'Screen readers cannot describe the purpose of an iframe without a title.',
    who: 'Screen-reader users.',
    before: '<iframe src="map.html"></iframe>',
    after:  '<iframe src="map.html" title="Interactive location map"></iframe>',
    explain: 'Add a title attribute to every <iframe> describing its purpose.'
  }
};

/* ── KEYBOARD CHECKLIST items ─────────────────────────────────── */
const KB_ITEMS = [
  { id:'tab',    title:'Tab key navigation',    desc:'Tab through all interactive elements (links, buttons, inputs). Every focusable element should receive visible focus.' },
  { id:'shift',  title:'Shift+Tab reverse navigation', desc:'Shift+Tab moves focus backwards. The order should stay logical.' },
  { id:'enter',  title:'Enter/Space activation', desc:'Links activate with Enter; buttons activate with Enter and Space.' },
  { id:'esc',    title:'Escape closes dialogs', desc:'Pressing Escape dismisses modals, popups, and menus and returns focus appropriately.' },
  { id:'focus',  title:'Visible focus indicator', desc:'Every focused element has a clearly visible focus ring or highlight — not just a colour change.' },
  { id:'order',  title:'Logical focus order',   desc:'Tab order follows the visual reading order and makes sense without seeing the page.' },
  { id:'trap',   title:'No keyboard traps',     desc:'Focus is never permanently trapped in a component — the user can always Tab away.' },
  { id:'menu',   title:'Dropdown/menu keyboard', desc:'Dropdown menus can be opened, navigated (Arrow keys), and closed (Escape) using only the keyboard.' },
  { id:'dialog', title:'Dialog keyboard access', desc:'When a dialog opens, focus moves inside it. Closing returns focus to the trigger element.' },
  { id:'form',   title:'Form keyboard completion', desc:'All form fields can be filled, selected, and submitted using only the keyboard.' },
  { id:'skip',   title:'"Skip to content" link', desc:'A "Skip to main content" link appears at the top (may be visually hidden until focused).' },
  { id:'img',    title:'Images keyboard-safe',   desc:'Images do not capture keyboard focus (unless interactive). Decorative images use alt="".' },
];

/* ── LEARNING HUB lessons ─────────────────────────────────────── */
const LESSONS = [
  {
    icon:'bi bi-universal-access', color:'#4f46e5', bg:'#eef2ff',
    title:'What is Web Accessibility?',
    content:`<p>Web accessibility means making websites usable by <strong>everyone</strong>, including people with disabilities. This includes people who are blind, deaf, have motor impairments, or have cognitive disabilities.</p>
<p>The <strong>Web Content Accessibility Guidelines (WCAG)</strong> are the international standard. They are organized around four principles:</p>
<ul>
  <li><strong>Perceivable</strong> – Information must be presentable in ways users can perceive (e.g. alt text for images).</li>
  <li><strong>Operable</strong> – UI components must be operable by all users (e.g. keyboard access).</li>
  <li><strong>Understandable</strong> – Information must be understandable (e.g. clear language, predictable navigation).</li>
  <li><strong>Robust</strong> – Content must work with assistive technologies (e.g. valid HTML, ARIA).</li>
</ul>
<p>WCAG 2.1 Level AA is the most commonly required standard in laws and regulations worldwide.</p>`
  },
  {
    icon:'bi bi-image', color:'#16a34a', bg:'#f0fdf4',
    title:'Text Alternatives for Images',
    content:`<p>Every meaningful image needs an <code>alt</code> attribute that describes its content. This lets screen readers announce the image to blind users.</p>
<ul>
  <li>✅ <strong>Informative image:</strong> <code>&lt;img src="chart.png" alt="Bar chart showing Q1 sales rose 20%"&gt;</code></li>
  <li>✅ <strong>Decorative image:</strong> <code>&lt;img src="divider.png" alt=""&gt;</code> — empty alt tells screen readers to skip it.</li>
  <li>❌ <strong>Missing alt:</strong> <code>&lt;img src="chart.png"&gt;</code> — screen reader reads the filename instead.</li>
</ul>
<p>Keep alt text concise and meaningful. Avoid starting with "Image of" or "Picture of".</p>`
  },
  {
    icon:'bi bi-palette', color:'#d97706', bg:'#fffbeb',
    title:'Colour Contrast',
    content:`<p>Text must have sufficient contrast against its background so people with low vision or colour blindness can read it.</p>
<table class="table table-sm table-bordered mt-2" style="font-size:.85rem">
  <thead><tr><th>Text type</th><th>WCAG AA</th><th>WCAG AAA</th></tr></thead>
  <tbody>
    <tr><td>Normal text</td><td>4.5 : 1</td><td>7 : 1</td></tr>
    <tr><td>Large text (18pt+ or 14pt bold)</td><td>3 : 1</td><td>4.5 : 1</td></tr>
  </tbody>
</table>
<p>Use the <strong>Colour Contrast Checker</strong> in DesignLens to test your colour combinations instantly.</p>`
  },
  {
    icon:'bi bi-keyboard', color:'#0284c7', bg:'#eff6ff',
    title:'Keyboard Accessibility',
    content:`<p>All functionality must be accessible using only a keyboard — no mouse required. This is essential for:</p>
<ul>
  <li>People with motor disabilities who cannot use a mouse.</li>
  <li>Screen-reader users who navigate via keyboard.</li>
  <li>Power users who prefer keyboard shortcuts.</li>
</ul>
<p><strong>Key rules:</strong></p>
<ul>
  <li>All interactive elements must be reachable by Tab.</li>
  <li>Focus must always be visible.</li>
  <li>No keyboard traps — users can always Tab away.</li>
  <li>Modals must trap focus inside (not let it go behind), and restore focus on close.</li>
</ul>`
  },
  {
    icon:'bi bi-input-cursor-text', color:'#7c3aed', bg:'#faf5ff',
    title:'Accessible Forms',
    content:`<p>Forms are one of the most common sources of accessibility problems. Follow these rules:</p>
<ul>
  <li>✅ Label every input with a visible <code>&lt;label&gt;</code> using matching <code>for</code>/<code>id</code>.</li>
  <li>✅ Use <code>aria-required="true"</code> or the HTML <code>required</code> attribute for mandatory fields.</li>
  <li>✅ Show clear error messages next to the affected field — not just a colour change.</li>
  <li>✅ Group related controls (e.g. radio buttons) in a <code>&lt;fieldset&gt;</code> with a <code>&lt;legend&gt;</code>.</li>
  <li>❌ Do not use placeholder text as the only label — it disappears on typing.</li>
</ul>`
  },
  {
    icon:'bi bi-text-indent-left', color:'#0f766e', bg:'#f0fdfa',
    title:'Headings and Page Structure',
    content:`<p>Headings (<code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code>) create an outline of your page that screen-reader users rely on for navigation.</p>
<ul>
  <li>Use only <strong>one H1</strong> per page — the main topic.</li>
  <li>Use headings in <strong>sequential order</strong> — never skip from H1 to H3.</li>
  <li>Use headings to structure content, not to change font size (use CSS for that).</li>
  <li>Use <strong>landmark elements</strong>: <code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;footer&gt;</code>.</li>
</ul>`
  },
  {
    icon:'bi bi-link-45deg', color:'#b45309', bg:'#fffbeb',
    title:'Links and Buttons',
    content:`<p>Links and buttons must have <strong>accessible names</strong> that clearly describe their purpose.</p>
<ul>
  <li>❌ Bad: <code>&lt;a href="/report"&gt;Click here&lt;/a&gt;</code></li>
  <li>✅ Good: <code>&lt;a href="/report"&gt;Download accessibility report&lt;/a&gt;</code></li>
  <li>Use <code>&lt;button&gt;</code> for actions (submit, open menu) and <code>&lt;a&gt;</code> for navigation.</li>
  <li>Icon-only buttons need <code>aria-label</code>: <code>&lt;button aria-label="Close"&gt;&lt;i ...&gt;&lt;/i&gt;&lt;/button&gt;</code></li>
</ul>`
  },
  {
    icon:'bi bi-code-slash', color:'#6d28d9', bg:'#f5f3ff',
    title:'Semantic HTML & ARIA',
    content:`<p>Use the right HTML element for the job. Semantic HTML communicates meaning to browsers, assistive technologies, and search engines.</p>
<ul>
  <li>✅ Use <code>&lt;button&gt;</code> for buttons — not <code>&lt;div onclick&gt;</code>.</li>
  <li>✅ Use <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;header&gt;</code>, <code>&lt;footer&gt;</code> for page regions.</li>
  <li>✅ Use <code>&lt;ul&gt;</code>/<code>&lt;ol&gt;</code> for lists.</li>
  <li>ARIA attributes (<code>aria-label</code>, <code>aria-expanded</code>, <code>role</code>) supplement HTML when native semantics are insufficient.</li>
  <li><strong>First rule of ARIA:</strong> Don't use ARIA if native HTML can do the job.</li>
</ul>`
  }
];

/* ══════════════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════════════ */
function esc(str) {
  return String(str||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}); }
  catch { return iso||''; }
}
function scoreColor(s) {
  if (s>=80) return '#16a34a';
  if (s>=50) return '#d97706';
  return '#dc2626';
}
function scoreClass(s) {
  if (s>=80) return 'score-good';
  if (s>=50) return 'score-ok';
  return 'score-bad';
}

/* ── Accessibility score formula ─────────────────────────────── */
function calcScore(data) {
  if (!data) return 0;
  const c = data.severityCounts || {};
  const penalty = (c.critical||0)*10 + (c.serious||0)*5 + (c.moderate||0)*2 + (c.minor||0)*1;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

/* ══════════════════════════════════════════════════════════════
   HISTORY (localStorage)
══════════════════════════════════════════════════════════════ */
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('dl_history')||'[]'); } catch { return []; }
}
function saveHistory() {
  try { localStorage.setItem('dl_history', JSON.stringify(scanHistory)); } catch {}
}
function pushHistory(scan) {
  const entry = {
    id:              Date.now().toString(),
    url:             scan.url,
    scannedAt:       scan.scannedAt,
    durationMs:      scan.durationMs || 0,
    score:           calcScore(scan),
    totalIssues:     scan.totalIssues,
    severityCounts:  scan.severityCounts,
    totalViolations: scan.totalViolations,
    passes:          scan.passes || 0,
    incomplete:      scan.incomplete || 0,
    formCount:       scan.formCount || 0,
    headings:        (scan.headings || []).slice(0, 80),
    images:          (scan.images || []).slice(0, 80),
    issues: (scan.issues || []).map(i => ({
      id:               i.id,
      name:             i.name,
      description:      i.description || '',
      helpUrl:          i.helpUrl || '',
      tags:             i.tags || [],
      severity:         i.severity,
      severityLabel:    i.severityLabel || i.severity,
      affectedCount:    i.affectedCount,
      suggestion:       i.suggestion || '',
      affectedElements: (i.affectedElements || []).slice(0, 3)
    }))
  };
  scanHistory.unshift(entry);
  if (scanHistory.length > 15) scanHistory = scanHistory.slice(0, 15);
  saveHistory();
}

/* ══════════════════════════════════════════════════════════════
   SPA NAVIGATION
══════════════════════════════════════════════════════════════ */
const PAGE_TITLES = {
  home:'Dashboard', scan:'Scan Website', issues:'Issue Explorer',
  fix:'Smart Fix Assistant', contrast:'Colour Contrast Checker',
  alttext:'Alt-Text Analyzer', keyboard:'Keyboard Checklist',
  headings:'Heading Structure', forms:'Form Checker',
  history:'Scan History', compare:'Before & After', learning:'Learning Hub'
};

function navigateTo(pageId) {
  // hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => { a.classList.remove('active'); a.removeAttribute('aria-current'); });

  const page = document.getElementById('page-'+pageId);
  if (!page) return;
  page.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) { navItem.classList.add('active'); navItem.setAttribute('aria-current','page'); }

  document.getElementById('topbarTitle').textContent = PAGE_TITLES[pageId]||pageId;

  // On mobile close sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');

  // Refresh data-driven pages
  if (pageId==='issues')   renderIssueExplorer();
  if (pageId==='fix')      renderFixAssistant();
  if (pageId==='alttext')  renderAltText();
  if (pageId==='headings') renderHeadings();
  if (pageId==='forms')    renderForms();
  if (pageId==='history')  renderHistory();
  if (pageId==='compare')  renderCompareSelects();
  if (pageId==='learning') renderLearning();
  if (pageId==='keyboard') renderKeyboardChecklist();

  // Focus main content for accessibility
  document.getElementById('main-content').focus();
}

// Delegate clicks & keyboard activation on data-page buttons/links/cards
document.addEventListener('click', e => {
  const target = e.target.closest('[data-page]');
  if (target) { e.preventDefault(); navigateTo(target.dataset.page); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target.closest('[data-page]');
  if (target && target.tagName !== 'BUTTON' && target.tagName !== 'A') {
    e.preventDefault();
    navigateTo(target.dataset.page);
  }
});

/* ── Sidebar toggle ───────────────────────────────────────────── */
document.getElementById('sidebarOpen').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
  document.getElementById('sidebarOpen').setAttribute('aria-expanded','true');
});
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
  document.getElementById('sidebarOpen').setAttribute('aria-expanded','false');
}
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

/* ── Dark/light theme ─────────────────────────────────────────── */
(function initTheme() {
  const saved = localStorage.getItem('dl_theme')||'light';
  applyTheme(saved);
})();
document.getElementById('themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme')||'light';
  applyTheme(cur==='light'?'dark':'light');
});
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('dl_theme', t);
  const icon  = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (t==='dark') { icon.className='bi bi-sun-fill'; label.textContent='Light Mode'; }
  else             { icon.className='bi bi-moon-fill'; label.textContent='Dark Mode'; }
}

/* ── Reduced motion controller (overrides system setting) ─────── */
const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
function isReducedMotion() {
  const manual = localStorage.getItem('dl_reduced_motion');
  if (manual === 'true') return true;
  if (manual === 'false') return false;
  return motionMedia.matches;
}
function applyReducedMotion(reduced, persist = true) {
  if (persist) localStorage.setItem('dl_reduced_motion', String(reduced));
  document.documentElement.setAttribute('data-reduced-motion', String(reduced));
  const btn   = document.getElementById('motionToggle');
  const icon  = document.getElementById('motionIcon');
  const label = document.getElementById('motionLabel');
  if (btn)   btn.setAttribute('aria-pressed', String(reduced));
  if (icon)  icon.className = reduced ? 'bi bi-pause-circle-fill' : 'bi bi-stars';
  if (label) label.textContent = reduced ? 'Motion: Off' : 'Motion: On';
  if (reduced) {
    document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-visible'));
  }
}
(function initMotion() {
  const manual = localStorage.getItem('dl_reduced_motion');
  if (manual !== null) applyReducedMotion(manual === 'true', false);
  else applyReducedMotion(motionMedia.matches, false);
  motionMedia.addEventListener('change', e => {
    if (localStorage.getItem('dl_reduced_motion') === null) {
      applyReducedMotion(e.matches, false);
    }
  });
})();
document.getElementById('motionToggle').addEventListener('click', () => {
  applyReducedMotion(!isReducedMotion(), true);
});

/* ── Scroll reveal (IntersectionObserver, triggered once) ─────── */
function initScrollReveals() {
  const els = document.querySelectorAll('.reveal-on-scroll');
  if (isReducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const obs = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.style.willChange = 'transform, opacity';
      el.classList.add('is-visible');
      el.addEventListener('transitionend', () => { el.style.willChange = 'auto'; }, { once: true });
      observer.unobserve(el);
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}
initScrollReveals();

/* ── rAF Number Count-Up ──────────────────────────────────────── */
function animateCount(el, target, duration = 550) {
  if (!el) return;
  const end = Number(target) || 0;
  if (isReducedMotion() || end === 0) {
    el.textContent = String(end);
    return;
  }
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(eased * end));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════════════════════
   SCAN ENGINE
══════════════════════════════════════════════════════════════ */
let stepTimerId = null;

function startLoadingSteps(ids) {
  const steps = ids.map(id => document.getElementById(id)).filter(Boolean);
  const fill = document.getElementById('scanProgressFill');
  const scales = [0.22, 0.48, 0.75, 0.92];
  steps.forEach(s => { s.className='step'; });
  if (!steps.length) return;
  steps[0].classList.add('active');
  if (fill) fill.style.transform = `scaleX(${scales[0]})`;
  let i = 0;
  const intervals = [1200, 2200, 3500];
  function advance() {
    if (i < steps.length-1) {
      steps[i].classList.replace('active','done');
      i++;
      steps[i].classList.add('active');
      if (fill) fill.style.transform = `scaleX(${scales[i] || 0.92})`;
      if (i < intervals.length) stepTimerId = setTimeout(advance, intervals[i]);
    }
  }
  stepTimerId = setTimeout(advance, intervals[0]);
}
function stopLoadingSteps(ids) {
  clearTimeout(stepTimerId);
  const fill = document.getElementById('scanProgressFill');
  if (fill) fill.style.transform = 'scaleX(1)';
  ids.forEach(id => { const el=document.getElementById(id); if(el) el.classList.add('done'); });
}
function setBtn(btn, loading) {
  btn.disabled = loading;
  btn.querySelector('.btn-text').classList.toggle('d-none', loading);
  btn.querySelector('.btn-loading').classList.toggle('d-none', !loading);
}
function showFormError(errId, msg) {
  const el = document.getElementById(errId);
  if (!el) return;
  el.textContent = msg; el.classList.remove('d-none');
}
function clearFormError(errId) {
  const el = document.getElementById(errId);
  if (el) { el.textContent=''; el.classList.add('d-none'); }
}

async function doScan(url, btnId, errId, loadingId, stepIds) {
  clearFormError(errId);
  url = url.trim();

  if (!url) { showFormError(errId,'Please enter a URL to analyze.'); return; }
  let parsed;
  try { parsed = new URL(url); } catch { showFormError(errId,'Invalid URL — include https://'); return; }
  if (!['http:','https:'].includes(parsed.protocol)) { showFormError(errId,'Only http:// and https:// are supported.'); return; }

  const btn = document.getElementById(btnId);
  setBtn(btn, true);
  if (loadingId) {
    document.getElementById(loadingId).classList.remove('d-none');
    const lurl = document.getElementById('scanLoadingUrl');
    if (lurl) lurl.textContent = url;
  }
  if (stepIds) startLoadingSteps(stepIds);

  try {
    const res = await fetch('/api/analyze', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({url})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error||'Scan failed');
    currentScan = data;
    allIssues   = data.issues||[];
    pushHistory(data);

    if (loadingId) document.getElementById(loadingId).classList.add('d-none');
    if (stepIds) stopLoadingSteps(stepIds);
    setBtn(btn, false);

    // Always show results on scan page
    navigateTo('scan');
    renderScanResults(data);
  } catch(err) {
    if (loadingId) document.getElementById(loadingId).classList.add('d-none');
    if (stepIds) stopLoadingSteps(stepIds);
    setBtn(btn, false);
    showFormError(errId, err.message||'Scan failed. Please try again.');
  }
}

/* ── Hero form ───────────────────────────────────────────────── */
document.getElementById('heroScanForm').addEventListener('submit', e => {
  e.preventDefault();
  const url = document.getElementById('heroUrlInput').value;
  navigateTo('scan');
  document.getElementById('scanUrlInput').value = url;
  doScan(url, 'scanBtn', 'scanUrlErr', 'scanLoading', ['ls1','ls2','ls3','ls4']);
});

/* ── Scan page form ───────────────────────────────────────────── */
document.getElementById('scanForm').addEventListener('submit', e => {
  e.preventDefault();
  const url = document.getElementById('scanUrlInput').value;
  doScan(url, 'scanBtn', 'scanUrlErr', 'scanLoading', ['ls1','ls2','ls3','ls4']);
});

/* ── New scan / re-scan buttons ──────────────────────────────── */
document.getElementById('newScanBtn2').addEventListener('click', () => {
  document.getElementById('scanResults').classList.add('d-none');
  document.getElementById('scanUrlInput').value='';
  document.getElementById('scanUrlInput').focus();
});

/* ═══════════════════════════════════════════════════════════════
   RENDER: SCAN RESULTS DASHBOARD
═══════════════════════════════════════════════════════════════ */
let severityChart = null;

function renderScanResults(data) {
  const resultsEl = document.getElementById('scanResults');
  resultsEl.classList.remove('d-none', 'panel-crossfade');
  void resultsEl.offsetWidth; // restart crossfade
  resultsEl.classList.add('panel-crossfade');
  resultsEl.scrollIntoView({ behavior: isReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  resultsEl.focus({ preventScroll: true });

  // Header
  const urlEl = document.getElementById('resultUrl');
  urlEl.textContent = data.url; urlEl.href = data.url;
  document.getElementById('resultMeta').textContent =
    `Scanned: ${fmtDate(data.scannedAt)} · ${data.durationMs ? (data.durationMs/1000).toFixed(1)+'s' : ''}`;

  // Score
  const score = calcScore(data);
  animateCount(document.getElementById('scoreNum'), score, 600);
  const arc = document.getElementById('scoreArc');
  const circumference = 213.6;
  arc.style.strokeDashoffset = circumference - (score/100)*circumference;
  arc.style.stroke = scoreColor(score);

  // Counts (rAF count-up)
  const c = data.severityCounts||{};
  animateCount(document.getElementById('totalCount'), data.totalIssues||0);
  animateCount(document.getElementById('criticalCount'), c.critical||0);
  animateCount(document.getElementById('seriousCount'), c.serious||0);
  animateCount(document.getElementById('moderateCount'), c.moderate||0);

  // Chart
  buildSeverityChart(c);

  // Pass summary
  const ps = document.getElementById('passSummary');
  ps.innerHTML = [
    {num:data.totalViolations||0, label:'Rule Violations', color:'#dc2626'},
    {num:data.passes||0,          label:'Rules Passed',    color:'#16a34a'},
    {num:data.incomplete||0,      label:'Needs Review',    color:'#d97706'},
    {num:c.minor||0,              label:'Minor Issues',    color:'#2563eb'}
  ].map((s,idx)=>`<div class="col-6"><div class="pass-stat stagger-item" style="--stagger-i:${idx}">
    <div class="pass-stat-num" style="color:${s.color}" data-count="${s.num}">${s.num}</div>
    <div class="pass-stat-label">${s.label}</div>
  </div></div>`).join('');
  ps.querySelectorAll('.pass-stat-num[data-count]').forEach(el => {
    animateCount(el, Number(el.dataset.count), 500);
  });

  // Fast-mode banner
  const existingBanner = document.getElementById('fastModeBanner');
  if (existingBanner) existingBanner.remove();
  if (data.isLargePage && data.rulesMode === 'fast') {
    const banner = document.createElement('div');
    banner.id = 'fastModeBanner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = [
      'margin:0.75rem 0',
      'padding:0.65rem 1rem',
      'border-radius:8px',
      'background:linear-gradient(135deg,#1e3a5f 0%,#1a2e4a 100%)',
      'border:1px solid #2563eb55',
      'color:#93c5fd',
      'font-size:0.84rem',
      'display:flex',
      'align-items:center',
      'gap:0.5rem',
      'line-height:1.4'
    ].join(';');
    const icon = document.createElement('span');
    icon.textContent = '⚡';
    icon.setAttribute('aria-hidden', 'true');
    const msg = document.createElement('span');
    msg.textContent = `Fast Mode — Page has ${data.elementCount.toLocaleString()} elements. `
      + `20 core WCAG rules were checked (colour-contrast & ARIA attribute rules skipped for speed). `
      + `Scan a specific sub-page for a full report.`;
    banner.appendChild(icon);
    banner.appendChild(msg);
    // Insert before passSummary
    const psParent = document.getElementById('passSummary').parentElement;
    psParent.insertBefore(banner, document.getElementById('passSummary'));
  }

  // Update home last-scan
  updateLastScanHome(data);
}

function buildSeverityChart(c) {
  const ctx = document.getElementById('severityChart').getContext('2d');
  const vals = [c.critical||0, c.serious||0, c.moderate||0, c.minor||0];
  const total = vals.reduce((a,b)=>a+b,0);
  const colors = ['#dc2626','#ea580c','#ca8a04','#2563eb'];
  const labels = ['Critical','Serious','Moderate','Minor'];

  if (severityChart) severityChart.destroy();
  severityChart = new Chart(ctx, {
    type:'doughnut',
    data: {
      labels,
      datasets:[{
        data: total===0?[1]:vals,
        backgroundColor: total===0?['#e2e8f0']:colors,
        borderWidth:2, borderColor:'var(--bg-card)', hoverBorderWidth:3
      }]
    },
    options:{
      cutout:'65%',
      plugins:{
        legend:{display:false},
        tooltip:{enabled:total>0, callbacks:{label:c=>` ${c.label}: ${c.parsed}`}}
      },
      animation: isReducedMotion() ? false : { animateScale: true, animateRotate: true, duration: 500 }
    }
  });

  document.getElementById('chartLegend').innerHTML = labels.map((l,i)=>
    `<span class="legend-dot" style="--dot-color:${colors[i]}">${l} (${vals[i]})</span>`
  ).join('');
}

/* ── PDF Download (print-window approach — no external CDN needed) ── */
document.getElementById('downloadPdfBtn').addEventListener('click', generatePdf);

function generatePdf() {
  if (!currentScan) {
    alert('No scan results to export. Please scan a website first.');
    return;
  }

  // Must be declared before any template literal that calls it
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const score  = calcScore(currentScan);
  const c      = currentScan.severityCounts || {};
  const issues = currentScan.issues || [];
  const scoreCol = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';

  const sevColor = { critical:'#dc2626', serious:'#ea580c', moderate:'#ca8a04', minor:'#2563eb' };

  // Build issue rows
  const issueRows = issues.map((issue, i) => {
    const col = sevColor[issue.severity] || '#2563eb';
    const els = (issue.affectedElements || []).slice(0, 2)
      .map(el => el.html
        ? `<div style="font-family:monospace;font-size:11px;background:#f1f5f9;border:1px solid #e2e8f0;
              border-radius:4px;padding:4px 8px;margin-top:4px;word-break:break-all;">${escHtml(el.html)}</div>`
        : '')
      .join('');
    return `
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:12px;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:800;background:${col}18;color:${col};
            border:1px solid ${col}44;border-radius:100px;padding:2px 10px;white-space:nowrap;">
            ${escHtml(issue.severityLabel || issue.severity)}
          </span>
          <strong style="font-size:14px;">${i + 1}. ${escHtml(issue.name || issue.id)}</strong>
          <span style="margin-left:auto;font-size:12px;color:#64748b;">${issue.affectedCount || 1} element(s)</span>
        </div>
        <p style="font-size:12px;color:#475569;margin:0 0 6px;">${escHtml(issue.description)}</p>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:8px 10px;font-size:12px;">
          <strong style="color:#16a34a;">Fix:</strong> ${escHtml(issue.suggestion)}
        </div>
        ${els}
      </div>`;
  }).join('');

  // Build heading outline
  const hdgRows = (currentScan.headings || []).map(h =>
    `<div style="padding:3px 0 3px ${(h.level - 1) * 18}px;font-size:12px;">
      <span style="color:#94a3b8;font-weight:700;min-width:28px;display:inline-block;">H${h.level}</span>
      ${escHtml(h.text || '(empty)')}
    </div>`
  ).join('');

  // Build alt-text summary
  const imgs      = currentScan.images || [];
  const hasAlt    = imgs.filter(i => i.status === 'has-alt').length;
  const emptyAlt  = imgs.filter(i => i.status === 'empty-alt').length;
  const missingAlt= imgs.filter(i => i.status === 'missing-alt').length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>DesignLens Report – ${escHtml(currentScan.url)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 32px; font-size: 13px; line-height: 1.6; }
    h1  { font-size: 22px; color: #fff; }
    h2  { font-size: 16px; font-weight: 700; margin: 20px 0 10px; color: #1e293b; }
    h3  { font-size: 13px; font-weight: 700; margin: 14px 0 6px; color: #334155; }
    .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; color: #fff; }
    .header-url { font-size: 12px; opacity: .85; word-break: break-all; margin-top: 4px; }
    .header-meta { font-size: 11px; opacity: .7; margin-top: 2px; }
    .score-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
    .score-badge { font-size: 28px; font-weight: 900; color: ${scoreCol}; background: #fff; border-radius: 8px; padding: 4px 14px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .metric { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .metric-num  { font-size: 22px; font-weight: 800; }
    .metric-label{ font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .4px; }
    .section { margin-bottom: 24px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }
    .summary-box  { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .summary-box dt{ font-size: 11px; color: #64748b; }
    .summary-box dd{ font-size: 15px; font-weight: 700; margin: 0; }
    .note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #92400e; margin-top: 20px; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.5cm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 DesignLens Accessibility Report</h1>
    <div class="header-url">${escHtml(currentScan.url)}</div>
    <div class="header-meta">Scanned: ${fmtDate(currentScan.scannedAt)}
      ${currentScan.durationMs ? ' · Duration: ' + (currentScan.durationMs/1000).toFixed(1) + 's' : ''}
    </div>
    <div class="score-row">
      <div class="score-badge">${score}</div>
      <span style="font-size:13px;opacity:.85;">/ 100 Accessibility Score</span>
    </div>
  </div>

  <div class="metrics">
    <div class="metric">
      <div class="metric-num" style="color:#dc2626">${c.critical || 0}</div>
      <div class="metric-label">Critical</div>
    </div>
    <div class="metric">
      <div class="metric-num" style="color:#ea580c">${c.serious || 0}</div>
      <div class="metric-label">Serious</div>
    </div>
    <div class="metric">
      <div class="metric-num" style="color:#ca8a04">${c.moderate || 0}</div>
      <div class="metric-label">Moderate</div>
    </div>
    <div class="metric">
      <div class="metric-num" style="color:#2563eb">${c.minor || 0}</div>
      <div class="metric-label">Minor</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-box"><dt>Total Issues</dt><dd>${currentScan.totalIssues || 0}</dd></div>
    <div class="summary-box"><dt>Rule Violations</dt><dd>${currentScan.totalViolations || 0}</dd></div>
    <div class="summary-box"><dt>Rules Passed</dt><dd style="color:#16a34a">${currentScan.passes || 0}</dd></div>
    <div class="summary-box"><dt>Needs Manual Review</dt><dd style="color:#d97706">${currentScan.incomplete || 0}</dd></div>
  </div>

  <hr class="divider"/>

  <div class="section">
    <h2>Accessibility Violations (${issues.length})</h2>
    ${issues.length ? issueRows : '<p style="color:#64748b">No violations detected by axe-core.</p>'}
  </div>

  ${currentScan.headings && currentScan.headings.length ? `
  <hr class="divider"/>
  <div class="section">
    <h2>Heading Structure</h2>
    ${hdgRows}
  </div>` : ''}

  ${imgs.length ? `
  <hr class="divider"/>
  <div class="section">
    <h2>Image Alt-Text Summary</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div class="metric" style="flex:1;min-width:100px;border-color:#86efac">
        <div class="metric-num" style="color:#16a34a">${hasAlt}</div><div class="metric-label">Has Alt</div>
      </div>
      <div class="metric" style="flex:1;min-width:100px;border-color:#bfdbfe">
        <div class="metric-num" style="color:#2563eb">${emptyAlt}</div><div class="metric-label">Decorative</div>
      </div>
      <div class="metric" style="flex:1;min-width:100px;border-color:#fecaca">
        <div class="metric-num" style="color:#dc2626">${missingAlt}</div><div class="metric-label">Missing Alt</div>
      </div>
      <div class="metric" style="flex:1;min-width:100px">
        <div class="metric-num">${imgs.length}</div><div class="metric-label">Total Images</div>
      </div>
    </div>
  </div>` : ''}

  <hr class="divider"/>
  <div class="note">
    <strong>⚠️ Important:</strong> This report is <strong>NOT</strong> a certification of WCAG compliance.
    Automated testing identifies common accessibility barriers only. Manual testing by people with
    disabilities is also required for a thorough accessibility evaluation.
    Score formula: 100 − (Critical×10 + Serious×5 + Moderate×2 + Minor×1), minimum 0.
  </div>
</body>
</html>`;

  // Open in a new window and trigger print/save-as-PDF
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Pop-ups are blocked. Please allow pop-ups for this site and try again.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  // Give the browser time to render before showing print dialog
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  };
  // Fallback if onload already fired
  setTimeout(() => {
    if (!win.closed) { win.focus(); win.print(); }
  }, 1200);
}

/* ══════════════════════════════════════════════════════════════
   RENDER: ISSUE EXPLORER
══════════════════════════════════════════════════════════════ */
function renderIssueExplorer() {
  if (!currentScan) { showEmpty('issues'); return; }
  document.getElementById('issuesNoScan').classList.add('d-none');
  document.getElementById('issuesContent').classList.remove('d-none');
  applyIssueFilters();
}

function showEmpty(page) {
  const noScanEl = document.getElementById(`${page}NoScan`);
  const contentEl = document.getElementById(`${page}Content`);
  if (noScanEl) noScanEl.classList.remove('d-none');
  if (contentEl) contentEl.classList.add('d-none');
}

function applyIssueFilters() {
  if (!currentScan) { showEmpty('issues'); return; }

  const container = document.getElementById('issuesList');
  const countEl = document.getElementById('issuesResultCount');
  const noFilteredEl = document.getElementById('noFilteredIssues');

  if (!allIssues.length) {
    countEl.textContent = '0 violations detected';
    noFilteredEl.classList.add('d-none');
    container.innerHTML = `<div class="empty-state" style="border-color:#86efac">
      <i class="bi bi-check-circle fs-1 text-success d-block mb-2" aria-hidden="true"></i>
      <h3>No accessibility violations detected!</h3>
      <p>axe-core found no automated WCAG 2.1 AA violations on this page.</p>
    </div>`;
    return;
  }

  const q       = (document.getElementById('issueSearch')||{value:''}).value.toLowerCase();
  const filter  = document.querySelector('#page-issues .filter-btn.active')?.dataset.filter||'all';
  const sort    = document.getElementById('sortSelect')?.value||'severity-desc';
  const sevOrder= {critical:0,serious:1,moderate:2,minor:3};

  let list = [...allIssues];
  if (filter!=='all') list = list.filter(i=>(i.severity||'minor')===filter);
  if (q) list = list.filter(i=>(i.name||'').toLowerCase().includes(q)||(i.description||'').toLowerCase().includes(q)||(i.id||'').toLowerCase().includes(q));

  list.sort((a,b) => {
    if (sort==='severity-desc') return (sevOrder[a.severity]||3)-(sevOrder[b.severity]||3);
    if (sort==='severity-asc')  return (sevOrder[b.severity]||3)-(sevOrder[a.severity]||3);
    if (sort==='count-desc')    return (b.affectedCount||0)-(a.affectedCount||0);
    if (sort==='name-asc')      return (a.name||'').localeCompare(b.name||'');
    return 0;
  });

  countEl.textContent = `Showing ${list.length} of ${allIssues.length} violation${allIssues.length!==1?'s':''}`;

  if (!list.length) {
    container.innerHTML='';
    noFilteredEl.classList.remove('d-none');
    return;
  }
  noFilteredEl.classList.add('d-none');

  container.innerHTML = list.map((issue,idx)=>buildIssueCard(issue,idx)).join('');
  attachIssueCardListeners(container);
}

// Filter/search/sort listeners
document.getElementById('issueSearch').addEventListener('input', applyIssueFilters);
document.getElementById('sortSelect').addEventListener('change', applyIssueFilters);
document.querySelectorAll('#page-issues .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#page-issues .filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    applyIssueFilters();
  });
});

function issueMarkKey(id) {
  const scope = currentScan?.url || 'default';
  return `dl_fixed_${scope}_${id}`;
}

function buildIssueCard(issue, idx) {
  const sev = (issue.severity||'minor').toLowerCase();
  const tags = (issue.tags||[]).filter(t=>t.startsWith('wcag')||t==='best-practice').slice(0,5);
  const els = (issue.affectedElements||[]).slice(0,3);
  const extra = (issue.affectedCount||0) - els.length;
  const markedKey = issueMarkKey(issue.id);
  const isMarked = sessionStorage.getItem(markedKey)==='1';

  return `<div class="issue-card stagger-item${isMarked?' opacity-50':''}" style="--stagger-i:${idx}" data-severity="${sev}" role="article" data-issue-id="${issue.id}">
    <div class="issue-card-header" tabindex="0" role="button" aria-expanded="false" aria-controls="ib-${idx}">
      <span class="severity-badge severity-${sev}">${esc(issue.severityLabel||sev)}</span>
      <span class="issue-title">${esc(issue.name||issue.id)}</span>
      <span class="issue-count-badge" title="Affected elements">${issue.affectedCount||1}</span>
      ${isMarked?'<span class="badge bg-success" aria-label="Marked as reviewed">✓ Reviewed</span>':''}
      <i class="bi bi-chevron-down issue-chevron" aria-hidden="true"></i>
    </div>
    <div class="issue-card-body" id="ib-${idx}"><div class="accordion-inner">
      <p class="issue-description">${esc(issue.description)}</p>
      ${tags.length?`<div class="wcag-tags">${tags.map(t=>`<span class="wcag-tag">${esc(t)}</span>`).join('')}</div>`:''}
      <div class="fix-suggestion">
        <strong><i class="bi bi-lightbulb me-1" aria-hidden="true"></i>How to Fix:</strong>
        ${esc(issue.suggestion||'')}
      </div>
      ${els.length?`<p class="affected-elements-title">Affected Elements</p>
        ${els.map(el=>`<div class="element-snippet">${esc(el.html||el.target||'')}</div>
          ${el.failureSummary?`<p style="font-size:.78rem;color:var(--text-muted)">${esc(el.failureSummary)}</p>`:''}`).join('')}
        ${extra>0?`<p class="text-muted" style="font-size:.78rem">…and ${extra} more element(s).</p>`:''}
      `:''}
      <div class="d-flex align-items-center gap-2 mt-2 flex-wrap">
        ${issue.helpUrl?`<a href="${esc(issue.helpUrl)}" target="_blank" rel="noopener noreferrer" class="learn-more-link">
          <i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>axe-core docs</a>`:''}
        <button class="fix-status-btn${isMarked?' marked':''}" data-mark="${issue.id}" aria-pressed="${isMarked}">
          ${isMarked?'✓ Marked as Reviewed':'Mark as Reviewed'}
        </button>
      </div>
    </div></div>
  </div>`;
}

function attachIssueCardListeners(container) {
  container.querySelectorAll('.issue-card-header').forEach(h => {
    h.addEventListener('click', () => toggleCard(h.closest('.issue-card'), h));
    h.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();h.click();} });
  });
  container.querySelectorAll('[data-mark]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.mark;
      const key = issueMarkKey(id);
      const was = sessionStorage.getItem(key)==='1';
      sessionStorage.setItem(key, was?'0':'1');
      applyIssueFilters(); // re-render
    });
  });
}

function toggleCard(card, header) {
  card.classList.toggle('open');
  header.setAttribute('aria-expanded', card.classList.contains('open').toString());
}

/* ══════════════════════════════════════════════════════════════
   RENDER: SMART FIX ASSISTANT
══════════════════════════════════════════════════════════════ */
function renderFixAssistant() {
  if (!currentScan) {
    document.getElementById('fixNoScan').classList.remove('d-none');
    document.getElementById('fixContent').classList.add('d-none');
    return;
  }
  document.getElementById('fixNoScan').classList.add('d-none');
  document.getElementById('fixContent').classList.remove('d-none');

  const list = document.getElementById('fixList');
  if (!allIssues.length) {
    list.innerHTML = '<div class="empty-state"><i class="bi bi-emoji-smile fs-1 text-success d-block mb-2" aria-hidden="true"></i><h3>No violations found!</h3><p>axe-core found no detectable accessibility issues on this page.</p></div>';
    return;
  }

  list.innerHTML = allIssues.map((issue,idx) => {
    const g = FIX_GUIDANCE[issue.id]||null;
    const sev = (issue.severity||'minor').toLowerCase();
    return `<div class="fix-card stagger-item" style="--stagger-i:${idx}" role="article">
      <div class="fix-card-header" tabindex="0" role="button" aria-expanded="false">
        <span class="severity-badge severity-${sev}">${esc(issue.severityLabel||sev)}</span>
        <span style="font-weight:600;flex:1">${esc(issue.name||issue.id)}</span>
        <i class="bi bi-chevron-down issue-chevron" aria-hidden="true"></i>
      </div>
      <div class="fix-card-body"><div class="accordion-inner">
        ${g?`
          <p class="mt-2"><strong>Why it matters:</strong> ${esc(g.why)}</p>
          <p><strong>Who is affected:</strong> ${esc(g.who)}</p>
          <div class="code-block-wrap">
            <div class="code-block-label bad">❌ Before (problematic)</div>
            <pre class="code-block">${esc(g.before)}</pre>
            <button class="copy-btn" data-code="${esc(g.before)}" aria-label="Copy bad example">Copy</button>
          </div>
          <div class="code-block-wrap">
            <div class="code-block-label good">✅ After (accessible)</div>
            <pre class="code-block">${esc(g.after)}</pre>
            <button class="copy-btn" data-code="${esc(g.after)}" aria-label="Copy fix code">Copy</button>
          </div>
          <div class="fix-suggestion mt-2">
            <strong><i class="bi bi-lightbulb me-1" aria-hidden="true"></i>Explanation:</strong> ${esc(g.explain)}
          </div>
        `:
        `<p class="mt-2 issue-description">${esc(issue.description)}</p>
         <div class="fix-suggestion"><strong>Suggestion:</strong> ${esc(issue.suggestion)}</div>`}
        ${issue.helpUrl?`<a href="${esc(issue.helpUrl)}" target="_blank" rel="noopener noreferrer" class="learn-more-link mt-2 d-inline-block">
          <i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>WCAG / axe-core docs</a>`:''}
      </div></div>
    </div>`;
  }).join('');

  // Toggle listeners
  list.querySelectorAll('.fix-card-header').forEach(h => {
    h.addEventListener('click', () => toggleCard(h.closest('.fix-card'), h));
    h.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();h.click();} });
  });

  // Copy buttons
  list.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(btn.dataset.code||'').then(() => {
        btn.textContent='Copied!'; btn.classList.add('copied');
        setTimeout(()=>{ btn.textContent='Copy'; btn.classList.remove('copied'); },2000);
      }).catch(()=>{ btn.textContent='Error'; });
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   COLOUR CONTRAST CHECKER
══════════════════════════════════════════════════════════════ */
function hexToRgb(hex) {
  hex = hex.trim().replace('#','');
  if (hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  if (hex.length!==6) return null;
  const n = parseInt(hex,16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function parseColor(str) {
  str = str.trim();
  if (str.startsWith('#') || /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(str)) return hexToRgb(str);
  const m = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return { r: Math.min(255,+m[1]), g: Math.min(255,+m[2]), b: Math.min(255,+m[3]) };
  return null;
}
function relativeLuminance({r,g,b}) {
  const c = [r,g,b].map(v => {
    const s = v/255;
    return s<=.03928 ? s/12.92 : Math.pow((s+.055)/1.055, 2.4);
  });
  return .2126*c[0] + .7152*c[1] + .0722*c[2];
}
function contrastRatio(c1,c2) {
  const l1=relativeLuminance(c1), l2=relativeLuminance(c2);
  const lighter=Math.max(l1,l2), darker=Math.min(l1,l2);
  return (lighter+.05)/(darker+.05);
}
function rgbToHex({r,g,b}) {
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function updateContrast() {
  const fgStr = document.getElementById('fgColor').value;
  const bgStr = document.getElementById('bgColor').value;
  const fg = parseColor(fgStr);
  const bg = parseColor(bgStr);
  if (!fg||!bg) return;

  const ratio = contrastRatio(fg,bg);
  document.getElementById('ratioNum').textContent = ratio.toFixed(2);

  function badge(pass) {
    return `<span class="wcag-badge ${pass?'pass-badge':'fail-badge'}">${pass?'✅ Pass':'❌ Fail'}</span>`;
  }
  document.getElementById('normalAA' ).innerHTML = badge(ratio>=4.5);
  document.getElementById('normalAAA').innerHTML = badge(ratio>=7);
  document.getElementById('largeAA'  ).innerHTML = badge(ratio>=3);
  document.getElementById('largeAAA' ).innerHTML = badge(ratio>=4.5);

  // Preview
  const preview = document.getElementById('contrastPreview');
  preview.style.background = bgStr;
  document.getElementById('previewNormal').style.color = fgStr;
  document.getElementById('previewLarge').style.color  = fgStr;

  // Suggestions if failing
  const sugg = document.getElementById('contrastSuggestions');
  if (ratio<4.5) {
    sugg.innerHTML = `<div class="limitation-note"><i class="bi bi-lightbulb me-1" aria-hidden="true"></i>
      <strong>Suggestion:</strong> Try darkening the foreground colour or lightening the background to reach at least 4.5:1 for normal text.</div>`;
  } else { sugg.innerHTML=''; }
}

// Wire up contrast inputs
document.getElementById('fgColorPicker').addEventListener('input', e => {
  document.getElementById('fgColor').value = e.target.value; updateContrast();
});
document.getElementById('bgColorPicker').addEventListener('input', e => {
  document.getElementById('bgColor').value = e.target.value; updateContrast();
});
document.getElementById('fgColor').addEventListener('input', e => {
  const c=parseColor(e.target.value);
  if(c) document.getElementById('fgColorPicker').value=rgbToHex(c);
  updateContrast();
});
document.getElementById('bgColor').addEventListener('input', e => {
  const c=parseColor(e.target.value);
  if(c) document.getElementById('bgColorPicker').value=rgbToHex(c);
  updateContrast();
});
updateContrast(); // initial

/* ══════════════════════════════════════════════════════════════
   ALT-TEXT ANALYZER
══════════════════════════════════════════════════════════════ */
function renderAltText() {
  if (!currentScan) {
    document.getElementById('altNoScan').classList.remove('d-none');
    document.getElementById('altContent').classList.add('d-none');
    return;
  }
  document.getElementById('altNoScan').classList.add('d-none');
  document.getElementById('altContent').classList.remove('d-none');

  const images = currentScan.images||[];
  const withAlt     = images.filter(i=>i.status==='has-alt').length;
  const emptyAlt    = images.filter(i=>i.status==='empty-alt').length;
  const missingAlt  = images.filter(i=>i.status==='missing-alt').length;

  document.getElementById('altSummaryCards').innerHTML = [
    {label:'Total Images', num:images.length, color:'var(--primary)', icon:'bi-image'},
    {label:'Has Alt Text', num:withAlt,       color:'var(--success)', icon:'bi-check-circle'},
    {label:'Empty Alt (decorative)', num:emptyAlt,  color:'var(--info)',    icon:'bi-dash-circle'},
    {label:'Missing Alt ⚠️', num:missingAlt, color:'var(--danger)',   icon:'bi-x-circle'}
  ].map(s=>`<div class="col-6 col-md-3">
    <div class="summary-card" style="border-top:3px solid ${s.color}" tabindex="0">
      <div class="summary-icon"><i class="bi ${s.icon}" style="color:${s.color}" aria-hidden="true"></i></div>
      <div class="summary-count" style="color:${s.color}">${s.num}</div>
      <div class="summary-label">${s.label}</div>
    </div>
  </div>`).join('');

  if (!images.length) {
    document.getElementById('altImageList').innerHTML = '<p class="text-muted">No images were found on this page.</p>';
    return;
  }

  document.getElementById('altImageList').innerHTML = images.map(img => {
    const st = img.status;
    const icon = st==='has-alt'?'bi-check-circle text-success':st==='empty-alt'?'bi-dash-circle text-info':'bi-x-circle text-danger';
    const label = st==='has-alt'?'Has alt text':st==='empty-alt'?'Empty alt (decorative)':'Missing alt attribute ⚠️';
    return `<div class="img-row" role="listitem">
      <i class="bi ${icon} img-status-icon" aria-hidden="true"></i>
      <div class="img-info">
        <div class="fw-semibold" style="font-size:.88rem">${label}</div>
        <div class="img-src">${esc(img.src||'unknown source')}</div>
        ${img.alt!=null?`<div class="img-alt-value">alt="${esc(img.alt)}"</div>`:''}
        ${st==='missing-alt'?`<div class="text-danger mt-1" style="font-size:.8rem">
          <strong>Fix:</strong> Add an alt attribute. Use alt="description" for meaningful images, alt="" for decorative ones.</div>`:''}
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   KEYBOARD CHECKLIST
══════════════════════════════════════════════════════════════ */
let kbResults = loadKbResults();
function loadKbResults() { try{return JSON.parse(localStorage.getItem('dl_kb')||'{}')}catch{return{}} }
function saveKbResults() { try{localStorage.setItem('dl_kb',JSON.stringify(kbResults))}catch{} }

function renderKeyboardChecklist() {
  updateKbProgress();
  const container = document.getElementById('keyboardChecklist');
  container.innerHTML = KB_ITEMS.map(item => {
    const val = kbResults[item.id]||'none';
    return `<div class="checklist-item" role="listitem">
      <div class="checklist-item-header">
        <span class="checklist-title">${esc(item.title)}</span>
        <div class="checklist-btns" role="group" aria-label="Result for ${esc(item.title)}">
          <button class="chk-btn${val==='pass'?' pass':''}" data-kb="${item.id}" data-val="pass" aria-pressed="${val==='pass'}">✅ Pass</button>
          <button class="chk-btn${val==='fail'?' fail':''}" data-kb="${item.id}" data-val="fail" aria-pressed="${val==='fail'}">❌ Fail</button>
          <button class="chk-btn${val==='na'?' na':''}"   data-kb="${item.id}" data-val="na"   aria-pressed="${val==='na'}">— N/A</button>
        </div>
      </div>
      <p class="checklist-desc">${esc(item.desc)}</p>
      <label for="kbn-${item.id}" class="visually-hidden">Notes for ${esc(item.title)}</label>
      <input type="text" id="kbn-${item.id}" class="form-control chk-note" placeholder="Notes (optional)"
        value="${esc(kbResults[item.id+'_note']||'')}" data-kbn="${item.id}"/>
    </div>`;
  }).join('');

  container.querySelectorAll('[data-kb]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id=btn.dataset.kb, val=btn.dataset.val;
      kbResults[id] = kbResults[id]===val ? 'none' : val;
      saveKbResults(); renderKeyboardChecklist();
    });
  });
  container.querySelectorAll('[data-kbn]').forEach(inp => {
    inp.addEventListener('input', () => {
      kbResults[inp.dataset.kbn+'_note'] = inp.value; saveKbResults();
    });
  });
}

function updateKbProgress() {
  const done  = KB_ITEMS.filter(i=>kbResults[i.id]&&kbResults[i.id]!=='none').length;
  const pass  = KB_ITEMS.filter(i=>kbResults[i.id]==='pass').length;
  const fail  = KB_ITEMS.filter(i=>kbResults[i.id]==='fail').length;
  const el = document.getElementById('kbProgress');
  if (el) el.textContent = `${done}/${KB_ITEMS.length} checked · ${pass} Pass · ${fail} Fail`;
}

document.getElementById('resetChecklist').addEventListener('click', () => {
  if (confirm('Reset all keyboard checklist entries?')) {
    KB_ITEMS.forEach(i=>{ delete kbResults[i.id]; delete kbResults[i.id+'_note']; });
    saveKbResults(); renderKeyboardChecklist();
  }
});

/* ══════════════════════════════════════════════════════════════
   HEADING STRUCTURE
══════════════════════════════════════════════════════════════ */
function renderHeadings() {
  if (!currentScan) {
    document.getElementById('hdgNoScan').classList.remove('d-none');
    document.getElementById('hdgContent').classList.add('d-none');
    return;
  }
  document.getElementById('hdgNoScan').classList.add('d-none');
  document.getElementById('hdgContent').classList.remove('d-none');

  const headings = currentScan.headings||[];
  const h1count = headings.filter(h=>h.level===1).length;
  const skipped = detectSkippedLevels(headings);

  document.getElementById('hdgSummary').innerHTML = [
    {label:'Total Headings', num:headings.length, color:'var(--primary)'},
    {label:'H1 Count',       num:h1count,          color: h1count===1?'var(--success)':'var(--danger)'},
    {label:'Level Skips',    num:skipped,           color: skipped===0?'var(--success)':'var(--warning)'}
  ].map(s=>`<div class="col-sm-4">
    <div class="compare-metric">
      <div style="font-size:1.6rem;font-weight:800;color:${s.color}">${s.num}</div>
      <div class="pass-stat-label">${s.label}</div>
    </div>
  </div>`).join('');

  if (!headings.length) {
    document.getElementById('headingOutline').innerHTML = '<p class="text-muted">No headings found on this page.</p>';
    return;
  }

  let prevLevel = 0;
  document.getElementById('headingOutline').innerHTML = headings.map(h => {
    const skippedHere = prevLevel>0 && h.level>prevLevel+1;
    prevLevel = h.level;
    return `<div class="heading-row h${h.level}${skippedHere?' skipped':''}" role="listitem">
      <span class="heading-level">H${h.level}</span>
      <span class="heading-text">${esc(h.text||'(empty heading)')}</span>
      ${skippedHere?`<span class="heading-skip-warn" aria-label="Possible level skip">⚠ skip from H${h.level>1?h.level-1:1}</span>`:''}
    </div>`;
  }).join('');
}

function detectSkippedLevels(headings) {
  let prev=0, count=0;
  headings.forEach(h=>{ if(prev>0&&h.level>prev+1)count++; prev=h.level; });
  return count;
}

/* ══════════════════════════════════════════════════════════════
   FORM CHECKER
══════════════════════════════════════════════════════════════ */
function renderForms() {
  if (!currentScan) {
    document.getElementById('formNoScan').classList.remove('d-none');
    document.getElementById('formContent').classList.add('d-none');
    return;
  }
  document.getElementById('formNoScan').classList.add('d-none');
  document.getElementById('formContent').classList.remove('d-none');

  const formIssues = (currentScan.issues||[]).filter(i=>
    ['label','button-name','form-field-multiple-labels','aria-required-attr','select-name',
     'link-name','input-button-name'].includes(i.id)
  );
  const totalForms = currentScan.formCount||0;

  document.getElementById('formSummary').innerHTML = [
    {label:'Form-related Issues', num:formIssues.length, color:formIssues.length?'var(--danger)':'var(--success)'},
    {label:'Forms on Page',       num:totalForms,         color:'var(--primary)'}
  ].map(s=>`<div class="col-sm-4">
    <div class="compare-metric">
      <div style="font-size:1.6rem;font-weight:800;color:${s.color}">${s.num}</div>
      <div class="pass-stat-label">${s.label}</div>
    </div>
  </div>`).join('');

  const list = document.getElementById('formIssueList');
  if (!formIssues.length) {
    list.innerHTML = `<div class="empty-state" style="border-color:#86efac">
      <i class="bi bi-check-circle fs-1 text-success d-block mb-2" aria-hidden="true"></i>
      <h3>No form accessibility issues detected!</h3>
      <p>axe-core found no form-related violations. Manual testing is still recommended.</p>
    </div>`;
    return;
  }
  list.innerHTML = formIssues.map((issue,idx)=>buildIssueCard(issue,idx)).join('');
  attachIssueCardListeners(list);
}

/* ══════════════════════════════════════════════════════════════
   SCAN HISTORY
══════════════════════════════════════════════════════════════ */
function renderHistory() {
  const q = (document.getElementById('historySearch').value||'').toLowerCase();
  const list = scanHistory.filter(h=>!q||h.url.toLowerCase().includes(q));

  document.getElementById('historyEmpty').classList.toggle('d-none', list.length>0);

  document.getElementById('historyList').innerHTML = list.map(h => {
    const sc = h.score||0;
    return `<div class="history-row">
      <div class="history-score ${scoreClass(sc)}">${sc}</div>
      <div class="flex-grow-1 min-w-0">
        <div class="history-url">${esc(h.url)}</div>
        <div class="history-meta">${fmtDate(h.scannedAt)} · ${h.totalIssues||0} issues · ${h.totalViolations||0} violations</div>
      </div>
      <div class="history-actions">
        <button class="btn btn-sm btn-outline-primary" data-hist-view="${h.id}" aria-label="View scan for ${esc(h.url)}">
          <i class="bi bi-eye me-1" aria-hidden="true"></i>View
        </button>
        <button class="btn btn-sm btn-outline-danger"  data-hist-del="${h.id}" aria-label="Delete scan for ${esc(h.url)}">
          <i class="bi bi-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('[data-hist-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      scanHistory = scanHistory.filter(h=>h.id!==btn.dataset.histDel);
      saveHistory(); renderHistory();
    });
  });
  document.querySelectorAll('[data-hist-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = scanHistory.find(h=>h.id===btn.dataset.histView);
      if (!entry) return;
      currentScan = entry;
      allIssues = entry.issues || [];
      navigateTo('scan');
      document.getElementById('scanUrlInput').value = entry.url;
      renderScanResults(entry);
    });
  });
}

document.getElementById('historySearch').addEventListener('input', renderHistory);
document.getElementById('clearHistory').addEventListener('click', () => {
  if (confirm('Delete all scan history?')) { scanHistory=[]; saveHistory(); renderHistory(); }
});

/* ══════════════════════════════════════════════════════════════
   BEFORE & AFTER COMPARISON
══════════════════════════════════════════════════════════════ */
function renderCompareSelects() {
  const opts = scanHistory.length
    ? scanHistory.map(h=>`<option value="${h.id}">${esc(h.url.substring(0,50))} — ${fmtDate(h.scannedAt)} (Score: ${h.score})</option>`).join('')
    : '<option disabled>No scans in history yet</option>';
  const selA = document.getElementById('compareA');
  const selB = document.getElementById('compareB');
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  if (scanHistory.length >= 2) {
    selA.value = scanHistory[1].id;
    selB.value = scanHistory[0].id;
  }
}

document.getElementById('runCompareBtn').addEventListener('click', () => {
  const idA = document.getElementById('compareA').value;
  const idB = document.getElementById('compareB').value;
  const a = scanHistory.find(h=>h.id===idA);
  const b = scanHistory.find(h=>h.id===idB);
  if (!a||!b) return;

  const scoreChange = b.score - a.score;
  const issueChange = b.totalIssues - a.totalIssues;

  function delta(val, invert=false) {
    if (val===0) return `<span class="compare-delta delta-same">No change</span>`;
    const better = invert ? val<0 : val>0;
    return `<span class="compare-delta ${better?'delta-better':'delta-worse'}">${val>0?'+':''}${val}</span>`;
  }

  document.getElementById('compareResults').classList.remove('d-none');
  document.getElementById('compareResults').innerHTML = `
    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <div class="card-panel">
          <div class="text-muted small mb-1">Scan A (Before)</div>
          <div class="fw-bold small">${esc(a.url)}</div>
          <div class="text-muted small">${fmtDate(a.scannedAt)}</div>
          <div style="font-size:1.5rem;font-weight:800;color:${scoreColor(a.score)}" class="mt-2">${a.score}/100</div>
          <div class="text-muted small">${a.totalIssues} issues · ${a.totalViolations} violations</div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card-panel">
          <div class="text-muted small mb-1">Scan B (After)</div>
          <div class="fw-bold small">${esc(b.url)}</div>
          <div class="text-muted small">${fmtDate(b.scannedAt)}</div>
          <div style="font-size:1.5rem;font-weight:800;color:${scoreColor(b.score)}" class="mt-2">${b.score}/100</div>
          <div class="text-muted small">${b.totalIssues} issues · ${b.totalViolations} violations</div>
        </div>
      </div>
    </div>
    <div class="row g-3">
      <div class="col-6 col-md-3">
        <div class="compare-metric">
          <div class="text-muted small">Score Change</div>
          ${delta(scoreChange)}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="compare-metric">
          <div class="text-muted small">Issues Change</div>
          ${delta(issueChange, true)}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="compare-metric">
          <div class="text-muted small">Critical Change</div>
          ${delta(((b.severityCounts||{}).critical||0)-((a.severityCounts||{}).critical||0), true)}
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="compare-metric">
          <div class="text-muted small">Serious Change</div>
          ${delta(((b.severityCounts||{}).serious||0)-((a.severityCounts||{}).serious||0), true)}
        </div>
      </div>
    </div>`;
});

/* ══════════════════════════════════════════════════════════════
   LEARNING HUB
══════════════════════════════════════════════════════════════ */
function renderLearning() {
  document.getElementById('learningHub').innerHTML = LESSONS.map((lesson,idx) => `
    <div class="lesson-card stagger-item" style="--stagger-i:${idx}" role="article">
      <div class="lesson-header" tabindex="0" role="button" aria-expanded="false">
        <div class="lesson-icon" style="background:${lesson.bg};color:${lesson.color}">
          <i class="${lesson.icon}" aria-hidden="true"></i>
        </div>
        <span class="lesson-title">${esc(lesson.title)}</span>
        <i class="bi bi-chevron-down issue-chevron" aria-hidden="true"></i>
      </div>
      <div class="lesson-body"><div class="accordion-inner">${lesson.content}</div></div>
    </div>
  `).join('');

  document.querySelectorAll('.lesson-header').forEach(h => {
    h.addEventListener('click', () => toggleCard(h.closest('.lesson-card'), h));
    h.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();h.click();} });
  });
}

/* ══════════════════════════════════════════════════════════════
   HOME PAGE EXTRAS
══════════════════════════════════════════════════════════════ */
function updateLastScanHome(scan) {
  const card = document.getElementById('lastScanSummary');
  if (!scan) return;
  document.getElementById('lastScanUrl').textContent  = scan.url;
  document.getElementById('lastScanDate').textContent = fmtDate(scan.scannedAt);
  card.classList.remove('d-none');
}

document.getElementById('viewLastScanBtn').addEventListener('click', () => {
  const scan = currentScan || scanHistory[0];
  if (scan) {
    currentScan = scan;
    allIssues = scan.issues || [];
    navigateTo('scan');
    document.getElementById('scanUrlInput').value = scan.url;
    renderScanResults(scan);
  } else {
    navigateTo('scan');
  }
});
document.getElementById('rescanBtn').addEventListener('click', () => {
  const url = currentScan?.url || scanHistory[0]?.url;
  if (!url) return;
  navigateTo('scan');
  document.getElementById('scanUrlInput').value = url;
  doScan(url, 'scanBtn', 'scanUrlErr', 'scanLoading', ['ls1','ls2','ls3','ls4']);
});

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
// Show last scan summary if history exists
if (scanHistory.length) updateLastScanHome({ url:scanHistory[0].url, scannedAt:scanHistory[0].scannedAt });
// Initial page
navigateTo('home');
