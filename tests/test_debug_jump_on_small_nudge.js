const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('/home/claude/test.html', 'utf8');
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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/latest_upload.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval('clearSelection()');
  await wait(10);

  console.log('=== ALL manually-moved and custom seat positions BEFORE any slider touch ===');
  const allSpecial = window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.manuallyMoved || s.layoutMode==='custom').map(s=>({id:s.id, row:s.row, custom:s.layoutMode==='custom', x:Math.round(s.x*10)/10, y:Math.round(s.y*10)/10})))
  `);
  console.log(allSpecial);
  const before = JSON.parse(allSpecial);

  console.log('=== Row spacing: nudge from 100 to 101 (TINY change) ===');
  const slider = doc.getElementById('rowSpacingSlider');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider.value = 101;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  const afterStr = window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.manuallyMoved || s.layoutMode==='custom').map(s=>({id:s.id, row:s.row, custom:s.layoutMode==='custom', x:Math.round(s.x*10)/10, y:Math.round(s.y*10)/10})))
  `);
  const after = JSON.parse(afterStr);
  console.log(afterStr);

  console.log('=== Comparing before/after for a TINY 1% nudge ===');
  let maxJump = 0;
  for(let i=0;i<before.length;i++){
    const b = before[i], a = after.find(x=>x.id===b.id);
    if(!a) continue;
    const dist = Math.hypot(a.x-b.x, a.y-b.y);
    if(dist > maxJump) maxJump = dist;
    if(dist > 10){
      console.log(`SEAT ${b.id} (row ${b.row}, custom=${b.custom}) JUMPED ${dist.toFixed(1)}px: (${b.x},${b.y}) -> (${a.x},${a.y})`);
    }
  }
  console.log('Max movement for a 1% nudge:', maxJump.toFixed(1), 'px');
})().catch(e=>console.error('ERROR:', e));
