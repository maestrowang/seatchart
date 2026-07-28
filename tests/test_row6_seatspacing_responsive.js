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
  const chartData = JSON.parse(fs.readFileSync('/home/claude/row6_bug2.json', 'utf8'));
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);

  const straightIds = window.eval("chart.seats.filter(s=>s.row===4||s.row===5).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(straightIds)})`);
  await wait(10);

  const slider = doc.getElementById('seatSpacing');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);

  const row5Width = (val) => {
    const xs = window.eval("chart.seats.filter(s=>s.row===5).map(s=>s.x)");
    return Math.max(...xs) - Math.min(...xs);
  };

  console.log('=== Test: row 6 (index 5) responds proportionally as the slider changes, not frozen at one fixed value ===');
  const widths = [];
  for(const val of [80, 100, 120, 140, 160]){
    slider.value = val;
    slider.dispatchEvent(new window.Event('input', {bubbles:true}));
    await wait(10);
    const w = row5Width();
    widths.push(w);
    console.log(`Slider ${val}% -> row6 width: ${w.toFixed(1)}, rowSeatSpacingPct[5]: ${window.eval('chart.rowSeatSpacingPct[5]')}`);
  }

  const allDifferent = new Set(widths.map(w=>Math.round(w))).size === widths.length;
  console.log('Row 6 width changes distinctly at each slider value (not frozen):', allDifferent);
  const monotonic = widths.every((w,i) => i===0 || w > widths[i-1]);
  console.log('Width increases monotonically as slider increases:', monotonic);

  console.log(allDifferent && monotonic ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
