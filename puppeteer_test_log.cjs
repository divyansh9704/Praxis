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

    console.log("Invoking log_action directly...");
    const actionId = await page.evaluate(async () => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      return await invoke('log_action', {
        conversationId: "test-conv-id",
        toolName: "test-tool",
        inputParams: "{}",
        trustTier: "guarded",
        status: "completed",
        reasoning: "Test reasoning"
      });
    });
    console.log("log_action succeeded! ID:", actionId);
    
    await browser.disconnect();
  } catch(e) {
    console.error("Puppeteer error:", e);
  }
})();
