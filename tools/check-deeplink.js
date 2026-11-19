#!/usr/bin/env node
/* Deep-link checks: loads index.html?… in Chromium at phone and desktop sizes and checks that each
   link opens the right topic with no console errors, and that the plain URL still opens the normal start.
   Needs Playwright: NODE_PATH=/path/to/node_modules node tools/check-deeplink.js
   Links: ?course=3A&topic=explore (Heat Explorer), ?course=1A&topic=hess (Hess's Law card board) */
const {chromium}=require('playwright'),path=require('path'),{pathToFileURL}=require('url');
const base=pathToFileURL(path.join(__dirname,'..','index.html')).href;
const SIZES={phone:{viewport:{width:390,height:844},hasTouch:true,isMobile:true},desktop:{viewport:{width:1280,height:900}}};
const vis=(p,sel)=>p.locator(sel).first().isVisible();
const inView=(p,sel)=>p.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.top<innerHeight&&r.bottom>0},sel);
const state=p=>p.evaluate(()=>({course,mode,topic:q.topic,hess:!!q.hessGame}));
const CASES=[
 ['?course=3A&topic=explore',async p=>{const out=[],s=await state(p);if(s.course!=='3A'||s.mode!=='explore')out.push('not 3A explore: '+JSON.stringify(s));
   if(!await vis(p,'#heatExplorer'))out.push('Heat Explorer not visible');if(!await vis(p,'#heatExplorer input[type=range]'))out.push('no slider');
   if(!await inView(p,'#practice'))out.push('practice card not on screen');if(!await p.locator('[data-mode=explore].active').count())out.push('card not active');return out;}],
 ['?topic=explore',async p=>(await state(p)).mode==='explore'&&await vis(p,'#heatExplorer')?[]:['default-course explore failed']],
 ['?course=1A&topic=hess',async p=>{const out=[],s=await state(p);if(s.course!=='1A'||s.mode!=='hess'||!s.hess)out.push('not 1A hess: '+JSON.stringify(s));
   if(!await vis(p,'#hessBoard'))out.push('Hess board not visible');if(await p.locator('#hessBoard .hess-card').count()<2)out.push('fewer than 2 reaction cards');
   if(!await inView(p,'#practice'))out.push('practice card not on screen');
   await p.click('#new');if(!(await state(p)).hess||!await vis(p,'#hessBoard'))out.push('next question is not a Hess board');return out;}],
 ['?topic=hess',async p=>{const s=await state(p);return s.course==='3A'&&s.mode==='mixed'?[]:['hess opened outside CHEM 1A: '+JSON.stringify(s)]}],
 ['?course=1A&topic=explore',async p=>(await state(p)).mode==='mixed'?[]:['3A-only explore opened in 1A']],
 ['?course=1A',async p=>{const s=await state(p);return s.course==='1A'&&s.mode==='mixed'?[]:['course=1A start changed: '+JSON.stringify(s)]}],
 ['',async p=>{const out=[],s=await state(p);if(s.course!=='3A'||s.mode!=='mixed')out.push('plain start changed: '+JSON.stringify(s));
   if(await p.evaluate(()=>scrollY)>0)out.push('plain URL scrolled the page');return out;}],
];
(async()=>{const b=await chromium.launch();let fails=0,n=0;
 for(const [size,opts] of Object.entries(SIZES))for(const [qs,test] of CASES){const ctx=await b.newContext(opts),p=await ctx.newPage(),errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base+qs);await p.waitForTimeout(800);const out=[...await test(p),...errs.map(e=>'console: '+e)];n++;
  if(out.length){fails++;console.log('FAIL',size,qs||'(plain)',out.join('; '));}await ctx.close();}
 await b.close();console.log(n+' deep-link checks: '+(fails?fails+' FAILED':'all passed'));process.exit(fails?1:0);})();
