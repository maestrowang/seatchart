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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/Symphony_Orchestra_test__seatchart.json', 'utf8'));

  console.log('=== Test 1: global seat size (no selection) does not touch positions or spacing ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(30);
  window.eval('setSelection([])');
  const posBefore1 = window.eval("JSON.stringify(chart.seats.map(s=>({x:s.x,y:s.y})))");
  const spacingBefore1 = window.eval("JSON.stringify({row:chart.rowSpacing, seat:chart.seatSpacing})");
  doc.getElementById('seatSize').value = 130;
  doc.getElementById('seatSize').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const posAfter1 = window.eval("JSON.stringify(chart.seats.map(s=>({x:s.x,y:s.y})))");
  const spacingAfter1 = window.eval("JSON.stringify({row:chart.rowSpacing, seat:chart.seatSpacing})");
  console.log('Positions unchanged (global size, no selection):', posBefore1 === posAfter1);
  console.log('Spacing unchanged:', spacingBefore1 === spacingAfter1);
  const seatSizeUpdated = window.eval('chart.seatSize') === 130;
  console.log('chart.seatSize actually updated:', seatSizeUpdated);

  console.log('=== Test 2: scoped seat size (selection) does not touch positions or spacing ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(30);
  const allIds = window.eval("chart.seats.map(s=>s.id)");
  const posBefore2 = window.eval("JSON.stringify(chart.seats.map(s=>({x:s.x,y:s.y})))");
  const spacingBefore2 = window.eval("JSON.stringify({row:chart.rowSpacing, seat:chart.seatSpacing})");
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);
  doc.getElementById('seatSize').value = 140;
  doc.getElementById('seatSize').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const posAfter2 = window.eval("JSON.stringify(chart.seats.map(s=>({x:s.x,y:s.y})))");
  const spacingAfter2 = window.eval("JSON.stringify({row:chart.rowSpacing, seat:chart.seatSpacing})");
  console.log('Positions unchanged (all seats selected, size bumped):', posBefore2 === posAfter2);
  console.log('Spacing unchanged:', spacingBefore2 === spacingAfter2);
  const sizeScalesApplied = window.eval("chart.seats.every(s=>s.sizeScale === 1.4)");
  console.log('sizeScale correctly applied to all selected seats:', sizeScalesApplied);

  console.log('=== Test 3: partial selection also leaves everything else untouched ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(30);
  const someIds = window.eval("chart.seats.slice(0,5).map(s=>s.id)");
  const otherIds = window.eval("chart.seats.slice(5).map(s=>s.id)");
  const otherPosBefore = window.eval(`JSON.stringify(${JSON.stringify(otherIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  window.eval(`setSelection(${JSON.stringify(someIds)})`);
  await wait(10);
  doc.getElementById('seatSize').value = 135;
  doc.getElementById('seatSize').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const otherPosAfter = window.eval(`JSON.stringify(${JSON.stringify(otherIds)}.map(id=>({x:getSeat(id).x,y:getSeat(id).y})))`);
  console.log('Seats OUTSIDE the selection are completely untouched:', otherPosBefore === otherPosAfter);
  const selectedScaled = window.eval(`${JSON.stringify(someIds)}.every(id=>getSeat(id).sizeScale===1.35)`);
  console.log('Seats IN the selection correctly got the new scale:', selectedScaled);

  const pass = posBefore1===posAfter1 && spacingBefore1===spacingAfter1 && seatSizeUpdated &&
               posBefore2===posAfter2 && spacingBefore2===spacingAfter2 && sizeScalesApplied &&
               otherPosBefore===otherPosAfter && selectedScaled;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
