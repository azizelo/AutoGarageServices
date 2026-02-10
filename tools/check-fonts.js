const puppeteer = require('puppeteer');
const fs = require('fs');
(async ()=>{
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  try{
    const page = await browser.newPage();
    const url = process.argv[2] || 'http://localhost:8080/';
    await page.setViewport({width:1280,height:900});
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 30000});
    // wait extra to ensure fonts load (compatibility)
    await new Promise(r => setTimeout(r, 800));
    const screenshotPath = `diagnostic-${url.replace(/[:\/]+/g,'_').replace(/\W/g,'').slice(0,40)}.png`;
    await page.screenshot({path: screenshotPath, fullPage: true});
    const fontResources = await page.evaluate(()=> performance.getEntriesByType('resource').filter(r=> r.initiatorType==='font' || /fontawesome|fontawesome-webfont/i.test(r.name)).map(r=>({name:r.name, type:r.initiatorType, status:r.responseStatus||null, transferSize:r.transferSize||null})));
    const sample = await page.evaluate(()=>{ const el = document.querySelector('.fa'); return el ? {outerHTML: el.outerHTML, computed: window.getComputedStyle(el).getPropertyValue('font-family')} : null;});
    const bodyHTML = await page.evaluate(()=> document.documentElement.outerHTML.slice(0,2000));
    const result = {url, screenshotPath, fontResources, sample, bodyHead: bodyHTML};
    const out = JSON.stringify(result, null, 2);
    fs.writeFileSync('diagnostic-result.json', out);
    console.log('Diagnostic written to diagnostic-result.json and', screenshotPath);
  }catch(e){
    console.error('Error:', e && e.message);
  }finally{
    await browser.close();
  }
})();