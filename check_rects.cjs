const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle0' });
  
  const report = await page.evaluate(() => {
    const dragRegion = document.querySelector('.titlebar-drag-region');
    const controls = document.querySelector('.titlebar-controls');
    
    return {
      dragRegionRect: JSON.stringify(dragRegion.getBoundingClientRect()),
      controlsRect: JSON.stringify(controls.getBoundingClientRect())
    };
  });
  
  console.log(report);
  await browser.close();
})();
