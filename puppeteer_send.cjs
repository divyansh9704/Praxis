const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browserURL = 'http://localhost:9222';
    console.log(`Connecting to ${browserURL}...`);
    
    // Connect to Tauri WebView2
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    const page = pages[0];

    // Capture console logs
    page.on('console', msg => {
      console.log(`[PAGE LOG] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    page.on('pageerror', err => {
      console.log(`[PAGE ERROR]: ${err.toString()}`);
    });

    console.log("Waiting for input...");
    await page.waitForSelector('.command-input');
    
    // Type and send message
    await page.type('.command-input', 'search the web for lenovo laptop under 80000');
    await page.click('.send-btn');
    
    console.log("Message sent. Waiting 10 seconds for action processing...");
    await new Promise(r => setTimeout(r, 10000));
    
    console.log("Done waiting. Checking for any DB errors.");
    await browser.disconnect();
  } catch(e) {
    console.error("Puppeteer error:", e);
  }
})();
