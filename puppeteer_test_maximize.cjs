const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browserURL = 'http://localhost:9222';
    console.log(`Connecting to ${browserURL}...`);
    
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    const page = pages[0];

    page.on('console', msg => console.log(`[PAGE LOG] ${msg.type().toUpperCase()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[PAGE ERROR]: ${err.toString()}`));

    console.log("Waiting for Maximize button...");
    const buttons = await page.$$('button');
    let maxBtn = null;
    for (let btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text === 'Maximize') {
        maxBtn = btn;
        break;
      }
    }
    
    if (maxBtn) {
      console.log("Clicking Maximize button...");
      await maxBtn.click();
      console.log("Clicked! Waiting 2 seconds for any errors...");
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log("Maximize button not found!");
    }
    
    await browser.disconnect();
  } catch(e) {
    console.error("Puppeteer error:", e);
  }
})();
