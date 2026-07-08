const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport to a typical desktop size
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle0' });
  
  // Let's force the old text into it
  const report = await page.evaluate(() => {
    const dragRegion = document.querySelector('.titlebar-drag-region');
    dragRegion.textContent = "Praxis (1500 x 1000)"; // force it
    
    const dragRect = dragRegion.getBoundingClientRect();
    const controlsRect = document.querySelector('.titlebar-controls').getBoundingClientRect();
    
    return {
      dragRect: JSON.stringify(dragRect),
      controlsRect: JSON.stringify(controlsRect)
    };
  });
  
  console.log(report);
  
  await browser.close();
})();
