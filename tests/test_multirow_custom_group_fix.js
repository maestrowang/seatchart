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
  const chartData = JSON.parse(fs.readFileSync(__dirname + '/row6_bug2.json', 'utf8'));

  console.log('=== Set up: select seats spanning TWO separate straight rows ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  const straightIds = window.eval("chart.seats.filter(s=>s.row===4||s.row===5).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(straightIds)})`);
  await wait(10);

  console.log('=== Test 1: isCustomGroupSelection is FALSE for a multi-row selection ===');
  const isCustomGroupMultiRow = window.eval('isCustomGroupSelection()');
  console.log('isCustomGroupSelection() for two separate straight rows:', isCustomGroupMultiRow);

  console.log('=== Test 2: a SINGLE straight row selection still correctly triggers the custom-group path ===');
  const singleRowIds = window.eval("chart.seats.filter(s=>s.row===4).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(singleRowIds)})`);
  await wait(10);
  const isCustomGroupSingleRow = window.eval('isCustomGroupSelection()');
  console.log('isCustomGroupSelection() for a single straight row:', isCustomGroupSingleRow);

  console.log('=== Test 3: seat spacing on two separate straight rows keeps each row uniform (no diagonal) ===');
  window.eval(`setSelection(${JSON.stringify(straightIds)})`);
  await wait(10);
  const slider = doc.getElementById('seatSpacing');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider.value = 130;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const row4Ys = window.eval("chart.seats.filter(s=>s.row===4).map(s=>Math.round(s.y*100)/100)");
  const row5Ys = window.eval("chart.seats.filter(s=>s.row===5).map(s=>Math.round(s.y*100)/100)");
  const row4Uniform = new Set(row4Ys).size === 1;
  const row5Uniform = new Set(row5Ys.filter((y,i)=>i!==4)).size === 1; // seat index 4 is the intentionally-offset Timpani
  console.log('Row 4 Y values:', row4Ys);
  console.log('Row 5 Y values:', row5Ys);
  console.log('Row 4 stays uniform (no diagonal):', row4Uniform);
  console.log('Row 5 stays uniform aside from its intentional Timpani offset:', row5Uniform);

  console.log('=== Test 4: row spacing on two separate straight rows keeps each row uniform ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval(`setSelection(${JSON.stringify(straightIds)})`);
  await wait(10);
  const slider2 = doc.getElementById('rowSpacingSlider');
  slider2.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider2.value = 130;
  slider2.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const row4YsB = window.eval("chart.seats.filter(s=>s.row===4).map(s=>Math.round(s.y*100)/100)");
  const row5YsB = window.eval("chart.seats.filter(s=>s.row===5).map(s=>Math.round(s.y*100)/100)");
  const row4UniformB = new Set(row4YsB).size === 1;
  const row5UniformB = new Set(row5YsB.filter((y,i)=>i!==4)).size === 1; // seat index 4 is the intentionally-offset Timpani
  console.log('Row 4 stays uniform:', row4UniformB, '| Row 5 stays uniform aside from Timpani:', row5UniformB);

  console.log('=== Test 5: stage spacing on two separate straight rows keeps each row uniform ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval(`setSelection(${JSON.stringify(straightIds)})`);
  await wait(10);
  const slider3 = doc.getElementById('stageSpacingSlider');
  slider3.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider3.value = 130;
  slider3.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const row4YsC = window.eval("chart.seats.filter(s=>s.row===4).map(s=>Math.round(s.y*100)/100)");
  const row5YsC = window.eval("chart.seats.filter(s=>s.row===5).map(s=>Math.round(s.y*100)/100)");
  const row4UniformC = new Set(row4YsC).size === 1;
  const row5UniformC = new Set(row5YsC.filter((y,i)=>i!==4)).size === 1;
  console.log('Row 4 stays uniform:', row4UniformC, '| Row 5 stays uniform aside from Timpani:', row5UniformC);

  const pass = !isCustomGroupMultiRow && isCustomGroupSingleRow && row4Uniform && row5Uniform &&
               row4UniformB && row5UniformB && row4UniformC && row5UniformC;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
