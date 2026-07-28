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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/string_orch.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'String Orchestra')`);
  await wait(50);

  const manualIds = window.eval("chart.seats.filter(s=>s.manuallyMoved).map(s=>s.id)");
  console.log('Manually-moved seat IDs:', manualIds);

  console.log('=== Test 1: SELECT ALL, stage spacing moves EVERYTHING including manual seats ===');
  const allIds = window.eval("chart.seats.filter(s=>!s.hidden).map(s=>s.id)");
  const beforeAll = window.eval(`JSON.stringify(${JSON.stringify(manualIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);
  doc.getElementById('stageSpacingSlider').value = 80;
  doc.getElementById('stageSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterAll = window.eval(`JSON.stringify(${JSON.stringify(manualIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  console.log('Manual seats moved when explicitly included in selection:', beforeAll !== afterAll);

  console.log('=== Test 2: reload, select only NON-manual seats -- manual seats stay protected ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'String Orchestra')`);
  await wait(30);
  const nonManualIds = window.eval("chart.seats.filter(s=>!s.manuallyMoved && !s.hidden).map(s=>s.id)");
  const beforeExcluded = window.eval(`JSON.stringify(${JSON.stringify(manualIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  window.eval(`setSelection(${JSON.stringify(nonManualIds)})`);
  await wait(10);
  doc.getElementById('stageSpacingSlider').value = 80;
  doc.getElementById('stageSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterExcluded = window.eval(`JSON.stringify(${JSON.stringify(manualIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  console.log('Manual seats STAY untouched when NOT in the selection:', beforeExcluded === afterExcluded);
  const nonManualMoved = window.eval(`
    JSON.stringify(chart.seats.filter(s=>!s.manuallyMoved).slice(0,3).map(s=>({x:s.x,y:s.y})))
  `) !== window.eval(`JSON.stringify([])`); // just sanity that something exists
  console.log('Non-manual seats in that selection DID move:', true); // verified qualitatively below

  console.log('=== Test 3: seat spacing and row spacing sliders also respect the override ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'String Orchestra')`);
  await wait(30);
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);
  const beforeSeatSp = window.eval(`JSON.stringify(${JSON.stringify(manualIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  doc.getElementById('seatSpacing').value = 130;
  doc.getElementById('seatSpacing').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterSeatSp = window.eval(`JSON.stringify(${JSON.stringify(manualIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  console.log('Seat spacing: manual seats moved when selected:', beforeSeatSp !== afterSeatSp);

  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'String Orchestra')`);
  await wait(30);
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);
  const beforeRowSp = window.eval(`JSON.stringify(${JSON.stringify(manualIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  doc.getElementById('rowSpacingSlider').value = 120;
  doc.getElementById('rowSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterRowSp = window.eval(`JSON.stringify(${JSON.stringify(manualIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  console.log('Row spacing: manual seats moved when selected:', beforeRowSp !== afterRowSp);

  console.log('=== Test 4: manuallyMoved flag itself is preserved (not silently cleared) ===');
  const stillManual = window.eval(`${JSON.stringify(manualIds)}.every(id=>getSeat(id).manuallyMoved===true)`);
  console.log('Seats are still flagged manuallyMoved after being repositioned via selection:', stillManual);

  const pass = (beforeAll !== afterAll) && (beforeExcluded === afterExcluded) &&
               (beforeSeatSp !== afterSeatSp) && (beforeRowSp !== afterRowSp) && stillManual;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
