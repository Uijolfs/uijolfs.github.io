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
 const goto=async(name='index.html')=>{await page.goto(base+'/'+name);await page.waitForTimeout(850);const size=page.viewportSize();await page.mouse.move(size.width*.65,size.height*.6);};
 const y=()=>page.evaluate(()=>scrollY);
 const settle=()=>page.waitForFunction(()=>!document.documentElement.classList.contains('is-page-scrolling'),{},{timeout:5000});
 // Browser wheel events exercise native scrolling inside the sections as well.
 const wheel=delta=>page.mouse.wheel(0,delta);
 const burst=async(delta=110)=>{for(let i=0;i<4;i++){await wheel(delta);await page.waitForTimeout(25);}};
 const stop=selector=>page.$eval(selector,e=>e.getBoundingClientRect().top+scrollY-document.querySelector('.site-header').offsetHeight);
 const check=(label,condition,detail)=>{assert.ok(condition,label+': '+JSON.stringify(detail));report.push(label);};
 const landing=async(target,timeout=1800)=>{
   await page.waitForFunction(expected=>Math.abs(scrollY-expected)<2,target,{timeout});
   await page.waitForTimeout(120);
   check('Landing remains at '+Math.round(target)+'px',Math.abs(await y()-target)<3,await y());
 };
 const armTrace=()=>page.evaluate(()=>{
   window.motionSamples=[];
   addEventListener('wheel',()=>{
     window.motionSamples.push(scrollY);
     const sample=()=>{window.motionSamples.push(scrollY);window.motionFrame=requestAnimationFrame(sample);};
     window.motionFrame=requestAnimationFrame(sample);
   },{once:true,capture:true});
 });
 const takeTrace=()=>page.evaluate(()=>{cancelAnimationFrame(window.motionFrame);return window.motionSamples;});
 const forwardOnly=(samples,lower,upper)=>samples.length>2&&samples.every((value,index)=>
   value>=lower-2&&value<=upper+2&&(!index||value>=samples[index-1]-2));
 await goto();
 check('Desktop header is 88px',await page.$eval('.site-header',e=>e.offsetHeight)===88);
 await wheel(90);await page.waitForTimeout(80);let peek=await y();check('Light input immediately previews',peek>15&&peek<350,peek);
 await page.waitForTimeout(1050);await settle();check('Release returns to origin',Math.abs(await y())<2,await y());
 await armTrace();await burst();const about=await stop('#about');await landing(about);
 const turn=await takeTrace();check('Deliberate turn is monotonic and does not overshoot',forwardOnly(turn,0,about),turn);
 check('Deliberate input commits one page',Math.abs(await y()-about)<3,await y());
 await goto();await wheel(110);await page.waitForTimeout(80);const high=await y();
 await page.waitForFunction(peak=>scrollY>12&&scrollY<peak*.8,high,{timeout:1500});
 await armTrace();await wheel(20);await page.waitForTimeout(90);const caught=await takeTrace();
 check('Catching a returning page follows the new pull immediately',forwardOnly(caught,caught[0],about)&&caught.at(-1)>caught[0]+5,caught);
 await landing(0);
 await goto();await burst();await page.waitForTimeout(190);await burst();await landing(await stop('#research'),2400);
 check('A new gesture during a turn reaches the following page',Math.abs(await y()-await stop('#research'))<3,await y());
 await goto();await burst();
 for(let i=0;i<45;i++){await wheel(Math.max(1,90-i*2));await page.waitForTimeout(25);}
 await page.waitForTimeout(400);check('Momentum does not skip another page',Math.abs(await y()-await stop('#about'))<3,await y());
 await goto();await burst();await page.waitForTimeout(100);await wheel(-60);await page.waitForTimeout(1050);await settle();
 check('Reverse input releases a committed turn',Math.abs(await y())<3,await y());
 await goto();await wheel(110);await wheel(110);await wheel(70);await page.waitForTimeout(390);await wheel(70);await page.waitForTimeout(1200);await settle();
 check('A pull during return does not reuse old effort',Math.abs(await y())<3,await y());
 await page.setViewportSize({width:1024,height:650});await goto('index.html#research');
 const research=await stop('#research');
 check('Short viewport exercises section overflow',await page.$eval('#research',e=>e.scrollHeight>e.clientHeight+20));
 for(let i=0;i<22;i++){await wheel(40);await page.waitForTimeout(40);}
 await landing(await stop('#notes'));
 check('Sustained input continues past an inner scroll boundary',await y()>research+100,await y());
 await goto('index.html#research');
 for(const delta of [180,140,110,80,60,40,25,15,8,5,3,...Array(15).fill(1)]){await wheel(delta);await page.waitForTimeout(16);}
 await landing(await stop('#research'));
 check('Decaying input stays inside a section at its boundary',await page.$eval('#research',e=>Math.abs(e.scrollTop-(e.scrollHeight-e.clientHeight))<3));
 await page.setViewportSize({width:1440,height:900});
 await goto();await burst();await page.waitForTimeout(100);await page.setViewportSize({width:1280,height:780});await page.waitForTimeout(650);
 check('Resize during commit keeps target section aligned',Math.abs(await y()-await stop('#about'))<3,await y());
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(500);
 check('Wide header recovers after mobile resize',await page.$eval('.site-header',e=>e.offsetHeight)===88);
 await goto();await wheel(90);await page.waitForTimeout(60);await page.keyboard.press('Escape');let cancelled=await y();await page.waitForTimeout(900);
 check('Keyboard cancels outstanding spring',Math.abs(await y()-cancelled)<2,await y());
 await goto();await wheel(110);await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 check('Reduced motion removes wheel capture',await page.evaluate(()=>!document.documentElement.classList.contains('wheel-paging')));
 check('Reduced motion clears reveal animations',await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.closest('main')).length===0));
 await page.emulateMedia({reducedMotion:'no-preference'});await goto();
 for(let i=0;i<6;i++){await burst();await page.waitForTimeout(1050);await settle();}
 check('Footer remains reachable',await page.evaluate(()=>Math.abs(scrollY-(document.documentElement.scrollHeight-innerHeight))<3),await y());
 await goto('index.html#personal');const personal=await y();const bottom=await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
 await armTrace();await wheel(110);await landing(bottom);const footerTurn=await takeTrace();
 check('Short footer turn lands without reversing or overshooting',forwardOnly(footerTurn,personal,bottom),footerTurn);
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
 await context.route('**/wordmark.css?*',async route=>{
   await new Promise(resolve=>setTimeout(resolve,150));await route.continue();
 });
 await page.setViewportSize({width:1024,height:900});
 await goto('about.html#education');await goto('index.html#research');
 const tabletAligned=()=>page.evaluate(()=>Math.abs(document.querySelector('#research').getBoundingClientRect().top-document.querySelector('.site-header').getBoundingClientRect().height)<3);
 check('Slow stylesheet preserves the initial tablet fragment',await tabletAligned(),await y());
 await page.reload();await page.waitForTimeout(850);
 check('Slow stylesheet preserves the tablet fragment after reload',await tabletAligned(),await y());
 check('No JavaScript errors',errors.length===0,errors);
 console.log(JSON.stringify({passed:report.length,checks:report},null,2));
 } finally {await browser.close();server.close();}
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});
