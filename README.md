# 🔍 DesignLens – Website Accessibility Analyzer

> A modern, full-featured web accessibility workspace that analyzes websites for WCAG 2.1 AA barriers, provides actionable repair guidance with code samples, and features an integrated suite of diagnostic tools.

Built with **Node.js**, **Express**, **axe-core**, and a responsive SaaS interface with deep navy & purple accents.

---

## 📸 Key Features

- **Automated WCAG 2.1 AA Scanner:** Powered by `axe-core` and JSDOM to inspect any valid public URL.
- **Accessibility Score (0–100):** Weighted algorithm evaluating Critical, Serious, Moderate, and Minor impacts.
- **Interactive Issue Explorer:** Real-time search, severity filtering, sorting, and manual "Mark as Reviewed" status.
- **Smart Fix Assistant:** Before/after code examples, why-it-matters context, affected personas, and one-click copy buttons.
- **Colour Contrast Checker:** Real-time color pickers with calculated contrast ratios against WCAG AA & AAA thresholds for normal and large text.
- **Alt-Text Analyzer:** Breaks down all page images into informative, decorative (`alt=""`), and missing alternatives.
- **Heading Structure Analyzer:** Visualizes the H1–H6 document outline with warnings for skipped hierarchy levels.
- **Form Accessibility Checker:** Audits form controls, label associations, required indicators, and accessible button names.
- **Keyboard Testing Checklist:** 12-item guided manual checklist (Tab order, focus traps, escape key, etc.) with state persistence.
- **Scan History & Comparison:** Local storage history tracking with a side-by-side **Before & After** delta comparator.
- **Clean PDF Report Generator:** Zero-dependency print-to-PDF engine with custom formatting for client presentations and audits.
- **Learning Hub:** 8 beginner-friendly modular guides explaining core WCAG principles and POUR standards.
- **Theme Support:** Dark & Light mode switchable interface with full keyboard accessibility.

---

## 📁 Project Structure

```
miniproject/
├── backend/
│   └── analyzer.js          # Core scanning engine (Axios, JSDOM, axe-core)
├── public/
│   ├── css/
│   │   └── style.css        # Responsive stylesheet with light/dark theme variables
│   ├── js/
│   │   └── app.js           # Single Page Application controller and diagnostic tools
│   └── index.html           # Accessible HTML5 single-page application shell
├── .gitignore
├── PROJECT_ANALYSIS.md      # In-depth architectural analysis, security audit & roadmap
├── package.json
├── server.js                # Express API with Helmet, CORS, Rate-Limiting & SSRF defenses
└── README.md
```

---

## 🛠️ Technology Stack

- **Backend:** Node.js, Express.js
- **Accessibility Engine:** `axe-core` (v4.8+)
- **DOM Parsing:** `jsdom`
- **HTTP Client:** `axios`
- **Frontend:** HTML5, CSS3, JavaScript (ES6+), Bootstrap 5, Chart.js, Bootstrap Icons
- **Security:** Helmet, express-rate-limit, SSRF IP blocking

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org) (v16.x or newer)
- `npm` (included with Node.js)

### Installation & Execution

```bash
# 1. Clone repository
git clone <your-repo-url>
cd miniproject

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```

Open your browser at **`http://localhost:3000`**.

For auto-reloading during development:
```bash
npm run dev
```

---

## 📊 Score Calculation Formula

DesignLens calculates a transparent, project-specific indicator score out of 100:

$$\text{Score} = \max\Big(0, 100 - (10 \times \text{Critical} + 5 \times \text{Serious} + 2 \times \text{Moderate} + 1 \times \text{Minor})\Big)$$

*Note: This score is a diagnostic metric and does not represent an official certification of WCAG conformance.*

---

## 🛡️ Security Features

- **SSRF Prevention:** Restricts requests to `http:` and `https:`, blocking loopback (`127.0.0.1`, `::1`), private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and AWS/cloud metadata (`169.254.169.254`).
- **Rate Limiting:** Protects backend against abuse (20 requests per 15-minute window per IP).
- **Payload Restrictions:** Enforces maximum HTML payload size (5 MB) and 15-second request timeouts.
- **Sanitized Presentation:** All dynamic HTML node snippets are sanitized and escaped before DOM insertion.

---

## 📑 Detailed Project Audit

For an in-depth technical analysis, weaknesses audit, and long-term upgrade roadmap, see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md).

---

## 📄 License

MIT License. Designed as an educational and developer accessibility auditing tool.
