const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:1420' // Vite server might not be enough, we need to connect to Tauri WebView if possible.
  });
})();
