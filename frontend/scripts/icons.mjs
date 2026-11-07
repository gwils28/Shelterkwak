// Régénère les PNG du manifeste à partir de public/icon.svg et public/icon-maskable.svg.
// Usage : node scripts/icons.mjs (Chromium de Playwright requis : npx playwright install chromium)
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const pub = new URL("../public/", import.meta.url);
const targets = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["icon-maskable.svg", "icon-maskable-512.png", 512],
];

const browser = await chromium.launch();
try {
  for (const [src, out, size] of targets) {
    const svg = await readFile(new URL(src, pub), "utf8");
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: new URL(out, pub).pathname, omitBackground: true });
    await page.close();
    console.log(`${out} (${size}px)`);
  }
} finally {
  await browser.close();
}
