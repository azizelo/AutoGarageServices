const puppeteer = require('puppeteer');
const fs = require('fs');
(async ()=>{
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  try{
    const page = await browser.newPage();
    const url = process.argv[2] || 'https://autogarageservices.ma/?_bust=1';
    await page.setViewport({width:1280,height:900});
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 30000});
    await new Promise(r => setTimeout(r, 800));
    const screenshotPath = `fa-all-diagnostic-${url.replace(/[:\/]+/g,'_').replace(/\W/g,'').slice(0,40)}.png`;
    await page.screenshot({path: screenshotPath, fullPage: true});

    const fontResources = await page.evaluate(()=> performance.getEntriesByType('resource').filter(r=> r.initiatorType==='font' || /fontawesome|fontawesome-webfont/i.test(r.name)).map(r=>({name:r.name, type:r.initiatorType, status:r.responseStatus||null, transferSize:r.transferSize||null})));

    const icons = await page.evaluate(()=>{
      const els = Array.from(document.querySelectorAll('[class*="fa"]'));
      return els.map((el, i)=>{
        const computed = window.getComputedStyle(el).getPropertyValue('font-family');
        const before = window.getComputedStyle(el, '::before').getPropertyValue('content');
        const after = window.getComputedStyle(el, '::after').getPropertyValue('content');
        const dispBefore = before !== 'none' && before !== '""' && before !== "''";
        const rect = el.getBoundingClientRect();
        const visible = !!(rect.width && rect.height);
        const text = el.textContent || '';
        return {index:i, outer: el.outerHTML.slice(0,200), className: el.className, computed, before, after, dispBefore, visible, text};
      });
    });

    // Summarize counts
    const summary = {
      url, screenshotPath, fontResources, iconsCount: icons.length,
      iconsWithBefore: icons.filter(i=> i.dispBefore).length,
      iconsWithoutBefore: icons.filter(i=> !i.dispBefore).length,
      icons
    };

    fs.writeFileSync('fa-all-diagnostic-result.json', JSON.stringify(summary, null, 2));
    console.log('Wrote fa-all-diagnostic-result.json and', screenshotPath);
  }catch(e){
    console.error('Error:', e && e.message);
  }finally{ await browser.close(); }
})();