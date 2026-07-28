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
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);

  const allIds = window.eval("chart.seats.filter(s=>!s.hidden).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);

  console.log('=== Row 6 (internal index 5) positions BEFORE any slider change ===');
  const before = window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.row===5).map(s=>({x:Math.round(s.x), y:Math.round(s.y)})))
  `);
  console.log(before);
  console.log('rowRadii[5] before:', window.eval('chart.rowRadii[5]'));

  console.log('=== Test A: seat spacing slider ===');
  doc.getElementById('seatSpacing').value = 130;
  doc.getElementById('seatSpacing').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterSeatSpacing = window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.row===5).map(s=>({x:Math.round(s.x), y:Math.round(s.y)})))
  `);
  console.log('Row 6 after seat spacing 130%:', afterSeatSpacing);
  console.log('Changed:', before !== afterSeatSpacing);

  // reload fresh for next test
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(30);
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);

  console.log('=== Test B: row spacing slider ===');
  const beforeRowSpacing = window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.row===5).map(s=>({x:Math.round(s.x), y:Math.round(s.y)})))
  `);
  console.log('rowRadii before:', window.eval('JSON.stringify(chart.rowRadii)'));
  doc.getElementById('rowSpacingSlider').value = 130;
  doc.getElementById('rowSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterRowSpacing = window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.row===5).map(s=>({x:Math.round(s.x), y:Math.round(s.y)})))
  `);
  console.log('Row 6 after row spacing 130%:', afterRowSpacing);
  console.log('rowRadii after:', window.eval('JSON.stringify(chart.rowRadii)'));

  // reload fresh for next test
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(30);
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);

  console.log('=== Test C: stage spacing slider ===');
  const beforeStageSpacing = window.eval(`
    JSON.stringify({row4: chart.seats.filter(s=>s.row===4).map(s=>({x:Math.round(s.x),y:Math.round(s.y)})), row5: chart.seats.filter(s=>s.row===5).map(s=>({x:Math.round(s.x),y:Math.round(s.y)}))})
  `);
  console.log('Before:', beforeStageSpacing);
  doc.getElementById('stageSpacingSlider').value = 130;
  doc.getElementById('stageSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterStageSpacing = window.eval(`
    JSON.stringify({row4: chart.seats.filter(s=>s.row===4).map(s=>({x:Math.round(s.x),y:Math.round(s.y)})), row5: chart.seats.filter(s=>s.row===5).map(s=>({x:Math.round(s.x),y:Math.round(s.y)}))})
  `);
  console.log('After:', afterStageSpacing);
})().catch(e=>console.error('ERROR:', e));
