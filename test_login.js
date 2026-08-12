const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3000/login.html');
    
    console.log('Filling in credentials...');
    await page.type('#username', 'administrator');
    await page.type('#password', 'misdashboard9090');
    
    console.log('Clicking login...');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);
    
    console.log('On dashboard. Waiting a bit to see what renders initially...');
    await new Promise(r => setTimeout(r, 2000));
    
    const html1 = await page.evaluate(() => document.getElementById('ticketsTableBody').innerHTML);
    fs.writeFileSync('tickets_initial.html', html1);
    
    console.log('Clicking refresh button...');
    await page.click('button[onclick="fetchTickets()"]');
    await new Promise(r => setTimeout(r, 2000));
    
    const html2 = await page.evaluate(() => document.getElementById('ticketsTableBody').innerHTML);
    fs.writeFileSync('tickets_after_refresh.html', html2);
    
    await browser.close();
    console.log('Done!');
  } catch (e) {
    console.error(e);
  }
})();
