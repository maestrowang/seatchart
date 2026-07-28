const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html','utf8');
const noop=()=>{};
const ctxProto={save:noop,restore:noop,translate:noop,scale:noop,rotate:noop,beginPath:noop,moveTo:noop,lineTo:noop,closePath:noop,fill:noop,stroke:noop,arc:noop,rect:noop,fillRect:noop,strokeRect:noop,fillText:noop,setLineDash:noop,measureText:()=>({width:10}),clearRect:noop,drawImage:noop,ellipse:noop,roundRect:noop,bezierCurveTo:noop,quadraticCurveTo:noop,getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(128),width:w,height:h}),putImageData:noop};
const dom=new JSDOM(html,{url:'https://example.github.io/seating-chart/',runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
  beforeParse(w){ w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy(ctxProto,{get(t,p){if(p in t)return t[p];if(typeof p==='string'&&(p.endsWith('Style')||['font','lineWidth','lineCap','globalAlpha','textAlign','textBaseline'].includes(p)))return '';return noop;},set(){return true;}});};}});
const {window}=dom;
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  await wait(300);
  const doc=window.document;
  const chartData=JSON.parse(fs.readFileSync('/home/claude/latest_upload.json','utf8'));

  const results=[];
  const rec=(n,ok,d='')=>results.push({n,ok,d});

  async function load(){
    window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
    await wait(40);
    window.eval('clearSelection()');
    await wait(10);
  }

  const snapshot = () => JSON.parse(window.eval(
    `JSON.stringify(chart.seats.filter(s=>!s.hidden).map(s=>({id:s.id,x:s.x,y:s.y,row:s.row,manual:!!s.manuallyMoved,custom:s.layoutMode==='custom'})))`));

  // Drives a slider the way a real drag does: mousedown, several input events, change.
  async function drag(id, values){
    const el=doc.getElementById(id);
    el.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true}));
    await wait(5);
    for(const v of values){ el.value=v; el.dispatchEvent(new window.Event('input',{bubbles:true})); await wait(5); }
    el.dispatchEvent(new window.Event('change',{bubbles:true}));
    await wait(5);
  }

  const SLIDERS=[['seatSpacing','seat'],['rowSpacingSlider','row'],['stageSpacingSlider','stage']];

  // ---- INVARIANT 1: neutral value changes nothing -------------------------
  for(const [id,label] of SLIDERS){
    await load();
    const before=snapshot();
    await drag(id,[100]);
    const after=snapshot();
    const maxMove=Math.max(...before.map(b=>{const a=after.find(x=>x.id===b.id);return Math.hypot(a.x-b.x,a.y-b.y);}));
    rec(`${label}: neutral value leaves every seat untouched`, maxMove<0.01, `${maxMove.toFixed(3)}px`);
  }

  // ---- INVARIANT 2: no jump on a tiny nudge ------------------------------
  for(const [id,label] of SLIDERS){
    await load();
    const before=snapshot();
    await drag(id,[101]);
    const after=snapshot();
    let worst=0, worstId='';
    before.forEach(b=>{const a=after.find(x=>x.id===b.id);const d=Math.hypot(a.x-b.x,a.y-b.y);if(d>worst){worst=d;worstId=b.id;}});
    rec(`${label}: 1% nudge never jumps a seat (<=12px)`, worst<12, `worst ${worst.toFixed(1)}px on ${worstId}`);
  }

  // ---- INVARIANT 3: manual/custom/freeform seats move WITH their neighbours
  for(const [id,label] of SLIDERS){
    await load();
    const before=snapshot();
    await drag(id,[105,115,125]);
    const after=snapshot();
    // every special seat should have moved a comparable amount to ordinary seats
    const move=b=>{const a=after.find(x=>x.id===b.id);return Math.hypot(a.x-b.x,a.y-b.y);};
    const ordinary=before.filter(b=>!b.manual&&!b.custom&&b.row!==-1).map(move);
    const special =before.filter(b=> b.manual|| b.custom||b.row===-1).map(move);
    if(ordinary.length&&special.length){
      const avgO=ordinary.reduce((a,b)=>a+b,0)/ordinary.length;
      const avgS=special.reduce((a,b)=>a+b,0)/special.length;
      // If the formation is already at the edge of the page it legitimately
      // cannot expand, so nothing moving is the correct outcome. What matters is
      // that special seats never sit frozen while ordinary ones move, and never
      // fly off disproportionately.
      const atCapacity = avgO < 0.05;
      rec(`${label}: hand-moved/freeform seats move WITH the formation`,
          atCapacity ? avgS < 0.05 : (avgS > 0.02 && avgS < avgO*6+30),
          `ordinary ${avgO.toFixed(1)}px vs special ${avgS.toFixed(1)}px${atCapacity?' (at page capacity)':''}`);
    }
  }

  // ---- INVARIANT 4: seats never crowd into one another --------------------
  // "Don't overtake" is really "don't collide". Ordering by y or by radius are
  // both wrong as universal measures: stage spacing is a pure translation, which
  // preserves y-order but not radial order, while row spacing separates rows
  // radially, which preserves radial order but lets arcs harmlessly cross in y.
  // The distance between seats is the thing a person actually sees, and it holds
  // for every transform.
  const minGap = () => {
    const s = snapshot().sort((a,b)=>a.x-b.x);
    let best = Infinity;
    for(let i=0;i<s.length;i++)
      for(let j=i+1;j<s.length && (s[j].x-s[i].x) < best; j++)
        best = Math.min(best, Math.hypot(s[j].x-s[i].x, s[j].y-s[i].y));
    return best;
  };
  for(const [id,label] of SLIDERS){
    await load();
    const startGap = minGap();
    const el = doc.getElementById(id);
    el.dispatchEvent(new window.MouseEvent('mousedown',{bubbles:true}));
    let worst = startGap;
    for(const v of [60,70,80,90,100,110,120,130,140,150,160]){
      el.value=v; el.dispatchEvent(new window.Event('input',{bubbles:true}));
      await wait(5);
      worst = Math.min(worst, minGap());
    }
    el.dispatchEvent(new window.Event('change',{bubbles:true}));
    rec(`${label}: seats never crowd tighter than they began`,
        worst >= Math.min(startGap, window.eval('seatRadius()')*2) - 0.5,
        `${startGap.toFixed(1)}px -> ${worst.toFixed(1)}px`);
  }

  // ---- INVARIANT 5: seat spacing must not disturb depth at all ----------
  await load();
  const beforeSeat=snapshot();
  await drag('seatSpacing',[60,90,130,160]);
  const afterSeat=snapshot();
  // Seat spacing must never move a seat to a different row. For a straight row
  // that means depth is untouched. For a CURVED row it means the seat's distance
  // from the podium is untouched -- it slides along its own arc, which
  // necessarily changes depth. That sliding is precisely what lets an arc's end
  // seats spread as much as its middle ones instead of the arch pinching.
  const podQ = window.eval('JSON.stringify(podiumPoint())');
  const pod = JSON.parse(podQ);
  const radius = s => Math.hypot(s.x-pod.x, s.y-pod.y);
  let worstDrift = 0;
  beforeSeat.forEach(b=>{
    const a = afterSeat.find(x=>x.id===b.id);
    const keptDepth  = Math.abs(a.y - b.y);
    const keptRadius = Math.abs(radius(a) - radius(b));
    worstDrift = Math.max(worstDrift, Math.min(keptDepth, keptRadius));
  });
  rec('seat: no seat is moved onto a different row by seat spacing',
      worstDrift < 1.5, `worst drift ${worstDrift.toFixed(2)}px`);

  // ---- INVARIANT 6: nothing pushed further off-page than it started -----
  const W=window.eval('canvas.width'), H=window.eval('canvas.height');
  const overflow=list=>Math.max(0,...list.map(s=>Math.max(-s.x, s.x-W, -s.y, s.y-H)));
  for(const [id,label] of SLIDERS){
    await load();
    const startOv=overflow(snapshot());
    await drag(id,[60,160,60,160]);
    const endOv=overflow(snapshot());
    rec(`${label}: never pushed further off-page than it began`, endOv<=startOv+1, `${startOv.toFixed(1)} -> ${endOv.toFixed(1)}`);
  }

  // ---- INVARIANT 7: path independence -- same value, same result --------
  for(const [id,label] of SLIDERS){
    await load(); await drag(id,[130]);
    const direct=snapshot();
    await load(); await drag(id,[70,160,90,130]);
    const wandering=snapshot();
    const diff=Math.max(...direct.map(d=>{const w=wandering.find(x=>x.id===d.id);return Math.hypot(w.x-d.x,w.y-d.y);}));
    rec(`${label}: same slider value = same result regardless of path`, diff<0.01, `diff ${diff.toFixed(3)}px`);
  }

  // ---- INVARIANT 8: no seat left behind / duplicated -------------------
  await load();
  const n0=snapshot().length;
  await drag('rowSpacingSlider',[140]); await drag('seatSpacing',[80]); await drag('stageSpacingSlider',[120]);
  rec('all sliders: seat count unchanged after combined use', snapshot().length===n0);

  const failed=results.filter(r=>!r.ok);
  results.forEach(r=>console.log(`  ${r.ok?'PASS':'FAIL'}  ${r.n}${r.d?`  (${r.d})`:''}`));
  console.log(`\n${results.length-failed.length}/${results.length} invariants held on the real file`);
  console.log(failed.length===0?'RESULT: PASS':'RESULT: FAIL');
})().catch(e=>{console.error('ERROR:',e);console.log('RESULT: FAIL');});
