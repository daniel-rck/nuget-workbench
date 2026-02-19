/**
 * Playwright-based screenshot generator for NuGet Workbench.
 *
 * Starts a minimal HTTP server, loads the web UI with mock data,
 * captures screenshots for each tab, and creates an animated GIF.
 *
 * Usage: node screenshot-harness/take-screenshots.mjs
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { createRequire } from 'module';

import { chromium } from 'playwright';
import { PNG } from 'pngjs';

// gif-encoder-2 is CommonJS-only
const require = createRequire(import.meta.url);
const GIFEncoder = require('gif-encoder-2');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = join(__dirname, '..');
const HARNESS_DIR = __dirname;
const DIST_DIR = join(ROOT_DIR, 'dist');
const DOCS_IMAGES_DIR = join(ROOT_DIR, 'docs', 'images');

const PORT = 3729;
const VIEWPORT = { width: 1280, height: 800 };

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};

// ── HTTP server ───────────────────────────────────────────────────────────────

async function startServer() {
  const server = createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    let filePath;
    if (url.startsWith('/dist/')) {
      filePath = join(DIST_DIR, url.slice('/dist/'.length));
    } else if (url === '/' || url === '/index.html') {
      filePath = join(HARNESS_DIR, 'index.html');
    } else {
      filePath = join(HARNESS_DIR, url.slice(1));
    }

    try {
      const data = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not found: ${url}`);
    }
  });

  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`  Server: http://localhost:${PORT}/`);
  return server;
}

// ── Shadow DOM helpers (executed in page context) ─────────────────────────────

/**
 * Switch to a tab by calling setTab() directly on the packages-view element.
 * More reliable than text-matching button clicks, which break when badge
 * numbers are appended to textContent (e.g. "UPDATES3").
 *
 * @param {import('playwright').Page} page
 * @param {'browse'|'installed'|'updates'|'consolidate'|'vulnerabilities'} tabId
 */
async function switchTab(page, tabId) {
  await page.evaluate((id) => {
    const app = document.querySelector('nuget-workbench');
    if (!app?.shadowRoot) return;
    const pv = app.shadowRoot.querySelector('packages-view');
    if (pv && typeof pv.setTab === 'function') {
      pv.setTab(id);
    } else {
      console.warn('[harness] packages-view not found or setTab unavailable');
    }
  }, tabId);
}

/**
 * After switching tabs, invoke the view's load method once Lit has rendered
 * the child element into the shadow DOM.
 *
 * Background: setTab() updates activeTab (triggers a Lit microtask re-render).
 * The child element (e.g. updates-view) is only inserted into the DOM after
 * that render, so we wait one tick before querying for it.
 *
 * @param {import('playwright').Page} page
 * @param {'updates'|'vulnerabilities'|'consolidate'} tabId
 */
async function triggerTabLoad(page, tabId) {
  await page.waitForTimeout(300);

  await page.evaluate((tab) => {
    const app = document.querySelector('nuget-workbench');
    if (!app?.shadowRoot) return;
    const pv = app.shadowRoot.querySelector('packages-view');
    if (!pv?.shadowRoot) return;

    if (tab === 'updates') {
      const el = pv.shadowRoot.querySelector('updates-view');
      if (el && typeof el.LoadOutdatedPackages === 'function') {
        el.LoadOutdatedPackages();
      }
    } else if (tab === 'vulnerabilities') {
      const el = pv.shadowRoot.querySelector('vulnerabilities-view');
      if (el && typeof el.LoadVulnerablePackages === 'function') {
        el.LoadVulnerablePackages();
      }
    } else if (tab === 'consolidate') {
      const el = pv.shadowRoot.querySelector('consolidate-view');
      if (el && typeof el.LoadInconsistentPackages === 'function') {
        el.LoadInconsistentPackages();
      }
    }
  }, tabId);
}

async function waitForMockState(page, key, timeoutMs = 15_000) {
  await page.waitForFunction(
    (k) => window.__mockState?.[k] === true,
    key,
    { timeout: timeoutMs }
  );
}

// ── GIF encoding ──────────────────────────────────────────────────────────────

function buildGif(screenshots) {
  const { width, height } = VIEWPORT;
  const encoder = new GIFEncoder(width, height, 'octree', true);
  encoder.setRepeat(0);    // loop forever
  encoder.setDelay(3000);  // 3 s per frame
  encoder.start();

  for (const buf of screenshots) {
    const png = PNG.sync.read(buf);
    // gif-encoder-2 accepts a Buffer/Uint8Array of raw RGBA pixels
    encoder.addFrame(png.data);
  }

  encoder.finish();
  return encoder.out.getData();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nNuGet Workbench — Screenshot generator\n');

  mkdirSync(DOCS_IMAGES_DIR, { recursive: true });

  const server = await startServer();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize(VIEWPORT);

  // Forward browser console to Node console for debugging
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().startsWith('[')) {
      console.log('  [browser]', msg.text());
    }
  });

  console.log('  Loading harness…');
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });

  // 1. Config loaded → app renders packages-view
  await waitForMockState(page, 'configDone');
  // 2. Package list fetched for browse tab
  await waitForMockState(page, 'packagesDone');
  // Let Lit finish rendering (batch updates, Split.js init, etc.)
  await page.waitForTimeout(800);

  // Click the first package row to show the details panel on the right
  await page.evaluate(() => {
    const app = document.querySelector('nuget-workbench');
    if (!app?.shadowRoot) return;
    const pv = app.shadowRoot.querySelector('packages-view');
    if (!pv?.shadowRoot) return;
    const firstRow = pv.shadowRoot.querySelector('package-row');
    if (firstRow) firstRow.click();
  });
  // Wait for getPackage RPC + Lit re-render
  await page.waitForTimeout(500);

  // ── Screenshot 1: Browse tab ──────────────────────────────────────────────
  console.log('  [1/4] Browse tab…');
  const browsePng = await page.screenshot({ type: 'png' });
  writeFileSync(join(DOCS_IMAGES_DIR, 'screenshot-browse.png'), browsePng);
  console.log('        → docs/images/screenshot-browse.png');

  // ── Screenshot 2: Updates tab ─────────────────────────────────────────────
  console.log('  [2/4] Updates tab…');
  await switchTab(page, 'updates');
  await triggerTabLoad(page, 'updates');
  await waitForMockState(page, 'outdatedDone');
  await page.waitForTimeout(400);
  const updatesPng = await page.screenshot({ type: 'png' });
  writeFileSync(join(DOCS_IMAGES_DIR, 'screenshot-updates.png'), updatesPng);
  console.log('        → docs/images/screenshot-updates.png');

  // ── Screenshot 3: Vulnerabilities tab ────────────────────────────────────
  console.log('  [3/4] Vulnerabilities tab…');
  await switchTab(page, 'vulnerabilities');
  await triggerTabLoad(page, 'vulnerabilities');
  await waitForMockState(page, 'vulnerableDone');
  await page.waitForTimeout(400);
  const vulnPng = await page.screenshot({ type: 'png' });
  writeFileSync(join(DOCS_IMAGES_DIR, 'screenshot-vulnerabilities.png'), vulnPng);
  console.log('        → docs/images/screenshot-vulnerabilities.png');

  // ── Screenshot 4: Consolidate tab ────────────────────────────────────────
  console.log('  [4/4] Consolidate tab…');
  await switchTab(page, 'consolidate');
  await triggerTabLoad(page, 'consolidate');
  await waitForMockState(page, 'inconsistentDone');
  await page.waitForTimeout(400);
  const consolidatePng = await page.screenshot({ type: 'png' });
  writeFileSync(join(DOCS_IMAGES_DIR, 'screenshot-consolidate.png'), consolidatePng);
  console.log('        → docs/images/screenshot-consolidate.png');

  // ── Animated GIF ─────────────────────────────────────────────────────────
  console.log('  Building demo.gif…');
  const gifBuf = buildGif([browsePng, updatesPng, vulnPng, consolidatePng]);
  writeFileSync(join(DOCS_IMAGES_DIR, 'demo.gif'), gifBuf);
  console.log('        → docs/images/demo.gif');

  await browser.close();
  server.close();
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('\nFailed:', err.message ?? err);
  process.exit(1);
});
