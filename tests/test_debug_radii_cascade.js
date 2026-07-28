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
  const chartData = JSON.parse(fs.readFileSync(__dirname + '/row6_bug2.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);

  console.log('rowGapBase:', window.eval('JSON.stringify(chart.rowGapBase)'));
  console.log('rowRadii BEFORE:', window.eval('JSON.stringify(chart.rowRadii)'));
  console.log('maxRowRadius():', window.eval('maxRowRadius()'));

  const allIds = window.eval("chart.seats.filter(s=>!s.hidden).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);

  // Manually step through applyRowSpacingToSelection's logic to see radii at each row
  const trace = window.eval(`
    dedupeRowRadii();
    const results = [];
    const rows = [...rowsInSelection()].sort((a,b)=>a-b);
    rows.forEach(i=>{
      if(i === 0) return;
      const gapBase = chart.rowGapBase[i] || 0;
      const prevRadius = chart.rowRadii[i-1];
      results.push({row:i, prevRadius, gapBase, requestedGap: gapBase*1.3});
    });
    JSON.stringify(results, null, 2)
  `);
  console.log('Trace (before actual slider fires):', trace);

  const doc = window.document;
  doc.getElementById('rowSpacingSlider').dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  doc.getElementById('rowSpacingSlider').value = 130;
  doc.getElementById('rowSpacingSlider').dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  console.log('rowRadii AFTER 130%:', window.eval('JSON.stringify(chart.rowRadii)'));
  console.log('Gap between row4 and row5:', window.eval('chart.rowRadii[5] - chart.rowRadii[4]'));
  console.log('Gap between row3 and row4:', window.eval('chart.rowRadii[4] - chart.rowRadii[3]'));
})().catch(e=>console.error('ERROR:', e));
