import { chromium } from 'playwright';

const API = process.env.AEGIS_API_URL || 'http://localhost:8000';
const UI = process.env.AEGIS_UI_URL || 'http://localhost:3000/dashboard';
const target = (process.argv[2] || 'icicibank.com').trim().toLowerCase();

async function fetchJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.json();
}

async function findLatestScanForTarget(targetValue) {
  const history = await fetchJson('/api/v1/scan/history?limit=50');
  return history.items
    .filter((item) => (item.target || '').toLowerCase().includes(targetValue))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
}

async function run() {
  const previousDiscord = await findLatestScanForTarget('discord');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.addInitScript((scanId) => {
    localStorage.setItem('aegis-auth', 'true');
    if (scanId) {
      localStorage.setItem('aegis-selected-scan-id', scanId);
    }
  }, previousDiscord?.scan_id || null);

  await page.goto(UI, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const closeBtn = page.locator('button:has-text("Close")').first();
  if (await closeBtn.count()) {
    await closeBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }

  const input = page.locator('input[placeholder*="Enter targets"], input[placeholder*="Add more"]');
  await input.first().click();
  await input.first().fill(target);
  await page.keyboard.press('Enter');
  await page.locator('button:has-text("Start Scan Queue")').first().click({ force: true });

  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    const text = await page.locator('body').innerText();
    if (!text.includes('Scan Queue Running')) break;
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(1500);

  const latestTargetScan = await findLatestScanForTarget(target);
  const selectedScanId = await page.evaluate(() => localStorage.getItem('aegis-selected-scan-id'));

  const summary = {
    target,
    previousDiscordScanId: previousDiscord?.scan_id || null,
    latestTargetScanId: latestTargetScan?.scan_id || null,
    latestTargetStatus: latestTargetScan?.status || null,
    selectedScanId,
    selectedMatchesLatestTarget: Boolean(latestTargetScan?.scan_id && selectedScanId === latestTargetScan.scan_id),
  };

  console.log(JSON.stringify(summary, null, 2));
  await browser.close();

  if (!summary.selectedMatchesLatestTarget) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
