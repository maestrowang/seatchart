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

  const straightIds = window.eval("chart.seats.filter(s=>s.row===4||s.row===5).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(straightIds)})`);
  await wait(10);

  console.log('chart.rowShapes[4]:', window.eval('chart.rowShapes[4]'));
  console.log('chart.rowShapes[5]:', window.eval('chart.rowShapes[5]'));

  console.log('=== Directly call rebuildStraightRow(4, 200, selection) ===');
  const before = window.eval("JSON.stringify(chart.seats.filter(s=>s.row===4).map(s=>({x:Math.round(s.x),y:Math.round(s.y)})))");
  window.eval(`rebuildStraightRow(4, 200, selection)`);
  const after = window.eval("JSON.stringify(chart.seats.filter(s=>s.row===4).map(s=>({x:Math.round(s.x),y:Math.round(s.y)})))");
  console.log('Before:', before);
  console.log('After: ', after);

  console.log('=== Check rowShapeOf for each seat in row 4 ===');
  const shapeCheck = window.eval(`
    JSON.stringify(chart.seats.filter(s=>s.row===4).map(s=>({id:s.id, rowShapeOf: rowShapeOf(s), layoutMode: s.layoutMode, manuallyMoved: s.manuallyMoved})))
  `);
  console.log(shapeCheck);
})().catch(e=>console.error('ERROR:', e));
