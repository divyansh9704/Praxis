const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  try {
    const exePath = path.join(__dirname, 'src-tauri', 'target', 'release', 'praxis.exe');
    console.log("Launching", exePath);
    const proc = spawn(exePath, [], {
      env: {
        ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9223'
      }
    });

    // Wait a bit for the app to start
    console.log("Waiting 5 seconds for app to initialize...");
    await new Promise(r => setTimeout(r, 5000));

    const browserURL = 'http://localhost:9223';
    console.log(`Connecting to ${browserURL}...`);
    const browser = await puppeteer.connect({ browserURL });
    const pages = await browser.pages();
    const page = pages[0];

    console.log("Checking if settings view is active...");
    
    // Wait for the app to render either Chat or Settings
    await page.waitForSelector('.app-container', { timeout: 10000 });

    const activeNav = await page.evaluate(() => {
      const activeEl = document.querySelector('.nav-item.active span');
      return activeEl ? activeEl.textContent : null;
    });

    console.log(`Active navigation item: ${activeNav}`);
    if (activeNav === 'Settings') {
      console.log("SUCCESS: The app landed correctly on the Settings screen for a new user.");
    } else {
      console.log("FAILURE: The app landed on", activeNav);
    }
    
    await browser.disconnect();
    proc.kill();
  } catch(e) {
    console.error("Puppeteer test error:", e);
  }
})();
