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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/row6_bug.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);

  console.log('rowSeatSpacingPct:', window.eval('JSON.stringify(chart.rowSeatSpacingPct)'));
  console.log('rowOverflowsCanvas(5):', window.eval('rowOverflowsCanvas(5)'));
  console.log('rowWidthBase[5]:', window.eval('chart.rowWidthBase[5]'));
  console.log('canvas.width:', window.eval('canvas.width'));
  console.log('seatRadius():', window.eval('seatRadius()'));

  // Try directly calling reshapeStraightRowWidth to see if it even MOVES anything with override
  const allIds = window.eval("chart.seats.filter(s=>!s.hidden).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(allIds)})`);
  await wait(10);
  const before = window.eval("JSON.stringify(chart.seats.filter(s=>s.row===5).map(s=>s.x))");
  window.eval(`reshapeStraightRowWidth(5, chart.rowWidthBase[5] * 1.3, selection)`);
  const after = window.eval("JSON.stringify(chart.seats.filter(s=>s.row===5).map(s=>s.x))");
  console.log('Direct reshapeStraightRowWidth(5, ...) call:');
  console.log('before:', before);
  console.log('after: ', after);
  console.log('changed:', before !== after);
})().catch(e=>console.error('ERROR:', e));
