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
  const chartData = JSON.parse(fs.readFileSync(__dirname + '/row6_bug.json', 'utf8'));

  console.log('=== Load the uploaded file, select ALL seats including freeform chairs ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  const allIds = window.eval("chart.seats.filter(s=>!s.hidden).map(s=>s.id)");
  const freeformIds = window.eval("chart.seats.filter(s=>s.row===-1).map(s=>s.id)");
  console.log('Freeform chair count:', freeformIds.length);
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);

  const beforeY = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>getSeat(id).y))`));
  console.log('Freeform chair Y positions before:', beforeY);

  console.log('=== Simulate a stage-spacing drag session (mousedown, then input) ===');
  const slider = doc.getElementById('stageSpacingSlider');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider.value = 130;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  const afterY = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>getSeat(id).y))`));
  console.log('Freeform chair Y positions after stage spacing 130%:', afterY);
  const allMoved = freeformIds.every((id, i)=> beforeY[i] !== afterY[i]);
  console.log('All freeform chairs moved:', allMoved);

  console.log('=== Confirm the shift amount matches the anchor delta (consistent translation) ===');
  const deltas = beforeY.map((y, i) => afterY[i] - y);
  console.log('Deltas:', deltas);
  const allSameDelta = deltas.every(d => Math.abs(d - deltas[0]) < 0.01);
  console.log('All freeform chairs shifted by the SAME amount (rigid translation):', allSameDelta);

  console.log('=== Test: releasing the slider (change event) clears the snapshot ===');
  slider.dispatchEvent(new window.Event('change', {bubbles:true}));
  await wait(10);
  const snapshotCleared = window.eval('spacingGesture') === null;
  console.log('Snapshot cleared after release:', snapshotCleared);

  console.log('=== Test: a NEW drag session without freeform chairs selected does not move them ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(30);
  const nonFreeformIds = window.eval("chart.seats.filter(s=>s.row!==-1 && !s.hidden).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(nonFreeformIds)})`);
  await wait(10);
  const beforeY2 = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>getSeat(id).y))`));
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider.value = 130;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterY2 = JSON.parse(window.eval(`JSON.stringify(${JSON.stringify(freeformIds)}.map(id=>getSeat(id).y))`));
  const untouchedWhenNotSelected = JSON.stringify(beforeY2) === JSON.stringify(afterY2);
  console.log('Freeform chairs untouched when NOT part of the selection:', untouchedWhenNotSelected);

  const pass = freeformIds.length > 0 && allMoved && allSameDelta && snapshotCleared && untouchedWhenNotSelected;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
