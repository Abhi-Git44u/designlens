/**
 * DesignLens – Website Accessibility Analyzer
 * Backend Server (server.js)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { analyzeUrl } = require('./backend/analyzer');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false  // Allow inline scripts on our own pages
}));

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Rate limiting: max 20 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Please wait a few minutes and try again.' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/analyze
 * Body: { url: "https://example.com" }
 * Returns accessibility analysis results
 */
app.post('/api/analyze', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid URL.' });
  }

  const trimmedUrl = url.trim();

  // Basic URL validation
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format. Please include http:// or https://' });
  }

  // Only allow http and https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'Only http:// and https:// URLs are supported.' });
  }

  // Block private/internal network addresses (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase();
  const blockedHosts = [
    'localhost', '127.0.0.1', '::1', '0.0.0.0',
    '169.254.169.254', '10.', '172.16.', '192.168.'
  ];
  const isBlocked = blockedHosts.some(blocked => hostname === blocked || hostname.startsWith(blocked));
  if (isBlocked) {
    return res.status(403).json({ error: 'Scanning of private or internal network addresses is not allowed.' });
  }

  try {
    console.log(`[DesignLens] Analyzing: ${trimmedUrl}`);
    const results = await analyzeUrl(trimmedUrl);
    return res.json(results);
  } catch (err) {
    console.error('[DesignLens] Analysis error:', err.message);

    // If the error already has a user-facing message (set in analyzer.js), use it directly
    if (err._userFacing) {
      const statusCode = (err.message.includes('blocked') || err.message.includes('403') || err.message.includes('401')) ? 403
        : (err.message.includes('rate') || err.message.includes('429')) ? 429
        : (err.message.includes('too long') || err.message.includes('timed out')) ? 504
        : 502;
      return res.status(statusCode).json({ error: err.message });
    }

    // Fallback error classification
    if (err.code === 'ENOTFOUND')
      return res.status(502).json({ error: `Could not find the website. Check the URL spelling.` });
    if (err.code === 'ECONNREFUSED')
      return res.status(502).json({ error: `Connection refused by the website. The server may be offline.` });
    if (err.code === 'ETIMEDOUT' || (err.message && err.message.toLowerCase().includes('timeout')))
      return res.status(504).json({ error: `The website took too long to respond. Try a specific sub-page URL instead of the homepage.` });
    if (err.response && err.response.status)
      return res.status(502).json({ error: `The website returned HTTP ${err.response.status}. It may block automated access.` });

    return res.status(500).json({ error: 'Analysis failed: ' + (err.message || 'Unknown error') });
  }
});

// ─── Serve Frontend ───────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔍 DesignLens is running at http://localhost:${PORT}\n`);
});
