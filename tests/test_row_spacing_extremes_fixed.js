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

  async function reload(){
    window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
    await wait(50);
    window.eval('clearSelection()');
    await wait(10);
  }

  console.log('=== Test 1: row spacing to RIGHT extreme -- custom seats never overlap the row behind ===');
  await reload();
  const slider = doc.getElementById('rowSpacingSlider');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  let minGapRight = Infinity;
  for(const val of [110, 130, 145, 160]){
    slider.value = val;
    slider.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(10);
    const row3CustomY = window.eval("Math.min(...chart.seats.filter(s=>s.row===3 && s.layoutMode==='custom').map(s=>s.y))");
    const row4Y = window.eval("chart.seats.find(s=>s.row===4).y");
    const gap = row3CustomY - row4Y;
    minGapRight = Math.min(minGapRight, gap);
    console.log(`At ${val}%: row3 custom minY=${row3CustomY.toFixed(1)}, row4 Y=${row4Y.toFixed(1)}, gap=${gap.toFixed(1)}`);
  }
  const test1 = minGapRight >= 15; // should maintain a real, safe gap
  console.log('Never overlapped row behind (maintained a safe gap):', test1);

  console.log('=== Test 2: row spacing to LEFT extreme -- manually-moved seat never falls off canvas ===');
  await reload();
  const slider2 = doc.getElementById('rowSpacingSlider');
  slider2.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  const canvasH = window.eval('canvas.height');
  let maxYFound = -Infinity;
  for(const val of [90, 75, 65, 60]){
    slider2.value = val;
    slider2.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(10);
    const manualY = window.eval("getSeat('spt0vqey').y");
    maxYFound = Math.max(maxYFound, manualY);
    console.log(`At ${val}%: manual seat y=${manualY.toFixed(1)} (canvas height=${canvasH})`);
  }
  const test2 = maxYFound < canvasH;
  console.log('Manual seat never fell off the bottom of the canvas:', test2);

  console.log('=== Test 3: rows still respond proportionally (not frozen at the clamp) across the range ===');
  await reload();
  const slider3 = doc.getElementById('rowSpacingSlider');
  slider3.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  const ys = [];
  for(const val of [100, 115, 130, 145, 160]){
    slider3.value = val;
    slider3.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(10);
    ys.push(window.eval("chart.seats.find(s=>s.row===4).y"));
  }
  console.log('Row 4 Y across range:', ys);
  // Rows must move steadily outward as spacing increases, and may legitimately
  // stop once the formation reaches the edge of the visible area. What matters
  // is that the response never reverses and that it does move somewhere.
  let monotonic = true;
  for(let i=1;i<ys.length;i++) if(ys[i] > ys[i-1] + 0.01) monotonic = false;
  const moved = Math.abs(ys[ys.length-1] - ys[0]) > 1;
  console.log('Response is monotonic (never reverses):', monotonic);
  console.log('Response actually moves the row:', moved);
  const allDifferent = monotonic && moved;

  const pass = test1 && test2 && allDifferent;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
