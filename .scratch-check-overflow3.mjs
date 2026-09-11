import { chromium } from 'playwright';

const BASE = 'http://localhost:8080';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 320, height: 812 },
  userAgent:
    'Mozilla/5.0 (Linux; Android 10; SM-A505FN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
});
const page = await context.newPage();

async function checkOverflow(label) {
  await page.waitForTimeout(400);
  const result = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    const offenders = [];
    if (docWidth > clientWidth) {
      const all = document.querySelectorAll('body *');
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth + 1 || rect.left < -1) {
          offenders.push({
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 140),
            width: Math.round(rect.width),
          });
        }
      }
    }
    const seen = new Map();
    for (const o of offenders) {
      const key = o.width + '|' + o.cls;
      if (!seen.has(key)) seen.set(key, o);
    }
    return { docWidth, clientWidth, diff: docWidth - clientWidth, offenders: [...seen.values()].sort((a,b)=>a.width-b.width).slice(0, 10) };
  });
  console.log('PAGE', label, JSON.stringify(result));
  if (result.diff > 0) {
    const fname = `/tmp/claude-1000/-p/c0eea7d1-fb51-4690-bc2b-22cdfd55695b/scratchpad/o320-${label.replace(/[^a-z0-9]/gi, '_')}.png`;
    await page.screenshot({ path: fname, fullPage: false });
  }
  return result;
}

const pages = ['/', '/find-a-dog', '/breeders', '/adoptions', '/community', '/how-it-works', '/estimate', '/transport', '/signin', '/signup', '/pedigrees', '/fundraising', '/community/groups', '/planned-routes', '/planned-litters', '/foundations', '/rehome', '/breeder-map', '/create-breeder'];
for (const p of pages) {
  try {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 20000 });
    await checkOverflow(p);
  } catch (e) {
    console.log('PAGE', p, 'ERROR', e.message);
  }
}

// Detail pages + interactions
try {
  await page.goto(BASE + '/adoptions/60000000-0000-0000-0000-000000000011', { waitUntil: 'networkidle', timeout: 20000 });
  await checkOverflow('adoption-detail-initial');
  // scroll to bottom to trigger any lazy content
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await checkOverflow('adoption-detail-scrolled');
} catch (e) { console.log('adoption-detail ERROR', e.message); }

try {
  await page.goto(BASE + '/puppies/31b7b7ed-4fed-4915-92dc-34390f318b9a', { waitUntil: 'networkidle', timeout: 20000 });
  await checkOverflow('puppy-detail-initial');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await checkOverflow('puppy-detail-scrolled');
  // try clicking tab triggers if present
  const tabButtons = await page.$$('button[role="tab"]');
  for (let i = 0; i < tabButtons.length; i++) {
    try {
      await tabButtons[i].click();
      await checkOverflow('puppy-detail-tab-' + i);
    } catch {}
  }
} catch (e) { console.log('puppy-detail ERROR', e.message); }

try {
  await page.goto(BASE + '/community/groups/adoption', { waitUntil: 'networkidle', timeout: 20000 });
  await checkOverflow('community-group-detail');
} catch (e) { console.log('community-group ERROR', e.message); }

await browser.close();
