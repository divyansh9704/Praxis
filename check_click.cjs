const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle0' });
  
  // Listen to console logs to see if "Minimize clicked" appears
  let clickedLog = false;
  page.on('console', msg => {
    if (msg.text().includes('Minimize clicked')) {
      clickedLog = true;
    }
    console.log('Browser console:', msg.text());
  });

  // Try clicking it via Puppeteer's native click which simulates a real mouse click
  await page.click('.titlebar-btn');
  
  // Wait a moment
  await new Promise(r => setTimeout(r, 500));
  
  console.log("Did we see 'Minimize clicked' log?", clickedLog);
  
  await browser.close();
})();
