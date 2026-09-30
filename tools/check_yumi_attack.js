// Browser regression checks for Yumi and Common Sense Club. Requires Playwright + Edge.
// Usage: NODE_PATH=<Playwright modules> node tools/check_yumi_attack.js [game URL]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  const errors = [], reports = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    // Keep this focused on local attack artwork; don't wait for the entire character library.
    await page.route('**/js/main.js', route => route.fulfill({
      contentType: 'application/javascript',
      body: fs.readFileSync(path.join(root,'game/js/main.js'),'utf8')
        .replace('await preload();', 'await MB.preloadImages(MB.AttackArt.urls);'),
    }));
    const references = await Promise.all(['sprites/yumi/happy.webp', 'sprites/eri/scared.webp'].map(async sprite => {
      const response = await page.request.get('https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/' + sprite);
      assert(response.ok(), sprite + ' reference available');
      return response.body();
    }));
    await page.route('https://pub-40e44f2871f24e02bab0f29092f963c9.r2.dev/**', route => {
      const eri = /\/eri\//.test(route.request().url());
      return route.fulfill({ contentType: 'image/webp', body: references[eri ? 1 : 0] });
    });
    await page.goto(process.argv[2] || 'http://127.0.0.1:8765/?dev', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.MB && MB.view);
    await page.locator('#loading').click();
    await page.evaluate(() => document.getElementById('btn-gallery').click());
    await page.waitForFunction(() => MB.battle && MB.battle.units(0).length);
    await page.waitForTimeout(1300); // let the gallery's initial summon finish before selecting Yumi
    await page.locator('#gallery-search').fill('yumi');
    await page.locator('.gal-row:not(.style):not(.bond)').filter({ hasText: 'Yumi' }).first().click();
    await page.waitForFunction(() => MB.battle.units(0).some(u => u.card.id === 'yumi'));
    await page.waitForTimeout(1200);
    const cases = [
      { name:'gallery-left-dummy', slot:1, targetSlot:1 },
      { name:'gallery-right-dummy', slot:1, targetSlot:2 },
      { name:'left-edge-to-right-edge', slot:0, targetSlot:3, battle:true },
      { name:'right-edge-to-left-edge', slot:3, targetSlot:0, battle:true },
      { name:'enemy-leader', slot:1, leader:true, battle:true },
      { name:'reverse-side', slot:3, targetSlot:0, reverse:true, battle:true },
      { name:'duet-gallery', slot:1, targetSlot:2, duet:true },
      { name:'duet-left-edge', slot:3, targetSlot:0, duet:true, battle:true },
      { name:'duet-enemy-leader', slot:1, leader:true, duet:true, battle:true },
    ];
    for (const c of cases) {
      if (c.duet) {
        await page.evaluate(() => {
          document.getElementById('gallery-panel').classList.remove('hidden');
          document.getElementById('arena').classList.add('gallery-mode');
        });
        await page.locator('#gallery-search').fill('common sense');
        await page.locator('.gal-row.bond').filter({ hasText: 'Common Sense Club' }).click();
        await page.waitForFunction(() => MB.battle.units(0).some(u => u.card.fused && MB.view.ents.has(u.uid)));
        await page.waitForTimeout(1200);
      }
      await page.evaluate(c => {
        document.getElementById('gallery-panel').classList.toggle('hidden', !!c.battle);
        document.getElementById('arena').classList.toggle('gallery-mode', !c.battle);
      }, c);
      const result = await page.evaluate(async c => {
        const V=MB.view, b=MB.battle;
        const a=b.units(0).find(u=>V.ents.has(u.uid) && (c.duet ? u.card.fused : u.card.id==='yumi')), oldSide=a.side;
        a.slot=c.slot; if(c.reverse) a.side=1;
        const av=V.ents.get(a.uid), A=V.pos(a);
        gsap.set(av.el,{x:A.x,y:A.y});
        let t;
        if(c.leader) t=b.me(1).leader;
        else {
          const side=c.reverse?0:1;
          t=b.units(side).find(u=>u.card.id==='dummy');
          if(!t) t=await b.summon(side,MB.cardDef('dummy'),c.targetSlot);
          t.slot=c.targetSlot;
        }
        const tv=V.ents.get(t.uid), T=V.pos(t);
        if(tv)gsap.set(tv.el,{x:T.x,y:T.y});
        await MB.preloadImages(Object.values(MB.AttackArt.yumi).concat(Object.values(MB.AttackArt.eri)));
        const seen={}, falls={}, frames=[], contacts=[]; let running=true, hits=0;
        const started=performance.now();
        const monitor=()=>{
          document.querySelectorAll('.bb[data-phase]').forEach(node=>{
            const rider=node.dataset.rider, phase=node.dataset.phase, body=node.body;
            if(+gsap.getProperty(body,'opacity')<0.1)return;
            const box=body.getBoundingClientRect(), key=rider+':'+phase;
            if(!seen[key])seen[key]={time:performance.now()-started,x:+gsap.getProperty(node,'x'),y:+gsap.getProperty(node,'y'),top:box.top,bottom:box.bottom};
            if(phase==='fall'){
              const f=falls[rider]||(falls[rider]={x:+gsap.getProperty(node,'x'),drift:0,lastTop:box.top,backwards:0});
              f.drift=Math.max(f.drift,Math.abs(+gsap.getProperty(node,'x')-f.x));
              if(box.top<f.lastTop-2)f.backwards++;
              f.lastTop=box.top;
            }
            if(phase==='ride' && +gsap.getProperty(body,'opacity')>0.9)frames.push({rider,left:box.left,right:box.right,top:box.top,bottom:box.bottom});
          });
          if(running)requestAnimationFrame(monitor);
        };
        requestAnimationFrame(monitor);
        await V.attackFx(a,t,()=>{
          hits++;
          const n=document.querySelector('.bb[data-phase="ride"][data-rider="yumi"]');
          const box=n.body.getBoundingClientRect(), face=T.x-A.x<0?-1:1;
          const probe=V.billboard('', '', T.x,T.y);
          probe.body.style.width=probe.body.style.height='1px';
          gsap.set(probe.body,{y:-V.heightOf(t)*0.5});
          const p=probe.body.getBoundingClientRect();probe.remove();
          const dx=box.left+box.width*(face<0?0.06:0.94)-(p.left+p.width/2);
          const dy=box.top+box.height*0.69-(p.top+p.height/2);
          contacts.push({dx,dy});
          V.floatText(T,V.heightOf(t)*0.5,'-1','dmg');
        });
        running=false;
        const restored={x:+gsap.getProperty(av.el,'x'),y:+gsap.getProperty(av.el,'y'),opacity:+gsap.getProperty(av.figure,'opacity'),
          parts:av.img.children.length===2?[...av.img.children].map(p=>+gsap.getProperty(p,'opacity')):[]};
        a.side=oldSide;
        return {name:c.name,hits,seen,falls,contacts,restored,home:A,frames,
          leftovers:document.querySelectorAll('.bb[data-phase]').length};
      }, c);
      assert.equal(result.hits,1,c.name+' hit count');
      assert.equal(result.leftovers,0,c.name+' cleanup');
      assert.equal(result.restored.opacity,1,c.name+' original figure visible');
      assert(result.restored.parts.every(p=>p===1),c.name+' duo visible');
      assert(Math.abs(result.restored.x-result.home.x)<1 && Math.abs(result.restored.y-result.home.y)<1,c.name+' restored slot');
      for(const f of Object.values(result.falls))assert(f.drift<0.1,c.name+' vertical return');
      for(const [key,v]of Object.entries(result.seen))if(key.endsWith(':fall'))assert(v.bottom<0,c.name+' starts above screen');
      assert(result.contacts.every(p=>Math.hypot(p.dx,p.dy)<8),c.name+' nose on target');
      const y=result.seen['yumi:rise'], A=result.home;
      assert(y.y>A.y,c.name+' breach in front');
      if(c.duet)assert(result.seen['eri:ride'].time-result.seen['yumi:ride'].time>250,c.name+' Eri follows');
      assert(result.frames.every(f=>f.left>=0 && f.right<=1600 && f.top>=0 && f.bottom<=900),c.name+' ride remains onscreen');
      delete result.frames;reports.push(result); console.log('PASS '+c.name);
    }
    const audio=await page.evaluate(async()=>{const ctx=new AudioContext(); const buffer=await ctx.decodeAudioData(await(await fetch('assets/sounds/dolphin-456151.mp3')).arrayBuffer());await ctx.close();return buffer.duration;});
    assert(audio>1,'dolphin sample decodes');
    assert.equal(errors.length,0,errors.join('\n'));
    fs.mkdirSync(path.join(root,'output/yumi-check'),{recursive:true});
    fs.writeFileSync(path.join(root,'output/yumi-check/results.json'),JSON.stringify({audioDuration:audio,reports},null,2));
    console.log(reports.length+' browser checks passed; dolphin audio decoded.');
  } catch (e) {
    fs.mkdirSync(path.join(root,'output/yumi-check'),{recursive:true});
    await page.screenshot({path:path.join(root,'output/yumi-check/failure.png')});
    console.log(await page.evaluate(()=>({units:MB.battle?.units(0).map(u=>u.card.id),rows:[...document.querySelectorAll('.gal-row:not([hidden])')].map(e=>e.textContent).slice(0,8)})));
    throw e;
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
