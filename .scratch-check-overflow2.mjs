import { chromium } from 'playwright';

const BASE = 'http://localhost:8080';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          });
        }
      }
    }
    // dedupe by width+cls, keep narrowest-scoped (largest count of ancestors already listed removed heuristically by picking smallest width per left/right combo)
    const seen = new Map();
    for (const o of offenders) {
      const key = o.width + '|' + o.cls;
      if (!seen.has(key)) seen.set(key, o);
    }
    const uniq = [...seen.values()].sort((a, b) => a.width - b.width);
    return { docWidth, clientWidth, diff: docWidth - clientWidth, offenders: uniq.slice(0, 10) };
  });
  console.log('PAGE', label, JSON.stringify(result));
  if (result.diff > 0) {
    const fname = `/tmp/claude-1000/-p/c0eea7d1-fb51-4690-bc2b-22cdfd55695b/scratchpad/overflow-${label.replace(/[^a-z0-9]/gi, '_')}.png`;
    await page.screenshot({ path: fname, fullPage: false });
  }
  return result;
}

// helper: nav to a list page, grab first link matching a pattern, nav there, check.
async function checkDetailFrom(listPath, linkSelector, label) {
  try {
    await page.goto(BASE + listPath, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(500);
    const href = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute('href') : null;
    }, linkSelector);
    if (!href) {
      console.log('PAGE', label, 'NO_LINK_FOUND for selector', linkSelector);
      return;
    }
    await page.goto(BASE + href, { waitUntil: 'networkidle', timeout: 20000 });
    await checkOverflow(label + ' -> ' + href);
  } catch (e) {
    console.log('PAGE', label, 'ERROR', e.message);
  }
}

// Direct static-ish pages
for (const p of ['/adoptions', '/pedigrees', '/fundraising', '/community/groups', '/planned-routes', '/planned-litters', '/foundations', '/rehome', '/breeder-map', '/create-breeder']) {
  try {
    await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 20000 });
    await checkOverflow(p);
  } catch (e) {
    console.log('PAGE', p, 'ERROR', e.message);
  }
}

// Detail pages via following a real link from their list page
await checkDetailFrom('/adoptions', 'a[href^="/adoptions/"]', 'adoption-detail');
await checkDetailFrom('/find-a-dog', 'a[href^="/puppies/"]', 'puppy-detail');
await checkDetailFrom('/breeders', 'a[href^="/breeders/"]', 'breeder-detail');
await checkDetailFrom('/community/groups', 'a[href^="/community/groups/"]', 'community-group-detail');
await checkDetailFrom('/fundraising', 'a[href^="/fundraising/"]', 'fundraising-detail');

await browser.close();
