const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport to a typical desktop size
  await page.setViewport({ width: 1200, height: 800 });
  
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle0' });
  
  // We want to test the minimize button
  // In App.tsx: <button className="titlebar-btn"><Minus size={16} /></button>
  // Let's find all titlebar-btn
  const report = await page.evaluate(() => {
    const buttons = document.querySelectorAll('.titlebar-btn');
    if (buttons.length === 0) return "No titlebar-btn found";
    
    // The first one is minimize
    const minimizeBtn = buttons[0];
    const rect = minimizeBtn.getBoundingClientRect();
    
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    const elementAtPoint = document.elementFromPoint(cx, cy);
    
    let overlapInfo = "";
    if (elementAtPoint === minimizeBtn || minimizeBtn.contains(elementAtPoint)) {
      overlapInfo = "Button is cleanly clickable. elementFromPoint returned the button or its child.";
    } else {
      overlapInfo = `OVERLAP DETECTED!
      Tag: ${elementAtPoint.tagName}
      Class: ${elementAtPoint.className}
      ID: ${elementAtPoint.id}
      Computed z-index: ${window.getComputedStyle(elementAtPoint).zIndex}
      BoundingRect: ${JSON.stringify(elementAtPoint.getBoundingClientRect())}
      `;
    }
    
    return {
      buttonRect: JSON.stringify(rect),
      centerX: cx,
      centerY: cy,
      overlapInfo
    };
  });
  
  console.log("Puppeteer Report:");
  console.log(report);
  
  await browser.close();
})();
