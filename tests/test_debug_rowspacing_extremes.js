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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/latest_upload.json', 'utf8'));

  async function reload(){
    window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
    await wait(50);
    window.eval('clearSelection()');
    await wait(10);
  }

  console.log('=== Row shapes and layoutModes overview ===');
  console.log('rowShapes:', window.eval('JSON.stringify(chart.rowShapes)'));
  console.log('Row 3 custom seats:', window.eval("JSON.stringify(chart.seats.filter(s=>s.row===3 && s.layoutMode==='custom').map(s=>({id:s.id,x:Math.round(s.x),y:Math.round(s.y)})))"));

  console.log('=== Test A: row spacing slider to RIGHT extreme (160%) ===');
  await reload();
  const slider = doc.getElementById('rowSpacingSlider');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider.value = 160;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterRight = window.eval(`
    JSON.stringify(Array.from({length: chart.rowIndex}, (_, i) => 
      chart.seats.filter(s=>s.row===i).map(s=>({x:Math.round(s.x), y:Math.round(s.y), custom:s.layoutMode==='custom'}))
    ))
  `);
  console.log('Positions at 160%, by row:', afterRight);
  console.log('rowRadii at 160%:', window.eval('JSON.stringify(chart.rowRadii)'));

  console.log('=== Test B: row spacing slider to LEFT extreme (60%) ===');
  await reload();
  const slider2 = doc.getElementById('rowSpacingSlider');
  slider2.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider2.value = 60;
  slider2.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const afterLeft = window.eval(`
    JSON.stringify(Array.from({length: chart.rowIndex}, (_, i) => 
      chart.seats.filter(s=>s.row===i).map(s=>({x:Math.round(s.x), y:Math.round(s.y)}))
    ))
  `);
  console.log('Positions at 60%, by row:', afterLeft);
  console.log('canvas height:', window.eval('canvas.height'));
})().catch(e=>console.error('ERROR:', e));
