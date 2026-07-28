const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const noop = () => {};
const fakeCtxProto = {
  save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
  beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop,
  arc: noop, rect: noop, fillRect: noop, strokeRect: noop, fillText: noop, setLineDash: noop,
  measureText: () => ({ width: 10 }), clearRect: noop, drawImage: noop, ellipse: noop, roundRect: noop,
  bezierCurveTo: noop, quadraticCurveTo: noop,
  getImageData(x,y,w,h){ return { data: new Uint8ClampedArray(w*h*4).fill(128), width:w, height:h }; },
  putImageData: noop,
};
const dom = new JSDOM(html, {
  url: 'https://example.github.io/seating-chart/',
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(window){
    window.HTMLCanvasElement.prototype.getContext = function(){
      return new Proxy(fakeCtxProto, {
        get(target, prop){
          if(prop in target) return target[prop];
          if(typeof prop === 'string' && (prop.endsWith('Style')||prop==='font'||prop==='lineWidth'||prop==='lineCap'||prop==='globalAlpha'||prop==='textAlign'||prop==='textBaseline')) return '';
          return noop;
        }, set(){ return true; }
      });
    };
  }
});
const { window } = dom;
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
(async()=>{
  await wait(300);
  const doc = window.document;
  const chartData = JSON.parse(fs.readFileSync(__dirname + '/latest_upload.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval('clearSelection()');
  await wait(10);

  const before = JSON.parse(window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.manuallyMoved || s.layoutMode==='custom' || s.row===-1).map(s=>({id:s.id, x:s.x, y:s.y})))
  `));

  const slider = doc.getElementById('seatSpacing');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider.value = 101; // tiny nudge
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  const after = JSON.parse(window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.manuallyMoved || s.layoutMode==='custom' || s.row===-1).map(s=>({id:s.id, x:s.x, y:s.y})))
  `));

  let maxJump = 0;
  for(const b of before){
    const a = after.find(x=>x.id===b.id);
    if(!a) continue;
    const dist = Math.hypot(a.x-b.x, a.y-b.y);
    if(dist > maxJump) maxJump = dist;
    if(dist > 15) console.log(`Seat ${b.id} jumped ${dist.toFixed(1)}px for a tiny 1% nudge`);
  }
  console.log('Max movement for a 1% seat-spacing nudge:', maxJump.toFixed(1), 'px');
  const test1 = maxJump < 15;
  console.log('No large jump on tiny nudge:', test1);

  console.log('=== Sanity re-check: overlap protection STILL works at genuine extremes ===');
  await wait(10);
  for(const val of [130, 160]){
    slider.value = val;
    slider.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(10);
  }
  const row3CustomY = window.eval("Math.min(...chart.seats.filter(s=>s.row===3 && s.layoutMode==='custom').map(s=>s.y))");
  const row4Y = window.eval("chart.seats.find(s=>s.row===4).y");
  const gap = row3CustomY - row4Y;
  console.log('At 160% seat spacing, gap between row3 custom and row4:', gap.toFixed(1));
  const test2 = gap >= 15;
  console.log('Still no overlap at extreme:', test2);

  const pass = test1 && test2;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
