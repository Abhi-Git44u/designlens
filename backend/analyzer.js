/**
 * DesignLens – Accessibility Analyzer Engine (v3)
 * backend/analyzer.js
 *
 * Fixes in v3:
 *  - Retry fetch with alternate UA on 403/429/503
 *  - Compressed response support (Accept-Encoding)
 *  - DOM pruning (remove script/style/svg/canvas/video nodes before axe)
 *  - Fast-mode axe for large pages (>800 elements) — 20 fast rules
 *  - Specific error messages for blocked / rate-limited / DNS / timeout
 *  - isLargePage + rulesMode flag in response so frontend can show note
 */

const axios = require('axios');
const { JSDOM, VirtualConsole } = require('jsdom');
const axe = require('axe-core');

// ── Constants ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15000;   // 15s per attempt
const MAX_SIZE_BYTES   = 8 * 1024 * 1024; // 8 MB
const AXE_TIMEOUT_MS   = 55000;   // 55s axe timeout
const LARGE_PAGE_THRESHOLD = 800; // elements

// User-agents to try in order on 403/429
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0'
];

const SEVERITY_LABEL = { critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };

// Rules known to be very slow on large JSDOM pages (each O(n) × many nodes)
const SLOW_RULES = new Set([
  'color-contrast', 'region', 'aria-prohibited-attr',
  'aria-allowed-attr', 'link-name', 'identical-links-same-purpose',
  'css-orientation-lock', 'avoid-inline-spacing'
]);

// 20 fast structural rules used in fast-mode (large pages)
const FAST_RULE_IDS = [
  'image-alt', 'heading-order', 'label', 'button-name',
  'html-has-lang', 'document-title', 'landmark-one-main',
  'page-has-heading-one', 'frame-title', 'bypass',
  'aria-roles', 'aria-required-attr', 'list', 'listitem',
  'tabindex', 'select-name', 'form-field-multiple-labels',
  'input-button-name', 'duplicate-id', 'scrollable-region-focusable'
];

const FIX_SUGGESTIONS = {
  'image-alt':           'Add a descriptive alt attribute to every <img> tag. Use alt="" for decorative images.',
  'color-contrast':      'Ensure text has a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text against its background.',
  'heading-order':       'Use headings in sequential order (h1 → h2 → h3). Do not skip heading levels.',
  'label':               'Associate every <input>, <select>, and <textarea> with a <label> using the for/id pair, or use aria-label.',
  'button-name':         'Give every <button> a visible text label or an aria-label attribute.',
  'link-name':           'Provide descriptive text for every <a> link. Avoid generic labels like "click here" or "read more".',
  'form-field-multiple-labels': 'Each form field should have only one label to avoid confusion for screen-reader users.',
  'aria-required-attr':  'Add all required ARIA attributes to elements that use ARIA roles.',
  'aria-roles':          'Use only valid ARIA roles and ensure they are applied to appropriate elements.',
  'landmark-one-main':   'Wrap the main content of your page in a <main> element so screen readers can jump to it.',
  'page-has-heading-one':'Add a single <h1> heading to describe the main content of the page.',
  'document-title':      'Add a descriptive <title> element to the <head> of your page.',
  'html-has-lang':       'Add a lang attribute to the <html> element (e.g. lang="en") so screen readers use the correct language.',
  'frame-title':         'Add a title attribute to every <iframe> describing its content.',
  'duplicate-id':        'Ensure every id attribute value is unique within the page.',
  'list':                'Use <ul> or <ol> elements only to contain <li> children.',
  'listitem':            '<li> elements must be inside a <ul> or <ol> parent.',
  'tabindex':            'Avoid positive tabindex values (tabindex > 0); use 0 or -1 instead.',
  'keyboard':            'Ensure all interactive elements are keyboard accessible.',
  'bypass':              'Add a "Skip to main content" link at the top of the page.',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function humanFetchError(err, url) {
  const status = err.response && err.response.status;
  if (status === 403 || status === 401)
    return `The website at "${url}" blocked automated access (HTTP ${status}). Some sites protect against scrapers. Try a different page or sub-URL.`;
  if (status === 429)
    return `The website is rate-limiting requests (HTTP 429). Wait a minute and try again.`;
  if (status === 503 || status === 502)
    return `The website returned a server error (HTTP ${status}). It may be temporarily down.`;
  if (status >= 400)
    return `The website returned HTTP ${status}. Check that the URL is publicly accessible.`;
  if (err.code === 'ENOTFOUND')
    return `Could not find the website "${new URL(url).hostname}". Check the URL spelling.`;
  if (err.code === 'ECONNREFUSED')
    return `Connection refused by "${new URL(url).hostname}". The server may be offline.`;
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || (err.message||'').toLowerCase().includes('timeout'))
    return `The website took too long to respond (>${FETCH_TIMEOUT_MS/1000}s). It may be slow or blocking requests. Try a specific sub-page URL.`;
  if ((err.message||'').includes('maxContentLength'))
    return `The page HTML is larger than ${MAX_SIZE_BYTES/1024/1024} MB. Try scanning a specific sub-page.`;
  if ((err.message||'').includes('non-HTML') || (err.message||'').includes('not an HTML'))
    return err.message;
  return `Could not fetch the page: ${err.message}`;
}

// ── Fetch with retry ──────────────────────────────────────────────────────────

async function fetchHtml(url) {
  let lastErr;

  for (let attempt = 0; attempt < USER_AGENTS.length; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: MAX_SIZE_BYTES,
        maxBodyLength: MAX_SIZE_BYTES,
        responseType: 'text',
        decompress: true,          // handles gzip / deflate / br
        headers: {
          'User-Agent':      USER_AGENTS[attempt],
          'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control':   'no-cache',
          'Pragma':          'no-cache',
          // Looks more like a real browser
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest':  'document',
          'Sec-Fetch-Mode':  'navigate',
          'Sec-Fetch-Site':  'none',
        },
        maxRedirects: 8,
        validateStatus: status => status < 400  // throw on 4xx/5xx
      });

      const html = response.data;
      if (!html || typeof html !== 'string' || html.trim().length === 0)
        throw new Error('The server returned an empty or non-HTML response.');

      const ct = (response.headers['content-type'] || '');
      if (!ct.includes('html') && !ct.includes('text') && ct.length > 0)
        throw new Error(`The URL returned "${ct.split(';')[0]}", not an HTML page.`);

      return html; // success

    } catch (err) {
      lastErr = err;
      const status = err.response && err.response.status;

      // Retry only on bot-detection status codes
      const retryable = status === 403 || status === 429 || status === 503;
      if (!retryable || attempt === USER_AGENTS.length - 1) break;

      // Brief delay before retry with alternate UA
      await new Promise(r => setTimeout(r, 600));
    }
  }

  // All attempts failed — throw a friendly error
  throw Object.assign(new Error(humanFetchError(lastErr, url)), { _userFacing: true });
}

// ── DOM Pruning ───────────────────────────────────────────────────────────────
// Removes heavyweight non-structural nodes before axe traverses the tree.
// Does NOT remove elements that affect accessibility semantics.

function pruneHeavyNodes(document) {
  const selector = 'script, noscript, style, svg, canvas, video, audio, picture source';
  document.querySelectorAll(selector).forEach(el => el.remove());
}

// ── Extract extra page data ───────────────────────────────────────────────────

function extractPageDataFromDoc(document) {
  const images = [];
  document.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    const hasAlt = img.hasAttribute('alt');
    const altVal = img.getAttribute('alt');
    let status;
    if (!hasAlt)      status = 'missing-alt';
    else if (!altVal) status = 'empty-alt';
    else              status = 'has-alt';
    images.push({ src: src.substring(0, 200), alt: hasAlt ? altVal : null, status });
  });

  const headings = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
    headings.push({ level: parseInt(el.tagName[1]), text: (el.textContent || '').trim().substring(0, 120) });
  });

  const formCount = document.querySelectorAll('form').length;
  return { images, headings, formCount };
}

// ── Run axe + extract page data ───────────────────────────────────────────────

async function runAxeAndExtract(html, url) {
  const vc = new VirtualConsole();
  vc.on('error', () => {}); vc.on('warn', () => {});

  const dom = new JSDOM(html, {
    url,
    virtualConsole: vc,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;

  // Count elements BEFORE pruning (for threshold decision)
  const rawCount = document.querySelectorAll('*').length;
  const isLargePage = rawCount > LARGE_PAGE_THRESHOLD;

  // Extract images/headings/forms BEFORE pruning (pruning removes nothing relevant here)
  const pageData = extractPageDataFromDoc(document);

  // Prune heavy non-structural nodes to speed up axe traversal
  pruneHeavyNodes(document);

  // Cache getComputedStyle per element
  const origGCS = window.getComputedStyle.bind(window);
  const gcsCache = new WeakMap();
  window.getComputedStyle = function(el, pseudo) {
    if (!pseudo && el && typeof el === 'object') {
      let cached = gcsCache.get(el);
      if (!cached) { cached = origGCS(el); gcsCache.set(el, cached); }
      return cached;
    }
    return origGCS(el, pseudo);
  };

  // Inject axe-core
  try {
    window.eval(axe.source);
  } catch (evalErr) {
    window.close();
    throw new Error('Failed to inject axe-core: ' + evalErr.message);
  }

  if (!window.axe || typeof window.axe.run !== 'function') {
    window.close();
    throw new Error('axe-core failed to initialize. Try scanning a different page.');
  }

  // Choose axe options: fast-mode for large pages
  let axeOptions;
  let rulesMode;

  if (isLargePage) {
    rulesMode = 'fast';
    axeOptions = {
      runOnly: { type: 'rule', values: FAST_RULE_IDS },
      iframes: false,
      preload: false,
      resultTypes: ['violations', 'passes', 'incomplete']
    };
    console.log(`[DesignLens] Large page (${rawCount} elements) — using fast-mode axe (${FAST_RULE_IDS.length} rules)`);
  } else {
    rulesMode = 'full';
    axeOptions = {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      iframes: false,
      preload: false,
      resultTypes: ['violations', 'passes', 'incomplete']
    };
    console.log(`[DesignLens] Small page (${rawCount} elements) — full WCAG axe scan`);
  }

  let results;
  try {
    results = await Promise.race([
      new Promise((resolve, reject) => {
        window.axe.run(window.document, axeOptions, (err, res) => {
          if (err) reject(err); else resolve(res);
        });
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(
          Object.assign(
            new Error(`The page has ${rawCount} elements and took too long to analyze (>${AXE_TIMEOUT_MS/1000}s). Try scanning a specific sub-page instead of the homepage.`),
            { _userFacing: true }
          )
        ), AXE_TIMEOUT_MS)
      )
    ]);
  } finally {
    window.close();
  }

  return { axeResults: results, pageData, isLargePage, rulesMode, elementCount: rawCount };
}

// ── Format violation ──────────────────────────────────────────────────────────

function formatViolation(v) {
  const impact = v.impact || 'minor';
  const affectedElements = (v.nodes || []).slice(0, 5).map(node => ({
    html: node.html ? node.html.substring(0, 300) : '',
    target: node.target ? node.target.join(', ') : '',
    failureSummary: node.failureSummary || ''
  }));
  return {
    id:             v.id,
    name:           v.help || v.id,
    description:    v.description || '',
    helpUrl:        v.helpUrl || '',
    tags:           v.tags || [],
    severity:       impact,
    severityLabel:  SEVERITY_LABEL[impact] || 'Minor',
    affectedElements,
    affectedCount:  (v.nodes || []).length,
    suggestion:     FIX_SUGGESTIONS[v.id] || `Review the axe-core docs for "${v.id}" and apply the recommended fix.`
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function analyzeUrl(url) {
  const startTime = Date.now();

  const html = await fetchHtml(url);

  const { axeResults, pageData, isLargePage, rulesMode, elementCount } = await runAxeAndExtract(html, url);

  const issues = (axeResults.violations || []).map(formatViolation);

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  issues.forEach(issue => {
    if (counts[issue.severity] !== undefined) counts[issue.severity] += issue.affectedCount;
    else counts.minor += issue.affectedCount;
  });

  const categories = {};
  (axeResults.violations || []).forEach(v => {
    (v.tags || []).forEach(tag => {
      if (tag.startsWith('wcag') || tag === 'best-practice')
        categories[tag] = (categories[tag] || 0) + (v.nodes || []).length;
    });
  });

  return {
    url,
    scannedAt:       new Date().toISOString(),
    durationMs:      Date.now() - startTime,
    totalIssues:     issues.reduce((s, i) => s + i.affectedCount, 0),
    totalViolations: issues.length,
    severityCounts:  counts,
    categories,
    issues,
    passes:          (axeResults.passes || []).length,
    incomplete:      (axeResults.incomplete || []).length,
    // Page intelligence
    images:          pageData.images,
    headings:        pageData.headings,
    formCount:       pageData.formCount,
    // Scan metadata for frontend info banner
    isLargePage,
    rulesMode,
    elementCount
  };
}

module.exports = { analyzeUrl };
