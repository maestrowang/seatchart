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
  window.eval('clearSelection()');
  await wait(10);

  console.log('rowShapes:', window.eval('JSON.stringify(chart.rowShapes)'));
  console.log('rowRadii before:', window.eval('JSON.stringify(chart.rowRadii)'));

  const before = window.eval(`
    JSON.stringify(Array.from({length: chart.rowIndex}, (_, i) => 
      chart.seats.filter(s=>s.row===i).map(s=>({x:Math.round(s.x), y:Math.round(s.y)}))
    ))
  `);
  console.log('Positions before, by row:', before);

  const slider = doc.getElementById('rowSpacingSlider');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider.value = 130;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);

  console.log('rowRadii after 130%:', window.eval('JSON.stringify(chart.rowRadii)'));
  const after = window.eval(`
    JSON.stringify(Array.from({length: chart.rowIndex}, (_, i) => 
      chart.seats.filter(s=>s.row===i).map(s=>({x:Math.round(s.x), y:Math.round(s.y)}))
    ))
  `);
  console.log('Positions after 130%, by row:', after);

  // Check for row-radius collisions (indicating overlap)
  const radii = JSON.parse(window.eval('JSON.stringify(chart.rowRadii)'));
  for(let i=1;i<radii.length;i++){
    if(radii[i]!==undefined && radii[i-1]!==undefined){
      const gap = radii[i]-radii[i-1];
      console.log(`Row ${i-1}->${i} radius gap: ${gap.toFixed(2)}`);
    }
  }
})().catch(e=>console.error('ERROR:', e));
