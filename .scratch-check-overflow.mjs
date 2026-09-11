import { chromium } from 'playwright';

const BASE = 'http://localhost:8080';
const pages = [
  '/',
  '/find-a-dog',
  '/breeders',
  '/adoptions',
  '/community',
  '/how-it-works',
  '/estimate',
  '/transport',
  '/signin',
  '/signup',
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();

for (const path of pages) {
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const overflowing = [];
      if (docWidth > clientWidth) {
        const all = document.querySelectorAll('body *');
        for (const el of all) {
          const rect = el.getBoundingClientRect();
          if (rect.right > clientWidth + 1 || rect.left < -1) {
            overflowing.push({
              tag: el.tagName,
              cls: (el.className || '').toString().slice(0, 120),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            });
          }
        }
      }
      // Keep only the outermost offenders (not every nested child of a wide element)
      overflowing.sort((a, b) => b.width - a.width);
      return {
        docWidth,
        clientWidth,
        diff: docWidth - clientWidth,
        offenders: overflowing.slice(0, 8),
      };
    });
    console.log('PAGE', path, JSON.stringify(result));
    if (result.diff > 0) {
      await page.screenshot({ path: `/tmp/claude-1000/-p/c0eea7d1-fb51-4690-bc2b-22cdfd55695b/scratchpad/overflow-${path.replace(/\//g, '_') || 'home'}.png`, fullPage: false });
    }
  } catch (e) {
    console.log('PAGE', path, 'ERROR', e.message);
  }
}

await browser.close();
