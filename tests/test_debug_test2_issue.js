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

  const freeformIds = window.eval("chart.seats.filter(s=>s.row===-1).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(freeformIds)})`);
  await wait(10);
  const slider = doc.getElementById('seatSpacing');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);

  console.log('snapshot:', window.eval('JSON.stringify(seatSpacingFreeformSnapshot)'));

  slider.value = 100;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(10);
  console.log('at 100:', window.eval(`getSeat('${freeformIds[4]}').x`));

  slider.value = 105;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(10);
  console.log('at 105:', window.eval(`getSeat('${freeformIds[4]}').x`));
  console.log('snapshot after both:', window.eval('JSON.stringify(seatSpacingFreeformSnapshot)'));
})().catch(e=>console.error('ERROR:', e));
