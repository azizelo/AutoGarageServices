const puppeteer = require('puppeteer');
const fs = require('fs');
(async ()=>{
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  try{
    const page = await browser.newPage();
    const url = process.argv[2] || 'https://autogarageservices.ma';
    await page.setViewport({width:1280,height:900});
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 30000});
    await new Promise(r => setTimeout(r, 800));
    const screenshotPath = `fa-diagnostic-${url.replace(/[:\/]+/g,'_').replace(/\W/g,'').slice(0,40)}.png`;
    await page.screenshot({path: screenshotPath, fullPage: true});

    const fontResources = await page.evaluate(()=> performance.getEntriesByType('resource').filter(r=> r.initiatorType==='font' || /fontawesome|fontawesome-webfont/i.test(r.name)).map(r=>({name:r.name, type:r.initiatorType, status:r.responseStatus||null, transferSize:r.transferSize||null})));

    const sample = await page.evaluate(()=>{
      const el = document.querySelector('.fa.fa-car');
      if(!el) return {found:false};
      const computed = window.getComputedStyle(el).getPropertyValue('font-family');
      const before = window.getComputedStyle(el, '::before').getPropertyValue('content');
      const after = window.getComputedStyle(el, '::after').getPropertyValue('content');
      const outer = el.outerHTML;
      return {found:true, outer, computed, before, after, innerHTML: el.innerHTML};
    });

    const stylesheets = await page.evaluate(()=> Array.from(document.styleSheets || []).map(s=>({href: s.href||null, rulesCount: (s.cssRules && s.cssRules.length) || null})).slice(0,200));

    const faRuleFound = await page.evaluate(()=>{
      try{
        for(const s of document.styleSheets){
          try{
            const rules = s.cssRules || [];
            for(const r of rules){
              if(r.selectorText && /\.fa(:before|:after)?/.test(r.selectorText)) return {href: s.href||null, selector: r.selectorText, css: r.cssText};
            }
          }catch(e){ /* cross-origin stylesheet */ }
        }
      }catch(e){}
      return null;
    });

    const result = {url, screenshotPath, fontResources, sample, stylesheets, faRuleFound};
    fs.writeFileSync('fa-diagnostic-result.json', JSON.stringify(result, null, 2));
    console.log('Wrote fa-diagnostic-result.json and', screenshotPath);
  }catch(e){
    console.error('Error:', e && e.message);
  }finally{ await browser.close(); }
})();