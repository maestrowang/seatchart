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
  const chartData = JSON.parse(fs.readFileSync(__dirname + '/string_orch.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'String Orchestra')`);
  await wait(50);

  console.log('=== Select ALL seats, adjust stage spacing ===');
  const allIds = window.eval("chart.seats.filter(s=>!s.hidden).map(s=>s.id)");
  console.log('Total seats:', allIds.length);
  const before = window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.manuallyMoved).map(s=>({id:s.id, x:s.x, y:s.y})))
  `);
  console.log('Manually-moved seats BEFORE:', before);

  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);
  const doc = window.document;
  doc.getElementById('stageSpacingSlider').value = 80;
  doc.getElementById('stageSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  const after = window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.manuallyMoved).map(s=>({id:s.id, x:s.x, y:s.y})))
  `);
  console.log('Manually-moved seats AFTER:', after);
  console.log('Manually-moved seats UNCHANGED (confirms the reported bug):', before === after);

  const anyOtherSeatMoved = window.eval(`
    const nonManual = chart.seats.filter(s=>!s.manuallyMoved);
    nonManual.length > 0
  `);
  console.log('Other (non-manual) seats exist and presumably moved:', anyOtherSeatMoved);
})().catch(e=>console.error('ERROR:', e));
