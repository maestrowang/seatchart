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
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);

  const timpaniId = window.eval("chart.seats.find(s=>s.preset==='Timpani').id");
  const straightIds = window.eval("chart.seats.filter(s=>s.row===4||s.row===5).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(straightIds)})`);
  await wait(10);

  console.log('rowRadii BEFORE mousedown:', window.eval('JSON.stringify(chart.rowRadii)'));

  const slider = doc.getElementById('stageSpacingSlider');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);

  console.log('freeformStageSnapshot after mousedown:', window.eval('JSON.stringify(freeformStageSnapshot)'));
  console.log('rowRadii AFTER mousedown (before input):', window.eval('JSON.stringify(chart.rowRadii)'));

  slider.value = 105;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  console.log('rowRadii AFTER input(105):', window.eval('JSON.stringify(chart.rowRadii)'));
  console.log('Timpani y after:', window.eval(`getSeat('${timpaniId}').y`));

  // Manually trace what applyStageSpacingToSelection computes internally
  const trace = window.eval(`
    JSON.stringify({
      rawAnchor: anchorYForStageSpacing(105),
      rows: [...rowsInSelection()],
      clampedAnchor: clampAnchorForRows(anchorYForStageSpacing(105), [...rowsInSelection()])
    })
  `);
  console.log('Trace:', trace);
})().catch(e=>console.error('ERROR:', e));
