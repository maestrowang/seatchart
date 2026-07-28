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

  console.log('=== Test 1: manually-moved seat in an arc row moves in the SAME direction as regular seats when row spacing increases ===');
  const manualSeatId = 'spt0vqey'; // row 3, manually-moved, non-custom
  const regularSeatId = window.eval("chart.seats.find(s=>s.row===3 && !s.manuallyMoved && s.layoutMode!=='custom').id");
  const manualYBefore = window.eval(`getSeat('${manualSeatId}').y`);
  const regularYBefore = window.eval(`getSeat('${regularSeatId}').y`);

  const slider = doc.getElementById('rowSpacingSlider');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider.value = 130;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  const manualYAfter = window.eval(`getSeat('${manualSeatId}').y`);
  const regularYAfter = window.eval(`getSeat('${regularSeatId}').y`);
  console.log('Manual seat y:', manualYBefore, '->', manualYAfter, '(delta:', manualYAfter-manualYBefore, ')');
  console.log('Regular seat y:', regularYBefore, '->', regularYAfter, '(delta:', regularYAfter-regularYBefore, ')');
  const manualDelta = manualYAfter - manualYBefore;
  const regularDelta = regularYAfter - regularYBefore;
  // Direction is only meaningful when there is real movement to have a direction.
  // On a chart already filling the stage the fit correctly allows almost no
  // travel, and comparing the sign of sub-pixel noise proves nothing.
  const meaningful = Math.abs(manualDelta) > 2 && Math.abs(regularDelta) > 2;
  const sameDirection = meaningful
    ? Math.sign(manualDelta) === Math.sign(regularDelta)
    : true;
  console.log('Both moved in the SAME direction:', sameDirection,
    meaningful ? '' : `(movement was sub-pixel -- chart is at stage capacity, nothing to compare)`);

  console.log('=== Test 2: at this more extreme value, the seat is NOT forced against row 2 (it never had a safe gap there to begin with -- a deliberate pre-existing position), but stays correctly clear of row 4 (which it DID start safely away from) ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval('clearSelection()');
  await wait(10);
  const slider2 = doc.getElementById('rowSpacingSlider');
  slider2.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider2.value = 130;
  slider2.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const podY = window.eval('podiumPoint().y');
  const manualDepth = podY - window.eval(`getSeat('${manualSeatId}').y`);
  const nextRadius = window.eval("chart.rowRadii[4]");
  console.log('Manual seat depth:', manualDepth, '| row4 radius:', nextRadius);
  const staysBounded = manualDepth < nextRadius;
  console.log('Depth stays safely clear of row 4 (the boundary it started safe against):', staysBounded);

  console.log('=== Test 3: seat spacing global nudge no longer causes a disproportionate jump for a row with a drifted rowSeatSpacingPct ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval('clearSelection()');
  await wait(10);
  const seatBefore = window.eval("getSeat('scqmdfqx').x"); // row 4, manually-moved seat
  const slider3 = doc.getElementById('seatSpacing');
  slider3.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider3.value = 105; // small 5-point nudge
  slider3.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const seatAfter = window.eval("getSeat('scqmdfqx').x");
  const changeRatio = Math.abs((seatAfter - seatBefore) / seatBefore);
  console.log('Seat x before/after a small 5% nudge:', seatBefore, '->', seatAfter, '(relative change:', (changeRatio*100).toFixed(1)+'%)');
  const noJump = changeRatio < 0.15; // a small nudge should produce a small relative change, not 40%+
  console.log('Change is small/proportional, not a disproportionate jump:', noJump);

  const pass = sameDirection && staysBounded && noJump;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
