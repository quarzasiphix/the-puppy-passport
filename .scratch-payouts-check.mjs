import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
await page.goto('http://localhost:8093/dashboard/breeder/payouts', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(800);
console.log('breeder/payouts final URL:', page.url());
await page.screenshot({ path: '/tmp/claude-1000/-home-quarza/9840f85d-2c06-4be8-95b6-e66067bec426/scratchpad/breeder-payouts-unauth.png' });

await page.goto('http://localhost:8093/dashboard/operations/payouts', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(800);
console.log('operations/payouts final URL:', page.url());
await page.screenshot({ path: '/tmp/claude-1000/-home-quarza/9840f85d-2c06-4be8-95b6-e66067bec426/scratchpad/ops-payouts-unauth.png' });

await browser.close();
console.log('done');
