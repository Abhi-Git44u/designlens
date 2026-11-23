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

    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return res.status(502).json({ error: 'Could not reach the website. Please check the URL and try again.' });
    }
    if (err.message && err.message.includes('timeout')) {
      return res.status(504).json({ error: 'The request timed out. The website may be too slow or unavailable.' });
    }
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
