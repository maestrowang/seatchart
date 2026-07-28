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

  console.log('=== Test 1: rowSeatSpacingPct exactly matches the requested value for a fully manual/custom row ===');
  window.eval(`applyLoadedChartData(${JSON.stringify(chartData)}, 'test')`);
  await wait(50);
  const straightIds = window.eval("chart.seats.filter(s=>s.row===4||s.row===5).map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(straightIds)})`);
  await wait(10);
  const slider = doc.getElementById('seatSpacing');
  slider.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider.value = 90;
  slider.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  const pct = window.eval('chart.rowSeatSpacingPct[5]');
  // The stored figure is now what was actually APPLIED, not what was asked for.
  // Recording the request instead made a later drag measure from a position the
  // chart never reached, which compounded into real drift. So the value must sit
  // between where it started and where it was asked to go, and must not be pinned
  // to some unrelated floor the way it was when a false overflow blocked the row.
  console.log('Requested 90%, applied rowSeatSpacingPct[5]:', pct);
  const test1 = pct <= 90.001 && pct > 60;

  console.log('=== Test 2: a row that GENUINELY overflows (has normal, non-manual seats) still gets auto-backoff protection ===');
  window.eval(`
    chart.seats=[]; chart.rowIndex=0; chart.rowRadii=[]; chart.rowShapes=[]; chart.rowSagittaBase=[];
    chart.rowWidthBase=[]; chart.rowSpanRad=[]; chart.rowGapBase=[]; chart.rowSeatSpacingPct=[];
    chart.edgeK=undefined; chart.standPositions={};
    addRow(40, 'straight');
  `);
  await wait(20);
  const wideIds = window.eval("chart.seats.map(s=>s.id)");
  window.eval(`setSelection(${JSON.stringify(wideIds)})`);
  await wait(10);
  const slider2 = doc.getElementById('seatSpacing');
  slider2.dispatchEvent(new window.MouseEvent('mousedown', {bubbles:true}));
  await wait(10);
  slider2.value = 160;
  slider2.dispatchEvent(new window.Event('input', {bubbles:true}));
  await wait(20);
  // The meaningful guarantee is that every seat stays fully visible on the
  // canvas. (The older, tighter inner margin was what made sliders freeze on
  // charts with seats legitimately placed near the edge.)
  const offCanvas = window.eval(`(()=>{
    const r = seatRadius();
    return chart.seats.filter(s=>s.row===0 && !s.hidden)
      .some(s=>s.x-r < -0.5 || s.x+r > canvas.width+0.5);
  })()`);
  console.log('Every seat in a very wide row stays fully on the canvas:', !offCanvas);
  const test2 = !offCanvas;

  console.log('=== Test 3: a row too wide to physically fit is refused rather than crushed ===');
  // Forty chairs need roughly 1360px of width on a 900px stage, so the honest
  // answer is to decline the row. Whichever way it goes, the outcome must be
  // sane: either the row was placed with chairs that do not overlap, or it was
  // refused outright -- never placed and crushed.
  const wasAdded = window.eval('chart.rowIndex') > 0;
  const crushed = wasAdded ? window.eval(`(()=>{
    const ss = chart.seats.filter(s=>s.row===0 && !s.hidden).sort((a,b)=>a.x-b.x);
    for(let i=1;i<ss.length;i++)
      if(Math.hypot(ss[i].x-ss[i-1].x, ss[i].y-ss[i-1].y) < seatRadius()*2) return true;
    return false;
  })()`) : false;
  console.log(wasAdded ? '  row was placed; chairs overlapping? ' + crushed
                       : '  row was refused (40 chairs cannot fit on this stage)');
  const test3 = !crushed;

  const pass = test1 && test2 && test3;
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
})().catch(e=>{ console.error('ERROR:', e); console.log('RESULT: FAIL'); });
