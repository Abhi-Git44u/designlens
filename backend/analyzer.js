/**
 * DesignLens – Accessibility Analyzer Engine (v2)
 * backend/analyzer.js
 */

const axios = require('axios');
const { JSDOM, VirtualConsole } = require('jsdom');
const axe = require('axe-core');

const FETCH_TIMEOUT_MS = 15000;
const MAX_SIZE_BYTES   = 5 * 1024 * 1024;

const SEVERITY_LABEL = { critical:'Critical', serious:'Serious', moderate:'Moderate', minor:'Minor' };

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

/* ── Fetch HTML ───────────────────────────────────────────────── */
async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: FETCH_TIMEOUT_MS,
    maxContentLength: MAX_SIZE_BYTES,
    responseType: 'text',
    headers: {
      'User-Agent': 'DesignLens-Accessibility-Analyzer/2.0 (accessibility checker)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    maxRedirects: 5
  });
  if (!response.data || typeof response.data !== 'string')
    throw new Error('The server returned an empty or non-HTML response.');
  const ct = response.headers['content-type']||'';
  if (!ct.includes('html'))
    throw new Error(`The URL returned "${ct.split(';')[0]}", not an HTML page.`);
  return response.data;
}

/* ── Run axe-core ─────────────────────────────────────────────── */
async function runAxe(html, url) {
  const vc = new VirtualConsole();
  vc.on('error',()=>{}); vc.on('warn',()=>{});

  const dom = new JSDOM(html, {
    url, virtualConsole:vc,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  });
  const { window } = dom;
  await new Promise(r=>setTimeout(r,400));
  window.eval(axe.source);

  const results = await new Promise((resolve,reject) => {
    window.axe.run(window.document, {
      runOnly:{ type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }
    }, (err,res) => { if(err)reject(err); else resolve(res); });
  });
  window.close();
  return results;
}

/* ── Extract extra page data (images, headings, forms) ─────────── */
function extractPageData(html, url) {
  const vc = new VirtualConsole();
  vc.on('error',()=>{}); vc.on('warn',()=>{});
  const dom = new JSDOM(html, { url, virtualConsole:vc });
  const { document } = dom.window;

  // Images
  const images = [];
  document.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src')||'';
    const hasAlt = img.hasAttribute('alt');
    const altVal = img.getAttribute('alt');
    let status;
    if (!hasAlt)         status = 'missing-alt';
    else if (!altVal)    status = 'empty-alt';
    else                 status = 'has-alt';
    images.push({
      src: src.substring(0,200),
      alt: hasAlt ? altVal : null,
      status
    });
  });

  // Headings
  const headings = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
    headings.push({
      level: parseInt(el.tagName[1]),
      text: (el.textContent||'').trim().substring(0,120)
    });
  });

  // Forms
  const formCount = document.querySelectorAll('form').length;

  return { images, headings, formCount };
}

/* ── Format violation ─────────────────────────────────────────── */
function formatViolation(v) {
  const impact = v.impact||'minor';
  const affectedElements = (v.nodes||[]).slice(0,5).map(node=>({
    html: node.html ? node.html.substring(0,300) : '',
    target: node.target ? node.target.join(', ') : '',
    failureSummary: node.failureSummary||''
  }));
  return {
    id:          v.id,
    name:        v.help||v.id,
    description: v.description||'',
    helpUrl:     v.helpUrl||'',
    tags:        v.tags||[],
    severity:    impact,
    severityLabel: SEVERITY_LABEL[impact]||'Minor',
    affectedElements,
    affectedCount: (v.nodes||[]).length,
    suggestion:  FIX_SUGGESTIONS[v.id]||`Review the axe-core docs for "${v.id}" and apply the recommended fix.`
  };
}

/* ── Main analyze function ────────────────────────────────────── */
async function analyzeUrl(url) {
  const startTime = Date.now();

  const html = await fetchHtml(url);

  const [axeResults, pageData] = await Promise.all([
    runAxe(html, url),
    Promise.resolve(extractPageData(html, url))
  ]);

  const issues = (axeResults.violations||[]).map(formatViolation);

  const counts = { critical:0, serious:0, moderate:0, minor:0 };
  issues.forEach(issue => {
    if (counts[issue.severity]!==undefined) counts[issue.severity]+=issue.affectedCount;
    else counts.minor+=issue.affectedCount;
  });

  const categories = {};
  (axeResults.violations||[]).forEach(v => {
    (v.tags||[]).forEach(tag => {
      if (tag.startsWith('wcag')||tag==='best-practice')
        categories[tag]=(categories[tag]||0)+(v.nodes||[]).length;
    });
  });

  return {
    url,
    scannedAt:  new Date().toISOString(),
    durationMs: Date.now()-startTime,
    totalIssues: issues.reduce((s,i)=>s+i.affectedCount,0),
    totalViolations: issues.length,
    severityCounts: counts,
    categories,
    issues,
    passes:     (axeResults.passes||[]).length,
    incomplete: (axeResults.incomplete||[]).length,
    // Extra page data for tools
    images:    pageData.images,
    headings:  pageData.headings,
    formCount: pageData.formCount
  };
}

module.exports = { analyzeUrl };
