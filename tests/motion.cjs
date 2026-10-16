const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webkit } = require('playwright');
const site = path.resolve(__dirname, '..');
const report = [];
const server = http.createServer((req,res)=>{
  const file = path.join(site, decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'') || 'index.html');
  try {const data=fs.readFileSync(file);const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[ext]||'application/octet-stream');res.end(data);} catch {res.statusCode=404;res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await webkit.launch({headless:true});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const goto=async(name='index.html')=>{await page.goto(base+'/'+name);await page.waitForTimeout(850);};
 const y=()=>page.evaluate(()=>scrollY);
 const settle=()=>page.waitForFunction(()=>!document.documentElement.classList.contains('is-page-scrolling'),{},{timeout:5000});
 const wheel=delta=>page.evaluate(delta=>document.body.dispatchEvent(new WheelEvent('wheel',{deltaY:delta,bubbles:true,cancelable:true})),delta);
 const burst=async(delta=110)=>{for(let i=0;i<4;i++){await wheel(delta);await page.waitForTimeout(25);}};
 const stop=selector=>page.$eval(selector,e=>e.getBoundingClientRect().top+scrollY-document.querySelector('.site-header').offsetHeight);
 const check=(label,condition,detail)=>{assert.ok(condition,label+': '+JSON.stringify(detail));report.push(label);};
 await goto();
 check('Desktop header is 104px',await page.$eval('.site-header',e=>e.offsetHeight)===104);
 await wheel(90);await page.waitForTimeout(80);let peek=await y();check('Light input immediately previews',peek>15&&peek<350,peek);
 await page.waitForTimeout(1050);await settle();check('Release returns to origin',Math.abs(await y())<2,await y());
 await burst();await page.waitForTimeout(1050);await settle();check('Deliberate input commits one page',Math.abs(await y()-await stop('#about'))<3,await y());
 await goto();await burst();
 for(let i=0;i<45;i++){await wheel(Math.max(1,90-i*2));await page.waitForTimeout(25);}
 await page.waitForTimeout(400);check('Momentum does not skip another page',Math.abs(await y()-await stop('#about'))<3,await y());
 await goto();await burst();await page.waitForTimeout(100);await wheel(-60);await page.waitForTimeout(1050);await settle();
 check('Reverse input releases a committed turn',Math.abs(await y())<3,await y());
 await goto();await wheel(110);await wheel(110);await wheel(70);await page.waitForTimeout(390);await wheel(70);await page.waitForTimeout(1200);await settle();
 check('A pull during return does not reuse old effort',Math.abs(await y())<3,await y());
 await goto();await burst();await page.waitForTimeout(100);await page.setViewportSize({width:1280,height:780});await page.waitForTimeout(650);
 check('Resize during commit keeps target section aligned',Math.abs(await y()-await stop('#about'))<3,await y());
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(500);
 check('Wide header recovers after mobile resize',await page.$eval('.site-header',e=>e.offsetHeight)===104);
 await goto();await wheel(90);await page.waitForTimeout(60);await page.keyboard.press('Escape');let cancelled=await y();await page.waitForTimeout(900);
 check('Keyboard cancels outstanding spring',Math.abs(await y()-cancelled)<2,await y());
 await goto();await wheel(110);await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 check('Reduced motion removes wheel capture',await page.evaluate(()=>!document.documentElement.classList.contains('wheel-paging')));
 check('Reduced motion clears reveal animations',await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.closest('main')).length===0));
 await page.emulateMedia({reducedMotion:'no-preference'});await goto();
 for(let i=0;i<6;i++){await burst();await page.waitForTimeout(1050);await settle();}
 check('Footer remains reachable',await page.evaluate(()=>Math.abs(scrollY-(document.documentElement.scrollHeight-innerHeight))<3),await y());
 for (const width of [320,390,768,1024,1201,1280,1440]) {
   await page.setViewportSize({width,height:850});await goto();
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,header:document.querySelector('.site-header').offsetHeight,items:[...document.querySelectorAll('.site-header > .brand-lockup,.site-header > nav,.site-header > .header-actions')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};})}));
   check('No horizontal overflow at '+width,layout.scroll<=width+1,layout);
   for(let i=0;i<layout.items.length;i++)for(let j=i+1;j<layout.items.length;j++){const a=layout.items[i],b=layout.items[j];check('Header controls do not overlap at '+width+' '+i+'/'+j,!(a.right>b.x+1&&b.right>a.x+1&&a.bottom>b.y+1&&b.bottom>a.y+1),layout);}
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await mobile.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
 for(const name of ['index.html','about.html','research.html','notes.html','personal.html','gallery.html']){
   await phone.goto(base+'/'+name);await phone.waitForTimeout(550);
   check('Mobile uses native scroll: '+name,await phone.evaluate(()=>!document.documentElement.classList.contains('wheel-paging')));
   check('Mobile width: '+name,await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 for(const name of ['index.html#research','notes.html#engineering','about.html#education']) {
   await page.setViewportSize({width:1440,height:900});await goto(name);
   const aligned=()=>page.evaluate(()=>Math.abs(document.getElementById(location.hash.slice(1)).getBoundingClientRect().top-document.querySelector('.site-header').offsetHeight)<3);
   check('Direct fragment: '+name,await aligned());
   await page.reload();await page.waitForTimeout(850);
   check('Fragment after reload: '+name,await aligned());
 }
 check('No JavaScript errors',errors.length===0,errors);
 console.log(JSON.stringify({passed:report.length,checks:report},null,2));
 } finally {await browser.close();server.close();}
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});
