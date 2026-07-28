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

  const freeformIds = window.eval("chart.seats.filter(s=>s.row===-1).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(freeformIds)})`);
  await wait(10);

  console.log('=== Test 1: dragging seat spacing across an extreme range never sends freeform chairs off-canvas ===');
  const slider = doc.getElementById('seatSpacing');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  let allWithinBounds = true;
  const canvasW = window.eval('canvas.width');
  const canvasH = window.eval('canvas.height');
  for(const val of [70, 90, 100, 120, 140, 160]){
    slider.value = val;
    slider.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(10);
    const positions = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
    const outOfBounds = positions.some(p => p.x < 0 || p.x > canvasW || p.y < 0 || p.y > canvasH);
    if(outOfBounds){
      allWithinBounds = false;
      console.log(`At ${val}%, out-of-bounds positions found:`, positions.filter(p => p.x<0||p.x>canvasW||p.y<0||p.y>canvasH));
    }
  }
  console.log('All freeform chairs stayed within canvas bounds across the full slider range:', allWithinBounds);

  console.log('=== Test 2: chairs still respond proportionally (not frozen) within the safe range ===');
  // Check responsiveness where the chart actually has room to move. Near the
  // top of the range the formation reaches the edge of the visible area and
  // correctly stops widening -- saturation there is the desired behaviour, not
  // a dead slider.
  const spanAt = async v => {
    slider.value = v; slider.dispatchEvent(new window.Event('input', {bubbles:true})); await wait(10);
    const xs = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>getSeat(id).x))`));
    return Math.max(...xs) - Math.min(...xs);
  };
  const s60 = await spanAt(60), s80 = await spanAt(80), s100 = await spanAt(100);
  const respondsProportionally = s60 < s80 && s80 < s100;
  console.log(`Chair spread responds across the range with headroom: ${s60.toFixed(0)} -> ${s80.toFixed(0)} -> ${s100.toFixed(0)}`);
  console.log('Chairs still respond to the slider:', respondsProportionally);

  console.log('=== Test 3: row spacing also never sends freeform chairs off-canvas ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval(`setSelection(${JSON.stringify(freeformIds)})`);
  await wait(10);
  const slider2 = doc.getElementById('rowSpacingSlider');
  slider2.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  let allWithinBounds2 = true;
  for(const val of [70, 100, 130, 160]){
    slider2.value = val;
    slider2.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(10);
    const positions = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>({x:getSeat(id).x, y:getSeat(id).y})))`));
    const outOfBounds = positions.some(p => p.x < 0 || p.x > canvasW || p.y < 0 || p.y > canvasH);
    if(outOfBounds) allWithinBounds2 = false;
  }
  console.log('Row spacing keeps freeform chairs within canvas bounds:', allWithinBounds2);

  const pass = allWithinBounds && respondsProportionally && allWithinBounds2;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
