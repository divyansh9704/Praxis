const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browserURL = 'http://localhost:9222';
    console.log(`Connecting to ${browserURL}...`);
    
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    const page = pages[0];

    console.log("Invoking get_workspace_path...");
    const workspace = await page.evaluate(async () => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      return await invoke('get_workspace_path');
    });
    console.log("Workspace path is:", workspace);

    console.log("Invoking tool_list_dir...");
    const files = await page.evaluate(async () => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      return await invoke('tool_list_dir', { path: '.' });
    });
    console.log("tool_list_dir output:", files);
    
    await browser.disconnect();
  } catch(e) {
    console.error("Puppeteer error:", e);
  }
})();
