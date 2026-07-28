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
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  window.eval('clearSelection()');
  await wait(10);

  const slider = doc.getElementById('rowSpacingSlider');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);

  let neverOverlapping = true;
  for(const val of [105, 115, 130, 145, 160]){
    slider.value = val;
    slider.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(10);
    // For each row, get the average y -- rows should remain monotonically ordered by depth
    const rowAvgYs = window.eval(`
      Array.from({length: chart.rowIndex}, (_, i) => {
        const seats = chart.seats.filter(s=>s.row===i && !s.hidden);
        if(seats.length===0) return null;
        return seats.reduce((sum,s)=>sum+s.y,0)/seats.length;
      })
    `);
    console.log(`At ${val}%, row avg Y's:`, rowAvgYs.map(y=>y===null?null:Math.round(y)));
    // Rows should stay monotonically DECREASING in Y as row index increases (farther rows = smaller y)
    const validRows = rowAvgYs.filter(y=>y!==null);
    for(let i=1;i<validRows.length;i++){
      if(validRows[i] >= validRows[i-1]){
        neverOverlapping = false;
        console.log(`  OVERLAP DETECTED: row ${i} avg Y (${validRows[i]}) >= row ${i-1} avg Y (${validRows[i-1]})`);
      }
    }
  }
  console.log('Rows never overlapped/crossed order across the full slider range:', neverOverlapping);
  console.log(neverOverlapping ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
